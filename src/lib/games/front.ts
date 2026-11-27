// Ansicht von vorn: Jeder Block zeigt Oberseite und Vorderseite, die Gitterachsen liegen waagerecht (x) und
// senkrecht (y). Anders als die 2:1-Dimetrie der Würfel-Grafik (cube.ts) laufen Pfeiltasten hier in Bildschirmrichtung.
// Höhe z zählt in Ebenen; die Oberkante eines Blocks auf Ebene k liegt bei z = k + 1.

import type { Grid, Palette } from '../voxel/textures';
import { hash } from './rng';
import { edgeAlpha, edgeVisible, edgeWidth, haloCompact } from './shade';
import type { Skin } from './skins';

export const TILE_W = 64; // Breite eines Feldes
export const TILE_D = 44; // Tiefe der Oberseite (verkürzt)
export const LEVEL_H = 40; // Höhe einer Ebene (Vorderseite)

/** Bildschirmpunkt eines Weltpunkts. Kamera: Weltpunkt (camX, camY), der bei (originX, originY) erscheint. */
export type Projection = (x: number, y: number, z: number) => [number, number];
export const projection =
  (camX: number, camY: number, originX: number, originY: number, scale = 1): Projection =>
  (x, y, z) => [originX + (x - camX) * TILE_W * scale, originY + ((y - camY) * TILE_D - z * LEVEL_H) * scale];

/** Feld unter einem Bildschirmpunkt auf Höhe z (Umkehrung der Projektion) */
export const cellAt = (
  sx: number,
  sy: number,
  z: number,
  camX: number,
  camY: number,
  originX: number,
  originY: number,
  scale = 1,
): [number, number] => [
  Math.floor((sx - originX) / (TILE_W * scale) + camX),
  Math.floor(((sy - originY) / scale + z * LEVEL_H) / TILE_D + camY),
];

/** Textur-Raster auf eine Fläche malen: Jede Farbschicht [Farbe, Deckkraft] einzeln (wie render.ts) */
function paint(ctx: CanvasRenderingContext2D, grid: Grid, pal: Palette) {
  for (const [r, row] of grid.entries())
    for (const [c, ch] of [...row].entries()) {
      for (const [color, alpha] of pal[ch] ?? []) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fillRect(c, r, 1.03, 1.03); // leicht überlappen, sonst blitzen Fugen durch
      }
    }
  ctx.globalAlpha = 1;
}

/**
 * Feine Körnung: Jedes Texel wird in 2 × 2 Unterpixel geteilt, die leicht heller oder dunkler sind. Die Farben
 * der 8 × 8-Texturen bleiben, die Fläche wirkt aber doppelt so fein aufgelöst.
 */
function grain(ctx: CanvasRenderingContext2D, n: number, seed: number, strength: number) {
  for (let r = 0; r < n * 2; r++)
    for (let c = 0; c < n * 2; c++) {
      const v = hash(seed, c, r) / 4294967296 - 0.5;
      ctx.fillStyle =
        v > 0 ? `rgba(255,255,255,${(v * strength).toFixed(3)})` : `rgba(0,0,0,${(-v * strength).toFixed(3)})`;
      ctx.fillRect(c / 2, r / 2, 0.5, 0.5);
    }
}

/** Block als Bild: Oberseite TILE_W × TILE_D, darunter Vorderseite TILE_W × LEVEL_H, mit Hausschattierung */
export function frontBlock(top: Grid, front: Grid, pal: Palette, res = 2, strength = 0.16): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_W * res;
  canvas.height = (TILE_D + LEVEL_H) * res;
  const ctx = canvas.getContext('2d')!;
  const n = top.length;
  ctx.setTransform((res * TILE_W) / n, 0, 0, (res * TILE_D) / n, 0, 0);
  paint(ctx, top, pal);
  grain(ctx, n, top.join('').length + 1, strength);
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  ctx.fillRect(0, 0, n, n);
  ctx.setTransform((res * TILE_W) / n, 0, 0, (res * LEVEL_H) / n, 0, res * TILE_D);
  paint(ctx, front, pal);
  grain(ctx, n, front.join('').length + 7, strength);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.fillRect(0, 0, n, n);
  return canvas;
}

// ---------- Modelle aus Quadern ----------

/** Blickrichtung: e = +x (rechts), w = −x, s = +y (zur Kamera), n = −y */
export type Dir = 'n' | 's' | 'e' | 'w';
export const DIRS: Record<Dir, [number, number]> = { e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] };
// Rechte Hand der Figur, wenn sie in Richtung d schaut
const RIGHT: Record<Dir, [number, number]> = { e: [0, 1], w: [0, -1], s: [-1, 0], n: [1, 0] };

/**
 * Feinheit eines Teils (Entwurf „Feine Grafik“): Muster der Oberfläche (`skin`) und ob es als kompaktes Teil leuchtet
 * (`halo`: Lampe, Kristall, Pilz; hat nichts mit der Art `'glow'` des Polarlichts zu tun). Verlauf und helle Oberkante
 * bekommt jedes Ding ohnehin, sobald ein `FinePainter` zeichnet.
 */
export type Fine = { readonly skin?: Skin; readonly halo?: true };

/**
 * Teil eines Modells, in Zellen relativ zur Mitte des Modells: [vorn, rechts, unten, Länge, Breite, Höhe, Farbe,
 * Farbe der Oberseite?, Fläche?, Feinheit?]. „Fläche“ markiert Augen: Sie werden nur gezeichnet, wenn ihre Fläche
 * (vorn, rechts oder links) zur Kamera zeigt – sonst schimmerten sie durch den Kopf.
 */
export type Part = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  string,
  (string | null)?,
  ('f' | 'r' | 'l')?,
  Fine?,
];

/** Fläche eines Quaders auf dem Bild (Pixel) samt ihrer Größe in Feldern: u waagerecht, v von oben nach unten */
export type FaceRect = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly lu: number;
  readonly lv: number;
  /** Seite (Vorderseite) statt Oberseite */
  readonly side: boolean;
};

/**
 * Leuchten eines kompakten Teils: Mitte in der Welt (x rechts, y nach vorn, z Höhe), größte Kante in Feldern, Farbe;
 * `id` feste Kennung für Teile, die sich bewegen (sonst kennt die Ansicht es an seiner Lage)
 */
export type HaloAt = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  size: number;
  color: string;
  readonly id?: string;
};

/**
 * Maler der feinen Dinge, hereingereicht von der Ansicht (die Muster liegen dort, `lib` kennt keinen Browser-Code):
 * `face` legt Muster und Verlauf über eine schon gefüllte Fläche, `halo` merkt sich das Leuchten eines kompakten
 * Teils (Mitte in der Welt, Größe, Farbe), das die Ansicht später in einem eigenen Durchgang zeichnet.
 */
export interface FinePainter {
  face(ctx: CanvasRenderingContext2D, face: FaceRect, fine: Fine | undefined): void;
  halo?(at: HaloAt): void;
}

const PAINTERS = new WeakMap<CanvasRenderingContext2D, FinePainter>();
/**
 * Maler für alles, was ab jetzt auf `ctx` gezeichnet wird, ohne dass der Aufruf selbst einen mitgibt (`box` ohne
 * `painter`); `null` nimmt ihn wieder weg. So malt die Ansicht die Dinge ihrer Welt fein, ohne jede Zeichnung zu kennen.
 */
export function paintWith(ctx: CanvasRenderingContext2D, painter: FinePainter | null) {
  if (painter) PAINTERS.set(ctx, painter);
  else PAINTERS.delete(ctx);
}
/** Der Maler, der gerade auf `ctx` malt (undefined: flach) */
export const painterOf = (ctx: CanvasRenderingContext2D): FinePainter | undefined => PAINTERS.get(ctx);

/**
 * Quader von vorn: Oberseite und Vorderseite. Ohne Maler flach wie immer; mit ihm fein (Muster und Verlauf je Fläche,
 * helle Oberkante, Leuchten kompakter Teile mit `halo`). `painter` undefined: der Maler des Kontexts (`paintWith`),
 * null: flach (Gelände, Böden, Torhäuser bleiben Block).
 */
export function box(
  ctx: CanvasRenderingContext2D,
  P: Projection,
  x0: number,
  y0: number,
  z0: number,
  w: number,
  d: number,
  h: number,
  color: string,
  top?: string | null,
  fine?: Fine,
  painter?: FinePainter | null,
) {
  const pen = painter === undefined ? PAINTERS.get(ctx) : (painter ?? undefined);
  const [ax, ay] = P(x0, y0, z0 + h);
  const [bx, by] = P(x0 + w, y0 + d, z0 + h);
  const [, cy] = P(x0, y0 + d, z0);
  ctx.fillStyle = top ?? color;
  ctx.fillRect(ax, ay, bx - ax, by - ay);
  if (!pen) {
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    ctx.fillRect(ax, ay, bx - ax, by - ay);
    ctx.fillStyle = color;
    ctx.fillRect(ax, by, bx - ax, cy - by);
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.fillRect(ax, by, bx - ax, cy - by);
    return;
  }
  pen.face(ctx, { x: ax, y: ay, w: bx - ax, h: by - ay, lu: w, lv: d, side: false }, fine);
  ctx.fillStyle = color;
  ctx.fillRect(ax, by, bx - ax, cy - by);
  pen.face(ctx, { x: ax, y: by, w: bx - ax, h: cy - by, lu: w, lv: h, side: true }, fine);
  if (edgeVisible(w, d, h)) {
    // Maßstab am Quader selbst: in der Perspektive über 3D (Fledermaus, Olm) liegt der Ursprung weit weg von der Kamera
    const scale = Math.abs(P(x0 + 1, y0, z0 + h)[0] - ax) / TILE_W;
    ctx.strokeStyle = `rgba(255,255,255,${edgeAlpha(fine?.halo)})`;
    ctx.lineWidth = edgeWidth(scale);
    ctx.strokeRect(ax, ay, bx - ax, by - ay);
  }
  if (fine?.halo && pen.halo && haloCompact(w, d, h))
    pen.halo({ x: x0 + w / 2, y: y0 + d / 2, z: z0 + h / 2, size: Math.max(w, d, h), color });
}

/**
 * Modell an (cx, cy) auf Höhe z zeichnen, gedreht in Richtung dir. `mono` färbt alles ein (Umriss, bleibt scharf:
 * ohne Muster und Verlauf). `painter` zeichnet die Teile fein (undefined: der Maler des Kontexts, null: flach).
 */
export function drawModel(
  ctx: CanvasRenderingContext2D,
  P: Projection,
  parts: readonly Part[],
  cx: number,
  cy: number,
  z: number,
  dir: Dir,
  scale = 1,
  mono?: string,
  painter?: FinePainter | null,
) {
  const [fx, fy] = DIRS[dir];
  const [rx, ry] = RIGHT[dir];
  const boxes: {
    x: number;
    y: number;
    z: number;
    w: number;
    d: number;
    h: number;
    c: string;
    t?: string | null;
    fine?: Fine | undefined;
    k: number;
  }[] = [];
  for (const [f, r, zz, fl, rw, h, color, top, face, fine] of parts) {
    if (face) {
      const n = face === 'f' ? [fx, fy] : face === 'r' ? [rx, ry] : [-rx, -ry];
      if (n[1] !== 1) continue; // nur Flächen, die zur Kamera zeigen
    }
    const ax = cx + (fx * f + rx * r) * scale,
      ay = cy + (fy * f + ry * r) * scale;
    const bx = cx + (fx * (f + fl) + rx * (r + rw)) * scale,
      by = cy + (fy * (f + fl) + ry * (r + rw)) * scale;
    const x = Math.min(ax, bx),
      y = Math.min(ay, by),
      w = Math.abs(bx - ax),
      d = Math.abs(by - ay);
    const bz = z + zz * scale,
      bh = h * scale;
    // Von hinten nach vorn, dann von unten nach oben; Augen zuletzt
    boxes.push({
      x,
      y,
      z: bz,
      w,
      d,
      h: bh,
      c: mono ?? color,
      t: mono ?? top,
      fine,
      k: (y + d / 2) * 100 + bz + bh / 2 + (face ? 50 : 0),
    });
  }
  boxes.sort((a, b) => a.k - b.k);
  const pen = mono ? null : painter;
  for (const b of boxes) box(ctx, P, b.x, b.y, b.z, b.w, b.d, b.h, b.c, b.t, b.fine, pen);
}

/** Augenpaar für einen Kopf: vorn mittig sowie an beiden Seiten nahe der Vorderkante */
export function eyes(
  front: number,
  half: number,
  z: number,
  w: number,
  h: number,
  inset: number,
  color = '#1d2233',
): Part[] {
  const s = Math.min(w, h) * 0.4; // Glanzpunkt oben im Auge, damit es lebendig wirkt
  const shine = '#ffffff';
  return [
    [front - 0.02, inset, z, 0.03, w, h, color, null, 'f'],
    [front - 0.02, -inset - w, z, 0.03, w, h, color, null, 'f'],
    [front - 0.06 - w, half - 0.02, z, w, 0.03, h, color, null, 'r'],
    [front - 0.06 - w, -half - 0.01, z, w, 0.03, h, color, null, 'l'],
    [front - 0.015, inset + w - s, z + h - s, 0.035, s, s, shine, null, 'f'],
    [front - 0.015, -inset - w, z + h - s, 0.035, s, s, shine, null, 'f'],
    [front - 0.06 - s, half - 0.015, z + h - s, s, 0.035, s, shine, null, 'r'],
    [front - 0.06 - s, -half - 0.02, z + h - s, s, 0.035, s, shine, null, 'l'],
  ];
}
