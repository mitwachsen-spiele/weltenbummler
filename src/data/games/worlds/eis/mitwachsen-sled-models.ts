// Modelle des Schlittens der Eis-Welt, nur im Welt-Paket (Teile wie in `front.ts`: vorn, rechts, unten, Länge, Breite,
// Höhe, Farbe, oben; eigene Voxel-Grafik): ein niedriger, langer Holzschlitten in Himmelblau mit weißer Decke und
// silbernen Kufen, in dem die Figur sitzt (nie auf dem Tier); das Schlittenrentier mit rotem Geschirr und goldenen
// Glöckchen (es gehört zum Schlitten, kein Tier der Leiste, darum nicht in `SPECIES`); der Laternenpfahl am Halt im
// Kessel (bis Issue 25 ein Schuppen aus Eisblöcken). Varianten: goldener Rahmen bis zur ersten Fahrt, Wimpel mit Schneeflocke danach, Laterne am
// Schlitten am Abend und in der Nacht (dann leuchtet auch die am Pfahl), kurz offene Seitenwände beim Anstoßen.
// Spec: docs/specs/mitwachsen.md (Abschnitt „Der Schlitten“)

import type { Part } from '../../../../lib/games/front';
import { LOOK, figureParts } from '../../mitwachsen';
import { FIGURE_LEGS } from '../../mitwachsen-fine';
import { GOLD } from '../../mitwachsen-portals';
import { RIDES } from '../../mitwachsen-rides';
import { ICE_COLORS } from './mitwachsen-ice-colors';
import { ICE_MODELS } from './mitwachsen-ice-models';

const SKY = [RIDES[0].color, '#a6d4f4'] as const; // Himmelblau, oben heller
const SKY_DARK = '#5a94c4';
const RUNNER = ['#b4bec8', '#e6ecf2'] as const; // Silber
const BLANKET = ['#e8eef5', '#ffffff'] as const;
const FRAME = [GOLD.side, GOLD.top] as const;
const HARNESS = ['#c0392b', '#d9573f'] as const;
const LEATHER = '#6b4a36';
const IRON = '#4a4f5a';
const LAMP = ['#ffc94a', '#fff1b8'] as const; // brennt
const GLASS = ['#c9d6e0', '#e8eef3'] as const; // aus

/** Teil auf beiden Seiten: wie angegeben und an der Mitte gespiegelt */
const both = ([f, r, ...rest]: Part): Part[] => [
  [f, r, ...rest],
  [f, -r - rest[2], ...rest],
];
/** Teile um (df, dz) versetzt */
const shift = (parts: readonly Part[], df: number, dz: number): Part[] =>
  parts.map(([f, r, z, ...rest]) => [f + df, r, z + dz, ...rest]);

/** Schlitten (Mitte auf dem Feld des Sitzes, vorn zum Zugtier) */
const SLED: readonly Part[] = [
  ...both([-0.55, 0.24, 0, 1.08, 0.06, 0.04, ...RUNNER]), // Kufen, vorn hochgebogen
  ...both([0.5, 0.24, 0.04, 0.06, 0.06, 0.14, ...RUNNER]),
  ...both([0.4, 0.24, 0.16, 0.14, 0.06, 0.04, ...RUNNER]),
  ...both([-0.4, 0.25, 0.04, 0.05, 0.05, 0.08, SKY_DARK]), // Streben
  ...both([0.2, 0.25, 0.04, 0.05, 0.05, 0.08, SKY_DARK]),
  [-0.5, -0.28, 0.12, 0.95, 0.56, 0.05, ...SKY], // Boden
  [-0.56, -0.28, 0.12, 0.06, 0.56, 0.34, ...SKY], // Lehne
  [0.42, -0.28, 0.17, 0.05, 0.56, 0.1, ...SKY], // Brett vorn
  [0.02, -0.23, 0.17, 0.4, 0.46, 0.08, ...BLANKET], // weiße Decke über den Beinen
];
/** Seitenwände, stehend */
const SIDES: readonly Part[] = both([-0.5, 0.23, 0.17, 0.95, 0.05, 0.14, ...SKY]);
/** Seitenwände, einladend nach außen geklappt (angestoßen: Die Tür geht auf) */
const SIDES_OPEN: readonly Part[] = both([-0.5, 0.28, 0.12, 0.95, 0.14, 0.04, ...SKY]);
/** Goldener Rahmen bis zur ersten Fahrt (wie die Tür eines Fahrzeugs: Hier geht es los) */
const GOLDEN: readonly Part[] = [
  ...both([-0.5, 0.22, 0.31, 0.95, 0.07, 0.03, ...FRAME]),
  [-0.57, -0.29, 0.46, 0.08, 0.58, 0.03, ...FRAME],
];
/** Wimpel mit Schneeflocke nach der ersten Heimfahrt */
const PENNANT: readonly Part[] = [
  [-0.6, 0.18, 0.46, 0.04, 0.04, 0.5, LEATHER], // Stange
  [-0.56, 0.19, 0.74, 0.26, 0.015, 0.2, ...BLANKET], // Wimpel
  [-0.47, 0.205, 0.83, 0.1, 0.006, 0.025, ...SKY], // Schneeflocke
  [-0.43, 0.205, 0.79, 0.025, 0.006, 0.1, ...SKY],
  [-0.47, 0.179, 0.83, 0.1, 0.006, 0.025, ...SKY],
  [-0.43, 0.179, 0.79, 0.025, 0.006, 0.1, ...SKY],
];
/** Laterne am Schlitten, am Abend und in der Nacht */
const LANTERN: readonly Part[] = [
  [0.44, -0.31, 0.22, 0.03, 0.03, 0.32, IRON],
  [0.4, -0.35, 0.42, 0.1, 0.1, 0.12, ...LAMP],
  [0.39, -0.36, 0.54, 0.12, 0.12, 0.03, IRON],
];
/** Die Figur sitzt im Schlitten: ohne Beine (sie liegen unter der Decke), etwas tiefer, an der Lehne */
const RIDER: readonly Part[] = shift(figureParts(LOOK).slice(FIGURE_LEGS), -0.22, -0.16);

/** Variante des Schlittens */
export type SledLook = { frame: boolean; pennant: boolean; lamp: boolean; seated: boolean; open: boolean };
/** Teile des Schlittens in seiner Variante */
export const sledParts = (k: SledLook): Part[] => [
  ...SLED,
  ...(k.open ? SIDES_OPEN : SIDES),
  ...(k.frame ? GOLDEN : []),
  ...(k.pennant ? PENNANT : []),
  ...(k.lamp ? LANTERN : []),
  ...(k.seated ? RIDER : []),
];

/** Das Schlittenrentier (Mitte auf dem Feld vor dem Sitz) mit Geschirr, Glöckchen und Zugriemen zum Schlitten */
export const REINDEER: readonly Part[] = [
  ...ICE_MODELS.rentier,
  [0.14, -0.14, 0.4, 0.12, 0.28, 0.06, ...HARNESS], // Halsband
  [-0.1, -0.145, 0.25, 0.06, 0.29, 0.26, ...HARNESS], // Bauchgurt
  ...both([0.2, 0.12, 0.33, 0.06, 0.05, 0.06, ...FRAME]), // Glöckchen
  [0.27, -0.03, 0.32, 0.05, 0.06, 0.06, ...FRAME],
  ...both([-0.44, 0.13, 0.32, 0.36, 0.02, 0.025, LEATHER]), // Zugriemen zum Schlitten
];

const POST = '#8a6a4c'; // Holz des Pfahls
/** Laternenpfahl am Halt im Kessel (Mitte auf seinem Feld, der Arm nach vorn zur Strecke), Schnee am Fuß und obenauf */
const POST_PARTS: readonly Part[] = [
  [-0.2, -0.2, 0, 0.4, 0.4, 0.07, ...ICE_COLORS.snow],
  [-0.07, -0.07, 0, 0.14, 0.14, 1.2, POST],
  [-0.1, -0.1, 1.2, 0.2, 0.2, 0.06, ...ICE_COLORS.snow],
  [0.07, -0.03, 1.04, 0.3, 0.06, 0.06, POST], // Arm
  [0.27, -0.015, 0.98, 0.03, 0.03, 0.06, IRON], // Haken der Laterne
];
/** Laternenpfahl; seine Laterne brennt am Abend und in der Nacht (`lit`) */
export const postParts = (lit: boolean): Part[] => [
  ...POST_PARTS,
  [0.21, -0.07, 0.78, 0.15, 0.14, 0.18, ...(lit ? LAMP : GLASS)],
  [0.2, -0.08, 0.96, 0.17, 0.16, 0.03, IRON],
];
