// Bild und Ton des Hinführens (Regeln: mitwachsen-sight.ts), gleich für 2D und 3D: der Funkelfreund als kleiner Körper
// wie die Körper der Fahrzeuge (`RideBody`), immer dasselbe Wesen in allen Welten: ein heller Funke, gut ein halbes Feld breit, mit zwei
// Flügeln in Türkis und Rosa, kein Gold (Gold heißt „hier kannst du etwas tun“). Er schwebt eine Feldhöhe über dem
// Boden, wippt und schlägt mit den Flügeln (wenige feste Modelle), gleitet weich von Feld zu Feld und glimmt in der
// dunklen Grotte (`beacon`). Bei reduzierter Bewegung steht er als ruhiger Punkt an seinem Platz. Dazu die Töne: der
// Ruf eines Dings ist sein eigener Klang, nur leiser und kürzer (`hush`), der Freund hat ein eigenes helles Zwitschern.

import { dress } from '../../data/games/mitwachsen-fine';
import { STORIES, type Melody } from '../../data/games/mitwachsen-stories';
import type { Part } from '../../lib/games/front';
import type { RideBody } from './mitwachsen-ride-view';
import type { Lure, SightEvent } from './mitwachsen-sight';
import type { State } from './mitwachsen-state';
import { packScore, type View2D } from './mitwachsen-view';
import type { Scored } from './sfx';

export const FRIEND_ID = 'freund';
export const FRIEND_COLORS = { core: '#bff3ff', light: '#ffffff', wing: '#5fd4ff', tip: '#ff7fc8', tail: '#b78cff' };
const C = FRIEND_COLORS;
/** Funken, wenn er erscheint, sich freut oder fortfliegt */
export const SIGHT_SPARKS: readonly string[] = [C.light, C.wing, C.tip, C.tail];
const GLOW = { [C.core]: { halo: true } } as const;
/** So hoch schwebt er über dem Boden je Bild der Wippe (Felder) */
const LIFTS = [1, 1.06, 1.12, 1.06] as const;
/** Ein Bild der Wippe dauert so lange (ms); so schnell gleitet er zu seinem Feld (ms bis auf ein Drittel des Wegs) */
const BEAT = 160;
const GLIDE = 220;

/**
 * Der Freund im Bild `k` der Wippe: Kern, zwei Flügel (oben bei geradem `k`, sonst unten), ein Schweif aus zwei Punkten.
 * Der Kern leuchtet (`halo`), auch am Tag ein wenig
 */
export function friendParts(k: number): Part[] {
  const z = LIFTS[k % LIFTS.length]!;
  const wing = k % 2 ? -0.04 : 0.14;
  return dress(
    [
      [-0.15, -0.15, z, 0.3, 0.3, 0.3, C.core, C.light],
      [-0.08, -0.37, z + wing, 0.18, 0.22, 0.1, C.wing, C.light],
      [-0.08, 0.15, z + wing, 0.18, 0.22, 0.1, C.wing, C.light],
      [-0.04, -0.45, z + wing, 0.1, 0.08, 0.08, C.tip, C.tip],
      [-0.04, 0.37, z + wing, 0.1, 0.08, 0.08, C.tip, C.tip],
      [-0.3, -0.06, z + 0.08, 0.14, 0.12, 0.12, C.tail, C.tip],
      [-0.45, -0.04, z + 0.04, 0.1, 0.08, 0.08, C.tip, C.light],
    ],
    GLOW,
  );
}
const MODELS = LIFTS.map((_, k) => friendParts(k));

/** Der Freund im Bild: merkt sich, wo er gerade schwebt, und gleitet zu seinem Feld aus den Regeln */
export class FriendLook {
  private at: { x: number; y: number; t: number } | null = null;

  /**
   * Sein Körper in diesem Bild (leer ohne Freund): an (x, y) seines Felds, auf dem Boden dort (`h`), mit Blick in
   * Flugrichtung; erscheint er neu, steht er gleich da
   */
  bodies(lure: Lure | undefined, h: (x: number, y: number) => number, now: number, reduced: boolean): RideBody[] {
    const f = lure?.friend;
    if (!f) {
      this.at = null;
      return [];
    }
    const from = this.at ?? { x: f.x, y: f.y, t: now };
    const pull = reduced ? 1 : 1 - Math.pow(1 / 3, Math.max(0, now - from.t) / GLIDE);
    const [x, y] = [from.x + (f.x - from.x) * pull, from.y + (f.y - from.y) * pull];
    this.at = { x, y, t: now };
    const [dx, dy] = [f.at[0] - x, f.at[1] - y];
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
    const k = reduced ? 0 : Math.floor(now / BEAT) % MODELS.length;
    const z = h(Math.round(x), Math.round(y));
    return [{ id: FRIEND_ID, key: `${FRIEND_ID}:${k}`, x, y, z, dir, parts: MODELS[k]!, beacon: true }];
  }
}

/** Zwitschern des Freunds: erscheint (zwei Töne hinauf), freut sich (vier hinauf), fliegt fort (zwei hinab) */
export function friendScore(what: SightEvent['what']): Scored[] {
  const run = (hz: readonly number[], gain: number): Scored[] =>
    hz.map((f, i) => [f, 0.11, 'sine', gain, 1.02, i * 0.09] as Scored);
  if (what === 'friend') return run([1568, 2093], 0.035);
  if (what === 'found') return run([1318.5, 1568, 2093, 2637], 0.045);
  return what === 'leave' ? run([1568, 1318.5], 0.02) : [];
}

/** So laut ist ein Ruf gegenüber dem echten Klang: an der Hörgrenze `far`, am Ding `near` */
export const HUSH = { far: 0.3, near: 0.7, span: 0.7 } as const;
/**
 * Ein Klang als Ruf aus der Ferne: nur was in den ersten `HUSH.span` Sekunden beginnt, leiser je weiter weg (`near`
 * 0 … 1)
 */
export const hush = (tones: readonly Scored[], near: number): Scored[] =>
  tones
    .filter((t) => t[5] <= HUSH.span)
    .map(([f, len, wave, gain, slide, delay]) => [
      f,
      len,
      wave,
      gain * (HUSH.far + (HUSH.near - HUSH.far) * Math.min(1, Math.max(0, near))),
      slide,
      delay,
    ]);

/** Die ersten drei Töne der Melodie eines Klangsteins als Klang (für seinen Ruf) */
export function melodyStart(m: Melody): Scored[] {
  let at = 0;
  return m.notes.slice(0, 3).map(([hz, len, gain = 0.12]) => {
    const tone: Scored = [hz, len, m.wave, gain, 1, at];
    at += len + m.gap;
    return tone;
  });
}

/**
 * Töne zu einem Ereignis des Hinführens: der Ruf als leiser eigener Klang des Dings (aus dem Paket seiner Welt bzw. der
 * Melodie seines Steins; fehlt das Paket, still), sonst das Zwitschern des Freunds
 */
export function sightScore(e: SightEvent, views: readonly View2D[], state: State): Scored[] {
  const c = e.call;
  if (e.what !== 'call' || !c) return friendScore(e.what);
  const tones =
    c.type === 'story'
      ? melodyStart(STORIES[c.id].melody)
      : c.type === 'ride'
        ? views.flatMap((v) => v.rideFx?.(c, state)?.score ?? [])
        : c.type === 'herald'
          ? views.flatMap((v) => v.heraldFx?.(c, state)?.score ?? [])
          : packScore(views, c);
  return hush(tones, e.near ?? 0);
}
