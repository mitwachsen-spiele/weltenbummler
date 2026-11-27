import { describe, expect, it } from 'vitest';
import { BEATS, VOX, parts, type Vox } from './mitwachsen-gate-kit';
import { SIGN_AT, build, giantOf, motion, motionVox, pilzVox, plate } from './mitwachsen-gate-pilze';
import { giantBoxes, type GateBox } from './mitwachsen-gate-flora';
import { checkPlate } from './test-plates';
import { GLOW } from '../../data/games/mitwachsen-portals';

const CAMS = [
  [0, 1],
  [1, 0],
  [-1, 0],
  [0, -1],
] as const;
const STEPS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

/** alle Voxel eines Rasters im Ausschnitt (−56 ≤ i < 56, 0 ≤ j < 72, −80 ≤ k < 8) als (i, j, k), sortiert nach k, j, i */
function cells(v: Vox) {
  // Die gesetzten Voxel durchgehen statt den ganzen Raum Zelle für Zelle mit `has` abzufragen (700 000 Aufrufe je
  // Raster, das lief auf langsamen CI-Rechnern mit Abdeckung in die Zeitgrenze)
  return [...v.voxels()]
    .filter(({ i, j, k }) => i >= -56 && i < 56 && j >= 0 && j < 72 && k >= -80 && k < 8)
    .sort((a, b) => a.k - b.k || a.j - b.j || a.i - b.i)
    .map(({ i, j, k }): [number, number, number] => [i, j, k]);
}
/**
 * Raster je Lage, Öffnung (und Takt) nur einmal bauen und in allen Tests nutzen: Die Tests fragen dieselben Raster
 * mehrfach ab, das Bauen kostete mit Abdeckung auf langsamen CI-Rechnern zu viel Zeit
 */
const memo = new Map<string, Vox>();
const once = (key: string, make: () => Vox) => memo.get(key) ?? memo.set(key, make()).get(key)!;
type Cam = (typeof CAMS)[number];
const solidOf = (cam: Cam, open: number) => once(`fest ${cam.join()} ${open}`, () => pilzVox({ open, cam }));
const movingOf = (cam: Cam, open: number, beat: number) =>
  once(`bewegt ${cam.join()} ${open} ${beat}`, () => motionVox({ open, cam }, beat));

/** Voxel, die offen im Durchgang (|x| ≤ 2,4) unter 3 Feldern Höhe liegen */
const blocking = (v: Vox) => cells(v).filter(([i, j]) => Math.abs((i + 0.5) / VOX) <= 2.45 && j < 3 * VOX);

/** größtes z aller Flächen */
function maxZ(p: ReturnType<typeof parts>) {
  let z = -Infinity;
  for (const g of Object.values(p)) {
    if (g.empty) continue;
    const pos = g.build().getAttribute('position').array;
    for (let n = 2; n < pos.length; n += 3) z = Math.max(z, pos[n]!);
  }
  return z;
}

describe('Zugang zum Pilzwald: das verwachsene Pilztor', () => {
  // Fest und bewegt in eigenen Tests je Lage: Flächen mit `emit` zu erzeugen ist teuer, alle Lagen in einem Test lief
  // auf langsamen CI-Rechnern mit Abdeckung in die Zeitgrenze
  describe.each(CAMS.map((cam) => ({ cam, at: cam.join(', ') })))('Kamera bei $at', ({ cam }) => {
    it('nichts liegt in der Bucht (z > 0,5): das feste Raster in keinem Zustand', () => {
      for (const open of STEPS) {
        const p = parts();
        build(p, { open, cam, outline: false, lit: 0 });
        expect(maxZ(p), `offen ${open}`).toBeLessThanOrEqual(0.505);
      }
    });

    it('nichts liegt in der Bucht (z > 0,5): die bewegten Ranken in keinem Zustand', () => {
      for (const open of STEPS)
        for (const beat of [0, 5, 11]) {
          const m = parts();
          motion(m, { open, cam, outline: false, lit: 0 }, beat);
          expect(maxZ(m), `offen ${open}, Takt ${beat}`).toBeLessThanOrEqual(0.505);
        }
    });
  });

  it('zu ist der Durchgang dicht verwachsen, in drei Lagen hintereinander (auch von der Seite sieht man es)', () => {
    for (const cam of CAMS)
      for (const beat of [0, 8]) {
        const inGap = [...cells(solidOf(cam, 0)), ...cells(movingOf(cam, 0, beat))].filter(
          ([i, j]) => Math.abs((i + 0.5) / VOX) < 2.4 && j < 3 * VOX,
        );
        expect(inGap.length).toBeGreaterThan(700);
        // Tiefe: vorn (z > 0), Mitte (−1 … 0) und hinten (z < −1) ist etwas
        for (const [k0, k1] of [
          [0, 4],
          [-8, 0],
          [-16, -8],
        ])
          expect(inGap.filter(([, , k]) => k >= k0! && k < k1!).length).toBeGreaterThan(80);
      }
  });

  it('offen ist der Durchgang bis 3 hoch frei, fest und in jedem Takt', () => {
    for (const cam of CAMS) {
      expect(blocking(solidOf(cam, 1))).toEqual([]);
      for (let beat = 0; beat < BEATS; beat++) expect(blocking(movingOf(cam, 1, beat))).toEqual([]);
    }
  });

  it('bleibt unter der Voxel-Grenze: fest höchstens 6000, bewegt höchstens 1500 je Takt', () => {
    for (const cam of CAMS)
      for (const open of STEPS) {
        expect(solidOf(cam, open).size).toBeLessThanOrEqual(6000);
        for (let beat = 0; beat < BEATS; beat++) expect(movingOf(cam, open, beat).size).toBeLessThanOrEqual(1500);
      }
  });

  it('bewegte Voxel liegen nie in einer Zelle des festen Rasters (alle Lagen, zu, halb, offen, jeder Takt)', () => {
    for (const cam of CAMS)
      for (const open of [0, 0.5, 1]) {
        const solid = solidOf(cam, open);
        for (let beat = 0; beat < BEATS; beat++)
          expect(cells(movingOf(cam, open, beat)).filter(([i, j, k]) => solid.has(i, j, k))).toEqual([]);
      }
  });

  it('die Bewegung ist eine Schleife: Takt 16 ist Takt 0, und sie bewegt sich wirklich', () => {
    for (const cam of CAMS) {
      const at = (beat: number) => cells(movingOf(cam, 0, beat)).join(';');
      expect(at(BEATS)).toEqual(at(0));
      expect(at(-1)).toEqual(at(BEATS - 1));
      expect(at(BEATS / 2)).not.toEqual(at(0));
    }
  });

  it('wiegt sich ruhig: von Takt zu Takt ändert sich nur ein kleiner Teil der Ranken', () => {
    for (let beat = 0; beat < BEATS; beat++) {
      const a = new Set(cells(movingOf(CAMS[0], 0, beat)).map((c) => c.join()));
      const b = cells(movingOf(CAMS[0], 0, beat + 1)).map((c) => c.join());
      expect(b.filter((c) => !a.has(c)).length / b.length).toBeLessThan(0.35);
    }
  });

  it('das Schild schaut zur Kamera: flach quer zur Blickrichtung, nur wenn der Zugang nicht hinten liegt', () => {
    expect(cells(solidOf(CAMS[0], 0)).filter(([i, j]) => Math.abs(i) >= 44 && j < 17)).toEqual([]);
    for (const cam of CAMS.filter((c) => c[1] <= 0)) {
      const v = solidOf(cam, 0);
      // Mitte der obersten Schildreihe (Holzrahmen) liegt bei (±5,75, −0,625); seitlich davon geht es weiter
      const [ci, ck] = [Math.round((cam[0] < 0 ? -1 : 1) * SIGN_AT.x * VOX), Math.round(SIGN_AT.z * VOX)];
      const j = 5 + 11;
      expect(v.has(ci + cam[1] * 5, j, ck - cam[0] * 5)).toBe(true);
      expect(v.has(ci - cam[0], j, ck - cam[1])).toBe(false);
    }
  });
});

describe('Torplatte vor dem Zugang (pilze)', () => {
  it('flacher Pilzhut, der von unten glimmt (eine leuchtende Lage darunter, sinkt darum zwei Voxel ein, die Füße stecken nicht darin); flackert nicht, liegt in der Bucht, höchstens so viele Voxel', () => {
    expect(checkPlate('pilze', plate)).toBeLessThanOrEqual(352);
    expect([plate.under, plate.deep, plate.bob]).toEqual(['F', true, undefined]);
    expect(GLOW.has('F')).toBe(true);
  });
});

/** Voxel aus `all`, die von `seeds` aus über Nachbarn (auch über Kanten und Ecken) nicht zu erreichen sind */
function unreached(all: readonly (readonly number[])[], seeds: readonly (readonly number[])[]): string[] {
  const key = (c: readonly number[]) => c.join();
  const left = new Map(all.map((c) => [key(c), c]));
  const queue = [...seeds];
  for (const c of seeds) left.delete(key(c));
  const near = [-1, 0, 1].flatMap((a) => [-1, 0, 1].flatMap((b) => [-1, 0, 1].map((c) => [a, b, c] as const)));
  while (queue.length) {
    const [i = 0, j = 0, k = 0] = queue.pop()!;
    for (const [a, b, c] of near) {
      const n = left.get(key([i + a, j + b, k + c]));
      if (n && left.delete(key(n))) queue.push(n);
    }
  }
  return [...left.keys()];
}

describe('Ranken an den feinen Riesenpilzen', () => {
  /** Voxel (i, j, k) berührt den Quader oder greift in ihn hinein */
  const touches = ([i, j, k]: readonly number[], [x, y, z, w, h, d]: GateBox) =>
    [
      [i!, x, w],
      [j!, y, h],
      [k!, z, d],
    ].every(([n, lo, size]) => n! / VOX <= lo! + size! + 0.005 && (n! + 1) / VOX >= lo! - 0.005);
  for (const open of [0, 0.5, 1])
    it(`die Ranke um den Stiel hängt am Stiel: kein Voxel schwebt (offen ${open})`, () => {
      const v = pilzVox({ open, cam: [0, 1], all: true });
      for (const side of [-1, 1]) {
        const giant = giantOf(side, open);
        const stem = giantBoxes(giant).filter((b) => b[8].skin === 'haar');
        // das Band um den Stiel: über dem Sockel, unter dem Hut, nah an der Achse
        const band = cells(v).filter(
          ([i, j, k]) => j >= 9 && j <= 22 && Math.hypot((i + 0.5) / VOX - giant.x, (k + 0.5) / VOX - giant.z) < 1.5,
        );
        expect(band.length).toBeGreaterThan(50);
        const seeds = band.filter((c) => stem.some((b) => touches(c, b)));
        const left = unreached(band, seeds);
        expect(left, `Seite ${side}`).toEqual([]);
      }
    });
});
