// Eigenschafts-Test über die Welten der Stichprobe (Bauplan „Feine Grafik“, P1): Kein feiner Baum ragt unten weiter über
// eine Torplatte, ein Portal, einen Halt, eine Fahrspur oder vor eine Tannenlaterne als der Blockbaum vor dem Umbau.
import { describe, expect, it } from 'vitest';
import type { Cell, TreeKind } from './mitwachsen-cell';
import { treeBoxes } from './mitwachsen-tree-look';
import type { Box } from './mitwachsen-view';
import { BAHN_PACK, BUILT, HOEHLE_PACK, SAMPLE_SEEDS, seedRange, seedsFor, worldOf } from './test-worlds';
import type { World } from './mitwachsen-world';

/** So hoch über dem Fuß des Baums zählt ein Überstand (Figur auf der Platte, Laterne, Bahnsteig) */
const LOW = 1.2;
/** So weit um jedes Bett wird gesucht (Felder) */
const REACH = 34;

const b = (x: number, y: number, z: number, w: number, d: number, h: number): Box => [x, y, z, w, d, h, '', ''];
/** Die Blockbäume vor dem Umbau (mitwachsen-trees-3d.ts bis 27.11.2026), nur ihre Lage (x, Tiefe y, Höhe z) */
function blockTree(kind: TreeKind, x: number, y: number, h: number): Box[] {
  if (kind === 'pine' || kind === 'snowpine')
    return [
      b(x + 0.4, y + 0.4, h, 0.2, 0.2, 0.7),
      ...(
        [
          [-0.25, 0.5, 1.5],
          [0.0, 1.2, 1.0],
          [0.2, 1.8, 0.6],
        ] as const
      ).map(([o, z, w]) => b(x + o, y + o, h + z, w, w, 0.6)),
    ];
  if (kind === 'palm') return [b(x + 0.38, y + 0.38, h, 0.38, 0.22, 2.1)]; // unten nur der Stamm, die Wedel ab 1,8
  if (kind === 'dead') return [b(x + 0.4, y + 0.4, h, 0.2, 0.2, 1.5), b(x + 0.15, y + 0.45, h + 0.9, 0.75, 0.1, 0.4)];
  if (kind === 'birch') return [b(x + 0.4, y + 0.4, h, 0.2, 0.2, 1.6), b(x + 0.05, y + 0.05, h + 1.35, 0.9, 0.9, 0.95)];
  return [
    b(x + 0.36, y + 0.36, h, 0.28, 0.28, 1.3),
    b(x - 0.1, y - 0.1, h + 1.05, 1.2, 1.2, 0.55),
    b(x - 0.4, y - 0.4, h + 1.45, 1.8, 1.8, 0.8),
  ];
}

/** Rauminhalt der Quader über dem Nachbarfeld (x + dx, y + dy), höchstens `LOW` über dem Fuß h */
function spill(boxes: readonly Box[], x: number, y: number, h: number, dx: number, dy: number): number {
  let v = 0;
  for (const [bx, by, bz, w, d, hh] of boxes) {
    const ox = Math.min(bx + w, x + dx + 1) - Math.max(bx, x + dx),
      oy = Math.min(by + d, y + dy + 1) - Math.max(by, y + dy),
      oz = Math.min(bz + hh, h + LOW) - Math.max(bz, h);
    if (ox > 0 && oy > 0 && oz > 0) v += ox * oy * oz;
  }
  return v;
}

/** Felder, über die nichts ragen soll: Torplatte, Portal-Plattform, Halt, Fahrspur und Gleis */
const kept = (c: Cell) => !!(c.plate || c.portal || c.stop || c.ride || c.rail || c.lane);
const N8 = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => [dx, dy] as const)).filter(([dx, dy]) => dx || dy);

/** Bäume neben freizuhaltenden Feldern (bei der Laternen-Tanne das Feld davor, dort hängt die Laterne) */
function crowded(world: World) {
  const out: { kind: TreeKind; x: number; y: number; h: number; dx: number; dy: number }[] = [];
  const seen = new Set<string>();
  for (const home of Object.values(world.homes)) {
    const [bx, by] = home.bed;
    for (let y = by - REACH; y <= by + REACH; y++)
      for (let x = bx - REACH; x <= bx + REACH; x++) {
        const c = world.cell(x, y);
        if (c.deco !== 'tree' || seen.has(`${x},${y}`)) continue;
        seen.add(`${x},${y}`);
        const near = N8.filter(([dx, dy]) => kept(world.cell(x + dx, y + dy)) || (c.lamp && dx === 0 && dy === 1));
        out.push(...near.map(([dx, dy]) => ({ kind: c.tree ?? 'oak', x, y, h: c.h, dx, dy })));
      }
  }
  return out;
}

describe('Feine Bäume ragen nicht weiter über Platte, Portal, Halt, Spur oder Laterne als die Blockbäume', () => {
  const worlds = (seed: number) => [worldOf(seed), worldOf(seed, [HOEHLE_PACK, BAHN_PACK], BUILT)];

  it.each(seedsFor(seedRange(1, 30), SAMPLE_SEEDS))('Seed %i', (seed) => {
    for (const world of worlds(seed))
      for (const { kind, x, y, h, dx, dy } of crowded(world)) {
        const fine = spill(treeBoxes(kind, x, y, h), x, y, h, dx, dy);
        const block = spill(blockTree(kind, x, y, h), x, y, h, dx, dy);
        expect(fine, `${kind} bei ${x},${y} zu ${dx},${dy}`).toBeLessThanOrEqual(block + 1e-6);
      }
  });

  it('die Stichprobe hat solche Bäume (der Test prüft etwas)', () => {
    const found = SAMPLE_SEEDS.flatMap((seed) => worlds(seed).flatMap(crowded));
    expect(new Set(found.map((f) => f.kind)).has('snowpine')).toBe(true); // Laternen-Tannen der Eis-Welt
    expect(found.length).toBeGreaterThan(0);
  });
});
