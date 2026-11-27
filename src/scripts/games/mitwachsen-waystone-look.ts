// Bild eines Wegsteins (mitwachsen-waystone.ts) für 2D und 3D: eine flache graue Platte mit einer kleinen Einlage.
// Schlafend ist die Einlage matt und dunkel, wach hat sie die Farbe ihrer Welt (`THEME_COLORS.portal`, wie der Rand der
// Torplatte); so unterscheiden sich beide Zustände auch in der Helligkeit, nicht nur im Farbton. Fein (Entwurf „Feine
// Grafik“, Paket P7): Platte mit Verlauf und heller Oberkante, ohne Muster (es gibt keinen Stein-Skin), hinten links ein
// Moospolster; die wache Einlage leuchtet weich (`halo`), die schlafende nicht.

import { THEME_COLORS, type GateId } from '../../data/games/mitwachsen';
import type { Box } from './mitwachsen-view';

export const WAYSTONE_COLORS = {
  side: '#74777b',
  top: '#9a9da1',
  asleep: '#6b6e73',
  moss: '#5a9a40',
  mossTop: '#6aa84f',
} as const;

/**
 * Die Quader des Wegsteins der Welt `id` auf dem Feld (x, y) mit Boden auf Höhe `h`, in Malreihenfolge (Platte,
 * Einlage, Moos); `lit`: Das Tor ist offen
 */
export function waystoneBoxes(x: number, y: number, h: number, id: GateId, lit: boolean): Box[] {
  const inlay = lit ? THEME_COLORS[id].portal : WAYSTONE_COLORS.asleep;
  const c = WAYSTONE_COLORS;
  return [
    [x + 0.2, y + 0.24, h, 0.6, 0.5, 0.07, c.side, c.top, undefined, {}],
    [x + 0.34, y + 0.36, h + 0.07, 0.32, 0.26, 0.03, inlay, inlay, undefined, lit ? { halo: true } : {}],
    [x + 0.22, y + 0.26, h + 0.07, 0.1, 0.06, 0.02, c.moss, c.mossTop, undefined, { skin: 'fell' }],
  ];
}

/** Farben des Glitzerns, das beim Öffnen des Tors über die Steine läuft: die Farbe der Welt und Weiß */
export const waystoneSparks = (id: GateId): string[] => [THEME_COLORS[id].portal, '#ffffff'];
