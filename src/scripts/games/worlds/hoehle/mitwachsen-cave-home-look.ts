// Aussehen der Dinge am Höhlenbett und der Sammelstellen der Kristallgrotte, gleich für 2D und 3D: Pilzschale und
// Steintrog (leer oder voll, Tropfmoos am Rand), Unterstand mit der Kristallwand, Pilzbeete (Büschel aus fünf Pilzen
// mit dunklem Felsrand, leer Stümpfe), Tropfquelle, Tropfmoos und der Sockel der Kristall-Laterne. Fein (Entwurf
// „Feine Grafik“): Moos als Fell, Holz der Pfosten mit Maserung, Leuchtpilze leuchten weich (`halo`) mit heller Kuppe,
// der Kristall in der Wand mit Lichtkante, Stein ohne Muster mit Rille, Platte und Fuß. Felder, Lage und Größe
// bleiben. Rein (ohne DOM und Three.js), Teil des Welt-Pakets der Höhlenwelt (aus mitwachsen-cave-look.ts ausgelagert).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Kristallgrotte“, Feinheit)

import { GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { hash } from '../../../../lib/games/rng';
import type { Cell } from '../../mitwachsen-cell';
import type { Realms } from '../../mitwachsen-home';
import type { Box } from '../../mitwachsen-view';
import { POST_H } from './mitwachsen-lantern';
import { CAVE_FINE, EDGE, deepen, lighten } from './mitwachsen-cave-fine';

const C = GROTTE_COLORS;
/** Höhe der Kristallwand und des Dachs des Unterstands am Bett */
export const SHED_H = 2.2;
/** Stiel der Leuchtpilze */
export const STEM: readonly [string, string] = ['#efe4d2', '#f7efe2'];
/** Tropfwasser: türkise Tropfen */
const DROP = C.water[1];
const { moss: MOSS, wood: WOOD, glowCap: GLOW_CAP } = CAVE_FINE;
/** Rille im Stein (Schale, Trog) und Fuge im Dach */
const GROOVE = deepen(C.rock[0], 0.25);

/**
 * Pilzschale und Steintrog am Bett, leer oder voll (`full`: gerade gefüllt, die Tiere fressen und trinken, bis sie nach
 * `REGROW` Takten wieder leer sind, mitwachsen-chores.ts): die Schale aus Stein, voll mit einem Häufchen Leuchtpilze in
 * den drei Farben, leer ihr dunkler Boden; der Trog aus Stein, voll mit türkisem Wasser, leer trocken; am Rand des Trogs
 * immer ein Büschel Tropfmoos (für die Moosfresser). Fein: vorn eine Rille im Stein, Moos als Fell, die Leuchtpilze als Lack, sie leuchten weich
 */
export function bowlBoxes(c: Cell, x: number, y: number, full: boolean): Box[] {
  const h = c.h;
  if (c.deco === 'shroombowl') {
    const bowl: Box[] = [
      [x + 0.12, y + 0.2, h, 0.76, 0.6, 0.3, ...C.rock],
      [x + 0.2, y + 0.28, h + 0.3, 0.6, 0.44, 0.01, ...C.bedRim],
      [x + 0.12, y + 0.8, h + 0.2, 0.76, EDGE, 0.025, GROOVE, GROOVE], // Rille vorn
    ];
    if (!full) return bowl;
    const cap = GLOW_CAP; // Leuchtpilze leuchten weich
    return [
      ...bowl,
      [x + 0.2, y + 0.3, h + 0.3, 0.18, 0.16, 0.12, C.shrooms[0], C.shrooms[0], undefined, cap],
      [x + 0.42, y + 0.36, h + 0.3, 0.18, 0.16, 0.18, C.shrooms[1], C.shrooms[1], undefined, cap],
      [x + 0.62, y + 0.3, h + 0.3, 0.18, 0.16, 0.12, C.shrooms[2], C.shrooms[2], undefined, cap],
      [x + 0.34, y + 0.5, h + 0.3, 0.16, 0.14, 0.1, C.shrooms[2], C.shrooms[2], undefined, cap],
    ];
  }
  return [
    [x + 0.1, y + 0.22, h, 0.8, 0.56, 0.34, ...C.rock],
    full
      ? [x + 0.18, y + 0.3, h + 0.34, 0.64, 0.4, 0.02, ...C.water]
      : [x + 0.18, y + 0.3, h + 0.34, 0.64, 0.4, 0.01, ...C.bedRim],
    [x + 0.22, y + 0.78, h + 0.24, 0.68, EDGE, 0.025, GROOVE, GROOVE], // Rille vorn (rechts vom Moos)
    [x - 0.04, y + 0.62, h, 0.26, 0.28, 0.16, ...C.moss, undefined, MOSS],
    [x + 0.04, y + 0.7, h + 0.16, 0.06, 0.06, 0.04, DROP, DROP],
  ];
}

/**
 * Tropfquelle (heller Fels, vorn ein Wasserstreifen von der Lippe hinab, oben Moos; Tropfen fallen ins Becken) und
 * Tropfmoos (flaches Moospolster, darauf türkise Tropfen, begehbar); Moos als Fell
 */
export function supplyBoxes(c: Cell, x: number, y: number): Box[] {
  const h = c.h;
  switch (c.deco) {
    case 'dripspring':
      return [
        [x + 0.12, y + 0.35, h, 0.76, 0.6, 0.9, ...C.bright],
        [x + 0.2, y + 0.1, h + 0.7, 0.6, 0.35, 0.2, C.bright[0], C.moss[1]],
        [x + 0.12, y + 0.35, h + 0.9, 0.76, 0.6, 0.06, ...C.moss, undefined, MOSS],
        [x + 0.42, y + 0.09, h + 0.12, 0.16, 0.02, 0.58, ...C.water],
        [x + 0.46, y + 0.1, h + 0.4, 0.08, 0.08, 0.1, DROP, DROP],
        [x + 0.47, y + 0.02, h + 0.1, 0.06, 0.06, 0.08, DROP, DROP],
      ];
    case 'dripmoss':
      return [
        [x + 0.15, y + 0.2, h, 0.32, 0.3, 0.08, ...C.moss, undefined, MOSS],
        [x + 0.52, y + 0.5, h, 0.3, 0.28, 0.1, ...C.moss, undefined, MOSS],
        [x + 0.26, y + 0.3, h + 0.08, 0.06, 0.06, 0.04, DROP, DROP],
        [x + 0.63, y + 0.58, h + 0.1, 0.06, 0.06, 0.04, DROP, DROP],
      ];
    default:
      return [];
  }
}

/** Lage der fünf Leuchtpilze im Büschel: Mitte, Höhe des Stiels, Breite des Huts (der mittlere hinten am höchsten) */
const BED_SHROOMS = [
  [0.48, 0.42, 0.42, 0.3],
  [0.26, 0.36, 0.3, 0.26],
  [0.7, 0.34, 0.32, 0.26],
  [0.32, 0.64, 0.22, 0.24],
  [0.64, 0.66, 0.2, 0.22],
] as const;
/** Höhe des Felsrands um das Beet */
const RIM_H = 0.16;

/** Farbe der Pilze eines Beets: je Beet eine der drei Farben der Sammelpilze, fest aus seiner Lage */
export const bedColor = (x: number, y: number): string => C.shrooms[hash(6, x, y) % 3]!;

/**
 * Pilzbeet: dunkler Felsrand, darin Moos (Fell); voll steht darauf ein Büschel aus fünf Leuchtpilzen in einer Farbe
 * (je Beet Rosa, Türkis oder Gelb), etwa 0,7 hoch wie ein Beerenbusch, die Hüte leuchten weich (Lack, `halo`), der
 * mittlere mit heller Kuppe; abgeerntet nur Stümpfe im Moos
 */
export function shroomBed(c: Cell, x: number, y: number, full: boolean): Box[] {
  const h = c.h;
  const out: Box[] = [
    [x + 0.04, y + 0.1, h, 0.92, 0.8, RIM_H, ...C.bedRim],
    [x + 0.12, y + 0.18, h + RIM_H, 0.76, 0.64, 0.02, ...C.moss, undefined, MOSS],
  ];
  const color = bedColor(x, y);
  const light = lighten(color, 0.25);
  const top = h + RIM_H + 0.02;
  for (const [dx, dy, stem, w] of BED_SHROOMS) {
    if (!full) {
      out.push([x + dx - 0.04, y + dy - 0.04, top, 0.08, 0.08, 0.06, ...STEM]);
      continue;
    }
    out.push(
      [x + dx - 0.04, y + dy - 0.04, top, 0.08, 0.08, stem, ...STEM],
      [x + dx - w / 2, y + dy - w * 0.4, top + stem, w, w * 0.8, 0.1, color, light, undefined, GLOW_CAP],
    );
  }
  if (full) {
    // helle Kuppe auf dem mittleren Hut (in der hellen Farbe des Huts: keine neue Farbe im Beet)
    const [dx, dy, stem, w] = BED_SHROOMS[0];
    const k = w * 0.4;
    out.push([
      x + dx - k / 2,
      y + dy - w * 0.4 + (w * 0.8 - k) / 2,
      top + stem + 0.1,
      k,
      k,
      0.04,
      light,
      light,
      undefined,
      GLOW_CAP,
    ]);
  }
  return out;
}

/**
 * Unterstand am Höhlenbett (vorn offen): Jedes Feld der Rückwand ist ein Stück Kristallwand (Fels mit einem Kristall,
 * hinten in der Wand), die Mitte (`shelterStem`) trägt dazu das Dach über dem Unterstand (vorn
 * eine dunkle Fuge als Kante) und zwei Holzpfosten vorn (Holz mit Maserung, unten ein Steinfuß)
 */
export function shed(world: Realms, c: Cell, x: number, y: number): Box[] {
  const h = c.h;
  const color = C.crystals[hash(4, x, y) % 3]!;
  const out: Box[] = [
    [x, y + 0.5, h, 1, 0.5, SHED_H, ...C.rock],
    // der Kristall steckt hinten in der Wand (vorn sieht man den Fels): ohne Leuchten, das schiene durch die Wand
    [x + 0.3, y + 0.42, h + 0.5 + (hash(5, x, y) % 3) * 0.3, 0.3, 0.1, 0.4, color, color],
  ];
  const home = world.homes.hoehle;
  if (x !== home.shelterStem[0] || y !== home.shelterStem[1]) return out;
  const { x0, x1, y1 } = home.shelter;
  const d = y1 + 1 - (y + 0.5);
  const roof: Box = [x0 - 0.1, y + 0.5, h + SHED_H, x1 - x0 + 1.2, d, 0.25, ...C.roof, 'see'];
  const post = (px: number): Box[] => [
    [px - 0.03, y1 + 0.67, h, 0.26, 0.26, 0.1, ...C.rock], // Steinfuß, in 2D vor dem Pfosten gezeichnet
    [px, y1 + 0.7, h + 0.1, 0.2, 0.2, SHED_H - 0.1, ...C.wood, undefined, WOOD],
  ];
  out.push(
    roof,
    [roof[0], roof[1] + d, h + SHED_H + 0.08, roof[3], EDGE, 0.04, GROOVE, GROOVE, 'see'], // Fuge vorn am Dach
    ...post(x0 + 0.05),
    ...post(x1 + 0.75),
  );
  return out;
}

/** Sockel der Kristall-Laterne: niedriger Steinblock mit Platte und Rille, kein Gold (die Laterne darauf ist ein Körper) */
export function post(c: Cell, x: number, y: number): Box[] {
  return [
    [x + 0.28, y + 0.3, c.h, 0.44, 0.4, POST_H - 0.06, ...C.rock],
    [x + 0.22, y + 0.24, c.h + POST_H - 0.06, 0.56, 0.52, 0.06, C.rock[1], C.rock[1]],
    [x + 0.28, y + 0.7, c.h + 0.12, 0.44, EDGE, 0.025, GROOVE, GROOVE], // Rille vorn
  ];
}
