import { describe, expect, it } from 'vitest';
import { drawDeco, drawMark, type Box, type DecoAt } from './mitwachsen-view';
import { MARK_FRINGE } from '../../lib/games/shade';
import { mapColor } from './mitwachsen-map';
import { KESSEL_COLORS } from '../../data/games/worlds/eis/mitwachsen-kessel';
import type { Cell } from './mitwachsen-world';
import type { SkyScene } from './mitwachsen-sky';
import { EIS_PACK, worldOf } from './test-worlds';

const at: DecoAt = { now: 0, reduced: true, picked: {}, packs: {} };
const world = worldOf(1);
const view = EIS_PACK.view!;
/** Erstes Feld im Kessel (um das Schneebett) mit dieser Deko-Art */
function find(deco: Cell['deco']): [number, number, Cell] {
  const [bx, by] = world.homes.eis.bed;
  for (let y = by - 25; y <= by + 25; y++)
    for (let x = bx - 25; x <= bx + 25; x++) {
      const c = world.cell(x, y);
      if (c.deco === deco) return [x, y, c];
    }
  throw new Error(`keine ${deco}`);
}

describe('Haken der 2D-Ansicht für Welt-Pakete (drawDeco)', () => {
  it('Dinge der Eis-Welt zeichnet ihr Paket: Iglu, Eisschale, Fischkiste (voll, nach dem Fangen leer)', () => {
    const [ix, iy, igloo] = find('igloo');
    expect(drawDeco(view, world, igloo, ix, iy, at)).not.toBeNull();
    const [bx, by, bowl] = find('icebowl');
    expect(drawDeco(view, world, bowl, bx, by, at)!.length).toBeGreaterThan(0);
    const [cx, cy, crate] = find('fishcrate');
    const full = drawDeco(view, world, crate, cx, cy, at)!;
    const empty = drawDeco(view, world, crate, cx, cy, { ...at, picked: { [`${cx},${cy}`]: 1 } })!;
    expect(full.length).toBeGreaterThan(empty.length); // voll: Fische und Flossen dazu
  });

  it('solange das Paket lädt: ein einfacher Block in Kartenfarbe; andere Dinge zeichnet die Ansicht selbst', () => {
    const [cx, cy, crate] = find('fishcrate');
    const block = drawDeco(null, world, crate, cx, cy, at)!;
    expect(block).toHaveLength(1);
    expect(block[0]![6]).toBe(mapColor(crate));
    const tree: Cell = { h: 1, ground: 'grass', deco: 'tree', region: 'lichtung', solid: true };
    expect(drawDeco(null, world, tree, 0, 0, at)).toBeNull();
    expect(drawDeco(view, world, tree, 0, 0, at)).toBeNull();
    expect(drawDeco(view, world, { ...tree, deco: null }, 0, 0, at)).toBeNull();
  });

  it('Eiskristall: das Paket zeichnet ihn in seiner Farbe, am Tag blitzt ab und zu ein Funke (nie bei reduzierter Bewegung)', () => {
    const [x, y, crystal] = find('crystal');
    const still = drawDeco(view, world, crystal, x, y, at)!;
    const spikes = still.filter((b) => b[6] === crystal.color);
    expect(spikes).toHaveLength(3); // drei Spitzen, die weich leuchten (`halo`), in 2D ohne Art
    expect(spikes.every((b) => b[8] === undefined && b[9]?.halo)).toBe(true);
    expect(still.filter((b) => b[6] !== crystal.color).every((b) => b[6] === '#ffffff')).toBe(true); // Lichtkanten
    const sparks = Array.from({ length: 80 }, (_, i) =>
      drawDeco(view, world, crystal, x, y, { ...at, reduced: false, now: i * 100 })!,
    );
    expect(sparks.some((b) => b.length > still.length && b.at(-1)![6] === '#ffffff')).toBe(true);
    expect(sparks.some((b) => b.length === still.length)).toBe(true); // meist ohne Funke
  });

  it('Polarlicht in 2D: Hof nur um Eiskristalle, die in diesem Bild gezeichnet wurden (nicht im Nebel, nicht in 3D)', () => {
    const [x, y, crystal] = find('crystal');
    let rects = 0;
    const ctx = { fillStyle: '', globalAlpha: 1, fillRect: () => void rects++ } as unknown as CanvasRenderingContext2D;
    const sc = { width: 40, height: 40, zoom: 1, now: 500, reduced: true, aurora: 1 } as SkyScene;
    const count = (now: number) => {
      rects = 0;
      view.sky!.aurora(ctx, { ...sc, now }, () => [0, 0]);
      return rects;
    };
    const veil = count(400); // nur die Schleier am Himmel
    drawDeco(view, world, crystal, x, y, { ...at, now: 500 });
    expect(count(500)).toBe(veil + 2); // Hof in seiner Farbe, innen weiß
    expect(count(600)).toBe(veil); // im nächsten Bild nicht mehr gezeichnet: kein Hof
  });

  it('Karte: Eiskristalle in ihrer Farbe (nur in der Eis-Welt), Schneewehen wie Schnee', () => {
    const [, , crystal] = find('crystal');
    expect(mapColor(crystal)).toBe(crystal.color);
    const plain: Cell = { ...crystal, deco: null, solid: false, color: undefined };
    expect(mapColor(crystal)).not.toBe(mapColor(plain)); // hebt sich vom Schnee ab
    const [, , drift] = find('snowdrift');
    expect(mapColor(drift)).toBe(mapColor({ ...drift, deco: null })); // nur Bild, auf der Karte nicht zu sehen
    const cave: Cell = {
      h: 1,
      ground: 'cave',
      deco: 'crystal',
      color: '#b48cf0',
      region: 'wild',
      solid: true,
      biome: 'hoehle',
    };
    expect(mapColor(cave)).toBe(mapColor({ ...cave, deco: null })); // in der Höhle wie bisher
  });

  it('Eisscholle auf einem Eisloch: das Paket zeichnet sie weiß auf dem Wasser, sie treibt sanft (nie bei reduzierter Bewegung)', () => {
    const [x, y, floe] = find('floe');
    expect([floe.biome, floe.ground]).toEqual(['eis', 'water']);
    const still = drawDeco(view, world, floe, x, y, at)!;
    expect(still.length).toBeGreaterThan(0);
    expect(still.every((b) => b[7] === KESSEL_COLORS.floe[1] && b[2] === 0.8)).toBe(true); // auf dem Wasser
    expect(drawDeco(null, world, floe, x, y, at)).toBeNull(); // solange das Paket lädt: offenes Wasser
    expect(drawDeco(view, world, floe, x, y, { ...at, now: 5000 })).toEqual(still);
    const drift = Array.from(
      { length: 20 },
      (_, i) => drawDeco(view, world, floe, x, y, { ...at, reduced: false, now: i * 700 })![0]![0],
    );
    expect(Math.max(...drift) - Math.min(...drift)).toBeGreaterThan(0.05);
    expect(Math.max(...drift.map((d) => Math.abs(d - still[0]![0])))).toBeLessThanOrEqual(0.06 + 1e-9);
  });

  it('Karte: Schollen weiß auf dem Eisloch, der Eisfall in seiner Farbe, andere Eisklippen und Seen wie Eis', () => {
    const [, , floe] = find('floe');
    expect(mapColor(floe)).toBe(KESSEL_COLORS.floe[1]);
    expect(mapColor({ ...floe, deco: null, color: undefined })).not.toBe(mapColor(floe)); // offenes Wasser
    const cliff: Cell = { h: 4, ground: 'ice', deco: 'rock', region: 'border', solid: true, biome: 'eis' };
    expect(mapColor({ ...cliff, color: KESSEL_COLORS.fall })).toBe(KESSEL_COLORS.fall);
    expect(mapColor(cliff)).not.toBe(KESSEL_COLORS.fall);
    expect(mapColor({ ...cliff, h: 1, deco: null, region: 'eis', solid: false })).toBe(mapColor(cliff)); // See
  });

  it('die Rutschspur glänzt erst bei offenem Eistor', () => {
    const slide: Cell = { h: 1, ground: 'ice', deco: null, region: 'eis', solid: false, slide: true };
    expect(view.ground(slide, 3, 4, false)).toBeNull();
    expect(view.ground(slide, 3, 4, true)?.slice(0, 3)).toEqual([3.12, 4, 1]);
    expect(view.ground({ ...slide, slide: undefined }, 3, 4, true)).toBeNull();
  });
});

describe('Flache Marken mit weichem Rand (drawMark)', () => {
  /** Kontext, der je Füllung die Deckkraft festhält */
  const recorder = () => {
    const alphas: number[] = [];
    const store = new Map<string | symbol, unknown>([['globalAlpha', 1]]);
    const ctx = new Proxy(
      {},
      {
        get: (_t, k) =>
          store.has(k)
            ? store.get(k)
            : k === 'fill' || k === 'fillRect'
              ? () => alphas.push(store.get('globalAlpha') as number)
              : () => {},
        set: (_t, k, v) => (store.set(k, v), true),
      },
    ) as unknown as CanvasRenderingContext2D;
    return { ctx, alphas };
  };
  const P = (x: number, y: number, z: number): [number, number] => [x * 32, y * 16 - z * 16];

  it('zuerst der Saum halb durchsichtig, dann die Marke; über eine ganze Feldlänge in beide Richtungen ohne Saum', () => {
    const soft = recorder();
    drawMark(soft.ctx, P, [2, 3.26, 1, 1, 0.12, 0.014, '#b7cde0', '#c9dcec'] as Box);
    expect(soft.alphas.length).toBeGreaterThan(1);
    expect(soft.alphas[0]).toBeCloseTo(MARK_FRINGE, 9);
    expect(soft.alphas.at(-1)).toBe(1);
    expect(soft.ctx.globalAlpha).toBe(1);
    const hard = recorder();
    drawMark(hard.ctx, P, [2, 3, 1, 1, 1, 0.014, '#b7cde0', '#c9dcec'] as Box);
    expect(hard.alphas.every((a) => a === 1)).toBe(true);
  });
});
