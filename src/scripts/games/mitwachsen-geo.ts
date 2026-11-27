// Bausteine der 3D-Ansicht: Textur-Atlas aus den 8 × 8-Rastern der Seite und ein Baukasten, der Quader und Flächen
// zu einer Geometrie zusammenfügt. Gehört zur 3D-Ansicht und wird nur mit ihr nachgeladen (Three.js).

import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Matrix4,
  NearestFilter,
  SRGBColorSpace,
  Vector3,
} from 'three';
import type { Fine, HaloAt } from '../../lib/games/front';
import { hash } from '../../lib/games/rng';
import { edgeAlpha, edgeVisible, haloCompact, vertexShade, type Corners } from '../../lib/games/shade';
import { SKINS, SKIN_PERIOD } from '../../lib/games/skins';
import {
  DIRT,
  GRASS_SIDE,
  GRASS_TOP,
  LEAVES,
  LOG_SIDE,
  LOG_TOP,
  PAL_GRASS,
  PAL_LOG,
  PAL_SHELF,
  PAL_STONE,
  PLANKS,
  STONE,
  type Grid,
  type Palette,
} from '../../lib/voxel/textures';

// ---------- Textur-Kacheln ----------

export type Tile =
  | 'grassTop'
  | 'grassSide'
  | 'dirt'
  | 'stone'
  | 'sand'
  | 'path'
  | 'leaves'
  | 'log'
  | 'logTop'
  | 'planks'
  | 'white'
  | 'lava'
  | 'ice'
  | 'cave'
  | 'water'
  // Welten hinter den Toren
  | 'snowTop'
  | 'snowSide'
  | 'basalt'
  | 'cloud'
  | 'mossTop'
  | 'mossSide'
  | 'sandstone'
  | 'fur'; // feine helle Körnung für Tiere und Figur (die Farbe kommt aus dem Modell)
const TILES: Tile[] = [
  'grassTop',
  'grassSide',
  'dirt',
  'stone',
  'sand',
  'path',
  'leaves',
  'log',
  'logTop',
  'planks',
  'white',
  'lava',
  'ice',
  'cave',
  'water',
  'snowTop',
  'snowSide',
  'basalt',
  'cloud',
  'mossTop',
  'mossSide',
  'sandstone',
  'fur',
];
const TPX = 16; // Pixel je Kachel: 8 × 8-Raster mit feiner Körnung in 2 × 2 Unterpixeln
const COLS = 4;
const PAL_SAND: Palette = { D: [['#e3cf95', 1]], d: [['#d4bd7d', 1]], e: [['#efdeaa', 1]] };
const PAL_PATH: Palette = { D: [['#c9a46e', 1]], d: [['#b48d58', 1]], e: [['#d8b783', 1]] };
// Themen-Blöcke auf den großen Toren
const PAL_LAVA: Palette = { D: [['#ff7a1a', 1]], d: [['#b8380a', 1]], e: [['#ffd34d', 1]] };
const PAL_ICE: Palette = { S: [['#bfe6f5', 1]], s: [['#a2d6ee', 1]], r: [['#f2fbff', 1]] };
const PAL_CAVE: Palette = { S: [['#3c3f47', 1]], s: [['#2a2c33', 1]], r: [['#5a5f70', 1]] };
const PAL_WATER: Palette = { D: [['#3f8fd8', 1]], d: [['#2f6fb8', 1]], e: [['#8cc6f0', 1]] };
// Böden der Welten hinter den Toren
const PAL_SNOW: Palette = {
  G: [['#f4f8fb', 1]],
  g: [['#e2ecf3', 1]],
  l: [['#ffffff', 1]],
  D: [['#9b6a43', 1]],
  d: [['#7d5232', 1]],
  e: [['#b27f53', 1]],
};
const PAL_BASALT: Palette = { S: [['#3a3b42', 1]], s: [['#2a2b30', 1]], r: [['#50525c', 1]] };
const PAL_CLOUD: Palette = { D: [['#fbfdff', 1]], d: [['#e6eef7', 1]], e: [['#ffffff', 1]] };
const PAL_MOSS: Palette = {
  G: [['#8a76cc', 1]],
  g: [['#7462b4', 1]],
  l: [['#a594e3', 1]],
  D: [['#6a4a3a', 1]],
  d: [['#56392c', 1]],
  e: [['#7f5a46', 1]],
};
const PAL_SANDSTONE: Palette = { A: [['#e2c78e', 1]], a: [['#d1b273', 1]], z: [['#b9965c', 1]] };
// Blätter in Grau: Die Baumart färbt sie über die Vertex-Farbe (grün, orange, rosa)
const PAL_LEAVES_GRAY: Palette = {
  F: [['#e6e6e6', 1]],
  f: [['#cccccc', 1]],
  k: [['#ffffff', 1]],
  q: [['#b4b4b4', 1]],
};
const SOURCES: Record<Tile, [Grid, Palette] | null> = {
  grassTop: [GRASS_TOP, PAL_GRASS],
  grassSide: [GRASS_SIDE, PAL_GRASS],
  dirt: [DIRT, PAL_GRASS],
  stone: [STONE, PAL_STONE],
  sand: [DIRT, PAL_SAND],
  path: [DIRT, PAL_PATH],
  leaves: [LEAVES, PAL_LEAVES_GRAY],
  log: [LOG_SIDE, PAL_LOG],
  logTop: [LOG_TOP, PAL_LOG],
  planks: [PLANKS, PAL_SHELF],
  white: null,
  lava: [DIRT, PAL_LAVA],
  ice: [STONE, PAL_ICE],
  cave: [STONE, PAL_CAVE],
  water: [DIRT, PAL_WATER],
  snowTop: [GRASS_TOP, PAL_SNOW],
  snowSide: [GRASS_SIDE, PAL_SNOW],
  basalt: [STONE, PAL_BASALT],
  cloud: [DIRT, PAL_CLOUD],
  mossTop: [GRASS_TOP, PAL_MOSS],
  mossSide: [GRASS_SIDE, PAL_MOSS],
  sandstone: [PLANKS, PAL_SANDSTONE],
  fur: [DIRT, { D: [['#ffffff', 1]], d: [['#ececec', 1]], e: [['#f6f6f6', 1]] }],
};

export function atlas(): CanvasTexture {
  const rows = Math.ceil(TILES.length / COLS);
  const canvas = document.createElement('canvas');
  canvas.width = COLS * TPX;
  canvas.height = rows * TPX;
  const ctx = canvas.getContext('2d')!;
  TILES.forEach((t, i) => {
    const ox = (i % COLS) * TPX,
      oy = Math.floor(i / COLS) * TPX;
    const src = SOURCES[t];
    if (!src) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox, oy, TPX, TPX);
      return;
    }
    const [grid, pal] = src;
    const px = TPX / grid.length;
    grid.forEach((row, r) => {
      for (const [c, ch] of [...row].entries())
        for (const [color, alpha] of pal[ch] ?? []) {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = color;
          ctx.fillRect(ox + c * px, oy + r * px, px, px);
        }
    });
    ctx.globalAlpha = 1;
    // feine Körnung wie in der 2D-Ansicht
    for (let r = 0; r < TPX; r++)
      for (let c = 0; c < TPX; c++) {
        const v = hash(i + 1, c, r) / 4294967296 - 0.5;
        ctx.fillStyle = v > 0 ? `rgba(255,255,255,${(v * 0.14).toFixed(3)})` : `rgba(0,0,0,${(-v * 0.14).toFixed(3)})`;
        ctx.fillRect(ox + c, oy + r, 1, 1);
      }
  });
  const tex = new CanvasTexture(canvas);
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

function tileUV(t: Tile): [number, number, number, number] {
  const i = TILES.indexOf(t);
  const rows = Math.ceil(TILES.length / COLS);
  const w = COLS * TPX,
    h = rows * TPX;
  const e = 0.02; // etwas nach innen, damit Nachbarkacheln nicht durchblitzen
  const x = (i % COLS) * TPX,
    y = Math.floor(i / COLS) * TPX;
  return [(x + e) / w, 1 - (y + TPX - e) / h, (x + TPX - e) / w, 1 - (y + e) / h];
}

// ---------- Geometrie aus Quadern und Flächen ----------

export type V3 = [number, number, number];
/** Farbe ohne Alphakanal: rgba(…) wird zu rgb(…), Three.js kennt in Vertex-Farben keine Deckkraft */
export const col = (c: string | Color) =>
  typeof c === 'string' ? new Color(c.replace(/^rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)$/, 'rgb($1,$2,$3)')) : c;

/**
 * Feinheit einer Fläche für den Shader der feinen Dinge (mitwachsen-fine-3d.ts): Größe in Feldern (u waagerecht entlang
 * a→b, v entlang a→d), Muster (`SKINS`-Stelle + 1, 0: keins) samt Kacheln je Feld, Deckkraft der hellen Kante (0: keine)
 */
type FaceFine = { w: number; h: number; skin: number; per: number; edge: number };

export class Geo {
  private pos: number[] = [];
  private nor: number[] = [];
  private uv: number[] = [];
  private rgb: number[] = [];
  private idx: number[] = [];
  private fineUv: number[] = [];
  private skin: number[] = [];
  private fine = false;
  /** Leuchten der kompakten Teile mit `halo` (Mitte in der Welt: x, y nach vorn, z Höhe), für den Leuchten-Durchgang */
  readonly halos: HaloAt[] = [];

  /**
   * Viereck a-b-c-d gegen den Uhrzeigersinn von außen gesehen; a-b unten, c-d oben. `corners`: Faktoren je Ecke auf die
   * Farbe (a, b, c, d; weicher Schatten am Boden), `face`: Feinheit der Fläche (nur Dinge, nie Gelände)
   */
  quad(
    a: V3,
    b: V3,
    c: V3,
    d: V3,
    n: V3,
    tile: Tile,
    color: Color,
    corners?: readonly [number, number, number, number],
    face?: FaceFine,
  ) {
    const base = this.pos.length / 3;
    const [u0, v0, u1, v1] = tileUV(tile);
    for (const p of [a, b, c, d]) this.pos.push(...p);
    for (let i = 0; i < 4; i++) {
      const k = corners?.[i] ?? 1;
      this.nor.push(...n);
      this.rgb.push(color.r * k, color.g * k, color.b * k);
    }
    this.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    // Feinheit je Ecke erst ab der ersten feinen Fläche (davor mit 0 aufgefüllt): Gelände trägt nichts davon
    if (face && !this.fine) {
      this.fine = true;
      this.fineUv = new Array<number>(base * 4).fill(0);
      this.skin = new Array<number>(base * 3).fill(0);
    }
    if (!this.fine) return;
    const { w = 0, h = 0, skin = 0, per = 0, edge = 0 } = face ?? {};
    this.fineUv.push(0, 0, w, h, w, 0, w, h, w, h, w, h, 0, h, w, h);
    for (let i = 0; i < 4; i++) this.skin.push(skin, edge, per);
  }

  /**
   * Quader (x, y = Höhe, z) mit Größe (w, h, d); Seiten und Oberseite einzeln einfärb- und texturierbar. Mit `fine` ein
   * feines Ding (Entwurf „Feine Grafik“): Seiten unten dunkler, Oberseite hinten heller (`vertexShade`), Muster je
   * Fläche, helle Oberkante, wenn er groß genug ist, und Leuchten kompakter Teile (`halos`). `scale`: Größe, in der das
   * Modell gezeigt wird (Muster und Kante gleich dicht wie bei Dingen in voller Größe)
   */
  box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    side: string | Color,
    top?: string | Color | null,
    tile: Tile = 'white',
    topTile?: Tile,
    fine?: Fine,
    scale = 1,
  ) {
    const s = col(side),
      t = col(top ?? side);
    const [x0, y0, z0, x1, y1, z1] = [x, y, z, x + w, y + h, z + d];
    const tt = topTile ?? tile;
    const f = fine && faceOf(fine, edgeVisible(w * scale, d * scale, h * scale));
    const v = vertexShade(fine?.halo);
    const sides = fine ? ([v.sideBottom, v.sideBottom, v.sideTop, v.sideTop] as const) : undefined;
    const tops = fine ? ([v.topFront, v.topFront, v.topBack, v.topBack] as const) : undefined;
    const at = (fw: number, fh: number, edge = false) =>
      f && { ...f, w: fw * scale, h: fh * scale, edge: edge ? f.edge : 0 };
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], tt, t, tops, at(w, d, true));
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], tile, s, sides, at(w, h));
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], tile, s, sides, at(w, h));
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], tile, s, sides, at(d, h));
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], tile, s, sides, at(d, h));
    if (fine?.halo && haloCompact(w * scale, d * scale, h * scale))
      this.halos.push({
        x: x + w / 2,
        y: z + d / 2,
        z: y + h / 2,
        size: Math.max(w, d, h),
        color: `#${s.getHexString()}`,
      });
  }

  get empty() {
    return this.idx.length === 0;
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(this.uv), 2));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.rgb), 3));
    // nur, wenn feine Dinge darin sind: Gelände und Torhäuser bleiben, wie sie sind
    if (this.fine) {
      g.setAttribute('aFine', new BufferAttribute(new Float32Array(this.fineUv), 4));
      g.setAttribute('aSkin', new BufferAttribute(new Float32Array(this.skin), 3));
    }
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

/** Feinheit der Flächen eines Quaders: Muster und Kacheln je Feld, Kante (nur an der Oberseite, wenn groß genug) */
function faceOf(fine: Fine, edge: boolean): FaceFine {
  const skin = fine.skin ? SKINS.indexOf(fine.skin) + 1 : 0;
  return {
    w: 0,
    h: 0,
    skin,
    per: fine.skin ? 1 / SKIN_PERIOD[fine.skin] : 0,
    edge: edge ? edgeAlpha(fine.halo) : 0,
  };
}

/** Faktoren der Ecken einer Bodenoberseite (`cornerShade`) in der Reihenfolge, in der `terrain` sie legt */
export const topCorners = (c: Corners): [number, number, number, number] => [c.x0y1, c.x1y1, c.x1y0, c.x0y0];

// ---------- Licht ----------

/**
 * Ziel der Sonne auf das Raster der Schattenkarte legen. Folgt die Schattenkamera der Figur stufenlos, verschiebt sich
 * ihr Raster in jedem Bild um Bruchteile eines Pixels, und Schattenkanten flimmern beim Laufen. Eingerastet bewegt sie
 * sich nur in ganzen Pixeln: Quer zum Licht wird gerundet, entlang des Lichts nicht (das ändert das Bild nicht).
 * `offset`: wo die Sonne vom Ziel aus steht; `texel`: Breite eines Pixels der Schattenkarte in Feldern.
 */
export function snapToShadowTexel(target: Vector3, offset: Vector3, texel: number): Vector3 {
  const basis = new Matrix4().lookAt(offset, new Vector3(), new Vector3(0, 1, 0));
  const right = new Vector3().setFromMatrixColumn(basis, 0);
  const up = new Vector3().setFromMatrixColumn(basis, 1);
  const along = new Vector3().setFromMatrixColumn(basis, 2);
  const snap = (v: number) => Math.round(v / texel) * texel;
  return right
    .multiplyScalar(snap(target.dot(right)))
    .add(up.multiplyScalar(snap(target.dot(up))))
    .add(along.multiplyScalar(target.dot(along)));
}
