// Dinge der Welt aus Quadern, eine Quelle für 2D und 3D (`Box`, wie die Dinge der Welt-Pakete): Bäume und Beerenbüsche
// (mitwachsen-tree-look.ts), Blume, Farn, Findling, Pilz, Schilf, Seerose, Kaktus, Kristall, Stalagmit, Riesenpilz,
// Wolkenpuff, der Riesenpilz am Unterstand; Tröge, Hecke, Rosenbogen und Zaun aus mitwachsen-yard-look.ts. Alles fein
// (Entwurf „Feine Grafik“): Muster je Material, Zusatzquader (Blütenmitte, Moos, Stacheln, Lamellen, Lichtkanten), nie
// Kacheln des Geländes. Bett, Tafel, Gartentor und Brücke (ebenfalls yard-look) und Klangstein, große Tore, Plattformen
// geben die Ansichten selbst in Auftrag, weil sie an Zustand hängen.
// In 2D kommen die Quader eines Felds in seiner Reihe dran (`clampRow`, mitwachsen-row.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Bild“)

import type { Fine } from '../../lib/games/front';
import type { Cell } from './mitwachsen-cell';
import { PILZ_OVER } from './mitwachsen-home';
import { bushBoxes, mix, sketch, treeBoxes } from './mitwachsen-tree-look';
import type { Box } from './mitwachsen-view';
import { PLATE, fenceBoxes, hedgeBoxes, troughBoxes, type Neighbours } from './mitwachsen-yard-look';

export type { Neighbours } from './mitwachsen-yard-look';
/** Fläche des Unterstands, über dem der Hut des Riesenpilzes liegt (Felder, einschließlich) */
export type Shelter = { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number };

const BLATT: Fine = { skin: 'blatt' },
  NADEL: Fine = { skin: 'nadel' },
  LACK: Fine = { skin: 'lack' },
  FASER: Fine = { skin: 'haar' }, // Fasern am Pilzstiel
  MOOS: Fine = { skin: 'fell' },
  GLOW: Fine = { halo: true };

/** Seerose auf dem Wasser (Höhe 0,83, knapp über der Wasserfläche 0,82): Blatt mit Kerbe vorn, Blüte mit gelber Mitte */
export const lilyBoxes = (x: number, y: number): Box[] => [
  [x + 0.25, y + 0.3, 0.83, 0.5, 0.28, 0.03, '#4f9a3c', '#6dbd47', undefined, BLATT],
  [x + 0.25, y + 0.58, 0.83, 0.3, 0.12, 0.03, '#4f9a3c', '#6dbd47', undefined, BLATT], // rechts vorn die Kerbe
  [x + 0.45, y + 0.42, 0.86, 0.12, 0.12, 0.06, '#e77fb3', '#f4b6d4'],
  [x + 0.48, y + 0.45, 0.92, 0.06, 0.06, 0.015, '#f2d14b', '#f2d14b'],
];

/**
 * Ring um einen Stiel aus vier Quadern (hinten, links, rechts, vorn), die außen an den Stiel stoßen, statt ihn zu
 * umschließen: `ring` ist der äußere Umriss, `wall` die Breite des Rings rundum
 */
function collar(ring: Box, wall: number): Box[] {
  const [x, y, z, w, d, ...rest] = ring;
  const piece = (px: number, py: number, pw: number, pd: number): Box => [px, py, z, pw, pd, ...rest];
  return [
    piece(x, y, w, wall),
    piece(x, y + wall, wall, d - 2 * wall),
    piece(x + w - wall, y + wall, wall, d - 2 * wall),
    piece(x, y + d - wall, w, wall),
  ];
}

/** Oberseiten der drei Stufen des Huts am Unterstand über dem Boden: Darauf liegen die Tupfen */
const CAP_TOPS = [3.65, 4.1, 4.45] as const;

/**
 * Riesenpilz auf der Wiese als Unterstand: dicker cremefarbener Stiel mit Kragen, darüber über die ganze Breite des
 * Unterstands (`PILZ_OVER` über den Rand) ein hoher roter Hut in drei Stufen mit weißen Tupfen. Der Hut ist `see` (in
 * 3D vor der Figur durchsichtig, in 2D wie das Dach durchscheinend, solange die Figur zu Hause ist)
 */
export function shelterBoxes(x: number, y: number, h: number, { x0, y0, x1, y1 }: Shelter): Box[] {
  const [stem, stemTop, red, redTop] = ['#efe4d2', '#f7efe2', '#d9473a', '#e0574a'];
  const [cx0, cx1, cz0, cz1] = [x0 - PILZ_OVER, x1 + 1 + PILZ_OVER, y0 - PILZ_OVER, y1 + 1 + PILZ_OVER];
  const [w, d] = [cx1 - cx0, cz1 - cz0];
  const cap = (bx: number, by: number, bz: number, bw: number, bd: number, hh: number, c = red, t = redTop): Box => [
    bx,
    by,
    bz,
    bw,
    bd,
    hh,
    c,
    t,
    'see',
    c === red ? LACK : undefined,
  ];
  const dot = (bx: number, by: number, bz: number, bw: number, bd: number, hh: number) =>
    cap(bx, by, bz, bw, bd, hh, '#ffffff', '#ffffff');
  return [
    [x + 0.15, y + 0.15, h, 0.7, 0.7, 3.2, stem, stemTop, undefined, FASER],
    ...collar([x - 0.05, y - 0.05, h + 2.2, 1.1, 1.1, 0.25, stem, stemTop, undefined, FASER], 0.2), // Kragen um den Stiel
    cap(cx0 + 0.05, cz0 + 0.05, h + 3.15, w - 0.1, d - 0.1, 0.05, '#f3e6c8', '#f3e6c8'), // Lamellen unten
    cap(cx0, cz0, h + 3.2, w, d, 0.45), // Hutrand
    cap(cx0 + 0.9, cz0 + 0.7, h + 3.65, w - 1.8, d - 1.4, 0.45),
    cap(cx0 + 2.0, cz0 + 1.3, h + 4.1, w - 4.0, d - 2.6, 0.35), // Kuppe
    ...(
      [
        [0.2, 0.2, 0],
        [6.7, 0.25, 0],
        [0.25, 2.7, 0],
        [6.6, 2.65, 0],
        [1.4, 0.9, 1],
        [5.6, 1.0, 1],
        [1.2, 1.9, 1],
        [4.4, 2.15, 1],
        [3.4, 1.5, 2],
      ] as const
    ).map(([dx, dz, step]) => dot(cx0 + dx, cz0 + dz, h + CAP_TOPS[step], 0.5, 0.5, 0.06)),
    ...[0.6, 2.4, 4.4, 6.2].map((dx) => dot(cx0 + dx, cz1, h + 3.3, 0.5, 0.04, 0.3)), // vorn auf dem Hutrand
  ];
}

/**
 * Kristall (Entwurf „Feine Grafik“): hohe Säule mit heller Spitze, zwei Nebenkristalle, vorn Lichtkanten; er leuchtet
 * aus sich selbst (in 3D ohne Licht), kompakte Teile mit `halo`
 */
function crystalBoxes(x: number, y: number, h: number, c: string): Box[] {
  const { out, add } = sketch(x + 0.5, y + 0.5, h, 1, 1);
  const t = 1.15;
  add(-0.18, 0, -0.18, 0.36, t, 0.36, c, c, GLOW);
  add(-0.1, t, -0.1, 0.2, t * 0.2, 0.2, mix(c, '#ffffff', 0.45), mix(c, '#ffffff', 0.45), GLOW); // Spitze
  add(0.2, 0, -0.05, 0.2, t * 0.5, 0.2, mix(c, '#ffffff', 0.2), mix(c, '#ffffff', 0.2), GLOW);
  add(-0.38, 0, 0.02, 0.18, t * 0.38, 0.18, mix(c, '#000000', 0.12), mix(c, '#000000', 0.12), GLOW);
  add(-0.17, t * 0.6, -0.185, 0.06, t * 0.35, 0.005, '#ffffff', '#ffffff'); // Lichtkanten vorn
  add(0.22, t * 0.3, -0.055, 0.04, t * 0.18, 0.005, '#ffffff', '#ffffff');
  return out;
}

/** Kleiner Pilz (Entwurf): Stiel, Hut mit heller Kuppe (leuchtet nachts leise, `halo`) und zwei Tupfen vorn */
function mushroomBoxes(x: number, y: number, h: number): Box[] {
  const { out, add } = sketch(x + 0.5, y + 0.5, h, 1, 1);
  const [cap, capTop] = ['#d9473a', '#e0574a'];
  add(-0.05, 0, -0.05, 0.1, 0.16, 0.1, '#f3efe6', '#f3efe6');
  add(-0.14, 0.16, -0.13, 0.28, 0.1, 0.26, cap, capTop, GLOW);
  add(-0.06, 0.26, -0.05, 0.12, 0.04, 0.1, mix(cap, '#ffffff', 0.4), mix(capTop, '#ffffff', 0.4), GLOW);
  add(-0.1, 0.2, -0.135, 0.04, 0.04, 0.005, '#ffffff', '#ffffff');
  add(0.04, 0.22, -0.135, 0.03, 0.03, 0.005, '#ffffff', '#ffffff');
  return out;
}

/** Ein Quader relativ zur Ecke des Felds (x, y) in Höhe h */
type Q = (
  bx: number,
  by: number,
  bz: number,
  w: number,
  d: number,
  hh: number,
  side: string,
  top?: string,
  fine?: Fine,
) => Box;

/** Dinge der Themenwelten: Kaktus (Sand), Kristall (Höhle, leuchtet), Stalagmit, Wolkenpuff (null: keins davon) */
function themedBoxes(c: Cell, x: number, y: number, h: number, q: Q): Box[] | null {
  switch (c.deco) {
    case 'cactus': {
      const [g, t] = ['#3f8f3a', '#5aab4a'];
      return [
        q(0.37, 0.37, 0, 0.26, 0.26, 1.35, g, t, NADEL),
        q(0.13, 0.42, 0.55, 0.24, 0.16, 0.16, g, t, NADEL),
        q(0.13, 0.42, 0.71, 0.14, 0.16, 0.39, g, t, NADEL),
        q(0.63, 0.42, 0.8, 0.24, 0.16, 0.16, g, t, NADEL),
        q(0.73, 0.42, 0.96, 0.14, 0.16, 0.29, g, t, NADEL),
        // Rippen vorn (helle Lichtkanten) und Blüte mit gelber Mitte
        q(0.41, 0.63, 0.1, 0.03, PLATE, 1.1, '#7cc46a'),
        q(0.55, 0.63, 0.2, 0.03, PLATE, 1.0, '#7cc46a'),
        q(0.44, 0.44, 1.35, 0.12, 0.12, 0.1, '#f08cc8', '#f6b0dc'),
        q(0.48, 0.48, 1.45, 0.04, 0.04, 0.015, '#f2d14b'),
      ];
    }
    case 'crystal':
      return crystalBoxes(x, y, h, c.color ?? '#b48cf0');
    case 'stalagmite':
      return [
        q(0.22, 0.22, 0, 0.56, 0.56, 0.5, '#2a2c33', '#3c3f47'),
        q(0.32, 0.32, 0.5, 0.36, 0.36, 0.5, '#2a2c33', '#3c3f47'),
        q(0.41, 0.41, 1.0, 0.18, 0.18, 0.45, '#2a2c33', '#3c3f47'),
        q(0.08, 0.62, 0, 0.14, 0.14, 0.28, '#30323a', '#43464f'), // kleiner Bruder vorn links
        // nasser Glanz vorn: feine helle Streifen, wo Tropfen herablaufen
        q(0.3, 0.78, 0.08, 0.03, PLATE, 0.34, '#4a4e5a'),
        q(0.4, 0.68, 0.56, 0.03, PLATE, 0.36, '#4a4e5a'),
        q(0.46, 0.59, 1.06, 0.03, PLATE, 0.3, '#555a66'),
      ];
    case 'cloudpuff':
      return [
        // niedriger Bausch vorn links, höherer hinten rechts; ohne Überlappung zerlegt (wie die Hecke); obenauf ein Puff
        q(0.15, 0.3, 0, 0.25, 0.4, 0.25, '#e6eef7', '#ffffff'),
        q(0.4, 0.6, 0, 0.25, 0.1, 0.25, '#e6eef7', '#ffffff'),
        q(0.4, 0.15, 0, 0.4, 0.45, 0.35, '#e6eef7', '#ffffff'),
        q(0.5, 0.25, 0.35, 0.2, 0.25, 0.1, '#eef4fa', '#ffffff'),
      ];
    default:
      return null;
  }
}

/** Kleine Dinge der Wiese und der Welten: je Deko-Art ihre Quader (null: keins davon) */
function smallBoxes(c: Cell, x: number, y: number, h: number): Box[] | null {
  const q: Q = (bx, by, bz, w, d, hh, side, top = side, fine?) => [
    x + bx,
    y + by,
    h + bz,
    w,
    d,
    hh,
    side,
    top,
    undefined,
    fine,
  ];
  switch (c.deco) {
    case 'flower':
      return [
        q(0.47, 0.47, 0, 0.06, 0.06, 0.18, '#3f9a3c'),
        q(0.4, 0.4, 0.18, 0.2, 0.2, 0.1, c.color ?? '#ffffff', '#f2d14b', BLATT), // Blüte, Blütenblätter gemustert
        q(0.53, 0.47, 0.05, 0.08, 0.04, 0.03, '#58a73a'), // Blatt am Stiel
        q(0.46, 0.46, 0.28, 0.08, 0.08, 0.02, mix('#f2d14b', '#e8823a', 0.3)), // Mitte (Entwurf)
      ];
    case 'fern':
      return [
        ...(
          [
            [0.3, 0.45, 0.34],
            [0.5, 0.36, 0.42],
            [0.62, 0.52, 0.3],
            [0.42, 0.6, 0.28],
          ] as const
        ).flatMap(([fx, fy, fh]) => [
          q(fx - 0.05, fy, 0.04, 0.1, 0.08, fh - 0.04, '#3c8a34', '#58a73a', BLATT),
          q(fx - 0.03, fy + 0.02, fh, 0.06, 0.04, 0.03, '#6dbd47'), // eingerollte Spitze
        ]),
        q(0.25, 0.36, 0, 0.47, 0.32, 0.04, '#4f9a3c', '#6dbd47', BLATT), // Blätter am Boden, alle Wedel stehen darauf
      ];
    case 'boulder':
      return [
        q(0.14, 0.2, 0, 0.72, 0.6, 0.42, '#878c93', '#9aa0a7'),
        q(0.26, 0.28, 0.42, 0.46, 0.38, 0.16, '#8f949b', '#a8adb3'),
        q(0.3, 0.3, 0.58, 0.3, 0.2, 0.03, '#5f9a3c', '#6dbd47', MOOS), // Moos
        q(0.18, 0.24, 0.42, 0.08, 0.14, 0.02, '#5f9a3c', '#6dbd47'), // Moos am Rand
        q(0.42, 0.8, 0.12, 0.02, PLATE, 0.22, '#6c7178'), // Riss vorn
        q(0.02, 0.66, 0, 0.12, 0.1, 0.07, '#7d838b', '#9aa0a7'), // Kiesel davor, links am Fels
        q(0.78, 0.8, 0, 0.09, 0.08, 0.05, '#8f949b', '#a8adb3'),
      ];
    case 'mushroom':
      return mushroomBoxes(x, y, h);
    case 'reed':
      return [
        q(0.3, 0.5, 0, 0.06, 0.06, 0.55, '#5f8f3a'),
        q(0.29, 0.49, 0.55, 0.08, 0.08, 0.13, '#7a5432', '#8a6440', MOOS), // Kolben
        q(0.6, 0.3, 0, 0.06, 0.06, 0.66, '#5f8f3a'),
        q(0.59, 0.29, 0.66, 0.08, 0.08, 0.16, '#7a5432', '#8a6440', MOOS),
        q(0.45, 0.42, 0, 0.04, 0.04, 0.42, '#6f9f44'), // Halm dazwischen
        q(0.18, 0.62, 0, 0.04, 0.04, 0.3, '#6f9f44'),
      ];
    case 'lily':
      return lilyBoxes(x, y);
    default:
      return themedBoxes(c, x, y, h, q);
  }
}

/** Riesenpilz der Pilzwelt: Stiel, roter Hut in zwei Stufen (`see`) mit Tupfen */
function bigshroomBoxes(c: Cell, x: number, y: number, h: number): Box[] {
  const cap = c.color ?? '#d9473a';
  return [
    [x + 0.36, y + 0.36, h, 0.28, 0.28, 1.4, '#efe4d2', '#f7efe2', undefined, FASER],
    ...collar([x + 0.31, y + 0.31, h + 0.95, 0.38, 0.38, 0.06, '#f7efe2', '#fbf6ee'], 0.05), // Ring um den Stiel
    [x - 0.25, y - 0.25, h + 1.4, 1.5, 1.5, 0.45, cap, cap, 'see', LACK],
    [x + 0.05, y + 0.05, h + 1.85, 0.9, 0.9, 0.25, cap, cap, 'see', LACK],
    // Tupfen oben auf dem oberen Hut und rundum auf dem Rand des unteren (nie halb in einem Hut, nie in der Luft)
    ...(
      [
        [0.35, 0.4, 2.1],
        [0.7, 0.7, 2.1],
        [-0.05, 0.55, 1.85],
        [1.1, 0.35, 1.85],
        [0.45, 1.1, 1.85],
      ] as const
    ).map(([dx, dy, up]): Box => [x + dx - 0.1, y + dy - 0.1, h + up, 0.2, 0.2, 0.05, '#ffffff', '#ffffff', 'see']),
  ];
}

/**
 * Quader eines Dings auf dem Feld (x, y), gleich für 2D und 3D; `picked`: geleerte Büsche ("x,y"), `shelter`: Fläche des
 * Unterstands der Gegend (nur für den Riesenpilz am Unterstand gefragt). null: kein Ding von hier (die Ansicht zeichnet
 * es selbst oder es gibt keins)
 */
export function decoBoxes(
  world: Neighbours,
  c: Cell,
  x: number,
  y: number,
  picked: Readonly<Record<string, number>>,
  shelter: () => Shelter,
): readonly Box[] | null {
  const h = c.h;
  switch (c.deco) {
    case 'tree':
      return treeBoxes(c.tree ?? 'oak', x, y, h);
    case 'bush':
      return bushBoxes(x, y, h, !(`${x},${y}` in picked));
    case 'bigshroom':
      return bigshroomBoxes(c, x, y, h);
    case 'trough':
    case 'watertrough':
      return troughBoxes(x, y, h, c.deco === 'watertrough');
    case 'hedge':
    case 'arch':
      return hedgeBoxes(world, x, y, h, c.deco === 'arch');
    case 'fence':
      return fenceBoxes(world, x, y, h);
    case 'shelterpilz':
      return shelterBoxes(x, y, h, shelter());
    default:
      return smallBoxes(c, x, y, h);
  }
}
