// Pflanzen in den Torhäusern als feine Modelle (Entwurf „Feine Grafik“, Paket P7b): an derselben Stelle und in derselben
// Größe wie vorher die Voxel, schmaler Stamm, Krone in Stufen mit Muster; nichts in der Bucht, der Durchgang bleibt frei,
// keine zwei Flächen in einer Ebene
import { describe, expect, it } from 'vitest';
import {
  FIR_TIERS,
  GIANT,
  GROW,
  frondY,
  firBoxes,
  giantBoxes,
  glowColors,
  glowTreeBoxes,
  growOf,
  leafBox,
  octagon,
  octagonReach,
  PINNA,
  palmBoxes,
  spread,
  stemPieceRadius,
  stemRadius,
  tint,
  type GateBox,
} from './mitwachsen-gate-flora';
import { PALMS } from './mitwachsen-gate-sand';
import { treeAt, treeLit } from './mitwachsen-gate-lava';

const top = (b: GateBox) => b[1] + b[4];
const far = (b: GateBox) => b[2] + b[5];
/** Paare von Flächen in derselben Ebene, gleicher Richtung, die sich überdecken (Flackern) */
function clashes(boxes: readonly GateBox[]): string[] {
  type F = { k: string; at: number; u: [number, number]; w: [number, number]; n: number };
  const faces: F[] = boxes.flatMap(([x, y, z, w, h, d], n) => {
    const lo = [x, y, z],
      hi = [x + w, y + h, z + d];
    return [0, 1, 2].flatMap((a) => {
      const [u, v] = [0, 1, 2].filter((k) => k !== a) as [number, number];
      const span = (k: number): [number, number] => [lo[k]!, hi[k]!];
      return [
        { k: `${a}-`, at: lo[a]!, u: span(u), w: span(v), n },
        { k: `${a}+`, at: hi[a]!, u: span(u), w: span(v), n },
      ];
    });
  });
  const out: string[] = [];
  for (let i = 0; i < faces.length; i++)
    for (let j = i + 1; j < faces.length; j++) {
      const [a, b] = [faces[i]!, faces[j]!];
      if (a.n === b.n || a.k !== b.k || Math.abs(a.at - b.at) > 1e-4) continue;
      const du = Math.min(a.u[1], b.u[1]) - Math.max(a.u[0], b.u[0]);
      const dw = Math.min(a.w[1], b.w[1]) - Math.max(a.w[0], b.w[0]);
      if (du > 1e-3 && dw > 1e-3) out.push(`${a.n}/${b.n} ${a.k}`);
    }
  return out;
}

describe('Feine Pflanzen der Torhäuser: Bausteine', () => {
  it('spread: jeder Quader wächst um seinen eigenen kleinen Betrag, nie auf ein Achtel ± 0,004 (Voxel des Torhauses)', () => {
    const b: GateBox = [1, 2, 3, 0.5, 0.5, 0.5, '#000000', '#000000', {}];
    const out = spread([b, b, b]);
    expect(out.map((o) => o[0])).toEqual([1 - growOf(0), 1 - growOf(1), 1 - growOf(2)]);
    expect(clashes(out)).toEqual([]);
    for (let n = 0; n < GROW.cycle; n++) {
      expect(growOf(n)).toBeLessThan(0.008);
      expect(Math.abs(growOf(n) - 0.004)).toBeGreaterThan(1.5e-4);
    }
  });

  it('Achteck: drei Quader, jede Ecke in der Ellipse, keine zwei Flächen in einer Ebene', () => {
    const o = octagon(1, 2, 0.8, 0.5, 0, 1, '#000000', '#000000', {});
    expect(o).toHaveLength(3);
    for (const [x, , z, w, , d] of o)
      for (const [cx, cz] of [
        [x, z],
        [x + w, z + d],
      ])
        expect(((cx! - 1) / 0.8) ** 2 + ((cz! - 2) / 0.5) ** 2).toBeLessThanOrEqual(1 + 1e-9);
    expect(clashes(o)).toEqual([]);
  });

  it('Achteck: `octagonReach` trifft die Oberfläche (auf den Achsen cos 22,5°, an den Ecken 1)', () => {
    const o = octagon(0, 0, 1, 1, 0, 1, '#000000', '#000000', {});
    const inside = (x: number, z: number) =>
      o.some(([bx, , bz, w, , d]) => x > bx && x < bx + w && z > bz && z < bz + d);
    for (let n = 0; n < 64; n++) {
      const f = (n / 64) * 2 * Math.PI;
      const r = octagonReach(f);
      expect(inside(0.999 * r * Math.cos(f), 0.999 * r * Math.sin(f))).toBe(true);
      expect(inside(1.001 * r * Math.cos(f), 1.001 * r * Math.sin(f))).toBe(false);
    }
    expect(octagonReach(0)).toBeCloseTo(Math.cos(Math.PI / 8), 9);
    expect(octagonReach(Math.PI / 2)).toBeCloseTo(Math.cos(Math.PI / 8), 9);
    expect(octagonReach(Math.PI / 8)).toBeCloseTo(1, 9);
  });

  it('Farben mischen', () => {
    expect(tint('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(tint('#102030', '#102030', 0.3)).toBe('#102030');
  });
});

describe('Palmen am Sandtor', () => {
  for (const palm of PALMS)
    it(`Palme bei x ${palm.x}: schmaler Stamm vom Boden bis zur Krone, Wedel bis 1,5 Felder, nichts in der Bucht`, () => {
      const boxes = spread(palmBoxes(palm));
      const trunk = boxes.filter((b) => b[8].skin === 'holz');
      expect(trunk.length).toBe(Math.ceil(palm.h / 0.45));
      expect(Math.min(...trunk.map((b) => b[1]))).toBeLessThan(0);
      expect(Math.max(...trunk.map(top))).toBeCloseTo(palm.h, 1);
      for (const b of trunk) expect(b[3]).toBeLessThan(0.3);
      // neigt sich nach außen wie vorher
      const [low, high] = [trunk[0]!, trunk.at(-1)!];
      expect(Math.sign(high[0] - low[0])).toBe(Math.sign(palm.lean));
      const fronds = boxes.filter((b) => b[8].skin === 'nadel');
      const cx = palm.x + palm.lean;
      const reach = Math.max(...fronds.map((b) => Math.hypot(b[0] + b[3] / 2 - cx, b[2] + b[5] / 2 - palm.z)));
      expect(reach).toBeGreaterThan(1.3);
      expect(reach).toBeLessThan(1.55);
      expect(Math.max(...boxes.map(top))).toBeLessThan(palm.h + 0.6);
      expect(Math.min(...fronds.map((b) => b[1]))).toBeCloseTo(palm.h + frondY(1.5), 1); // die Spitzen hängen
      expect(Math.max(...boxes.map(far))).toBeLessThan(0.5);
      expect(clashes(boxes)).toEqual([]);
    });

  /** Zwei Quader berühren sich oder greifen ineinander (in jeder Achse) */
  const touch = (a: GateBox, b: GateBox) =>
    (
      [
        [0, 3],
        [1, 4],
        [2, 5],
      ] as const
    ).every(([k, n]) => a[k] <= b[k] + b[n] + 1e-9 && b[k] <= a[k] + a[n] + 1e-9);
  for (const palm of PALMS)
    it(`Palme bei x ${palm.x}: Wedel ohne Lücken, jede Fieder hängt am Stiel (keine schwebenden Klötze)`, () => {
      const boxes = palmBoxes(palm);
      const fronds = boxes.filter((b) => b[8].skin === 'nadel').slice(1); // ohne Schopf
      const pinnae = fronds.filter((b) => b[4] < 0.06 && b[3] === 2 * PINNA.half); // flach, eigene Breite
      const stalk = fronds.filter((b) => !pinnae.includes(b));
      expect(stalk).toHaveLength(36);
      expect(pinnae).toHaveLength(24);
      for (let f = 0; f < 6; f++)
        for (let s = 1; s < 6; s++) expect(touch(stalk[f * 6 + s - 1]!, stalk[f * 6 + s]!)).toBe(true);
      for (const p of pinnae) expect(stalk.some((b) => touch(p, b))).toBe(true);
    });
});

describe('Glutbaum am Lavator', () => {
  for (const cam of [
    [0, 1],
    [0, -1],
  ] as const)
    it(`Stamm mit Rinde, Riss leuchtet vor der Rinde, Krone über dem Ring (Kamera ${cam.join(',')})`, () => {
      const t = treeAt(cam);
      const { solid, bright } = glowTreeBoxes(t, treeLit(0));
      expect(solid).toHaveLength(1);
      const [trunk] = spread(solid) as [GateBox];
      expect(trunk[8].skin).toBe('rinde');
      const cracks = spread(bright).filter((b) => b[6] === glowColors(0.75).crack);
      expect(cracks.length).toBeGreaterThanOrEqual(8);
      // jedes Rissstück ragt aus der Rinde heraus
      for (const c of cracks) {
        const out = c[2] + c[5] > far(trunk) || c[2] < trunk[2] || c[0] + c[3] > trunk[0] + trunk[3] || c[0] < trunk[0];
        expect(out).toBe(true);
      }
      const crown = bright.filter((b) => b[8].skin === 'blatt');
      expect(crown).toHaveLength(27); // drei Ballen, je drei Lagen, je ein Achteck
      expect(Math.max(...crown.map(top))).toBeGreaterThan(6.5);
      expect(Math.max(...[...solid, ...bright].map(far))).toBeLessThan(0.5);
      expect(clashes(spread(bright))).toEqual([]);
    });

  it('glüht heller, sobald der Weg frei ist', () => {
    expect(treeLit(0)).toBe(0.75);
    expect(treeLit(1)).toBe(1);
    expect(glowColors(1).base).not.toBe(glowColors(0.75).base);
  });
});

describe('Tannen und Laub am Spechtbaum', () => {
  it('Tanne: schmaler Stamm (Rinde), vier Stufen Nadeln wie vorher', () => {
    const s = 1.1;
    const [trunk, ...tiers] = firBoxes(-5.6, -1.4, s);
    expect(trunk![3]).toBeCloseTo(0.2 * s, 9);
    expect(trunk![8].skin).toBe('rinde');
    expect(tiers).toHaveLength(FIR_TIERS.length);
    tiers.forEach((b, i) => {
      const [w, a, c] = FIR_TIERS[i]!;
      expect(b[3]).toBeCloseTo(2 * w * s, 9);
      expect(b[1]).toBeCloseTo(a * s, 9);
      expect(top(b)).toBeCloseTo(c * s, 9);
      expect(b[8].skin).toBe('nadel');
    });
    expect(clashes(spread(firBoxes(0, 0, 1)))).toEqual([]);
  });

  it('Laub: Quader von Ecke zu Gegenecke mit Blatt-Muster', () => {
    expect(leafBox(0, 1, 2, 1, 3, 2.5, '#111111', '#222222')).toEqual([
      0,
      1,
      2,
      1,
      2,
      0.5,
      '#111111',
      '#222222',
      { skin: 'blatt' },
    ]);
  });
});

describe('Riesenpilze am Pilztor', () => {
  const g = { x: 3.5, z: -0.75, hatZ: -0.95, hatY: 3.32 };
  const boxes = spread(giantBoxes(g));
  const hat = boxes.filter((b) => b[8].skin === 'lack');
  const stem = boxes.filter((b) => b[8].skin === 'haar');

  it('der Durchgang bleibt frei (|x| < 2,5 bis 3 hoch), nichts in der Bucht, ein Pilz bleibt auf seiner Seite', () => {
    for (const b of boxes) if (b[1] < 3) expect(b[0]).toBeGreaterThanOrEqual(2.5);
    expect(Math.max(...boxes.map(far))).toBeLessThan(0.5);
    expect(Math.min(...boxes.map((b) => b[0]))).toBeGreaterThan(1.2);
    expect(clashes(boxes)).toEqual([]);
  });

  it('Hut in fünf Lagen innerhalb der Ellipse von vorher (die Ranken am Hutrand bleiben außen), Stiel im Fass', () => {
    expect(hat).toHaveLength(15);
    const { r1, r2, h } = GIANT.hat;
    for (const [x, , z, w, , d] of hat)
      for (const [cx, cz] of [
        [x, z],
        [x + w, z + d],
      ])
        expect(((cx! - g.x) / r1) ** 2 + ((cz! - g.hatZ) / r2) ** 2).toBeLessThanOrEqual(1.01);
    expect(Math.max(...hat.map(top))).toBeCloseTo(g.hatY + h, 2);
    expect(stem).toHaveLength(12);
    for (const b of stem) {
      const r = stemRadius(top(b));
      expect(Math.hypot(b[0] - g.x, b[2] - g.z)).toBeLessThanOrEqual(r + 0.01);
    }
    expect(Math.min(...stem.map((b) => b[1]))).toBeLessThan(0);
    expect(Math.max(...stem.map(top))).toBeGreaterThan(g.hatY);
  });

  it('Radius des Stiel-Stücks: am oberen Ende jedes Stücks (bis knapp in die Lamellen)', () => {
    expect(stemPieceRadius(0.5, g.hatY)).toBe(stemRadius(1));
    expect(stemPieceRadius(1.75, g.hatY)).toBe(stemRadius(2));
    expect(stemPieceRadius(3.1, g.hatY)).toBe(stemRadius(g.hatY + 0.06));
    expect(stemPieceRadius(-0.2, g.hatY)).toBe(stemRadius(1));
  });

  it('Tupfen liegen obenauf auf einer Stufe, frei (nicht unter der Lage darüber)', () => {
    const spots = boxes.filter((b) => b[6] === GIANT.colors.spot);
    expect(spots.length).toBe(6);
    for (const s of spots) {
      const [mx, mz] = [s[0] + s[3] / 2, s[2] + s[5] / 2];
      const under = hat.filter((b) => mx > b[0] && mx < b[0] + b[3] && mz > b[2] && mz < b[2] + b[5]);
      expect(under.some((b) => Math.abs(top(b) - s[1]) < 0.016)).toBe(true); // beide wachsen (`spread`)
      expect(under.some((b) => top(b) > s[1] + 0.02)).toBe(false);
    }
  });
});
