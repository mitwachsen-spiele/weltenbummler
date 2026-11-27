// Aussehen und Klang der Spielorte im Gletschertal (mitwachsen-places.ts, Issue 52), gleich für 2D und 3D – rein, ohne
// DOM. Zahlen-Fähnchen: ein Mast mit blauem Tuch, darauf die Ziffer in Weiß zur Kamera (Pixel-Ziffern aus `DIGITS`); es
// bimmelt mit zwei hellen Tönen, höher mit der Zahl. Laternen-Tanne: eine kleine Kristall-Laterne vorn an der Tanne
// (ein eigener Körper vor dem Baum, den der Kern zeichnet), blass, solange sie aus ist, türkis mit hellem Kern, sobald
// sie brennt; kein Feuer, kein Gold. Töne in der C-Pentatonik.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Spielorte im Eis“)

import type { Fine, Part } from '../../../../lib/games/front';
import { DIGITS } from '../../../../data/games/mitwachsen-digits';
import { ICE_CRYSTALS } from '../../../../data/games/worlds/eis/mitwachsen-ice-colors';
import type { Cell } from '../../mitwachsen-cell';
import type { RideBody } from '../../mitwachsen-ride-view';
import { cellsOf, type Sight } from '../../mitwachsen-sight';
import type { State } from '../../mitwachsen-state';
import type { Box } from '../../mitwachsen-view';
import type { World } from '../../mitwachsen-world';
import type { Scored } from '../../sfx';
import { litOf } from './mitwachsen-places';

export const PLACE_COLORS = {
  pole: ['#6b4a2b', '#7d5a36'],
  cloth: [ICE_CRYSTALS[2], '#7aa2f2'], // Kornblau: hebt sich vom Schnee ab
  ink: '#ffffff',
  hook: '#3c4a5c',
  off: ['#bcd9e8', '#d9edf6'], // Laterne aus: blasses Eis
  on: [ICE_CRYSTALS[1], '#e8fff8'], // Laterne an: Türkis mit hellem Kern
} as const;

/** Feinheit (Entwurf „Feine Grafik“): Mast aus Holz, Tuch aus Stoff, Haken und Rahmen der Laterne aus Metall, ihr Kristall leuchtet, wenn sie brennt */
const WOOD: Fine = { skin: 'holz' },
  CLOTH: Fine = { skin: 'stoff' },
  IRON: Fine = { skin: 'metall' },
  GLOW: Fine = { halo: true };
/** Knauf oben auf dem Mast (Silber, kein Gold: Gold ist die Aktionsfarbe) */
const KNOB = '#d9dce6';

const PX = 0.08;
/** Zahlen-Fähnchen (`'numflag'`): Mast mit Knauf, Tuch nach rechts, die Ziffer `note` vorn darauf (scharf, ohne Muster) */
export function flagBoxes(c: Cell, x: number, y: number): Box[] {
  const h = c.h;
  const out: Box[] = [
    [x + 0.16, y + 0.46, h, 0.08, 0.08, 1.4, ...PLACE_COLORS.pole, undefined, WOOD],
    [x + 0.15, y + 0.45, h + 1.4, 0.1, 0.1, 0.06, KNOB, KNOB, undefined, IRON],
    [x + 0.24, y + 0.47, h + 0.82, 0.5, 0.05, 0.54, ...PLACE_COLORS.cloth, undefined, CLOTH],
  ];
  (DIGITS[c.note ?? 0] ?? []).forEach((line, row) =>
    [...line].forEach((ch, col) => {
      if (ch === '#')
        out.push([
          x + 0.37 + col * PX,
          y + 0.52,
          h + 1.3 - (row + 1) * PX,
          PX,
          0.012,
          PX,
          PLACE_COLORS.ink,
          PLACE_COLORS.ink,
        ]);
    }),
  );
  return out;
}

/**
 * Laterne vorn an einer Tanne: Haken und Kristall (aus oder an). Der Körper steht auf dem Feld vor der Tanne (eine Reihe
 * weiter zur Kamera) und hängt an dessen hinterer Kante: So zeichnet 2D ihn nach dem Baum, sonst verschwände er unter
 * den Ästen (so gesehen im Browser)
 */
const lamp = (lit: boolean): Part[] => {
  const [side, top] = lit ? PLACE_COLORS.on : PLACE_COLORS.off;
  return [
    [-0.5, -0.03, 0.72, 0.16, 0.06, 0.05, PLACE_COLORS.hook, null, undefined, IRON],
    [-0.5, -0.17, 0.66, 0.34, 0.34, 0.06, PLACE_COLORS.hook, null, undefined, IRON], // Deckel und Boden dunkel: So liest man sie auf dem Schnee
    [-0.5, -0.17, 0.26, 0.34, 0.34, 0.05, PLACE_COLORS.hook, null, undefined, IRON],
    lit
      ? [-0.48, -0.15, 0.31, 0.3, 0.3, 0.35, side, top, undefined, GLOW]
      : [-0.48, -0.15, 0.31, 0.3, 0.3, 0.35, side, top],
    ...(lit ? ([[-0.44, -0.08, 0.38, 0.28, 0.16, 0.2, top, top, undefined, GLOW]] as Part[]) : []),
  ];
};
const LAMPS = { aus: lamp(false), an: lamp(true) } as const;
/** So weit (Schachbrett) um die Figur werden Laternen gezeichnet */
const NEAR = 18;

const trees = (world: World) => cellsOf(world, 'eis', 'laternen', (c) => !!c.lamp);

/** Laternen der Tannen nah an der Figur, je Bild: aus oder an (`packs.eis.lit`) */
export function lampBodies(state: State, world: World): readonly RideBody[] {
  const { x, y } = state.player;
  if (world.realm(x, y) !== 'eis') return [];
  const lit = litOf(state.packs);
  return trees(world)
    .filter(([tx, ty]) => Math.max(Math.abs(tx - x), Math.abs(ty - y)) <= NEAR)
    .map(([tx, ty]): RideBody => {
      const on = lit.has(`${tx},${ty}`);
      return {
        id: `eis:laterne:${tx},${ty}`,
        key: `eis:laterne:${on ? 'an' : 'aus'}`,
        x: tx,
        y: ty + 1, // vor der Tanne, siehe `lamp`
        z: world.cell(tx, ty).h,
        dir: 's',
        parts: LAMPS[on ? 'an' : 'aus'],
        foot: 0, // hängt an der Tanne: kein Fleck am Boden
      };
    });
}

/** Tonleiter der Fähnchen 1 bis 9: C5 D5 E5 G5 A5 C6 D6 E6 G6 */
const LADDER = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98];
/** Ein Fähnchen bimmelt: zwei helle Töne, höher mit seiner Zahl */
export const flagScore = (n: number): Scored[] => {
  const f = LADDER[Math.max(1, Math.min(9, n)) - 1]!;
  return [
    [f, 0.1, 'sine', 0.05, 1, 0],
    [f * 2, 0.22, 'sine', 0.035, 1, 0.09],
  ];
};
/** Eine Laterne geht an: drei weiche Töne hinauf (E5 G5 C6) */
export const LAMP_SCORE: readonly Scored[] = [
  [659.25, 0.14, 'sine', 0.05, 1, 0],
  [783.99, 0.14, 'sine', 0.05, 1, 0.12],
  [1046.5, 0.34, 'sine', 0.05, 1, 0.24],
];

/** Sehenswürdigkeiten: die Fähnchen (bis eines gebimmelt hat) und die Laternen-Tannen (bis eine brennt) */
export const PLACE_SIGHTS: readonly Sight[] = [
  {
    id: 'eis:faehnchen',
    cells: (world) => cellsOf(world, 'eis', 'faehnchen', (c) => c.deco === 'numflag'),
    call: (world, [x, y]) => ({ type: 'numflag', x, y, n: world.cell(x, y).note ?? 1 }),
    color: PLACE_COLORS.cloth[0],
  },
  {
    id: 'eis:laternen',
    cells: (world, s) => trees(world).filter(([x, y]) => !litOf(s.packs).has(`${x},${y}`)),
    call: (_, [x, y]) => ({ type: 'treelamp', x, y }),
    color: PLACE_COLORS.on[0],
    marks: (world, s) => trees(world).filter(([x, y]) => litOf(s.packs).has(`${x},${y}`)), // auf der Karte: wo es schon leuchtet
  },
];
