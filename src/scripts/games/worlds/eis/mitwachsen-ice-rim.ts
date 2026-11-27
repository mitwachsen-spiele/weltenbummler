// Rand der Eis-Welt: dunkles Tiefeis mit Zackenkamm (Issue 37, Review vom 25.11.2026, Punkt 3) – rein, im Welt-Paket der
// Eis-Welt. Die Klippen trugen oben denselben Schnee wie der begehbare Boden: Die Klippe sah oben aus wie der Weg. Darum
// ist die innerste Reihe der Klippen (`Cell.rim`: jedes Klippenfeld mit einem begehbaren Nachbarn, auch schräg) dunkles
// Tiefeis, eine Farbe, die es auf begehbarem Boden nicht gibt, mit einem Kamm aus Zacken obenauf; der Schnee liegt erst
// dahinter. Zacken zeigen nach oben und sind keine Zapfen: Hängende Zapfen gehören dem Glockenspiel. Höhen und Felder
// bleiben, wie sie waren (die Lage des Glockenspiels hängt an der Klippe), auch in alten Spielständen. Der Eisfall am
// Talende behält sein eigenes Bild. Regel für alle Ränder: docs/specs/mitwachsen.md (Abschnitt „Welt“)

import type { Point } from '../../../../data/games/mitwachsen';
import type { Cell } from '../../mitwachsen-cell';
import type { Box } from '../../mitwachsen-view';
import type { Fine } from '../../../../lib/games/front';

/** Tiefeis der innersten Reihe: Seite, Oberseite, helle Spitze der Zacken */
export const DEEP_ICE = { side: '#2c5884', top: '#3a74a6', tip: '#8fc4e8' } as const;

const key = (x: number, y: number) => `${x},${y}`;

/** Die innerste Reihe der Klippen markieren (`map` wird geändert); liefert ihre Felder */
export function markIceRim(cells: readonly Point[], map: Map<string, Cell>): Point[] {
  const walk = (c: Cell | undefined) => !!c && c.region === 'eis' && !c.solid;
  const out: Point[] = [];
  for (const [x, y] of cells) {
    const c = map.get(key(x, y));
    if (!c || c.region !== 'border' || c.deco !== 'rock' || c.ground !== 'ice' || c.color) continue; // nicht der Eisfall
    let beside = false;
    for (let dy = -1; dy <= 1 && !beside; dy++)
      for (let dx = -1; dx <= 1; dx++) if (walk(map.get(key(x + dx, y + dy)))) beside = true;
    if (!beside) continue;
    map.set(key(x, y), { ...c, rim: true });
    out.push([x, y]);
  }
  return out;
}

/** Feinheit der Zacken: Eisblock mit Fugen */
const BLOCK: Fine = { skin: 'eisblock' };

/**
 * Zackenkamm auf einem Feld des Tiefeises: drei spitze Zacken verschiedener Höhe, fest aus der Lage, jede mit heller
 * Spitze. Für 2D und 3D dieselben Quader; fein: die Zacken aus Eisblock
 */
export function crestBoxes(c: Cell, x: number, y: number): Box[] {
  if (!c.rim) return [];
  const n = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 4;
  const { side, top, tip } = DEEP_ICE;
  const spike = (dx: number, dy: number, w: number, h: number): Box[] => [
    [x + dx, y + dy, c.h, w, w, h, side, top, undefined, BLOCK],
    [x + dx + w * 0.25, y + dy + w * 0.25, c.h + h, w * 0.5, w * 0.5, h * 0.45, top, tip],
  ];
  return [
    ...spike(0.08 + 0.04 * n, 0.14, 0.26, 0.42 + 0.08 * n),
    ...spike(0.42, 0.46 - 0.05 * n, 0.3, 0.7 - 0.07 * n),
    ...spike(0.7 - 0.03 * n, 0.12 + 0.06 * n, 0.22, 0.36 + 0.05 * n),
  ];
}
