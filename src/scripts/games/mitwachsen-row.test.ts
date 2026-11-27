import { describe, expect, it, vi } from 'vitest';
import { LEVEL_H, TILE_D, TILE_W } from '../../lib/games/front';
import type { Cell, Deco } from './mitwachsen-cell';
import { decoBoxes, shelterBoxes, type Neighbours } from './mitwachsen-deco-look';
import { ROW_FRONT, before, clampRow, rowCache, sortBoxes } from './mitwachsen-row';
import { TREE_HULL, treeBoxes } from './mitwachsen-tree-look';
import { WOOD_BED, bedBoxes, bridgeBoxes, fenceBoxes, signBoxes, sleeperBoxes } from './mitwachsen-yard-look';
import type { Box } from './mitwachsen-view';

const around = (map: Record<string, Deco>): Neighbours => ({ cell: (x, y) => ({ deco: map[`${x},${y}`] ?? null }) });
const cell = (deco: Deco): Cell => ({ h: 1, ground: 'grass', deco, region: 'wild', solid: false, color: '#b48cf0' });
const SHELTER = { x0: 10, y0: 20, x1: 16, y1: 22 };
const at = (deco: Deco, world = around({}), x = 3, y = 5) => decoBoxes(world, cell(deco), x, y, {}, () => SHELTER)!;

const OWN: Deco[] = [
  'bush',
  'flower',
  'fern',
  'boulder',
  'mushroom',
  'reed',
  'lily',
  'cactus',
  'crystal',
  'stalagmite',
  'bigshroom',
  'trough',
  'watertrough',
  'cloudpuff',
  'hedge',
  'arch',
  'fence',
];
/** Nachbarn, mit denen sich Hecke, Bogen und Zaun verbinden: keine, quer, rundum */
const NEIGHBOURS = [
  {},
  { '2,5': 'hedge', '4,5': 'hedge' },
  { '3,4': 'hedge', '3,6': 'hedge', '2,5': 'hedge', '4,5': 'hedge' },
  { '3,4': 'fence', '3,6': 'fence', '2,5': 'fence', '4,5': 'fence' },
] as const satisfies Record<string, Deco>[];

/** Alle Dinge, wie 2D sie zeichnet (Bäume an zwei Orten: Blüten liegen je Feld anders) */
const all = (): [string, readonly Box[], number][] => [
  ...(Object.keys(TREE_HULL) as (keyof typeof TREE_HULL)[]).flatMap((k): [string, readonly Box[], number][] => [
    [k, treeBoxes(k, 3, 5, 1), 5],
    [`${k} 8,2`, treeBoxes(k, 8, 2, 2), 2],
  ]),
  ...OWN.flatMap((d) => NEIGHBOURS.map((n, i): [string, readonly Box[], number] => [`${d} ${i}`, at(d, around(n)), 5])),
  // Dinge an Haus und Garten, die die Ansichten mit Zustand bestellen (mitwachsen-yard-look.ts)
  ['Bett', bedBoxes(3, 5, 1, WOOD_BED), 5],
  [
    'Bett mit Schläfer',
    [...bedBoxes(3, 5, 1, WOOD_BED), ...sleeperBoxes(3, 5, 1, { skin: '#f2c9a0', hair: '#6b4226' })],
    5,
  ],
  ['Schneebett', bedBoxes(3, 5, 2, ['#d5e4f0', '#f6f9fc', 'schnee']), 5],
  ...[1, 3, 5].map((n): [string, readonly Box[], number] => [`Tafel ${n}`, signBoxes(3, 5, 1, n), 5]),
  ['Brücke', bridgeBoxes(3, 5, 0.6), 5],
  ...[1, 0.4].flatMap((t): [string, readonly Box[], number][] => [
    [`Gartentor quer ${t}`, fenceBoxes(around({ '3,5': 'gate', '2,5': 'fence', '4,5': 'fence' }), 3, 5, 1, t), 5],
    [`Gartentor längs ${t}`, fenceBoxes(around({ '3,5': 'gate', '3,4': 'fence', '3,6': 'fence' }), 3, 5, 1, t), 5],
  ]),
];

/**
 * Bildpunkte bei Maßstab 1, an denen die Reihenfolge falsch malt: Sichtbar ist, was der Blick zuerst trifft (am
 * weitesten vorn), gemalt der letzte Quader, der den Punkt deckt. Gezählt nur, wo sich die Farbe der Fläche unterscheidet
 */
function wrongPixels(order: readonly Box[]): number {
  const xs = order.flatMap((b) => [b[0], b[0] + b[3]]);
  const ys = order.flatMap((b) => [b[1] * TILE_D - (b[2] + b[5]) * LEVEL_H, (b[1] + b[4]) * TILE_D - b[2] * LEVEL_H]);
  let wrong = 0;
  for (let px = Math.floor(Math.min(...xs) * TILE_W); px < Math.max(...xs) * TILE_W; px++)
    for (let py = Math.floor(Math.min(...ys)); py < Math.max(...ys); py++) {
      const [sx, sy] = [(px + 0.5) / TILE_W, py + 0.5];
      let painted = { depth: 0, color: '' },
        seen = { depth: -Infinity, color: '' };
      for (const [x, y, z, w, d, h, side, top] of order) {
        if (sx < x || sx > x + w || sy < y * TILE_D - (z + h) * LEVEL_H || sy > (y + d) * TILE_D - z * LEVEL_H)
          continue;
        const onTop = sy < (y + d) * TILE_D - (z + h) * LEVEL_H;
        const hit = { depth: onTop ? (sy + (z + h) * LEVEL_H) / TILE_D : y + d, color: onTop ? (top ?? side) : side };
        painted = hit;
        if (hit.depth > seen.depth + 1e-9) seen = hit;
      }
      if (seen.depth - painted.depth > 1e-6 && seen.color !== painted.color) wrong++;
    }
  return wrong;
}

describe('2D: Dinge in der eigenen Reihe (clampRow)', () => {
  it('kein Quader ragt weiter als `ROW_FRONT` in die nächste Reihe; Breite und Höhe bleiben', () => {
    for (const [name, boxes, row] of all()) {
      const rowed = clampRow(boxes, row);
      expect(rowed, name).toHaveLength(boxes.length);
      expect(Math.max(...rowed.map((b) => b[1] + b[4])), name).toBeLessThanOrEqual(row + ROW_FRONT + 1e-9);
      const size = (list: readonly Box[]) => list.map((b) => `${b[0]},${b[2]},${b[3]},${b[5]}`).sort();
      expect(size(rowed), name).toEqual(size(boxes));
    }
  });

  it('was schon in die Reihe passt, bleibt, wie es ist (nur die Reihenfolge)', () => {
    const fern = at('fern');
    expect([...clampRow(fern, 5)].sort()).toEqual([...fern].sort());
  });

  it('gezeichnet von hinten nach vorn, von unten nach oben: nichts kommt vor einem, das es verdeckt', () => {
    for (const [name, boxes, row] of all()) {
      const rowed = clampRow(boxes, row);
      const wrong = rowed.flatMap((b, i) =>
        rowed
          .slice(i + 1)
          .filter((a) => before(a, b))
          .map(() => i),
      );
      expect(wrong, name).toEqual([]);
    }
  });

  it('jeder Bildpunkt zeigt, was vorn liegt: kein Ding malt sich falsch (Bäume, Deko, Unterstand)', () => {
    for (const [name, boxes, row] of all()) expect(wrongPixels(clampRow(boxes, row)), name).toBe(0);
    expect(wrongPixels(sortBoxes(shelterBoxes(12, 21, 1, SHELTER))), 'Unterstand').toBe(0);
  });

  it('Busch: die Beeren oben kommen nach der oberen Stufe, die Beeren vorn nach dem Laub', () => {
    const last = clampRow(at('bush'), 5).slice(-5);
    expect(last.every((b) => b[6] === '#c8323a')).toBe(true);
  });
});

describe('Reihenfolge zweier Quader (before)', () => {
  const q = (x: number, y: number, z: number, d = 1, h = 1): Box => [x, y, z, 1, d, h, '#000000', '#000000'];

  it('was dahinter oder darunter liegt, zuerst, aber nur, wo sich beide im Bild überdecken', () => {
    expect(before(q(0, 0, 0), q(0, 1, 0))).toBe(true); // dahinter
    expect(before(q(0, 1, 0), q(0, 0, 0))).toBe(false);
    expect(before(q(0, 0, 0), q(0, 0.5, 1))).toBe(true); // darunter
    expect(before(q(0, 0, 0), q(2, 1, 0))).toBe(false); // nebeneinander
    expect(before(q(0, 0, 3), q(0, 1, 0))).toBe(false); // hoch hinten, tief vorn: im Bild getrennt
  });

  it('durchdringen sich zwei, kommt zuletzt, wer auf mehr Bildzeilen vorn liegt; gleich vorn: keiner', () => {
    // flache Platte, die vorn aus einem hohen Pfosten ragt: Sie liegt auf mehr Zeilen vorn als er
    const post: Box = [0, 0.4, 0, 1, 0.2, 0.8, '#000000', '#000000'];
    const slat: Box = [0, 0.5, 0.3, 1, 0.5, 0.12, '#111111', '#111111'];
    expect(before(post, slat)).toBe(true);
    expect(before(slat, post)).toBe(false);
    // dünner Fuß um einen Stamm, der in ihm steckt: Der Fuß deckt auf mehr Zeilen
    const foot: Box = [0, 0.3, 0, 1, 0.4, 0.2, '#000000', '#000000'];
    const trunk: Box = [0, 0.4, 0, 1, 0.2, 2, '#111111', '#111111'];
    expect(before(trunk, foot)).toBe(false);
    expect(before(foot, trunk)).toBe(true);
    expect(before(q(0, 0, 0), q(0, 0, 0))).toBe(false);
  });

  it('Kreis im Zeichnen (sich durchdringende Quader): bricht nicht ab, alle kommen dran', () => {
    // a hoch und hinten, b tief und vorn, c lang dazwischen: a vor b, b vor c, c vor a
    const a: Box = [0, 0, 2, 1, 1, 1, '#000000', '#000000'];
    const b: Box = [0, 1, 0, 1, 1, 1, '#111111', '#111111'];
    const c: Box = [0, 0, 1, 1, 2, 0.5, '#222222', '#222222'];
    expect(new Set(sortBoxes([a, b, c]).map((x) => x[6])).size).toBe(3);
    const ring = (i: number): Box => [0, i, 0, 1, 1.5, 1, `#00000${i}`, '#000000'];
    expect(sortBoxes([ring(0), ring(1), ring(2)])).toHaveLength(3);
  });
});

describe('Speicher je Feld (rowCache)', () => {
  const world = {};
  const boxes = (): Box[] => [[0, 0, 0, 1, 1, 1, '#000000', '#000000']];

  it('baut ein Feld nur neu, wenn sich sein Schlüssel ändert', () => {
    const memo = rowCache();
    const make = vi.fn(boxes);
    const first = memo(world, 3, 5, 'tree', make);
    expect(memo(world, 3, 5, 'tree', make)).toBe(first);
    expect(make).toHaveBeenCalledTimes(1);
    memo(world, 3, 5, 'tree picked', make);
    memo(world, 4, 5, 'tree picked', make);
    expect(make).toHaveBeenCalledTimes(3);
    const none = vi.fn(() => null);
    expect(memo(world, 6, 5, 'sign', none)).toBeNull();
    expect(memo(world, 6, 5, 'sign', none)).toBeNull();
    expect(none).toHaveBeenCalledTimes(1);
  });

  it('eine andere Welt oder ein voller Speicher fangen von vorn an', () => {
    const memo = rowCache(2);
    const make = vi.fn(boxes);
    memo(world, 0, 0, 'k', make);
    memo({}, 0, 0, 'k', make); // neue Welt
    expect(make).toHaveBeenCalledTimes(2);
    memo(world, 0, 0, 'k', make);
    memo(world, 1, 0, 'k', make);
    memo(world, 2, 0, 'k', make); // voll: geleert
    memo(world, 0, 0, 'k', make);
    expect(make).toHaveBeenCalledTimes(6);
  });
});
