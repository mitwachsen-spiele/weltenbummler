// Wetter dort, wo die Figur ist, und was die Ansicht beim Pustewind daraus macht: Rauschen und Windspiel, kurzes
// Kopfdrehen der Figur bei einer Böe, Haltungen der Tiere im Iglu und die Schneeeule oben auf dem Iglu, wenn nachts im
// Schneebett das Polarlicht leuchtet. Nur Bild und Ton; die Regeln (mitwachsen-state.ts) fragen das Wetter selbst.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Wetter und Unterstand“)

import type { Part } from '../../lib/games/front';
import type { SpeciesId } from '../../data/games/mitwachsen';
import { gustOf, weatherLook, windy, type WeatherLook } from './mitwachsen-weather';
import type { State } from './mitwachsen-state';
import { windOk } from './mitwachsen-meadow';
import type { World } from './mitwachsen-world';
import { IGLOO_LEDGE } from '../../data/games/mitwachsen-eis';

/** Was die Ansicht an einem Tier verändert: etwas verschoben (zusammenrücken), größer oder kleiner, andere Höhe */
export type Posture = { dx: number; dy: number; puff: number; z?: number };

const HEAD_Z = 0.74; // ab dieser Höhe gehört ein Teil der Figur zum Kopf (Kopf, Ohren, Haare, Gesicht)
const GLANCE = [2, 10] as const; // Takte nach Beginn einer Böe, in denen die Figur den Kopf zur Seite dreht
const LEAN = 0.3; // so weit rücken Pinguine und Moschusochsen im Iglu höchstens zusammen (in Feldern)
/** Haltung im Iglu: Die Schneeeule plustert sich rund auf, das Eisbärkind rollt sich klein zusammen */
const PUFF: Partial<Record<SpeciesId, number>> = { schneeeule: 1.2, eisbaer: 0.85 };
const HUDDLE: readonly SpeciesId[] = ['pinguin', 'moschusochse']; // diese Arten kuscheln bzw. stehen dicht

/**
 * Kopf der Figur zur Seite gedreht (nach rechts, wie beim Blick in die Böe): Alle Teile des Kopfes drehen sich um die
 * Hochachse. Gesichtsteile zeigen dann zur Seite; was nach hinten zeigen würde (das rechte Auge), fällt weg.
 */
export function turnHead(parts: readonly Part[]): Part[] {
  const out: Part[] = [];
  for (const part of parts) {
    const [f, r, z, fl, rw, h, color, top, face, fine] = part; // Feinheit (Muster, Leuchten) dreht sich mit
    if (z < HEAD_Z) out.push(part);
    else if (face !== 'r') out.push([-(r + rw), f, z, rw, fl, h, color, top, face && (face === 'f' ? 'r' : 'f'), fine]);
  }
  return out;
}

/**
 * Haltungen der Tiere beim Pustewind (Kennung → Haltung): Die Tiere der Schneewiese rücken im Iglu zusammen
 * (Pinguine kuscheln, Moschusochsen stehen dicht), die Schneeeule plustert sich auf, das Eisbärkind rollt sich ein.
 * Nachts im Schneebett, wenn das Polarlicht leuchtet, sitzt eine Schneeeule der Wiese oben auf dem Iglu.
 */
export function postures(world: World, state: State): Map<string, Posture> {
  const out = new Map<string, Posture>();
  const meadow = state.animals.filter((a) => a.mode === 'home' && a.realm === 'eis');
  if (!meadow.length) return out;
  const { x, y } = state.player;
  if (state.sleeping && world.realm(x, y) === 'eis') {
    const owl = meadow.find((a) => a.species === 'schneeeule');
    const [sx, sy] = world.homes.eis.shelterStem; // Mitte der Rückwand; die Eule sitzt vorn auf dem Sims der Kuppel
    const [y, z] = [sy + IGLOO_LEDGE.ahead - 0.5, world.cell(sx, sy).h + IGLOO_LEDGE.z]; // das Wesen steht bei +0,5
    if (owl) out.set(owl.id, { dx: sx - owl.x, dy: y - owl.y, puff: 1, z });
    return out;
  }
  if (state.sleeping || !windy(world.seed, state.day, state.tick - state.dayStart, windOk(state))) return out;
  for (const a of meadow) {
    const kin = HUDDLE.includes(a.species) ? meadow.filter((o) => o.species === a.species) : [a];
    const [mx, my] = [kin.reduce((s, o) => s + o.x, 0) / kin.length, kin.reduce((s, o) => s + o.y, 0) / kin.length];
    const lean = (d: number) => Math.max(-LEAN, Math.min(LEAN, d * 0.3));
    out.set(a.id, { dx: lean(mx - a.x), dy: lean(my - a.y), puff: PUFF[a.species] ?? 1 });
  }
  return out;
}

/**
 * Schritt-Ton: Im Kessel knirscht es auf Schnee und Eis. Auf der Lichtung bleibt jeder Schritt der gewohnte Tapp, auch
 * auf ihren Schneeflecken – das Knirschen gehört der Eis-Welt.
 */
export const stepSound = (world: World, x: number, y: number): 'crunch' | 'step' =>
  world.realm(x, y) === 'eis' && /^(snow|ice)$/.test(world.cell(x, y).ground) ? 'crunch' : 'step';

/**
 * Töne des Pustewinds (sfx.ts): Rauschen, das Wind und Böe folgt, das Windspiel an der Spitze jeder Böe und das leise
 * Lachen der Figur, wenn sie den Kopf in die Böe dreht
 */
export type WindSound = { windLoop(level: number): void; chime(soft: boolean): void; giggle(soft: boolean): void };

/**
 * Wetter dort, wo die Figur steht, einmal je Bild: Auf der Lichtung das der Lichtung, im Kessel (und im Schneebett) das
 * der Eis-Welt. Dazu Rauschen und Windspiel – still bei Pause, Menü, Schlaf und auf der Lichtung, bei reduzierter
 * Bewegung leise –, ob die Figur gerade den Kopf in die Böe dreht und ob nachts das Polarlicht leuchtet (im Schneebett).
 */
export class Air {
  private peakAt = -1; // Takt der Böe, deren Windspiel schon geklungen hat
  private laughAt = -1; // Beginn der Böe, über die die Figur schon gelacht hat

  constructor(private readonly sound: WindSound) {}

  frame(
    world: World,
    state: State,
    quiet: boolean,
    reduced: boolean,
  ): { weather: WeatherLook; glance: boolean; aurora: number } {
    const { seed } = world;
    const realm = world.realm(state.player.x, state.player.y);
    const t = state.tick - state.dayStart;
    const weather = weatherLook(seed, state.day, t, realm, windOk(state));
    const blowing = realm === 'eis' && !state.sleeping && weather.wind > 0;
    this.sound.windLoop(
      blowing && !quiet ? Math.min(1, weather.wind * 0.6 + weather.gust * 0.4) * (reduced ? 0.5 : 1) : 0,
    );
    const { start, len } = gustOf(seed, state.day, t);
    const strong = blowing && !quiet && weather.wind > 0.5;
    const turn = blowing && weather.wind > 0.5 && t - start >= GLANCE[0] && t - start < GLANCE[1];
    this.gustSounds(t, start, start + Math.floor(len / 2), strong, turn && !quiet, reduced);
    const glance = turn && !reduced;
    return { weather, glance, aurora: state.sleeping && realm === 'eis' ? 1 : 0 }; // Polarlicht nachts im Schneebett
  }

  /** Je Böe einmal: das Windspiel an ihrer Spitze und das leise Lachen, wenn die Figur den Kopf in die Böe dreht */
  private gustSounds(t: number, start: number, peak: number, strong: boolean, laugh: boolean, reduced: boolean) {
    if (strong && t >= peak && this.peakAt !== peak && t - peak < 10) this.sound.chime(reduced);
    if (t >= peak) this.peakAt = peak;
    if (laugh && this.laughAt !== start) this.sound.giggle(reduced);
    if (laugh) this.laughAt = start;
  }
}
