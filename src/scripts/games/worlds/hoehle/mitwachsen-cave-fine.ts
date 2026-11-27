// Feinheit der Kristallgrotte (Entwurf „Feine Grafik“, Issue 13), rein und gleich für 2D und 3D: Muster je Material der
// Dinge der Grotte (Moos als Fell, Holz, Lack auf Pilzhüten, Blatt am Farn) und die Bausteine, aus denen Kristalle und
// Leuchtpilze fein werden: Was leuchtet (Kristall, Hut, Leuchtmoos), trägt `halo` – so leuchtet es weich in den Raum,
// soweit es kompakt ist (`haloCompact`), und sein Seitenverlauf ist nur halb so stark (`vertexShade`/`faceShade`):
// Damit bleibt es mindestens so hell wie vorher als flacher Block (Kontrastregel der Grotte gegen die Dunkelmaske,
// mitwachsen-cave-colors.test.ts). Stein bleibt ohne Muster (es gibt keins), bekommt Verlauf, Oberkante und hier und da
// einen Riss oder Kiesel. Lichtkanten liegen als dünnes weißes Plättchen (`EDGE`) vorn auf einem Kristall und leuchten
// mit (Art `'glow'`: in 2D scharf, in 3D aus sich selbst). Kein Gold: Gold bleibt der Aktion.
// Spezifikation: docs/specs/mitwachsen.md (Feinheit, Kristallgrotte)

import type { Fine } from '../../../../lib/games/front';
import type { Box } from '../../mitwachsen-view';

/** Feinheit je Material der Grotte */
export const CAVE_FINE = {
  moss: { skin: 'fell' },
  wood: { skin: 'holz' },
  leaf: { skin: 'blatt' },
  stem: { skin: 'haar' },
  cap: { skin: 'lack' },
  glow: { halo: true },
  glowCap: { skin: 'lack', halo: true },
  glowMoss: { skin: 'fell', halo: true },
} as const satisfies Record<string, Fine>;

/** So dick ist ein Plättchen vorn auf einer Fläche (Lichtkante, Riss, Nagel): nah genug, ohne Z-Fighting */
export const EDGE = 0.005;
const WHITE = '#ffffff';

/** Farbe `hex` um `k` (0 … 1) zum Weiß hin aufhellen */
export function lighten(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * Math.max(0, Math.min(1, k)));
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map((v) => mix(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Farbe `hex` um `k` (0 … 1) abdunkeln (jeder Kanal × (1 − k)) */
export function deepen(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const dim = (v: number) => Math.round(v * (1 - Math.max(0, Math.min(1, k))));
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map((v) => dim(v).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Lichtkante vorn auf einer Fläche: ein schmales weißes Plättchen an der Vorderseite y (Feldkoordinate der Front),
 * leuchtet mit dem Kristall (`'glow'`)
 */
export const edge = (x: number, y: number, z: number, w: number, h: number): Box => [
  x,
  y,
  z,
  w,
  EDGE,
  h,
  WHITE,
  WHITE,
  'glow',
];

/**
 * Kristall fein (Entwurf `kristall`): Säule in seiner Farbe, darauf eine hellere Spitze (45 % zum Weiß), vorn eine
 * Lichtkante; alles leuchtet (`halo`). `top` (Oberseite der Säule) wie bisher, Lage und Maße der Säule bleiben, die
 * Spitze sitzt obenauf (so hoch wie ein Fünftel der Säule, höchstens `tipMax`)
 */
export function crystal(
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  color: string,
  top = color,
  tipMax = 0.12,
): Box[] {
  const tip = lighten(color, 0.45);
  const th = Math.min(tipMax, h * 0.2);
  const [tw, td] = [w * 0.55, d * 0.55];
  return [
    [x, y, z, w, d, h, color, top, undefined, CAVE_FINE.glow],
    [x + (w - tw) / 2, y + (d - td) / 2, z + h, tw, td, th, tip, tip, undefined, CAVE_FINE.glow],
    edge(x + w * 0.12, y + d, z + h * 0.45, Math.max(0.02, w * 0.16), h * 0.45),
  ];
}
