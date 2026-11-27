// Kleines Graustufen-Raster ohne Canvas: Linien, Ellipsen, Rechtecke und Verläufe in Grau mit Deckkraft, mit
// Kantenglättung über die Pixelabdeckung. Alles wird um den Rand herumgelegt (Torus), damit ein Muster nahtlos kachelt.
// Rein und deterministisch: Die Muster der feinen Oberflächen (skins.ts) entstehen damit gleich in Node und Browser.

/** Graustufen-Raster: je Pixel Helligkeit (0 schwarz … 1 weiß) und Deckkraft (0 … 1) */
export class GrayRaster {
  readonly size: number;
  readonly gray: Float32Array;
  readonly alpha: Float32Array;

  constructor(size: number) {
    this.size = size;
    this.gray = new Float32Array(size * size);
    this.alpha = new Float32Array(size * size);
  }

  /** Ein Pixel (um den Rand herum) mit Grau g und Deckkraft a übermalen (source-over) */
  blend(px: number, py: number, g: number, a: number) {
    this.blendAt(this.index(px, py), g, a);
  }

  /** Stelle des Pixels (px, py) in den Feldern, um den Rand herumgelegt */
  private index(px: number, py: number) {
    const n = this.size;
    return (((py % n) + n) % n) * n + (((px % n) + n) % n);
  }

  private blendAt(i: number, g: number, a: number) {
    if (a <= 0) return;
    const da = this.alpha[i]!;
    const out = a + da * (1 - a);
    this.gray[i] = (g * a + this.gray[i]! * da * (1 - a)) / out;
    this.alpha[i] = out;
  }

  /**
   * Für jedes Pixel im Rechteck [x0, x1) × [y0, y1) (Pixelkoordinaten) die Mitte an `f` geben: [Grau, Deckkraft]. Reicht
   * die Form über den Rand hinaus, treffen mehrere Mitten dasselbe Pixel (Torus): Dann zählt die stärkste Abdeckung,
   * einmal gemischt. Sonst läge an der Naht ein dunklerer Streifen: Eine Linie von 0 bis zur Kachelgröße deckte ihre
   * Enden doppelt.
   */
  each(x0: number, y0: number, x1: number, y1: number, f: (cx: number, cy: number) => readonly [number, number]) {
    const hit = new Map<number, readonly [number, number]>();
    for (let py = Math.floor(y0); py < Math.ceil(y1); py++)
      for (let px = Math.floor(x0); px < Math.ceil(x1); px++) {
        const v = f(px + 0.5, py + 0.5);
        if (v[1] <= 0) continue;
        const i = this.index(px, py);
        const old = hit.get(i);
        if (!old || v[1] > old[1]) hit.set(i, v);
      }
    for (const [i, [g, a]] of hit) this.blendAt(i, g, a);
  }

  /** Streckenzug mit runden Enden, Breite `width` */
  stroke(points: readonly (readonly [number, number])[], width: number, g: number, a: number) {
    const half = width / 2;
    const xs = points.map((p) => p[0]),
      ys = points.map((p) => p[1]);
    // Jedes Pixel einmal, mit dem Abstand zur nächsten Strecke: Gelenke werden nicht doppelt gedeckt
    this.each(
      Math.min(...xs) - half - 1,
      Math.min(...ys) - half - 1,
      Math.max(...xs) + half + 1,
      Math.max(...ys) + half + 1,
      (cx, cy) => {
        let d = Infinity;
        for (let k = 1; k < points.length; k++) d = Math.min(d, segment(cx, cy, points[k - 1]!, points[k]!));
        return [g, a * cover(half - d)];
      },
    );
  }

  /** Gefüllte Ellipse um (x, y) mit Halbachsen rx, ry, gedreht um `rot` */
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, g: number, a: number) {
    const c = Math.cos(rot),
      s = Math.sin(rot);
    const r = Math.max(rx, ry) + 1;
    const m = Math.min(rx, ry);
    this.each(x - r, y - r, x + r, y + r, (cx, cy) => {
      const u = (cx - x) * c + (cy - y) * s,
        v = -(cx - x) * s + (cy - y) * c;
      const q = Math.hypot(u / rx, v / ry);
      return [g, a * cover((1 - q) * m)];
    });
  }

  /** Rechteck mit genauer Abdeckung der Randpixel */
  rect(x: number, y: number, w: number, h: number, g: number, a: number) {
    this.each(x, y, x + w, y + h, (cx, cy) => {
      const ox = Math.max(0, Math.min(cx + 0.5, x + w) - Math.max(cx - 0.5, x));
      const oy = Math.max(0, Math.min(cy + 0.5, y + h) - Math.max(cy - 0.5, y));
      return [g, a * ox * oy];
    });
  }
}

/** Abdeckung eines Pixels, dessen Mitte `d` Pixel innerhalb der Kante liegt (geglättet über ein Pixel) */
export const cover = (d: number) => Math.max(0, Math.min(1, d + 0.5));

/** Abstand des Punkts (x, y) zur Strecke a–b */
function segment(x: number, y: number, [ax, ay]: readonly [number, number], [bx, by]: readonly [number, number]) {
  const dx = bx - ax,
    dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

/** Punkte einer kubischen Bézierkurve, in `n` Stücken */
export function bezier(
  p0: readonly [number, number],
  p1: readonly [number, number],
  p2: readonly [number, number],
  p3: readonly [number, number],
  n = 12,
): [number, number][] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n,
      u = 1 - t;
    const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
    return [
      k[0] * p0[0] + k[1] * p1[0] + k[2] * p2[0] + k[3] * p3[0],
      k[0] * p0[1] + k[1] * p1[1] + k[2] * p2[1] + k[3] * p3[1],
    ];
  });
}
