// Schmuck mit Zug (Konzept „Gleisbauer und Höhlen-Welt“, Schritt 13, „Fahrregeln“), im Paket der Bahn, rein und gleich
// für 2D und 3D: Pfeif-Gruß (tutet der Zug, pfeifen Murmeltiere in der Nähe zurück und machen Männchen), die
// Laternenfahrt (die erste Heimfahrt nach voller Höhlen-Leiste: die Fledermaus wacht auf und zirpt, Tiere der Grotte
// winken, Murmeltiere pfeifen, Glühwürmchen folgen dem Zug ein Stück, solange er in der Höhlenwelt ist; am Ziel ein
// kleines Fest mit Kristall-Funken, danach trägt der Zug den Kristall-Wimpel) und „Gute Nacht, Bahn“ (schläft die Figur im
// Lichtungsbett und steht der Zug an Bahnhof Bär in Sichtweite, pfeift er leise gute Nacht und macht sein Licht aus,
// danach brennt nur ein kleines Nachtlicht). Bei reduzierter Bewegung keine Glühwürmchen; die Töne bleiben. Alles
// Zierde, nie Bedingung (ohne das Paket der Bahn gibt es keinen Zug).
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Schmuck mit Zug)

import type { Part } from '../../../../lib/games/front';
import { fine } from '../../../../data/games/mitwachsen-fine';
import { CAVE_SPECIES } from '../../../../data/games/mitwachsen-hoehle';
import { TRAIN_COLORS } from '../../../../data/games/worlds/bahn/mitwachsen-train-model';
import type { RideEvent } from '../../mitwachsen-pack-types';
import { bedSight } from '../../mitwachsen-ride-kit';
import type { GoodNight, RideBody } from '../../mitwachsen-ride-view';
import type { State } from '../../mitwachsen-state';
import type { World } from '../../mitwachsen-world';
import type { Scored } from '../../sfx';
import { TRAIN, trainRoute } from './mitwachsen-train';

/** Pfeif-Gruß: Murmeltiere bis so weit (Schachbrett) vom Zug pfeifen zurück, höchstens so viele hüpfen */
export const PFEIF = { reach: 10, most: 2, at: 0.4 } as const;
/** Ereignisse, bei denen der Zug tutet oder pfeift (Anstoßen, Halt vor einem Tier, Abfahrt, gedrosseltes Winken) */
const TOOTS: ReadonlySet<RideEvent['what']> = new Set(['nudge', 'stop', 'go', 'wave']);

const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/** Pfiff eines Murmeltiers (A5, Sinus, 0,18 s, sein Ton aus `CAVE_SPECIES`), `at` s später, leiser als sein Ruf */
export const marmot = (at = 0): Scored => {
  const { notes, len, wave } = CAVE_SPECIES.murmeltier.tone;
  return [notes[0] ?? 880, len, wave, 0.06, 1, at];
};

/**
 * Pfeif-Gruß: Tutet der Zug (`TOOTS`, beim Winken nur mit `ring`), pfeifen bis zu `PFEIF.most` Murmeltiere bis
 * `PFEIF.reach` Felder vom Ereignis kurz danach zurück und hüpfen (`chorus`); ein Ton für alle, so bleibt es leise.
 * Keins in der Nähe: nichts
 */
export function whistleBack(e: RideEvent, state?: Pick<State, 'animals'>): { score: Scored[]; chorus: string[] } {
  if (!state || !TOOTS.has(e.what) || (e.what === 'wave' && !e.ring)) return { score: [], chorus: [] };
  const near = state.animals
    .filter((a) => a.species === 'murmeltier' && cheb(a.x, a.y, e.x, e.y) <= PFEIF.reach)
    .sort((a, b) => cheb(a.x, a.y, e.x, e.y) - cheb(b.x, b.y, e.x, e.y))
    .slice(0, PFEIF.most)
    .map((a) => a.id);
  return near.length ? { score: [marmot(PFEIF.at)], chorus: near } : { score: [], chorus: [] };
}

/** Fest am Ziel der Laternenfahrt: G5–C6–E6 (Dreieck), dazu Funken in den Farben der Kristall-Raute */
export const FEAST: readonly Scored[] = [
  [783.99, 0.14, 'triangle', 0.06, 1, 0],
  [1046.5, 0.14, 'triangle', 0.06, 1, 0.14],
  [1318.51, 0.3, 'triangle', 0.06, 1, 0.28],
];
export const SPARKS: readonly string[] = [...TRAIN_COLORS.crystal, '#ffffff'];

/** Zirpen der Fledermaus (E5–G5, ihr Ton aus `CAVE_SPECIES`): Sie wacht beim Losfahren der Laternenfahrt auf */
export function chirp(): Scored[] {
  const { notes, len, gap, gain, wave } = CAVE_SPECIES.fledermaus.tone;
  return notes.map((f, i): Scored => [f, len, wave, gain ?? 0.05, 1, i * (len + gap)]);
}

/** Die Fledermaus, die auf der Laternenfahrt aufwacht (die erste der Grotte); keine: undefined */
export const batOf = (state?: Pick<State, 'animals'>) => state?.animals.find((a) => a.species === 'fledermaus')?.id;

/** So viele Glühwürmchen folgen dem Zug, so weit hinter dem letzten Wagen (Felder), so weit auseinander */
export const FLIES = { n: 5, behind: 0.6, apart: 0.7 } as const;
/**
 * Glühwürmchen: dunkelgrüner Körper, leuchtendes Hinterteil (an; es leuchtet weich in den Raum, `halo`) oder nur der
 * Körper (aus), einmal je Sekunde
 */
const FLY_ON: readonly Part[] = [
  [-0.05, -0.04, 0, 0.1, 0.08, 0.06, '#2f5a2a'],
  fine([-0.13, -0.05, -0.01, 0.09, 0.1, 0.08, '#d8ff6a'], { halo: true }),
];
const FLY_OFF: readonly Part[] = [[-0.05, -0.04, 0, 0.1, 0.08, 0.06, '#2f5a2a']];

/**
 * Glühwürmchen hinter dem Zug auf der Laternenfahrt: an den Punkten `trail` (x, y, Höhe des Gleises hinter dem letzten
 * Wagen), schwebend und je eins um eine Weile versetzt aufleuchtend; nur, solange diese Punkte in der Höhlenwelt liegen
 * (sie folgen ihm ein Stück), nie bei reduzierter Bewegung. Keine Kennung mit `ride:`: Antippen trifft sie nicht
 */
export function fireflies(
  trail: readonly (readonly [number, number, number])[],
  world: Pick<World, 'realm'>,
  now: number,
  reduced: boolean,
): RideBody[] {
  if (reduced) return [];
  return trail.flatMap(([x, y, h], i): RideBody[] => {
    if (world.realm(Math.round(x), Math.round(y)) !== 'hoehle') return [];
    const t = now / 1000 + i * 0.37;
    const on = t % 1 < 0.5;
    const z = h + 0.9 + 0.25 * Math.sin(t * 2.4);
    const sway = 0.3 * Math.sin(t * 1.7 + i);
    const k = `bahn:gluehwurm:${+on}`;
    const parts = on ? FLY_ON : FLY_OFF;
    return [{ id: `bahn:gluehwurm:${i}`, key: k, x: x + sway, y: y - sway, z, dir: 's', parts, foot: 0 }]; // sie schweben
  });
}

/** Leises Gute-Nacht des Zugs: sein Pfiff A5 → C6, ganz leise, dann ein weiches Tuten */
export const NIGHT_WHISTLE: readonly Scored[] = [
  [880, 0.4, 'sine', 0.025, 1046.5 / 880, 0],
  [880, 0.22, 'sine', 0.025, 1, 0.55],
];

/**
 * „Gute Nacht, Bahn“ (`View2D.goodNight`): Schläft die Figur im Bett der Lichtung und steht der Zug an Bahnhof Bär in
 * Sichtweite (`bedSight`), pfeift er leise gute Nacht; sonst undefined (am Prellbock in der Bucht ist er zu weit weg)
 */
export function trainGoodNight(state: State, world: World): GoodNight | undefined {
  const r = trainRoute(world, state);
  if (!r || state.dozing?.includes(TRAIN.id)) return undefined;
  return bedSight(TRAIN, r, state, world) ? { id: TRAIN.id, score: NIGHT_WHISTLE } : undefined;
}
