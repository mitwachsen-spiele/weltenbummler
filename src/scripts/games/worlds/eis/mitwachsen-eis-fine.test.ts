// Feinheit der Eis-Welt (Entwurf „Feine Grafik“, Issue 13): Iglu aus Eisblöcken mit Sturz und warmem Licht, Fischkiste
// aus Holz mit Nägeln, Eiskristalle leuchten weich mit Lichtkanten, Schneemann mit Zweig-Armen und Mund, Glockenspiel
// mit glitzernder Spitze und Schnee auf der Kante, Zacken aus Eisblock, Fähnchen, Treppe, Schlitten, Rentier, Pfahl,
// Schneeraupe und Reifen mit Muster je Material; Lampen leuchten nur, wenn sie an sind; die zehn Eis-Tiere mit Fell,
// Lack und Zusatzteilen, ihre Grundform bleibt. Zusatzteile stecken in nichts und berühren ihr Teil.
import { describe, expect, it } from 'vitest';
import { haloCompact } from '../../../../lib/games/shade';
import type { Box } from '../../mitwachsen-view';
import type { Part } from '../../../../lib/games/front';
import { ICE_COLORS } from '../../../../data/games/worlds/eis/mitwachsen-ice-colors';
import { ICE_MODELS } from '../../../../data/games/worlds/eis/mitwachsen-ice-models';
import { ICE_ANIMAL_FINE, ICE_FINE_MODELS } from '../../../../data/games/worlds/eis/mitwachsen-ice-fine';
import {
  REINDEER,
  postParts,
  sledParts,
  type SledLook,
} from '../../../../data/games/worlds/eis/mitwachsen-sled-models';
import { CAT_COLORS, CAT_SIGN, catParts } from '../../../../data/games/worlds/eis/mitwachsen-cat-model';
import { HILL_FLAG, TUBE_COLORS, tubeParts } from '../../../../data/games/worlds/eis/mitwachsen-tube-model';
import { SNOWMAN_COLORS } from '../../../../data/games/worlds/eis/mitwachsen-kessel';
import type { Cell } from '../../mitwachsen-cell';
import { EIS_PACK, worldOf } from '../../test-worlds';
import { EDGE, IGLOO_LIGHT, crystalBoxes, floeBoxes, iceBoxes, iceFoot } from './mitwachsen-ice-look';
import { view } from './view-2d';
import { snowBoxes } from './mitwachsen-snowman-look';
import { chimeBoxes } from './mitwachsen-chime-look';
import { crestBoxes } from './mitwachsen-ice-rim';
import { fillBoxes } from './mitwachsen-snow-fill-look';
import { flagBoxes } from './mitwachsen-places-look';
import { stepBoxes } from './mitwachsen-tube-look';
import { SNOWMAN } from './mitwachsen-snowman';

/** Ein Quader (Box: x, y, z; Part: vorn, rechts, unten), dann Größe je Achse */
type Q = Box | Part;
const lo = (q: Q): readonly [number, number, number] => [q[0], q[1], q[2]];
const hi = (q: Q): readonly [number, number, number] => [q[0] + q[3], q[1] + q[4], q[2] + q[5]];
const overlap = (a: Q, b: Q) => [0, 1, 2].map((i) => Math.min(hi(a)[i]!, hi(b)[i]!) - Math.max(lo(a)[i]!, lo(b)[i]!));
/** Gemeinsamer Rauminhalt zweier Quader */
const shared = (a: Q, b: Q) => overlap(a, b).reduce((v, o) => v * Math.max(0, o), 1);
/** Berühren sich zwei Quader (Abstand höchstens 1e-6 auf jeder Achse)? */
const touching = (a: Q, b: Q) => overlap(a, b).every((o) => o >= -1e-6);
/** Zusatzteile, die in einem anderen Quader stecken (je Treffer beide) */
const inside = (all: readonly Q[], extra: readonly Q[]) =>
  extra.flatMap((p) =>
    all.filter((q) => q !== p && shared(p, q) > 1e-6).map((q) => `${JSON.stringify(p)} in ${JSON.stringify(q)}`),
  );
/** Hülle: kleinste und größte Lage je Achse */
const hull = (all: readonly Q[]): [number, number][] =>
  [0, 1, 2].map((i) => [Math.min(...all.map((p) => lo(p)[i]!)), Math.max(...all.map((p) => hi(p)[i]!))]);
const skinOf = (b: Box | Part) => b[9]?.skin;
const halos = (all: readonly (Box | Part)[]) => all.filter((b) => b[9]?.halo);

const world = worldOf(1, [EIS_PACK]);
const ice = (c: Partial<Cell>): Cell => ({
  h: 2,
  ground: 'snow',
  deco: null,
  region: 'eis',
  solid: false,
  biome: 'eis',
  ...c,
});

describe('Feinheit der Eis-Welt (Entwurf „Feine Grafik“)', () => {
  it('Iglu: Eisblöcke mit Fugen, ein warmes Licht innen an der Rückwand, ein heller Sturz über dem Bogen', () => {
    const [sx, sy] = world.homes.eis.shelterStem;
    const boxes = iceBoxes(world, world.cell(sx, sy), sx, sy)!;
    const blocks = boxes.filter((b) => skinOf(b) === 'eisblock');
    expect(blocks.length).toBeGreaterThan(20);
    expect(blocks.every((b) => b[8] === 'see')).toBe(true);
    const lamp = halos(boxes);
    expect(lamp).toHaveLength(1);
    expect(lamp[0]![6]).toBe(IGLOO_LIGHT.lamp);
    expect(inside(blocks, lamp)).toEqual([]); // hängt an der Wand, steckt nicht darin
    expect(blocks.some((b) => touching(b, lamp[0]!) && b[1] + b[4] <= lamp[0]![1] + 1e-9)).toBe(true); // vor einem Block der Rückwand
    const [[x0, x1], , [z0, z1]] = hull(blocks) as [[number, number], unknown, [number, number]];
    expect(lamp[0]![0]).toBeGreaterThan(x0);
    expect(lamp[0]![0] + lamp[0]![3]).toBeLessThan(x1);
    expect(lamp[0]![2]).toBeGreaterThan(z0 + 1); // oben in der Kuppel, über den Tieren
    expect(lamp[0]![2] + lamp[0]![5]).toBeLessThan(z1);
    const lintel = boxes.filter((b) => b[6] === IGLOO_LIGHT.lintel);
    expect(lintel).toHaveLength(1);
    expect(inside(blocks, lintel)).toEqual([]);
    expect(blocks.some((b) => touching(b, lintel[0]!))).toBe(true); // vorn auf dem Block über dem Bogen
    expect(lintel[0]![8]).toBe('see'); // wird mit dem Iglu vor der Figur durchsichtig
  });

  it('2D: weicher Fleck unter Iglu (so groß wie die Kuppel unten), Fischkiste, Schale, Trog, Schneehaufen', () => {
    const [sx, sy] = world.homes.eis.shelterStem;
    expect(view.foot?.(world, world.cell(sx, sy), sx, sy)).toEqual(iceFoot(world, world.cell(sx, sy), sx, sy)); // die 2D-Ansicht meldet ihn
    const blocks = iceBoxes(world, world.cell(sx, sy), sx, sy)!.filter((b) => skinOf(b) === 'eisblock');
    const ground = blocks.filter((b) => Math.abs(b[2] - world.cell(sx, sy).h) < 1e-9); // unterste Reihe der Kuppel
    const [[x0, x1], [y0, y1]] = hull(ground) as [[number, number], [number, number]];
    const spot = iceFoot(world, world.cell(sx, sy), sx, sy)!;
    const [cx, cy, z, across, deep] = spot;
    expect(cx).toBeCloseTo((x0 + x1) / 2, 1);
    expect(cy).toBeCloseTo((y0 + y1) / 2, 0);
    expect(z).toBe(world.cell(sx, sy).h);
    // der Fleck reicht etwas über den Fuß der Kuppel hinaus (Radius ×1,35), ist aber nicht viel größer
    expect(across).toBeGreaterThan(0.7 * ((x1 - x0) / 2));
    expect(across).toBeLessThan((x1 - x0) / 2);
    expect(deep).toBeGreaterThan(0.7 * ((y1 - y0) / 2));
    // die anderen Felder des Iglus werfen keinen eigenen
    expect(iceFoot(world, world.cell(sx + 1, sy), sx + 1, sy)).toBeNull();
    for (const deco of ['fishcrate', 'icebowl', 'watertrough', 'snowheap'] as const) {
      const f = iceFoot(world, ice({ deco }), 3, 4)!;
      expect(f[0]).toBe(3.5);
      expect(f[1]).toBeGreaterThan(4.45);
      expect(f[3]).toBeLessThan(0.5); // bleibt etwa im Feld
    }
    // Wassertrog außerhalb der Eis-Welt: der Kern (`SHADOW`); Kristalle leuchten, Fülle liegt flach: kein Fleck
    expect(iceFoot(world, ice({ deco: 'watertrough', biome: undefined }), 3, 4)).toBeNull();
    expect(iceFoot(world, ice({ deco: 'crystal' }), 3, 4)).toBeNull();
    expect(iceFoot(world, ice({ deco: 'snowdrift' }), 3, 4)).toBeNull();
  });

  it('Fischkiste aus Holz mit Nägeln vorn, Schnee auf dem Rand, glänzende Fische; Schale und Trog aus Eisblock', () => {
    const full = iceBoxes(world, ice({ deco: 'fishcrate' }), 0, 0)!;
    const wood = full.filter((b) => b[6] === ICE_COLORS.crate[0]);
    expect(wood.every((b) => skinOf(b) === 'holz')).toBe(true);
    expect(full.filter((b) => b[6] === ICE_COLORS.snow[0]).every((b) => skinOf(b) === 'schnee')).toBe(true);
    expect(full.filter((b) => b[6] === ICE_COLORS.fish[1]).every((b) => skinOf(b) === 'lack')).toBe(true);
    const nails = full.filter((b) => b[6] === '#4a4f5a');
    expect(nails).toHaveLength(2);
    expect(inside(full, nails)).toEqual([]);
    expect(nails.every((n) => wood.some((w) => touching(n, w)))).toBe(true);
    const empty = iceBoxes(world, ice({ deco: 'fishcrate' }), 0, 0, { full: false, twitch: 0 })!;
    expect(empty.some((b) => skinOf(b) === 'lack')).toBe(false);
    const bowl = iceBoxes(world, ice({ deco: 'icebowl' }), 0, 0)!;
    expect([skinOf(bowl[0]!), skinOf(bowl[1]!), skinOf(bowl[2]!)]).toEqual(['eisblock', undefined, 'fell']);
    const trough = iceBoxes(world, ice({ deco: 'watertrough' }), 0, 0)!;
    expect(trough.map(skinOf)).toEqual(['eisblock', 'eisblock', undefined]); // Wasser ohne Muster
    expect(floeBoxes(0, 0).every((b) => skinOf(b) === 'schnee')).toBe(true);
  });

  it('Eiskristall: kompakte Spitzen leuchten weich (halo, in 3D zugleich glow), zwei Lichtkanten (glow) vorn auf der großen Spitze', () => {
    const c = ice({ deco: 'crystal', color: '#3fd6b8' });
    for (const glow of [false, true]) {
      const boxes = crystalBoxes(c, 0, 0, 0, glow);
      const spikes = boxes.filter((b) => b[6] === c.color);
      expect(halos(spikes)).toHaveLength(3);
      // leuchten tun nur die kompakten (2D: front.ts, 3D: Geo.box); die große Spitze ist zu hoch
      expect(halos(spikes).filter((b) => haloCompact(b[3], b[4], b[5]))).toHaveLength(2);
      const edges = boxes.filter((b) => b[6] === '#ffffff');
      expect(edges).toHaveLength(2);
      expect(edges.every((e) => e[8] === 'glow')).toBe(true); // hell wie der Kristall: 2D flach, 3D im Glow-Material
      const big = spikes[0]!;
      for (const e of edges) {
        expect(e[4]).toBe(EDGE);
        expect(e[1]).toBeCloseTo(big[1] + big[4], 9); // vorn auf der Fläche
        expect(e[0] >= big[0] && e[0] + e[3] <= big[0] + big[3]).toBe(true);
        expect(e[2] >= big[2] && e[2] + e[5] <= big[2] + big[5]).toBe(true);
        expect(e[9]).toBeUndefined(); // leuchtet nicht selbst
      }
      expect(inside(boxes, edges)).toEqual([]);
    }
  });

  it('Schneemann: Arme aus Zweigen am Bauch, Mund aus Kohle; Schnee glitzert, Schal aus Stoff, Mütze gestrickt', () => {
    const done = snowBoxes(0, 0, 0, SNOWMAN);
    const twigs = done.filter((b) => b[6] === SNOWMAN_COLORS.twig[0]);
    expect(twigs).toHaveLength(4);
    expect(inside(done, twigs)).toEqual([]);
    expect(twigs.every((t) => done.some((b) => b !== t && touching(t, b)))).toBe(true);
    expect(done.every((b) => b[0] >= 0 && b[0] + b[3] <= 1 && b[1] >= 0 && b[1] + b[4] <= 1)).toBe(true); // im Feld
    const coal = done.filter((b) => b[6] === SNOWMAN_COLORS.coal);
    expect(coal).toHaveLength(6); // zwei Knöpfe, zwei Augen, zwei für den Mund
    const mouth = coal.filter((b) => b[2] < 0.82 && b[2] > 0.7);
    expect(
      inside(
        done.filter((b) => b[6] !== ICE_COLORS.snow[0]),
        mouth,
      ),
    ).toEqual([]); // nicht in Nase oder Schal
    expect(done.filter((b) => b[6] === ICE_COLORS.snow[0]).every((b) => skinOf(b) === 'schnee')).toBe(true);
    expect(done.filter((b) => b[6] === SNOWMAN_COLORS.scarf[0]).every((b) => skinOf(b) === 'stoff')).toBe(true);
    expect(done.filter((b) => b[6] === SNOWMAN_COLORS.hat[0]).every((b) => skinOf(b) === 'fell')).toBe(true);
    expect(snowBoxes(0, 0, 0, 0).some((b) => b[6] === SNOWMAN_COLORS.twig[0] && b[3] > 0.1)).toBe(false); // der Haufen hat keine Arme
  });

  it('Glockenspiel: Kante und dicke Stücke aus Eisblock, die Spitze glitzert, Schnee auf der Kante', () => {
    const [x, y] = [10, 10];
    const c = ice({ deco: 'icicle', note: 2 });
    const boxes = chimeBoxes(world, c, x, y);
    expect(halos(boxes)).toHaveLength(1);
    expect(halos(boxes)[0]).toBe(boxes[0]); // die Spitze (2D malt sie zuerst)
    const [lip, snow] = boxes.slice(-2) as [Box, Box];
    expect(skinOf(lip)).toBe('eisblock');
    expect(skinOf(snow)).toBe('schnee');
    expect(snow[2]).toBeCloseTo(lip[2] + lip[5], 9); // liegt obenauf
    expect(inside(boxes, [snow])).toEqual([]);
  });

  it('Zacken aus Eisblock, Schneewehen glitzern, Beeren glänzen; Treppe aus Holz; Fähnchen mit Knauf, die Ziffer scharf', () => {
    const crest = crestBoxes(ice({ rim: true, region: 'border', deco: 'rock' }), 3, 4);
    expect(crest.filter((_, i) => i % 2 === 0).every((b) => skinOf(b) === 'eisblock')).toBe(true);
    expect(crest.filter((_, i) => i % 2 === 1).every((b) => !b[9])).toBe(true); // helle Spitzen ohne Muster
    expect(fillBoxes(ice({ deco: 'snowdrift' }), 0, 0)!.map(skinOf)).toEqual([undefined, 'schnee', 'schnee']);
    const tundra = fillBoxes(ice({ deco: 'tundra', note: 1 }), 0, 0)!;
    expect(tundra.filter((b) => skinOf(b) === 'lack')).toHaveLength(2);
    expect(stepBoxes(ice({ deco: 'hillstep' }), 0, 0).map(skinOf)).toEqual(['holz', undefined, undefined]);
    const flag = flagBoxes(ice({ deco: 'numflag', note: 3 }), 0, 0);
    const [pole, knob, cloth, ...digits] = flag;
    expect([skinOf(pole!), skinOf(knob!), skinOf(cloth!)]).toEqual(['holz', 'metall', 'stoff']);
    expect(knob![2]).toBeCloseTo(pole![2] + pole![5], 9); // oben auf dem Mast
    expect(inside(flag, [knob!])).toEqual([]);
    expect(digits.length).toBeGreaterThan(5);
    expect(digits.every((b) => !b[9])).toBe(true);
  });
});

describe('Feinheit der Fahrzeuge der Eis-Welt', () => {
  const LOOKS: readonly SledLook[] = [
    { frame: true, pennant: false, lamp: false, seated: false, open: false },
    { frame: false, pennant: true, lamp: true, seated: true, open: true },
  ];

  it('Schlitten: Lack, Metall-Kufen, gesteppte Decke, Nieten vorn; die Laterne leuchtet nur, wenn sie brennt', () => {
    for (const look of LOOKS) {
      const parts = sledParts(look);
      expect(halos(parts).length > 0).toBe(look.lamp);
      expect(parts.filter((p) => p[6] === '#b4bec8').every((p) => skinOf(p) === 'metall')).toBe(true);
      expect(parts.some((p) => skinOf(p) === 'quilt')).toBe(true);
      const rivets = parts.slice(0, 2);
      expect(inside(parts, rivets)).toEqual([]);
      expect(rivets.every((r) => parts.some((p) => p !== r && touching(r, p) && skinOf(p) === 'lack'))).toBe(true);
    }
    expect(halos(postParts(true))).toHaveLength(1);
    expect(halos(postParts(false))).toHaveLength(0);
    expect(postParts(false).some((p) => skinOf(p) === 'holz')).toBe(true);
    expect(REINDEER.slice(0, ICE_FINE_MODELS.rentier.length)).toEqual(ICE_FINE_MODELS.rentier); // das Rentier ist fein
  });

  it('Schneeraupe: Lack, Ketten und Rollen aus Metall, die Lampe leuchtet nur an; das Schild bleibt scharf', () => {
    const off = catParts({});
    const on = catParts({ lit: true, gold: true, rider: true });
    expect(halos(off)).toHaveLength(0);
    expect(halos(on).map((p) => p[6])).toEqual([CAT_COLORS.lamp]);
    const rollers = off.filter((p) => p[6] === CAT_COLORS.roller);
    expect(rollers).toHaveLength(6);
    expect(inside(off, rollers)).toEqual([]);
    const tracks = off.filter((p) => p[6] === CAT_COLORS.track[0]);
    expect(rollers.every((r) => tracks.some((t) => touching(r, t)))).toBe(true);
    expect([...tracks, ...rollers].every((p) => skinOf(p) === 'metall')).toBe(true);
    expect(skinOf(CAT_SIGN[0]!)).toBe('holz');
    expect(CAT_SIGN.slice(2).every((p) => !p[9])).toBe(true); // die Zahl ohne Muster
  });

  it('Rodelreifen in Lack, Fahne mit Mast aus Holz und silbernem Knauf obenauf', () => {
    expect(
      tubeParts({})
        .filter((p) => p[6] === TUBE_COLORS.tube[0])
        .every((p) => skinOf(p) === 'lack'),
    ).toBe(true);
    const [pole, knob] = HILL_FLAG as [Part, Part];
    expect([skinOf(pole), skinOf(knob)]).toEqual(['holz', 'metall']);
    expect(knob[2]).toBeCloseTo(pole[2] + pole[5], 9);
    expect(inside(HILL_FLAG, [knob])).toEqual([]);
  });
});

describe('Eis-Tiere fein (mitwachsen-ice-fine.ts)', () => {
  const ids = Object.keys(ICE_MODELS) as (keyof typeof ICE_MODELS)[];

  it('Grundform bleibt vorn im Modell, dazu die Zusatzteile; jedes Zusatzteil in der Hülle und an seinem Tier', () => {
    const bad: string[] = [];
    for (const id of ids) {
      const base = ICE_MODELS[id];
      const fine = ICE_FINE_MODELS[id];
      const extra = fine.slice(base.length);
      if (fine.length !== base.length + ICE_ANIMAL_FINE[id].extra.length) bad.push(`${id}: Länge`);
      fine.slice(0, base.length).forEach((p, i) => {
        const same = (q: Part) => JSON.stringify([...q.slice(0, 7), q[7] ?? null]);
        if (same(p) !== same(base[i]!)) bad.push(`${id}: Grundform ${i}`);
      });
      const h = hull(base);
      for (const p of extra) {
        if (![0, 1, 2].every((i) => lo(p)[i]! >= h[i]![0] - 0.02 && hi(p)[i]! <= h[i]![1] + 0.02))
          bad.push(`${id}: außerhalb ${JSON.stringify(p)}`);
        if (!base.some((q) => touching(p, q))) bad.push(`${id}: schwebt ${JSON.stringify(p)}`);
      }
      bad.push(...inside(base, extra).map((s) => `${id}: ${s}`));
    }
    expect(bad).toEqual([]);
  });

  it('Muster je Material: jedes Tier hat Fell oder Lack, Augen bleiben ohne Muster', () => {
    for (const id of ids) {
      const fine = ICE_FINE_MODELS[id];
      expect(
        fine.some((p) => skinOf(p) === 'fell' || skinOf(p) === 'lack'),
        id,
      ).toBe(true);
      expect(
        fine.filter((p) => p[8]).every((p) => !p[9]),
        id,
      ).toBe(true);
    }
  });
});
