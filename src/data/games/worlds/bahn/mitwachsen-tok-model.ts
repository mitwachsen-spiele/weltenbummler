// Modell von Tok, dem Gleisbauer, nur im Paket der Bahn (Teile wie in `front.ts`: vorn, rechts, unten, Länge, Breite,
// Höhe, Farbe, oben). Nach der Skizze „Tok von vorn“ im Konzept, mit den Farben aus dem Konzept: rund, großer Kopf,
// kurze Beine, etwa 0,8-mal so groß wie die Figur; roter Helm mit gelbem Lampenblock (leuchtet weich, kein Punktlicht), oben
// sitzt der Maulwurf mit rosa Händen und heller Brille, weißgrauer Schnurrbart, rosa Wangen, oranges Hemd, moosgrüne
// Latzhose, braune Stiefel, die Spitzhacke über der Schulter (Holzstiel, grauer T-Kopf). Bewusst nicht Cyan mit Blau und
// kein Gold. Keine Zähne. Der Kern kennt Name, Ton und Gangart (`TOK_SPECIES` in mitwachsen-hoehle.ts); das Modell trägt
// die Spielseite ein, wenn das Paket ankommt (`addModels`).
// Fein (Entwurf „Feine Grafik“, Issue 13): Stoff auf Hemd und Latzhose, Lack auf Helm und Stiefeln, Holz am Stiel und
// Metall am Kopf der Hacke, Fell auf Schnurrbart und Maulwurf, die Helmlampe leuchtet (`halo`); dazu eine Brusttasche am
// Latz und zwei Knöpfe an den Trägern (silbern, kein Gold). Den Glanz in den Augen hat `eyes` schon. Die Zusatzteile
// ändern den Umriss nicht, den „Noch nicht“ aus dem Modell rastert.
// Spec: docs/specs/mitwachsen.md („Tok und die Bahn“, Tok erscheint)

import { eyes, type Part } from '../../../../lib/games/front';
import { dress, type Dress } from '../../mitwachsen-fine';

/** Farben von Tok (Konzept „Der Gleisbauer Tok“) */
export const TOK_COLORS = {
  helm: '#d9483b',
  brim: '#b83a2f',
  lamp: '#ffe08a',
  skin: '#f2c9a0',
  cheek: '#f2a7b8',
  nose: '#e4a982',
  stache: '#e8e4dc',
  shirt: '#e8833a',
  overall: '#5c7a3a',
  boot: '#6e4a30',
  wood: '#8a5a34',
  pick: '#8c8fa0',
  mole: '#2e2b33',
  pink: '#f2a7b8',
  glass: '#e8e4f3',
  pocket: '#4c6a2e',
  button: '#d9dce6',
} as const;

/** Lila-graue Steinkrümel, wenn Tok erscheint (statt Schnee wie beim Pinguin) */
export const TOK_CRUMBS = ['#8c8fa0', '#9a8fb8', '#7d7696', '#c9c6d6'] as const;

/** So viel kleiner als die Skizze: Der Helm endet bei gut 0,9 Feldern, gut drei Viertel der Figur (1,18) */
const K = 0.68;

/**
 * Teil aus der Skizze (x nach rechts im Bild, y nach oben, z vom Betrachter weg, Tok schaut zum Betrachter), auf seine
 * Größe gebracht: als Teil des Modells, das nach vorn (+x im Modell) schaut
 */
const s = (x: number, y: number, z: number, w: number, h: number, d: number, c: string, top?: string): Part =>
  top
    ? [-(z + d) * K, -(x + w) * K, y * K, d * K, w * K, h * K, c, top]
    : [-(z + d) * K, -(x + w) * K, y * K, d * K, w * K, h * K, c];

const C = TOK_COLORS;

/** Muster je Farbe: Stoff, Lack, Holz, Metall, Fell; die Helmlampe leuchtet */
const TOK_DRESS: Dress = {
  [C.shirt]: { skin: 'stoff' },
  [C.overall]: { skin: 'stoff' },
  [C.pocket]: { skin: 'stoff' },
  [C.helm]: { skin: 'lack' },
  [C.brim]: { skin: 'lack' },
  [C.boot]: { skin: 'lack' },
  [C.wood]: { skin: 'holz' },
  [C.pick]: { skin: 'metall' },
  [C.stache]: { skin: 'fell' },
  [C.mole]: { skin: 'fell' },
  [C.lamp]: { halo: true },
};

/**
 * Zusatzteile: Brusttasche am Latz, zwei Knöpfe an den Trägern. Keine Sohlen vorn an den Stiefeln (wie im Entwurf): Sie
 * ragten vor die Stiefel und machten den Umriss für „Noch nicht“ an der Spitze dicker
 */
const DETAILS: readonly Part[] = [
  s(-0.06, 0.3, -0.225, 0.12, 0.1, 0.015, C.pocket),
  s(-0.22, 0.6, -0.228, 0.04, 0.04, 0.008, C.button),
  s(0.18, 0.6, -0.228, 0.04, 0.04, 0.008, C.button),
];

/** Tok von vorn ohne den Maulwurf (der sitzt in `MOLE_ON_HELM`) */
const TOK_BASE: readonly Part[] = [
  // Spitzhacke hinten über der Schulter: Stiel aus vier Voxeln Holz, Kopf als flaches T in Felsgrau
  ...[0, 1, 2, 3].map((i) => s(0.36 + i * 0.05, 0.42 + i * 0.2, 0.05, 0.09, 0.2, 0.09, C.wood)),
  s(0.12, 1.18, 0.02, 0.62, 0.08, 0.12, C.pick),
  s(0.1, 1.12, 0.02, 0.08, 0.08, 0.12, C.pick),
  s(0.68, 1.12, 0.02, 0.08, 0.08, 0.12, C.pick),
  // Stiefel, kurze Beine der Latzhose, Bauch
  s(-0.3, 0, -0.17, 0.26, 0.12, 0.32, C.boot),
  s(0.04, 0, -0.17, 0.26, 0.12, 0.32, C.boot),
  s(-0.28, 0.12, -0.14, 0.22, 0.14, 0.26, C.overall),
  s(0.06, 0.12, -0.14, 0.22, 0.14, 0.26, C.overall),
  s(-0.35, 0.26, -0.21, 0.7, 0.2, 0.42, C.overall),
  // Hemd mit den Trägern der Latzhose, Ärmel und Hände
  s(-0.35, 0.46, -0.21, 0.7, 0.2, 0.42, C.shirt),
  s(-0.25, 0.46, -0.22, 0.1, 0.2, 0.02, C.overall),
  s(0.15, 0.46, -0.22, 0.1, 0.2, 0.02, C.overall),
  s(-0.47, 0.34, -0.14, 0.12, 0.3, 0.26, C.shirt),
  s(0.35, 0.34, -0.14, 0.12, 0.3, 0.26, C.shirt),
  s(-0.47, 0.26, -0.14, 0.12, 0.08, 0.26, C.skin),
  s(0.35, 0.26, -0.14, 0.12, 0.08, 0.26, C.skin),
  // großer Kopf: Wangen, Knubbelnase, Schnurrbart (4 × 1), Augen vorn und an den Seiten
  s(-0.33, 0.66, -0.27, 0.66, 0.5, 0.54, C.skin),
  s(-0.29, 0.82, -0.28, 0.1, 0.06, 0.02, C.cheek),
  s(0.19, 0.82, -0.28, 0.1, 0.06, 0.02, C.cheek),
  s(-0.05, 0.82, -0.31, 0.1, 0.1, 0.04, C.nose),
  s(-0.16, 0.76, -0.29, 0.32, 0.06, 0.03, C.stache),
  ...eyes(0.27 * K, 0.33 * K, 0.92 * K, 0.06, 0.07, 0.11 * K),
  // roter Helm mit Krempe und gelbem Lampenblock vorn
  s(-0.37, 1.16, -0.3, 0.74, 0.06, 0.62, C.brim),
  s(-0.35, 1.22, -0.27, 0.7, 0.14, 0.56, C.helm, '#e0574a'),
  s(-0.08, 1.17, -0.32, 0.16, 0.14, 0.03, C.lamp),
];

const TOK_ALONE = dress([...TOK_BASE, ...DETAILS], TOK_DRESS);

/** Der Maulwurf oben auf dem Helm: Körper, Schnauze, rosa Nase, helle Brille, rosa Hände (er winkt) */
const MOLE_PARTS: readonly Part[] = [
  s(-0.15, 1.36, -0.13, 0.3, 0.16, 0.3, C.mole, '#3a3640'),
  s(-0.09, 1.38, -0.18, 0.18, 0.1, 0.05, C.mole),
  s(-0.04, 1.42, -0.2, 0.08, 0.05, 0.02, C.pink),
  s(-0.08, 1.47, -0.19, 0.05, 0.04, 0.02, C.glass),
  s(0.03, 1.47, -0.19, 0.05, 0.04, 0.02, C.glass),
  s(-0.25, 1.42, -0.12, 0.1, 0.06, 0.1, C.pink),
  s(0.15, 1.42, -0.12, 0.1, 0.06, 0.1, C.pink),
];

const MOLE_ON_HELM = dress(MOLE_PARTS, TOK_DRESS);

/** Tok von vorn, wie er steht und hüpft (Gangart `huepfen`), mit dem Maulwurf auf dem Helm */
export const TOK_MODEL: readonly Part[] = [...TOK_ALONE, ...MOLE_ON_HELM];
/**
 * Tok nach Bau 2: Der Maulwurf ist von seinem Helm gehüpft und wohnt im Gehege am Höhlenbett (`Species.solo`, für Tok
 * mit `solo`)
 */
export const TOK_SOLO: readonly Part[] = TOK_ALONE;
