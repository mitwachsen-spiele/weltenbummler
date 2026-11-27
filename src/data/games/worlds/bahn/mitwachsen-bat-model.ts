// Modelle von Bahnhof Fledermaus in der Grotte, nur im Paket der Bahn (Teile wie in `front.ts`: vorn,
// rechts, unten, Länge, Breite, Höhe, Farbe, oben; eigene Voxel-Grafik, keine Lore, keine Druse). Mit Bau 2 entsteht
// er: der Bahnsteig aus lila geschichtetem Stein (in den Schichten des Höhlentors, `BANDS`), eine Stufe über dem Gleis,
// mit heller lila Kante; ein kleines, hohes Steindach auf zwei Pfosten hinten mit Kristall-Lampen obendrauf (der Schein leuchtet weich, kein Punktlicht) und
// dem Schild „Fledermaus auf Lila“ (ohne Text). Kein Bau daneben: Tok steht auf seinem Platz im Freien. Kein Gold: Hier gibt es nichts zu tun.
// Fein (Entwurf „Feine Grafik“, Issue 13): Der Schein obenauf jeder Kristall-Lampe leuchtet weich in den Raum (`halo`),
// das Schild ist aus Lack; Stein (Bahnsteig, Pfosten, Dach) bekommt kein Muster, nur Verlauf und Kante.
// Spec: docs/specs/mitwachsen.md („Tok und die Bahn“, Bau 2)

import type { Part } from '../../../../lib/games/front';
import { fine } from '../../mitwachsen-fine';
import { HALT_NUMBER, numberBadge } from '../../mitwachsen-digits';
import { BAT, ROOF_TOP, pixels, roofPlate, roofPosts } from './mitwachsen-train-model';

/** Farben von Bahnhof Fledermaus und Lokschuppen: Schichten wie am Höhlentor, Kante und Schild lila, Kristalle */
export const BAT_COLORS = {
  bands: ['#9a8fb8', '#b0a6cc', '#8c84a8', '#c3bad9'],
  top: ['#d6d2e6', '#ccc8de'],
  edge: '#b48cf0',
  roof: ['#7d7696', '#8c84a8'],
  sign: '#b48cf0',
  crystal: ['#b48cf0', '#6fd6f0', '#f08cc8'],
  glow: '#f3ecff',
  bat: { p: '#f2a7b8', g: '#7a6a5e', k: '#1d2838', l: '#f2a7b8', w: '#8a82b0' },
} as const;

const B = BAT_COLORS;

// Eine Reihe des Bahnsteigs schaut vom Gleis weg (vorn): von −1 (Kante am Gleis) bis +1 (hinten), quer −0,5 … 0,5.
/**
 * Reihe des Bahnsteigs von Bahnhof Fledermaus: oben heller Stein mit lila Kante, zum Gleis hin die Stirnseite in drei
 * Schichten (je Reihe versetzt, so sieht man die Lagen)
 */
export const batRowParts = (odd: boolean): Part[] => [
  [-1, -0.5, 0, 2, 1, 0.04, B.top[+odd]!, B.top[+odd]!],
  [-1, -0.5, 0.04, 0.1, 1, 0.015, B.edge, B.edge],
  ...[0, 1, 2].map((k): Part => [-1.03, -0.5, -1 + k * 0.34, 0.04, 1, 0.34, B.bands[(k + +odd) % B.bands.length]!]),
];

/**
 * Kristall-Lampe auf dem Dach (auf der Oberkante der Platte): kleiner Kristall in einer Farbe mit hellem Schein
 * obendrauf, der weich leuchtet
 */
const lamp = (f: number, r: number, c: string): Part[] => [
  [f, r, ROOF_TOP, 0.14, 0.14, 0.22, c, B.glow],
  fine([f + 0.03, r + 0.03, ROOF_TOP + 0.22, 0.08, 0.08, 0.1, B.glow, B.glow], { halo: true }),
];

/**
 * Steindach von Bahnhof Fledermaus: die Platte hinten über den zwei Dachreihen (klein und hoch wie an Bahnhof Bär,
 * `ROOF_SIZE`), obendrauf drei Kristall-Lampen: zwei an den Enden, eine vorn in der Mitte (das Schild steht dazwischen)
 */
export const BAT_ROOF: readonly Part[] = [
  roofPlate(...B.roof),
  ...lamp(0.47, -1, B.crystal[0]),
  ...lamp(0.04, -0.07, B.crystal[1]),
  ...lamp(0.47, 0.86, B.crystal[2]),
];
/** Unter dem Steindach: zwei Pfosten am hinteren Rand; die Kante am Gleis bleibt frei */
export const BAT_POSTS: readonly Part[] = roofPosts(B.bands[0]);

/** Schild auf dem Dach, zur Kamera: Fledermaus auf Lila, ohne Text */
export const BAT_SIGN: readonly Part[] = [
  fine([-0.03, -0.44, 0.16, 0.06, 0.88, 0.88, B.sign, B.sign], { skin: 'lack' }),
  ...pixels(BAT, B.bat, 0.03, 0, 0.94, 0.09),
  ...numberBadge(HALT_NUMBER.fledermaus, 0.045, -0.31, 1.03), // oben rechts im Bild: Bahnhof 2 (Issue 40)
];
