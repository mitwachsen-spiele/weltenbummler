// Aussehen der Dinge in der Kristallgrotte, gleich für 2D und 3D: Wer welches Ding baut (`caveBoxes`), dazu hier die
// Kristall-Lampen, Kristallsäulen (leuchten kurz heller, wenn sie klingen), der Kristallbogen, weiß-blaue Deko-Pilze,
// Kristallfackeln und der Holzsteg. Die Dinge am Bett und die Sammelstellen (Pilzschale, Steintrog, Unterstand mit der
// Kristallwand, Pilzbeete, Tropfquelle, Tropfmoos, Sockel der Laterne) stehen in mitwachsen-cave-home-look.ts, die
// Füllung und Fülle (Stalagmiten, Kristallbüsche, Felsbrocken, Moos, Lehm, Pfützen, Farn, Kristallfelder, Adern,
// Leuchtmoos, Ufersteine, Wasserfall) in mitwachsen-cave-fill-look.ts, das Netz der Tupfspinne in
// mitwachsen-spider-look.ts; dazu Boden und Klippen in den Schichten des Höhlentors, Flecken im Boden in 2D (`patchOf`)
// und die Lichtflecken. Fein (Entwurf „Feine Grafik“, mitwachsen-cave-fine.ts): Kristalle mit hellerer Spitze und
// Lichtkante leuchten weich, Pilzhüte als Lack mit heller Kuppe und zwei Tupfen, Planken des Stegs mit Maserung und
// Nägeln, Stein mit Verlauf, Platte und Ringen. Eigene Voxel-Grafik: keine Drusen, keine Loren, kein Tropfstein mit
// Kessel. Rein (ohne DOM und Three.js): liefert Quader in Feldern, die beide Ansichten zeichnen. Teil des Welt-Pakets
// der Höhlenwelt: 2D über view-2d.ts, 3D über den 3D-Teil view-3d.ts.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Die Kristallgrotte“)

import { GROTTE, GROTTE_COLORS, JETTY_EAST } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { ARCH_PERCH } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-animals';
import { hash } from '../../../../lib/games/rng';
import type { Cell } from '../../mitwachsen-cell';
import type { Realms } from '../../mitwachsen-home';
import type { Box } from '../../mitwachsen-view';
import { webBoxes } from './mitwachsen-spider-look';
import { CAVE_FINE, EDGE, crystal, deepen, edge, lighten } from './mitwachsen-cave-fine';
import { STEM, bowlBoxes, post, shed, shroomBed, supplyBoxes } from './mitwachsen-cave-home-look';
import { adornBoxes, fillBoxes, stalagmite, waterfallBoxes } from './mitwachsen-cave-fill-look';

export { lighten } from './mitwachsen-cave-fine';
export { SHED_H, bedColor } from './mitwachsen-cave-home-look';
export { FALL_MS, adornBoxes, waterfallBoxes } from './mitwachsen-cave-fill-look';

const C = GROTTE_COLORS;
/** Helle Spitze der Kristallflamme einer Fackel */
const TORCH_TIP = '#f3ecff';
const [KR] = C.crystals;
const { wood: WOOD, glow: GLOW, glowCap: GLOW_CAP } = CAVE_FINE;
/** Dunkle Ringe am Pfosten einer Fackel, Nägel im Steg */
const RING = deepen(C.rock[0], 0.2);
const NAIL = '#4a4658';

/**
 * Ein Ding der Grotte als Quader (null: kein Ding der Grotte, die Ansicht zeichnet wie sonst). `full`: Das Pilzbeet auf
 * diesem Feld trägt Leuchtpilze (sonst ist es abgeerntet), in Pilzschale und Steintrog liegen Pilze bzw. steht Wasser
 * (sonst sind sie leer). Kein Gold: Beet, Quelle und Trog sind keine Aktion.
 */
export function caveBoxes(world: Realms, c: Cell, x: number, y: number, full = true): readonly Box[] | null {
  if (c.deco === 'shroombowl' || c.deco === 'stonetrough') return bowlBoxes(c, x, y, full);
  const own = OWN.get(c.deco); // Wasser, Füllung
  if (own) return own(c, x, y);
  if (c.deco === 'shroombed') return shroomBed(c, x, y, full);
  const h = c.h;
  switch (c.deco) {
    case 'shed':
      return shed(world, c, x, y);
    case 'cavelamp': {
      // Pfosten aus Stein mit Platte, obenauf ein Kristall (fein: hellere Spitze, Lichtkante, leuchtet)
      const k = c.color ?? KR;
      return [
        [x + 0.4, y + 0.42, h, 0.2, 0.16, 0.86, ...C.rock],
        [x + 0.36, y + 0.38, h + 0.86, 0.28, 0.24, 0.04, C.rock[1], C.rock[1]],
        ...crystal(x + 0.33, y + 0.36, h + 0.9, 0.34, 0.28, 0.34, k, k, 0.08),
      ];
    }
    case 'column':
      return columnBoxes(c, x, y);
    case 'jetty':
      return jetty(c, x, y);
    case 'crystalarch': {
      // Kristallbogen: Pfeiler an den Enden (note 0 und 4), darüber durchgehend ein Bogen in drei Farben
      // Unterkante des Bogens auf der Höhe, an der die Fledermäuse hängen (`ARCH_PERCH`, `Cell.perch`)
      const beam: Box = [x, y + 0.3, h + ARCH_PERCH, 1, 0.4, 0.45, C.bands[1], C.bands[2]];
      const color = C.crystals[(c.note ?? 0) % 3]!;
      const gem = crystal(x + 0.38, y + 0.28, h + ARCH_PERCH + 0.45, 0.24, 0.3, 0.24, color, color, 0.05);
      if (c.note === 0 || c.note === 4) return [[x + 0.2, y + 0.25, h, 0.6, 0.5, ARCH_PERCH, ...C.rock], beam, ...gem];
      return [beam, ...gem];
    }
    case 'glowshroom':
      return glowshroom(c, x, y);
    default:
      return null;
  }
}

/**
 * Kleiner Deko-Pilz: Stiel und Hut in Weiß-Blau (nie in den Farben der Sammelpilze), kleiner als ein Pilz im Beet.
 * Fein (Entwurf `pilz`): Hut als Lack mit heller Kuppe obenauf, beide leuchten weich, vorn zwei weiße Tupfen; der Stiel
 * leuchtet nicht
 */
function glowshroom(c: Cell, x: number, y: number): Box[] {
  const h = c.h;
  const k = c.color ?? C.decoShroom;
  const top = lighten(k, 0.4);
  return [
    [x + 0.47, y + 0.5, h, 0.06, 0.06, 0.1, ...STEM],
    [x + 0.4, y + 0.44, h + 0.1, 0.2, 0.18, 0.07, k, k, undefined, GLOW_CAP],
    [x + 0.46, y + 0.49, h + 0.17, 0.08, 0.08, 0.03, top, top, undefined, GLOW],
    [x + 0.43, y + 0.62, h + 0.13, 0.03, EDGE, 0.03, '#ffffff', '#ffffff'],
    [x + 0.53, y + 0.62, h + 0.14, 0.025, EDGE, 0.025, '#ffffff', '#ffffff'],
  ];
}

/**
 * Planke des Holzstegs: zwei Bretter quer zur Laufrichtung, dazwischen eine schmale Fuge; fein mit Maserung und je
 * Brett zwei Nägeln obenauf (nah an den Enden)
 */
function jetty(c: Cell, x: number, y: number): Box[] {
  const h = c.h;
  const east = (c.note ?? 0) >= JETTY_EAST;
  const boards: Box[] = east
    ? [
        [x + 0.04, y + 0.02, h, 0.44, 0.96, 0.06, ...C.jetty, undefined, WOOD],
        [x + 0.52, y + 0.02, h, 0.44, 0.96, 0.06, ...C.jetty, undefined, WOOD],
      ]
    : [
        [x + 0.02, y + 0.04, h, 0.96, 0.44, 0.06, ...C.jetty, undefined, WOOD],
        [x + 0.02, y + 0.52, h, 0.96, 0.44, 0.06, ...C.jetty, undefined, WOOD],
      ];
  const nails = boards.flatMap(([bx, by, bz, w, d, bh]): Box[] =>
    [0.08, 0.88].map((t): Box => {
      const [nx, ny] = east ? [bx + w / 2 - 0.02, by + d * t] : [bx + w * t, by + d / 2 - 0.02];
      return [nx, ny, bz + bh, 0.04, 0.04, EDGE, NAIL, NAIL];
    }),
  );
  return [...boards, ...nails];
}

/**
 * Geschliffene, freistehende Kristallsäule des Säulen-Glockenspiels auf ihrem Sockel, so hoch wie ihr Ton es sagt
 * (`GROTTE.hall.columns`, der tiefste Ton die höchste). `glow` (0 … 1): so viel heller leuchtet sie gerade, nachdem sie
 * geklungen hat (mitwachsen-chime-look.ts); der Sockel bleibt Stein. Fein: Die Säule leuchtet (für einen Schein zu
 * hoch, schattiert wird sie aber nur halb so stark), obenauf eine hellere Spitze, die weich leuchtet, vorn eine
 * Lichtkante, am Sockel eine Platte. Die Reihenfolge ist die des Zeichnens in 2D (von unten nach oben, die Platte vor
 * der Säule); der Schein beim Klingen in 3D zeichnet alle Teile nach, die leuchten (`halo`: Säule und Spitze)
 */
export function columnBoxes(c: Cell, x: number, y: number, glow = 0): Box[] {
  const color = lighten(C.crystals[hash(3, x, y) % 3]!, glow * 0.6);
  const top = C_HEIGHTS[c.note ?? 0] ?? C_HEIGHTS[0];
  const h = c.h;
  const tip = lighten(color, 0.45);
  const body = top - 0.25 - TIP_H; // die Spitze gehört zur Höhe der Säule
  return [
    [x + 0.2, y + 0.25, h, 0.6, 0.5, 0.21, ...C.rock],
    [x + 0.18, y + 0.23, h + 0.21, 0.64, 0.54, 0.04, C.rock[1], C.rock[1]], // Platte des Sockels
    [x + 0.3, y + 0.33, h + 0.25, 0.4, 0.34, body, color, lighten(color, 0.15), undefined, GLOW],
    [x + 0.4, y + 0.41, h + top - TIP_H, 0.2, 0.18, TIP_H, tip, tip, undefined, GLOW],
    edge(x + 0.35, y + 0.67, h + 0.25 + body * 0.4, 0.04, body * 0.5),
  ];
}
const C_HEIGHTS = GROTTE.hall.columns;
/** Höhe der hellen Spitze einer Säule */
const TIP_H = 0.08;

/**
 * Kristallfackel: schmaler Pfosten mit zwei dunklen Ringen (der Pfosten in drei Stücken dazwischen), obenauf eine Kristallflamme in drei Stufen, die Spitze hell;
 * die Flamme leuchtet weich, vorn eine Lichtkante
 */
function torchBoxes(c: Cell, x: number, y: number): Box[] {
  const [h, color] = [c.h, c.color ?? KR];
  return [
    // der Pfosten in Stücken zwischen den Ringen: Ring und Pfosten stoßen aneinander, keiner steckt im anderen
    [x + 0.41, y + 0.41, h, 0.18, 0.18, 0.3, ...C.rock],
    [x + 0.4, y + 0.4, h + 0.3, 0.2, 0.2, 0.04, RING, RING],
    [x + 0.41, y + 0.41, h + 0.34, 0.18, 0.18, 0.61, ...C.rock],
    [x + 0.4, y + 0.4, h + 0.95, 0.2, 0.2, 0.04, RING, RING],
    [x + 0.41, y + 0.41, h + 0.99, 0.18, 0.18, 0.11, ...C.rock],
    [x + 0.27, y + 0.3, h + 1.1, 0.46, 0.4, 0.26, color, color, undefined, GLOW],
    [x + 0.34, y + 0.36, h + 1.36, 0.32, 0.28, 0.26, color, TORCH_TIP, undefined, GLOW],
    [x + 0.42, y + 0.43, h + 1.62, 0.16, 0.14, 0.22, TORCH_TIP, TORCH_TIP, undefined, GLOW],
    edge(x + 0.33, y + 0.7, h + 1.14, 0.05, 0.18),
  ];
}

/** Wasser: Tropfquelle über dem Becken, Tropfmoos (Pilzschale und Steintrog: `bowlBoxes`) */
const SUPPLIES: readonly Cell['deco'][] = ['dripspring', 'dripmoss'];
/** Füllung der Grotte (mitwachsen-fill.ts); Farn und Felsbrocken gibt es auch in der Landschaft */
const FILL: readonly Cell['deco'][] = ['crystalbush', 'boulder', 'mosstop', 'clay', 'puddle', 'fern'];
/** Fülle der Grotte (mitwachsen-fill.ts, `adornGrotte`): flach und begehbar */
const ADORN: readonly Cell['deco'][] = ['crystalfield', 'vein', 'glowmoss', 'shore'];
/** Wer die Quader dieser Dinge baut */
const OWN = new Map<Cell['deco'], (c: Cell, x: number, y: number) => Box[] | null>([
  ...SUPPLIES.map((d) => [d, supplyBoxes] as const),
  ...FILL.map((d) => [d, fillBoxes] as const),
  ['lantern', post],
  ['stalagmite', stalagmite],
  ...ADORN.map((d) => [d, adornBoxes] as const),
  ['waterfall', (c: Cell, x: number, y: number) => (c.region === 'hoehle' ? waterfallBoxes(c, x, y) : null)],
  ['web', webBoxes], // Netz der Tupfspinne (mitwachsen-spider-look.ts)
  ['torch', torchBoxes],
]);

/**
 * Fleck im Grottenboden (nur 2D; 3D hat den etwas dunkleren Boden): auf freiem Grottenboden der Grotte, wo das weiche Rauschen des Bodens
 * (`Cell.shade`) über die Schwellen in `GROTTE.patch` geht, kühl lila oder zart rosé; nie auf Licht oder Randschatten
 * (die haben Vorrang), nie auf Moos, Steg oder Fels. Sonst undefined
 */
export function patchOf(c: Cell): string | undefined {
  if (c.region !== 'hoehle' || c.ground !== 'grotto' || c.light || c.dim || c.shade === undefined) return undefined;
  const { cool, warm } = GROTTE.patch;
  return c.shade < cool ? C.patches[0] : c.shade > warm ? C.patches[1] : undefined;
}

/** Farbe der Schicht auf Höhe `h` (Seiten der Klippen und des Bodens wie am Höhlentor) */
export const band = (h: number) => C.bands[h % C.bands.length]!;

/** Farbe heller machen um `l` (0,35: um 35 %), für den Lichtfleck in 2D als halb durchsichtiges Licht obenauf */
export const glowOver = (l: number) => `rgba(255, 246, 220, ${Math.min(0.45, l).toFixed(2)})`;
