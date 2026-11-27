// Aussehen der Füllung der Kristallgrotte (mitwachsen-fill.ts), gleich für 2D und 3D: Stalagmiten in drei Höhen,
// Kristallbüsche, Felsbrocken, Moos auf Felsinseln, Lehm, Pfützen, Farn, dazu die Fülle (Kristallfelder, Adern im Boden,
// Leuchtmoos, helle Steine am Seeufer) und der kleine Wasserfall am See. Fein (Entwurf „Feine Grafik“): Kristalle mit
// hellerer Spitze und Lichtkante, sie leuchten weich (`halo`); Moos als Fell, Farn als Blatt; Stein ohne Muster mit
// nassem Glanz, Riss und Kieseln. Felder, Lage und Größe bleiben (alle Teile im eigenen Feld). Rein (ohne DOM und
// Three.js), Teil des Welt-Pakets der Höhlenwelt (aus mitwachsen-cave-look.ts ausgelagert).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Kristallgrotte“, Feinheit)

import { GROTTE, GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { hash } from '../../../../lib/games/rng';
import type { Cell } from '../../mitwachsen-cell';
import type { Box } from '../../mitwachsen-view';
import { CAVE_FINE, EDGE, crystal, deepen, lighten } from './mitwachsen-cave-fine';

const C = GROTTE_COLORS;
const [, KT] = C.crystals;
/** Fuß und Mitte von Stalagmiten und Felsbrocken: dunkel, gegen den hellen Boden mindestens 3 : 1 */
const [FOOT, MID] = C.stal;
const { moss: MOSS, leaf: LEAF, glow: GLOW, glowMoss: GLOW_MOSS } = CAVE_FINE;
/** Nasser Glanz auf dem Stein (hell, halb so breit wie ein Riss) und der Riss selbst */
const WET = lighten(MID, 0.35);
const CRACK = deepen(FOOT, 0.35);

/**
 * Stalagmit in drei Höhen (`note` 0 … 2): dunkler Fuß, darüber die Mitte, die Spitze in der Farbe seiner Zone
 * (`Cell.color`, mitwachsen-fill.ts) mit einem hellen Tupfen obenauf; fein daneben ein kleiner Bruder und vorn zwei
 * Streifen nasser Glanz. Draußen in der Landschaft wie immer (null)
 */
export function stalagmite(c: Cell, x: number, y: number): Box[] | null {
  if (c.region !== 'hoehle') return null;
  const [h, k] = [c.h, 1 + (c.note ?? 0) * 0.5];
  const tip = c.color ?? C.tips.hall;
  return [
    [x + 0.22, y + 0.3, h, 0.56, 0.5, 0.4 * k, FOOT, MID],
    [x + 0.32, y + 0.38, h + 0.4 * k, 0.36, 0.32, 0.4 * k, MID, tip],
    [x + 0.41, y + 0.45, h + 0.8 * k, 0.18, 0.16, 0.35 * k, tip, lighten(tip, 0.3)],
    [x + 0.8, y + 0.56, h, 0.12, 0.12, 0.22 * k, FOOT, MID], // kleiner Bruder rechts vorn
    [x + 0.3, y + 0.8, h + 0.08 * k, 0.04, EDGE, 0.26 * k, WET, WET], // nasser Glanz vorn auf dem Fuß
    [x + 0.4, y + 0.7, h + 0.48 * k, 0.03, EDGE, 0.24 * k, WET, WET], // und auf der Mitte
  ];
}

/** Lage der vier Kristalle eines Kristallbuschs: Ecke im Feld, Breite, Höhe (der zweite ist der große) */
const BUSH = [
  [0.24, 0.32, 0.16, 0.42],
  [0.44, 0.28, 0.14, 0.6],
  [0.6, 0.4, 0.16, 0.36],
  [0.38, 0.56, 0.16, 0.3],
] as const;

/**
 * Füllung der Grotte (mitwachsen-fill.ts): Kristallbusch (vier kurze Kristalle in seiner Farbe auf einem flachen Stein,
 * fein mit hellerer Spitze und Lichtkante, alle leuchten; kein Moos fern der Lichtschächte, niedriger als die Figur),
 * Felsbrocken (dunkler Fuß, Kappe in der Farbe der Zone, vorn ein Riss, daneben zwei Kiesel), Moos auf einer Felsinsel
 * (Fell), Lehm am Hang des Dachses (mit einem Erdhügelchen), Pfütze (flach, türkis, mit zwei Glanzpunkten), Farn (Wedel
 * in Moosgrün als Blatt, zwei Spitzen eingerollt)
 */
export function fillBoxes(c: Cell, x: number, y: number): Box[] | null {
  if (c.region !== 'hoehle') return null; // Farn und Felsbrocken draußen in der Landschaft: wie immer
  const h = c.h;
  switch (c.deco) {
    case 'crystalbush': {
      const k = c.color ?? KT;
      const l = lighten(k, 0.3);
      return [
        [x + 0.16, y + 0.24, h, 0.68, 0.56, 0.08, C.bands[3], C.bands[1]],
        ...BUSH.flatMap(([dx, dy, w, hh], i) =>
          i === 1
            ? crystal(x + dx, y + dy, h + 0.08, w, 0.14, hh, l, k, 0.1)
            : [[x + dx, y + dy, h + 0.08, w, 0.14, hh, k, l, undefined, GLOW] as Box],
        ),
      ];
    }
    case 'boulder': {
      // Felsbrocken: dunkler Fuß, obenauf eine Kappe in der Farbe seiner Zone (`Cell.color`)
      const tip = c.color ?? C.tips.hall;
      return [
        [x + 0.12, y + 0.2, h, 0.76, 0.62, 0.42, FOOT, MID],
        [x + 0.24, y + 0.3, h + 0.42, 0.5, 0.4, 0.18, tip, lighten(tip, 0.3)],
        [x + 0.46, y + 0.82, h + 0.12, 0.03, EDGE, 0.24, CRACK, CRACK], // Riss vorn
        [x + 0.04, y + 0.84, h, 0.1, 0.08, 0.05, MID, MID], // Kiesel links vorn und rechts
        [x + 0.89, y + 0.6, h, 0.08, 0.08, 0.04, FOOT, MID],
      ];
    }
    case 'mosstop':
      return [
        [x + 0.04, y + 0.04, h, 0.92, 0.92, 0.04, ...C.moss, undefined, MOSS],
        [
          x + 0.3 + (hash(7, x, y) % 3) * 0.12,
          y + 0.4,
          h + 0.04,
          0.16,
          0.14,
          0.06,
          C.moss[1],
          C.moss[1],
          undefined,
          MOSS,
        ],
      ];
    case 'clay':
      return [
        [x, y, h, 1, 1, 0.03, ...C.clay],
        ...(hash(8, x, y) % 3 === 0 ? [[x + 0.3, y + 0.35, h + 0.03, 0.34, 0.26, 0.1, ...C.clay] as Box] : []),
      ];
    case 'puddle':
      return [
        [x + 0.12, y + 0.18, h, 0.76, 0.6, 0.02, ...C.water],
        [x + 0.3, y + 0.3, h + 0.02, 0.18, 0.06, 0.01, C.water[1], '#ffffff'],
        [x + 0.58, y + 0.52, h + 0.02, 0.06, 0.04, 0.01, C.water[1], '#ffffff'], // zweiter, kleiner Glanz
      ];
    default: // Farn: vier Wedel und ein Blatt quer darüber, in Moosgrün; zwei Wedel oben eingerollt
      return [
        ...[
          [0.3, 0.45, 0.32],
          [0.48, 0.38, 0.4],
          [0.62, 0.5, 0.3],
          [0.42, 0.58, 0.26],
        ].map(([fx, fy, fh]): Box => [x + fx! - 0.05, y + fy!, h, 0.1, 0.06, fh!, ...C.moss, undefined, LEAF]),
        [x + 0.28, y + 0.42, h + 0.2, 0.44, 0.14, 0.04, C.moss[1], C.moss[1], undefined, LEAF],
        [x + 0.43, y + 0.38, h + 0.4, 0.06, 0.06, 0.04, C.moss[1], C.moss[1]], // eingerollte Spitzen
        [x + 0.57, y + 0.5, h + 0.3, 0.06, 0.06, 0.04, C.moss[1], C.moss[1]],
      ];
  }
}

/** Splitter eines Kristallfelds: Lage, Breite, Höhe; in der Mitte (`note` 1) einer mehr und höher */
const SHARDS = [
  [0.22, 0.3, 0.12, 0.22],
  [0.58, 0.24, 0.1, 0.16],
  [0.4, 0.58, 0.12, 0.26],
  [0.7, 0.62, 0.1, 0.14],
] as const;
/** Streifen einer Ader je Richtung (`note`): Stücke [dx, dy, Breite, Tiefe]; schräg als Treppe aus drei Stücken */
const VEIN: readonly (readonly (readonly [number, number, number, number])[])[] = [
  [[0, 0.44, 1, 0.12]],
  [[0.44, 0, 0.12, 1]],
  [
    [0, 0.06, 0.36, 0.14],
    [0.32, 0.43, 0.36, 0.14],
    [0.64, 0.8, 0.36, 0.14],
  ],
  [
    [0, 0.8, 0.36, 0.14],
    [0.32, 0.43, 0.36, 0.14],
    [0.64, 0.06, 0.36, 0.14],
  ],
];
/** Kiesel am Seeufer: [dx, dy, Breite, Tiefe, Höhe] */
const SHORE: readonly (readonly [number, number, number, number, number])[] = [
  [0.18, 0.22, 0.28, 0.22, 0.1],
  [0.56, 0.5, 0.24, 0.2, 0.08],
  [0.3, 0.62, 0.18, 0.16, 0.07],
];
/** Leuchtmoos an der Wand je Seite (`note`, wie `SIDES` in mitwachsen-fill.ts): [dx, dy, Breite, Tiefe] des Polsters, das hochwächst */
const CLIMB: readonly (readonly [number, number, number, number])[] = [
  [0.14, 0, 0.72, 0.1],
  [0.9, 0.14, 0.1, 0.72],
  [0.14, 0.9, 0.72, 0.1],
  [0, 0.14, 0.1, 0.72],
];

/**
 * Fülle der Grotte, flach und begehbar: helle Steine am Seeufer, Kristallfeld (niedrige Splitter in der Farbe der Zone,
 * `Cell.color`, niedriger als ein Leuchtpilz; fein leuchten sie weich, der größte mit hellerer Spitze), Ader (flacher
 * Streifen in Rosa oder Lila, leuchtet nicht), Leuchtmoos (flaches Polster als Fell mit hellen Tupfen, die leuchten;
 * am Fuß einer Felswand wächst es an ihr hoch: `note` die Seite)
 */
export function adornBoxes(c: Cell, x: number, y: number): Box[] | null {
  if (c.region !== 'hoehle') return null;
  const h = c.h;
  if (c.deco === 'crystalfield') {
    const k = c.color ?? C.crystals[0];
    const l = lighten(k, 0.35);
    const shards = c.note === 1 ? SHARDS : SHARDS.slice(0, 3);
    const turn = hash(9, x, y) % 2 ? -1 : 1; // gespiegelt je Feld
    const out = shards.map(([dx, dy, w, hh]): Box => {
      const sx = turn > 0 ? dx : 1 - dx - w;
      return [x + sx, y + dy, h, w, w, hh * (c.note === 1 ? 1.25 : 1), k, l, undefined, GLOW];
    });
    // der größte Splitter (vorn in der Mitte) mit hellerer Spitze
    const [bx, by, bz, bw, bd, bh] = out[2]!;
    const t = bw * 0.5;
    const tip = lighten(k, 0.45);
    out.push([bx + (bw - t) / 2, by + (bd - t) / 2, bz + bh, t, t, 0.04, tip, tip, undefined, GLOW]);
    return out;
  }
  if (c.deco === 'shore') {
    // helle Steine am Seeufer: zwei oder drei flache Kiesel, je Feld anders gelegt
    const n = 2 + (hash(10, x, y) % 2);
    return SHORE.slice(0, n).map(([dx, dy, w, d, hh]): Box => [x + dx, y + dy, h, w, d, hh, ...C.bright]);
  }
  if (c.deco === 'vein') {
    const k = c.color ?? C.veins[0];
    return (VEIN[c.note ?? 0] ?? VEIN[0]!).map(([dx, dy, w, d]): Box => [x + dx, y + dy, h, w, d, 0.015, k, k]);
  }
  // Leuchtmoos
  const [foot, glow] = C.glowmoss;
  const out: Box[] = [
    [x + 0.14, y + 0.2, h, 0.72, 0.62, 0.05, foot, glow, undefined, MOSS],
    [x + 0.3, y + 0.34, h + 0.05, 0.1, 0.1, 0.04, glow, glow, undefined, GLOW],
    [x + 0.58, y + 0.5, h + 0.05, 0.1, 0.1, 0.04, glow, glow, undefined, GLOW],
  ];
  const climb = c.note === undefined ? undefined : CLIMB[c.note];
  if (climb) out.push([x + climb[0], y + climb[1], h, climb[2], climb[3], 0.9, glow, glow, undefined, GLOW_MOSS]);
  return out;
}

/** So oft fällt ein heller Streifen den Wasserfall hinunter (ms) */
export const FALL_MS = 900;

/**
 * Kleiner Wasserfall am stillen See (mitwachsen-fill.ts): ein bemooster Fels (das Moos obenauf leuchtet als Fell), an
 * seiner Südseite fällt türkises Wasser bis auf den See (Höhe 0,8 wie das Wasser in 2D), unten Schaum. `now`: zwei
 * helle Streifen gleiten hinunter (2D); ohne (3D, reduzierte Bewegung) stehen sie still
 */
export function waterfallBoxes(c: Cell, x: number, y: number, now?: number): Box[] {
  const h = c.h;
  const top = h + GROTTE.waterfall.h;
  const [deep, light] = C.water;
  const fall = top - 0.8;
  const glints = [0, 0.5].map((i): Box => {
    const p = now === undefined ? i + 0.25 : (now / FALL_MS + i) % 1;
    return [x + 0.34, y + 0.99, top - 0.25 - p * (fall - 0.3), 0.32, 0.02, 0.18, '#ffffff', light];
  });
  return [
    [x + 0.06, y + 0.1, h, 0.88, 0.76, GROTTE.waterfall.h, ...C.rock],
    [x + 0.06, y + 0.1, top, 0.88, 0.76, 0.08, ...C.glowmoss, undefined, MOSS],
    [x + 0.3, y + 0.86, 0.8, 0.4, 0.12, fall + 0.04, deep, light],
    ...glints,
    [x + 0.18, y + 0.84, 0.8, 0.64, 0.16, 0.08, light, '#ffffff'],
  ];
}
