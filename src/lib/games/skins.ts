// Feine Oberflächen (Skins) für Dinge, nicht für Gelände: leise Muster je Material, die über die Farbe eines Quaders
// gelegt werden (Fell, Haar, Stoff, Holz, Metall …). Jedes Muster ist neutral: Grau mit Deckkraft, das die Farbe des
// Teils nur heller oder dunkler macht und so ihren Ton annimmt (keine neuen Farben im Bild). Die Muster stammen aus dem
// Entwurf „Feine Grafik“ (SURF), gezeichnet auf einer Kachel von 64 Einheiten, die nahtlos kachelt.
// Rein und deterministisch (fester Seed je Muster): 2D und 3D bekommen dieselben Pixel.

import { GrayRaster, bezier } from './raster';
import { nextRandom } from './rng';

/** Alle Muster, in der Reihenfolge des Atlas */
export const SKINS = [
  'fell',
  'haar',
  'stoff',
  'quilt',
  'holz',
  'metall',
  'lack',
  'schnee',
  'nadel',
  'blatt',
  'rinde',
  'eisblock',
] as const;
export type Skin = (typeof SKINS)[number];

/**
 * Wie viele Felder eine Kachel des Musters breit und hoch ist (im Entwurf `64 / per`): Fell und Nadeln fein, Steppdecke
 * und Eisblöcke grob. In 3D bei Modellen mit ihrer Größe malnehmen, damit Fell auf großen und kleinen Tieren gleich
 * dicht ist (oder bewusst nicht).
 */
export const SKIN_PERIOD: Readonly<Record<Skin, number>> = {
  fell: 64 / 96,
  haar: 64 / 80,
  stoff: 64 / 110,
  quilt: 64 / 44,
  holz: 1,
  metall: 1,
  lack: 64 / 48,
  schnee: 1,
  nadel: 64 / 96,
  blatt: 64 / 70,
  rinde: 64 / 72,
  eisblock: 64 / 40,
};

/** Seed je Muster wie im Entwurf: Ändert sich einer, ändert sich das Muster überall */
const SEED: Readonly<Record<Skin, number>> = {
  fell: 61,
  haar: 67,
  stoff: 71,
  quilt: 73,
  holz: 79,
  metall: 83,
  lack: 89,
  schnee: 97,
  nadel: 101,
  blatt: 107,
  rinde: 109,
  eisblock: 103,
};

const DARK = 0;
const LIGHT = 1;
type Pt = readonly [number, number];

/** Zeichenstift in Einheiten der Kachel (0 … 64), auf ein Raster beliebiger Größe skaliert */
class Pen {
  private readonly r: GrayRaster;
  private readonly k: number;
  constructor(r: GrayRaster) {
    this.r = r;
    this.k = r.size / 64;
  }
  line(pts: readonly Pt[], w: number, g: number, a: number) {
    this.r.stroke(
      pts.map(([x, y]) => [x * this.k, y * this.k] as const),
      w * this.k,
      g,
      a,
    );
  }
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, g: number, a: number) {
    this.r.ellipse(x * this.k, y * this.k, rx * this.k, ry * this.k, rot, g, a);
  }
  rect(x: number, y: number, w: number, h: number, g: number, a: number) {
    this.r.rect(x * this.k, y * this.k, w * this.k, h * this.k, g, a);
  }
  /** Jedes Pixel mit einer Funktion der Kachelkoordinaten (Verläufe) */
  fill(x: number, y: number, w: number, h: number, f: (x: number, y: number) => readonly [number, number]) {
    const k = this.k;
    this.r.each(x * k, y * k, (x + w) * k, (y + h) * k, (cx, cy) => f(cx / k, cy / k));
  }
}

/** Kleines Kreuz aus zwei Strichen (Glitzern im Schnee) */
function sparkle(p: Pen, R: () => number, n: number, g: number, a: number) {
  for (let i = 0; i < n; i++) {
    const cx = R() * 64,
      cy = R() * 64,
      s = 0.5 + R() * 0.8;
    p.rect(cx - s, cy - 0.25, 2 * s, 0.5, g, a);
    p.rect(cx - 0.25, cy - s, 0.5, 2 * s, g, a);
  }
}

/** Kurze Striche in einer Richtung um senkrecht (Fell, Nadeln) */
function hairs(p: Pen, R: () => number, n: number, dir: () => number, len: () => number, dark: number, light: number) {
  for (let i = 0; i < n; i++) {
    const cx = R() * 64,
      cy = R() * 64,
      a = dir(),
      l = len();
    const dk = R() < 0.5;
    p.line(
      [
        [cx, cy],
        [cx + Math.cos(a) * l, cy + Math.sin(a) * l],
      ],
      0.7,
      dk ? DARK : LIGHT,
      dk ? dark : light,
    );
  }
}

const DRAW: Readonly<Record<Skin, (p: Pen, R: () => number) => void>> = {
  fell: (p, R) =>
    hairs(
      p,
      R,
      150,
      () => Math.PI / 2 + (R() - 0.5) * 0.9,
      () => 2 + R() * 2.5,
      0.16,
      0.2,
    ),
  haar: (p, R) => {
    for (let i = 0; i < 26; i++) {
      const cx = R() * 64;
      const dk = R() < 0.5;
      p.line(
        bezier([cx, 0], [cx + 3, 20], [cx - 3, 44], [cx, 64]),
        0.8 + R() * 0.6,
        dk ? DARK : LIGHT,
        dk ? 0.2 : 0.16,
      );
    }
  },
  // Köperbindung: feine Diagonalen in beide Richtungen, 21 je Kachel, damit sie nahtlos weiterlaufen
  stoff: (p) => {
    for (let k = 0; k < 21; k++) {
      const i = (k * 64) / 21;
      p.line(
        [
          [i, 0],
          [i + 64, 64],
        ],
        0.6,
        DARK,
        0.08,
      );
      p.line(
        [
          [i, 64],
          [i + 64, 0],
        ],
        0.6,
        LIGHT,
        0.08,
      );
    }
  },
  // Steppdecke: vier gewölbte Felder (Mitte hell, Rand dunkel) mit gestrichelter Naht
  quilt: (p) => {
    for (const [qx, qy] of [
      [0, 0],
      [32, 0],
      [0, 32],
      [32, 32],
    ] as const)
      p.fill(qx, qy, 32, 32, (x, y) => {
        const t = Math.max(0, Math.min(1, (Math.hypot(x - qx - 16, y - qy - 15) - 3) / 21));
        const a = 0.18 - 0.06 * t; // von Weiß .18 nach Schwarz .12, vormultipliziert gemischt wie im Canvas
        return [((1 - t) * 0.18) / a, a];
      });
    for (const at of [0, 32])
      // Naht genau auf der Grenze der Felder, auch über den Rand der Kachel
      for (let s = 0; s < 64; s += 4) {
        p.line(
          [
            [at, s],
            [at, s + 2.2],
          ],
          0.9,
          LIGHT,
          0.7,
        );
        p.line(
          [
            [s, at],
            [s + 2.2, at],
          ],
          0.9,
          LIGHT,
          0.7,
        );
      }
  },
  holz: (p, R) => {
    for (let y = 3; y < 64; y += 5 + R() * 3) {
      const a = y + (R() - 0.5) * 3,
        b = y + (R() - 0.5) * 3;
      p.line(bezier([0, y], [20, a], [44, b], [64, y]), 0.7, DARK, 0.24);
    }
    p.ellipse(40, 30, 3, 1.5, 0, DARK, 0.26); // ein Ast
  },
  metall: (p, R) => {
    for (let i = 0; i < 40; i++) {
      const lt = R() < 0.5;
      p.rect(R() * 64, 0, 0.6 + R(), 64, lt ? LIGHT : DARK, lt ? 0.12 : 0.06);
    }
  },
  // Lack: schräger Glanzstreif, über die Kachel umlaufend
  lack: (p) =>
    p.fill(0, 0, 64, 64, (x, y) => {
      const t = (((x + y) / 64) % 1) - 0.5;
      return [LIGHT, 0.2 * Math.max(0, 1 - Math.abs(t) / 0.16)];
    }),
  schnee: (p, R) => {
    sparkle(p, R, 14, DARK, 0.22);
    sparkle(p, R, 8, LIGHT, 0.95);
  },
  nadel: (p, R) =>
    hairs(
      p,
      R,
      120,
      () => Math.PI / 2 + (R() < 0.5 ? -0.7 : 0.7),
      () => 2.5,
      0.22,
      0.18,
    ),
  blatt: (p, R) => {
    for (let i = 0; i < 110; i++) {
      const dk = R() < 0.55;
      p.ellipse(
        R() * 64,
        R() * 64,
        2.4 + R() * 1.4,
        1.2 + R() * 0.6,
        R() * Math.PI,
        dk ? DARK : LIGHT,
        dk ? 0.18 : 0.16,
      );
    }
  },
  rinde: (p, R) => {
    for (let i = 0; i < 12; i++) {
      const px = i * 5.3 + R() * 2;
      const dk = R() < 0.6;
      const w = 0.9 + R() * 0.7;
      const pts: Pt[] = [[px, 0]];
      for (let y = 8; y < 64; y += 8) pts.push([px + (R() - 0.5) * 2, y]);
      pts.push([px, 64]); // endet, wo sie anfängt: nahtlos nach oben und unten
      p.line(pts, w, dk ? DARK : LIGHT, dk ? 0.32 : 0.14);
    }
  },
  // Eisblöcke im Verband: Fugen alle 16 Einheiten, versetzt je Reihe
  eisblock: (p) => {
    for (let r = 0; r < 4; r++) {
      p.line(
        [
          [0, r * 16],
          [64, r * 16],
        ],
        0.9,
        DARK,
        0.2,
      );
      for (let c = (r % 2) * 16; c < 64; c += 32)
        p.line(
          [
            [c, r * 16],
            [c, r * 16 + 16],
          ],
          0.9,
          DARK,
          0.2,
        );
    }
  },
};

/** Zufallsfolge (mulberry32) als Funktion */
function stream(seed: number): () => number {
  let s = seed;
  return () => {
    const [r, next] = nextRandom(s);
    s = next;
    return r;
  };
}

/** Eine Kachel eines Musters als RGBA (Grau, gerade Deckkraft), `size` × `size` Pixel */
export function skinPixels(skin: Skin, size = 64): Uint8ClampedArray {
  const r = new GrayRaster(size);
  DRAW[skin](new Pen(r), stream(SEED[skin]));
  const out = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const g = Math.round(r.gray[i]! * 255);
    out[i * 4] = g;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = g;
    out[i * 4 + 3] = Math.round(r.alpha[i]! * 255);
  }
  return out;
}

/** Stelle eines Musters im Atlas (Spalte, Zeile) */
export const SKIN_COLS = 4;
export const skinCell = (skin: Skin): [number, number] => {
  const i = SKINS.indexOf(skin);
  return [i % SKIN_COLS, Math.floor(i / SKIN_COLS)];
};

/** Alle Muster in einem Atlas aus `cols` × `rows` Kacheln zu je `size` Pixeln (Zeile 0 oben), RGBA */
export function skinAtlas(size = 64): { pixels: Uint8ClampedArray; cols: number; rows: number; size: number } {
  const cols = SKIN_COLS,
    rows = Math.ceil(SKINS.length / cols);
  const width = cols * size;
  const pixels = new Uint8ClampedArray(width * rows * size * 4);
  for (const skin of SKINS) {
    const tile = skinPixels(skin, size);
    const [c, r] = skinCell(skin);
    for (let y = 0; y < size; y++)
      pixels.set(tile.subarray(y * size * 4, (y + 1) * size * 4), ((r * size + y) * width + c * size) * 4);
  }
  return { pixels, cols, rows, size };
}
