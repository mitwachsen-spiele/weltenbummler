// Aussehen und Klang des Eiszapfen-Glockenspiels im Gletschertal, gleich für 2D und 3D: Jeder Zapfen hängt an einer
// Eiskante oben an der Klippe hinter seinem Feld (mitwachsen-chime.ts), hinten am Feld, so läuft die Figur davor
// entlang. Je tiefer sein Ton (`note` 0), desto länger der Zapfen. Rein (ohne DOM und Three.js): Quader in Feldern, die
// beide Ansichten zeichnen; 2D lässt einen angeschlagenen Zapfen kurz schwingen (`swing`, nicht bei reduzierter
// Bewegung), 3D hängt still. Dazu der helle Glockenton (`chimeScore`) in der Pentatonik. Teil des Welt-Pakets der
// Eis-Welt.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Gletscherkessel“ und „Was angezeigt wird“)

import { ICE_COLORS } from '../../../../data/games/worlds/eis/mitwachsen-ice-colors';
import type { Fine } from '../../../../lib/games/front';
import type { Cell } from '../../mitwachsen-cell';
import type { PackEvent } from '../../mitwachsen-pack-types';
import type { Box } from '../../mitwachsen-view';
import { ICE_FINE } from './mitwachsen-ice-look';
import type { World } from '../../mitwachsen-world';
import type { Scored } from '../../sfx';
import { lipOf } from './mitwachsen-chime';

const [ICE, ICE_TOP] = ICE_COLORS.ice;
const [GLASS, GLASS_TOP] = ICE_COLORS.slide; // die Spitze heller, fast durchsichtig
const [SNOW, SNOW_TOP] = ICE_COLORS.snow;

/** Länge des Zapfens als Anteil der Höhe unter der Kante: Ton 0 fast bis zum Boden, je Ton etwas kürzer */
const length = (note: number) => 0.85 - 0.075 * note;

/**
 * Quader eines Eiszapfens auf dem Feld (x, y) (Inhalt `c`, Ton `c.note`): die Eiskante oben an der Klippe dahinter,
 * über die ganze Breite des Felds (so wird die Reihe eine Kante), und der Zapfen darunter in drei schmaleren Stücken,
 * in der Reihenfolge, in der die 2D-Ansicht sie übereinander malt (von unten nach oben).
 * `sway` (in Feldern) schiebt den Zapfen seitlich, unten weiter als oben (Schwingen in 2D). Fein: Kante und dicke
 * Stücke aus Eisblock, die helle Spitze glitzert (`halo`), auf der Kante liegt eine dünne Schneeschicht.
 */
export function chimeBoxes(world: World, c: Cell, x: number, y: number, sway = 0): Box[] {
  const lip = lipOf(world.cell(x, y - 1), c);
  const top = c.h + lip;
  const len = (lip - 0.1) * length(c.note ?? 0); // unter der Kante (0,1 dick)
  const parts: [w: number, share: number, side: string, up: string, fine: Fine][] = [
    [0.2, 0.45, ICE, ICE_TOP, ICE_FINE.block],
    [0.13, 0.33, ICE, GLASS_TOP, ICE_FINE.block],
    [0.06, 0.22, GLASS, GLASS_TOP, ICE_FINE.glow],
  ];
  const out: Box[] = [];
  let z = top - 0.1;
  let down = 0;
  for (const [w, share, side, up, fine] of parts) {
    const h = len * share;
    z -= h;
    down += share;
    out.unshift([x + 0.5 - w / 2 + sway * down, y + 0.13 - w / 2, z, w, w, h, side, up, undefined, fine]); // die Spitze zuerst
  }
  // zuletzt die Eiskante und der Schnee darauf: 2D malt von unten nach oben
  return [
    ...out,
    [x, y, top - 0.1, 1, 0.2, 0.1, ICE, ICE_TOP, undefined, ICE_FINE.block],
    [x, y, top, 1, 0.2, 0.025, SNOW, SNOW_TOP, undefined, ICE_FINE.snow],
  ];
}

const SWING_MS = 700; // so lange schwingt ein angeschlagener Zapfen
/** Seitliches Schwingen `ms` nach dem Anschlagen (in Feldern): klingt ab, nach `SWING_MS` hängt er still */
export const swing = (ms: number) =>
  ms >= 0 && ms < SWING_MS ? 0.12 * Math.sin((ms / SWING_MS) * Math.PI * 4) * (1 - ms / SWING_MS) : 0;

/** Wann jeder Zapfen ("x,y") zuletzt angeschlagen wurde (nur Bild: Schwingen in 2D) */
const rung = new Map<string, number>();
/** Ein Zapfen wird angeschlagen (um `now`, Zeit des Bilds) */
export const ring = (x: number, y: number, now: number) => void rung.set(`${x},${y}`, now);
/** Seit wann (ms) der Zapfen auf (x, y) schwingt; nie angeschlagen: unendlich lange */
export const since = (x: number, y: number, now: number) => now - (rung.get(`${x},${y}`) ?? -Infinity);

/** Tonleiter des Glockenspiels: Pentatonik von C5 bis D6, so passt jeder Ton zu jedem (kein falscher Ton) */
export const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66] as const;

/** Heller Glockenton eines Zapfens: Grundton, der lange nachklingt, und ein leiser Oberton (sanft, nie laut) */
export function chimeScore(e: Extract<PackEvent, { type: 'icicle' }>): Scored[] {
  const f = SCALE[Math.max(0, Math.min(e.note, SCALE.length - 1))] ?? SCALE[0];
  return [
    [f, 0.9, 'sine', 0.07, 1, 0],
    [f * 2, 0.35, 'triangle', 0.02, 1, 0],
  ];
}
