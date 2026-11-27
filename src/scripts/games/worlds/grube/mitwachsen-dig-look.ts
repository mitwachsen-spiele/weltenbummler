// Bild und Ton, wenn der Maulwurf den Glitzergang gräbt (Rückmeldung zur Höhle, Schritt 17), gleich für 2D und 3D (Haken
// `View2D.bodies` und `heraldFx`) – rein, ohne DOM und Three.js. Die Erdwelle ist ein kleiner Erdhügel mit zwei
// Kristallkrümeln, der einmal die künftige Runde entlangläuft, vom Grubenhalt bis zurück zum Halt (unter dem Fels des
// Gangs auf seiner Oberkante); er glimmt ein wenig (`beacon`: kleines Loch der Dunkelmaske mitten auf ihm, ohne
// Grenze der Entfernung zur Figur), damit man ihn im Dunkel sieht. Er startet und endet langsam (am Halt, wo das Kind
// zusieht) und ist in der Mitte der Runde schnell (`moundAt`); hinter ihm bleibt Stück für Stück liegen, was er baut
// (`laidBodies`, Issue 14): auf der offenen Strecke das schmale Gleis auf frischer Erde, auf dem Fels des Gangs
// Glitzerkrümel, bis zum Augenblick `pop`, dann liegt das echte Gleis in der Welt. Bei
// reduzierter Bewegung steht er in drei festen Bildern, statt zu gleiten. Töne, alle in der C-Pentatonik und über C5:
// Der Maulwurf klopft dreimal leise, die Erde brummelt dreimal weich hinab, der Gang geht auf und seine Klingeltore singen
// hinauf wie beim Durchfahren, Funkel kommt an seinem Halt an (sein Signal abwärts). Funkel rollt dabei aus dem Gang an
// den Halt (`funkelAt` in mitwachsen-funkel-look.ts).
// Spezifikation: docs/specs/mitwachsen.md („Die Grubenbahn Funkel“, Der Maulwurf gräbt)

import type { Point } from '../../../../data/games/mitwachsen';
import {
  BED_H,
  BED_PART,
  CRUMB_PARTS,
  DIG,
  DIG_CRUMBS,
  DIG_SEEN,
  MOUND_PARTS,
} from '../../../../data/games/worlds/grube/mitwachsen-dig-model';
import { DIRS, type Dir, type Part } from '../../../../lib/games/front';
import type { HeraldEvent } from '../../mitwachsen-herald';
import type { RideAt, RideBody, RideFx } from '../../mitwachsen-ride-view';
import type { State } from '../../mitwachsen-state';
import type { World } from '../../mitwachsen-world';
import { RULE_TICK_MS } from '../../mitwachsen-turn-pace';
import type { Scored } from '../../sfx';
import { laneOf } from './mitwachsen-funkel';
import { railShape } from './mitwachsen-funkel-look';
import { gateScore } from './mitwachsen-gang-look';
import { digAt } from './mitwachsen-dig';

/** Kennung des Erdhügels der Erdwelle (ein Körper, nie antippbar: Antippen trifft nur `ride:`) */
export const MOUND_ID = 'grube-erde';
/** Feste Bilder der Erdwelle bei reduzierter Bewegung */
export const MOUND_STAGES = 3;

/** Kennung dessen, was der Erdhügel liegen lässt (Gleis auf frischer Erde, Glitzerkrümel; nie antippbar) */
export const LAID_ID = 'grube-bau';

/** Langsam los, in der Mitte schnell, langsam an (kubisch): Anfang und Ende der Runde liegen am Halt, dort sieht das Kind zu */
const ease = (f: number) => (f < 0.5 ? 4 * f * f * f : 1 - (2 - 2 * f) ** 3 / 2);

/**
 * Wo die Erdwelle bei Fortschritt `w` (0 … 1) des Grabens auf der künftigen Runde der Länge `n` ist, als Index (vom
 * ersten Feld des Halts an); undefined vor und nach ihr. Sie startet und endet langsam und ist in der Mitte schnell
 * (`ease`). Bei reduzierter Bewegung die Mitte einer von drei Stufen
 */
export function moundAt(w: number, n: number, reduced: boolean): number | undefined {
  const [from, to] = DIG.wave;
  if (w < from || w >= to || n < 2) return undefined;
  const f = (w - from) / (to - from);
  if (!reduced) return ease(f) * n;
  const k = Math.min(MOUND_STAGES - 1, Math.floor(f * MOUND_STAGES));
  return ((k + 0.5) / MOUND_STAGES) * n;
}

/** Richtung von `a` zum Nachbarfeld `b` als Buchstabe (leer, wenn sie nicht nebeneinander liegen) */
const dirOf = (a: Point, b: Point) =>
  (Object.keys(DIRS) as Dir[]).find((d) => a[0] + DIRS[d][0] === b[0] && a[1] + DIRS[d][1] === b[1]) ?? '';

const beds = new Map<string, readonly Part[]>();
/**
 * Ein Stück wachsendes Gleis für die Richtungen `to` als Modell (Blick nach vorn, `s`): dieselben Quader wie das echte
 * Gleis (`railShape`), auf einem Bett frischer Erde. Undefined, wenn die Richtungen kein Gleis ergeben
 */
export function laidParts(to: string): readonly Part[] | undefined {
  const known = beds.get(to);
  if (known) return known;
  const shape = railShape(to);
  if (!shape) return undefined;
  const parts: Part[] = [
    BED_PART,
    ...shape.map(([x, y, z, w, d, h, side, top, fine]): Part => [
      y - 0.5,
      0.5 - x - w,
      z + BED_H,
      d,
      w,
      h,
      side,
      top,
      undefined,
      fine,
    ]),
  ];
  beds.set(to, parts);
  return parts;
}

/**
 * Was der Erdhügel hinter sich liegen lässt, wenn er `upto` Felder der künftigen Runde `lane` geschafft hat: auf der
 * offenen Strecke je Feld ein Stück Gleis auf frischer Erde, auf dem Fels des Gangs auf jedem zweiten Feld Glitzerkrümel
 * (dort geht erst zum Augenblick `pop` der Gang auf). Nur, was höchstens `DIG_SEEN` Felder von der Figur liegt
 */
export function laidBodies(world: World, lane: readonly Point[], upto: number, player: State['player']): RideBody[] {
  const out: RideBody[] = [];
  const n = lane.length;
  for (let k = 0; k < Math.min(n, Math.floor(upto)); k++) {
    const [x, y] = lane[k]!;
    if (Math.max(Math.abs(x - player.x), Math.abs(y - player.y)) > DIG_SEEN) continue;
    const c = world.cell(x, y);
    const at = { id: `${LAID_ID}:${k}`, x, y, z: c.h, dir: 's' as const, foot: 0 }; // liegt flach: kein Fleck
    if (c.lane?.part === 'gang') {
      if (k % 2 === 0) out.push({ ...at, key: `${LAID_ID}:kruemel`, parts: CRUMB_PARTS });
      continue;
    }
    const to = [dirOf(lane[k]!, lane[(k + n - 1) % n]!), dirOf(lane[k]!, lane[(k + 1) % n]!)].sort().join('');
    const parts = laidParts(to);
    if (parts) out.push({ ...at, key: `${LAID_ID}:${to}`, parts });
  }
  return out;
}

/**
 * Körper je Bild, solange gegraben wird, bis zum Augenblick `pop` (dann liegt das echte Gleis in der Welt): der Erdhügel
 * der Erdwelle auf der künftigen Runde und, was er hinter sich liegen lässt; nach der Welle liegt alles
 */
export function digBodies(state: State, world: World, at: Pick<RideAt, 'frac' | 'reduced'>): readonly RideBody[] {
  const w = digAt(state, at.frac);
  if (w === undefined || w < DIG.wave[0] || w >= DIG.pop || state.dig?.laid) return [];
  const lane = laneOf(world);
  const i = moundAt(w, lane.length, at.reduced);
  const laid = laidBodies(world, lane, i ?? lane.length, state.player);
  if (i === undefined) return laid;
  const [a, b] = [lane[Math.floor(i) % lane.length]!, lane[(Math.floor(i) + 1) % lane.length]!];
  const f = i - Math.floor(i);
  const [ha, hb] = [world.cell(...a).h, world.cell(...b).h];
  return [
    {
      id: MOUND_ID,
      key: MOUND_ID,
      x: a[0] + (b[0] - a[0]) * f,
      y: a[1] + (b[1] - a[1]) * f,
      z: Math.max(ha, hb),
      dir: 's',
      parts: MOUND_PARTS,
      beacon: true, // die Kristallkrümel glimmen: ein kleines Loch der Dunkelmaske mitten auf ihm, wie weit die Figur auch weg ist
    },
    ...laid,
  ];
}

/** Sekunden ab dem Beginn des Grabens bis zu einem seiner Augenblicke (`DIG`) */
const sec = (beat: number) => (beat * DIG.ticks * RULE_TICK_MS) / 1000;
const [C5, D5, E5, A5] = [523.25, 587.33, 659.25, 880];

/**
 * Töne des ganzen Grabens, eingeplant, wenn der Maulwurf zu klopfen beginnt: dreimal leise „tapp“ (A5), dreimal weich
 * brummelt die Erde hinab, während die Welle läuft (E5, D5, C5), zum Augenblick `pop` singen die Klingeltore hinauf
 * (D5 E5 G5 A5 C6 mit Nachhall, wie beim Durchfahren), am Ende kommt Funkel an (A5 → D5). Alles höchstens 0,05 laut
 */
export function digScore(): Scored[] {
  const [w0, w1] = DIG.wave;
  const tap = (at: number): Scored => [A5, 0.06, 'triangle', 0.045, 1, at];
  const hum = (f: number, at: number): Scored => [f, 0.3, 'sine', 0.035, 1, at];
  return [
    ...Array.from({ length: DIG.taps }, (_, i) => tap(0.05 + i * 0.22)),
    ...[E5, D5, C5].map((f, k) => hum(f, sec(w0 + (k * (w1 - w0)) / 3))),
    ...gateScore(true).map(([f, len, wave, gain, slide, at]): Scored => [f, len, wave, gain, slide, at + sec(DIG.pop)]),
    [A5, 0.14, 'triangle', 0.05, 1, sec(DIG.roll[1])],
    [D5, 0.3, 'triangle', 0.05, 1, sec(DIG.roll[1]) + 0.16],
  ];
}

/**
 * Bild und Ton zu einem Ereignis des Maulwurfs (eines anderen Boten, Tok: undefined): Er beginnt zu graben (alle Töne
 * des Grabens, er hüpft, Erdkrümel stieben), der Gang ist gegraben (Erdkrümel und Glitzern am Halt; die Töne laufen
 * schon), Funkel ist angekommen (still, sein Signal ist eingeplant)
 */
export function digFx(e: HeraldEvent): RideFx | undefined {
  switch (e.what) {
    case 'dig':
      return { score: digScore(), who: e.id, burst: DIG_CRUMBS };
    case 'dug':
      return { score: [], burst: DIG_CRUMBS };
    case 'rolled':
      return { score: [] };
    default:
      return undefined;
  }
}
