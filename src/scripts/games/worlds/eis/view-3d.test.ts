import { describe, expect, it } from 'vitest';
import { ICE_COLORS } from '../../../../data/games/worlds/eis/mitwachsen-ice-colors';
import { KESSEL_COLORS } from '../../../../data/games/worlds/eis/mitwachsen-kessel';
import { drawDeco, type DecoAt } from '../../mitwachsen-view';
import type { Cell } from '../../mitwachsen-world';
import { EIS_PACK, worldOf } from '../../test-worlds';
import { view3d } from './view-3d';
import { gateLook } from './view-3d-gate';
import { crystalGlint, crystalGlow, glowTint } from './mitwachsen-ice-look';

const at: DecoAt = { now: 1234, reduced: false, picked: {}, packs: {} };
const world = worldOf(1);
/** Erstes Feld um das Bett einer Gegend (sonst im Kessel, um das Schneebett) mit dieser Deko-Art */
function find(deco: Cell['deco'], home: 'eis' | 'lichtung' = 'eis'): [number, number, Cell] {
  const [bx, by] = world.homes[home].bed;
  for (let y = by - 25; y <= by + 25; y++)
    for (let x = bx - 25; x <= bx + 25; x++) {
      const c = world.cell(x, y);
      if (c.deco === deco) return [x, y, c];
    }
  throw new Error(`keine ${deco}`);
}
const snow: Cell = { h: 2, ground: 'snow', deco: null, region: 'eis', solid: false, biome: 'eis' };

describe('3D-Teil des Welt-Pakets der Eis-Welt (view-3d.ts)', () => {
  it('kommt per import() aus dem Paket, erst wenn die 3D-Ansicht ihn will', async () => {
    expect(await EIS_PACK.view3d!()).toBe(view3d);
    expect(view3d.gate).toBe('eis');
    expect(view3d.look).toBe(gateLook);
  });

  it('Iglu, Eisschale, Eistrog und Fischkiste wie in 2D; in 3D zuckt keine Flosse, die Kiste leert sich beim Fangen', () => {
    for (const deco of ['igloo', 'icebowl', 'watertrough', 'fishcrate'] as const) {
      const [x, y, c] = find(deco);
      expect(c.biome, deco).toBe('eis');
      const boxes = drawDeco(view3d, world, c, x, y, at);
      expect(boxes, deco).not.toBeNull(); // das Paket baut es (beim Iglu zeichnet ein Feld das ganze)
      expect(boxes, deco).toEqual(drawDeco(EIS_PACK.view!, world, c, x, y, at0));
    }
    // Der Trog auf der Lichtung bleibt aus Holz: Das Paket sagt dazu nichts (null), die 3D-Ansicht baut ihn wie immer
    const [tx, ty, trough] = find('watertrough', 'lichtung');
    expect(trough.biome).toBeUndefined();
    expect(drawDeco(view3d, world, trough, tx, ty, at)).toBeNull();
    const [cx, cy, crate] = find('fishcrate');
    const full = drawDeco(view3d, world, crate, cx, cy, at)!;
    const empty = drawDeco(view3d, world, crate, cx, cy, { ...at, picked: { [`${cx},${cy}`]: 1 } })!;
    expect(full.length).toBeGreaterThan(empty.length);
    expect(full.some((b) => b[8] === 'sway')).toBe(true); // Schwanzflossen wiegen sich im Wind
  });

  it('Boden: Schnee und Eis im Kessel, die Rutschspur glänzt erst bei offenem Eistor, sonst wie auf der Lichtung', () => {
    expect(view3d.ground(snow, [])).toEqual({ tiles: ['snowTop', 'ice', 'ice'] });
    expect(view3d.ground({ ...snow, ground: 'stone', region: 'border' }, [])?.tiles[0]).toBe('snowTop'); // Klippen
    expect(view3d.ground({ ...snow, ground: 'stone' }, [])).toBeNull();
    const slide: Cell = { ...snow, slide: true };
    expect(view3d.ground(slide, [])?.tiles[0]).toBe('snowTop');
    expect(view3d.ground(slide, ['eis'])).toEqual({ tiles: ['ice', 'ice', 'ice'], top: ICE_COLORS.slide[1] });
    expect(view3d.ground({ ...snow, region: 'wild' }, ['eis'])).toBeNull(); // Schnee draußen in der Landschaft
    expect(view3d.ground({ ...snow, biome: undefined, region: 'lichtung' }, ['eis'])).toBeNull();
  });

  it('Eiskristalle der Eis-Welt leuchten aus sich selbst (glow), Kristalle anderer Welten baut die 3D-Ansicht wie immer', () => {
    const [x, y, crystal] = find('crystal');
    const boxes = drawDeco(view3d, world, crystal, x, y, at)!;
    expect(boxes.length).toBeGreaterThan(1);
    expect(boxes.every((b) => b[8] === 'glow' && b[6] === crystal.color)).toBe(true);
    const cave: Cell = { ...crystal, biome: 'hoehle', region: 'wild', color: '#b48cf0' };
    expect(drawDeco(view3d, world, cave, x, y, at)).toBeNull();
  });

  it('Leuchtstärke der Kristalle: nur mit Polarlicht, sanft pulsierend, bei reduzierter Bewegung ruhig', () => {
    const times = Array.from({ length: 60 }, (_, i) => i * 250);
    expect(times.map((t) => crystalGlow(0, false, t))).toEqual(times.map(() => 0)); // ohne Polarlicht nichts
    const pulse = times.map((t) => crystalGlow(1, false, t));
    expect(Math.min(...pulse)).toBeGreaterThan(0.3);
    expect(Math.max(...pulse)).toBeLessThanOrEqual(1);
    expect(Math.max(...pulse) - Math.min(...pulse)).toBeGreaterThan(0.4); // es pulsiert
    expect(new Set(times.map((t) => crystalGlow(1, true, t)))).toEqual(new Set([0.8])); // ruhig
    expect(crystalGlow(0.5, true, 0)).toBeCloseTo(0.4); // mit dem Polarlicht ein- und ausblenden
    expect(crystalGlow(2, true, 0)).toBe(0.8);
    expect(crystalGlow(1, false, 0, 1)).not.toBe(crystalGlow(1, false, 0, 0)); // je Kristall versetzt
    // in 3D: ohne Leuchten wie gebaut, mit ihm heller und grüntürkis; bei reduzierter Bewegung steht es still
    expect(glowTint(0)).toEqual([1, 1, 1]);
    const [r, g, b] = glowTint(1);
    expect(g).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(r);
    expect(r).toBeGreaterThan(1);
    expect(view3d.glow!(0, false, 1000)).toEqual([1, 1, 1]);
    expect(view3d.glow!(1, true, 1000)).toEqual(view3d.glow!(1, true, 9000));
    expect(view3d.glow!(1, false, 1000)).not.toEqual(view3d.glow!(1, false, 2500));
    // am Tag blitzt ein Kristall nur kurz auf
    const glints = Array.from({ length: 200 }, (_, i) => crystalGlint(i * 50, 3, 4));
    expect(glints.filter((v) => v > 0).length).toBeGreaterThan(0);
    expect(glints.filter((v) => v > 0).length).toBeLessThan(40);
    expect(Math.max(...glints)).toBeLessThanOrEqual(1);
  });

  it('Eisschollen auf den Eislöchern liegen in 3D still wie in 2D bei reduzierter Bewegung; Seerosen baut die 3D-Ansicht wie immer', () => {
    const [x, y, floe] = find('floe');
    expect([floe.biome, floe.ground]).toEqual(['eis', 'water']);
    const boxes = drawDeco(view3d, world, floe, x, y, at)!;
    expect(boxes.length).toBeGreaterThan(0);
    expect(boxes.every((b) => b[7] === KESSEL_COLORS.floe[1])).toBe(true); // weiß obenauf
    expect(boxes).toEqual(drawDeco(EIS_PACK.view!, world, floe, x, y, at0));
    const lily: Cell = { ...floe, deco: 'lily', region: 'lichtung', biome: undefined, color: undefined };
    expect(drawDeco(view3d, world, lily, x, y, at)).toBeNull();
    expect(drawDeco(view3d, world, { ...lily, region: 'wild', biome: 'eis' }, x, y, at)).toBeNull();
    expect(drawDeco(null, world, floe, x, y, at)).toBeNull(); // solange der 3D-Teil lädt: offenes Wasser
  });

  it('Eisfall am Talende: Seiten in der Farbe des Felds auf fast weißen Kacheln (so hell wie in 2D), glattes Eis obenauf; andere Klippen bleiben verschneit', () => {
    const cliff: Cell = { ...snow, h: 6, ground: 'ice', deco: 'rock', region: 'border', solid: true };
    expect(view3d.ground({ ...cliff, color: KESSEL_COLORS.fall }, [])).toEqual({
      tiles: ['snowTop', 'snowTop', 'snowTop'],
      top: ICE_COLORS.ice[1],
      side: KESSEL_COLORS.fall,
    });
    expect(view3d.ground(cliff, ['eis'])).toEqual({ tiles: ['snowTop', 'ice', 'ice'] });
  });

  it('Eisberg: Stufen aus Eis mit Seiten in ihrem Blau, glattes Eis obenauf (wie der Eisfall); das Eis ringsum bleibt Eis', () => {
    const step: Cell = { ...snow, h: 4, ground: 'ice' };
    expect(view3d.ground({ ...step, color: KESSEL_COLORS.berg }, [])).toEqual({
      tiles: ['snowTop', 'snowTop', 'snowTop'],
      top: ICE_COLORS.ice[1],
      side: KESSEL_COLORS.berg,
    });
    expect(view3d.ground({ ...step, h: 1 }, [])).toBeNull(); // glattes Eis wie die Seen
  });

  it('das Bett im Kessel ist aus Schnee, sonst sagt das Paket nichts (Holz)', () => {
    expect(view3d.bedFrame!({ ...snow, deco: 'bed' })).toEqual([...ICE_COLORS.snow, 'schnee']);
    expect(view3d.bedFrame!({ ...snow, deco: 'bed', biome: undefined, region: 'lichtung' })).toBeNull();
  });
});

const at0: DecoAt = { ...at, reduced: true }; // 2D bei reduzierter Bewegung: auch dort zuckt nichts
