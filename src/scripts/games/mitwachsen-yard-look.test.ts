import { describe, expect, it } from 'vitest';
import { GAME_COLORS } from '../../data/games/mitwachsen';
import type { Deco } from './mitwachsen-cell';
import {
  PLATE,
  WOOD_BED,
  bedBoxes,
  bridgeBoxes,
  fenceBoxes,
  hedgeBoxes,
  SIGN_TOP,
  signBoxes,
  signWidth,
  sleeperBoxes,
  troughBoxes,
  type Neighbours,
} from './mitwachsen-yard-look';
import type { Box } from './mitwachsen-view';

const around = (map: Record<string, Deco>): Neighbours => ({ cell: (x, y) => ({ deco: map[`${x},${y}`] ?? null }) });
const LOOK = { skin: '#f2c9a0', hair: '#6b4226' };
const EPS = 1e-9;
/** Liegt der Quader ganz im Feld (x, y)? */
const inCell = (b: Box, x: number, y: number) =>
  b[0] >= x - EPS && b[0] + b[3] <= x + 1 + EPS && b[1] >= y - EPS && b[1] + b[4] <= y + 1 + EPS;
/** Rauminhalt, den sich zwei Quader teilen */
const shared = (a: Box, b: Box) => {
  const along = (lo: number, len: number, lo2: number, len2: number) =>
    Math.max(0, Math.min(lo + len, lo2 + len2) - Math.max(lo, lo2));
  return along(a[0], a[3], b[0], b[3]) * along(a[1], a[4], b[1], b[4]) * along(a[2], a[5], b[2], b[5]);
};

describe('Bett (bedBoxes, Entwurf „bett“)', () => {
  const bed = bedBoxes(3, 5, 1, WOOD_BED);

  it('bleibt in seinem Feld, steht auf dem Boden, kein Teil steckt in einem anderen', () => {
    expect(bed.every((b) => inCell(b, 3, 5) && b[2] >= 1 - EPS)).toBe(true);
    for (const [i, a] of bed.entries())
      for (const b of bed.slice(i + 1)) expect(shared(a, b), JSON.stringify([a, b])).toBeLessThan(1e-6);
  });

  it('Rahmen, Kopfteil und vier Pfosten aus Holz, hinten mit hellem Knauf; Kissen und Laken Stoff, Decke gesteppt', () => {
    const skin = (s: string) => bed.filter((b) => b[9]?.skin === s);
    expect(skin('holz').length).toBe(7); // vier Pfosten, Kopfteil, Leiste, Rahmen
    const posts = skin('holz').filter((b) => b[3] < 0.1);
    expect(posts.map((b) => b[5]).sort()).toEqual([0.4, 0.4, 0.76, 0.76]);
    const knobs = bed.filter((b) => b[2] >= 1.76 - EPS);
    expect(knobs).toHaveLength(2);
    expect(knobs.every((k) => k[6] !== GAME_COLORS.bed.frame)).toBe(true);
    expect(skin('stoff')).toHaveLength(2);
    const [quilt] = skin('quilt');
    expect(quilt![6]).toBe(GAME_COLORS.bed.blanket);
    // heller Saum vorn auf der Decke
    expect(bed.some((b) => b[4] === PLATE && Math.abs(b[1] - (quilt![1] + quilt![4])) < EPS)).toBe(true);
  });

  it('der Rahmen kommt aus dem Haken (`bedFrame`): Schneebett der Eis-Welt mit Muster Schnee', () => {
    const snow = bedBoxes(3, 5, 1, ['#d5e4f0', '#f6f9fc', 'schnee']);
    expect(snow.filter((b) => b[9]?.skin === 'schnee')).toHaveLength(7);
    expect(snow.some((b) => b[7] === '#f6f9fc')).toBe(true);
    expect(snow.some((b) => b[9]?.skin === 'holz')).toBe(false);
  });

  it('Schläfer: Kopf auf dem Kissen, Decke hochgezogen auf dem Bett; nichts steckt im Bett', () => {
    const sleeper = sleeperBoxes(3, 5, 1, LOOK);
    expect(sleeper[0]![6]).toBe(LOOK.skin);
    expect(sleeper[1]![6]).toBe(LOOK.hair);
    expect(sleeper[1]![9]?.skin).toBe('haar');
    for (const s of sleeper) for (const b of bed) expect(shared(s, b)).toBeLessThan(1e-6);
    const pillow = bed.find((b) => b[6] === GAME_COLORS.bed.pillow)!;
    expect(sleeper[0]![2]).toBeCloseTo(pillow[2] + pillow[5]);
    expect(sleeperBoxes(0, 0, 2, LOOK).every((b) => b[2] >= 2.38 - EPS)).toBe(true);
  });
});

describe('Tafel, Brücke, Gartentor, Trog, Hecke', () => {
  it('Tafel: so breit wie ihre Tiere, Brett aus Holz auf einem Pfosten, Nägel vorn', () => {
    expect(signWidth(1)).toBe(1);
    expect(signWidth(4)).toBeCloseTo(2.2);
    const sign = signBoxes(3, 5, 1, 4);
    const board = sign[1]!;
    expect(board[3]).toBeCloseTo(2.2);
    expect(board[0] + board[3] / 2).toBeCloseTo(3.5);
    expect(sign.filter((b) => b[9]?.skin === 'holz')).toHaveLength(3);
    expect(sign.filter((b) => b[4] === PLATE).every((b) => Math.abs(b[1] - (board[1] + board[4])) < EPS)).toBe(true);
  });

  it('Tafel: Die Tiere stehen auf dem Rahmen (`SIGN_TOP`), nicht in ihm; kein Teil steckt in einem anderen', () => {
    for (const h of [1, 2.5]) {
      const sign = signBoxes(3, 5, h, 3);
      expect(Math.max(...sign.map((b) => b[2] + b[5]))).toBeCloseTo(h + SIGN_TOP);
      for (const [i, a] of sign.entries()) for (const b of sign.slice(i + 1)) expect(shared(a, b)).toBeLessThan(1e-6);
    }
  });

  it('Brücke: wächst mit dem Tor in die Tiefe, vier Planken mit Fugen auf einem Balken; noch zu: keine', () => {
    expect(bridgeBoxes(3, 5, 0)).toEqual([]);
    const half = bridgeBoxes(3, 5, 0.5);
    expect(half).toHaveLength(5);
    expect(half.every((b) => b[4] === 0.5 && b[1] === 5.25 && b[9]?.skin === 'holz')).toBe(true);
    const planks = half.slice(1);
    for (let i = 1; i < planks.length; i++)
      expect(planks[i]![0]).toBeGreaterThan(planks[i - 1]![0] + planks[i - 1]![3]);
  });

  it('Gartentor: Flügel mit heller Leiste; quer zum Weg zwei Beschläge vorn, die mit dem Flügel schmaler werden', () => {
    const across = around({ '3,5': 'gate', '2,5': 'fence', '4,5': 'fence' });
    const along = around({ '3,5': 'gate', '3,4': 'fence', '3,6': 'fence' });
    const shut = fenceBoxes(across, 3, 5, 1, 1);
    expect(shut).toHaveLength(4);
    const [wing] = shut;
    expect(shut.slice(2).every((b) => b[9]?.skin === 'metall' && b[1] === wing![1] + wing![4])).toBe(true);
    expect(fenceBoxes(across, 3, 5, 1, 0.2)[2]![3]).toBeCloseTo(0.06);
    expect(fenceBoxes(along, 3, 5, 1, 1)).toHaveLength(2);
  });

  it('Trog: Eisenbänder vorn auf der Planke, Wasser glänzt, Heu als Fell, Möhren mit Kraut', () => {
    const water = troughBoxes(3, 5, 1, true),
      hay = troughBoxes(3, 5, 1, false);
    expect(water.filter((b) => b[9]?.skin === 'metall')).toHaveLength(2);
    expect(water.filter((b) => b[5] === PLATE && b[2] === 1.42)).toHaveLength(2);
    expect(hay.some((b) => b[9]?.skin === 'fell')).toBe(true);
    expect(hay.filter((b) => b[6] === '#4f9a3c')).toHaveLength(3);
  });

  it('Hecke: obere hellere Stufe auf dem Busch, Blüte liegt obenauf', () => {
    const hedge = hedgeBoxes(around({}), 0, 0, 1, false);
    const step = hedge.find((b) => b[2] === 1.75)!;
    expect(step[6]).toBe('#4aa843');
    const bloom = hedge.find((b) => b[6] === '#f2d14b')!;
    expect(bloom[2]).toBeCloseTo(step[2] + step[5]);
  });
});
