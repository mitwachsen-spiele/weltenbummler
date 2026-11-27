// Feinheit der Grubenbahn (Entwurf „Feine Grafik“, Issue 13): Funkel aus Lack und Metall mit Radnaben und Nieten, Lampe
// und Lichter leuchten nur, wenn sie an sind; das schmale Gleis mit Holz-Schwellen und Metall-Schienen (auch das gelegte
// beim Graben); Bahnsteig aus Holz; Klingeltore mit Metall-Bändern und Nieten, klingende Röhren und Kristalle der
// Glitzerwelle leuchten; Kristallkrümel im Erdhügel leuchten. Zusatzteile stecken in nichts und bleiben am Modell.
import { describe, expect, it } from 'vitest';
import type { Part } from '../../../../lib/games/front';
import { MOUND_PARTS, DIG_COLORS } from '../../../../data/games/worlds/grube/mitwachsen-dig-model';
import {
  FENCE_CRYSTAL,
  FUNKEL_COLORS,
  HALT_COLORS,
  HALT_SIGN,
  PLANK,
  funkelParts,
  type FunkelLook,
} from '../../../../data/games/worlds/grube/mitwachsen-funkel-model';
import {
  DISC_PARTS,
  GANG_COLORS,
  crystalParts,
  gateParts,
} from '../../../../data/games/worlds/grube/mitwachsen-gang-model';
import { laidParts } from './mitwachsen-dig-look';
import { grubeRails, railShape } from './mitwachsen-funkel-look';
import type { Cell } from '../../mitwachsen-cell';

const halos = (parts: readonly Part[]) => parts.filter((p) => p[9]?.halo);
const skinOf = (p: Part) => p[9]?.skin;
/** Lage und Größe eines Teils je Achse (vorn, rechts, unten) */
const lo = (p: Part): readonly number[] => [p[0], p[1], p[2]];
const size = (p: Part): readonly number[] => [p[3], p[4], p[5]];
/** Überlappung zweier Teile je Achse (negativ: Abstand) */
const overlap = (a: Part, b: Part) =>
  [0, 1, 2].map((i) => Math.min(lo(a)[i]! + size(a)[i]!, lo(b)[i]! + size(b)[i]!) - Math.max(lo(a)[i]!, lo(b)[i]!));
/** Gemeinsamer Rauminhalt zweier Teile */
const shared = (a: Part, b: Part) => overlap(a, b).reduce((v, o) => v * Math.max(0, o), 1);
/** Berühren sich zwei Teile (Abstand höchstens 1e-6 auf jeder Achse)? */
const touching = (a: Part, b: Part) => overlap(a, b).every((o) => o >= -1e-6);
/** Zusatzteile, die in einem anderen Teil stecken (je Treffer beide Teile) */
const inside = (parts: readonly Part[], extra: (p: Part) => boolean) =>
  parts.flatMap((p, i) =>
    extra(p)
      ? parts
          .filter((q, j) => j !== i && shared(p, q) > 1e-6)
          .map((q) => `${JSON.stringify(p)} in ${JSON.stringify(q)}`)
      : [],
  );
/** Hülle eines Modells: kleinste und größte Lage je Achse */
const hull = (parts: readonly Part[]) =>
  [0, 1, 2].map((i) => [
    Math.min(...parts.map((p) => lo(p)[i]!)),
    Math.max(...parts.map((p) => lo(p)[i]! + size(p)[i]!)),
  ]);

const LOOKS: readonly FunkelLook[] = [
  { kind: 'loco' },
  { kind: 'loco', lit: true },
  { kind: 'seat' },
  { kind: 'seat', rider: true, door: 1, frame: 1 },
  { kind: 'seat', door: -1, frame: -1 },
  { kind: 'rear', lights: 0 },
  { kind: 'rear', lights: 3 },
];
const DETAIL = new Set<string>([FUNKEL_COLORS.hub, FUNKEL_COLORS.rivet]);

describe('Funkel fein', () => {
  it('Kasten und Dach aus Lack, Räder, Rahmen und Schornstein aus Metall', () => {
    for (const look of LOOKS) {
      const parts = funkelParts(look);
      const by = (colors: readonly string[]) => parts.filter((p) => colors.includes(p[6]));
      expect(by([...FUNKEL_COLORS.petrol, ...FUNKEL_COLORS.cream]).every((p) => skinOf(p) === 'lack')).toBe(true);
      expect(by([FUNKEL_COLORS.wheel, FUNKEL_COLORS.frame]).every((p) => skinOf(p) === 'metall')).toBe(true);
      expect(by([FUNKEL_COLORS.wheel])).toHaveLength(4);
    }
  });

  it('die Lampe leuchtet nur an, die Lichter auf dem Dach nur, so viele an sind; der Sitzwagen leuchtet nicht', () => {
    expect(halos(funkelParts({ kind: 'loco' }))).toHaveLength(0);
    const lit = halos(funkelParts({ kind: 'loco', lit: true }));
    expect(lit.map((p) => p[6])).toEqual([FUNKEL_COLORS.glow]);
    for (const n of [0, 1, 2, 3, 4]) {
      const h = halos(funkelParts({ kind: 'rear', lights: n }));
      expect(h).toHaveLength(n);
      expect(h.every((p) => p[6] === FENCE_CRYSTAL)).toBe(true);
    }
    expect(halos(funkelParts({ kind: 'seat', rider: true, door: 1, frame: 1 }))).toHaveLength(0);
  });

  it('Radnaben und Nieten sitzen außen auf Rad und Kasten, stecken in nichts und bleiben in der Hülle', () => {
    for (const look of LOOKS) {
      const parts = funkelParts(look);
      const details = parts.filter((p) => DETAIL.has(p[6]));
      expect(details.filter((p) => p[6] === FUNKEL_COLORS.hub)).toHaveLength(4);
      expect(details.filter((p) => p[6] === FUNKEL_COLORS.rivet).length).toBeGreaterThanOrEqual(8);
      expect(inside(parts, (p) => DETAIL.has(p[6]))).toEqual([]);
      // jedes Zusatzteil berührt ein anderes Teil (es sitzt auf etwas)
      const touches = (p: Part) => parts.some((q) => q !== p && !DETAIL.has(q[6]) && touching(p, q));
      expect(details.every(touches)).toBe(true);
      const base = hull(parts.filter((p) => !DETAIL.has(p[6])));
      const all = hull(parts);
      all.forEach(([lo, hi], i) => {
        expect(lo).toBeGreaterThanOrEqual(base[i]![0]! - 0.05);
        expect(hi).toBeLessThanOrEqual(base[i]![1]! + 0.05);
      });
    }
  });
});

describe('Gleis und Bahnsteig fein', () => {
  it('Schwellen mit Holz, Schienen mit Metall, in jeder Form; auch auf dem Feld und beim Graben', () => {
    for (const to of ['ns', 'ew', 'en', 'es', 'sw', 'nw']) {
      const shape = railShape(to)!;
      expect(shape.every((b) => (b[2] === 0 ? b[8].skin === 'holz' : b[8].skin === 'metall'))).toBe(true);
      const laid = laidParts(to)!;
      expect(laid.slice(1).map(skinOf)).toEqual(shape.map((b) => b[8].skin));
    }
    const cell = { h: 2, ride: 'grube', lane: { to: 'ns' } } as unknown as Cell;
    const boxes = grubeRails(cell, 3, 4, { packs: {}, reduced: false, work: undefined })!;
    expect(boxes.map((b) => b[9]?.skin)).toEqual(railShape('ns')!.map((b) => b[8].skin));
    expect(boxes.every((b) => b[8] === undefined)).toBe(true);
  });

  it('Planke aus Holz, Tafel aus Lack, vom Kristall der Tafel leuchtet nur die Mitte', () => {
    expect(PLANK.filter((p) => p[6] === HALT_COLORS.plank[0]).map(skinOf)).toEqual(['holz']);
    expect(HALT_SIGN.filter((p) => p[6] === HALT_COLORS.board[0]).map(skinOf)).toEqual(['lack']);
    const lit = halos(HALT_SIGN);
    expect(lit).toHaveLength(1);
    expect(lit[0]![6]).toBe(FENCE_CRYSTAL);
  });
});

describe('Glitzergang fein', () => {
  it('Klingeltor: Bänder rundum die Pfosten, Nieten vorn und hinten aus Metall, sie stecken in nichts; klingend leuchten die fünf Röhren', () => {
    for (const ringing of [false, true]) {
      const parts = gateParts(ringing);
      const metal = parts.filter((p) => p[6] === GANG_COLORS.metal);
      expect(metal.length).toBe(24);
      expect(metal.every((p) => skinOf(p) === 'metall')).toBe(true);
      const [faces, sides] = [metal.filter((p) => p[3] === 0.006), metal.filter((p) => p[4] === 0.006)];
      expect(faces.filter((p) => p[0] > 0).length).toBe(faces.length / 2); // vorn und hinten gleich viele
      expect(faces.length + sides.length).toBe(24);
      // je Pfosten und Band beide Seiten (außen und innen), damit man es auch von der Seite sieht
      const posts = parts.slice(0, 2);
      for (const post of posts) {
        const at = sides.filter((p) => touching(p, post));
        expect(at.length).toBe(4);
        expect(new Set(at.map((p) => p[1] < post[1]))).toEqual(new Set([true, false]));
      }
      expect(inside(parts, (p) => p[6] === GANG_COLORS.metal)).toEqual([]);
      const tube = ringing ? GANG_COLORS.ring[0] : GANG_COLORS.tube[0];
      expect(halos(parts).length).toBe(ringing ? 5 : 0);
      expect(halos(parts).every((p) => p[6] === tube)).toBe(true);
    }
  });

  it('Wandkristall: Lichtkante knapp vor der großen Spitze; in der Glitzerwelle leuchtet die große Spitze', () => {
    for (const lit of [false, true]) {
      const parts = crystalParts(lit);
      const edge = parts.find((p) => p[6] === GANG_COLORS.edge)!;
      const spike = parts.reduce((a, b) => (b[5] > a[5] ? b : a));
      const gap = edge[0] - (spike[0] + spike[3]);
      expect(gap).toBeGreaterThan(0.002);
      expect(gap).toBeLessThan(0.01);
      expect(edge[1]).toBeGreaterThanOrEqual(spike[1]);
      expect(edge[1] + edge[4]).toBeLessThanOrEqual(spike[1] + spike[4]);
      expect(edge[2] + edge[5]).toBeLessThanOrEqual(spike[2] + spike[5]);
      expect(inside(parts, (p) => p === edge)).toEqual([]);
      expect(halos(parts)).toEqual(lit ? [spike] : []);
    }
  });

  it('Scheibe aus Lack; Erdhügel: nur die zwei Kristallkrümel leuchten', () => {
    expect(DISC_PARTS.every((p) => skinOf(p) === 'lack')).toBe(true);
    const lit = halos(MOUND_PARTS);
    expect(lit).toHaveLength(2);
    expect(lit.every((p) => p[6] === DIG_COLORS.crystal[0])).toBe(true);
  });
});
