// Aussehen der Dinge im Gletscherkessel, gleich für 2D und 3D: Iglu, Eisschale, Wassertrog aus Eisblöcken, Fischkiste,
// Eisschollen auf den Eislöchern, Eiskristalle und wie sie beim Polarlicht leuchten.
// Rein (ohne DOM und Three.js): liefert Quader in Feldern, die beide Ansichten zeichnen. Teil des Welt-Pakets der
// Eis-Welt (nicht im Kern, nicht in der 3D-Ansicht): 2D über view-2d.ts, 3D über den 3D-Teil view-3d.ts.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt“, Kessel)

import { ICE_COLORS, ICE_CRYSTALS } from '../../../../data/games/worlds/eis/mitwachsen-ice-colors';
import { IGLOO_H, IGLOO_LAYERS } from '../../../../data/games/mitwachsen-eis';
import { KESSEL_COLORS } from '../../../../data/games/worlds/eis/mitwachsen-kessel';
import type { Cell } from '../../mitwachsen-cell';
import { hash } from '../../../../lib/games/rng';
import { homeAt, type Realms } from '../../mitwachsen-home';
import type { Box } from '../../mitwachsen-view';
import type { Fine } from '../../../../lib/games/front';

/** Quader in Feldern (mitwachsen-view.ts): Lage, Maße, Farben, Art in 3D (`see` durchsichtig, `sway` im Wind) */
export type IceBox = Box;

/** Zustand einer Fischkiste: voll (sonst nur Holz und etwas Schnee) und wie weit eine Flosse gerade zuckt (0 … 1) */
export type Crate = { full: boolean; twitch: number };

const EYE = '#1d2233';
const CRATE_NAIL = '#4a4f5a';
/** Feinheit der Dinge im Kessel (Entwurf „Feine Grafik“): Muster je Material, Leuchten kompakter Teile */
export const ICE_FINE = {
  block: { skin: 'eisblock' },
  snow: { skin: 'schnee' },
  wood: { skin: 'holz' },
  fish: { skin: 'lack' },
  moss: { skin: 'fell' },
  glow: { halo: true },
} as const satisfies Record<string, Fine>;
const { block: BLOCK, snow: SNOW, wood: WOOD, fish: FISH, moss: MOSS, glow: GLOW } = ICE_FINE;
/** Warmes Licht im Iglu und heller Sturz über dem Bogen (Entwurf: Eingang mit warmem Leuchten) */
export const IGLOO_LIGHT = { lamp: '#ffd28a', lintel: '#d8e6f0' } as const;
/** Lichtkante: so dick ist das helle Plättchen vorn auf einem Kristall */
export const EDGE = 0.005;
const TWITCH_MS = 260; // so lange zuckt eine Flosse
/**
 * Ab und zu zuckt in einer vollen Fischkiste eine Flosse (je Kiste zu eigenen Zeiten, etwa alle 3 bis 5 s); 0 … 1.
 * Nur in der 2D-Ansicht und nicht bei reduzierter Bewegung (das entscheidet die Ansicht); in 3D wiegen sich die Flossen
 * stattdessen leicht im Wind.
 */
export function finTwitch(now: number, x: number, y: number): number {
  const every = 3000 + (hash(5, x, y) % 2000);
  const t = (now + hash(6, x, y)) % every;
  return t < TWITCH_MS ? Math.sin((t / TWITCH_MS) * Math.PI) : 0;
}

const LAYERS = IGLOO_LAYERS; // Reihen aus Schneeblöcken
const ARCH = 1.7; // bis zu dieser Höhe ist das Iglu vorn offen (weiter Bogen): Man sieht die Tiere darin
const WALL = 0.45; // Dicke der Wand
const STRIP = 0.5; // Tiefe eines Schneeblocks: Jede Reihe besteht aus Streifen, so wird die Kuppel rund
const LAMP_ROW = 3; // in dieser Reihe hängt innen an der Rückwand das warme Licht

/**
 * Iglu über dem Unterstand der Gegend: runde Kuppel aus Reihen von Schneeblöcken, von der Rückwand bis vor das Dach.
 * Unten nur die Wand ringsum, vorn offen (weiter Bogen bis `ARCH`), darüber geschlossene Reihen. Gezeichnet vom
 * Mittelfeld der Rückwand aus; in 3D wird es vor der Figur durchsichtig. Fein: Eisblöcke mit Fugen (`eisblock`), über
 * dem Bogen vorn ein heller Sturz, innen an der Rückwand ein kleines warmes Licht (leuchtet, `halo`).
 */
function igloo(world: Realms, x: number, y: number, h: number): IceBox[] {
  const { x0, y0, x1, y1 } = homeAt(world, x, y).shelter;
  const [cx, cy] = [(x0 + x1 + 1) / 2, (y0 - 1 + y1 + 1) / 2]; // von der Rückwand bis zur Vorderkante des Dachs
  const [a, b] = [(x1 - x0 + 1) / 2 + 0.3, (y1 - y0 + 2) / 2 + 0.2];
  const out: IceBox[] = [];
  const lh = IGLOO_H / LAYERS;
  /** halbe Breite einer Ellipse mit Halbachsen (ea, eb) im Abstand dy von der Mitte */
  const half = (ea: number, eb: number, dy: number) => (Math.abs(dy) < eb ? ea * Math.sqrt(1 - (dy / eb) ** 2) : 0);
  for (let k = 0; k < LAYERS; k++) {
    const z = h + k * lh;
    const f = Math.sqrt(1 - ((k + 0.5) / LAYERS) ** 2); // Rundung der Kuppel nach oben
    const closed = k * lh >= ARCH;
    for (let i = 0, sy = cy - b * f; sy < cy + b * f - 0.01; i++, sy += STRIP) {
      const d = Math.min(STRIP, cy + b * f - sy);
      const dy = sy + d / 2 - cy;
      const wo = half(a * f, b * f, dy);
      const wi = closed ? 0 : half(a * f - WALL, b * f - WALL, dy);
      const [side, top] = (k + i) % 2 ? ICE_COLORS.snow : ICE_COLORS.block;
      if (closed || (wi === 0 && dy < 0)) out.push([cx - wo, sy, z, 2 * wo, d, lh, side, top, 'see', BLOCK]);
      else if (wi > 0) {
        out.push([cx - wo, sy, z, wo - wi, d, lh, side, top, 'see', BLOCK]); // Wand links und rechts, vorn offen
        out.push([cx + wi, sy, z, wo - wi, d, lh, side, top, 'see', BLOCK]);
      }
    }
    // warmes Licht innen an der Rückwand (die hinterste Reihe ist ein ganzer Streifen tief zu)
    if (k === LAMP_ROW)
      out.push([
        cx - 0.12,
        cy - b * f + STRIP,
        z + 0.08,
        0.24,
        0.08,
        0.22,
        IGLOO_LIGHT.lamp,
        IGLOO_LIGHT.lamp,
        undefined,
        GLOW,
      ]);
    // heller Sturz vorn auf der untersten geschlossenen Reihe, über dem Bogen
    const front = out[out.length - 1];
    if (closed && (k - 1) * lh < ARCH && front) {
      const [fx, fy, , fw, fd] = front; // vorderster Streifen der Reihe
      out.push([fx, fy + fd, z, fw, 0.04, 0.1, IGLOO_LIGHT.lintel, IGLOO_LIGHT.lintel, 'see']);
    }
  }
  return out;
}

/**
 * Fischkiste aus Treibholz mit verschneitem Rand. Voll: silberblaue Fische, die Schwanzflossen stehen über den Rand
 * (eine zuckt ab und zu, `twitch`); leer: nur Holz und etwas Schnee innen. Fein: Maserung im Holz, Schnee glitzert,
 * Fische glänzen, vorn zwei Nägel in der Wand.
 */
function fishCrate(x: number, y: number, h: number, { full, twitch }: Crate): IceBox[] {
  const [wood, woodTop] = ICE_COLORS.crate;
  const [snowSide, snowTop] = ICE_COLORS.snow;
  const [back, belly] = ICE_COLORS.fish;
  const out: IceBox[] = [
    [x + 0.1, y + 0.2, h, 0.8, 0.62, 0.1, wood, woodTop, undefined, WOOD], // Boden
    [x + 0.1, y + 0.2, h + 0.1, 0.8, 0.08, 0.32, wood, woodTop, undefined, WOOD], // Wände
    [x + 0.1, y + 0.74, h + 0.1, 0.8, 0.08, 0.32, wood, woodTop, undefined, WOOD],
    [x + 0.1, y + 0.28, h + 0.1, 0.08, 0.46, 0.32, wood, woodTop, undefined, WOOD],
    [x + 0.82, y + 0.28, h + 0.1, 0.08, 0.46, 0.32, wood, woodTop, undefined, WOOD],
    [x + 0.16, y + 0.82, h + 0.32, 0.04, 0.005, 0.04, CRATE_NAIL, CRATE_NAIL], // Nägel vorn
    [x + 0.8, y + 0.82, h + 0.32, 0.04, 0.005, 0.04, CRATE_NAIL, CRATE_NAIL],
    [x + 0.1, y + 0.2, h + 0.42, 0.8, 0.08, 0.04, snowSide, snowTop, undefined, SNOW], // Schnee auf den Rändern
    [x + 0.1, y + 0.28, h + 0.42, 0.08, 0.46, 0.04, snowSide, snowTop, undefined, SNOW],
    [x + 0.82, y + 0.28, h + 0.42, 0.08, 0.2, 0.04, snowSide, snowTop, undefined, SNOW],
    full
      ? [x + 0.18, y + 0.28, h + 0.1, 0.64, 0.46, 0.18, ICE_COLORS.fin, ICE_COLORS.fin, undefined, FISH] // darunter noch mehr Fische
      : [x + 0.18, y + 0.28, h + 0.1, 0.64, 0.46, 0.06, snowSide, snowTop, undefined, SNOW], // leer: nur etwas Schnee innen
  ];
  if (!full) return out;
  // Fische (Rücken silberblau, Bauch hell, dunkles Auge), Köpfe links; die Schwanzflossen stehen über den Rand, die
  // mittlere zuckt ab und zu
  for (const [fx, fy, lift] of [
    [0.22, 0.3, 0],
    [0.3, 0.46, twitch * 0.1],
    [0.2, 0.6, 0],
  ] as const)
    out.push(
      [x + fx, y + fy, h + 0.28, 0.48, 0.12, 0.08, belly, back, undefined, FISH],
      [x + fx + 0.04, y + fy + 0.02, h + 0.36, 0.04, 0.04, 0.01, EYE, EYE],
      [x + fx + 0.48, y + fy + 0.01, h + 0.3 + lift, 0.06, 0.1, 0.24, belly, back, 'sway', FISH],
    );
  return out;
}

/**
 * Quader eines Dings im Kessel; null, wenn das Feld kein Eis-Ding trägt (dann zeichnet die Ansicht wie sonst).
 * `crate`: Zustand der Fischkiste auf diesem Feld (voll oder leer, Zucken einer Flosse).
 */
export function iceBoxes(
  world: Realms,
  c: Cell,
  x: number,
  y: number,
  crate: Crate = { full: true, twitch: 0 },
): IceBox[] | null {
  const h = c.h;
  switch (c.deco) {
    case 'igloo': {
      const [sx, sy] = homeAt(world, x, y).shelterStem; // die Mitte der Rückwand zeichnet das ganze Iglu
      return sx === x && sy === y ? igloo(world, x, y, h) : [];
    }
    case 'fishcrate':
      return fishCrate(x, y, h, crate);
    case 'icebowl': // flache Futterschale aus Eis
      return [
        [x + 0.08, y + 0.15, h, 0.84, 0.7, 0.22, ...ICE_COLORS.bowl, undefined, BLOCK],
        [x + 0.2, y + 0.27, h + 0.2, 0.6, 0.46, 0.03, ICE_COLORS.bowlIn, ICE_COLORS.bowlIn],
        [x - 0.04, y + 0.6, h, 0.26, 0.28, 0.14, ...ICE_COLORS.moss, undefined, MOSS], // Büschel Moos am Rand (für Rentier und Co.)
        [x + 0.02, y + 0.66, h + 0.14, 0.12, 0.12, 0.06, ...ICE_COLORS.moss, undefined, MOSS],
      ];
    case 'watertrough': // Wassertrog aus Eisblöcken
      return c.biome !== 'eis'
        ? null
        : [
            [x + 0.05, y + 0.15, h, 0.44, 0.72, 0.4, ...ICE_COLORS.ice, undefined, BLOCK],
            [x + 0.51, y + 0.15, h, 0.44, 0.72, 0.4, ...ICE_COLORS.ice, undefined, BLOCK],
            [x + 0.13, y + 0.23, h + 0.4, 0.74, 0.56, 0.04, '#3f8fd8', '#7fc0f0'],
          ];
    default:
      return null;
  }
}

/** Spitzen eines Eiskristall-Büschels: Lage im Feld, Breite, Höhe (kleiner und spitzer als die Kristalle der Höhlenwelt) */
const SPIKES = [
  [0.38, 0.38, 0.24, 0.95],
  [0.18, 0.54, 0.16, 0.6],
  [0.62, 0.24, 0.14, 0.45],
] as const;

/**
 * Eiskristall-Büschel in der Farbe des Felds. `glint` (0 … 1): am Tag blitzt oben ein weißer Funke (nur 2D, nicht bei
 * reduzierter Bewegung). In 3D leuchten die Quader (`'glow'`) aus sich selbst, beim Polarlicht heller (`glowTint`).
 * Fein (Entwurf): Die kompakten Spitzen leuchten weich in den Raum (`halo`, in 2D und 3D; die große ist dafür zu hoch,
 * `haloCompact`, also leuchten zwei), vorn auf der großen Spitze zwei helle Lichtkanten (`'glow'`).
 */
export function crystalBoxes(c: Cell, x: number, y: number, glint = 0, glow = false): IceBox[] {
  const color = c.color ?? ICE_CRYSTALS[0];
  const out: IceBox[] = SPIKES.map(([dx, dy, w, h]) => [
    x + dx,
    y + dy,
    c.h,
    w,
    w,
    h,
    color,
    color,
    glow ? 'glow' : undefined,
    GLOW,
  ]);
  const [dx, dy, w, h] = SPIKES[0];
  out.push(
    // Lichtkanten vorn: leuchten wie der Kristall (`'glow'`: in 2D flach, also weiß; in 3D im Licht des Kristalls)
    [x + dx + 0.03, y + dy + w, c.h + h * 0.55, 0.05, EDGE, h * 0.35, '#ffffff', '#ffffff', 'glow'],
    [x + dx + w - 0.07, y + dy + w, c.h + h * 0.25, 0.035, EDGE, h * 0.18, '#ffffff', '#ffffff', 'glow'],
  );
  if (glint > 0) {
    const s = 0.12 * glint;
    out.push([x + 0.5 - s / 2, y + 0.5 - s / 2, c.h + 0.95, s, s, s, '#ffffff', '#ffffff']);
  }
  return out;
}

/**
 * Ab und zu blitzt ein Kristall am Tag auf (je Feld zu eigenen Zeiten, etwa alle 4 bis 7 s); 0 … 1. Bei reduzierter
 * Bewegung nie (das entscheidet die Ansicht).
 */
export function crystalGlint(now: number, x: number, y: number): number {
  const every = 4000 + (hash(7, x, y) % 3000);
  const t = (now + hash(8, x, y)) % every;
  return t < 400 ? Math.sin((t / 400) * Math.PI) : 0;
}

/**
 * Wie hell die Eiskristalle leuchten (0 … 1): ohne Polarlicht nicht, mit ihm sanft pulsierend (je Kristall versetzt,
 * `phase`), bei reduzierter Bewegung ruhig ohne Pulsieren.
 */
export function crystalGlow(aurora: number, reduced: boolean, now: number, phase = 0): number {
  const a = Math.max(0, Math.min(1, aurora));
  if (!a) return 0;
  return reduced ? 0.8 * a : a * (0.65 + 0.3 * Math.sin(now / 1100 + phase));
}

/** Farbe, mit der die 3D-Ansicht die leuchtenden Kristalle multipliziert: weiß ohne Leuchten, heller und grüntürkis mit ihm */
export function glowTint(glow: number): readonly [number, number, number] {
  return [1 + 0.25 * glow, 1 + 0.7 * glow, 1 + 0.55 * glow];
}

/**
 * Eisscholle auf einem Eisloch: zwei flache weiße Platten mit Schnee-Glitzer auf dem Wasser (in 2D treiben sie sanft hin und her,
 * `drift` −1 … 1; in 3D und bei reduzierter Bewegung liegen sie still)
 */
export function floeBoxes(x: number, y: number, drift = 0): IceBox[] {
  const d = drift * 0.06;
  return [
    [x + 0.16 + d, y + 0.2, 0.8, 0.5, 0.42, 0.06, ...KESSEL_COLORS.floe, undefined, SNOW],
    [x + 0.6 - d, y + 0.62, 0.8, 0.24, 0.2, 0.05, ...KESSEL_COLORS.floe, undefined, SNOW],
  ];
}

/** Wie weit eine Scholle gerade treibt (−1 … 1): langsam, jede zu ihrer eigenen Zeit */
export const floeDrift = (now: number, x: number, y: number) => Math.sin(now / 1600 + (hash(7, x, y) % 628) / 100);
