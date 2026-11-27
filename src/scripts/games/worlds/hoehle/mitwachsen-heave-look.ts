// Hau-ruck am Höhlentor in Bild und Ton, im Welt-Paket der Höhlenwelt, gleich für 2D und 3D (die Regeln stehen in
// mitwachsen-heave.ts). Solange es läuft, leuchten auf dem Rollstein eine große und eine kleine Hand mit goldenem Rahmen
// (Gold: hier kannst du etwas tun; ein Körper über `View2D.bodies`, er rollt mit dem Stein). Der Stein rollt je Stoß ein
// Drittel weiter (`heaveAjar`, Haken `View2D.ajar`: der Öffnungsgrad des Tors in Werten von `stoneX`, `HEAVE_T`; in 2D
// gehen die Flügel ebenso in Dritteln auf), nach dem dritten in die Nische, dann gehen die Kristall-Lampen paarweise an.
// Töne in der C-Pentatonik (WebAudio): Stoß 1 eine weiche Trommel C3, Stoß 2 E3 und Geröll, Stoß 3 der Akkord C–E–G,
// nach 0,3 s „plopp“, nach 1 s die Lampen A4–E4–C5–A4 mit Echo, nach 2 s zirpt die Fledermaus, die aus dem Höhlenmund
// flattert und eine Runde dreht, und Glühwürmchen strömen hinein (`heaveScore`, `openScore`; nie mehr als vier Stimmen
// zugleich); Toks „Ju-hu“ mit Herz kommt am Ende aus dem Paket der Bahn (Ereignis `arrive`). Bei reduzierter Bewegung
// springt der Stein in Dritteln, die Lampen gehen alle zugleich an, keine Fledermaus, keine Glühwürmchen; die Töne bleiben.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Hau-ruck am Höhlentor)

import type { Part } from '../../../../lib/games/front';
import type { GateId, Point } from '../../../../data/games/mitwachsen';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import { CAVE_FINE_MODELS } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-fine';
import { dirTo } from '../../mitwachsen-free';
import { HEAVE_END, type Heave } from '../../mitwachsen-guide';
import type { RideAt, RideBody } from '../../mitwachsen-ride-view';
import type { Scored } from '../../sfx';
import type { World } from '../../mitwachsen-world';
import { GATE, PUSHES } from './mitwachsen-heave';

/**
 * Öffnungsgrad des Höhlentors (Wert t von `stoneX` in mitwachsen-gate-hoehle.ts, dort `THIRDS`; ein Test hält beide
 * gleich): zu, ein Drittel, zwei Drittel, in der Nische, Lampen an
 */
export const HEAVE_T = [0, 0.4, 0.6, 0.8, 1] as const;
/** So viele Takte rollt der Stein je Drittel (0,4 s), nach dem dritten Stoß in die Nische (0,3 s, „plopp“) */
export const ROLL = 4;
export const NICHE = 3;
/** So viele Takte nach dem dritten Stoß gehen die Lampen an (1 s), so lange gehen sie nacheinander an (0,6 s) */
export const LAMPS = 10;
export const LAMPS_FOR = 6;
/** So viele Takte nach dem dritten Stoß flattert die Fledermaus heraus und Glühwürmchen strömen hinein (2 s) */
export const BAT = 20;

type Shown = { tick: number; heave?: Heave };

/** Takte seit dem letzten Stoß, mit dem Bruchteil des laufenden Takts (`frac`) */
const since = (s: Shown & { heave: Heave }, frac = 0) => s.tick - s.heave.at + frac;

/**
 * Wie weit das Höhlentor offen ist, solange das Hau-ruck läuft (`View2D.ajar`): je Stoß ein Drittel weiter, in `ROLL`
 * Takten; nach dem dritten in `NICHE` Takten in die Nische, ab `LAMPS` gehen die Lampen an. Bei reduzierter Bewegung
 * springt alles. Ohne Hau-ruck null (dann gilt der Grad, den die Ansicht selbst führt)
 */
export function heaveAjar(s: Shown, reduced: boolean): readonly [GateId, number] | null {
  if (!s.heave || s.heave.gate !== GATE) return null;
  const { n } = s.heave;
  const dt = since({ ...s, heave: s.heave });
  const step = (from: number, to: number, p: number) => from + (to - from) * (reduced ? (p > 0 ? 1 : 0) : p);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  if (n === 0) return [GATE, HEAVE_T[0]];
  if (n < PUSHES) return [GATE, step(HEAVE_T[n - 1] ?? 0, HEAVE_T[n] ?? 0, reduced ? 1 : clamp(dt / ROLL))];
  if (dt < LAMPS) return [GATE, step(HEAVE_T[2], HEAVE_T[3], reduced ? 1 : clamp(dt / NICHE))];
  return [GATE, step(HEAVE_T[3], HEAVE_T[4], reduced ? 1 : clamp((dt - LAMPS) / LAMPS_FOR))];
}

const SKIN = ['#f0c8a0', '#f8dcc0'] as const; // große Hand
const SKIN_SMALL = ['#f6d3b0', '#fde6cf'] as const; // kleine Hand
const BACK = '#4a4658';

/** Teil auf der Tafel: r nach rechts, u nach oben, b Breite, h Höhe, vorgezogen um `f` */
const flat = (r: number, u: number, b: number, h: number, c: readonly [string, string], f = 0): Part => [
  f,
  r,
  u,
  0.05,
  b,
  h,
  c[0],
  c[1],
];
/** Hand aus Handfläche, vier Fingern und Daumen (links der Fläche), `k` ihre Größe */
const hand = (r: number, u: number, k: number, c: readonly [string, string]): Part[] => [
  flat(r, u, 0.24 * k, 0.22 * k, c, 0.04),
  ...[0, 1, 2, 3].map((i) => flat(r + i * 0.063 * k, u + 0.22 * k, 0.048 * k, 0.15 * k, c, 0.04)),
  flat(r - 0.06 * k, u + 0.06 * k, 0.06 * k, 0.1 * k, c, 0.04),
];
const GOLD_C = [GOLD.side, GOLD.top] as const;
/** Fein: der goldene Rahmen als Metall (Gold bleibt Gold, mit leisen Streifen) */
const FRAME = { skin: 'metall' } as const;
/** Rahmenteil der Tafel aus Metall */
const framed = (p: Part): Part => [p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7] ?? null, p[8], FRAME];
/** Die Tafel mit beiden Händen im goldenen Rahmen, zum Kind gewandt (Teile: vorn, rechts, oben, wie die Modelle) */
export const HANDS: readonly Part[] = [
  flat(-0.42, 0.04, 0.84, 0.6, [BACK, BACK], -0.02),
  ...[
    flat(-0.48, 0, 0.96, 0.06, GOLD_C, 0.03), // Rahmen unten, oben, links, rechts
    flat(-0.48, 0.62, 0.96, 0.06, GOLD_C, 0.03),
    flat(-0.48, 0, 0.06, 0.68, GOLD_C, 0.03),
    flat(0.42, 0, 0.06, 0.68, GOLD_C, 0.03),
  ].map(framed),
  ...hand(-0.3, 0.1, 1, SKIN), // große Hand (Tok und die Figur schieben zusammen)
  ...hand(0.12, 0.12, 0.7, SKIN_SMALL), // kleine Hand
];

/** So weit (Felder) rollt der Stein vom Mund in die Nische (`NICHE_X` in mitwachsen-gate-hoehle.ts) */
const ROLLS = 4.375;
/** Wie weit der Stein beim Öffnungsgrad t gerollt ist (0 … 1), je Drittel gleichmäßig (`HEAVE_T`) */
function rolled(t: number): number {
  for (let k = 1; k <= PUSHES; k++) {
    const [lo, hi] = [HEAVE_T[k - 1] ?? 0, HEAVE_T[k] ?? 1];
    if (t <= hi) return (k - 1 + Math.max(0, (t - lo) / (hi - lo))) / PUSHES;
  }
  return 1;
}

/** Ein Glühwürmchen: ein leuchtender Punkt, er leuchtet weich in den Raum (`halo`) */
export const FLY: readonly Part[] = [[-0.05, -0.05, 0, 0.1, 0.1, 0.1, '#d8ff6a', '#f0ffb0', undefined, { halo: true }]];
const FLIES = 6;
const ease = (p: number) => p * p * (3 - 2 * p);

/**
 * Körper des Hau-rucks in diesem Bild (`View2D.bodies`, gleich für 2D und 3D): die Tafel mit den Händen auf dem Stein,
 * solange noch geschoben wird (ab dem Ende des Vorspiels, wenn ein Pfeil ein Stoß ist) (sie rollt mit ihm, ein Drittel je Stoß); nach dem dritten Stoß ab `BAT` die Fledermaus
 * auf ihrer Runde aus dem Höhlenmund und Glühwürmchen, die aus der Bucht hineinströmen (beides nicht bei reduzierter
 * Bewegung). Ohne Hau-ruck keine
 */
export function heaveBodies(s: Shown, world: Pick<World, 'gates' | 'cell'>, at: RideAt): RideBody[] {
  const door = world.gates.get(GATE);
  const h = s.heave;
  if (!door || !h || h.gate !== GATE) return [];
  const [mx, my] = door.mid;
  const [ox, oy] = door.out;
  const right: Point = [-oy, ox]; // von der Lichtung aus gesehen rechts: dorthin rollt der Stein
  const z = world.cell(mx, my).h;
  const out: RideBody[] = [];
  if (h.n < PUSHES) {
    // im Vorspiel (die Kamera dreht noch, ein Pfeil lässt nur hüpfen) noch kein Gold: erst, wenn ein Stoß zählt
    if (h.n === 0 && s.tick < h.at) return out;
    const t = heaveAjar(s, at.reduced)?.[1] ?? 0;
    const k = rolled(t) * ROLLS; // wie weit der Stein schon rollte
    const [x, y] = [mx - ox * 0.55 + right[0] * k, my - oy * 0.55 + right[1] * k];
    // die Tafel hängt am Stein (kein Fleck am Boden)
    out.push({ id: 'heave:hands', key: 'heave-hands', x, y, z: z + 1.2, dir: dirTo(-ox, -oy), parts: HANDS, foot: 0 });
    return out;
  }
  const dt = since({ ...s, heave: h }, at.frac) - BAT;
  const span = HEAVE_END - BAT;
  if (at.reduced || dt < 0 || dt > span) return out;
  const p = dt / span;
  // Fledermaus: aus dem Mund heraus, eine Runde über der Bucht, zurück in den Mund (schaut, wohin sie fliegt)
  const bat = (q: number): Point => {
    const reach = 1 + 2.5 * Math.sin(q * Math.PI);
    const side = 2 * Math.sin(q * Math.PI * 2);
    return [mx - ox * reach + right[0] * side, my - oy * reach + right[1] * side];
  };
  const [bx, by] = bat(p);
  const [nx, ny] = bat(Math.min(1, p + 0.02));
  const lift = z + 2.2 + 0.4 * Math.sin(p * Math.PI * 4);
  const fledermaus = CAVE_FINE_MODELS.fledermaus;
  out.push({
    id: 'heave:bat',
    key: 'heave-bat',
    x: bx,
    y: by,
    z: lift,
    dir: dirTo(nx - bx, ny - by),
    parts: fledermaus,
    foot: 0, // fliegt hoch über der Bucht
  });
  // Glühwürmchen: aus der Bucht hinein in den Gang, eins nach dem anderen
  const to: Point = [mx + ox * 2, my + oy * 2];
  for (let i = 0; i < FLIES; i++) {
    const q = ease(Math.min(1, Math.max(0, p * 1.4 - i * 0.08)));
    if (q >= 1) continue;
    const back = 4 + (i % 3);
    const from: Point = [mx - ox * back + right[0] * (i - 2.5) * 0.8, my - oy * back + right[1] * (i - 2.5) * 0.8];
    const [fx, fy] = [from[0] + (to[0] - from[0]) * q, from[1] + (to[1] - from[1]) * q];
    const fz = z + 0.6 + 0.3 * Math.sin(p * 9 + i);
    out.push({ id: `heave:fly:${i}`, key: 'heave-fly', x: fx, y: fy, z: fz, dir: 's', parts: FLY, foot: 0 });
  }
  return out;
}

// ---------- Töne ----------

/** Weiche Trommel: Sinus, gleitet etwas tiefer, kurz */
const drum = (f: number, at = 0): Scored => [f, 0.28, 'sine', 0.09, 0.85, at];
/** Geröll kullert: drei kurze helle Klicks (Dreieck G5, E5, D5) */
const gravel = (at: number): Scored[] =>
  [783.99, 659.25, 587.33].map((f, i): Scored => [f, 0.04, 'triangle', 0.025, 1, at + 0.08 * i]);

/**
 * Töne zu einem Ereignis des Hau-rucks (`View2D.score`): Beginn still (die Postkarte bzw. die Drehung kommt), Stoß 1
 * Trommel C3, Stoß 2 E3 und Geröll; Stoß 3 klingt mit dem Öffnen des Tors (`openScore`)
 */
export function heaveScore(n: number): Scored[] {
  if (n === 1) return [drum(130.81)];
  if (n === 2) return [drum(164.81), ...gravel(0.12)];
  return [];
}

/**
 * Töne beim Öffnen des Höhlentors (`Sky.gateScore`, zum dritten Stoß): der Akkord C–E–G (drei Stimmen), nach 0,3 s
 * „plopp“ (der Stein liegt in der Nische), nach 1 s die Lampen A4–E4–C5–A4, je Ton ein leiseres Echo, nach 2 s zirpt die
 * Fledermaus (E6, G6). Nie mehr als vier Stimmen zugleich (der Akkord klingt noch, wenn „plopp“ kommt)
 */
export function openScore(): Scored[] {
  const chord = [261.63, 329.63, 392].map((f): Scored => [f, 0.6, 'triangle', 0.05, 1, 0]);
  const plopp: Scored = [523.25, 0.12, 'sine', 0.05, 783.99 / 523.25, 0.3];
  const lamps = [440, 329.63, 523.25, 440].flatMap((f, i): Scored[] => [
    [f, 0.16, 'sine', 0.05, 1, 1 + i * 0.2],
    [f, 0.16, 'sine', 0.018, 1, 1.1 + i * 0.2], // Echo
  ]);
  const chirp: Scored[] = [
    [1318.51, 0.05, 'sine', 0.03, 1.12, 2],
    [1567.98, 0.05, 'sine', 0.03, 1.12, 2.09],
  ];
  return [...chord, plopp, ...lamps, ...chirp];
}
