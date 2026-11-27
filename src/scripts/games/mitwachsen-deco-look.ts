// Dinge der Welt aus Quadern, eine Quelle für 2D und 3D (`Box`, wie die Dinge der Welt-Pakete): Bäume und Beerenbüsche
// (mitwachsen-tree-look.ts), Blume, Farn, Findling, Pilz, Schilf, Seerose, Kaktus, Kristall, Stalagmit, Riesenpilz,
// Tröge, Wolkenpuff, Hecke, Rosenbogen, Zaun und Gartentor, der Riesenpilz am Unterstand. Was sich bewegt oder Regeln
// zeigt (Tafel, Bett samt Schläfer, Klangstein, Brücke, große Tore, Plattformen), zeichnen die Ansichten selbst.
// In 2D kommen die Quader eines Felds in seiner Reihe dran (`clampRow`, mitwachsen-row.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Bild“)

import type { Fine } from '../../lib/games/front';
import { GAME_COLORS } from '../../data/games/mitwachsen';
import type { Cell } from './mitwachsen-cell';
import { PILZ_OVER } from './mitwachsen-home';
import { bushBoxes, mix, sketch, treeBoxes } from './mitwachsen-tree-look';
import type { Box } from './mitwachsen-view';

/** Wo die Nachbarn liegen (Hecke, Zaun, Rosenbogen verbinden sich mit ihnen) */
export type Neighbours = { cell(x: number, y: number): Pick<Cell, 'deco'> };
/** Fläche des Unterstands, über dem der Hut des Riesenpilzes liegt (Felder, einschließlich) */
export type Shelter = { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number };

const HOLZ: Fine = { skin: 'holz' },
  BLATT: Fine = { skin: 'blatt' },
  GLOW: Fine = { halo: true };
const LEAF = '#3f9a3c',
  LEAF_TOP = '#5ab651';

/** Seerose auf dem Wasser (Höhe 0,83, knapp über der Wasserfläche 0,82) */
export const lilyBoxes = (x: number, y: number): Box[] => [
  [x + 0.25, y + 0.3, 0.83, 0.5, 0.4, 0.03, '#4f9a3c', '#6dbd47'],
  [x + 0.45, y + 0.42, 0.86, 0.12, 0.12, 0.06, '#e77fb3', '#e77fb3'],
];

/** Zaun: Pfosten in der Mitte, Latten zu jedem Nachbarn mit Zaun oder Tor; `closed` < 1 öffnet ein Gartentor */
export function fenceBoxes(world: Neighbours, x: number, y: number, h: number, closed = 1): Box[] {
  const joins = (dx: number, dy: number) => {
    const d = world.cell(x + dx, y + dy).deco;
    return d === 'fence' || d === 'gate';
  };
  const wood = (bx: number, by: number, bz: number, w: number, d: number, hh: number): Box => [
    bx,
    by,
    bz,
    w,
    d,
    hh,
    GAME_COLORS.fence,
    GAME_COLORS.fenceDark,
    undefined,
    HOLZ,
  ];
  if (world.cell(x, y).deco === 'gate') {
    // Torflügel: offen klappt er zur Seite weg (wird schmaler)
    if (closed <= 0) return [];
    return joins(0, -1) || joins(0, 1)
      ? [wood(x + 0.42, y + 0.5 - 0.5 * closed, h, 0.16, closed, 0.8)]
      : [wood(x + 0.5 - 0.5 * closed, y + 0.42, h, closed, 0.16, 0.8)];
  }
  const out = [wood(x + 0.4, y + 0.4, h, 0.2, 0.2, 0.8)];
  // Latten vom Pfosten bis zum Feldrand (stecken nicht im Pfosten: 2D malt sich Durchdringendes falsch)
  if (joins(0, -1)) out.push(wood(x + 0.45, y, h + 0.3, 0.1, 0.4, 0.12));
  if (joins(-1, 0)) out.push(wood(x, y + 0.45, h + 0.3, 0.4, 0.1, 0.12));
  if (joins(1, 0)) out.push(wood(x + 0.6, y + 0.45, h + 0.3, 0.4, 0.1, 0.12));
  if (joins(0, 1)) out.push(wood(x + 0.45, y + 0.6, h + 0.3, 0.1, 0.4, 0.12));
  return out;
}

/** Hecke um den Garten: Blätterbüsche, verbunden mit Nachbarn mit Hecke; der Rosenbogen ist der Eingang */
function hedgeBoxes(world: Neighbours, x: number, y: number, h: number, arch: boolean): Box[] {
  const joins = (dx: number, dy: number) => {
    const d = world.cell(x + dx, y + dy).deco;
    return d === 'hedge' || d === 'arch';
  };
  const leaf = (bx: number, by: number, bz: number, w: number, d: number, hh: number, see = true): Box => [
    bx,
    by,
    bz,
    w,
    d,
    hh,
    LEAF,
    LEAF_TOP,
    see ? 'see' : undefined,
    BLATT,
  ];
  if (arch) {
    const vertical = joins(0, -1) || joins(0, 1);
    const at = (along: number, across: number, w: number, d: number): [number, number, number, number] =>
      vertical ? [x + across, y + along, d, w] : [x + along, y + across, w, d];
    const out: Box[] = [0.02, 0.82].map((p) => {
      const [bx, by, w, d] = at(p, 0.38, 0.16, 0.2);
      return [bx, by, h, w, d, 1.3, GAME_COLORS.fenceDark, GAME_COLORS.fence, undefined, HOLZ];
    });
    const [bx, by, w, d] = at(0, 0.34, 1, 0.28);
    out.push(leaf(bx, by, h + 1.3, w, d, 0.2, false));
    for (let i = 0; i < 4; i++) {
      const [rx, ry, rw, rd] = at(0.12 + i * 0.22, 0.43, 0.1, 0.1);
      const rose = i % 2 ? '#e77fb3' : '#ffffff';
      out.push([rx, ry, h + 1.5, rw, rd, 0.07, rose, rose]);
    }
    return out;
  }
  const out: Box[] = [];
  // Verbindungen vom Busch in der Mitte bis zum Feldrand
  if (joins(0, -1)) out.push(leaf(x + 0.2, y, h, 0.6, 0.15, 0.7));
  if (joins(-1, 0)) out.push(leaf(x, y + 0.2, h, 0.15, 0.6, 0.7));
  if (joins(1, 0)) out.push(leaf(x + 0.85, y + 0.2, h, 0.15, 0.6, 0.7));
  if (joins(0, 1)) out.push(leaf(x + 0.2, y + 0.85, h, 0.6, 0.15, 0.7));
  out.push(leaf(x + 0.15, y + 0.15, h, 0.7, 0.7, 0.75));
  if ((x * 31 + y * 17) % 3 === 0) out.push([x + 0.45, y + 0.5, h + 0.75, 0.1, 0.1, 0.05, '#f2d14b', '#f2d14b', 'see']);
  return out;
}

/** Trog aus Holz auf vier Füßchen: Futter (Heu und Möhren) oder Wasser */
function troughBoxes(x: number, y: number, h: number, water: boolean): Box[] {
  const [wood, woodTop] = ['#8a5a30', '#a0703f'];
  const plank = (bx: number, by: number, bz: number, w: number, d: number, hh: number): Box => [
    x + bx,
    y + by,
    h + bz,
    w,
    d,
    hh,
    wood,
    woodTop,
    undefined,
    HOLZ,
  ];
  const out: Box[] = [
    ...(
      [
        [0.1, 0.2],
        [0.8, 0.2],
        [0.1, 0.72],
        [0.8, 0.72],
      ] as const
    ).map(([fx, fy]): Box => [x + fx, y + fy, h, 0.1, 0.1, 0.12, '#7a5432', '#7a5432', undefined, HOLZ]),
    plank(0.05, 0.15, 0.12, 0.9, 0.72, 0.08),
    plank(0.05, 0.15, 0.2, 0.9, 0.08, 0.28),
    plank(0.05, 0.23, 0.2, 0.08, 0.56, 0.28),
    plank(0.87, 0.23, 0.2, 0.08, 0.56, 0.28),
  ];
  if (water) out.push([x + 0.13, y + 0.23, h + 0.2, 0.74, 0.56, 0.22, '#3f8fd8', '#7fc0f0']);
  else {
    out.push([x + 0.13, y + 0.23, h + 0.2, 0.74, 0.56, 0.26, '#d9b85a', '#ecd27a']); // Heu
    for (const [fx, fy] of [
      [0.25, 0.35],
      [0.55, 0.5],
      [0.7, 0.3],
    ] as const)
      out.push([x + fx, y + fy, h + 0.46, 0.14, 0.06, 0.06, '#f08a3c', '#f08a3c']); // Möhren
  }
  out.push(plank(0.05, 0.79, 0.2, 0.9, 0.08, 0.28)); // vorn zuletzt
  return out;
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
  ];
  const dot = (bx: number, by: number, bz: number, bw: number, bd: number, hh: number) =>
    cap(bx, by, bz, bw, bd, hh, '#ffffff', '#ffffff');
  return [
    [x + 0.15, y + 0.15, h, 0.7, 0.7, 3.2, stem, stemTop],
    [x - 0.05, y - 0.05, h + 2.2, 1.1, 1.1, 0.25, stem, stemTop], // Kragen
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
type Q = (bx: number, by: number, bz: number, w: number, d: number, hh: number, side: string, top?: string) => Box;

/** Dinge der Themenwelten: Kaktus (Sand), Kristall (Höhle, leuchtet), Stalagmit, Wolkenpuff (null: keins davon) */
function themedBoxes(c: Cell, x: number, y: number, h: number, q: Q): Box[] | null {
  switch (c.deco) {
    case 'cactus': {
      const [g, t] = ['#3f8f3a', '#5aab4a'];
      return [
        q(0.37, 0.37, 0, 0.26, 0.26, 1.35, g, t),
        q(0.13, 0.42, 0.55, 0.24, 0.16, 0.16, g, t),
        q(0.13, 0.42, 0.55, 0.14, 0.16, 0.55, g, t),
        q(0.63, 0.42, 0.8, 0.24, 0.16, 0.16, g, t),
        q(0.73, 0.42, 0.8, 0.14, 0.16, 0.45, g, t),
        q(0.44, 0.44, 1.35, 0.12, 0.12, 0.1, '#f08cc8'), // Blüte
      ];
    }
    case 'crystal':
      return crystalBoxes(x, y, h, c.color ?? '#b48cf0');
    case 'stalagmite':
      return [
        q(0.22, 0.22, 0, 0.56, 0.56, 0.5, '#2a2c33', '#3c3f47'),
        q(0.32, 0.32, 0.5, 0.36, 0.36, 0.5, '#2a2c33', '#3c3f47'),
        q(0.41, 0.41, 1.0, 0.18, 0.18, 0.45, '#2a2c33', '#3c3f47'),
      ];
    case 'cloudpuff':
      return [
        // niedriger Bausch vorn links, höherer hinten rechts; ohne Überlappung zerlegt (wie die Hecke)
        q(0.15, 0.3, 0, 0.25, 0.4, 0.25, '#e6eef7', '#ffffff'),
        q(0.4, 0.6, 0, 0.25, 0.1, 0.25, '#e6eef7', '#ffffff'),
        q(0.4, 0.15, 0, 0.4, 0.45, 0.35, '#e6eef7', '#ffffff'),
      ];
    default:
      return null;
  }
}

/** Kleine Dinge der Wiese und der Welten: je Deko-Art ihre Quader (null: keins davon) */
function smallBoxes(c: Cell, x: number, y: number, h: number): Box[] | null {
  const q: Q = (bx, by, bz, w, d, hh, side, top = side) => [x + bx, y + by, h + bz, w, d, hh, side, top];
  switch (c.deco) {
    case 'flower':
      return [
        q(0.47, 0.47, 0, 0.06, 0.06, 0.18, '#3f9a3c'),
        q(0.4, 0.4, 0.18, 0.2, 0.2, 0.1, c.color ?? '#ffffff', '#f2d14b'),
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
        ).map(([fx, fy, fh]) => q(fx - 0.05, fy, 0.04, 0.1, 0.08, fh - 0.04, '#3c8a34', '#58a73a')),
        q(0.28, 0.42, 0, 0.44, 0.14, 0.04, '#4f9a3c', '#6dbd47'), // Blätter am Boden, die Wedel stehen darauf
      ];
    case 'boulder':
      return [
        q(0.14, 0.2, 0, 0.72, 0.6, 0.42, '#878c93', '#9aa0a7'),
        q(0.26, 0.28, 0.42, 0.46, 0.38, 0.16, '#8f949b', '#a8adb3'),
        q(0.3, 0.3, 0.58, 0.3, 0.2, 0.03, '#5f9a3c', '#6dbd47'), // Moos
      ];
    case 'mushroom':
      return mushroomBoxes(x, y, h);
    case 'reed':
      return [
        q(0.3, 0.5, 0, 0.06, 0.06, 0.55, '#5f8f3a'),
        q(0.6, 0.3, 0, 0.06, 0.06, 0.66, '#5f8f3a'),
        q(0.59, 0.29, 0.66, 0.08, 0.08, 0.16, '#7a5432'),
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
    [x + 0.36, y + 0.36, h, 0.28, 0.28, 1.4, '#efe4d2', '#f7efe2'],
    [x - 0.25, y - 0.25, h + 1.4, 1.5, 1.5, 0.45, cap, cap, 'see'],
    [x + 0.05, y + 0.05, h + 1.85, 0.9, 0.9, 0.25, cap, cap, 'see'],
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
