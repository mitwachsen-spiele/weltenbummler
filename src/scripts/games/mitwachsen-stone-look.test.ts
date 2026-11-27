// Klangstein und Wegstein fein (Entwurf „Feine Grafik“, Paket P7): Quader in ihrem Feld, in Malreihenfolge, Muster
// und Leuchten nur, wo sie hingehören; dazu Tür und Beschläge des großen Tors in 2D
import { describe, expect, it, vi } from 'vitest';
import { THEME_COLORS, type GateId } from '../../data/games/mitwachsen';
import { haloCompact } from '../../lib/games/shade';
import {
  paintWith,
  type FaceRect,
  type Fine,
  type FinePainter,
  type HaloAt,
  type Projection,
} from '../../lib/games/front';
import {
  NOTE,
  NOTE_COLORS,
  NOTE_D,
  STONE,
  STONE_COLORS,
  STONE_FOOT,
  drawStone,
  noteBoxes,
  noteHaloId,
  stoneBoxes,
} from './mitwachsen-stone-look';
import { Fine2D } from './mitwachsen-fine-2d';
import { growOf } from './mitwachsen-gate-flora';
import { noteSolid } from './mitwachsen-story-3d';
import { Geo } from './mitwachsen-geo';
import { fineBox } from './mitwachsen-fine-chunk-3d';
import { faces, fightingFaces } from './test-plates';
import { waystoneBoxes } from './mitwachsen-waystone-look';
import { before } from './mitwachsen-row';
import { DOOR, bigGate, type GateRow } from './mitwachsen-gate-look';
import { anyContext } from './test-canvas';
import type { Box } from './mitwachsen-view';

const inside = (b: Box, a: Box) =>
  b[0] >= a[0] - 1e-9 && b[0] + b[3] <= a[0] + a[3] + 1e-9 && b[1] >= a[1] - 1e-9 && b[1] + b[4] <= a[1] + a[4] + 1e-9;
/** Geteilter Rauminhalt zweier Quader */
function shared(a: Box, b: Box) {
  const span = (p: Box) =>
    [
      [p[0], p[0] + p[3]],
      [p[1], p[1] + p[4]],
      [p[2], p[2] + p[5]],
    ] as const;
  const [sa, sb] = [span(a), span(b)];
  return sa.reduce((v, [lo, hi], k) => v * Math.max(0, Math.min(hi, sb[k]![1]) - Math.max(lo, sb[k]![0])), 1);
}
/** Kein späteres Teil muss vor einem früheren gemalt werden */
const painted = (boxes: Box[]) => boxes.every((b, i) => !boxes.slice(i + 1).some((a) => before(a, b)));

describe('Klangstein fein', () => {
  const stone = stoneBoxes(3, 4, 1);

  it('Sockel und Platte wie vorher, alles im eigenen Feld, nichts steckt ineinander, in Malreihenfolge', () => {
    expect(stone[0]!.slice(0, 8)).toEqual([3.14, 4.2, 1, 0.72, 0.6, 0.34, STONE_COLORS.side, STONE_COLORS.top]);
    expect(stone[2]!.slice(0, 6)).toEqual([3.24, 4.28, 1.34, 0.52, 0.44, 0.12]);
    for (const b of stone) {
      expect(b[0]).toBeGreaterThanOrEqual(3);
      expect(b[0] + b[3]).toBeLessThanOrEqual(4);
      expect(b[1]).toBeGreaterThanOrEqual(4);
      expect(b[1] + b[4]).toBeLessThanOrEqual(5);
      expect(b[2]).toBeGreaterThanOrEqual(1);
    }
    for (let i = 0; i < stone.length; i++)
      for (let j = i + 1; j < stone.length; j++) expect(shared(stone[i]!, stone[j]!), `${i}/${j}`).toBeLessThan(1e-6);
    expect(painted(stone)).toBe(true);
  });

  it('Stein ohne Muster (Verlauf und Kante), Moos als Fell, nichts leuchtet; Riss liegt vorn auf dem Sockel, Moos obenauf', () => {
    expect(stone.map((b) => b[9]?.skin ?? null)).toEqual([null, null, null, 'fell', null, null]);
    expect(stone.some((b) => b[9]?.halo)).toBe(false);
    const [base, crack, , moss] = stone as [Box, Box, Box, Box];
    expect(crack[1]).toBeCloseTo(base[1] + base[4], 9);
    expect(inside(moss, base)).toBe(true);
    expect(moss[2]).toBeCloseTo(base[2] + base[5], 9);
  });

  it('Note: Lack, nur der Kopf leuchtet (kompakt), Glanzpunkt vorn auf dem Kopf; Größe wächst um die Mitte', () => {
    for (const scale of [1, 1.15]) {
      const note = noteBoxes(3.5, 4.5, 2, scale);
      expect(note).toHaveLength(NOTE.length + 1);
      expect(note.slice(0, NOTE.length).every((b) => b[9]?.skin === 'lack' && b[6] === NOTE_COLORS.side)).toBe(true);
      const glowing = note.filter((b) => b[9]?.halo);
      expect(glowing).toEqual([note[0]]);
      expect(haloCompact(note[0]![3], note[0]![4], note[0]![5])).toBe(true);
      const [head, glint] = [note[0]!, note.at(-1)!];
      expect(glint[1]).toBeCloseTo(head[1] + NOTE_D, 9); // liegt vorn auf
      expect(glint[0]).toBeGreaterThan(head[0]);
      expect(glint[0] + glint[3]).toBeLessThan(head[0] + head[3]);
      expect(glint[2]).toBeGreaterThan(head[2]);
      expect(glint[2] + glint[5]).toBeLessThan(head[2] + head[5]);
      for (const b of note) {
        expect(b[1]).toBeGreaterThanOrEqual(4.45 - 1e-9);
        expect(b[2]).toBeGreaterThanOrEqual(2);
      }
      expect(note[0]![0]).toBeCloseTo(3.5 + NOTE[0]![0] * scale, 9);
      expect(note[0]![3]).toBeCloseTo(NOTE[0]![2] * scale, 9);
    }
  });
});

describe('Klangstein in 2D', () => {
  it('fein mit dem Maler des Kontexts: Stein und Note, nur der Notenkopf meldet sein Leuchten', () => {
    const ctx = anyContext();
    const halos: HaloAt[] = [];
    const skins: (string | undefined)[] = [];
    paintWith(ctx, { face: (_c, _f, fine) => skins.push(fine?.skin), halo: (h) => halos.push(h) });
    drawStone(ctx, (x, y, z) => [x * 10, y * 6 - z * 10], 3, 4, 1, { z: 0.7, scale: 1.15 });
    paintWith(ctx, null);
    expect(halos).toHaveLength(1);
    expect(halos[0]!.color).toBe(NOTE_COLORS.side);
    expect(skins).toContain('fell');
    expect(skins).toContain('lack');
  });

  it('das Leuchten der Note behält beim Schweben seine Kennung (je Stein fest), der Stein hat einen weichen Fleck', () => {
    const ctx = anyContext();
    const halos: HaloAt[] = [];
    paintWith(ctx, { face: () => {}, halo: (h) => halos.push(h) });
    const P: Projection = (x, y, z) => [x * 10, y * 6 - z * 10];
    for (const z of [0.6, 0.73]) drawStone(ctx, P, 3, 4, 1, { z, scale: 1 });
    drawStone(ctx, P, 5, 4, 1, { z: 0.6, scale: 1 });
    paintWith(ctx, null);
    const ids = halos.map((h) => h.id);
    expect(ids).toEqual([noteHaloId(3, 4), noteHaloId(3, 4), noteHaloId(5, 4)]);
    expect(halos[0]!.z).not.toBe(halos[1]!.z); // schwebt, Kennung bleibt
    // der 2D-Maler übernimmt sie (sonst die Lage)
    const pen = new Fine2D();
    pen.halo(halos[0]!);
    pen.halo({ ...halos[0]!, id: undefined });
    const [fixed, placed] = pen.take();
    expect(fixed!.id).toBe(noteHaloId(3, 4));
    expect(placed!.id).toMatch(/^[\d.]+,[\d.]+,[\d.]+$/);
    expect(STONE_FOOT).toBeCloseTo(STONE[0]![3] / 2, 9);
  });

  it('ohne Maler flach: kein Leuchten', () => {
    const ctx = anyContext();
    expect(() => drawStone(ctx, (x, y, z) => [x, y - z], 3, 4, 1, { z: 0.6, scale: 1 })).not.toThrow();
  });
});

describe('Note in 3D', () => {
  it('jeder Quader ein wenig anders groß: keine zwei Flächen in einer Ebene (sonst flackert sie beim Drehen)', () => {
    const solid = noteSolid();
    const flat = noteBoxes(0, 0, 0, 1);
    expect(solid).toHaveLength(flat.length);
    solid.forEach((b, n) => {
      expect(b[3]).toBeCloseTo(flat[n]![3] + 2 * growOf(n), 9);
      expect(b[9]).toBe(flat[n]![9]);
    });
    const g = new Geo();
    for (const b of solid) fineBox(g, b);
    expect(fightingFaces(faces(g.build(), 'note'))).toEqual([]);
    // Gegenprobe: ohne Wachsen liegen Kopf und Hals in einer Ebene
    const same = new Geo();
    for (const b of flat) fineBox(same, b);
    expect(fightingFaces(faces(same.build(), 'note')).length).toBeGreaterThan(0);
  });
});

describe('Wegstein fein', () => {
  it('Platte mit Verlauf, wach leuchtet die Einlage weich, schlafend nicht; Moos hinten auf der Platte', () => {
    for (const id of Object.keys(THEME_COLORS) as GateId[]) {
      const [asleep, awake] = [waystoneBoxes(3, 4, 1, id, false), waystoneBoxes(3, 4, 1, id, true)];
      expect(awake[1]![9]).toEqual({ halo: true });
      expect(asleep[1]![9]).toEqual({});
      expect(asleep.some((b) => b[9]?.halo)).toBe(false);
      expect(haloCompact(awake[1]![3], awake[1]![4], awake[1]![5])).toBe(true);
      const [plate, inlay, moss] = awake as [Box, Box, Box];
      expect(moss[9]?.skin).toBe('fell');
      expect(inside(moss, plate) && inside(inlay, plate)).toBe(true);
      expect(shared(moss, inlay)).toBe(0);
      expect(moss[2]).toBeCloseTo(plate[2] + plate[5], 9);
      expect(painted(awake)).toBe(true);
    }
  });
});

describe('Großes Tor in 2D: Tür und Beschläge fein', () => {
  const P: Projection = (x, y, z) => [x * 10, y * 6 - z * 10];
  const cells = [-2, -1, 0, 1, 2].map((x) => [x, 0] as const);
  const world: GateRow = { gates: new Map([['eis', { id: 'eis', mid: [0, 0], out: [0, -1], cells }]]) };
  const door = { deco: 'biggate', gate: 'eis' } as const;

  function paint(painter: FinePainter | null, open = 0) {
    const fines: (string | undefined)[] = [];
    const face = vi.fn((_c: CanvasRenderingContext2D, _f: FaceRect, fine: Fine | undefined) => {
      fines.push(fine?.skin);
    });
    const pen: FinePainter = { face };
    const ctx = anyContext();
    for (let x = -2; x <= 2; x++) bigGate(ctx, P, world, door, x, 0, 0, new Map([['eis', open]]), null, painter && pen);
    return { fines, face };
  }

  it('mit Maler: Holz für die Tür, Metall für die Bänder; Türme, Bogen und Zeichen bleiben flach', () => {
    const { fines } = paint({ face: () => {} });
    expect(fines.filter((s) => s === 'holz').length).toBeGreaterThanOrEqual(5); // je Feld die Tür
    expect(fines.filter((s) => s === 'metall').length).toBeGreaterThanOrEqual(15); // je Feld drei Bänder
    expect(new Set(fines)).toEqual(new Set(['holz', 'metall', undefined]));
  });

  it('ohne Maler (Postkarte) wie bisher flach', () => {
    const { face } = paint(null);
    expect(face).not.toHaveBeenCalled();
  });

  it('Bänder in Metallgrau, kein Gold', () => {
    expect(DOOR.bands).toHaveLength(3);
    expect([DOOR.band, DOOR.rivet, DOOR.seam]).not.toContain('#e6c35c');
  });
});
