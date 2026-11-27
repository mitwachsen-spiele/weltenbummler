// Feine Dinge beim Bau eines Stücks der 3D-Welt (Entwurf „Feine Grafik“): Quader der Dinge (Deko, Bäume, Gleis, Dinge
// der Welt-Pakete) kommen in eigene Geometrien mit Feinheit, getrennt vom Gelände; Laub bleibt vor der Figur
// durchsichtig, winzige Teile werfen keinen Schatten (Schattenpass in Software-WebGL). Dazu der weiche Schatten am
// Boden neben höheren Blöcken als Faktoren der Ecken (die Kacheln des Bodens bleiben). Gehört zur 3D-Ansicht.
// Spezifikation: docs/specs/mitwachsen.md (Feinheit)

import type { Fine, HaloAt } from '../../lib/games/front';
import { cornerShade } from '../../lib/games/shade';
import { Geo, topCorners } from './mitwachsen-geo';
import type { Cell } from './mitwachsen-cell';
import type { Box } from './mitwachsen-view';

/** Teile, die in einer Richtung dünner sind, werfen keinen Schatten (Nieten, Glanz, Blütenblätter) */
export const TINY = 0.05;

/** Geometrien der feinen Dinge eines Stücks: fest, Laub (durchsichtig vor der Figur), winzig (ohne Schattenwurf) */
export type FineSinks = { readonly solid: Geo; readonly see: Geo; readonly tiny: Geo };
export const fineSinks = (): FineSinks => ({ solid: new Geo(), see: new Geo(), tiny: new Geo() });

/** Wohin ein Quader eines Dings gehört: Laub, winzig oder fest; `into` erzwingt eine Geometrie (Kristall: leuchtet) */
export function sinkOf(s: FineSinks, b: Box): Geo {
  const [, , , w, d, h, , , kind] = b;
  return kind === 'see' ? s.see : Math.min(w, d, h) < TINY ? s.tiny : s.solid;
}

/** Ein Quader eines Dings (x, y nach vorn, z Höhe wie `Box`) fein in die Geometrie `g` */
export function fineBox(g: Geo, b: Box, fine: Fine = b[9] ?? {}) {
  const [x, y, z, w, d, h, side, top] = b;
  g.box(x, z, y, w, h, d, side, top, 'white', undefined, fine);
}

/** Alle Quader eines Dings in ihre Geometrien; `solid` statt der festen Geometrie (Kristalle leuchten aus sich selbst) */
export function fineBoxes(s: FineSinks, boxes: readonly Box[], solid?: Geo) {
  for (const b of boxes) fineBox(b[8] === 'see' ? s.see : (solid ?? sinkOf(s, b)), b);
}

/** Leuchten aller Geometrien eines Stücks mit Kennung (Stück und Stelle: gleich, bis es neu gebaut wird) */
export function chunkHalos(key: string, geos: readonly Geo[]): (HaloAt & { id: string })[] {
  return geos.flatMap((g) => g.halos).map((h, i) => ({ ...h, id: `${key}:${i}` }));
}

/** Höhe einer Bodenoberseite für den weichen Schatten; null, wo kein Boden ist (Wasser, Lava, Himmel) */
export const groundHeight = (c: Pick<Cell, 'ground' | 'h'>): number | null =>
  c.ground === 'water' || c.ground === 'lava' || c.ground === 'sky' ? null : c.h;

/**
 * Höhen der Böden eines Stücks samt Rand (ein Feld ringsum), einmal je Stück gelesen: Die Ecken jedes Felds fragen
 * neun Nachbarn, das wären sonst neunmal so viele Abfragen der Welt. Außerhalb des Rands fragt es die Welt
 */
export function heightGrid(
  cell: (x: number, y: number) => Pick<Cell, 'ground' | 'h'>,
  x0: number,
  y0: number,
  n: number,
) {
  const size = n + 2;
  const grid = new Float32Array(size * size);
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) grid[j * size + i] = groundHeight(cell(x0 - 1 + i, y0 - 1 + j)) ?? Number.NaN;
  return (x: number, y: number): number | null => {
    const i = x - x0 + 1,
      j = y - y0 + 1;
    const v = i >= 0 && j >= 0 && i < size && j < size ? grid[j * size + i]! : groundHeight(cell(x, y));
    return v === null || Number.isNaN(v) ? null : v;
  };
}

/**
 * Faktoren der vier Ecken der Oberseite von (x, y) in der Reihenfolge, in der `terrain` sie legt (vorn links, vorn
 * rechts, hinten rechts, hinten links): dunkler, wo ein höherer Block daneben steht (`cornerShade`)
 */
export const groundCorners = (heightAt: (x: number, y: number) => number | null, x: number, y: number) =>
  topCorners(cornerShade(heightAt, x, y));
