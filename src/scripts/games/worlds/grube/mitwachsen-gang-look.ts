// Bild und Klang am Glitzergang der Grubenbahn (Rückmeldung zur Höhle, Punkt 7 und Schritt 16), gleich für 2D und 3D
// (Haken `View2D.bodies`, `score`, `ambient` und `dim`) – rein bis auf `GangFx`, das sich wie die Netze der Tupfspinnen
// merkt, was zuletzt klang. Körper (Modelle in src/data/games/worlds/grube/mitwachsen-gang-model.ts): die zwei
// Klingeltore mit ihrer Scheibe (sie hebt sich, solange Funkel hindurchfährt, und wackelt, wenn das Kind zu Fuß dagegen
// läuft), die Kristalle in der Wand (die Glitzerwelle: nah am Sitz leuchten sie, mit kleinem Loch in der Dunkelmaske)
// und der kleine Wasserfall neben dem Gleis. Töne, alle in der C-Pentatonik und weich im Dreieck: Fährt Funkel durch ein
// Tor, spielen die Röhren D5 E5 G5 A5 C6, am Eingang aufwärts, am Ausgang abwärts, mit einem leisen Nachhall (anders als
// das Säulen-Glockenspiel, Sinus C5 bis A5, und der Akkord des Hau-rucks, C4 E4 G4); in der Mitte des Gangs tutet es, und
// das Echo kommt höchstens zweimal leiser zurück, nur wenn gerade kein Tor singt. Zu Fuß spielt das Tor drei Töne, und
// Funkel am Halt antwortet mit seinem Signal und blinkt (kein „noch nicht“, kein Gold). Im Gang dimmt das Licht wie im
// Tunnel (`TUNNEL_LIGHT`, nie dunkler als die Dämmerung), ohne „Uh-uh“; die Lampe von Funkel öffnet die Dunkelmaske.
// Spezifikation: docs/specs/mitwachsen.md („Die Grubenbahn Funkel“, Klingeltore und Glitzergang)

import type { Dir, Part } from '../../../../lib/games/front';
import {
  DISC_Z,
  FALL_PHASES,
  LIFT,
  crystalParts,
  DISC_PARTS,
  fallParts,
  gateParts,
} from '../../../../data/games/worlds/grube/mitwachsen-gang-model';
import { TUNNEL_LIGHT } from '../../mitwachsen-dusk';
import { dirTo } from '../../mitwachsen-free';
import type { RideAt, RideBody } from '../../mitwachsen-ride-view';
import type { State } from '../../mitwachsen-state';
import type { World } from '../../mitwachsen-world';
import type { Scored } from '../../sfx';
import { FUNKEL, funkelRoute } from './mitwachsen-funkel';
import { funkelAt, signal } from './mitwachsen-funkel-look';
import { gangOf, glitter, inGang, passing, type Gang } from './mitwachsen-gang';

/** Töne der Röhren: D5 E5 G5 A5 C6 */
export const GATE_NOTES = [587.33, 659.25, 783.99, 880, 1046.5] as const;
/** Abstand der Röhren-Töne (s) */
const STEP = 0.16;
/** So lange (s) singt ein Tor, wenn Funkel hindurchfährt (samt Nachhall): solange kein Echo */
export const SING_S = 1.6;
/** So lange (ms) leuchten die Röhren und wackelt die Scheibe nach dem Anstoßen zu Fuß */
export const RING_MS = 800;
/** So bald (ms) klingt dasselbe Tor zu Fuß nicht noch einmal (wer den Pfeil hält, läuft immer wieder dagegen) */
export const FOOT_GAP = 1500;
/** Echo des Tutens: so viel später (s) und so laut, höchstens zweimal */
export const ECHO: readonly (readonly [number, number])[] = [
  [0.5, 0.022],
  [1.0, 0.01],
];

/** Fährt Funkel durch ein Tor: die Röhren aufwärts (am Eingang) oder abwärts (am Ausgang), dazu ein leiser Nachhall */
export function gateScore(up: boolean): Scored[] {
  const notes = up ? [...GATE_NOTES] : [...GATE_NOTES].reverse();
  const last = notes.at(-1)!;
  return [
    ...notes.map((f, i): Scored => [f, 0.42, 'triangle', 0.045, 1, i * STEP]),
    [last, 0.6, 'triangle', 0.015, 1, (notes.length - 1) * STEP + 0.3],
  ];
}

/** Zu Fuß: drei Töne des Tors, danach antwortet Funkel am Halt mit seinem Signal (`answer`: nur, wenn er nicht schläft) */
export const footScore = (answer = true): Scored[] => [
  ...GATE_NOTES.slice(0, 3).map((f, i): Scored => [f, 0.3, 'triangle', 0.045, 1, i * 0.14]),
  ...(answer ? signal(0.7) : []),
];

/** In der Mitte des Gangs tutet Funkel; das Echo kommt höchstens zweimal leiser zurück (`echo`: nur, wenn kein Tor singt) */
export const tootScore = (echo: boolean): Scored[] => [
  ...signal(),
  ...(echo ? ECHO.flatMap(([at, gain]) => signal(at, gain)) : []),
];

/**
 * Was am Glitzergang klang (je Spielseite eins, wie die Netze der Tupfspinnen): wie weit die Fahrt von Funkel beim
 * letzten Bild war (`ambient` spielt, was seitdem überfahren wurde, auch nach einem Sprung), wann zuletzt ein Tor sang
 * und wann welches Tor zu Fuß angestoßen wurde (ms wie `performance.now()`)
 */
export class GangFx {
  private last: number | undefined;
  private sungAt = -Infinity;
  private rung = new Map<string, number>();
  /** Wann zuletzt ein Tor zu Fuß angestoßen wurde (Funkel am Halt blinkt danach) */
  rangAt = -Infinity;

  /**
   * Zu Fuß gegen das Tor (x, y) gelaufen (Ereignis `chimegate`): seine Töne, gedrosselt je Tor um `FOOT_GAP`. Schläft
   * Funkel (`answer` falsch), klingt nur das Tor: kein Signal, kein Blinken (er lädt nicht ein, wenn er nicht fährt)
   */
  ring(x: number, y: number, now: number, answer = true): Scored[] {
    const k = `${x},${y}`;
    if (now - (this.rung.get(k) ?? -Infinity) < FOOT_GAP) return [];
    this.rung.set(k, now);
    if (answer) this.rangAt = now;
    this.sungAt = now;
    return footScore(answer);
  }

  /** Wie lange (ms) das Tor (x, y) schon klingt, seit es zu Fuß angestoßen wurde; Infinity: nie */
  ringing(x: number, y: number, now: number): number {
    return now - (this.rung.get(`${x},${y}`) ?? -Infinity);
  }

  /**
   * Töne aus dem Fortschritt der Fahrt (`View2D.ambient`, je Bild): durch das Tor am Eingang aufwärts, in der Mitte das
   * Tuten mit Echo, durch das Tor am Ausgang abwärts; jedes einmal je Runde, in der Reihe der Strecke
   */
  ambient(world: World, state: State, now: number): Scored[] {
    const ride = state.ride?.id === FUNKEL.id ? state.ride : undefined;
    const r = ride && funkelRoute(world, state);
    const g = r && gangOf(world, r);
    if (!ride || !g) {
      this.last = undefined;
      return [];
    }
    const [from, to] = [this.last, ride.pos];
    this.last = to;
    if (from === undefined || to < from) return []; // eine neue Fahrt beginnt am Halt
    const out: Scored[] = [];
    const crossed = (i: number) => from < i && i <= to;
    if (crossed(g.gates.in)) out.push(...this.sing(true, now));
    if (crossed(g.mid)) out.push(...tootScore(!out.length && now - this.sungAt >= SING_S * 1000));
    if (crossed(g.gates.out)) out.push(...this.sing(false, now));
    return out;
  }

  private sing(up: boolean, now: number): Scored[] {
    this.sungAt = now;
    return gateScore(up);
  }
}

const memo = new Map<string, readonly Part[]>();
/** Teile einer Variante, je Schlüssel einmal (die 3D-Ansicht baut jede Form nur einmal) */
const model = (key: string, make: () => readonly Part[]) => memo.get(key) ?? (memo.set(key, make()), memo.get(key)!);

/**
 * Körper am Glitzergang je Bild: die zwei Klingeltore samt Scheibe, die Kristalle in der Wand, der Wasserfall; solange die
 * Figur in der Grotte ist oder mit Funkel fährt (wie seine Körper), sonst leer, auch vor dem Graben. Die Kennungen
 * beginnen nicht mit `ride:` (Antippen trifft nur Fahrzeuge)
 */
export function gangBodies(state: State, world: World, at: RideAt, fx: GangFx): readonly RideBody[] {
  const r = funkelRoute(world, state);
  const g = r && gangOf(world, r);
  if (!r || !g) return [];
  const riding = state.ride?.id === FUNKEL.id;
  if (!riding && world.realm(state.player.x, state.player.y) !== world.realm(...r.stops.home)) return [];
  const p = riding ? funkelAt(r, state, at, world) : -Infinity;
  const out: RideBody[] = [];
  for (const kind of ['in', 'out'] as const) {
    const i = g.gates[kind];
    const [x, y] = r.path[i]!;
    const [nx, ny] = r.path[i + 1]!;
    const z = world.cell(x, y).h;
    const lifted = riding && passing(i, p);
    const rang = fx.ringing(x, y, at.now);
    const shine = lifted || (rang >= 0 && rang < RING_MS);
    const dir: Dir = dirTo(nx - x, ny - y);
    const k = `grube-tor:${+shine}`;
    out.push({
      id: `grube-tor:${kind}`,
      key: k,
      x,
      y,
      z,
      dir,
      parts: model(k, () => gateParts(shine)),
      foot: 0, // Pfosten am Rand, in der Mitte fährt der Zug: kein Fleck auf dem Gleis
      ...glow(shine),
    });
    // die Scheibe wackelt nach dem Anstoßen hin und her, weich abklingend (nicht bei reduzierter Bewegung)
    const wob =
      !at.reduced && rang >= 0 && rang < RING_MS
        ? Math.sin((rang / 1000) * Math.PI * 8) * 0.07 * (1 - rang / RING_MS)
        : 0;
    out.push({
      id: `grube-tor:${kind}:scheibe`,
      key: 'grube-scheibe',
      x: x + wob,
      y,
      z: z + DISC_Z + (lifted ? LIFT : 0),
      dir: 's',
      parts: DISC_PARTS,
      foot: 0, // hängt im Sturz
    });
  }
  const lit = riding ? litCrystals(g, p, at.reduced) : new Set<number>();
  for (const c of g.crystals) {
    const on = lit.has(c.i);
    const k = `grube-kristall:${+on}`;
    const [x, y] = c.at;
    out.push({
      id: `grube-kristall:${c.i}`,
      key: k,
      x,
      y,
      z: world.cell(x, y).h,
      dir: 's',
      parts: model(k, () => crystalParts(on)),
      ...glow(on),
    });
  }
  if (g.fall) {
    const phase = at.reduced ? 0 : Math.floor(at.now / 160) % FALL_PHASES;
    const k = `grube-fall:${phase}`;
    const [x, y] = g.fall;
    out.push({
      id: 'grube-fall',
      key: k,
      x,
      y,
      z: world.cell(x, y).h,
      dir: 's',
      parts: model(k, () => fallParts(phase)),
      foot: 0, // Wasser
    });
  }
  return out;
}

/** Leuchtende Wandkristalle bei Fortschritt `p`: die Glitzerwelle; bei reduzierter Bewegung im Gang alle, ohne Welle */
const litCrystals = (g: Gang, p: number, reduced: boolean): ReadonlySet<number> =>
  reduced && inGang(g, p) ? new Set(g.crystals.map((c) => c.i)) : glitter(g, p);

const glow = (on: boolean) => (on ? { glow: true as const } : {});

/** Licht der Szene (`View2D.dim`): Fährt die Figur mit Funkel durch den Glitzergang, 0,7-fach wie im Tunnel, sonst 1 */
export function gangDim(state: State, world: World): number {
  if (state.ride?.id !== FUNKEL.id) return 1;
  const r = funkelRoute(world, state);
  const g = r && gangOf(world, r);
  return g && inGang(g, state.ride.pos) ? TUNNEL_LIGHT : 1;
}
