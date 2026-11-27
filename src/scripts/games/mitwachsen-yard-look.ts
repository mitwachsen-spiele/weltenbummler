// Dinge an Haus und Garten aus Quadern (Entwurf „Feine Grafik“), eine Quelle für 2D und 3D wie mitwachsen-deco-look.ts:
// Zaun und Gartentor, Hecke und Rosenbogen, Futter- und Wassertrog, Bett samt Schläfer, Tafel am Tor, Brücke. Alles
// fein mit Mustern (Holz, Blatt, Stoff, Steppdecke), nie mit Kacheln des Geländes. Was sich bewegt (Schläfer, Torflügel,
// Brücke) oder Regeln zeigt (Tiere auf der Tafel), geben die Ansichten als Zustand herein.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Bild“)

import type { Fine } from '../../lib/games/front';
import type { Skin } from '../../lib/games/skins';
import { GAME_COLORS } from '../../data/games/mitwachsen';
import type { Cell } from './mitwachsen-cell';
import { mix } from './mitwachsen-tree-look';
import type { Box } from './mitwachsen-view';

/** Wo die Nachbarn liegen (Hecke, Zaun, Rosenbogen verbinden sich mit ihnen) */
export type Neighbours = { cell(x: number, y: number): Pick<Cell, 'deco'> };

const HOLZ: Fine = { skin: 'holz' },
  BLATT: Fine = { skin: 'blatt' },
  STOFF: Fine = { skin: 'stoff' },
  QUILT: Fine = { skin: 'quilt' },
  HAAR: Fine = { skin: 'haar' },
  METALL: Fine = { skin: 'metall' };
const LEAF = '#3f9a3c',
  LEAF_TOP = '#5ab651';
/** Dicke der Plättchen, die vorn auf einer Fläche liegen (Lichtkanten, Beschläge): vor ihr, ohne Flimmern */
export const PLATE = 0.005;

/** Ein Quader mit Muster */
const q = (
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  side: string,
  top: string,
  fine?: Fine,
  kind?: 'see',
): Box => [x, y, z, w, d, h, side, top, kind, fine];

/** Zaun: Pfosten mit Kappe in der Mitte, Latten zu jedem Nachbarn mit Zaun oder Tor; `closed` < 1 öffnet ein Gartentor */
export function fenceBoxes(world: Neighbours, x: number, y: number, h: number, closed = 1): Box[] {
  const joins = (dx: number, dy: number) => {
    const d = world.cell(x + dx, y + dy).deco;
    return d === 'fence' || d === 'gate';
  };
  const [wood, dark] = [GAME_COLORS.fence, GAME_COLORS.fenceDark];
  const plank = (bx: number, by: number, bz: number, w: number, d: number, hh: number) =>
    q(bx, by, bz, w, d, hh, wood, dark, HOLZ);
  if (world.cell(x, y).deco === 'gate') {
    // Torflügel: offen klappt er zur Seite weg (wird schmaler); oben eine helle Leiste, vorn zwei Beschläge
    if (closed <= 0) return [];
    const along = joins(0, -1) || joins(0, 1);
    const [bx, by, w, d] = along
      ? [x + 0.42, y + 0.5 - 0.5 * closed, 0.16, closed]
      : [x + 0.5 - 0.5 * closed, y + 0.42, closed, 0.16];
    const out = [plank(bx, by, h, w, d, 0.8), q(bx, by, h + 0.8, w, d, 0.04, mix(wood, '#ffffff', 0.2), wood, HOLZ)];
    if (!along)
      for (const z of [0.15, 0.6])
        out.push(q(bx + w * 0.08, by + d, h + z, Math.min(0.12, w * 0.3), PLATE, 0.06, '#4b4f58', '#4b4f58', METALL));
    return out;
  }
  const out = [plank(x + 0.4, y + 0.4, h, 0.2, 0.2, 0.8), q(x + 0.38, y + 0.38, h + 0.8, 0.24, 0.24, 0.05, dark, wood)];
  // Latten vom Pfosten bis zum Feldrand (stecken nicht im Pfosten: 2D malt sich Durchdringendes falsch)
  if (joins(0, -1)) out.push(plank(x + 0.45, y, h + 0.3, 0.1, 0.38, 0.12));
  if (joins(-1, 0)) out.push(plank(x, y + 0.45, h + 0.3, 0.38, 0.1, 0.12));
  if (joins(1, 0)) out.push(plank(x + 0.62, y + 0.45, h + 0.3, 0.38, 0.1, 0.12));
  if (joins(0, 1)) out.push(plank(x + 0.45, y + 0.62, h + 0.3, 0.1, 0.38, 0.12));
  return out;
}

/** Rosenbogen quer zur Hecke: zwei Pfosten aus Holz, Laub obenauf, Rosen darauf mit Blättchen */
function archBoxes(x: number, y: number, h: number, joins: (dx: number, dy: number) => boolean) {
  const vertical = joins(0, -1) || joins(0, 1);
  const at = (along: number, across: number, w: number, d: number): [number, number, number, number] =>
    vertical ? [x + across, y + along, d, w] : [x + along, y + across, w, d];
  const out: Box[] = [0.02, 0.82].map((p) => {
    const [bx, by, w, d] = at(p, 0.38, 0.16, 0.2);
    return q(bx, by, h, w, d, 1.3, GAME_COLORS.fenceDark, GAME_COLORS.fence, HOLZ);
  });
  const [bx, by, w, d] = at(0, 0.34, 1, 0.28);
  out.push(q(bx, by, h + 1.3, w, d, 0.2, LEAF, LEAF_TOP, BLATT));
  for (let i = 0; i < 4; i++) {
    const [rx, ry, rw, rd] = at(0.12 + i * 0.22, 0.43, 0.1, 0.1);
    const rose = i % 2 ? '#e77fb3' : '#ffffff';
    out.push(q(rx, ry, h + 1.5, rw, rd, 0.07, rose, mix(rose, '#f2d14b', 0.25)));
  }
  return out;
}

/** Hecke um den Garten: Blätterbüsche, verbunden mit Nachbarn mit Hecke; der Rosenbogen ist der Eingang */
export function hedgeBoxes(world: Neighbours, x: number, y: number, h: number, arch: boolean): Box[] {
  const joins = (dx: number, dy: number) => {
    const d = world.cell(x + dx, y + dy).deco;
    return d === 'hedge' || d === 'arch';
  };
  if (arch) return archBoxes(x, y, h, joins);
  const leaf = (bx: number, by: number, bz: number, w: number, d: number, hh: number, c = LEAF): Box =>
    q(bx, by, bz, w, d, hh, c, LEAF_TOP, BLATT, 'see');
  const out: Box[] = [];
  // Verbindungen vom Busch in der Mitte bis zum Feldrand
  if (joins(0, -1)) out.push(leaf(x + 0.2, y, h, 0.6, 0.15, 0.7));
  if (joins(-1, 0)) out.push(leaf(x, y + 0.2, h, 0.15, 0.6, 0.7));
  if (joins(1, 0)) out.push(leaf(x + 0.85, y + 0.2, h, 0.15, 0.6, 0.7));
  if (joins(0, 1)) out.push(leaf(x + 0.2, y + 0.85, h, 0.6, 0.15, 0.7));
  out.push(leaf(x + 0.15, y + 0.15, h, 0.7, 0.7, 0.75));
  out.push(leaf(x + 0.3, y + 0.3, h + 0.75, 0.4, 0.4, 0.08, '#4aa843')); // obere Stufe, heller
  if ((x * 31 + y * 17) % 3 === 0) out.push([x + 0.45, y + 0.5, h + 0.83, 0.1, 0.1, 0.05, '#f2d14b', '#f2d14b', 'see']);
  return out;
}

/** Trog aus Holz auf vier Füßchen mit Eisenbändern: Futter (Heu und Möhren) oder Wasser mit Glanz */
export function troughBoxes(x: number, y: number, h: number, water: boolean): Box[] {
  const [wood, woodTop] = ['#8a5a30', '#a0703f'];
  const plank = (bx: number, by: number, bz: number, w: number, d: number, hh: number): Box =>
    q(x + bx, y + by, h + bz, w, d, hh, wood, woodTop, HOLZ);
  const out: Box[] = [
    ...(
      [
        [0.1, 0.2],
        [0.8, 0.2],
        [0.1, 0.72],
        [0.8, 0.72],
      ] as const
    ).map(([fx, fy]): Box => q(x + fx, y + fy, h, 0.1, 0.1, 0.12, '#7a5432', '#7a5432', HOLZ)),
    plank(0.05, 0.15, 0.12, 0.9, 0.72, 0.08),
    plank(0.05, 0.15, 0.2, 0.9, 0.08, 0.28),
    plank(0.05, 0.23, 0.2, 0.08, 0.56, 0.28),
    plank(0.87, 0.23, 0.2, 0.08, 0.56, 0.28),
  ];
  if (water) {
    out.push([x + 0.13, y + 0.23, h + 0.2, 0.74, 0.56, 0.22, '#3f8fd8', '#7fc0f0']);
    for (const [gx, gy, gw] of [
      [0.25, 0.32, 0.22],
      [0.52, 0.55, 0.14],
    ] as const)
      out.push([x + gx, y + gy, h + 0.42, gw, 0.04, PLATE, '#d6eefc', '#d6eefc']); // Glanz auf dem Wasser
  } else {
    out.push([x + 0.13, y + 0.23, h + 0.2, 0.74, 0.56, 0.26, '#d9b85a', '#ecd27a', undefined, { skin: 'fell' }]); // Heu
    for (const [fx, fy] of [
      [0.25, 0.35],
      [0.55, 0.5],
      [0.68, 0.3],
    ] as const) {
      out.push([x + fx, y + fy, h + 0.46, 0.14, 0.06, 0.06, '#f08a3c', '#f08a3c']); // Möhren mit Kraut
      out.push([x + fx + 0.14, y + fy + 0.01, h + 0.46, 0.04, 0.04, 0.05, '#4f9a3c', '#6dbd47']);
    }
  }
  out.push(plank(0.05, 0.79, 0.2, 0.9, 0.08, 0.28)); // vorn zuletzt, mit zwei Eisenbändern
  for (const bx of [0.14, 0.8]) out.push(q(x + bx, y + 0.87, h + 0.2, 0.06, PLATE, 0.28, '#5a5d66', '#5a5d66', METALL));
  return out;
}

/** Rahmen des Betts: Farbe der Seiten, oben (null: wie die Seiten), Muster (Holz; in der Eis-Welt Schnee) */
export type BedFrame = readonly [string, string | null, Skin];
/** Bett aus Holz (Lichtung, Grotte) */
export const WOOD_BED: BedFrame = [GAME_COLORS.bed.frame, null, 'holz'];

/**
 * Bett (Entwurf „bett“): Rahmen, vier Pfosten (hinten hoch mit hellem Knauf), Kopfteil mit Leiste, Kissen, umgeschlagenes
 * Laken und Steppdecke (`quilt`) mit hellem Saum. Ohne Schläfer; der kommt mit `sleeperBoxes` dazu
 */
export function bedBoxes(x: number, y: number, h: number, [side, top, skin]: BedFrame): Box[] {
  const { pillow, blanket } = GAME_COLORS.bed;
  const wood: Fine = { skin };
  const [post, knob, rail] = [mix(side, '#000000', 0.12), mix(side, '#ffffff', 0.3), mix(side, '#ffffff', 0.15)];
  const t = top ?? side;
  const out: Box[] = [];
  for (const px of [x + 0.02, x + 0.9]) {
    out.push(q(px, y + 0.04, h, 0.08, 0.08, 0.76, post, post, wood)); // hinten, hoch
    out.push(q(px - 0.005, y + 0.035, h + 0.76, 0.09, 0.09, 0.05, knob, knob)); // Knauf
    out.push(q(px, y + 0.86, h, 0.08, 0.08, 0.4, post, post, wood)); // vorn, niedrig
  }
  out.push(
    q(x + 0.1, y + 0.04, h, 0.8, 0.06, 0.66, side, t, wood), // Kopfteil
    q(x + 0.1, y + 0.035, h + 0.66, 0.8, 0.07, 0.04, rail, rail, wood), // Leiste
    q(x + 0.1, y + 0.1, h, 0.8, 0.85, 0.28, side, t, wood), // Rahmen
    q(x + 0.14, y + 0.12, h + 0.28, 0.72, 0.24, 0.12, pillow, pillow, STOFF), // Kissen
    q(x + 0.72, y + 0.16, h + 0.4, 0.12, 0.14, 0.015, '#f4efe6', '#f4efe6'), // Glanz auf dem Kissen, neben dem Kopf
    q(x + 0.1, y + 0.36, h + 0.28, 0.8, 0.1, 0.1, '#f4efe6', '#ffffff', STOFF), // umgeschlagenes Laken
    q(x + 0.1, y + 0.46, h + 0.28, 0.8, 0.48, 0.1, blanket, blanket, QUILT), // Steppdecke
    q(x + 0.1, y + 0.94, h + 0.3, 0.8, PLATE, 0.06, mix(blanket, '#ffffff', 0.3), mix(blanket, '#ffffff', 0.3)), // Saum
  );
  return out;
}

/** Die schlafende Figur im Bett: Kopf und Haar auf dem Kissen, darüber Laken und Decke bis zum Kinn hochgezogen */
export function sleeperBoxes(x: number, y: number, h: number, look: { skin: string; hair: string }): Box[] {
  const { blanket } = GAME_COLORS.bed;
  return [
    q(x + 0.32, y + 0.13, h + 0.4, 0.36, 0.22, 0.3, look.skin, look.skin),
    q(x + 0.31, y + 0.12, h + 0.7, 0.38, 0.24, 0.08, look.hair, look.hair, HAAR),
    q(x + 0.1, y + 0.36, h + 0.38, 0.8, 0.1, 0.14, '#f4efe6', '#ffffff', STOFF),
    q(x + 0.1, y + 0.46, h + 0.38, 0.8, 0.48, 0.12, blanket, blanket, QUILT),
  ];
}

/** Breite der Tafel am Tor für `n` Tiere (Felder) */
export const signWidth = (n: number) => Math.max(1, n * 0.55);

/** Oberkante der Tafel über ihrem Feld: Darauf stehen die Tiere (beide Ansichten) */
export const SIGN_TOP = 1.15;

/** Tafel am Tor: Pfosten, Brett aus Holz mit dunklem Rahmen oben und zwei Nägeln; die Tiere darauf zeichnet die Ansicht */
export function signBoxes(x: number, y: number, h: number, n: number): Box[] {
  const w = signWidth(n);
  const x0 = x + 0.5 - w / 2;
  return [
    q(x + 0.44, y + 0.44, h, 0.12, 0.12, 0.6, GAME_COLORS.fenceDark, GAME_COLORS.fence, HOLZ),
    q(x0, y + 0.38, h + 0.6, w, 0.2, 0.5, GAME_COLORS.board, '#d4a874', HOLZ),
    q(x0 - 0.03, y + 0.37, h + 1.1, w + 0.06, 0.22, SIGN_TOP - 1.1, GAME_COLORS.fenceDark, GAME_COLORS.fence, HOLZ),
    ...[x0 + 0.06, x0 + w - 0.1].map((nx) => q(nx, y + 0.58, h + 1.0, 0.04, PLATE, 0.04, '#5a5d66', '#5a5d66')),
  ];
}

/** Brücke, die mit dem Tor auftaucht (`t` 0…1: so weit ist sie ausgelegt): Planken aus Holz mit Fugen auf einem Balken */
export function bridgeBoxes(x: number, y: number, t: number): Box[] {
  if (t <= 0) return [];
  const [by, d] = [y + 0.5 - t / 2, t];
  return [
    q(x, by, 0.76, 1, d, 0.06, '#6e4a2c', '#7a5432', HOLZ),
    ...[0, 1, 2, 3].map((i) => q(x + 0.01 + i * 0.25, by, 0.82, 0.23, d, 0.18, '#a0703f', '#c0915b', HOLZ)),
  ];
}
