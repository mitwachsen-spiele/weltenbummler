// Aussehen und Klang der Schneemänner im Gletscherkessel, gleich für 2D und 3D: ein Schneehaufen, der Kugel um Kugel
// zum Schneemann wächst (Stufe 0 bis 3, mitwachsen-snowman.ts), mit Augen und Knöpfen aus Kohle, Möhrennase, rotem
// Schal und blauer Wollmütze mit Bommel (Farben in SNOWMAN_COLORS). Der Haufen hat einen bläulichen Schattenrand, eine
// kleine Kugel daneben und einen Zweig obenauf, damit man ihn nicht mit den begehbaren Schneewehen verwechselt. Rein
// (ohne DOM und Three.js): Quader in Feldern, die beide Ansichten zeichnen; 2D wackelt nach dem Wachsen kurz (`wobble`,
// nicht bei reduzierter Bewegung), 3D steht still. Dazu das fröhliche Ploppen (`snowScore`). Teil des Welt-Pakets der
// Eis-Welt.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Gletscherkessel“ und „Was angezeigt wird“)

import { ICE_COLORS } from '../../../../data/games/worlds/eis/mitwachsen-ice-colors';
import { SNOWMAN_COLORS } from '../../../../data/games/worlds/eis/mitwachsen-kessel';
import type { PackEvent } from '../../mitwachsen-pack-types';
import type { Box } from '../../mitwachsen-view';
import type { Fine } from '../../../../lib/games/front';
import type { Scored } from '../../sfx';
import { SNOWMAN } from './mitwachsen-snowman';

const {
  coal: COAL,
  carrot: CARROT,
  scarf: SCARF,
  hat: HAT,
  bommel: BOMMEL,
  shadow: SHADOW,
  twig: TWIG,
} = SNOWMAN_COLORS;
const [SNOW, TOP] = ICE_COLORS.snow;

/** Quader relativ zum Feld: x, y (nach vorn), z über dem Boden, Breite, Tiefe, Höhe, Seiten, oben, Feinheit */
type Part = readonly [number, number, number, number, number, number, string, string, Fine?];
/** Feinheit (Entwurf „Feine Grafik“): Schnee glitzert, Schal aus Stoff, Mütze gestrickt, Bommel flauschig */
const GLITTER: Fine = { skin: 'schnee' },
  CLOTH: Fine = { skin: 'stoff' },
  WOOL: Fine = { skin: 'fell' };
const snow = (x: number, y: number, z: number, w: number, d: number, h: number): Part => [
  x,
  y,
  z,
  w,
  d,
  h,
  SNOW,
  TOP,
  GLITTER,
];

/** Bläulicher Schattenrand des Haufens am Boden (die Schneewehen haben keinen) */
const RIM: Part = [0.06, 0.1, 0, 0.88, 0.84, 0.03, ...SHADOW];
/**
 * Der Haufen, bevor eine Kugel wächst: Schattenrand, Hügel, eine kleine Kugel vorn daneben und ein Zweig obenauf (so
 * sieht man, dass hier etwas entsteht)
 */
const HEAP: readonly Part[] = [
  RIM,
  snow(0.12, 0.16, 0.03, 0.7, 0.62, 0.18),
  snow(0.24, 0.26, 0.21, 0.44, 0.4, 0.11),
  [0.44, 0.42, 0.32, 0.04, 0.04, 0.08, ...TWIG], // Zweig
  [0.48, 0.42, 0.36, 0.08, 0.03, 0.03, ...TWIG],
  snow(0.68, 0.74, 0.03, 0.2, 0.18, 0.17), // kleine Kugel
];
/** Was vom Haufen bleibt, wenn die erste Kugel gerollt ist */
const BASE = snow(0.08, 0.12, 0, 0.84, 0.76, 0.06);
/** Die untere Kugel und die mittlere, je mit einer schmaleren Kappe obenauf, damit sie rund wirken */
const BOTTOM = [snow(0.19, 0.22, 0, 0.62, 0.56, 0.36), snow(0.25, 0.28, 0.36, 0.5, 0.44, 0.06)];
const MIDDLE = [snow(0.27, 0.29, 0.42, 0.46, 0.42, 0.26), snow(0.32, 0.33, 0.68, 0.36, 0.34, 0.06)];
/**
 * Der fertige Schneemann: Arme aus Zweigen (je mit einem Finger nach oben), Knöpfe, Schal mit Zipfel, Kopf, Augen,
 * Möhrennase, ein Mund aus zwei Kohlestückchen, Wollmütze mit Bommel
 */
const DRESSED: readonly Part[] = [
  [0.13, 0.485, 0.56, 0.14, 0.03, 0.03, ...TWIG], // Arme aus Zweigen
  [0.1, 0.485, 0.56, 0.03, 0.03, 0.09, ...TWIG],
  [0.73, 0.485, 0.56, 0.14, 0.03, 0.03, ...TWIG],
  [0.87, 0.485, 0.56, 0.03, 0.03, 0.09, ...TWIG],
  [0.475, 0.705, 0.5, 0.05, 0.02, 0.05, COAL, COAL], // Knöpfe
  [0.475, 0.705, 0.6, 0.05, 0.02, 0.05, COAL, COAL],
  [0.3, 0.32, 0.7, 0.4, 0.36, 0.06, ...SCARF, CLOTH], // Schal mit Zipfel
  [0.6, 0.67, 0.56, 0.07, 0.04, 0.16, ...SCARF, CLOTH],
  snow(0.33, 0.35, 0.74, 0.34, 0.3, 0.28), // Kopf
  [0.4, 0.645, 0.9, 0.05, 0.02, 0.05, COAL, COAL], // Augen
  [0.55, 0.645, 0.9, 0.05, 0.02, 0.05, COAL, COAL],
  [0.425, 0.645, 0.78, 0.035, 0.02, 0.03, COAL, COAL], // Mund
  [0.54, 0.645, 0.78, 0.035, 0.02, 0.03, COAL, COAL],
  [0.47, 0.65, 0.83, 0.06, 0.16, 0.06, ...CARROT], // Möhrennase
  [0.32, 0.34, 1.02, 0.36, 0.32, 0.1, ...HAT, WOOL], // Wollmütze mit Bommel
  [0.36, 0.38, 1.12, 0.28, 0.24, 0.06, ...HAT, WOOL],
  [0.45, 0.46, 1.18, 0.1, 0.08, 0.08, BOMMEL, BOMMEL, WOOL],
];
/**
 * Quader je Stufe, in der Reihenfolge, in der die 2D-Ansicht sie übereinander malt (von unten nach oben, was davor
 * liegt, zuletzt): 0 Haufen, 1 eine Kugel, 2 zwei, 3 der Schneemann
 */
const STAGES: readonly (readonly Part[])[] = [
  HEAP,
  [BASE, ...BOTTOM],
  [BASE, ...BOTTOM, ...MIDDLE],
  [BASE, ...BOTTOM, ...MIDDLE, ...DRESSED],
];

/**
 * Quader eines Schneehaufens der Stufe `stage` auf dem Feld `x, y` in der Höhe `h`: 0 Haufen, 1 und 2 eine bzw. zwei
 * Kugeln, ab `SNOWMAN` der Schneemann. `sway` (in Feldern) schiebt alles über dem Boden seitlich (kurzes Wackeln in 2D).
 */
export function snowBoxes(x: number, y: number, h: number, stage: number, sway = 0): Box[] {
  const parts = STAGES[Math.max(0, Math.min(stage, SNOWMAN))] ?? HEAP;
  return parts.map((part) => {
    const [bx, by, bz, w, d, bh, side, top, fine] = part;
    const dx = part === BASE || part === RIM ? 0 : sway * (0.5 + bz / 2); // oben schwingt es weiter aus als unten
    const [px, py, pz] = [x + bx + dx, y + by, h + bz];
    return fine ? [px, py, pz, w, d, bh, side, top, undefined, fine] : [px, py, pz, w, d, bh, side, top];
  });
}

const WOBBLE_MS = 600; // so lange wackelt eine frisch gewachsene Kugel
/** Seitliches Wackeln `ms` nach dem Wachsen (in Feldern): klingt ab, nach `WOBBLE_MS` steht alles still */
export const wobble = (ms: number) =>
  ms >= 0 && ms < WOBBLE_MS ? 0.06 * Math.sin((ms / WOBBLE_MS) * Math.PI * 3) * (1 - ms / WOBBLE_MS) : 0;

const DITTY = [1046.5, 1174.66, 1318.51, 1567.98, 2093]; // C6 D6 E6 G6 C7 (Pentatonik wie die Tiere)

/** Fröhliches Ploppen, je Kugel etwas höher; steht der Schneemann, dazu eine kleine Melodie */
export function snowScore(e: Extract<PackEvent, { type: 'snowman' }>): Scored[] {
  const out: Scored[] = [
    [240 + 80 * e.stage, 0.11, 'sine', 0.16, 2.4, 0],
    [480 + 160 * e.stage, 0.06, 'triangle', 0.04, 1, 0.05],
  ];
  if (e.stage >= SNOWMAN)
    DITTY.forEach((f, i) => out.push([f, i === DITTY.length - 1 ? 0.5 : 0.14, 'triangle', 0.05, 1, 0.18 + i * 0.11]));
  return out;
}
