import { describe, expect, it } from 'vitest';
import type { TreeKind } from './mitwachsen-cell';
import { BUSH_HULL, LEAVES, TREE_HULL, bushBoxes, mix, treeBoxes, type Hull } from './mitwachsen-tree-look';
import type { Box } from './mitwachsen-view';

const KINDS = Object.keys(TREE_HULL) as TreeKind[];
const EPS = 1e-9;

/** Quader, die aus der Hülle ragen (relativ zur Ecke des Felds x, y in Höhe h) */
const outside = (boxes: readonly Box[], hull: Hull, x: number, y: number, h: number) =>
  boxes.filter(
    (b) =>
      b[0] < x + hull.x[0] - EPS ||
      b[0] + b[3] > x + hull.x[1] + EPS ||
      b[1] < y + hull.y[0] - EPS ||
      b[1] + b[4] > y + hull.y[1] + EPS ||
      b[2] < h - EPS ||
      b[2] + b[5] > h + hull.z + EPS,
  );

/** Rauminhalt unterhalb von 1,2 über dem Boden, der aus dem eigenen Feld ragt (über Torplatten, Laternen, Halte) */
function lowSpill(boxes: readonly Box[]) {
  let v = 0;
  for (const [x, y, z, w, d, h] of boxes) {
    const top = Math.min(z + h, 1.2);
    if (top <= z) continue;
    const inX = Math.max(0, Math.min(x + w, 1) - Math.max(x, 0)),
      inY = Math.max(0, Math.min(y + d, 1) - Math.max(y, 0));
    v += (w * d - inX * inY) * (top - z);
  }
  return v;
}
/** Gemessen an den Blockbäumen vor dem Umbau (mitwachsen-trees-3d.ts, 27.11.2026) */
const OLD_SPILL: Record<TreeKind, number> = {
  oak: 0.066,
  autumn: 0.066,
  red: 0.066,
  blossom: 0.066,
  winter: 0.066,
  birch: 0,
  pine: 0.75,
  snowpine: 0.846,
  palm: 0,
  dead: 0,
};

describe('Bäume als Modelle (mitwachsen-tree-look.ts)', () => {
  it.each(KINDS)('%s bleibt in der Hülle des Blockbaums, auf jedem Feld und jeder Höhe', (kind) => {
    for (const [x, y, h] of [
      [0, 0, 1],
      [-7, 12, 3],
      [40, -3, 0],
    ] as const) {
      const boxes = treeBoxes(kind, x, y, h);
      expect(boxes.length).toBeGreaterThan(4);
      expect(outside(boxes, TREE_HULL[kind], x, y, h), `${kind} bei ${x},${y}`).toEqual([]);
      expect(boxes.every((b) => b[3] > 0 && b[4] > 0 && b[5] > 0)).toBe(true);
    }
  });

  it.each(KINDS)('%s ragt unten nicht weiter über sein Feld als der Blockbaum (Torplatte, Laterne, Halt)', (kind) => {
    expect(lowSpill(treeBoxes(kind, 0, 0, 0))).toBeLessThanOrEqual(OLD_SPILL[kind] + 1e-6);
  });

  it('Laub ist durchsichtig vor der Figur (`see`), Stamm, Ast und Kokosnüsse sind fest', () => {
    for (const kind of KINDS) {
      const boxes = treeBoxes(kind, 0, 0, 1);
      const trunk = boxes.filter((b) => b[8] !== 'see');
      expect(trunk.length, kind).toBeGreaterThan(0);
      // der Stamm steht im Feld
      expect(trunk[0]![0] >= 0 && trunk[0]![0] + trunk[0]![3] <= 1, kind).toBe(true);
      if (kind !== 'dead')
        expect(
          boxes.some((b) => b[8] === 'see'),
          kind,
        ).toBe(true);
    }
  });

  it('schmaler Stamm mit Fuß, Krone in Stufen aus mehreren Tönen; Muster Rinde, Blatt und Nadel', () => {
    for (const kind of ['oak', 'autumn', 'blossom', 'birch'] as const) {
      const boxes = treeBoxes(kind, 0, 0, 0);
      const crown = boxes.filter((b) => b[8] === 'see');
      const trunk = boxes.filter((b) => b[8] !== 'see').sort((a, b) => b[5] - a[5])[0]!;
      const crownWidth = Math.max(...crown.map((b) => b[0] + b[3])) - Math.min(...crown.map((b) => b[0]));
      expect(trunk[3], kind).toBeLessThanOrEqual(0.3);
      expect(crownWidth / trunk[3], kind).toBeGreaterThan(4);
      expect(new Set(crown.map((b) => b[2].toFixed(2))).size, kind).toBeGreaterThanOrEqual(3); // Stufen
      expect(new Set(crown.map((b) => b[6])).size, kind).toBeGreaterThanOrEqual(3); // Töne
      expect(trunk[9]?.skin, kind).toBe('rinde');
      expect(
        crown.filter((b) => b[6] !== '#ffffff').every((b) => b[9]?.skin === 'blatt'),
        kind,
      ).toBe(true);
    }
    expect(
      treeBoxes('pine', 0, 0, 0)
        .filter((b) => b[8] === 'see')
        .every((b) => b[9]?.skin === 'nadel'),
    ).toBe(true);
    expect(treeBoxes('palm', 0, 0, 0).some((b) => b[9]?.skin === 'holz')).toBe(true);
  });

  it('Tanne: vier Stufen nach oben schmaler; die Schneetanne trägt Schnee, die Tanne nicht', () => {
    const tiers = treeBoxes('pine', 0, 0, 0).filter((b) => b[8] === 'see');
    expect(tiers).toHaveLength(4);
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i]![2]).toBeGreaterThan(tiers[i - 1]![2]);
      expect(tiers[i]![3]).toBeLessThan(tiers[i - 1]![3]);
    }
    // Schnee an der Kante jeder Stufe, Haube und Spitze obenauf; die Oberseiten der Stufen sind schon weiß
    const snowy = treeBoxes('snowpine', 0, 0, 0);
    expect(snowy.filter((b) => b[9]?.skin === 'schnee')).toHaveLength(6);
    expect(snowy.filter((b) => b[9]?.skin === 'nadel').every((b) => b[7] === '#f4f8fb')).toBe(true);
    // die erste Stufe beginnt nicht tiefer als beim Blockbaum: Die Laterne davor (z 0,26 … 0,72) bleibt frei wie bisher
    expect(Math.min(...tiers.map((b) => b[2]))).toBeGreaterThanOrEqual(0.5);
  });

  it('Farben je Art aus `LEAVES`; der Blütenbaum trägt weiße Blüten vorn, je Feld anders verteilt', () => {
    expect(treeBoxes('autumn', 0, 0, 0).some((b) => b[6] === LEAVES.autumn[0])).toBe(true);
    expect(treeBoxes('winter', 0, 0, 0).some((b) => b[7] === LEAVES.winter[1])).toBe(true);
    const petals = (x: number) => treeBoxes('blossom', x, 0, 0).filter((b) => b[6] === '#ffffff');
    expect(petals(0)).toHaveLength(8);
    expect(petals(0).map((b) => b[0].toFixed(2))).not.toEqual(petals(5).map((b) => (b[0] - 5).toFixed(2)));
    // vorn: jede Blüte liegt vor der Mitte des Felds
    expect(petals(0).every((b) => b[1] > 1)).toBe(true);
  });

  it('gleich auf jedem Feld: verschoben ist der Baum derselbe (außer den Blüten)', () => {
    for (const kind of KINDS.filter((k) => k !== 'blossom')) {
      const a = treeBoxes(kind, 0, 0, 0);
      const b = treeBoxes(kind, 3, -2, 1).map(
        ([x, y, z, ...rest]) => [+(x - 3).toFixed(6), +(y + 2).toFixed(6), +(z - 1).toFixed(6), ...rest] as const,
      );
      expect(b, kind).toEqual(a.map(([x, y, z, ...rest]) => [+x.toFixed(6), +y.toFixed(6), +z.toFixed(6), ...rest]));
    }
  });
});

describe('Beerenbusch (bushBoxes)', () => {
  it('niedrig und rund in zwei Stufen, Laub durchsichtig, in der Hülle des alten Buschs', () => {
    const boxes = bushBoxes(4, 7, 1, true);
    expect(outside(boxes, BUSH_HULL, 4, 7, 1)).toEqual([]);
    const leaves = boxes.filter((b) => b[8] === 'see');
    expect(leaves.length).toBeGreaterThanOrEqual(4);
    expect(new Set(leaves.map((b) => b[2])).size).toBeGreaterThanOrEqual(2);
    expect(leaves.every((b) => b[9]?.skin === 'blatt')).toBe(true);
  });

  it('rote Beeren vorn und oben; gepflückt keine', () => {
    const full = bushBoxes(0, 0, 0, true);
    const berries = full.filter((b) => b[8] !== 'see');
    expect(berries).toHaveLength(5);
    expect(berries.every((b) => b[6] === '#c8323a')).toBe(true);
    expect(berries.filter((b) => b[1] + b[4] > 0.85)).toHaveLength(3); // vorn
    expect(berries.filter((b) => b[2] > 0.6)).toHaveLength(2); // oben
    expect(bushBoxes(0, 0, 0, false).filter((b) => b[8] !== 'see')).toEqual([]);
  });
});

describe('mix', () => {
  it('mischt zwei Farben', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#3f9a3c', '#3f9a3c', 0.7)).toBe('#3f9a3c');
    expect(mix('#102030', '#ffffff', 0)).toBe('#102030');
  });
});
