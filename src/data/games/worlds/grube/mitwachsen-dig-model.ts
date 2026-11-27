// Der Maulwurf gräbt den Glitzergang (Rückmeldung zur Höhle, Schritt 17), nur im Paket der Grubenbahn: Zeitplan des
// Grabens, wie nah die Figur am Grubenhalt sein muss, damit es beginnt, und das Bild der Erdwelle (Teile wie in
// `front.ts`: vorn, rechts, unten, Länge, Breite, Höhe, Farbe, oben; eigene Voxel-Grafik). Die Erdwelle ist ein kleiner
// Erdhügel, der unter dem Boden entlang der künftigen Runde läuft, wie ein Maulwurf eben gräbt; darin glitzern zwei
// Kristallkrümel. Hinter ihm bleibt liegen, was er baut (Issue 14, damit das Kind sieht, dass hier eine Bahn entsteht):
// auf der offenen Strecke ein Bett frischer Erde, auf das die Ansicht das schmale Gleis legt (`BED_PART`), auf dem Fels
// des Gangs Glitzerkrümel (`CRUMB_PARTS`). Kein Gold (die Welle ist keine Aktion), kein Gesicht, nichts Spitzes.
// Fein (Entwurf „Feine Grafik“, Issue 13): Die zwei Kristallkrümel im Erdhügel leuchten weich (`halo`); das gelegte
// Gleis hat dieselben Muster wie das echte (Schwellen Holz, Schienen Metall).
// Spec: docs/specs/mitwachsen.md („Die Grubenbahn Funkel“, Der Maulwurf gräbt)

import type { Part } from '../../../../lib/games/front';

/**
 * Das Graben: so viele Takte zu 0,1 s (`ticks`, 8 s wie Bau 1 der Bahn) und was wann geschieht, als Bruchteil (0 … 1):
 * Der Maulwurf klopft am Grubenhalt (`taps` Mal, bis `wave[0]`), die Erdwelle läuft einmal die Runde entlang vom Halt
 * bis zurück zum Halt (`wave`), aus Fels werden Rinne und Tore, das Gleis liegt (`pop`: die Welt wird neu gebaut, die
 * Stufe `bereit` gespeichert), Funkel rollt aus dem Gang an den Halt (`roll`)
 */
export const DIG = {
  ticks: 80,
  taps: 3,
  wave: [0.1, 0.7],
  pop: 0.72,
  roll: [0.76, 0.96],
} as const;

/**
 * So nah (Felder, Schachbrett) muss die wache Figur am Sitz des Grubenhalts sein, damit der Maulwurf zu graben beginnt:
 * wirklich am Halt, damit das Kind zusieht (bis Issue 14 waren es 12 Felder, da begann es oft außerhalb des Bilds)
 */
export const DIG_NEAR = 5;

/** Farben der Erdwelle, je Seite und Oberseite: Erde (graubraun, gedeckt, damit sie sich nicht als Gold liest), Krümel, Kristall */
export const DIG_COLORS = {
  earth: ['#6e5f55', '#85746a'],
  dark: ['#574b44', '#6a5c53'],
  crumb: ['#ab9a8c', '#c2b3a6'],
  crystal: ['#cdbdf5', '#f0eaff'],
} as const;

/** Funken, wenn der Maulwurf aus der Erde hüpft und wenn der Gang aufgeht: Erdkrümel und ein Glitzern */
export const DIG_CRUMBS = ['#6e5f55', '#85746a', '#ab9a8c', '#cdbdf5'] as const;

const E = DIG_COLORS.earth;
const D = DIG_COLORS.dark;
const C = DIG_COLORS.crumb;
const K = DIG_COLORS.crystal;

/** Der Erdhügel der Erdwelle, um die Mitte des Felds, in alle Richtungen gleich (gestuft rund) */
export const MOUND_PARTS: readonly Part[] = [
  [-0.4, -0.4, 0, 0.8, 0.8, 0.12, D[0], D[1]],
  [-0.3, -0.3, 0.12, 0.6, 0.6, 0.12, E[0], E[1]],
  [-0.17, -0.17, 0.24, 0.34, 0.34, 0.1, E[0], E[1]],
  [0.2, -0.38, 0.12, 0.12, 0.12, 0.06, C[0], C[1]],
  [-0.4, 0.22, 0.12, 0.12, 0.1, 0.06, C[0], C[1]],
  [0.24, 0.24, 0.12, 0.1, 0.1, 0.05, C[0], C[1]],
  [-0.06, 0.08, 0.3, 0.08, 0.08, 0.1, K[0], K[1], undefined, { halo: true }],
  [0.06, -0.12, 0.26, 0.07, 0.07, 0.08, K[0], K[1], undefined, { halo: true }],
];

/** So hoch (Felder) liegt das Bett frischer Erde, auf dem das wachsende Gleis liegt */
export const BED_H = 0.03;
/** Bett frischer Erde unter einem Stück Gleis, das der Erdhügel eben gelegt hat (fast das ganze Feld, flach) */
export const BED_PART: Part = [-0.45, -0.45, 0, 0.9, 0.9, BED_H, D[0], D[1]];

/** Glitzerkrümel, die der Erdhügel auf dem Fels des Gangs liegen lässt, bis der Gang aufgeht: Erde und Kristall */
export const CRUMB_PARTS: readonly Part[] = [
  [-0.22, -0.2, 0, 0.2, 0.2, 0.08, E[0], E[1]],
  [0.06, 0.04, 0, 0.16, 0.16, 0.06, C[0], C[1]],
  [-0.1, 0.16, 0, 0.1, 0.1, 0.12, K[0], K[1]],
  [0.14, -0.2, 0, 0.08, 0.08, 0.1, K[0], K[1]],
];

/**
 * So weit (Felder, Schachbrett) um die Figur zeichnet die Ansicht, was der Erdhügel liegen lässt: Sie steht am Halt und
 * hüpft nur, weiter weg ist es nicht im Bild (die Runde hat rund 160 Felder)
 */
export const DIG_SEEN = 14;
