// Bahnhof Bär und der Zug im Bild – rein, ohne DOM, gleich für 2D und 3D (Körper über den Haken `View2D.bodies`, wie
// Schlitten und Schuppen): ab Ausbau 1 die Reihen des Bahnsteigs (Planken, helle Kante, Stirnseite aus Holz), das
// Grasdach mit Bank und das Schild „Bär auf Grün“, dazu der Zug aus Lok und zwei Wagen am Bahnsteig, im
// hinteren Wagen Tok. Solange Tok baut (`State.work`, mitwachsen-build.ts), ploppt der Bahnhof zum Augenblick `pop` auf
// (er wächst kurz aus dem Boden), der Zug rollt von `roll` an das Gleis entlang heran, die Tür des hinteren Wagens geht
// zu `door` auf, und Tok sitzt ab `board` darin. Der Zug rollt aus dem Tunnelportal heran: Was von ihm noch im Tunnel
// ist, ist nicht zu sehen. Bei reduzierter Bewegung kein Aufploppen, kein Dampf, der Zug rückt in
// ruhigen Sprüngen vor. Der Zug fährt nie durch die Figur: Steht sie auf dem Gleis, hält er davor. Wo alles steht,
// rechnet `stationOf` je Welt einmal aus den Feldern (Gleis vom Prellbock an Bahnhof Bär, Bahnsteig; Reihen
// und Dach aus mitwachsen-platform.ts). Die Türen gehen zum Bahnsteig des Halts auf, an dem er steht (`sideAt`).
// Fahren: Der Zug steht, wo die Regeln ihn parken (`parked`: an Bahnhof Bär, am Prellbock in der Bucht, an Bahnhof
// Fledermaus), und fährt mit der Figur im mittleren Wagen das Gleis entlang (zwischen den Takten gleitend, bei
// reduzierter Bewegung springt er ans Ziel); die Tür des mittleren Wagens hat bis zur ersten Fahrt (`gefahren`) einen
// goldenen Rahmen, solange er dort steht, wo die Figur einsteigen kann (nicht, solange er schläft, weil ein Paket
// fehlt: dann ohne Dampf und Licht), angestoßen geht sie kurz auf; im Tunnel und am
// Abend leuchten die Lampen; ab 20 min Spielzeit (und nachts) leuchtet das Fensterband warm; nach „Gute Nacht“ sind
// Lampen, Fenster und Dampf aus, nur ein kleines Nachtlicht brennt; auf der Laternenfahrt leuchtet alles, und
// Glühwürmchen folgen ihm, solange er in der Höhlenwelt ist (nicht bei reduzierter Bewegung); danach trägt die Lok den
// Kristall-Wimpel (Stufe `fest`). Tok sitzt im hinteren Wagen, solange er nicht in der Bucht wartet. Der Zug fährt immer
// vorwärts: Geparkt behält er die Richtung, mit der er ankam (an Bahnhof Bär die Lok zu Bär, am Prellbock in der Bucht
// und an Bahnhof Fledermaus zur Höhle); er dreht nur bei der Abfahrt, am Takt, an dem er losfährt (nach den 2 s, in denen
// die Türen zu sind), hinter einer Dampfkugel je Wagen (`puffOf`; bei reduzierter Bewegung ohne Wolke, er steht einfach
// richtig herum da). Lampen, Dampf, Tür, Tok im hinteren Wagen und die Glühwürmchen drehen mit. Teil des Pakets der Bahn
// (view-2d.ts).
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Bau 1)

import type { Dir, Part } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import { BUILD } from '../../../../data/games/worlds/bahn/mitwachsen-bahn';
import {
  CAR,
  ROOF,
  ROOF_POSTS,
  ROOF_TOP,
  SIGN,
  signAt,
  carParts,
  puffParts,
  rowParts,
  steamParts,
  type CarLook,
} from '../../../../data/games/worlds/bahn/mitwachsen-train-model';
import { dirTo } from '../../mitwachsen-free';
import { heraldOf, workOf } from '../../mitwachsen-herald';
import type { RideAt, RideBody } from '../../mitwachsen-ride-view';
import type { State } from '../../mitwachsen-state';
import type { World } from '../../mitwachsen-world';
import { builtOf } from './mitwachsen-built';
import { DEPART, parked } from '../../mitwachsen-ride-kit';
import type { End } from '../../mitwachsen-rider';
import { ridden, stageOf, tokOf } from '../../mitwachsen-ride-save';
import { LETTERS, STEPS } from './mitwachsen-trace';
import { SEAT, TRAIN, bearEnd, farOf, inTunnel, lineOf, trainRoute } from './mitwachsen-train';
import { batBodies } from './mitwachsen-bat-look';
import { batPlatform, bearPlatform, underRoof, type Standing } from './mitwachsen-platform';
import { capOf } from './mitwachsen-build2';
import { FLIES, fireflies } from './mitwachsen-feast-look';

/** Bahnhof Bär in einer Welt: das Gleis vom Prellbock an (Ausbau 1, bis an den Prellbock vor der Tür), Reihen */
export type BearStation = {
  line: Point[];
  rows: { edge: Point; back: Point }[];
  /** vom Gleis zum Bahnsteig */
  side: Point;
  /** die beiden Reihen unter dem Dach (`BEAR_ROOF`) */
  roof: readonly [number, number];
  /** Stelle des Tunnelportals im Gleis (undefined: keins gefunden) */
  portal?: number;
};

const stations = new WeakMap<World, BearStation | null>();

/** Das Gleis des Ausbaus 1 vom Feld `start` an in Reihe (den Richtungen der Stücke nach) */
function railFrom(world: World, start: Point | undefined): Point[] {
  const line: Point[] = [];
  for (let p = start; p && line.length < 400;) {
    line.push(p);
    const r = world.cell(...p).rail;
    const on = r && (line.length === 1 ? r.to[0] : r.to[1]);
    if (!r || r.stage !== 1 || !on) break;
    const [dx, dy] = STEPS[LETTERS.indexOf(on)]!;
    p = [p[0] + dx, p[1] + dy];
  }
  return line;
}

/**
 * Bahnhof Bär aus den Feldern der Welt (je Welt einmal): der Prellbock am Anfang der Linie auf der Lichtung, von dort das
 * Gleis des Ausbaus 1 in Reihe, die Felder des Bahnsteigs (`Cell.stop`) daneben; null ohne Gleis
 */
export function stationOf(world: World): BearStation | null {
  if (stations.has(world)) return stations.get(world)!;
  const line = railFrom(world, bearEnd(world));
  const p = bearPlatform(world);
  const portal = line.findIndex((q) => world.cell(...q).rail?.part === 'portal');
  const found: BearStation | null = p
    ? {
        line,
        rows: p.rows,
        side: p.side,
        roof: p.roof,
        ...(portal > 0 ? { portal } : {}),
      }
    : null;
  stations.set(world, found);
  return found;
}

const memo = new Map<string, Part[]>();
const model = (k: string, make: () => Part[]) => memo.get(k) ?? (memo.set(k, make()), memo.get(k)!);

/** Wo die Front der Lok steht, wenn der Zug am Bahnsteig hält (Stelle im Gleis vom Prellbock an) */
export const PARK = 0.9;
/** Abstand der Wagen: Länge eines Wagens und eine kleine Lücke */
const GAP = CAR + 0.1;
/** Die Reihe des Bahnsteigs (vom Prellbock an) neben dem hinteren Wagen des haltenden Zugs: Dort steigt Tok ein */
export const REAR_ROW = Math.round(PARK + 2 * GAP + CAR / 2);
/** So viele Felder rollt der Zug beim Bau heran, wenn es kein Tunnelportal gibt (sonst aus dem Portal) */
export const ROLL_IN = 16;
/** Bei reduzierter Bewegung rückt er beim Bau in Sprüngen so vieler Felder heran */
const JUMP = 2;
/** Halbbreite des weichen Flecks unter einem Wagen: so breit wie der Wagen (`RideBody.foot`) */
export const CAR_FOOT = 0.46;
/** Kennung der Körper des Zugs (`ride:` trifft das Antippen, wie beim Schlitten) */
export const TRAIN_ID = 'ride:hoehle';
/** So lange ploppt der Bahnhof auf (Bruchteil des Baus) */
const POP_FOR = 0.06;

/**
 * Wie weit Bau 1 ist, zwischen den Takten weiter (`frac`); undefined: es wird nicht gebaut (oder es ist Bau 2, der den
 * Bahnhof Bär nicht ändert und den Zug fahren lässt)
 */
function progress(state: State, at: Pick<RideAt, 'frac'>): number | undefined {
  const w = builtOf(state.packs) >= 2 ? undefined : workOf(state);
  return w === undefined ? undefined : Math.min(1, w + at.frac / BUILD.ticks);
}

/** Punkt an der Stelle `t` (in Feldern vom Prellbock an) des Gleises, zwischen den Feldern weiter, samt Höhe */
function along(world: World, line: readonly Point[], t: number): [number, number, number] {
  const n = line.length - 1;
  const c = Math.max(0, Math.min(n, t));
  const i = Math.min(n - 1, Math.floor(c));
  const a = line[Math.max(0, i)]!,
    b = line[Math.max(0, Math.min(n, i + 1))]!;
  const f = n > 0 ? c - i : 0;
  const ha = world.cell(...a).h,
    hb = world.cell(...b).h;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, ha + (hb - ha) * f];
}

/**
 * Wo die Front der Lok steht (Stelle im Gleis): am Bahnsteig (`PARK`); solange der Zug beim Bau heranrollt, weiter weg,
 * zu Beginn am Tunnelportal (zuerst schnell, dann langsamer; bei reduzierter Bewegung in Sprüngen); vor dem Augenblick
 * `roll` ist er noch nicht da (undefined). Steht die Figur auf dem Gleis zwischen ihm und dem Bahnsteig, hält er vor ihr
 */
export function frontAt(
  st: BearStation,
  player: { x: number; y: number },
  work: number | undefined,
  reduced: boolean,
): number | undefined {
  const [r0, r1] = BUILD.roll;
  if (work !== undefined && work < r0) return undefined;
  const room = Math.max(0, st.portal ?? Math.min(ROLL_IN, st.line.length - 1 - PARK - 3 * GAP));
  const q = work === undefined ? 1 : Math.min(1, (work - r0) / (r1 - r0));
  let off = room * (1 - q) ** 2;
  if (reduced) off = Math.ceil(off / JUMP - 1e-9) * JUMP;
  const front = PARK + Math.min(room, off);
  const k = st.line.findIndex((p) => p[0] === player.x && p[1] === player.y);
  return k >= 0 && k + 1 > front - 3 * GAP && k < front + 3 * GAP ? Math.max(front, k + 1.1) : front;
}

const RIGHT: Record<Dir, Point> = { e: [0, 1], w: [0, -1], s: [-1, 0], n: [1, 0] };

/**
 * Körper von Bahnhof Bär und Zug je Bild (`View2D.bodies`), ab Ausbau 1; ab Ausbau 2 in der Welt dazu Bahnhof
 * Fledermaus und der Lokschuppen (mitwachsen-bat-look.ts); leer davor und in einer Welt ohne Gleis
 */
export function stationBodies(state: State, world: World, at: RideAt): readonly RideBody[] {
  if (builtOf(state.packs) < 1) return [];
  const st = stationOf(world);
  if (!st) return [];
  const work = progress(state, at);
  return [
    ...stationParts(st, world, state, work, at.reduced),
    ...trainParts(st, world, state, work, at),
    ...batBodies(world, state),
  ];
}

/**
 * Bahnsteig, Dachplatte (ein eigener Körper), Pfosten mit Bank und Schild; beim Bau erst ab `pop`, dann
 * wachsen sie kurz aus dem Boden
 */
function stationParts(
  st: BearStation,
  world: World,
  state: Standing,
  work: number | undefined,
  reduced: boolean,
): RideBody[] {
  if (work !== undefined && work < BUILD.pop) return [];
  const rise = work === undefined || reduced ? 0 : Math.max(0, 1 - (work - BUILD.pop) / POP_FOR) * -0.9;
  const dir = dirTo(...st.side);
  const out: RideBody[] = st.rows.map(({ edge, back }, i) => {
    const k = `bahn:reihe:${i % 2}`;
    return {
      id: `bahn:reihe:${i}`,
      key: k,
      x: (edge[0] + back[0]) / 2,
      y: (edge[1] + back[1]) / 2,
      z: world.cell(...edge).h + rise,
      dir,
      parts: model(k, () => rowParts(i % 2 === 1)),
      foot: 0, // liegt flach
    };
  });
  const under = st.roof.flatMap((i) => (st.rows[i] ? [st.rows[i].edge, st.rows[i].back] : []));
  if (under.length === 4) {
    const x = under.reduce((s, p) => s + p[0], 0) / 4,
      y = under.reduce((s, p) => s + p[1], 0) / 4;
    const z = world.cell(...under[0]!).h + rise;
    out.push(
      {
        id: 'bahn:dach',
        key: 'bahn:dach',
        x,
        y,
        z,
        dir,
        parts: ROOF,
        foot: 0, // schwebt
        ...(underRoof(st, state) ? { sheer: true } : {}),
      },
      // Pfosten und Bank stehen hinten, nicht in der Mitte; das Schild steht auf dem Dach: kein Fleck
      { id: 'bahn:pfosten', key: 'bahn:pfosten', x, y, z, dir, parts: ROOF_POSTS, foot: 0 },
      {
        id: 'bahn:schild',
        key: 'bahn:schild',
        ...signAt(x, y, st.side),
        z: z + ROOF_TOP,
        dir: 's',
        parts: SIGN,
        foot: 0,
      },
    );
  }
  return out;
}

/** So viele Takte nach dem Anstoßen und nach dem Aussteigen steht die Tür des mittleren Wagens offen (1 s) */
export const OPEN_TICKS = 10;

/**
 * Wo der Zug steht: das Gleis von Bahnhof Bär an, die Stelle des Endes zu Bahnhof Bär darauf (`front`) und wohin die
 * Lok schaut (`heading`: `out` zu Bahnhof Bär, `home` zur Höhle), zu welcher Seite die Tür aufgeht (`side`: zum
 * Bahnsteig des Halts, an dem er steht)
 */
type Place = { line: readonly Point[]; front: number; heading: End; side: Point };

/** Halt, an dem eine Fahrt begann: der echte Start (`Ride.from`, aus der Bucht in die Höhle), sonst gegenüber von `to` */
export const startOf = (ride: Pick<NonNullable<State['ride']>, 'to' | 'from'>): End =>
  ride.from?.end ?? (ride.to === 'out' ? 'home' : 'out');

/**
 * Wohin die Lok während einer Fahrt schaut: bis zur Abfahrt (Phase `seated`, Türen zu) wie angekommen, also zum Halt, an
 * dem sie steht (`startOf`; aus der Bucht in die Höhle schon zum Tor, sie dreht also nicht); ab dem Takt, an dem der Zug
 * losfährt, in Fahrtrichtung (`to`). Geparkt schaut sie zum Halt, an dem sie steht. Der Spielstand weiß davon nichts,
 * es ist nur Bild
 */
export function headingOf(ride: Pick<NonNullable<State['ride']>, 'phase' | 'to' | 'from'>): End {
  return ride.phase !== 'seated' ? ride.to : startOf(ride);
}

/**
 * Takte um die Abfahrt (0: der Takt, an dem der Zug losfährt und umdreht), in denen die Dampfkugeln wachsen (`from` bis
 * `full`), ganz aufgeblüht decken (`full` bis `until`, auch wenn die 3D-Ansicht ein Bild auslässt) und vergehen (bis
 * `gone`)
 */
export const PUFF_T = { from: -8, full: -3, until: 2, gone: 6 } as const;
/** So viele Größen hat eine Dampfkugel (feste Modelle) */
const PUFF_STEPS = 4;

/**
 * Größe der Dampfkugeln in diesem Bild (1 … `PUFF_STEPS`, `PUFF_STEPS` ganz deckend); undefined: keine Wolke (keine
 * Fahrt des Zugs, er dreht nicht, reduzierte Bewegung, oder es ist vorbei). Die Zeit kommt aus der Fahrt: vor dem
 * Losfahren aus den Takten seit dem Einsteigen, danach aus dem Weg (so puffert ein Halt vor einem Tier nicht noch einmal)
 */
export function puffOf(state: Pick<State, 'ride' | 'tick'>, world: World, at: RideAt): number | undefined {
  const ride = state.ride?.id === TRAIN.id ? state.ride : undefined;
  if (!ride || at.reduced || ride.phase === 'arrive') return undefined;
  if (startOf(ride) === ride.to) return undefined; // er dreht nicht (aus der Bucht in die Höhle)
  const t =
    ride.phase === 'seated'
      ? state.tick - ride.at + at.frac - DEPART
      : seatAt(ride, Infinity, world, at) / Math.max(ride.speed, 1e-6);
  const { from, full, until, gone } = PUFF_T;
  const size = t < full ? (t - from) / (full - from) : t <= until ? 1 : 1 - (t - until) / (gone - until);
  const step = Math.ceil(Math.min(1, size) * PUFF_STEPS - 1e-9);
  return step > 0 ? step : undefined;
}

/**
 * Fortschritt des Sitzes in diesem Bild: zwischen den Takten gleitend, außer der Zug hält am Prellbock, wo Tok Bau 2
 * baut (`Ride.stopover`); bei reduzierter Bewegung springt er ans Ziel und steht bis zur Ankunft am Halt (bei Bau 2 ab
 * dem Prellbock dort; aus der Bucht in die Höhle am Start, `Ride.from`, das ist derselbe Prellbock)
 */
function seatAt(ride: NonNullable<State['ride']>, len: number, world: World, at: RideAt): number {
  const cap = ride.stopover ? capOf(world) : Infinity;
  const start = ride.from?.pos ?? 0;
  const held = ride.stopover === 'ahead' && ride.pos >= cap - 1e-6;
  const p = ride.phase === 'go' && !held ? Math.max(start, ride.pos - ride.speed * (1 - at.frac)) : ride.pos;
  if (!at.reduced || p >= len) return p;
  return p >= cap - 1e-6 ? cap : start;
}

/**
 * Wo der Zug gerade ist: unterwegs mit der Figur (der Sitz zwischen den Takten gleitend; bei reduzierter Bewegung steht
 * er bis zur Ankunft am Halt, von dem er abfuhr, und springt dann ans Ziel; die Kamera folgt dem Sitz, bleibt also still), am Halt in der Welt (Prellbock in der Bucht, Bahnhof Fledermaus) oder an Bahnhof Bär
 * (dort rollt er beim Bau heran und hält vor der Figur, `frontAt`); undefined, solange er noch nicht da ist
 */
function placeOf(st: BearStation, world: World, state: State, work: number | undefined, at: RideAt): Place | undefined {
  const r = work === undefined ? trainRoute(world, state) : undefined;
  const ride = state.ride?.id === TRAIN.id ? state.ride : undefined;
  if (r && ride) {
    const line = lineOf(world, farOf(state));
    const p = seatAt(ride, r.path.length - 1, world, at);
    const q = ride.to === 'out' ? line.length - 1 - SEAT - p : SEAT + p;
    const by: End = ride.phase === 'seated' ? startOf(ride) : ride.to;
    return { line, front: q - SEAT + PARK, heading: headingOf(ride), side: sideAt(st, world, state, by) };
  }
  const end = r && (parked(TRAIN, r, state, world)?.end ?? state.docked?.[TRAIN.id]);
  if (r && end === 'home') {
    const line = lineOf(world, farOf(state));
    return { line, front: line.length - 1 - 2 * SEAT + PARK, heading: 'home', side: sideAt(st, world, state, 'home') };
  }
  const front = frontAt(st, state.player, work, at.reduced);
  return front === undefined ? undefined : { line: st.line, front, heading: 'out', side: st.side };
}

/**
 * Zu welcher Seite des Gleises die Türen am Halt `end` aufgehen: zum eigenen Bahnsteig (an Bahnhof Fledermaus zu dessen
 * Seite, nicht zu der von Bahnhof Bär); am Prellbock in der Bucht, ohne Bahnsteig, wie an Bahnhof Bär
 */
function sideAt(st: BearStation, world: World, state: State, end: End): Point {
  return (end === 'home' && farOf(state) && batPlatform(world)?.side) || st.side;
}

/**
 * Tür und Licht des Zugs: bis zur ersten Fahrt (`gefahren`, gespeichert) ein goldener Rahmen um die Tür, wo die Figur
 * einsteigen kann, angestoßen und beim Aussteigen (zum Bahnsteig, die Figur hüpft hindurch) geht sie kurz auf, abends und im Tunnel leuchten die Lampen. Schläft er (ein Paket fehlt
 * noch, Vorladen), nichts davon: keine goldene Tür, die Tür bleibt zu, die Lampen sind aus, kein Dampf; nichts ist grau
 */
function doorOf(world: World, state: State, work: number | undefined, at: RideAt, riding: boolean) {
  const r = work === undefined && !riding ? trainRoute(world, state) : undefined;
  const dozing = !!state.dozing?.includes(TRAIN.id) && !riding;
  const gold = !!r && !dozing && !state.ride && !ridden(state.packs, TRAIN.id) && !!parked(TRAIN, r, state, world);
  const recent = (m: State['nudged']) => m?.id === TRAIN.id && state.tick - m.at < OPEN_TICKS;
  const nudged = (recent(state.nudged) || recent(state.alighted)) && !riding && !dozing;
  return { dozing, gold, nudged, ...lightOf(world, state, at, riding, dozing) };
}

/**
 * Licht des Zugs: Lampen im Tunnel, am Abend und auf der Laternenfahrt, warmes Fensterband ab 20 min und auf der
 * Laternenfahrt; nach „Gute Nacht“ (`asleep`) beides aus, nur das Nachtlicht (`night`); schläft er, weil ein Paket
 * fehlt, nichts davon
 */
function lightOf(world: World, state: State, at: RideAt, riding: boolean, dozing: boolean) {
  const feast = riding && !!state.ride?.feast;
  const night = !!at.asleep?.includes(TRAIN.id) && !riding;
  const off = dozing || night;
  return {
    lit: !off && (at.lit || feast || inTunnel(state, world)),
    warm: !off && (!!at.warm || feast),
    night,
  };
}

/** Blickrichtung eines Wagens, dessen Ende zu Bahnhof Bär an der Stelle `a` steht: wohin die Lok schaut (`heading`) */
function carDir(world: World, place: Place, a: number): Dir {
  const [fx, fy] = along(world, place.line, a);
  const [bx, by] = along(world, place.line, a + CAR);
  return place.heading === 'home' ? dirTo(bx - fx, by - fy) : dirTo(fx - bx, fy - by);
}

/**
 * Lok und zwei Wagen am Gleis (beim Bau rollen sie aus dem Tunnelportal heran; ein Wagen, dessen Mitte noch hinter dem
 * Portal ist, ist nicht zu sehen; unterwegs sitzt die Figur im mittleren Wagen, `seat`), Dampf über der Lok (nicht bei
 * reduzierter Bewegung). Die Lok schaut nach `heading`: zu Bahnhof Bär steht sie am Ende zu Bär, zur Höhle am anderen;
 * der mittlere Wagen bleibt, wo er ist. Dreht der Zug bei der Abfahrt, liegt über jedem Wagen eine Dampfkugel
 */
function trainParts(st: BearStation, world: World, state: State, work: number | undefined, at: RideAt): RideBody[] {
  const place = placeOf(st, world, state, work, at);
  if (!place) return [];
  const riding = state.ride?.id === TRAIN.id;
  const tok = work === undefined ? tokOf(state.packs) !== undefined && !heraldOf(state) : work >= BUILD.board;
  const open = work !== undefined && work >= BUILD.door;
  const { dozing, gold, nudged, lit, warm, night } = doorOf(world, state, work, at, riding);
  const pennant = stageOf(state.packs, TRAIN.id) === 'fest';
  const home = place.heading === 'home';
  const kinds: CarLook['kind'][] = home ? ['rear', 'mid', 'loco'] : ['loco', 'mid', 'rear'];
  const hidden = (a: number) => work !== undefined && st.portal !== undefined && a + CAR / 2 > st.portal;
  const out = kinds.flatMap((kind, i): RideBody[] => {
    const a = place.front + i * GAP; // Ende dieses Wagens zu Bahnhof Bär
    if (hidden(a)) return [];
    const [x, y, z] = along(world, place.line, a + CAR / 2);
    const dir = carDir(world, place, a);
    const [rx, ry] = RIGHT[dir];
    const side = rx * place.side[0] + ry * place.side[1] > 0 ? 1 : -1;
    const mid = kind === 'mid';
    const look: CarLook = {
      kind,
      tok: kind === 'rear' && tok,
      door: (kind === 'rear' && open) || (mid && nudged) ? side : 0,
      rider: mid && riding,
      frame: mid && gold ? side : 0,
      lit: kind === 'loco' && lit,
      warm,
      night: kind === 'loco' && night,
      pennant: kind === 'loco' && pennant,
    };
    const more = `${look.warm ? 'w' : ''}${look.night ? 'n' : ''}${look.pennant ? 'p' : ''}`;
    const k = `${TRAIN_ID}:${kind}:${+look.tok}${look.door}${+!!look.rider}${look.frame}${+!!look.lit}${more && `:${more}`}`;
    const seat = mid && riding ? { seat: true as const } : {};
    const parts = model(k, () => carParts(look));
    return [{ id: `${TRAIN_ID}:${kind}`, key: k, x, y, z, dir, parts, foot: CAR_FOOT, ...seat }];
  });
  // Während der Wolke kein Dampf und keine Glühwürmchen: sie springen beim Umdrehen ans andere Ende, und die Kugeln
  // decken nur die Wagen; danach tauchen sie an der neuen Lok und hinter dem neuen letzten Wagen auf
  const step = puffOf(state, world, at);
  const loco = out.find((b) => b.id === `${TRAIN_ID}:loco`);
  if (loco && !at.reduced && !dozing && !night && step === undefined) {
    const phase = Math.floor(at.now / 400) % 4;
    const k = `${TRAIN_ID}:dampf:${phase}`;
    out.push({ ...loco, id: `${TRAIN_ID}:dampf`, key: k, parts: model(k, () => steamParts(phase)), foot: 0 });
  }
  out.push(...puffs(place, world, step));
  // Laternenfahrt: Glühwürmchen folgen dem letzten Wagen, solange er in der Höhlenwelt ist
  if (riding && state.ride?.feast && step === undefined) {
    const tail = home ? place.front - FLIES.behind : place.front + 2 * GAP + CAR + FLIES.behind;
    const trail = Array.from({ length: FLIES.n }, (_, i) =>
      along(world, place.line, tail + (home ? -i : i) * FLIES.apart),
    );
    out.push(...fireflies(trail, world, at.now, at.reduced));
  }
  return out;
}

/** Dampfkugeln beim Umdrehen: je Wagen eine über seiner Mitte, so groß, wie `puffOf` sagt (sonst keine) */
function puffs(place: Place, world: World, step: number | undefined): RideBody[] {
  if (step === undefined) return [];
  const k = `${TRAIN_ID}:puff:${step}`;
  return [0, 1, 2].map((i) => {
    const [x, y, z] = along(world, place.line, place.front + i * GAP + CAR / 2);
    return {
      id: `${TRAIN_ID}:puff:${i}`,
      key: k,
      x,
      y,
      z,
      dir: 's',
      parts: model(k, () => puffParts(step / PUFF_STEPS)),
      foot: 0, // die Wagen darunter haben ihren Fleck
    };
  });
}
