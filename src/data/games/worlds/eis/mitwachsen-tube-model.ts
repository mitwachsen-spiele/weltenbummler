// Modelle am Rodelberg der Eis-Welt (Issue 50), nur im Welt-Paket der Eis-Welt (Teile wie in `front.ts`: vorn, rechts,
// unten, Länge, Breite, Höhe, Farbe, oben; eigene Voxel-Grafik): der runde Rodelreifen in Rot, bis
// zur ersten Abfahrt mit einem goldenen Griff (Gold: Hier kann das Kind etwas tun), die Fahne auf dem Gipfel, die Stufe
// der Treppe (Quader im Feld) und die Farben der Bahn. Alle Teile des Reifens haben ihre Mitte in der Mitte des Felds:
// 2D reiht Teile nach ihrer Mitte (front.ts), so liegt die Figur in jeder Fahrtrichtung obenauf.
// Spec: docs/specs/mitwachsen.md (Abschnitt „Der Rodelberg“)

import type { Part } from '../../../../lib/games/front';
import { LOOK, figureParts } from '../../mitwachsen';
import { FIGURE_LEGS, dress } from '../../mitwachsen-fine';
import { RIDES } from '../../mitwachsen-rides';
import { GOLD } from '../../mitwachsen-portals';
import { ICE_COLORS } from './mitwachsen-ice-colors';

const RED = [RIDES.find((r) => r.id === 'rodel')!.color, '#f26a5e'] as const;
export const TUBE_COLORS = {
  tube: RED,
  hole: '#7a2a2a',
  pole: ['#6b4a2b', '#7d5a36'],
  step: ['#b98a58', '#c99a66'], // Stufen aus Holz
  seam: '#8a633c',
  knob: '#d9dce6', // Knauf oben auf dem Mast (Silber, kein Gold)
  run: ICE_COLORS.ice, // die Bahn: blankes Eis, kräftiger als die Rutschspur, damit man sie auf dem Schnee sieht
} as const;

/** Feinheit (Entwurf „Feine Grafik“): Reifen und Wimpel glänzen wie Lack, der Mast aus Holz */
const FINE = { [TUBE_COLORS.tube[0]]: { skin: 'lack' }, [TUBE_COLORS.pole[0]]: { skin: 'holz' } } as const;

/** Der Reifen: zwei gekreuzte Quader (gestuft rund), in der Mitte das Loch */
const RING: readonly Part[] = dress(
  [
    [-0.42, -0.26, 0, 0.84, 0.52, 0.24, ...TUBE_COLORS.tube],
    [-0.26, -0.42, 0, 0.52, 0.84, 0.24, ...TUBE_COLORS.tube],
    [-0.17, -0.17, 0.24, 0.34, 0.34, 0.006, TUBE_COLORS.hole],
  ],
  FINE,
);
/** Goldener Griff quer über dem Reifen, bis zur ersten Abfahrt */
const GRIP: readonly Part[] = [[-0.05, -0.3, 0.24, 0.1, 0.6, 0.07, GOLD.side, GOLD.top]];
/** Die Figur sitzt im Reifen: ohne Beine, Kopf und Schultern schauen heraus */
const FIGURE: readonly Part[] = figureParts(LOOK)
  .slice(FIGURE_LEGS)
  .map(([f, r, z, ...rest]): Part => [f, r, z - 0.28, ...rest]);

/** Der Rodelreifen: leer, mit goldenem Griff (`gold`) oder mit der Figur darin (`rider`) */
export const tubeParts = (k: { gold?: boolean; rider?: boolean }): Part[] => [
  ...RING,
  ...(k.gold ? GRIP : []),
  ...(k.rider ? FIGURE : []),
];

/** Fahne auf dem Gipfel: hoher Mast mit silbernem Knauf, roter Wimpel zur Seite; von weitem zu sehen */
export const HILL_FLAG: readonly Part[] = dress(
  [
    [-0.05, -0.05, 0, 0.1, 0.1, 1.9, ...TUBE_COLORS.pole],
    [-0.065, -0.065, 1.9, 0.13, 0.13, 0.07, TUBE_COLORS.knob, null, undefined, { skin: 'metall' }],
    [-0.03, -0.55, 1.5, 0.06, 0.5, 0.34, ...TUBE_COLORS.tube],
    [-0.03, -0.75, 1.58, 0.06, 0.2, 0.18, ...TUBE_COLORS.tube],
  ],
  FINE,
);
