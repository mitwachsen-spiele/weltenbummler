// Feine Dinge in der 2D-Ansicht (Entwurf „Feine Grafik“, `faceOverlay`): Muster je Material und Verlauf über jede
// Fläche eines Quaders, weicher Fleck unter Körpern und Dingen (`contactShadow`), weicher Schatten am Boden neben
// höheren Blöcken (`edgeShade`, zusätzlich zu den Kanten der Spec „Höhen“) und ein Bild-Cache für Dinge und Modelle
// (`Sprites`): Ein Baum aus 15–25 Quadern wird einmal je Maßstab gezeichnet, danach nur noch als Bild gesetzt.
// Gelände bleibt Block (frontBlock, flache Böden): Das hier malt nur Dinge. Kein Three.js.
// Spezifikation: docs/specs/mitwachsen.md (Feinheit)

import {
  TILE_W,
  paintWith,
  projection,
  type FaceRect,
  type Fine,
  type FinePainter,
  type HaloAt,
  type Part,
  type Projection,
} from '../../lib/games/front';
import {
  CONTACT_KNEE,
  CONTACT_MID,
  EDGE_STRIP,
  contactAlpha,
  contactRadius,
  faceShade,
  groundEdges,
  haloCompact,
  type GroundEdge,
} from '../../lib/games/shade';
import { SKIN_PERIOD, skinPixels, type Skin } from '../../lib/games/skins';
import type { Box, Spot } from './mitwachsen-view';

/** Leuchten mit Kennung (für die Auswahl mit Hysterese im Leuchten-Durchgang) */
export type Halo = HaloAt & { readonly id: string };

const SKIN_PX = 64;
const TILES = new Map<Skin, HTMLCanvasElement>();
/** Kachel eines Musters als Bild (einmal je Seite gezeichnet) */
function tile(skin: Skin): HTMLCanvasElement {
  let c = TILES.get(skin);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = SKIN_PX;
    const img = c.getContext('2d')!.createImageData(SKIN_PX, SKIN_PX);
    img.data.set(skinPixels(skin, SKIN_PX));
    c.getContext('2d')!.putImageData(img, 0, 0);
    TILES.set(skin, c);
  }
  return c;
}

type Fills = { patterns: Map<Skin, CanvasPattern | null>; shades: Map<string, CanvasGradient> };
const FILLS = new WeakMap<CanvasRenderingContext2D, Fills>();
function fills(ctx: CanvasRenderingContext2D): Fills {
  let f = FILLS.get(ctx);
  if (!f) FILLS.set(ctx, (f = { patterns: new Map(), shades: new Map() }));
  return f;
}

/**
 * Muster je Kontext und Material: eine Kachel ist `SKIN_PERIOD` Felder groß. Gezeichnet wird in Flächen-Einheiten
 * (Feldern), also bleibt das Muster bei jedem Maßstab gleich dicht und wandert nicht mit der Kamera
 */
function pattern(ctx: CanvasRenderingContext2D, skin: Skin): CanvasPattern | null {
  const f = fills(ctx);
  if (!f.patterns.has(skin)) {
    const p = ctx.createPattern(tile(skin), 'repeat');
    p?.setTransform(new DOMMatrix().scale(SKIN_PERIOD[skin] / SKIN_PX));
    f.patterns.set(skin, p);
  }
  return f.patterns.get(skin) ?? null;
}

/** Verlauf einer Fläche in Einheitskoordinaten (0 … 1 von oben nach unten): einer je Kontext, Seite und Leuchten */
function shade(ctx: CanvasRenderingContext2D, side: boolean, halo: boolean): CanvasGradient {
  const f = fills(ctx);
  const key = `${+side}${+halo}`;
  let g = f.shades.get(key);
  if (!g) {
    const [a, b] = faceShade(side, halo);
    g = ctx.createLinearGradient(0, 0, 0, 1);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    f.shades.set(key, g);
  }
  return g;
}

/** Kennung eines Leuchtens: die mitgegebene, sonst aus seiner Lage (gleich in jedem Bild, solange es nicht wandert) */
const haloId = (h: HaloAt) => h.id ?? `${h.x.toFixed(2)},${h.y.toFixed(2)},${h.z.toFixed(2)}`;

/** Muster (wenn `skins`) und Verlauf über eine schon gefüllte Fläche */
function overlay(ctx: CanvasRenderingContext2D, f: FaceRect, fine: Fine | undefined, skins: boolean) {
  if (f.lu < 1e-4 || f.lv < 1e-4 || Math.abs(f.w) < 0.5 || Math.abs(f.h) < 0.5) return;
  ctx.save();
  ctx.transform(f.w / f.lu, 0, 0, f.h / f.lv, f.x, f.y); // Einheiten der Fläche (Felder)
  const p = skins && fine?.skin ? pattern(ctx, fine.skin) : null;
  if (p) {
    ctx.fillStyle = p;
    ctx.fillRect(0, 0, f.lu, f.lv);
  }
  ctx.scale(f.lu, f.lv);
  ctx.fillStyle = shade(ctx, f.side, !!fine?.halo);
  ctx.fillRect(0, 0, 1, 1);
  ctx.restore();
}

/**
 * Maler in Symbolgröße (Tiere der Leiste unten): nur Verlauf und Oberkante, kein Muster (es wäre dort nur Rauschen) und
 * kein Leuchten
 */
export const ICON_PAINTER: FinePainter = { face: (ctx, f, fine) => overlay(ctx, f, fine, false) };

/**
 * Maler der feinen Dinge in 2D: Muster und Verlauf je Fläche (die helle Oberkante zieht `box` selbst), Leuchten werden
 * gesammelt und nach der Welt in einem Durchgang gezeichnet (mitwachsen-halo.ts)
 */
export class Fine2D implements FinePainter {
  halos: Halo[] = [];

  face(ctx: CanvasRenderingContext2D, f: FaceRect, fine: Fine | undefined) {
    overlay(ctx, f, fine, true);
  }

  halo(at: HaloAt) {
    this.halos.push({ ...at, id: haloId(at) });
  }

  /** Die gesammelten Leuchten dieses Bilds (und von vorn sammeln) */
  take(): Halo[] {
    const out = this.halos;
    this.halos = [];
    return out;
  }
}

/**
 * Leuchten eines Quaders, der scharf (ohne Maler) gezeichnet wird – Art `'glow'`, etwa die Kuppe eines wachen
 * Leuchtpilzes –, beim Maler `pen` melden wie `box` es mit Maler täte: nur mit `halo` und nur kompakt
 */
export function glowHalo(pen: Pick<FinePainter, 'halo'>, [x, y, z, w, d, h, color, , , fine]: Box) {
  if (fine?.halo && haloCompact(w, d, h))
    pen.halo?.({ x: x + w / 2, y: y + d / 2, z: z + h / 2, size: Math.max(w, d, h), color });
}

// ---------- Weicher Fleck ----------

/**
 * Weicher runder Fleck auf dem Boden unter einem Körper oder Ding (Mitte cx, cy auf Höhe z), `foot` Halbbreite in
 * Feldern (oder quer und tief, dann oval); beim Hüpfen (`lift`, Ebenen) kleiner und blasser, bei reduzierter Bewegung in
 * Stufen
 */
export function contactShadow(
  ctx: CanvasRenderingContext2D,
  P: Projection,
  cx: number,
  cy: number,
  z: number,
  foot: number | readonly [number, number],
  lift = 0,
  reduced = false,
) {
  const [across, deep] = typeof foot === 'number' ? [foot, foot] : foot;
  const r = contactRadius(across, lift, reduced);
  const [sx, sy] = P(cx, cy, z);
  const rx = Math.abs(P(cx + r, cy, z)[0] - sx);
  const ry = Math.abs(P(cx, cy + (r * deep) / across, z)[1] - sy);
  if (rx < 0.5 || ry < 0.5) return;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  const a = contactAlpha(lift, reduced);
  g.addColorStop(0, `rgba(29,40,56,${a.toFixed(3)})`);
  g.addColorStop(CONTACT_KNEE, `rgba(29,40,56,${(a * CONTACT_MID).toFixed(3)})`);
  g.addColorStop(1, 'rgba(29,40,56,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Reihen (y), über die der Fleck eines Dings reicht: von der hintersten bis zur vordersten */
export function spotRows([, cy, , across, deep]: Spot): [number, number] {
  const r = (contactRadius(across) * deep) / across;
  return [Math.floor(cy - r), Math.ceil(cy + r) - 1];
}

/**
 * Flecken, die über mehrere Reihen reichen (Iglu): In jeder Reihe wird nach ihrem Boden nur der Streifen dieser Reihe
 * gezeichnet, so deckt der Boden davor ihn nicht zu und er legt sich nicht über Dinge dahinter. Ein Fleck in einer Reihe
 * wird gleich ganz gezeichnet (wie unter Bäumen)
 */
export class FootSpots {
  private list: { spot: Spot; last: number }[] = [];

  begin() {
    this.list = [];
  }

  /** Fleck eines Dings in Reihe `y` (beim Zeichnen der Dinge dieser Reihe, nach ihrem Boden) */
  place(ctx: CanvasRenderingContext2D, P: Projection, spot: Spot, y: number) {
    const [, last] = spotRows(spot);
    if (last <= y) return void contactShadow(ctx, P, spot[0], spot[1], spot[2], [spot[3], spot[4]]);
    stripe(ctx, P, spot, y);
    this.list.push({ spot, last });
  }

  /** Streifen der Flecken in Reihe `y`, nach ihrem Boden und vor ihren Dingen */
  row(ctx: CanvasRenderingContext2D, P: Projection, y: number) {
    for (const { spot, last } of this.list) if (y <= last) stripe(ctx, P, spot, y);
  }
}

/** Den Streifen des Flecks in Reihe `y` zeichnen (auf der Höhe des Flecks) */
function stripe(ctx: CanvasRenderingContext2D, P: Projection, spot: Spot, y: number) {
  const [cx, cy, z, across, deep] = spot;
  const top = P(cx, y, z)[1];
  const bottom = P(cx, y + 1, z)[1];
  ctx.save();
  ctx.beginPath();
  ctx.rect(-1e5, top, 2e5, bottom - top);
  ctx.clip();
  contactShadow(ctx, P, cx, cy, z, [across, deep]);
  ctx.restore();
}

// ---------- Weicher Schatten am Boden ----------

/** Streifen von der Kante nach innen: [Kante, innen] als Punkte auf der Oberseite (Felder), quer dazu ganz breit */
export function edgeStrip(x: number, y: number, [dx, dy]: GroundEdge): [[number, number], [number, number]] {
  const cx = x + 0.5 + 0.5 * dx,
    cy = y + 0.5 + 0.5 * dy;
  return [
    [cx, cy],
    [cx - EDGE_STRIP.depth * dx, cy - EDGE_STRIP.depth * dy],
  ];
}

/**
 * Weicher Schatten auf der Oberseite des Felds (x, y) an jeder Kante, hinter der ein höherer Block steht (`groundEdges`):
 * ein Verlauf von der Kante nach innen. Die Blöcke selbst (Textur, Kacheln, Form) bleiben, wie sie sind
 */
export function edgeShade(
  ctx: CanvasRenderingContext2D,
  P: Projection,
  heightAt: (x: number, y: number) => number | null,
  x: number,
  y: number,
) {
  const h = heightAt(x, y);
  if (h === null) return;
  for (const e of groundEdges(heightAt, x, y)) {
    const [[ex, ey], [ix, iy]] = edgeStrip(x, y, e);
    const [ax, ay] = P(ex, ey, h);
    const [bx, by] = P(ix, iy, h);
    const g = ctx.createLinearGradient(ax, ay, bx, by);
    g.addColorStop(0, `rgba(${EDGE_STRIP.rgb},${EDGE_STRIP.alpha})`);
    g.addColorStop(1, `rgba(${EDGE_STRIP.rgb},0)`);
    const [lx, ly] = P(x, y, h);
    const [rx, ry] = P(x + 1, y + 1, h);
    const [sx0, sx1] = e[0] ? [Math.min(ax, bx), Math.max(ax, bx)] : [lx, rx];
    const [sy0, sy1] = e[1] ? [Math.min(ay, by), Math.max(ay, by)] : [ly, ry];
    ctx.fillStyle = g;
    ctx.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
  }
}

// ---------- Bild-Cache ----------

/** Ausdehnung eines Bilds um seinen Ankerpunkt, in Feldern: links, rechts, hinten, vorn, unten, oben */
export type Extent = readonly [number, number, number, number, number, number];

type Sprite = { canvas: HTMLCanvasElement; ox: number; oy: number; halos: HaloAt[]; scale: number; frame: number };

/**
 * Höchstens so viele Bilder (danach fliegt das am längsten ungenutzte raus). Bilder des laufenden Bilds bleiben: zeigt der
 * Schirm mehr Dinge (4K, Ultrawide), wächst der Cache für dieses Bild darüber, statt jedes Bild neu zu zeichnen
 */
export const SPRITE_LIMIT = 480;
/**
 * Höchstens so viele Geräte-Pixel in allen Bildern zusammen (24 MPx, rund 96 MB): Safari auf dem iPad begrenzt den
 * Speicher aller Canvases, darüber blieben neue leer. Ein Laubbaum bei dpr 2 und Zoom 1,25 hat etwa 0,09 MPx
 */
export const SPRITE_PIXELS = 24e6;

/**
 * Bild-Cache der feinen Dinge: je Schlüssel (Ding und Maßstab) einmal mit dem Maler auf ein eigenes Canvas gezeichnet,
 * danach nur noch gesetzt. Leuchten werden beim Zeichnen gemerkt und bei jedem Setzen (verschoben) wieder gemeldet
 */
export class Sprites {
  private readonly map = new Map<string, Sprite>();
  private dpr = 1;
  private world: unknown = null;
  private pixels = 0;
  private frame = 0;
  constructor(
    private readonly limit = SPRITE_LIMIT,
    private readonly maxPixels = SPRITE_PIXELS,
  ) {}

  get size() {
    return this.map.size;
  }

  /** Geräte-Pixel aller Bilder im Cache */
  get area() {
    return this.pixels;
  }

  /** Zu Beginn eines Bilds: Geräte-Pixel je CSS-Pixel aus dem Kontext; eine neue Welt leert den Cache */
  begin(ctx: CanvasRenderingContext2D, world: unknown) {
    this.frame++;
    this.dpr = ctx.getTransform?.().a || 1;
    if (world !== this.world) while (this.map.size) this.drop();
    this.world = world;
  }

  /**
   * Bild `key` am Anker (x, y, z) setzen; fehlt es, mit `paint(ctx, P)` zeichnen (in Weltkoordinaten relativ zum Anker:
   * `P(x + dx, …)`), `extent` umfasst alles, was `paint` zeichnet. `pen` sammelt die Leuchten; ohne `pen` meldet das
   * Bild keine (ein zweites Setzen desselben Dings, etwa die halb durchsichtige Figur obenauf, leuchtet nicht doppelt)
   */
  draw(
    ctx: CanvasRenderingContext2D,
    P: Projection,
    key: string,
    at: readonly [number, number, number],
    extent: Extent,
    paint: (c: CanvasRenderingContext2D, P: Projection, pen: Fine2D) => void,
    pen: Fine2D | null,
  ) {
    const px = Math.abs(P(1, 0, 0)[0] - P(0, 0, 0)[0]) / TILE_W; // Maßstab in CSS-Pixeln
    const dpr = this.dpr;
    const scale = px * dpr;
    const id = `${key}|${scale.toFixed(3)}`;
    let s = this.map.get(id);
    if (s) {
      this.map.delete(id); // zuletzt benutzt nach hinten
      this.map.set(id, s);
    } else {
      s = render(at, extent, scale, paint);
      this.map.set(id, s);
      this.pixels += s.canvas.width * s.canvas.height;
      while (this.map.size > 1 && (this.pixels > this.maxPixels || (this.map.size > this.limit && this.stale())))
        this.drop();
    }
    s.frame = this.frame;
    const [sx, sy] = P(...at);
    ctx.drawImage(s.canvas, sx - s.ox / dpr, sy - s.oy / dpr, s.canvas.width / dpr, s.canvas.height / dpr);
    if (pen) for (const h of s.halos) pen.halo({ ...h, x: h.x + at[0], y: h.y + at[1], z: h.z + at[2] });
  }

  /** Das am längsten ungenutzte Bild stammt aus einem früheren Bild (sonst wäre es im laufenden schon gebraucht) */
  private stale() {
    return this.map.values().next().value!.frame < this.frame;
  }

  /** Das am längsten ungenutzte Bild entfernen und seinen Speicher sofort freigeben (Safari wartet sonst lange) */
  private drop() {
    const [id, s] = this.map.entries().next().value!;
    this.map.delete(id);
    this.pixels -= s.canvas.width * s.canvas.height;
    s.canvas.width = s.canvas.height = 0;
  }
}

/** Ausdehnung eines Modells (Teile um seine Mitte, gedreht in jede Richtung) bei Größe `scale` */
export function modelExtent(parts: readonly Part[], scale: number): Extent {
  let r = 0,
    lo = 0,
    hi = 0;
  for (const [f, w, z, fl, rw, h] of parts) {
    r = Math.max(r, Math.abs(f), Math.abs(f + fl), Math.abs(w), Math.abs(w + rw));
    lo = Math.min(lo, z);
    hi = Math.max(hi, z + h);
  }
  const R = r * scale + 0.05;
  return [R, R, R, R, -lo * scale + 0.05, hi * scale + 0.05];
}

/** Ausdehnung von Quadern um den Anker (x, y, z) */
export function boxesExtent(boxes: readonly Box[], [x, y, z]: readonly [number, number, number]): Extent {
  let [l, r, b, f, d, u] = [0, 0, 0, 0, 0, 0];
  for (const [bx, by, bz, w, dd, h] of boxes) {
    l = Math.max(l, x - bx);
    r = Math.max(r, bx + w - x);
    b = Math.max(b, y - by);
    f = Math.max(f, by + dd - y);
    d = Math.max(d, z - bz);
    u = Math.max(u, bz + h - z);
  }
  return [l, r, b, f, d, u];
}

/** Ein Bild zeichnen: Projektion mit dem Anker im Ursprung (plus Rand), Maßstab in Geräte-Pixeln */
function render(
  at: readonly [number, number, number],
  [l, r, b, f, d, u]: Extent,
  scale: number,
  paint: (c: CanvasRenderingContext2D, P: Projection, pen: Fine2D) => void,
): Sprite {
  const base = projection(0, 0, 0, 0, scale);
  const [left] = base(-l, 0, 0);
  const [right] = base(r, 0, 0);
  const top = base(0, -b, u)[1];
  const bottom = base(0, f, -d)[1];
  const pad = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(right - left) + 2 * pad);
  canvas.height = Math.max(1, Math.ceil(bottom - top) + 2 * pad);
  const ox = pad - left,
    oy = pad - top;
  const P: Projection = (x, y, z) => {
    const [px, py] = base(x - at[0], y - at[1], z - at[2]);
    return [px + ox, py + oy];
  };
  const c = canvas.getContext('2d')!;
  const pen = new Fine2D();
  paintWith(c, pen);
  paint(c, P, pen);
  const halos = pen.take().map((h) => ({ ...h, x: h.x - at[0], y: h.y - at[1], z: h.z - at[2] }));
  return { canvas, ox, oy, halos, scale, frame: 0 };
}
