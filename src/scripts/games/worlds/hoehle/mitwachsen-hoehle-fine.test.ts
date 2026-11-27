// Feinheit der Kristallgrotte (Entwurf „Feine Grafik“, Issue 13, Paket P4): Was leuchtet (Kristalle, Leuchtpilze,
// Leuchtmoos), trägt `halo` – es leuchtet weich und wird nur halb so stark schattiert, so bleibt die Kontrastregel der
// Grotte; Kristalle mit hellerer Spitze und Lichtkante; Moos als Fell, Holz mit Maserung und Nägeln, Stein ohne Muster;
// Höhlen-Tiere fein mit Zusatzteilen in ihrer Hülle (der Umriss bleibt die Grundform), die Tupfspinne ohne Fell, das
// Glühwürmchen leuchtet; Laterne und Hau-ruck fein, schwebende Körper ohne Fleck am Boden; die Modelle in der Luft
// (Grottenolm, Fledermaus) fein, in 2D aus dem Bild-Cache.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { painterOf, paintWith, type Part, type Projection } from '../../../../lib/games/front';
import { haloCompact } from '../../../../lib/games/shade';
import { SHROOM_COLORS } from '../../../../data/games/mitwachsen-hoehle';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import { GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { CAVE_MODELS } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-models';
import {
  CAVE_ANIMAL_FINE,
  CAVE_FINE_MODELS,
  CAVE_FINE_ROOST,
  SPIDER_FINE_MODELS,
} from '../../../../data/games/worlds/hoehle/mitwachsen-cave-fine';
import type { Cell } from '../../mitwachsen-cell';
import { Fine2D } from '../../mitwachsen-fine-2d';
import type { SkyScene } from '../../mitwachsen-sky';
import type { Box } from '../../mitwachsen-view';
import { kesselPlace } from '../../mitwachsen-world';
import { HOEHLE_PACK, worldOf } from '../../test-worlds';
import { anyContext, fakeDocument } from '../../test-canvas';
import { before } from '../../mitwachsen-row';
import { CAVE_FINE, EDGE, crystal, deepen, edge, lighten } from './mitwachsen-cave-fine';
import { caveBoxes } from './mitwachsen-cave-look';
import { echoBoxes, shroomBoxes, stoneBoxes, towerBoxes } from './mitwachsen-cave-places-look';
import { TOWER } from './mitwachsen-cave-places';
import { caveWeather, type CaveFx } from './mitwachsen-cave-sky';
import { Chime, ROUND } from './mitwachsen-chime-look';
import { Drips } from './mitwachsen-drips';
import { Olm } from './mitwachsen-olm-look';
import { FLY, HANDS, heaveBodies } from './mitwachsen-heave-look';
import { LANTERN_FOOT, LANTERN_READY, lanternBodies } from './mitwachsen-lantern';
import { PUSHES, GATE } from './mitwachsen-heave';

type Q = Box | Part;
const lo = (q: Q) => [q[0], q[1], q[2]] as const;
const hi = (q: Q) => [q[0] + q[3], q[1] + q[4], q[2] + q[5]] as const;
const overlap = (a: Q, b: Q) => [0, 1, 2].map((i) => Math.min(hi(a)[i]!, hi(b)[i]!) - Math.max(lo(a)[i]!, lo(b)[i]!));
/** Gemeinsamer Rauminhalt zweier Quader */
const shared = (a: Q, b: Q) => overlap(a, b).reduce((v, o) => v * Math.max(0, o), 1);
/** Berühren sich zwei Quader (Abstand höchstens 1e-6 auf jeder Achse)? */
const touching = (a: Q, b: Q) => overlap(a, b).every((o) => o >= -1e-6);
const hull = (all: readonly Q[]) =>
  [0, 1, 2].map((i) => [Math.min(...all.map((p) => lo(p)[i]!)), Math.max(...all.map((p) => hi(p)[i]!))] as const);

const world = worldOf(1, [HOEHLE_PACK]);
const CELLS = kesselPlace(1, HOEHLE_PACK).cells.map((p) => ({ p, c: world.cell(...p) }));
/** Alle Dinge der Grotte, wie die Ansichten sie bauen (Beete voll, Schale und Trog voll) */
const THINGS = CELLS.flatMap(({ p: [x, y], c }) => {
  const boxes = caveBoxes(world, c, x, y, true);
  return boxes ? [{ x, y, c, boxes }] : [];
});
const C = GROTTE_COLORS;
/** Was in der Grotte leuchtet (wie im Kontrasttest): Kristalle, Leuchtpilze, Leuchtmoos, Deko-Pilze */
const GLOWING = new Set<string>([...C.crystals, ...SHROOM_COLORS, C.glowmoss[1], C.decoShroom]);
const cell = (deco: Cell['deco'], extra: Partial<Cell> = {}): Cell => ({
  h: 1,
  ground: 'grotto',
  deco,
  region: 'hoehle',
  solid: !!deco,
  biome: 'hoehle',
  ...extra,
});

describe('Feinheit der Kristallgrotte: Dinge', () => {
  it('die Welt (Seed 1) hat jedes Ding der Grotte, das hier fein wird', () => {
    const decos = new Set(THINGS.map((t) => t.c.deco));
    for (const d of ['crystalbush', 'crystalfield', 'glowmoss', 'shroombed', 'column', 'torch', 'cavelamp'] as const)
      expect(decos.has(d), d).toBe(true);
  });

  it('was leuchtet, trägt `halo` (leuchtet weich, halb so stark schattiert); nur der Kristall hinten in der Wand des Unterstands nicht und die Perlen der Netze (sie leuchten über der Maske, `drawBeads`)', () => {
    const bad = THINGS.flatMap(({ x, y, c, boxes }) =>
      c.deco === 'shed' || c.deco === 'web'
        ? []
        : boxes
            .filter((b) => GLOWING.has(b[6]) && b[5] > 0.02 && !b[9]?.halo)
            .map((b) => `${c.deco} ${x},${y}: ${JSON.stringify(b)}`),
    );
    expect(bad).toEqual([]);
    // Stein, Lehm, Wasser und Adern leuchten nie
    const dull = new Set<string>([...C.stal, ...C.rock, ...C.clay, ...C.water, ...C.veins, ...C.bright]);
    const lit = THINGS.flatMap(({ boxes }) => boxes.filter((b) => dull.has(b[6]) && b[9]?.halo));
    expect(lit).toEqual([]);
  });

  it('Kristall fein: Säule wie bisher, darauf eine hellere Spitze, vorn eine weiße Lichtkante (`glow`), alles leuchtet', () => {
    const [body, tip, light] = crystal(2, 3, 1, 0.3, 0.2, 0.5, C.crystals[0]);
    expect(body).toEqual([2, 3, 1, 0.3, 0.2, 0.5, C.crystals[0], C.crystals[0], undefined, CAVE_FINE.glow]);
    expect(tip![6]).toBe(lighten(C.crystals[0], 0.45));
    expect(tip![2]).toBeCloseTo(1.5); // obenauf
    expect(tip![5]).toBeCloseTo(0.1); // ein Fünftel der Säule
    expect(tip![9]?.halo).toBe(true);
    expect(light).toEqual(edge(2 + 0.036, 3.2, 1 + 0.225, 0.048, 0.225));
    expect(light![1]).toBeCloseTo(body![1] + body![4]); // vorn auf der Säule
    expect(light![4]).toBe(EDGE);
    expect(light![8]).toBe('glow');
    expect(crystal(0, 0, 0, 0.1, 0.1, 2, '#ffffff')[1]![5]).toBeCloseTo(0.12); // höchstens `tipMax`
    expect(lighten('#000000', 2)).toBe('#ffffff');
    expect(deepen('#ffffff', 0.5)).toBe('#808080');
    expect(deepen('#ffffff', -1)).toBe('#ffffff');
  });

  it('Moos als Fell, Farn als Blatt, Holz mit Maserung; Stein ohne Muster', () => {
    const skins = (deco: Cell['deco'], extra: Partial<Cell> = {}) =>
      new Set(caveBoxes(world, cell(deco, extra), 3, 4)!.map((b) => b[9]?.skin));
    expect(skins('mosstop')).toEqual(new Set(['fell']));
    expect(skins('dripmoss').has('fell')).toBe(true);
    expect(skins('fern').has('blatt')).toBe(true);
    expect(skins('jetty').has('holz')).toBe(true);
    for (const deco of ['stalagmite', 'boulder', 'lantern'] as const)
      expect(skins(deco), deco).toEqual(new Set([undefined]));
  });

  it('Plättchen (Lichtkanten, Riss, Rillen, Glanz, Tupfen) liegen vorn auf einer Fläche ihres Dings, Nägel obenauf', () => {
    const bad: string[] = [];
    for (const { x, y, c, boxes } of THINGS) {
      for (const b of boxes) {
        if (b[4] !== EDGE && b[5] !== EDGE) continue;
        const host = boxes.find((o) => o !== b && touching(o, b) && shared(o, b) < 1e-9);
        if (!host) bad.push(`${c.deco} ${x},${y}: ${JSON.stringify(b)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('Steg: je Brett zwei Nägel obenauf, in beiden Richtungen', () => {
    for (const note of [0, 99]) {
      const boxes = caveBoxes(world, cell('jetty', { note, ground: 'path' }), 3, 4)!;
      const boards = boxes.filter((b) => b[9]?.skin === 'holz');
      const nails = boxes.filter((b) => b[5] === EDGE);
      expect(boards).toHaveLength(2);
      expect(nails).toHaveLength(4);
      for (const n of nails) expect(boards.some((b) => touching(b, n) && n[2] === b[2] + b[5])).toBe(true);
    }
  });

  it('Deko-Pilz nach dem Entwurf: Hut als Lack und helle Kuppe leuchten, zwei weiße Tupfen vorn, der Stiel leuchtet nicht', () => {
    const [stem, cap, top, ...dots] = caveBoxes(world, cell('glowshroom', { solid: false }), 0, 0)!;
    expect(stem![9]).toBeUndefined();
    expect(cap![9]).toEqual(CAVE_FINE.glowCap);
    expect(top![9]?.halo).toBe(true);
    expect(top![6]).toBe(lighten(C.decoShroom, 0.4));
    expect(dots.map((d) => d[6])).toEqual(['#ffffff', '#ffffff']);
    for (const d of dots) expect(d[1]).toBeCloseTo(cap![1] + cap![4]);
  });

  it('Pilzbeet: Hüte leuchten, der mittlere mit heller Kuppe (keine neue Farbe), Moos als Fell; abgeerntet leuchtet nichts', () => {
    const full = caveBoxes(world, cell('shroombed'), 3, 4, true)!;
    const caps = full.filter((b) => b[9]?.halo);
    expect(caps).toHaveLength(6);
    expect(caps.every((b) => haloCompact(b[3], b[4], b[5]))).toBe(true);
    expect(new Set(caps.flatMap((b) => [b[6], b[7]])).size).toBe(2); // Farbe des Beets und ihr Helles
    expect(caveBoxes(world, cell('shroombed'), 3, 4, false)!.filter((b) => b[9]?.halo)).toEqual([]);
  });

  it('Säulen: die Spitze gehört zur Höhe der Säule, sie leuchtet; der Schein beim Klingen trifft Säule und Spitze', () => {
    const boxes = caveBoxes(world, cell('column', { note: 2 }), 3, 4)!;
    const lit = boxes.filter((b) => b[9]?.halo); // was `glows` in 3D nachzeichnet
    expect(lit).toHaveLength(2);
    const [body, tip] = lit as [Box, Box];
    expect(GLOWING.has(body[6])).toBe(true);
    expect(tip[2] + tip[5]).toBe(Math.max(...boxes.map((b) => b[2] + b[5])));
    expect(tip[2]).toBeCloseTo(body[2] + body[5]);
  });

  it('2D: gezeichnet von hinten nach vorn, von unten nach oben – kein Teil kommt nach einem, das vor ihm liegt', () => {
    // wie die Ansicht: Quader in der Reihe ihrer Vorderkante, darin in der Reihenfolge des Dings (mitwachsen-render.ts)
    const row = (b: Box) => Math.ceil(b[1] + b[4] - 1e-6) - 1;
    const painted = (boxes: readonly Box[]) =>
      boxes
        .map((b, i) => [row(b), i, b] as const)
        .sort((p, q) => p[0] - q[0] || p[1] - q[1])
        .map(([, , b]) => b);
    const late = (boxes: readonly Box[]) =>
      painted(boxes).some((b, i, all) => all.slice(i + 1).some((a) => before(a, b)));
    // Dinge, deren Teile schon vor der Feinen Grafik ineinander steckten (Kristall in der Wand des Unterstands, Netz,
    // Tropfquelle, Wasserfall, Farn, Trog, Pilzbeet): bleiben, wie sie waren
    const OLD = new Set<Cell['deco']>(['shed', 'web', 'dripspring', 'waterfall', 'fern', 'stonetrough', 'shroombed']);
    const things: [string, readonly Box[]][] = [
      ...THINGS.filter(({ c }) => !OLD.has(c.deco)).map(({ x, y, c, boxes }): [string, readonly Box[]] => [
        `${c.deco} ${x},${y}`,
        boxes,
      ]),
      ...[true, false].map((lit): [string, readonly Box[]] => [
        `Leuchtpilz ${lit}`,
        shroomBoxes(cell('sleepshroom'), 3, 4, lit),
      ]),
      ...[0, 1, 2, TOWER].map((n): [string, readonly Box[]] => [
        `Türmchen ${n}`,
        towerBoxes(cell('crystalheap'), 3, 4, n),
      ]),
    ];
    expect(things.filter(([, boxes]) => late(boxes)).map(([name]) => name)).toEqual([]);
    // die Pfosten am Unterstand: der Steinfuß vor dem Pfosten
    const [sx, sy] = world.homes.hoehle.shelterStem;
    const mid = painted(caveBoxes(world, world.cell(sx, sy), sx, sy)!);
    const posts = mid.filter((b) => b[9]?.skin === 'holz');
    expect(posts).toHaveLength(2);
    for (const p of posts) expect(mid.slice(mid.indexOf(p) + 1).some((a) => before(a, p))).toBe(false);
  });

  it('Fackel und Lampe: Flamme bzw. Kristall leuchten, der Pfosten nicht; Kristallbusch: der große mit Spitze und Lichtkante', () => {
    const torch = caveBoxes(world, cell('torch', { color: C.crystals[1] }), 3, 4)!;
    expect(torch.filter((b) => b[9]?.halo)).toHaveLength(3);
    expect(torch[0]![9]).toBeUndefined();
    const lamp = caveBoxes(world, cell('cavelamp'), 3, 4)!;
    expect(lamp.filter((b) => b[9]?.halo)).toHaveLength(2);
    expect(lamp.filter((b) => b[8] === 'glow')).toHaveLength(1);
    const bush = caveBoxes(world, cell('crystalbush', { color: C.crystals[2] }), 3, 4)!;
    expect(bush.filter((b) => b[9]?.halo)).toHaveLength(5);
    expect(bush.filter((b) => b[8] === 'glow')).toHaveLength(1);
  });

  it('Spielorte: wacher Pilz leuchtet (Kuppe weich), schlafender als matter Lack; fertiges Türmchen leuchtet an der Spitze; Zahlen bleiben scharf', () => {
    const awake = shroomBoxes(cell('sleepshroom'), 3, 4, true);
    const asleep = shroomBoxes(cell('sleepshroom'), 3, 4, false);
    expect(awake[0]![9]?.skin).toBe('haar'); // Fasern am Stiel
    expect(awake.filter((b) => b[9]?.halo && haloCompact(b[3], b[4], b[5]))).toHaveLength(1);
    expect(asleep.filter((b) => b[9]?.halo)).toEqual([]);
    expect(asleep[2]![9]?.skin).toBe('lack'); // der Hut nach Stiel und Kragen
    const done = towerBoxes(cell('crystalheap'), 3, 4, TOWER);
    const top = done.reduce((a, b) => (b[2] + b[5] > a[2] + a[5] ? b : a));
    expect(top[8]).toBe('glow');
    expect(top[9]?.halo).toBe(true);
    expect(towerBoxes(cell('crystalheap'), 3, 4, 1).filter((b) => b[8] === 'glow')).toEqual([]);
    expect(stoneBoxes(cell('numstone', { note: 3 }), 3, 4).every((b) => !b[9]?.halo)).toBe(true);
    expect(echoBoxes(cell('echostone'), 3, 4).every((b) => !b[9])).toBe(true);
  });
});

describe('Feinheit der Kristallgrotte: Tiere und Körper', () => {
  it('Höhlen-Tiere: Zusatzteile in der Hülle (±0,05), stecken in nichts, berühren ihr Teil; Muster je Material; Grundform bleibt', () => {
    for (const [id, { extra, by }] of Object.entries(CAVE_ANIMAL_FINE) as [
      keyof typeof CAVE_MODELS,
      (typeof CAVE_ANIMAL_FINE)['maulwurf'],
    ][]) {
      const base = CAVE_MODELS[id];
      const fine = CAVE_FINE_MODELS[id];
      expect(
        fine.slice(0, base.length).map((p) => p.slice(0, 7)),
        id,
      ).toEqual(base.map((p) => p.slice(0, 7)));
      expect(fine).toHaveLength(base.length + extra.length);
      const added = fine.slice(base.length);
      const h0 = hull(base);
      const out = added.filter((p) => hull([p]).some(([a, b], i) => a < h0[i]![0] - 0.05 || b > h0[i]![1] + 0.05));
      expect(out, id).toEqual([]);
      const inside = added.filter((p) => fine.some((q) => q !== p && shared(p, q) > 1e-9));
      expect(inside, id).toEqual([]);
      const loose = added.filter((p) => !base.some((q) => touching(p, q)));
      expect(loose, id).toEqual([]);
      expect(
        fine.some((p) => p[9]?.skin && by[p[6]]),
        id,
      ).toBe(true);
    }
    expect(CAVE_FINE_MODELS.gluehwuermchen.filter((p) => p[9]?.halo).map((p) => p[6])).toEqual(['#d8ff6a']);
    expect(CAVE_FINE_ROOST.some((p) => p[9]?.skin === 'fell')).toBe(true);
  });

  it('die Tupfspinne ohne Haare (kein Fell, Körper glatt), die Augen ohne Muster', () => {
    for (const parts of Object.values(SPIDER_FINE_MODELS)) {
      expect(parts.some((p) => p[9]?.skin === 'fell')).toBe(false);
      expect(parts.filter((p) => p[6] === C.spider.body).every((p) => p[9]?.skin === 'lack')).toBe(true);
      expect(parts.filter((p) => p[6] === C.spider.eye).every((p) => !p[9])).toBe(true);
    }
  });

  it('Laterne: Rahmen Metall (Gold bleibt Gold), Kristall leuchtet; ihr Fleck bleibt auf der Platte des Sockels', () => {
    expect(LANTERN_READY.filter((p) => p[6] === GOLD.side).every((p) => p[9]?.skin === 'metall')).toBe(true);
    expect(LANTERN_READY.filter((p) => p[9]?.halo)).toHaveLength(1);
    const [body] = lanternBodies({}, world);
    expect(body!.foot).toBe(LANTERN_FOOT);
    expect(LANTERN_FOOT * 1.35).toBeLessThan(0.28); // halbe Platte (0,56)
  });

  it('Hau-ruck: Rahmen der Tafel Metall, Glühwürmchen leuchten; Tafel, Fledermaus und Glühwürmchen schweben ohne Fleck', () => {
    expect(HANDS.filter((p) => p[6] === GOLD.side).every((p) => p[9]?.skin === 'metall')).toBe(true);
    expect(FLY[0]![9]?.halo).toBe(true);
    const door = world.gates.get(GATE)!;
    const w = { gates: world.gates, cell: world.cell.bind(world) };
    const push = heaveBodies({ tick: 5, heave: { gate: GATE, n: 1, at: 0 } }, w, {
      now: 0,
      frac: 0,
      reduced: false,
    } as never);
    const fly = heaveBodies({ tick: 25, heave: { gate: GATE, n: PUSHES, at: 0 } }, w, {
      now: 0,
      frac: 0,
      reduced: false,
    } as never);
    expect(door).toBeDefined();
    expect(push.length).toBeGreaterThan(0);
    expect(fly.length).toBeGreaterThan(1);
    expect([...push, ...fly].every((b) => b.foot === 0)).toBe(true);
  });
});

describe('Modelle in der Luft der Grotte (Grottenolm, Fledermaus) fein', () => {
  let restore = () => {};
  beforeAll(() => void (restore = fakeDocument()));
  afterAll(() => restore());
  const P: Projection = (x, y, z) => [x * 10, (y - z) * 10];
  const scene = (lit3d: boolean) =>
    ({ now: 100, reduced: false, lit3d, explored: () => true, zoom: 1 }) as unknown as SkyScene;
  const column = CELLS.find(({ c }) => c.deco === 'column')!;
  const perch = CELLS.find(({ c }) => c.perch !== undefined)!.p;
  const fresh = (): CaveFx => ({ chime: new Chime(), drips: new Drips(), olm: new Olm(), light: {} });

  it('in 2D aus dem Bild-Cache (je Modell, Richtung und Größe einmal), in 3D direkt mit dem Maler, der danach wieder der alte ist', () => {
    const f = fresh();
    for (let i = 0; i < ROUND.every; i++) f.chime.ring(...column.p, 0, 0, perch);
    let images = 0;
    caveWeather(f)(
      anyContext((w) => void (w === 'drawImage' && images++)),
      world,
      scene(false),
      P,
    );
    expect(images).toBeGreaterThan(0); // die Fledermaus auf ihrer Runde
    expect(f.sprites?.size).toBe(1);
    const ctx = anyContext();
    const before = new Fine2D();
    paintWith(ctx, before);
    let fills = 0;
    const deep = anyContext(() => void fills++);
    caveWeather(f)(deep, world, scene(true), P);
    expect(fills).toBeGreaterThan(0);
    expect(painterOf(deep)).toBeUndefined(); // vorher keiner, danach wieder keiner
    expect(painterOf(ctx)).toBe(before);
  });
});
