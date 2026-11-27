import { describe, expect, it } from 'vitest';
import { cornerShade } from '../../lib/games/shade';
import type { Cell } from './mitwachsen-cell';
import {
  TINY,
  chunkHalos,
  fineBox,
  fineBoxes,
  fineSinks,
  groundCorners,
  groundHeight,
  heightGrid,
  sinkOf,
} from './mitwachsen-fine-chunk-3d';
import { Geo } from './mitwachsen-geo';
import type { Box } from './mitwachsen-view';

const trunk: Box = [0.4, 0.4, 1, 0.2, 0.2, 1.2, '#7a5432', '#7a5432', undefined, { skin: 'rinde' }];
const crown: Box = [0, 0, 2, 1, 1, 0.8, '#4f9a3c', '#4f9a3c', 'see', { skin: 'blatt' }];
const rivet: Box = [0.5, 0.5, 1, 0.03, 0.03, 0.03, '#999999', '#999999'];
const lamp: Box = [0.4, 0.4, 2, 0.2, 0.2, 0.2, '#ffe08a', '#ffe08a', undefined, { halo: true }];

describe('Feine Dinge beim Bau eines Stücks', () => {
  it('sortiert Laub in die durchsichtige, winzige Teile in die schattenlose, alles andere in die feste Geometrie', () => {
    const s = fineSinks();
    expect(sinkOf(s, crown)).toBe(s.see);
    expect(sinkOf(s, rivet)).toBe(s.tiny);
    expect(sinkOf(s, trunk)).toBe(s.solid);
    expect(Math.min(rivet[3], rivet[4], rivet[5])).toBeLessThan(TINY);
  });

  it('baut jedes Ding fein (auch ohne eigene Feinheit), Kristalle in die leuchtende Geometrie', () => {
    const s = fineSinks();
    const bright = new Geo();
    fineBoxes(s, [trunk, crown, rivet]);
    fineBoxes(s, [lamp, crown], bright);
    for (const g of [s.solid, s.see, s.tiny, bright]) {
      const built = g.build();
      expect(built.getAttribute('aFine')).toBeDefined();
      expect(built.getAttribute('aSkin')).toBeDefined();
    }
    expect(s.see.build().getAttribute('position').count).toBe(2 * 20); // zweimal Laub, je 5 Flächen
    expect(bright.halos).toHaveLength(1);
    // Kennungen der Leuchten: Stück und Stelle
    expect(chunkHalos('2,-1', [s.solid, bright]).map((h) => h.id)).toEqual(['2,-1:0']);
  });

  it('legt die Lage eines Dings wie die 3D-Ansicht: Box (x, y nach vorn, z Höhe) → Geo (x, Höhe, y)', () => {
    const g = new Geo();
    fineBox(g, trunk);
    const pos = g.build().getAttribute('position');
    const ys = Array.from({ length: pos.count }, (_, i) => pos.getY(i));
    const zs = Array.from({ length: pos.count }, (_, i) => pos.getZ(i));
    expect(Math.min(...ys)).toBeCloseTo(1);
    expect(Math.max(...ys)).toBeCloseTo(2.2);
    expect(Math.min(...zs)).toBeCloseTo(0.4);
    expect(Math.max(...zs)).toBeCloseTo(0.6);
  });
});

describe('Weicher Schatten am Boden in 3D', () => {
  // Zahlen sind Höhen, W Wasser
  const map = ['1131', '1W11', '1121'];
  const cell = (x: number, y: number): Pick<Cell, 'ground' | 'h'> => {
    const ch = map[y]?.[x] ?? '1';
    return ch === 'W' ? { ground: 'water', h: 0 } : { ground: 'grass', h: Number(ch) };
  };

  it('kennt Böden ohne Oberseite (Wasser, Lava, Himmel)', () => {
    expect(groundHeight({ ground: 'grass', h: 2 })).toBe(2);
    for (const ground of ['water', 'lava', 'sky'] as const) expect(groundHeight({ ground, h: 1 })).toBeNull();
  });

  it('liest die Höhen eines Stücks einmal und antwortet wie die Welt, auch außerhalb des Rands', () => {
    const at = heightGrid(cell, 0, 0, 2);
    for (let y = -2; y < 5; y++) for (let x = -2; x < 6; x++) expect(at(x, y)).toBe(groundHeight(cell(x, y)));
  });

  it('dunkelt die Ecken neben höheren Blöcken ab, in der Reihenfolge der Oberseite in `terrain`', () => {
    const at = (x: number, y: number) => groundHeight(cell(x, y));
    const c = cornerShade(at, 2, 1); // rechts daneben 1, hinten 3 (höher), vorn 2 (höher)
    expect(groundCorners(at, 2, 1)).toEqual([c.x0y1, c.x1y1, c.x1y0, c.x0y0]);
    expect(c.x0y0).toBeLessThan(1);
    expect(c.x0y1).toBeLessThan(1);
  });
});
