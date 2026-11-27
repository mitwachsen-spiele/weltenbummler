// Aussehen und Klang am Rodelberg (Issue 50), gleich für 2D und 3D (Haken `View2D.bodies` und `rideFx`,
// mitwachsen-ride-view.ts) – rein, ohne DOM und Three.js: der Rodelreifen oben auf dem Gipfel (bis zur ersten Abfahrt
// mit goldenem Griff), unterwegs auf der Bahn mit der Figur darin (er gleitet zwischen den Takten weiter; bei
// reduzierter Bewegung springt er von Feld zu Feld), danach wird er an den Gipfel zurückgezogen (`PULL` Takte, nur im
// Bild: In den Regeln steht er sofort wieder oben; bei reduzierter Bewegung gleich), dazu die Fahne auf dem Gipfel, die
// Stufen der Treppe und die Töne: sein Signal E6 → C6 → A5, hell und abwärts.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Der Rodelberg“)

import type { Dir } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import { HILL_FLAG, TUBE_COLORS, tubeParts } from '../../../../data/games/worlds/eis/mitwachsen-tube-model';
import type { Cell } from '../../mitwachsen-cell';
import { dirTo } from '../../mitwachsen-free';
import type { RideEvent } from '../../mitwachsen-pack-types';
import { ridden } from '../../mitwachsen-ride-save';
import type { RideAt, RideBody, RideFx } from '../../mitwachsen-ride-view';
import type { State } from '../../mitwachsen-state';
import type { Box } from '../../mitwachsen-view';
import type { World } from '../../mitwachsen-world';
import type { Scored } from '../../sfx';
import { TUBE } from './mitwachsen-hill';
import { TUBE_SPEC, tubeRoute } from './mitwachsen-tube';

/** Kennung des Körpers (`ride:` trifft das Antippen) */
export const TUBE_ID = `ride:${TUBE}`;
/** So viele Takte lang wird der Reifen nach dem Aussteigen im Bild an den Gipfel zurückgezogen (3 s) */
export const PULL = 30;

const MODELS = {
  leer: tubeParts({}),
  gold: tubeParts({ gold: true }),
  figur: tubeParts({ rider: true }),
} as const;

/** Punkt bei Fortschritt `p` auf der Bahn `path`, zwischen den Feldern gleitend, in Fahrtrichtung */
function along(path: readonly Point[], p: number, world: World): { x: number; y: number; z: number; dir: Dir } {
  const i = Math.max(0, Math.min(path.length - 2, Math.floor(p)));
  const [a, b] = [path[i]!, path[i + 1]!];
  const f = Math.max(0, Math.min(1, p - i));
  const [ha, hb] = [world.cell(...a).h, world.cell(...b).h];
  return {
    x: a[0] + (b[0] - a[0]) * f,
    y: a[1] + (b[1] - a[1]) * f,
    z: ha + (hb - ha) * f,
    dir: dirTo(b[0] - a[0], b[1] - a[1]),
  };
}

/**
 * Körper am Rodelberg je Bild, solange die Figur in der Eis-Welt ist: die Fahne auf dem Feld hinter dem Gipfel und der
 * Reifen (oben, unterwegs mit der Figur oder auf dem Rückweg am Seil). Leer ohne Rodelberg
 */
export function tubeBodies(state: State, world: World, at: RideAt): readonly RideBody[] {
  const r = tubeRoute(world);
  if (!r) return [];
  const [tx, ty] = r.stops.home;
  if (world.realm(state.player.x, state.player.y) !== world.realm(tx, ty)) return [];
  const len = r.path.length - 1;
  const ride = state.ride?.id === TUBE ? state.ride : undefined;
  const flag: RideBody = {
    id: 'rodel:fahne',
    key: 'rodel:fahne',
    x: tx,
    y: ty - 1,
    z: world.cell(tx, ty - 1).h,
    dir: 's',
    parts: HILL_FLAG,
  };
  let p = 0;
  if (ride) {
    p = ride.phase === 'go' ? Math.max(0, ride.pos - ride.speed * (1 - at.frac)) : ride.pos;
    if (at.reduced) p = Math.floor(ride.pos); // ohne Gleiten: von Feld zu Feld
  } else if (!at.reduced && state.alighted?.id === TUBE) {
    const since = state.tick + at.frac - state.alighted.at;
    if (since < PULL) p = len * (1 - since / PULL); // am Seil zurück an den Gipfel
  }
  const spot = along(r.path, p, world);
  // goldener Griff bis zur ersten Abfahrt, nur solange das Kind einsteigen kann: nicht, solange die Fahr-Engine noch
  // lädt (`dozing`), nicht während einer Fahrt und nicht auf dem Rückweg am Seil
  const inviting = !ridden(state.packs, TUBE) && !state.ride && p === 0 && !state.dozing?.includes(TUBE);
  const kind = ride ? 'figur' : inviting ? 'gold' : 'leer';
  return [
    flag,
    {
      id: TUBE_ID,
      key: `${TUBE_ID}:${kind}`,
      ...spot,
      dir: ride ? spot.dir : 's',
      parts: MODELS[kind],
      ...(ride && { seat: true as const }),
    },
  ];
}

/** Stufe der Treppe (`'hillstep'`): ein Brett aus Holz (Maserung) quer über dem Feld, zwei Fugen */
export const stepBoxes = (c: Cell, x: number, y: number): Box[] => [
  [x + 0.05, y + 0.06, c.h, 0.9, 0.88, 0.05, ...TUBE_COLORS.step, undefined, { skin: 'holz' }],
  [x + 0.34, y + 0.06, c.h + 0.05, 0.03, 0.88, 0.006, TUBE_COLORS.seam, TUBE_COLORS.seam],
  [x + 0.64, y + 0.06, c.h + 0.05, 0.03, 0.88, 0.006, TUBE_COLORS.seam, TUBE_COLORS.seam],
];
/** Ein Feld der Bahn (`Cell.ride` `'rodel'`): glänzendes Eis, fast das ganze Feld */
export const runBox = (c: Cell, x: number, y: number): Box => [
  x + 0.06,
  y + 0.06,
  c.h,
  0.88,
  0.88,
  0.02,
  ...TUBE_COLORS.run,
];

const [E6, C6, A5] = TUBE_SPEC.signal as readonly [number, number, number];
/** Sein Signal E6 → C6 → A5, weich, ab `at` s */
const signal = (at = 0, gain = 0.05): Scored[] =>
  [E6, C6, A5].map((f, i): Scored => [f, 0.14, 'triangle', gain, 1, at + i * 0.13]);

/** Töne zu einem Ereignis des Rodelreifens */
export function tubeScores(e: RideEvent): Scored[] {
  switch (e.what) {
    case 'nudge':
      return signal();
    case 'board': // hineingesetzt: zwei Töne hinauf, gleich geht es los
      return [
        [A5, 0.1, 'sine', 0.05, 1, 0],
        [C6, 0.16, 'sine', 0.05, 1, 0.1],
      ];
    case 'go': // los: das Signal und ein langer Ton, der mit der Abfahrt hinabgleitet
      return [...signal(), [E6, 1.2, 'sine', 0.035, 0.55, 0.4]];
    case 'wave':
      return e.ring ? signal(0, 0.04) : [[C6, 0.08, 'sine', 0.03, 1, 0]];
    case 'stop':
      return [...signal(), ...signal(0.5)];
    case 'arrive': // weich in den Schnee
      return [
        [196, 0.22, 'triangle', 0.06, 0.7, 0],
        [A5, 0.2, 'sine', 0.04, 1, 0.08],
      ];
    case 'leave':
      return [[A5, 0.1, 'sine', 0.05, 0.8, 0]];
    case 'alight':
      return [
        [C6, 0.12, 'triangle', 0.06, 1, 0],
        [E6, 0.24, 'triangle', 0.06, 1, 0.1],
      ];
    default:
      return [];
  }
}

/** Schnee, der am Ziel aufstiebt */
const SNOW = ['#ffffff', '#e8f0f7', '#d5e4f0'] as const;

/** Was die Ansicht zu einem Ereignis des Rodelreifens zeigt (ein anderes Fahrzeug: undefined) */
export function tubeFx(e: RideEvent): RideFx | undefined {
  if (e.id !== TUBE) return undefined;
  const score = tubeScores(e);
  switch (e.what) {
    case 'arrive':
      return { score, burst: SNOW };
    case 'alight':
      return { score, who: 'player', heart: true };
    case 'wave':
      return { score, who: 'player' };
    case 'shoo':
      return { score, who: e.who };
    default:
      return { score };
  }
}
