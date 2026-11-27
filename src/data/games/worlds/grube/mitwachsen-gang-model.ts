// Modelle am Glitzergang der Grubenbahn, nur im Paket der Grubenbahn (Teile wie in `front.ts`: vorn, rechts, unten,
// Länge, Breite, Höhe, Farbe, oben; eigene Voxel-Grafik nach der Konzeptseite „Höhle nach dem ersten Spielen“, Punkt 7):
// das Klingeltor (ein Bogen aus hellem Stein, darunter fünf hängende Kristallröhren; leuchten sie, fährt Funkel gerade
// hindurch oder das Kind hat es angestoßen), darauf die runde Scheibe mit einem Bähnchen-Bild in Petrol mit cremefarbenem
// Rand (kein Rot-Grün-Signal, keine gelb-schwarzen Streifen, kein Gold: Das Tor ist keine Aktion), die Kristalle in der
// Wand des Gangs (matt oder leuchtend, die Glitzerwelle) und der kleine Wasserfall mit seinem Becken neben dem Gleis.
// Fein (Entwurf „Feine Grafik“, Issue 13): Bänder und Nieten aus Metall am Bogen, die klingenden Röhren und die
// Kristalle der Glitzerwelle leuchten (`halo`), jeder Wandkristall hat eine Lichtkante, die Scheibe ist aus Lack.
// Spec: docs/specs/mitwachsen.md („Die Grubenbahn Funkel“, Klingeltore und Glitzergang)

import type { Fine, Part } from '../../../../lib/games/front';
import { dress, fine } from '../../mitwachsen-fine';
import { FUNKEL_COLORS } from './mitwachsen-funkel-model';

/** Farben am Glitzergang, je Seite und Oberseite */
export const GANG_COLORS = {
  stone: ['#d9d3e6', '#ebe6f3'], // heller Stein des Bogens
  tube: ['#cdbdf5', '#e4dbff'], // Kristallröhre, still
  ring: ['#f4eeff', '#ffffff'], // Kristallröhre, klingend
  crystal: ['#a993dc', '#c4b2ef'], // Wandkristall, matt
  shine: ['#f2e8ff', '#ffffff'], // Wandkristall in der Glitzerwelle
  fall: ['#6fd3d9', '#a6ecee'], // Wasserfall
  streak: '#e3fcff', // helle Streifen im fallenden Wasser
  pool: ['#3fb0ba', '#62c9d0'], // Becken
  rim: ['#9a93ad', '#b3adc4'], // Steine am Becken
  metal: '#9aa0ab', // Bänder und Nieten am Bogen
  edge: '#ffffff', // Lichtkante am Kristall
} as const;

const HALO: Fine = { halo: true };
const METAL: Fine = { skin: 'metall' };
const LACK: Fine = { skin: 'lack' };
/** Plättchen aus Metall vorn und hinten auf einer Fläche bei `f0` … `f1` (knapp davor) */
const plates = (f0: number, f1: number, r: number, z: number, w: number, h: number): Part[] =>
  [f1, f0 - 0.006].map((f) => fine([f, r, z, 0.006, w, h, GANG_COLORS.metal], METAL));
/** Ein Band rundum einen Pfosten (`f0` … `f1`, `r0` … `r1`): vorn und hinten, dazu beide Seiten über die Ecken hinweg */
const band = (f0: number, f1: number, r0: number, r1: number, z: number, h: number): Part[] => [
  ...plates(f0, f1, r0, z, r1 - r0, h),
  ...[r0 - 0.006, r1].map((r) => fine([f0 - 0.006, r, z, f1 - f0 + 0.012, 0.006, h, GANG_COLORS.metal], METAL)),
];

/** Höhe des Bogens: Unterkante des Sturzes (die Figur im Wagen reicht bis 1,18, die Röhren hängen darüber) */
export const ARCH_H = 1.55;
/** Dicke des Sturzes */
const LINTEL = 0.16;
/** So weit hebt sich die Scheibe, wenn Funkel hindurchfährt */
export const LIFT = 0.24;
/** Unterkante der Scheibe über dem Feld */
export const DISC_Z = ARCH_H + LINTEL;

const S = GANG_COLORS.stone;

/**
 * Das Klingeltor quer über dem Gleis (vorn = Fahrtrichtung): zwei Pfosten an den Rändern des Felds, der Sturz darüber,
 * darunter fünf Röhren, nach außen kürzer (wie ein Glockenspiel); `ringing`: Sie leuchten
 */
export const gateParts = (ringing: boolean): Part[] => {
  const tube = ringing ? GANG_COLORS.ring : GANG_COLORS.tube;
  return [
    [-0.12, -0.5, 0, 0.24, 0.1, ARCH_H, ...S],
    [-0.12, 0.4, 0, 0.24, 0.1, ARCH_H, ...S],
    [-0.15, -0.52, -0.001, 0.3, 0.14, 0.12, S[0], S[0]], // Füße der Pfosten
    [-0.15, 0.38, -0.001, 0.3, 0.14, 0.12, S[0], S[0]],
    [-0.14, -0.54, ARCH_H, 0.28, 1.08, LINTEL, ...S],
    ...[0.18, 0.26, 0.3, 0.26, 0.18].map((len, i): Part => {
      const p: Part = [-0.025, -0.27 + i * 0.12, ARCH_H - len, 0.05, 0.06, len, ...tube];
      return ringing ? fine(p, HALO) : p; // klingend leuchten sie weich in den Raum
    }),
    // Bänder rundum die Pfosten (auch von der Seite zu sehen, wenn das Gleis quer zur Kamera läuft), Nieten im Sturz vorn und hinten
    ...[-0.5, 0.4].flatMap((r) => [0.45, 1.15].flatMap((z) => band(-0.12, 0.12, r, r + 0.1, z, 0.05))),
    ...[-0.44, -0.2, 0.17, 0.41].flatMap((r) => plates(-0.14, 0.14, r, ARCH_H + 0.065, 0.03, 0.03)),
  ];
};

const [P, C] = [FUNKEL_COLORS.petrol, FUNKEL_COLORS.cream];
/**
 * Die runde Scheibe, flach zur Kamera (Blick nach Süden: vorn ist die Kamera), gestuft rund: cremefarbener Rand, innen
 * Petrol, darauf ein kleines Bähnchen in Creme (Lok mit Schornstein, ein Wagen, Räder)
 */
export const DISC_PARTS: readonly Part[] = dress(
  [
    [-0.02, -0.16, 0, 0.03, 0.32, 0.44, ...C],
    [-0.02, -0.22, 0.06, 0.03, 0.44, 0.32, ...C],
    [-0.01, -0.13, 0.04, 0.03, 0.26, 0.36, ...P],
    [-0.01, -0.18, 0.09, 0.03, 0.36, 0.26, ...P],
    [0.01, -0.12, 0.17, 0.02, 0.1, 0.09, ...C], // Wagen
    [0.01, 0.0, 0.17, 0.02, 0.12, 0.11, ...C], // Lok
    [0.01, 0.06, 0.28, 0.02, 0.03, 0.05, ...C], // Schornstein
    [0.01, -0.1, 0.14, 0.02, 0.04, 0.03, ...C], // Räder
    [0.01, 0.02, 0.14, 0.02, 0.04, 0.03, ...C],
    [0.01, 0.07, 0.14, 0.02, 0.04, 0.03, ...C],
  ],
  Object.fromEntries([...P, ...C].map((c) => [c, LACK])),
);

/**
 * Kristall in der Wand des Gangs: drei Spitzen auf einem Felsfuß, vorn an der großen eine Lichtkante; `lit` in der
 * Glitzerwelle hell, dann leuchtet die große Spitze weich in den Raum
 */
export const crystalParts = (lit: boolean): Part[] => {
  const [k, t] = lit ? GANG_COLORS.shine : GANG_COLORS.crystal;
  const spike: Part = [-0.08, -0.16, 0.1, 0.14, 0.14, 0.5, k, t];
  return [
    [-0.22, -0.22, 0, 0.44, 0.44, 0.1, ...GANG_COLORS.rim],
    lit ? fine(spike, HALO) : spike,
    [0.065, -0.15, 0.32, 0.005, 0.035, 0.24, GANG_COLORS.edge, GANG_COLORS.edge],
    [-0.12, 0.02, 0.1, 0.14, 0.14, 0.36, t, k],
    [0.04, -0.04, 0.1, 0.12, 0.12, 0.28, k, t],
  ];
};

/** So viele Stufen hat das Gleiten der Streifen im Wasserfall */
export const FALL_PHASES = 3;
/** Höhe, aus der das Wasser fällt */
const FALL_H = 2.3;

/**
 * Der kleine Wasserfall an der Wand des Gangs (flach zur Kamera), unten sein Becken mit hellen Steinen; `phase`: wie weit
 * die hellen Streifen hinabgeglitten sind (0 … `FALL_PHASES` − 1; bei reduzierter Bewegung stehen sie)
 */
export const fallParts = (phase: number): Part[] => [
  [-0.36, -0.36, 0, 0.72, 0.72, 0.04, ...GANG_COLORS.rim],
  [-0.3, -0.3, 0.02, 0.6, 0.6, 0.04, ...GANG_COLORS.pool],
  [-0.34, -0.12, 0.06, 0.12, 0.24, FALL_H - 0.06, ...GANG_COLORS.fall],
  ...[0, 1, 2, 3].map((i): Part => [
    -0.21,
    -0.1 + (i % 2) * 0.12,
    FALL_H - 0.3 - ((i * 0.55 + (phase * 0.55) / FALL_PHASES) % 2.0),
    0.01,
    0.08,
    0.22,
    GANG_COLORS.streak,
    GANG_COLORS.streak,
  ]),
];
