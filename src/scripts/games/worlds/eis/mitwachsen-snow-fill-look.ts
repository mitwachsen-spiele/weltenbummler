// Aussehen der Fülle im Schnee des Gletschertals (mitwachsen-snow-fill.ts) und der Schneewehen (mitwachsen-frost.ts),
// als Quader für 2D und 3D: Eisblumen als kleine Sterne, blanke Eisflecken mit einem Funken, graue Kiesel,
// Tundra-Büschel mit blauen Beeren, Schneewehen mit bläulichem Schattenrand (so hebt sich Weiß von Weiß ab). Je Feld
// etwas anders gelegt (gespiegelt und verschoben nach dem Feld), nichts davon ist höher als ein Büschel.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Gletscherkessel (Eis-Welt)“, Fülle im Schnee)

import { hash } from '../../../../lib/games/rng';
import { SNOW_FILL_COLORS as C } from '../../../../data/games/worlds/eis/mitwachsen-ice-colors';
import type { Cell } from '../../mitwachsen-cell';
import type { Box } from '../../mitwachsen-view';
import type { Fine } from '../../../../lib/games/front';

/** Feinheit: Schneewehen glitzern, Beeren glänzen (Sterne, Kiesel, Halme bleiben schlicht: zu klein für ein Muster) */
const SNOW: Fine = { skin: 'schnee' },
  BERRY: Fine = { skin: 'lack' };

/** Plätze der Sterne in einem Feld (Mitte, von der Ecke gemessen) und ihre Größe */
const STARS = [
  [0.3, 0.32, 0.44],
  [0.72, 0.6, 0.36],
  [0.34, 0.8, 0.3],
] as const;
/** Kiesel: Ecke, Breite, Tiefe, Höhe */
const STONES = [
  [0.26, 0.36, 0.34, 0.26, 0.16],
  [0.66, 0.26, 0.2, 0.18, 0.1],
  [0.58, 0.62, 0.26, 0.2, 0.12],
] as const;
/** Halme eines Büschels: Ecke und Höhe */
const BLADES = [
  [0.24, 0.42, 0.3],
  [0.38, 0.3, 0.42],
  [0.54, 0.42, 0.34],
  [0.4, 0.56, 0.22],
  [0.68, 0.32, 0.2],
] as const;

/** Ein Stern: zwei gekreuzte Balken flach im Schnee, in der Mitte ein heller Punkt */
function star(x: number, y: number, h: number, size: number, color: string): Box[] {
  const t = size / 3.6;
  return [
    [x - size / 2, y - t / 2, h, size, t, 0.03, color, color],
    [x - t / 2, y - size / 2, h, t, size, 0.03, color, color],
    [x - t / 2, y - t / 2, h + 0.03, t, t, 0.03, C.heart, C.heart],
  ];
}

/**
 * Quader eines Felds mit Fülle oder Schneewehe; null: keine Fülle. `glint` 0 … 1: so hell blitzt der Funke auf einem
 * Eisfleck (2D, nicht bei reduzierter Bewegung; in 3D ruht er)
 */
export function fillBoxes(c: Cell, x: number, y: number, glint = 0): Box[] | null {
  const h = c.h;
  const turn = hash(11, x, y) % 2 === 1;
  /** Platz im Feld, je Feld gespiegelt */
  const at = (dx: number, w = 0) => x + (turn ? 1 - dx - w : dx);
  const note = c.note ?? 0;
  switch (c.deco) {
    case 'snowdrift':
      return [
        [x + 0.07, y + 0.22, h, 0.76, 0.56, 0.05, ...C.shadow],
        [x + 0.15, y + 0.3, h, 0.6, 0.4, 0.3, ...C.drift, undefined, SNOW],
        [at(0.44, 0.32), y + 0.36, h + 0.3, 0.32, 0.26, 0.12, ...C.drift, undefined, SNOW],
      ];
    case 'iceflower': {
      const color = C.flowers[note % 2] ?? C.flowers[0];
      return STARS.slice(0, note >= 2 ? 3 : 1 + (hash(12, x, y) % 2)).flatMap(([dx, dy, size]) =>
        star(at(dx), y + dy, h, size, color),
      );
    }
    case 'iceglint': {
      const boxes: Box[] = [
        [at(0.08, 0.8), y + 0.22, h, 0.8, 0.54, 0.012, ...C.glint],
        [at(0.26, 0.5), y + 0.1, h, 0.5, 0.8, 0.012, ...C.glint],
      ];
      const s = 0.1 + glint * 0.14;
      boxes.push([at(0.5) - s / 2, y + 0.46 - s / 2, h + 0.012, s, s, 0.01, C.spark, C.spark]);
      return boxes;
    }
    case 'pebbles':
      return STONES.slice(0, note ? 3 : 1).map(([dx, dy, w, d, hh]): Box => [
        at(dx, w),
        y + dy,
        h,
        w,
        d,
        hh,
        ...C.pebble,
      ]);
    case 'tundra': {
      const boxes = BLADES.map(([dx, dy, hh]): Box => [at(dx, 0.1), y + dy, h, 0.1, 0.1, hh, ...C.tuft]);
      if (note) {
        boxes.push([at(0.2, 0.12), y + 0.6, h, 0.12, 0.12, 0.12, C.berry, C.berry, undefined, BERRY]);
        boxes.push([at(0.62, 0.12), y + 0.6, h, 0.12, 0.12, 0.12, C.berry, C.berry, undefined, BERRY]);
      }
      return boxes;
    }
    default:
      return null;
  }
}
