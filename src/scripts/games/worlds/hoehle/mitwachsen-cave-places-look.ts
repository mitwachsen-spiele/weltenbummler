// Aussehen, Klang und Licht der Spielorte in der Kristallgrotte (mitwachsen-cave-places.ts, Issue 56), gleich für 2D
// und 3D – rein, ohne DOM. Schlafender Leuchtpilz: ein großer Pilz mit mattem Hut; wach leuchtet der Hut in der Farbe
// der Kristalle (Lila, Türkis oder Rosa, je Feld). Kristalltürmchen: aus Bruchstücken wächst Stufe um Stufe ein Turm,
// der fertige leuchtet an der Spitze. Zahlen-Kristall: ein flacher Stein mit seiner Ziffer obenauf (Pixel-Ziffern aus
// `DIGITS`). Echo-Wand: eine hohe, helle Felsplatte mit drei Bögen. Lichtinseln: Jeder wache Pilz und jeder fertige
// Turm öffnet ein kleines Loch der Dunkelmaske (ein Körper ohne Teile mit `beacon`, eine Reihe hinter dem Ding, so
// liegt sein Schatten hinter ihm); die Grotte bleibt insgesamt dunkel. Kein Feuer, kein Gold. Töne in der C-Pentatonik.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Spielorte in der Grotte“)

import { hash } from '../../../../lib/games/rng';
import { DIGITS } from '../../../../data/games/mitwachsen-digits';
import { CAVE_PLACES, GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { Cell } from '../../mitwachsen-cell';
import type { RideBody } from '../../mitwachsen-ride-view';
import { cellsOf, type Sight } from '../../mitwachsen-sight';
import type { State } from '../../mitwachsen-state';
import type { Box } from '../../mitwachsen-view';
import type { World } from '../../mitwachsen-world';
import type { Scored } from '../../sfx';
import { TOWER, awake, towerAt } from './mitwachsen-cave-places';
import { CAVE_FINE, EDGE, lighten } from './mitwachsen-cave-fine';

const { stem: STEM, cap: CAP, glow: GLOW, glowCap: GLOW_CAP } = CAVE_FINE;

export const CAVE_PLACE_COLORS = {
  stem: GROTTE_COLORS.bright,
  asleep: ['#6e6690', '#817aa3'], // matter Hut: Der Pilz schläft
  caps: GROTTE_COLORS.crystals,
  shard: GROTTE_COLORS.stal,
  slab: GROTTE_COLORS.stal,
  echo: GROTTE_COLORS.bright,
  arc: GROTTE_COLORS.rock,
  white: '#ffffff',
  ring: '#c9bfae', // Kragen am Stiel, etwas dunkler als der Stiel
} as const;

/** Farbe eines Dings je Feld: eine der drei Kristallfarben */
const tint = (x: number, y: number) => CAVE_PLACE_COLORS.caps[hash(13, x, y) % CAVE_PLACE_COLORS.caps.length]!;

/**
 * Leuchtpilz: Stiel (fein mit Fasern), breiter Hut, Kuppe; `lit`: wach, der Hut leuchtet mit hellen Tupfen (die Kuppe
 * leuchtet weich in den Raum, `halo`); schlafend ist der Hut matter Lack. Unter dem Hut ein dunkler Kragen am Stiel
 */
export function shroomBoxes(c: Cell, x: number, y: number, lit: boolean): Box[] {
  const h = c.h;
  const [side, top] = lit ? [tint(x, y), tint(x, y)] : CAVE_PLACE_COLORS.asleep;
  const glow = lit ? 'glow' : undefined;
  // in der Reihenfolge des Zeichnens in 2D: der Kragen vor dem Hut (der Hut deckt ihn oben zu), die Tupfen vor der
  // Kuppe (sie stecken mit einer Ecke darunter)
  const dots: Box[] = lit
    ? [
        [x + 0.2, y + 0.6, h + 0.76, 0.12, 0.12, 0.02, CAVE_PLACE_COLORS.white, CAVE_PLACE_COLORS.white, 'glow'],
        [x + 0.66, y + 0.3, h + 0.76, 0.12, 0.12, 0.02, CAVE_PLACE_COLORS.white, CAVE_PLACE_COLORS.white, 'glow'],
      ]
    : [];
  const out: Box[] = [
    [x + 0.38, y + 0.38, h, 0.24, 0.24, 0.5, ...CAVE_PLACE_COLORS.stem, undefined, STEM],
    [x + 0.36, y + 0.62, h + 0.42, 0.28, EDGE, 0.06, CAVE_PLACE_COLORS.ring, CAVE_PLACE_COLORS.ring], // Kragen vorn
    [x + 0.1, y + 0.1, h + 0.5, 0.8, 0.8, 0.26, side, top, glow, lit ? GLOW : CAP],
    ...dots,
    [x + 0.26, y + 0.26, h + 0.76, 0.48, 0.48, 0.16, side, top, glow, lit ? GLOW_CAP : CAP],
  ];
  return out;
}

/** Kristalle des Turms je Stufe: Ecke im Feld, Breite, Höhe */
const SHARDS = [
  [0.14, 0.5, 0.2, 0.16],
  [0.62, 0.56, 0.22, 0.2],
  [0.5, 0.18, 0.18, 0.14],
] as const;
const SPIRES = [
  [0.36, 0.36, 0.28, 0.5],
  [0.36, 0.36, 0.28, 0.95],
  [0.36, 0.36, 0.28, 1.4],
] as const;
/**
 * Kristallhaufen bzw. Türmchen in seiner Stufe (0 Bruchstücke … `TOWER` fertig, die Spitze leuchtet). Die Reihenfolge
 * ist die des Zeichnens in 2D: was hinten steht, zuerst (das hintere Bruchstück, die Kristalle neben der Säule), dann
 * die Säule mit Lichtkante und Spitze, zuletzt die Bruchstücke vorn
 */
export function towerBoxes(c: Cell, x: number, y: number, stage: number): Box[] {
  const h = c.h;
  const color = tint(x, y);
  const [front, back] = [SHARDS.slice(0, 2), SHARDS.slice(2)].map((list) =>
    list.map(([dx, dy, w, hh]): Box => [x + dx, y + dy, h, w, w, hh, ...CAVE_PLACE_COLORS.shard]),
  ) as [Box[], Box[]];
  const spire = SPIRES[Math.min(TOWER, stage) - 1];
  if (!spire) return [...back, ...front];
  const [dx, dy, w, hh] = spire;
  // fein: die Kristalle leuchten (halb so stark schattiert, kompakte weich in den Raum), vorn eine Lichtkante
  const beside: Box[] = [];
  if (stage >= 2)
    beside.push([x + 0.2, y + 0.44, h, 0.18, 0.18, hh * 0.55, color, lighten(color, 0.3), undefined, GLOW]);
  if (stage >= TOWER)
    beside.push([x + 0.6, y + 0.3, h, 0.18, 0.18, hh * 0.7, color, lighten(color, 0.3), undefined, GLOW]);
  const column: Box[] = [
    [x + dx, y + dy, h, w, w, hh, color, color, undefined, GLOW],
    [x + dx + 0.05, y + dy + w, h + hh * 0.4, 0.04, EDGE, hh * 0.45, CAVE_PLACE_COLORS.white, CAVE_PLACE_COLORS.white],
  ];
  if (stage >= TOWER)
    column.push([
      x + dx + 0.06,
      y + dy + 0.06,
      h + hh,
      w - 0.12,
      w - 0.12,
      0.16,
      CAVE_PLACE_COLORS.white,
      CAVE_PLACE_COLORS.white,
      'glow',
      GLOW, // die fertige Spitze leuchtet weich in den Raum
    ]);
  return [...back, ...beside, ...column, ...front];
}

const PX = 0.12;
/** Zahlen-Kristall: flacher Stein, obenauf seine Ziffer `note` in einer Kristallfarbe (leuchtet) */
export function stoneBoxes(c: Cell, x: number, y: number): Box[] {
  const h = c.h;
  const color = CAVE_PLACE_COLORS.caps[((c.note ?? 1) - 1) % CAVE_PLACE_COLORS.caps.length]!;
  const out: Box[] = [[x + 0.1, y + 0.1, h, 0.8, 0.8, 0.1, ...CAVE_PLACE_COLORS.slab]];
  (DIGITS[c.note ?? 0] ?? []).forEach((line, row) =>
    [...line].forEach((ch, col) => {
      if (ch === '#') out.push([x + 0.32 + col * PX, y + 0.2 + row * PX, h + 0.1, PX, PX, 0.02, color, color, 'glow']);
    }),
  );
  return out;
}

/** Echo-Wand: eine hohe, helle Felsplatte quer im Feld, vorn drei Bögen, die nach außen kleiner werden */
export function echoBoxes(c: Cell, x: number, y: number): Box[] {
  const h = c.h;
  const [side] = CAVE_PLACE_COLORS.arc;
  return [
    [x + 0.06, y + 0.3, h, 0.88, 0.4, 1.5, ...CAVE_PLACE_COLORS.echo],
    [x + 0.4, y + 0.7, h + 0.5, 0.2, 0.012, 0.5, side, side],
    [x + 0.26, y + 0.7, h + 0.6, 0.06, 0.012, 0.3, side, side],
    [x + 0.68, y + 0.7, h + 0.6, 0.06, 0.012, 0.3, side, side],
    [x + 0.14, y + 0.7, h + 0.68, 0.05, 0.012, 0.14, side, side],
    [x + 0.81, y + 0.7, h + 0.68, 0.05, 0.012, 0.14, side, side],
  ];
}

const shrooms = (world: World) => cellsOf(world, 'hoehle', 'leuchtpilze', (c) => c.deco === 'sleepshroom');
const heaps = (world: World) => cellsOf(world, 'hoehle', 'tuermchen', (c) => c.deco === 'crystalheap');

/**
 * Lichtinseln je Bild: für jeden wachen Pilz und jedes fertige Türmchen bis `CAVE_PLACES.near` Felder um die Figur ein
 * Körper ohne Teile, der selbst glimmt (`beacon`: kleines Loch der Dunkelmaske), eine Reihe hinter dem Ding
 */
export function glowBodies(state: State, world: World): readonly RideBody[] {
  const { x, y } = state.player;
  if (world.realm(x, y) !== 'hoehle') return [];
  const lit = [
    ...shrooms(world).filter((p) => awake(state.packs, ...p)),
    ...heaps(world).filter((p) => towerAt(state.packs, ...p) >= TOWER),
  ];
  return lit
    .filter(([px, py]) => Math.max(Math.abs(px - x), Math.abs(py - y)) <= CAVE_PLACES.near)
    .map(([px, py]): RideBody => ({
      id: `hoehle:licht:${px},${py}`,
      key: 'hoehle:licht',
      x: px,
      y: py - 1,
      z: world.cell(px, py).h,
      dir: 's',
      parts: [],
      beacon: true,
      foot: 0, // ohne Teile kein Fleck am Boden
    }));
}

/** Dasselbe für die Echo-Wand, immer: Im Dunkel sähe man die helle Platte sonst kaum (so gesehen im Browser) */
export function echoGlow(state: State, world: World): readonly RideBody[] {
  const { x, y } = state.player;
  if (world.realm(x, y) !== 'hoehle') return [];
  return cellsOf(world, 'hoehle', 'echo', (c) => c.deco === 'echostone')
    .filter(([px, py]) => Math.max(Math.abs(px - x), Math.abs(py - y)) <= CAVE_PLACES.near)
    .map(([px, py]): RideBody => ({
      id: `hoehle:echo:${px},${py}`,
      key: 'hoehle:licht',
      x: px,
      y: py - 1,
      z: world.cell(px, py).h,
      dir: 's',
      parts: [],
      beacon: true,
      foot: 0, // ohne Teile kein Fleck am Boden
    }));
}

/** Ein Pilz wacht auf: drei weiche Töne hinauf (C5 E5 G5) */
export const SHROOM_SCORE: readonly Scored[] = [
  [523.25, 0.16, 'sine', 0.05, 1, 0],
  [659.25, 0.16, 'sine', 0.05, 1, 0.13],
  [783.99, 0.36, 'sine', 0.05, 1, 0.26],
];
/** Ein Türmchen wächst: je Stufe ein Ton mehr hinauf (D5 E5 G5), beim fertigen dazu ein heller Schluss (D6) */
export const towerScore = (stage: number): Scored[] => {
  const notes = [587.33, 659.25, 783.99].slice(0, Math.max(1, Math.min(TOWER, stage)));
  const out = notes.map((f, i): Scored => [f, 0.14, 'triangle', 0.05, 1, i * 0.12]);
  return stage >= TOWER ? [...out, [1174.66, 0.4, 'sine', 0.04, 1, notes.length * 0.12]] : out;
};
/** Tonleiter der Zahlen-Kristalle 1 bis 9: C4 D4 E4 G4 A4 C5 D5 E5 G5 (tiefer und weicher als die Fähnchen im Eis) */
const LADDER = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99];
/** Ein Zahlen-Kristall klingt: ein weicher Ton und seine Oktave, höher mit seiner Zahl */
export const stoneScore = (n: number): Scored[] => {
  const f = LADDER[Math.max(1, Math.min(9, n)) - 1]!;
  return [
    [f, 0.2, 'triangle', 0.05, 1, 0],
    [f * 2, 0.3, 'sine', 0.03, 1, 0.1],
  ];
};
/** Die Echo-Wand antwortet: ein Ruf (A4 → E5), dann zweimal leiser zurück */
export const ECHO_SCORE: readonly Scored[] = [0, 0.4, 0.8].flatMap((at, i): Scored[] => [
  [440, 0.14, 'triangle', 0.06 / (i + 1) ** 1.5, 1, at],
  [659.25, 0.2, 'triangle', 0.06 / (i + 1) ** 1.5, 1, at + 0.14],
]);

/** Sehenswürdigkeiten: Leuchtpilze (nur schlafende locken), Kristallhaufen (nur unfertige), Zahlen-Kristalle, Echo-Wand */
export const CAVE_PLACE_SIGHTS: readonly Sight[] = [
  {
    id: 'hoehle:leuchtpilze',
    cells: (world, s) => shrooms(world).filter((p) => !awake(s.packs, ...p)),
    call: (_, [x, y]) => ({ type: 'caveshroom', x, y }),
    color: CAVE_PLACE_COLORS.caps[0],
    marks: (world, s) => shrooms(world).filter((p) => awake(s.packs, ...p)), // auf der Karte: wo es schon leuchtet
  },
  {
    id: 'hoehle:tuermchen',
    cells: (world, s) => heaps(world).filter((p) => towerAt(s.packs, ...p) < TOWER),
    call: (_, [x, y]) => ({ type: 'cavetower', x, y, stage: 1 }),
    color: CAVE_PLACE_COLORS.caps[2],
    marks: (world, s) => heaps(world).filter((p) => towerAt(s.packs, ...p) >= TOWER), // fertige Türmchen
  },
  {
    id: 'hoehle:zahlen',
    cells: (world) => cellsOf(world, 'hoehle', 'zahlen', (c) => c.deco === 'numstone'),
    call: (world, [x, y]) => ({ type: 'numstone', x, y, n: world.cell(x, y).note ?? 1 }),
    color: CAVE_PLACE_COLORS.caps[1],
  },
  {
    id: 'hoehle:echo',
    cells: (world) => cellsOf(world, 'hoehle', 'echo', (c) => c.deco === 'echostone'),
    call: (_, [x, y]) => ({ type: 'echo', x, y }),
    color: CAVE_PLACE_COLORS.echo[1],
  },
];
