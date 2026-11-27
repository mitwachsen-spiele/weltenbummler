// Bild der Klangsteine für 2D und 3D (Entwurf „Feine Grafik“, Paket P7): Stein mit Verlauf und heller Oberkante, ohne
// Muster (es gibt keinen Stein-Skin), mit Moos, einem Riss und zwei Kieseln am Fuß; die goldene Achtelnote in Lack mit
// Glanzpunkt, ihr Kopf leuchtet weich (`halo`). Gleich in beiden Ansichten: 2D malt die Quader in ihrer Reihenfolge
// (hinten und unten zuerst), 3D legt sie in die feinen Geometrien des Stücks bzw. in die Note, die schwebt.
// Spezifikation: docs/specs/mitwachsen.md (Zeilen „Klangsteine“ und „Feinheit“)

import { painterOf, type Fine, type FinePainter, type Projection } from '../../lib/games/front';
import { drawBox, type Box } from './mitwachsen-view';

export const STONE_COLORS = { side: '#8b8780', top: '#aaa69f' } as const;
export const NOTE_COLORS = { side: '#d4861a', top: '#f0a531' } as const; // Gold: hier kann man etwas tun
/** Moos, Riss, Kiesel und Glanz der Note */
export const STONE_DETAIL = {
  moss: '#5a9a40',
  mossTop: '#6aa84f',
  crack: '#6b6862',
  pebble: '#7d7972',
  pebbleTop: '#9a968e',
  glint: '#ffe2a0',
} as const;

/** Quader [x, y, z, Breite, Tiefe, Höhe] relativ zur Ecke des Feldes, z ab seiner Oberkante */
export type Block = readonly [number, number, number, number, number, number];

/** Der Stein: breiter Sockel, darauf eine kleinere Platte */
export const STONE: readonly Block[] = [
  [0.14, 0.2, 0, 0.72, 0.6, 0.34],
  [0.24, 0.28, 0.34, 0.52, 0.44, 0.12],
];

/** Halbe Breite des Sockels: Größe des weichen Flecks darunter in 2D (in 3D wirft die Sonne den Schatten) */
export const STONE_FOOT = 0.36;

/** Achtelnote ♪ von vorn, flach: [x, z, Breite, Höhe] um die Mitte, unten bei z = 0; gut zu erkennen, fast ein Feld hoch */
export const NOTE: readonly (readonly [number, number, number, number])[] = [
  [-0.27, 0, 0.36, 0.26], // Kopf
  [0.01, 0.12, 0.09, 0.72], // Hals
  [0.1, 0.74, 0.2, 0.1], // Fähnchen
  [0.21, 0.56, 0.09, 0.2],
];
/** Tiefe der Note (sie ist flach) und Dicke aufgelegter Plättchen */
export const NOTE_D = 0.1;
export const PLATE = 0.005;

const STEIN: Fine = {},
  FELL: Fine = { skin: 'fell' },
  LACK: Fine = { skin: 'lack' },
  KOPF: Fine = { skin: 'lack', halo: true };

/**
 * Der Klangstein auf dem Feld (x, y) mit Boden auf Höhe h, in Malreihenfolge: Sockel, Riss vorn darauf, Platte, Moos
 * vorn auf dem Sockel (vor der Platte), zwei Kiesel neben dem Sockel
 */
export function stoneBoxes(x: number, y: number, h: number): Box[] {
  const [[bx, by, , bw, bd, bh], [px, py, pz, pw, pd, ph]] = STONE as [Block, Block];
  const { side, top } = STONE_COLORS;
  const d = STONE_DETAIL;
  return [
    [x + bx, y + by, h, bw, bd, bh, side, top, undefined, STEIN],
    [x + 0.56, y + by + bd, h + 0.08, 0.025, PLATE, 0.2, d.crack, d.crack], // Riss vorn im Sockel
    [x + px, y + py, h + pz, pw, pd, ph, side, top, undefined, STEIN],
    [x + 0.17, y + py + pd + 0.005, h + bh, 0.22, 0.07, 0.03, d.moss, d.mossTop, undefined, FELL], // vor der Platte
    [x + 0.03, y + 0.66, h, 0.1, 0.08, 0.06, d.pebble, d.pebbleTop, undefined, STEIN],
    [x + 0.87, y + 0.5, h, 0.08, 0.08, 0.05, d.pebble, d.pebbleTop, undefined, STEIN],
  ];
}

/**
 * Die Note: Mitte unten (cx, z), Mitte der Tiefe cy, Größe `scale` (Breite und Höhe; die Tiefe bleibt). Lack, der Kopf
 * leuchtet weich, vorn auf dem Kopf ein Glanzpunkt
 */
export function noteBoxes(cx: number, cy: number, z: number, scale: number): Box[] {
  const { side, top } = NOTE_COLORS;
  const y = cy - NOTE_D / 2;
  const out: Box[] = NOTE.map(([nx, nz, w, hh], i) => [
    cx + nx * scale,
    y,
    z + nz * scale,
    w * scale,
    NOTE_D,
    hh * scale,
    side,
    top,
    undefined,
    i === 0 ? KOPF : LACK,
  ]);
  const [hx, hz, hw, hh] = NOTE[0]!;
  out.push([
    cx + (hx + hw * 0.62) * scale,
    y + NOTE_D,
    z + (hz + hh * 0.55) * scale,
    0.07 * scale,
    PLATE,
    0.06 * scale,
    STONE_DETAIL.glint,
    STONE_DETAIL.glint,
  ]);
  return out;
}

/** Kennung des Leuchtens einer Note in 2D: fest je Stein (die Note schwebt, ihre Lage wechselt in jedem Bild) */
export const noteHaloId = (x: number, y: number) => `note:${x},${y}`;

/** Der Maler `pen` mit fester Kennung `id` für jedes Leuchten (undefined bleibt: flach) */
function haloAs(pen: FinePainter | undefined, id: string): FinePainter | undefined {
  const halo = pen?.halo?.bind(pen);
  return pen && halo ? { face: (ctx, f, fine) => pen.face(ctx, f, fine), halo: (at) => halo({ ...at, id }) } : pen;
}

/**
 * Klangstein in der 2D-Ansicht von vorn: fein (Maler des Kontexts), erst der Stein, dann die Note darüber; `float` ist
 * Höhe und Größe der Note (`noteFloat` in mitwachsen-story.ts). Das Leuchten des Notenkopfs trägt eine feste Kennung
 * je Stein (`noteHaloId`), damit die Auswahl der Leuchten (`haloPick`) es beim Schweben nicht verliert
 */
export function drawStone(
  ctx: CanvasRenderingContext2D,
  P: Projection,
  x: number,
  y: number,
  h: number,
  float: { z: number; scale: number },
) {
  for (const b of stoneBoxes(x, y, h)) drawBox(ctx, P, b);
  const pen = haloAs(painterOf(ctx), noteHaloId(x, y)) ?? null;
  for (const b of noteBoxes(x + 0.5, y + 0.5, h + float.z, float.scale)) drawBox(ctx, P, b, pen);
}
