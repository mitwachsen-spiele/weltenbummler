// Kristallfackeln an den Wegen der Grotte (Issue 31): Lage über die Seeds, nie im Weg, als Kette zu lesen
import { describe, expect, it } from 'vitest';
import { GROTTE, GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { HOEHLE_PACK, SAMPLE_SEEDS, reachable, seedsFor, seedRange, worldOf } from '../../test-worlds';
import { caveBoxes } from './mitwachsen-cave-look';
import { caveFrame } from './mitwachsen-frame';
import { torchPlan, torchesOf } from './mitwachsen-torch';

const T = GROTTE.torch;
const key = (x: number, y: number) => `${x},${y}`;

describe('Kristallfackeln: Plan', () => {
  it('Paare links und rechts des Wegs durch die Mitte, vom Lampengang bis vor den See, dazu Abzweige zu Halle und Pilzgarten; nie auf dem Weg', () => {
    const plan = torchPlan();
    const pairs = plan.filter(([u]) => Math.abs(u) === T.side);
    expect(pairs.length).toBeGreaterThanOrEqual(20);
    expect(pairs.length % 2).toBe(0);
    expect(Math.min(...pairs.map(([, o]) => o))).toBe(GROTTE.lamps.to + T.every);
    expect(Math.max(...pairs.map(([, o]) => o))).toBeLessThanOrEqual(GROTTE.lake.out - GROTTE.lake.ry - T.shore);
    for (const [u] of plan) expect(Math.abs(u)).toBeGreaterThan(3); // der Weg durch die Mitte reicht bis ±3
    const hall = plan.filter(([u, o]) => u > T.side && o === GROTTE.hall.out - 2);
    const garden = plan.filter(([u, o]) => u < -T.side && o === GROTTE.garden.out - 2);
    expect(hall.length).toBeGreaterThanOrEqual(2);
    expect(garden.length).toBeGreaterThanOrEqual(2);
    expect(hall.length + garden.length + pairs.length).toBe(plan.length);
    expect(new Set(plan.map(([u, o]) => key(u, o))).size).toBe(plan.length);
  });
});

describe('Kristallfackeln: in der Welt', () => {
  it.each(seedsFor(seedRange(1, 8)))(
    'Seed %i: genug Fackeln, jede frei umgehbar, keine im Weg, eine Kette entlang der Mitte',
    (seed) => {
      const w = worldOf(seed, [HOEHLE_PACK]);
      const frame = caveFrame(w)!;
      const torches = torchesOf(w);
      expect(torches.length).toBeGreaterThanOrEqual(16);
      expect(torches.length).toBeLessThanOrEqual(torchPlan().length);
      const bed = w.homes.hoehle.bed;
      const reach = new Set(reachable(w, ['eis', 'hoehle'], w.homes.hoehle.wake[0]!).map(([x, y]) => key(x, y)));
      for (const [x, y] of torches) {
        const c = w.cell(x, y);
        expect([c.deco, c.solid, c.region]).toEqual(['torch', true, 'hoehle']);
        expect(GROTTE_COLORS.crystals as readonly string[]).toContain(c.color);
        // ringsum frei und gleich hoch: Man kommt immer um sie herum, und sie schneidet keinen Weg ab
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const n = w.cell(x + dx, y + dy);
            expect([n.solid, n.ground, n.h], `Seed ${seed} ${key(x, y)}`).toEqual([false, 'grotto', c.h]);
            expect(n.lane, `Seed ${seed} Schleife neben ${key(x, y)}`).toBeUndefined();
            expect(reach.has(key(x + dx, y + dy)), `Seed ${seed} ${key(x + dx, y + dy)} erreichbar`).toBe(true);
          }
        expect(c.garden || c.stop || c.lane || c.portal).toBeFalsy();
        expect(Math.hypot(x - bed[0], y - bed[1])).toBeGreaterThan(GROTTE.flat);
      }
      // Kette: Auf dem Weg durch die Mitte folgt spätestens nach gut drei Abständen die nächste Fackel (auf einer der
      // Seiten; am Höhlenbett fehlen zwei Paare, dort leuchtet die Wiese)
      const outs = [...new Set(torches.map(([x, y]) => frame.out(x, y)))].sort((a, b) => a - b);
      const along = outs.filter((o) => torchPlan().some(([u, po]) => Math.abs(u) === T.side && Math.abs(po - o) <= 2));
      for (let i = 1; i < along.length; i++)
        expect(along[i]! - along[i - 1]!, `Seed ${seed}`).toBeLessThanOrEqual(3 * T.every + 4);
      // kein Tier wohnt auf einer Fackel
      const spawns = new Set([...w.spawns.values()].map(([x, y]) => key(x, y)));
      expect(torches.filter(([x, y]) => spawns.has(key(x, y)))).toEqual([]);
      expect(torchesOf(w)).toBe(torches); // je Welt einmal
    },
  );

  it('ohne Grotte keine; im Bild ein schmaler Pfosten mit Kristallflamme, höher als die Figur', () => {
    expect(torchesOf(worldOf(SAMPLE_SEEDS[0]!, []))).toEqual([]);
    const w = worldOf(SAMPLE_SEEDS[0]!, [HOEHLE_PACK]);
    const [x, y] = torchesOf(w)[0]!;
    const boxes = caveBoxes(w, w.cell(x, y), x, y)!;
    expect(boxes.length).toBe(9); // Pfosten in drei Stücken mit zwei Ringen dazwischen, drei Stufen Flamme, Lichtkante
    for (const [bx, by, , bw, bd] of boxes) {
      expect(bx).toBeGreaterThanOrEqual(x);
      expect(bx + bw).toBeLessThanOrEqual(x + 1);
      expect(by).toBeGreaterThanOrEqual(y);
      expect(by + bd).toBeLessThanOrEqual(y + 1);
    }
    expect(Math.max(...boxes.map((b) => b[2] + b[5])) - w.cell(x, y).h).toBeGreaterThan(1.5);
    expect(boxes.some((b) => b[6] === w.cell(x, y).color)).toBe(true);
  });
});
