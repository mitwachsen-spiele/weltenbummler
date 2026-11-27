// Aussehen und Klang des Grubenbähnchens Funkel, gleich für 2D und 3D (Haken `View2D.bodies`, `rails` und `rideFx`,
// mitwachsen-ride-view.ts) – rein, ohne DOM und Three.js. Körper: Lok und zwei Bankwagen (Modelle in
// src/data/games/worlds/grube/mitwachsen-funkel-model.ts) am Halt der Grotte, solange die Figur in der Grotte ist, oder
// unterwegs auf der Runde: Sie gleiten zwischen den Takten weiter (bei reduzierter Bewegung springen sie zwischen
// festen Bildern: Halt, Klingeltor ein, Mitte des Gangs, Klingeltor aus, Halt), jeder Wagen schaut in seine Fahrtrichtung. Die Tür des ersten Wagens geht zum Bahnsteig auf, wenn
// das Kind anstößt oder aussteigt, und hat bis zur ersten Fahrt einen goldenen Rahmen, solange das Kind einsteigen kann
// (nicht während einer Fahrt); die runde Lampe leuchtet während der Fahrt und am Abend (dann auch am Halt, mit einem
// kleinen Loch der Dunkelmaske, `RideBody.glow`) und blinkt am Halt, wenn das Kind zu Fuß ein Klingeltor anstößt (es
// antwortet; mitwachsen-gang-look.ts). Bei reduzierter Bewegung steht es in festen Bildern (`frameOf`, mitwachsen-gang.ts). Gleis: ein eigenes, schmales Gleisbild (Schiefer und dunkle Schienen, gerade oder in einer
// rechtwinkligen Kurve), nicht das der Höhlenbahn. Töne: sein Signal D5 → A5 (`RIDES`), Ankunft A5 → D5.
// Spezifikation: docs/specs/mitwachsen.md („Die Grubenbahn Funkel“)

import type { Dir, Fine } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import {
  GRUBE_RAIL,
  HALT_SIGN,
  PLANK,
  funkelParts,
  lapStoneParts,
  type FunkelLook,
} from '../../../../data/games/worlds/grube/mitwachsen-funkel-model';
import { dirTo } from '../../mitwachsen-free';
import type { Cell } from '../../mitwachsen-cell';
import type { RideEvent } from '../../mitwachsen-pack-types';
import { ridden } from '../../mitwachsen-ride-save';
import type { RideAt, RideBody, RideFx } from '../../mitwachsen-ride-view';
import type { RideRoute } from '../../mitwachsen-rider';
import type { State } from '../../mitwachsen-state';
import type { Box, DrawRails } from '../../mitwachsen-view';
import type { World } from '../../mitwachsen-world';
import type { Scored } from '../../sfx';
import { DIG } from '../../../../data/games/worlds/grube/mitwachsen-dig-model';
import { digAt } from './mitwachsen-dig';
import { FUNKEL, funkelRoute, lapStonesOf, lapsOf, platformNear } from './mitwachsen-funkel';
import { frameOf, gangOf } from './mitwachsen-gang';

/** Kennung der Körper (`ride:` trifft das Antippen) */
export const FUNKEL_ID = `ride:${FUNKEL.id}`;
/** So lange (ms) blinkt die Lampe am Halt, wenn das Kind zu Fuß ein Klingeltor anstößt, je `BLINK_STEP` an oder aus */
export const BLINK_MS = 1200;
const BLINK_STEP = 200;
/** So viele Takte nach dem Anstoßen oder Aussteigen steht die Tür offen (1 s) */
export const OPEN_TICKS = 10;
/** Rechte Hand, wenn ein Wagen in Richtung d schaut (wie in front.ts) */
const RIGHT: Record<Dir, Point> = { e: [0, 1], w: [0, -1], s: [-1, 0], n: [1, 0] };

type Spot = { x: number; y: number; z: number; dir: Dir };

const memo = new Map<string, ReturnType<typeof funkelParts>>();
/** Teile einer Variante, je Schlüssel einmal (die 3D-Ansicht baut jede Form nur einmal) */
const model = (key: string, look: FunkelLook) => memo.get(key) ?? (memo.set(key, funkelParts(look)), memo.get(key)!);

/** Feld `i` der Runde (beliebig über das Ende hinaus oder davor: die Runde schließt sich) */
function cellAt(r: Pick<RideRoute, 'path'>, i: number): Point {
  const n = r.path.length - 1; // das letzte Feld ist wieder das erste
  return r.path[((Math.floor(i) % n) + n) % n]!;
}

/** Punkt bei Fortschritt `p` auf der Runde, zwischen den Feldern gleitend, mit der Richtung dieses Stücks */
function along(r: Pick<RideRoute, 'path'>, p: number, world: World): Spot {
  const [a, b] = [cellAt(r, p), cellAt(r, p + 1)];
  const f = p - Math.floor(p);
  const [ha, hb] = [world.cell(...a).h, world.cell(...b).h];
  return {
    x: a[0] + (b[0] - a[0]) * f,
    y: a[1] + (b[1] - a[1]) * f,
    z: ha + (hb - ha) * f,
    dir: dirTo(b[0] - a[0], b[1] - a[1]),
  };
}

/**
 * Wo der erste Wagen (der Sitz) gerade ist, als Index der Runde: am Halt 0, unterwegs zwischen den Takten weiter, bei
 * reduzierter Bewegung das feste Bild (`frameOf`: Halt, Klingeltor ein, Mitte des Gangs, Klingeltor aus, Halt). Hat der
 * Maulwurf den Gang eben gegraben (`State.dig`, ab `DIG.pop`), wartet Funkel am Klingeltor des Ausgangs und rollt dann aus
 * dem Gang an den Halt (`DIG.roll`); bei reduzierter Bewegung steht es gleich am Halt
 */
export function funkelAt(r: RideRoute, state: State, at: Pick<RideAt, 'frac' | 'reduced'>, world: World): number {
  const ride = state.ride?.id === FUNKEL.id ? state.ride : undefined;
  if (!ride) return rollAt(r, state, at, world);
  const p = ride.phase === 'go' ? Math.max(0, ride.pos - ride.speed * (1 - at.frac)) : ride.pos;
  return at.reduced ? frameOf(gangOf(world, r), p, r.path.length - 1) : p;
}

/** Rollt Funkel nach dem Graben gerade aus dem Gang an den Halt? Wo der Sitz ist (Index der Runde), sonst 0 (am Halt) */
function rollAt(r: RideRoute, state: State, at: Pick<RideAt, 'frac' | 'reduced'>, world: World): number {
  const w = state.dig?.laid ? digAt(state, at.frac) : undefined;
  if (w === undefined || at.reduced) return 0;
  const n = r.path.length - 1;
  const out = gangOf(world, r)?.gates.out ?? Math.max(0, n - 8);
  const [from, to] = DIG.roll;
  const f = Math.min(1, Math.max(0, (w - from) / (to - from)));
  return f >= 1 ? 0 : out + (n - out) * f;
}

/** Rollt Funkel nach dem Graben noch an seinen Halt (Lampe an, keine Tür, kein Gold)? */
const rolling = (state: State) => !!state.dig?.laid;

/** Seite der Tür zum Bahnsteig für einen Wagen mit Blick `dir` an der Stelle `x, y` (+1 rechts, −1 links) */
function sideOf(world: World, spot: Spot): 1 | -1 {
  const [rx, ry] = RIGHT[spot.dir];
  const [x, y] = [Math.round(spot.x), Math.round(spot.y)];
  return world.cell(x + rx, y + ry).stop === FUNKEL.id ? 1 : -1;
}

/** Lichter auf dem Dach des zweiten Wagens: unterwegs so viele Runden, wie noch kommen, am Halt so viele, wie gewählt sind */
const lightsOf = (state: State, riding: boolean) => (riding ? (state.ride?.laps ?? 1) : lapsOf(state));

/**
 * Körper von Funkel je Bild: Lok, erster Wagen (mit der Figur während seiner Fahrt), zweiter Wagen; am Halt, solange die
 * Figur in der Grotte ist, oder unterwegs. Leer, solange der Gang nicht gegraben ist oder die Figur woanders ist. Nur
 * seine eigene Fahrt bewegt ihn und setzt die Figur hinein. `rang`: wann (ms, wie `at.now`) das Kind zu Fuß zuletzt
 * ein Klingeltor angestoßen hat; danach blinkt die Lampe am Halt `BLINK_MS` lang (bei reduzierter Bewegung leuchtet sie)
 */
export function funkelBodies(state: State, world: World, at: RideAt, rang = -Infinity): readonly RideBody[] {
  const r = funkelRoute(world, state);
  if (!r) return [];
  const riding = state.ride?.id === FUNKEL.id;
  if (!riding && world.realm(state.player.x, state.player.y) !== world.realm(...r.stops.home)) return [];
  const p = funkelAt(r, state, at, world);
  const dozing = !!state.dozing?.includes(FUNKEL.id);
  const ago = (t: { id: string; at: number } | undefined) => (t?.id === FUNKEL.id ? state.tick - t.at : Infinity);
  const open = !riding && Math.min(ago(state.nudged), ago(state.alighted)) < OPEN_TICKS;
  // goldener Rahmen bis zur ersten Fahrt, nur wenn das Kind einsteigen kann (wie beim Zug): nicht, wenn es schläft,
  // und nicht während einer Fahrt, auch nicht der eigenen
  const gold = !ridden(state.packs, FUNKEL.id) && !dozing && !state.ride && !state.dig;
  const since = at.now - rang;
  const blink = !riding && since >= 0 && since < BLINK_MS && (at.reduced || Math.floor(since / BLINK_STEP) % 2 === 0);
  const lit = riding || at.lit || blink || rolling(state);
  const lights = lightsOf(state, riding);
  const kinds = [
    ['loco', p + 1],
    ['seat', p],
    ['rear', p - 1],
  ] as const;
  return kinds.map(([kind, q]): RideBody => {
    const spot = along(r, q, world);
    const side = sideOf(world, spot);
    const look: FunkelLook =
      kind === 'loco'
        ? { kind, lit }
        : kind === 'seat'
          ? { kind, rider: riding, door: open ? side : 0, frame: gold ? side : 0 }
          : { kind, lights };
    const k = `${FUNKEL_ID}:${kind}:${+!!look.lit}${+!!look.rider}${look.door ?? 0}${look.frame ?? 0}${look.lights ?? ''}`;
    const seat = kind === 'seat' && riding ? { seat: true as const } : {};
    // die Lampe leuchtet am Halt (am Abend): die Dunkelmaske öffnet dort ein kleines Loch (mitwachsen-mask.ts)
    const glow = kind === 'loco' && lit && !riding ? { glow: true as const } : {};
    return { id: `${FUNKEL_ID}:${kind}`, key: k, ...spot, parts: model(k, look), ...seat, ...glow };
  });
}

// ---------- Gleis ----------

/** Quader in einem Feld, ohne Lage: x, y (nach vorn), z über dem Boden, Breite, Tiefe, Höhe, Seite, oben, Feinheit */
type Local = readonly [number, number, number, number, number, number, string, string, Fine];
const [G1, G2, W, Z] = [0.32, 0.62, 0.06, 0.04]; // schmale Spur: Schienen links und rechts, Breite, auf den Schwellen
/** Fein: Schwellen mit Maserung (Holz, in ihrer Farbe aus Schiefer), Schienen gebürstet (Metall) */
const [WOOD, METAL]: readonly [Fine, Fine] = [{ skin: 'holz' }, { skin: 'metall' }];
const sleeper = (x: number, y: number, w: number, d: number): Local => [x, y, 0, w, d, Z, ...GRUBE_RAIL.sleeper, WOOD];
const bar = (x: number, y: number, w: number, d: number): Local => [x, y, Z, w, d, 0.05, ...GRUBE_RAIL.rail, METAL];
/** Gerade von oben nach unten */
const STRAIGHT: readonly Local[] = [
  sleeper(0.18, 0.12, 0.64, 0.16),
  sleeper(0.18, 0.62, 0.64, 0.16),
  bar(G1, 0, W, 1),
  bar(G2, 0, W, 1),
];
/** Kurve von oben nach rechts: innen treffen sich die Schienen bei (G2, G1), außen bei (G1, G2) */
const CURVE: readonly Local[] = [
  sleeper(0.18, 0.06, 0.64, 0.16),
  sleeper(0.78, 0.18, 0.16, 0.64),
  bar(G2, 0, W, G1 + W),
  bar(G1, 0, W, G2 + W),
  bar(G2, G1, 1 - G2, W),
  bar(G1, G2, 1 - G1, W),
];
/** Ein Quader um eine Vierteldrehung im Uhrzeigersinn um die Mitte des Felds (oben wird rechts) */
const turn = ([x, y, z, w, d, ...rest]: Local): Local => [1 - y - d, x, z, d, w, ...rest];
/** Form und Vierteldrehungen je Paar von Richtungen (sortiert) */
const SHAPES: Record<string, readonly [readonly Local[], number]> = {
  ns: [STRAIGHT, 0],
  ew: [STRAIGHT, 1],
  en: [CURVE, 0],
  es: [CURVE, 1],
  sw: [CURVE, 2],
  nw: [CURVE, 3],
};
const shaped = new Map<string, readonly Local[]>();
/** Die Quader des Gleises für die Richtungen `to` (zwei Buchstaben, gleich in welcher Reihe) */
export function railShape(to: string): readonly Local[] | undefined {
  const k = [...to].sort().join('');
  const known = shaped.get(k);
  if (known) return known;
  const s = SHAPES[k];
  if (!s) return undefined;
  let out = s[0];
  for (let i = 0; i < s[1]; i++) out = out.map(turn);
  shaped.set(k, out);
  return out;
}

/** Gleis der Grubenbahn auf einem Feld (`DrawRails`): nur auf ihrem gebauten Gleis (`Cell.ride` und `Lane.to`), sonst null */
export const grubeRails: DrawRails = (c: Cell, x: number, y: number) => {
  const shape = c.ride === FUNKEL.id && c.lane?.to ? railShape(c.lane.to) : undefined;
  return shape
    ? shape.map((b): Box => [x + b[0], y + b[1], c.h + b[2], b[3], b[4], b[5], b[6], b[7], undefined, b[8]])
    : null;
};

// ---------- Töne ----------

const [D5, A5] = FUNKEL.signal as readonly [number, number];
/** Sein Signal D5 → A5, weich im Dreieck, ab `at` s */
export const signal = (at = 0, gain = 0.05): Scored[] => [
  [D5, 0.14, 'triangle', gain, 1, at],
  [A5, 0.22, 'triangle', gain, 1, at + 0.16],
];

/** Töne zu einem Ereignis von Funkel */
export function funkelScores(e: RideEvent): Scored[] {
  switch (e.what) {
    case 'nudge': // die Tür geht einladend auf
    case 'go':
      return signal();
    case 'stop': // vor einem Tier: freundlich, zweimal
      return [...signal(), ...signal(0.45)];
    case 'board':
      return [
        [659.25, 0.1, 'sine', 0.04, 1, 0],
        [A5, 0.16, 'sine', 0.04, 1, 0.1],
      ];
    case 'arrive': // angekommen: das Signal abwärts
      return [
        [A5, 0.14, 'triangle', 0.05, 1, 0],
        [D5, 0.3, 'triangle', 0.05, 1, 0.16],
      ];
    case 'leave':
      return [[659.25, 0.1, 'sine', 0.05, 0.8, 0]];
    case 'wave': // gedrosselt das Signal, sonst ein leiser Ton: Jeder Druck hört etwas
      return e.ring ? signal(0, 0.04) : [[A5, 0.08, 'sine', 0.03, 1, 0]];
    case 'alight':
      return [
        [A5, 0.12, 'triangle', 0.06, 1, 0],
        [1174.66, 0.24, 'triangle', 0.06, 1, 0.1],
      ];
    case 'lap': // eine Runde ist um, weiter in die nächste: ein heller Ton, ein Licht auf dem Dach geht aus
      return [[A5, 0.12, 'triangle', 0.04, 1, 0]];
    case 'snore': // es schläft, bis sein Paket da ist: ganz leise, gleitet hinab
      return [[D5, 0.5, 'sine', 0.02, 0.9, 0]];
    default: // ein Tier hüpft beiseite: das zeigt das Bild
      return [];
  }
}

/**
 * Was die Ansicht zu einem Ereignis von Funkel zeigt (ein Ereignis eines anderen Fahrzeugs: undefined): Töne, die Figur
 * hüpft beim Winken und Aussteigen (mit Herz), das Tier, das beiseite hüpft; schläft es, steigt ein Zzz auf
 */
export function funkelFx(e: RideEvent): RideFx | undefined {
  if (e.id !== FUNKEL.id) return undefined;
  const score = funkelScores(e);
  switch (e.what) {
    case 'alight':
      return { score, who: 'player', heart: true };
    case 'wave':
      return { score, who: 'player' };
    case 'shoo':
      return { score, who: e.who };
    case 'snore':
      return { score, zzz: true };
    default:
      return { score };
  }
}

/**
 * Bahnsteig an Funkels Halt (Issue 39), sobald der Gang gegraben ist und die Figur in der Grotte ist: je Feld des
 * Bahnsteigs eine Planke flach auf dem Boden und ein Schild auf dem Feld, das am weitesten vom Sitz liegt (zur Kamera
 * gewandt). Nur Bild: Die Felder bleiben begehbar wie zuvor, die Warteplätze der Tiere bleiben. Dazu die vier
 * Zahlensteine (Issue 48, feste Felder: `lapStones`), der gewählte in Petrol mit heller Ziffer, die anderen mit goldener
 */
export function haltBodies(state: State, world: World): readonly RideBody[] {
  const r = funkelRoute(world, state);
  const seat = r?.stops.home;
  if (!seat || world.realm(state.player.x, state.player.y) !== world.realm(...seat)) return [];
  const cells = platformNear(world, seat);
  const far = cells.at(-1);
  const at = ([x, y]: Point) => ({ x, y, z: world.cell(x, y).h, dir: 's' as const });
  return [
    ...cells.map((p, i): RideBody => ({ id: `grube:steg:${i}`, key: 'grube:steg', ...at(p), parts: PLANK, foot: 0 })),
    ...(far ? [{ id: 'grube:schild', key: 'grube:schild', ...at(far), parts: HALT_SIGN }] : []),
    ...lapStonesOf(world, state).map((p, i): RideBody => {
      // Zahlensteine: Im Dunkel der Grotte hat jeder ein kleines Loch der Dunkelmaske (`glow`), der gewählte ist Petrol
      const chosen = lapsOf(state) === i + 1;
      const k = `grube:stein:${i + 1}:${+chosen}`;
      return {
        id: `grube:stein:${i + 1}`,
        key: k,
        ...at(p),
        parts: stone(k, i + 1, chosen),
        glow: true,
      };
    }),
  ];
}

const stoneMemo = new Map<string, ReturnType<typeof lapStoneParts>>();
/** Teile eines Zahlensteins, je Schlüssel einmal */
const stone = (k: string, n: number, chosen: boolean) =>
  stoneMemo.get(k) ?? (stoneMemo.set(k, lapStoneParts(n, chosen)), stoneMemo.get(k)!);

/** Töne eines Zahlensteins: so viele wie seine Zahl, aufwärts in der Pentatonik (D5, E5, G5, A5) */
export const lapScore = (n: number): Scored[] =>
  [D5, 659.25, 783.99, A5].slice(0, n).map((f, i): Scored => [f, 0.16, 'triangle', 0.05, 1, i * 0.17]);
