// Tupfspinnen (Konzept „Höhle nach dem ersten Spielen“, Punkt 9, Schritt 12): Harfe und „tipp-tipp“, der Gruß der Spinne
// (abseilen, winken, zurück; bei reduzierter Bewegung nur winken; schlafend still), ihre Form und Farben, das Netz als
// Ding auf einem Feld, das Leuchten der Perlen. Wo die Netze hängen und das Hineinlaufen prüft mitwachsen-grotte.test.ts
// über die Seeds, ihr Lichtloch mitwachsen-mask.test.ts.
import { describe, expect, it } from 'vitest';
import { SPECIES } from '../../../../data/games/mitwachsen';
import { RIDES } from '../../../../data/games/mitwachsen-rides';
import { CAVE_SPECIES } from '../../../../data/games/mitwachsen-hoehle';
import { ICE_SPECIES } from '../../../../data/games/mitwachsen-eis';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import { SPIDER_MODELS, type SpiderPose } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-models';
import { GROTTE, GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { Part } from '../../../../lib/games/front';
import type { Cell } from '../../mitwachsen-cell';
import { drawDeco, type DecoAt } from '../../mitwachsen-view';
import type { Scored } from '../../sfx';
import { HOEHLE_PACK, worldOf } from '../../test-worlds';
import { COLUMN_SCALE, columnScore } from './mitwachsen-chime-look';
import { giggleScore } from './mitwachsen-ghost';
import { FLOOR, brightness, rgbOf, type Rgb } from './mitwachsen-mask';
import {
  HARP,
  HARP_SCALE,
  beadFlash,
  beadTwinkle,
  farFromPaths,
  greetMs,
  harpScore,
  spiderPose,
  tippScore,
  webs,
} from './mitwachsen-spider';
import { BEADS, SPIDER_SCALE, SpiderFx, WEB_TOP, spiderParts, webBoxes } from './mitwachsen-spider-look';
import { view } from './view-2d';
import { view3d } from './view-3d';

const W = GROTTE.web;
const w = worldOf(1, [HOEHLE_PACK]);
const PENTA = [0, 2, 4, 7, 9];
const penta = (f: number) => PENTA.includes(((Math.round(12 * Math.log2(f / 261.63)) % 12) + 12) % 12);
const notes = (s: readonly Scored[]) => s.map(([f]) => Math.round(f));
const contrast = (a: Rgb, b: Rgb) => {
  const [x, y] = [brightness(a), brightness(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const cell = (extra: Partial<Cell> = {}): Cell => ({
  h: 1,
  ground: 'grotto',
  deco: 'web',
  region: 'hoehle',
  solid: true,
  biome: 'hoehle',
  ...extra,
});

describe('Tupfspinne: Töne', () => {
  const animals = [...Object.values(SPECIES), ...Object.values(CAVE_SPECIES), ...Object.values(ICE_SPECIES)];

  it('Harfe: die fünf Perlen von unten nach oben, C6 bis A6, eine Oktave über den Säulen, gezupft (Dreieck, kurz, ohne Echo)', () => {
    const harp = harpScore();
    expect(notes(harp)).toEqual(HARP_SCALE.map(Math.round));
    expect(HARP_SCALE.map((f, i) => f / COLUMN_SCALE[i]!).every((r) => Math.abs(r - 2) < 0.01)).toBe(true);
    expect(harp.map(([, , wave]) => wave)).toEqual(Array(5).fill('triangle'));
    expect(harp.map(([, , , , , d]) => d)).toEqual([0, 1, 2, 3, 4].map((i) => i * HARP.step));
    expect(harp.every(([, len]) => len < 0.4)).toBe(true); // kürzer als der Ton einer Säule (0,4 s Sinus mit Echo)
    expect(columnScore(0).map(([, , wave]) => wave)).not.toContain('triangle');
  });

  it('Harfe und „tipp-tipp“ sind pentatonisch und leise (nicht lauter als das leiseste Tier)', () => {
    const quietest = Math.min(...animals.map((s) => s.tone.gain ?? Infinity));
    const all = [...harpScore(), ...tippScore()];
    expect(all.filter(([f]) => !penta(f))).toEqual([]);
    expect(Math.max(...all.map(([, , , gain]) => gain))).toBeLessThanOrEqual(quietest);
  });

  it('Harfe und „tipp-tipp“ unterscheiden sich von allen Tierrufen, Fahrzeugsignalen, dem Kichern der Lichtgeister und den Säulen', () => {
    const others: number[][] = [
      ...animals.map((s) => s.tone.notes.map(Math.round)),
      ...RIDES.map((r) => r.signal.map(Math.round)),
      notes(giggleScore()),
    ];
    const col = COLUMN_SCALE.map(Math.round);
    for (const a of col) for (const b of col) for (const c of col) others.push([a, b, c], [a, b]);
    for (const own of [notes(harpScore()), notes(tippScore())]) for (const o of others) expect(o).not.toEqual(own);
    // „tipp-tipp“ ist kein Kichern: andere Tonhöhe und Klangfarbe
    expect(tippScore()[0]![0]).not.toBe(giggleScore()[0]![0]);
    expect(tippScore()[0]![2]).not.toBe(giggleScore()[0]![2]);
  });

  it('höchstens fünf Töne zugleich (die Harfe vier), unter MAX_VOICES', () => {
    const score = [...harpScore(), ...tippScore()];
    const at = (t: number) => score.filter(([, len, , , , d]) => d <= t && t < d + len).length;
    expect(Math.max(...score.map(([, , , , , d]) => at(d)))).toBeLessThanOrEqual(5);
    expect(Math.max(...harpScore().map(([, , , , , d]) => at(d)))).toBeLessThanOrEqual(4);
  });
});

describe('Tupfspinne: Gruß', () => {
  const run = (reduced: boolean, asleep = false) =>
    Array.from({ length: 300 }, (_, i) => spiderPose(i * 10 - 100, reduced, asleep));

  it('seilt sich ein Stück ab, winkt, klettert zurück; hängt nie am Boden, immer über ihrem Netz', () => {
    const hangs = run(false);
    expect(Math.min(...hangs.map((h) => h.lift))).toBeCloseTo(W.rest - W.drop);
    expect(hangs.every((h) => h.lift >= W.rest - W.drop - 1e-9 && h.lift <= W.rest)).toBe(true);
    expect(W.rest - W.drop).toBeGreaterThan(0.3); // über dem Kopf der Figur, nie am Boden
    expect(spiderPose(W.down + 10, false, false).pose).toBe('wave1');
    expect(spiderPose(W.down + W.beat + 10, false, false).pose).toBe('wave2');
    expect(spiderPose(W.down + W.wave + 10, false, false).pose).toBe('rest');
    expect(spiderPose(greetMs(false), false, false)).toEqual({ pose: 'rest', lift: W.rest });
    expect(spiderPose(-1, false, false)).toEqual({ pose: 'rest', lift: W.rest });
    expect(spiderPose(-Infinity, false, false)).toEqual({ pose: 'rest', lift: W.rest });
    // in Stufen, so baut 3D nur wenige Modelle
    const keys = new Set([...run(false), ...run(true), ...run(false, true)].map((h) => `${h.pose}@${h.lift}`));
    expect(keys.size).toBeLessThanOrEqual(14);
  });

  it('bei reduzierter Bewegung kein Abseilen, nur ein Winken; schlafend still mit geschlossenen Augen', () => {
    const calm = run(true);
    expect(calm.every((h) => h.lift === W.rest)).toBe(true);
    expect(calm.some((h) => h.pose === 'wave1') && calm.some((h) => h.pose === 'wave2')).toBe(true);
    expect(greetMs(true)).toBe(W.wave);
    expect(run(false, true).every((h) => h.pose === 'asleep' && h.lift === W.rest)).toBe(true);
  });

  it('SpiderFx: Harfe mit „tipp-tipp“ beim ersten Mal, höchstens alle 0,5 s; während des Grußes und schlafend nur die Harfe', () => {
    const fx = new SpiderFx();
    expect(fx.pluck(3, 4, 1000)).toEqual([...harpScore(), ...tippScore()]);
    expect(fx.pluck(3, 4, 1000 + W.gap - 1)).toEqual([]);
    expect(fx.pluck(3, 4, 1000 + W.gap)).toEqual(harpScore()); // sie grüßt noch
    expect(fx.pluck(9, 9, 1000)).toEqual([...harpScore(), ...tippScore()]); // ein anderes Netz
    expect(fx.pluck(3, 4, 1000 + greetMs(false) + W.gap)).toEqual([...harpScore(), ...tippScore()]);
    fx.asleep = true;
    expect(fx.pluck(5, 5, 0)).toEqual(harpScore());
    expect(fx.hang(5, 5, 100, false).pose).toBe('asleep');
  });

  it('die Spinnen als Körper: eine je Netz, an ihrem Netz, nie ein Fahrzeug (Antippen meint sie nicht); sie bleibt an ihrem Platz', () => {
    const fx = new SpiderFx();
    const all = webs(w);
    expect(all.length).toBeGreaterThanOrEqual(W.least);
    const [x, y] = all[0]!;
    fx.pluck(x, y, 1000);
    const frames = Array.from({ length: 25 }, (_, i) => fx.bodies(w, webs, 1000 + i * 100, false, false));
    for (const bodies of frames) {
      expect(bodies.map((b) => [b.x, b.y])).toEqual(all);
      expect(bodies.every((b) => b.id.startsWith('spider:') && b.dir === 's')).toBe(true);
      expect(bodies.every((b) => b.z === w.cell(b.x, b.y).h)).toBe(true);
    }
    expect(new Set(frames.map((b) => b[0]!.key)).size).toBeGreaterThan(3); // sie bewegt sich
    expect(
      frames
        .flat()
        .filter((b) => b.x !== x || b.y !== y)
        .every((b) => b.key === `spider-rest-${W.rest}`),
    ).toBe(true);
    expect(fx.bodies(w, webs, 1000, false, true).every((b) => b.key.startsWith('spider-asleep'))).toBe(true);
    expect(fx.bodies(worldOf(1, []), webs, 0, false, false)).toEqual([]); // ohne Grotte keine Netze
    // über das Paket: abends (warmes Licht) schlafen sie
    const s = {
      ...w.homes.hoehle,
      sleeping: false,
      player: { x: 0, y: 0, dir: 's' },
      packs: {},
    } as unknown as Parameters<NonNullable<typeof view.bodies>>[0];
    const at = { now: 0, frac: 0, reduced: false, lit: false };
    const spiders = (warm: boolean) => view.bodies!(s, w, { ...at, warm }).filter((b) => b.id.startsWith('spider:'));
    expect(spiders(false).every((b) => !b.key.includes('asleep'))).toBe(true);
    expect(spiders(true).every((b) => b.key.includes('asleep'))).toBe(true);
  });

  it('ihre Teile behalten beim Skalieren Farben, Fläche und Feinheit', () => {
    const models = SPIDER_MODELS;
    const plain = models.rest;
    const fine = { skin: 'fell' as const };
    models.rest = plain.map((p): Part => [p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], fine]);
    try {
      const body = spiderParts({ pose: 'rest', lift: 0.4321 }).slice(0, plain.length);
      expect(body.map((p) => p.slice(6))).toEqual(models.rest.map((p) => p.slice(6)));
      expect(body.every((p) => p[9] === fine)).toBe(true);
    } finally {
      models.rest = plain;
    }
  });

  it('ihr Faden reicht bis an die Oberkante des Netzes, auch abgeseilt', () => {
    for (const lift of [W.rest, W.rest - W.drop]) {
      const parts = spiderParts({ pose: 'rest', lift });
      const thread = parts[parts.length - 1]!;
      expect(thread[2] + thread[5]).toBeCloseTo(WEB_TOP);
      const bottom = Math.min(...parts.map((p) => p[2]));
      expect(bottom).toBeGreaterThanOrEqual(lift);
      expect(bottom).toBeLessThan(lift + 0.05 * SPIDER_SCALE);
    }
  });
});

describe('Tupfspinne: Form und Farben', () => {
  const C = GROTTE_COLORS.spider;
  const colors = (pose: SpiderPose) => SPIDER_MODELS[pose].flatMap((p) => [p[6], p[7]]).filter((c) => c);

  it('je Seite vier Stummelbeine, auch beim Winken; zwei große Augen mit Glanzpunkt, schlafend geschlossen', () => {
    for (const pose of ['rest', 'wave1', 'wave2', 'asleep'] as const) {
      const legs = SPIDER_MODELS[pose].filter((p) => p[6] === C.leg);
      expect(legs, pose).toHaveLength(8);
      // links (rechts im Modell negativ) und rechts je vier
      expect(
        legs.filter((p) => p[1] + p[4] / 2 < 0),
        pose,
      ).toHaveLength(4);
    }
    const shine = (pose: SpiderPose) => SPIDER_MODELS[pose].filter((p) => p[6] === C.eye).length;
    expect(shine('rest')).toBe(4); // zwei Augen, zwei Glanzpunkte
    expect(shine('asleep')).toBe(0); // keine offenen Augen
    const top = Math.max(...SPIDER_MODELS.rest.map((p) => p[2] + p[5]));
    expect(top).toBeGreaterThan(0.28);
    expect(top).toBeLessThan(0.33);
  });

  it('kein Rot, kein Gold; dunkles Grün mit Kontrast zum Boden, Tupfen und Augen hell darauf', () => {
    const gold: unknown[] = Object.values(GOLD);
    for (const pose of ['rest', 'wave1', 'asleep'] as const)
      for (const c of colors(pose)) {
        const [r, g, b] = rgbOf(c as string);
        expect(r > 180 && g < 90 && b < 90, `${pose} ${c}`).toBe(false);
        expect(gold.includes(c), `${pose} ${c}`).toBe(false);
      }
    expect(contrast(rgbOf(C.body), FLOOR)).toBeGreaterThan(3); // helles Mint hätte nur 1,07 : 1
    expect(contrast(rgbOf(C.leg), FLOOR)).toBeGreaterThan(contrast(rgbOf(C.body), FLOOR)); // Beine noch dunkler
    expect(contrast(rgbOf(C.dot), rgbOf(C.body))).toBeGreaterThan(3);
    expect(contrast(rgbOf(C.eye), rgbOf(C.body))).toBeGreaterThan(3);
  });
});

describe('Netz der Tupfspinne', () => {
  const at: DecoAt = { now: 0, reduced: false, picked: {}, packs: {} };

  it('ein Ding auf einem Feld, in 2D und 3D gleich: zwei Felsnasen, Fäden mit dunklem Rand, fünf bunte Perlen; kein Gold, kein Weiß', () => {
    const boxes = webBoxes(cell(), 5, 7)!;
    expect(drawDeco(view, w, cell(), 5, 7, at)).toEqual(boxes);
    expect(drawDeco(view3d, w, cell(), 5, 7, at)).toEqual(boxes);
    expect(webBoxes(cell({ region: 'lichtung' }), 5, 7)).toBeNull();
    for (const b of boxes) {
      expect(b[0]).toBeGreaterThanOrEqual(5);
      expect(b[0] + b[3]).toBeLessThanOrEqual(6);
      expect(b[1]).toBeGreaterThanOrEqual(7);
      expect(b[1] + b[4]).toBeLessThanOrEqual(8);
      expect(b[2]).toBeGreaterThanOrEqual(1);
    }
    const C = GROTTE_COLORS.web;
    const used = boxes.flatMap((b) => [b[6], b[7]]);
    const gold: string[] = Object.values(GOLD);
    expect(used.filter((c) => gold.includes(c) || c === '#ffffff')).toEqual([]);
    expect(boxes.filter((b) => b[6] === C.rim).length).toBe(boxes.filter((b) => b[6] === C.thread).length);
    expect(C.beads.every((c) => used.includes(c))).toBe(true);
    expect(contrast(rgbOf(C.rim), rgbOf(C.thread))).toBeGreaterThan(3);
    expect(BEADS.map(([, z]) => z)).toEqual([...BEADS.map(([, z]) => z)].sort((a, b) => a - b)); // von unten nach oben
  });

  it('die Perlen leuchten mit ihrem Ton nacheinander; mit der Laterne reihum, bei reduzierter Bewegung alle ruhig', () => {
    expect([0, 1, 2, 3, 4].map((i) => beadFlash(0, i))).toEqual([1, 0, 0, 0, 0]);
    expect(beadFlash(HARP.step * 4000 + 1, 4)).toBeGreaterThan(0.9);
    expect(beadFlash(W.flash + 1, 0)).toBe(0);
    for (const now of [0, 200, 400, 1000]) {
      const lit = [0, 1, 2, 3, 4].map((i) => beadTwinkle(now, i, false));
      expect(lit.filter((a) => a > 0)).toHaveLength(1);
      expect([0, 1, 2, 3, 4].map((i) => beadTwinkle(now, i, true))).toEqual(Array(5).fill(0.6));
    }
    const fx = new SpiderFx();
    expect(fx.bead(1, 1, 0, 0, false, false)).toBe(0); // ohne Laterne und ungezupft dunkel
    fx.pluck(1, 1, 1000);
    expect(fx.bead(1, 1, 0, 1000, false, false)).toBe(1);
  });

  it('fern von Wegen: nie bis 8 Felder an einem Weg oder am Bett', () => {
    const path = (u: number) => Math.abs(u) <= 3;
    expect(farFromPaths(11, 0, path, [0, -40])).toBe(true);
    expect(farFromPaths(10, 0, path, [0, -40])).toBe(false);
    expect(farFromPaths(20, -40, () => false, [14, -40])).toBe(false);
  });
});
