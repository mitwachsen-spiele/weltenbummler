// Kristall-Laterne der Grotte – rein, im Welt-Paket der Höhlenwelt. Am Höhlenbett steht rechts vorn ein niedriger
// Steinsockel (`'lantern'`, fest, `GROTTE.lantern` relativ zum Bett), darauf die Laterne: ein leuchtender türkiser
// Kristall in einem goldenen Rahmen (Gold: hier kannst du etwas tun). Läuft die Figur hinein, nimmt sie die Laterne
// (Regel `takeLantern`, Teil von `pack.rules`: `State.lamp` = 'hoehle', Ereignis `lantern`, sie bleibt stehen und hüpft),
// trägt sie in der linken Hand (`LANTERN_PARTS`, ohne Gold, mitwachsen-carry.ts) und ihr Lichtkreis wächst
// (mitwachsen-glow.ts). Der Sockel ist dann leer, ein zweites Hineinlaufen stößt nur sanft an. Zurück auf den Sockel
// kommt sie über Nacht (Schlafen, im Kern) und sobald die Figur die Grotte verlässt (im Kern, am Ende jedes Schritts);
// gespeichert wird sie nicht, wie Korb, Kanne und Netz. Nichts ist versperrt: Ohne Laterne ist es nie wirklich dunkel.
// Die Laterne auf dem Sockel ist ein Körper je Bild (`bodies`, wie ein Fahrzeug), so baut 3D nichts neu, wenn sie geht
// oder wiederkommt. Kein Feuer, keine Fackel.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Licht der Grotte“)

import type { Part } from '../../../../lib/games/front';
import { GROTTE } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import type { Point } from '../../../../data/games/mitwachsen';
import { dress } from '../../../../data/games/mitwachsen-fine';
import type { Cell } from '../../mitwachsen-cell';
import type { Ruled } from '../../mitwachsen-pack-types';
import type { RideBody } from '../../mitwachsen-ride-view';
import type { Scored } from '../../sfx';
import type { World } from '../../mitwachsen-world';

/** Höhe des Sockels: darauf steht die Laterne */
export const POST_H = 0.5;

const CRYSTAL = ['#8fe0ea', '#d8f6fa'] as const;

/**
 * Die Laterne auf ihrem Sockel: Kristall im goldenen Rahmen (Boden, vier Streben, Deckel, Öse), größer als in der Hand.
 * Fein wie in der Hand (mitwachsen-fine.ts `CARRY_DRESS`): der Rahmen Metall, der Kristall leuchtet weich (`halo`)
 */
export const LANTERN_READY: Part[] = dress(
  [
    [-0.15, -0.15, 0, 0.3, 0.3, 0.05, GOLD.side, GOLD.top], // Boden
    [-0.1, -0.1, 0.05, 0.2, 0.2, 0.28, ...CRYSTAL], // Kristall, leuchtet
    [-0.15, -0.15, 0.05, 0.05, 0.05, 0.28, GOLD.side, GOLD.top], // vier Streben
    [-0.15, 0.1, 0.05, 0.05, 0.05, 0.28, GOLD.side, GOLD.top],
    [0.1, -0.15, 0.05, 0.05, 0.05, 0.28, GOLD.side, GOLD.top],
    [0.1, 0.1, 0.05, 0.05, 0.05, 0.28, GOLD.side, GOLD.top],
    [-0.16, -0.16, 0.33, 0.32, 0.32, 0.05, GOLD.side, GOLD.top], // Deckel
    [-0.04, -0.04, 0.38, 0.08, 0.08, 0.06, GOLD.side, GOLD.top], // Öse
  ],
  { [GOLD.side]: { skin: 'metall' }, [CRYSTAL[0]]: { halo: true } },
);
/** Halbbreite des weichen Flecks unter der Laterne: bleibt auf der Platte des Sockels */
export const LANTERN_FOOT = 0.2;

/** Platz des Sockels in einer Welt: neben dem Höhlenbett (`GROTTE.lantern`) */
export const lanternSpot = (world: Pick<World, 'homes'>): Point => {
  const [bx, by] = world.homes.hoehle.bed;
  return [bx + GROTTE.lantern[0], by + GROTTE.lantern[1]];
};

/**
 * Die Figur läuft in den Sockel (x, y) der Grotte: Steht die Laterne darauf, nimmt sie sie (`lamp`, Ereignis `lantern`)
 * und bleibt stehen. Trägt sie sie schon, ist der Sockel leer und nur fest (false: sanft anstoßen)
 */
export function takeLantern(
  s: Ruled,
  c: Cell,
  x: number,
  y: number,
  events: { push(e: { type: 'lantern'; x: number; y: number }): unknown },
) {
  if (c.deco !== 'lantern' || c.region !== 'hoehle' || s.lamp) return false;
  s.lamp = 'hoehle';
  events.push({ type: 'lantern', x, y });
  return true;
}

/**
 * Die Laterne auf ihrem Sockel als Körper dieses Bilds, solange die Figur sie nicht trägt (gleich für 2D und 3D); ohne
 * Sockel in der Welt (ohne Paket) keiner
 */
export function lanternBodies(state: { lamp?: unknown }, world: Pick<World, 'homes' | 'cell'>): RideBody[] {
  if (state.lamp) return [];
  const [x, y] = lanternSpot(world);
  const c = world.cell(x, y);
  if (c.deco !== 'lantern') return [];
  return [
    { id: 'lantern', key: 'lantern-ready', x, y, z: c.h + POST_H, dir: 's', parts: LANTERN_READY, foot: LANTERN_FOOT },
  ];
}

/** Ton beim Nehmen: drei helle Töne aufwärts, E5, G5, C6 (Pentatonik, Sinus, leise) */
export const lanternScore = (): Scored[] =>
  [659.25, 783.99, 1046.5].map((f, i) => [f, 0.18, 'sine', 0.06, 1, i * 0.09] as Scored);
