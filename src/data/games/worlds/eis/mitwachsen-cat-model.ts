// Modell der Schneeraupe, der Rundfahrt der Eis-Welt (Issue 54), nur im Welt-Paket der Eis-Welt (Teile wie in
// `front.ts`: vorn, rechts, unten, Länge, Breite, Höhe, Farbe, oben; eigene Voxel-Grafik): eine kleine Pistenraupe in
// Mint auf zwei dunklen Ketten, vorn ein Räumschild und eine Lampe, oben eine offene Kabine, in der die Figur sitzt. Bis
// zur ersten Fahrt ein goldener Tritt an der Seite (Gold: Hier kann das Kind etwas tun). Lange Teile haben ihre Mitte in
// der Mitte des Felds: 2D reiht Teile nach ihrer Mitte (front.ts), so liegt die Figur in jeder Fahrtrichtung obenauf.
// Dazu das Schild am Halt mit der Zahl 4 (die Halte in der Reihenfolge, in der das Kind sie kennenlernt).
// Spec: docs/specs/mitwachsen.md (Abschnitt „Die Schneeraupe“)

import type { Part } from '../../../../lib/games/front';
import { LOOK, figureParts } from '../../mitwachsen';
import { FIGURE_LEGS, dress, fine, type Dress } from '../../mitwachsen-fine';
import { HALT_NUMBER, numberBadge } from '../../mitwachsen-digits';
import { GOLD } from '../../mitwachsen-portals';
import { RIDES } from '../../mitwachsen-rides';

const MINT = [RIDES.find((r) => r.id === 'raupe')!.color, '#5fd3bd'] as const;
export const CAT_COLORS = {
  body: MINT,
  track: ['#2f3540', '#444b58'],
  cabin: ['#2a8f7e', '#37a892'],
  window: '#1f4f4a',
  blade: ['#c9d3de', '#e3eaf1'],
  lamp: '#fff3b0',
  lampOff: '#d9cfb4',
  post: ['#6b4a2b', '#7d5a36'],
  board: MINT,
  piste: ['#dbe6f0', '#e6eef6'], // gewalzter Schnee der Runde: eine Spur dunkler als der Schnee ringsum
  roller: '#5a616e', // Laufrollen außen an den Ketten
} as const;

/**
 * Feinheit (Entwurf „Feine Grafik“): Wanne, Kabine und Tafel in Lack, Ketten, Rollen und Räumschild aus Metall, der
 * Pfosten des Schilds aus Holz; die Lampe leuchtet, wenn sie an ist
 */
const CAT_DRESS: Dress = {
  [MINT[0]]: { skin: 'lack' },
  [CAT_COLORS.cabin[0]]: { skin: 'lack' },
  [CAT_COLORS.track[0]]: { skin: 'metall' },
  [CAT_COLORS.roller]: { skin: 'metall' },
  [CAT_COLORS.blade[0]]: { skin: 'metall' },
  [CAT_COLORS.post[0]]: { skin: 'holz' },
};

const HW = 0.36;
/** Ketten, Wanne und Kabinenrand: alles mittig, die Kabine oben offen; außen an den Ketten je drei Laufrollen */
const BODY: readonly Part[] = dress(
  [
    [-0.44, -HW - 0.04, 0, 0.88, 0.18, 0.2, ...CAT_COLORS.track],
    [-0.44, HW - 0.14, 0, 0.88, 0.18, 0.2, ...CAT_COLORS.track],
    [-0.4, -HW + 0.06, 0.12, 0.8, 2 * HW - 0.12, 0.3, ...CAT_COLORS.body],
    [-0.3, -HW + 0.02, 0.42, 0.6, 2 * HW - 0.04, 0.2, ...CAT_COLORS.cabin],
    [-0.3, -HW + 0.016, 0.48, 0.6, 2 * HW - 0.032, 0.1, CAT_COLORS.window],
    ...[-0.32, -0.05, 0.22].flatMap((f): Part[] => [
      [f, -HW - 0.046, 0.05, 0.1, 0.006, 0.1, CAT_COLORS.roller],
      [f, HW + 0.04, 0.05, 0.1, 0.006, 0.1, CAT_COLORS.roller],
    ]),
  ],
  CAT_DRESS,
);
/** Räumschild vorn */
const BLADE: readonly Part[] = dress(
  [[0.42, -HW - 0.02, 0.04, 0.06, 2 * HW + 0.04, 0.3, ...CAT_COLORS.blade]],
  CAT_DRESS,
);
/** Lampe vorn auf der Wanne, aus oder an (an: leuchtet weich) */
const lamp = (lit: boolean): Part =>
  lit
    ? fine([0.3, -0.08, 0.42, 0.1, 0.16, 0.12, CAT_COLORS.lamp], { halo: true })
    : [0.3, -0.08, 0.42, 0.1, 0.16, 0.12, CAT_COLORS.lampOff];
/** Goldener Tritt an beiden Seiten, bis zur ersten Fahrt */
const STEP: readonly Part[] = [
  [-0.12, -HW - 0.1, 0.2, 0.24, 0.06, 0.05, GOLD.side, GOLD.top],
  [-0.12, HW + 0.04, 0.2, 0.24, 0.06, 0.05, GOLD.side, GOLD.top],
];
/** Die Figur sitzt in der Kabine: ohne Beine, Kopf und Schultern schauen heraus */
const FIGURE: readonly Part[] = figureParts(LOOK)
  .slice(FIGURE_LEGS)
  .map(([f, r, z, ...rest]): Part => [f, r, z + 0.02, ...rest]);

/** Die Schneeraupe: Lampe an (`lit`), goldener Tritt (`gold`), die Figur in der Kabine (`rider`) */
export const catParts = (k: { lit?: boolean; gold?: boolean; rider?: boolean }): Part[] => [
  ...BODY,
  ...BLADE,
  lamp(!!k.lit),
  ...(k.gold ? STEP : []),
  ...(k.rider ? FIGURE : []),
];

/** Schild am Halt (zur Kamera): Pfosten, Tafel in Mint, darauf die Zahl 4 */
export const CAT_SIGN: readonly Part[] = [
  ...dress(
    [
      [-0.05, -0.05, 0, 0.1, 0.1, 1.05, ...CAT_COLORS.post],
      [0, -0.3, 1.0, 0.06, 0.6, 0.5, ...CAT_COLORS.board],
    ],
    CAT_DRESS,
  ),
  ...numberBadge(HALT_NUMBER.raupe, 0.06, 0, 1.44, 0.055), // die Zahl bleibt scharf, ohne Muster
];
