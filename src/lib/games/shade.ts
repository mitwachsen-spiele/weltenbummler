// Licht und Schatten der feinen Dinge (Entwurf „Feine Grafik“), rein gerechnet für 2D und 3D: Seitenverlauf, helle
// Oberkante, Leuchten kompakter Teile, weicher Fleck unter Körpern und weicher Schatten am Boden neben höheren
// Nachbarn. Gelände bleibt Block: Hier wird nur gerechnet, wie stark etwas abgedunkelt wird, nie eine Textur.

// ---------- Seitenverlauf ----------

/** Leuchtende Teile (`halo`) haben nur die halbe Schattierung: Sie sollen von innen hell wirken */
export const HALO_K = 0.5;

/**
 * Faktoren auf die Farbe der Ecken eines Quaders in 3D (Vertex-Farben, die Beleuchtung kommt dazu): Seiten unten
 * dunkler als oben, die Oberseite hinten etwas heller als vorn – wie der Verlauf in 2D (`faceShade`) und im Entwurf.
 * Leuchtende Teile haben an den Seiten nur die halbe Schattierung; die Oberseite ist bei allen gleich (wie im Entwurf).
 */
export function vertexShade(halo = false): {
  sideTop: number;
  sideBottom: number;
  topFront: number;
  topBack: number;
} {
  const k = halo ? HALO_K : 1;
  return { sideTop: 1, sideBottom: 1 - 0.14 * k, topFront: 1.02, topBack: 1.08 };
}

/**
 * Verlauf über eine Fläche in 2D (Ansicht von vorn), von oben nach unten der Fläche (Seite: Ober- zur Unterkante;
 * Oberseite: hinten nach vorn): Seiten schwarz von 14 % nach 30 % (leuchtende halb), die Oberseite weiß von 10 % nach 2 %
 * (bei allen gleich).
 */
export function faceShade(side: boolean, halo = false): readonly [string, string] {
  const k = halo ? HALO_K : 1;
  const a = (v: number) => +(v * k).toFixed(3);
  return side ? [`rgba(0,0,0,${a(0.14)})`, `rgba(0,0,0,${a(0.3)})`] : ['rgba(255,255,255,.1)', 'rgba(255,255,255,.02)'];
}

// ---------- Helle Oberkante ----------

/** Nur Quader, die groß genug sind, bekommen die helle Kante um ihre Oberseite (sonst wären Pupillen weiße Punkte) */
export const edgeVisible = (w: number, d: number, h: number): boolean => w >= 0.12 && d >= 0.08 && h >= 0.05;
/** Deckkraft der hellen Oberkante (Weiß) */
export const edgeAlpha = (halo = false): number => (halo ? 0.6 : 0.38);
/** Breite der Oberkante in 2D bei Maßstab `scale` (Pixel) */
export const edgeWidth = (scale: number): number => Math.max(0.6, 0.9 * scale);

// ---------- Leuchten ----------

/** Größte Kante eines Teils, das leuchten darf: Lampen, Kristalle, Pilze – keine langen Streifen */
export const HALO_MAX = 0.6;
export const haloCompact = (w: number, d: number, h: number): boolean => Math.max(w, d, h) <= HALO_MAX;
/** Radius des Leuchtens in Feldern (weicher Kreis um die Mitte des Teils) */
export const haloRadius = (w: number, d: number, h: number): number => Math.max(w, d, h) * 1.5;
/** Höchstens so viele Leuchten zugleich (Software-WebGL und 2D bleiben flüssig) */
export const HALO_LIMIT = 64;
/** So viel näher (in Feldern) muss ein neues Leuchten sein, um ein schon gezeigtes zu verdrängen */
export const HALO_HYST = 2;

export type HaloCand = { readonly id: string; readonly x: number; readonly y: number };

/**
 * Welche Leuchten gezeigt werden: die `limit` nächsten zur Figur `focus`. Schon gezeigte (`prev`) zählen um
 * `HALO_HYST` Felder näher, damit beim Laufen am Rand der Auswahl nichts flackert. Gleich weit: nach Kennung.
 */
export function haloPick<T extends HaloCand>(
  cands: readonly T[],
  focus: readonly [number, number],
  prev: ReadonlySet<string>,
  limit = HALO_LIMIT,
): T[] {
  if (cands.length <= limit) return [...cands];
  const key = (c: T) => Math.hypot(c.x - focus[0], c.y - focus[1]) - (prev.has(c.id) ? HALO_HYST : 0);
  return cands
    .map((c) => ({ c, k: key(c) }))
    .sort((a, b) => a.k - b.k || (a.c.id < b.c.id ? -1 : a.c.id > b.c.id ? 1 : 0))
    .slice(0, limit)
    .map((e) => e.c);
}

// ---------- Weicher Fleck unter Körpern ----------

/** Ab dieser Höhe über dem Boden (Ebenen) ist der Fleck am kleinsten */
const LIFT_FULL = 0.6;
/** Wie weit ein Sprung ist (0 … 1); bei reduzierter Bewegung nur in drei Stufen */
function liftOf(lift: number, reduced: boolean) {
  const t = Math.max(0, Math.min(1, lift / LIFT_FULL));
  return reduced ? Math.round(t * 2) / 2 : t;
}
/** Radius des weichen Flecks unter einem Körper mit Fußabdruck `footprint` (Halbbreite in Feldern) */
export const contactRadius = (footprint: number, lift = 0, reduced = false): number =>
  footprint * 1.35 * (1 - 0.35 * liftOf(lift, reduced));
/** Deckkraft in der Mitte des Flecks: Er wird beim Hüpfen blasser */
export const contactAlpha = (lift = 0, reduced = false): number => 0.32 * (1 - 0.5 * liftOf(lift, reduced));
/** Knick des Flecks: bis hierhin (Anteil des Radius) bleibt er kräftig, dort hat er noch `CONTACT_MID` der Mitte */
export const CONTACT_KNEE = 0.45;
export const CONTACT_MID = 0.75;
/** Deckkraft des Flecks über den Radius (0 Mitte … 1 Rand) als Anteil der Mitte: erst sanft, dann weich auf 0 */
export function contactFall(r: number): number {
  if (r >= 1) return 0;
  const t = Math.max(0, r);
  return t < CONTACT_KNEE ? 1 - (1 - CONTACT_MID) * (t / CONTACT_KNEE) : (CONTACT_MID * (1 - t)) / (1 - CONTACT_KNEE);
}

// ---------- Weicher Schatten am Boden neben Höherem ----------

/** Um so viel muss ein Nachbar höher sein (Block oder stehendes Ding), damit am Boden ein Schatten liegt */
export const EDGE_RISE = 0.5;
/** Streifen in 2D: von der Kante `depth` Felder nach innen, Deckkraft an der Kante, Farbe (RGB) */
export const EDGE_STRIP = { depth: 0.35, alpha: 0.3, rgb: '20,24,34' } as const;
/** Abdunkeln einer Ecke in 3D, ganz eingeschlossen (zwei Seiten); eine Seite oder nur schräg 45 %, Seite und schräg 90 % */
export const EDGE_AO = 0.3;

/** Richtung zu einem Nachbarn: links, rechts, hinten, vorn */
export type GroundEdge = readonly [-1 | 0 | 1, -1 | 0 | 1];
const AROUND: readonly GroundEdge[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/**
 * Kanten eines Bodenfelds, an denen ein höherer Nachbar steht. `heightAt` gibt die Höhe der Oberseite (samt
 * stehendem Ding) oder `null`, wo kein Boden ist (Wasser, Lava, Himmel): Dort liegt kein Schatten, und daneben wirft
 * nichts einen. Nur die vier Seiten zählen, nicht die Ecken (schräge Nachbarn): für den Streifen in 2D (`EDGE_STRIP`);
 * die Ecken in 3D rechnet `cornerShade` samt schräger Nachbarn.
 */
export function groundEdges(heightAt: (x: number, y: number) => number | null, x: number, y: number): GroundEdge[] {
  const h = heightAt(x, y);
  if (h === null) return [];
  return AROUND.filter(([dx, dy]) => {
    const n = heightAt(x + dx, y + dy);
    return n !== null && n >= h + EDGE_RISE;
  });
}

/** Faktoren der vier Ecken der Oberseite eines Bodenfelds, benannt nach ihrer Lage (x0y0 = links hinten) */
export type Corners = { readonly x0y0: number; readonly x1y0: number; readonly x1y1: number; readonly x0y1: number };

/**
 * Weicher Schatten des Bodenfelds (x, y) in 3D, je Ecke seiner Oberseite (wie Umgebungsverdeckung bei Voxeln): Jede
 * Ecke zählt die beiden Nachbarn an ihren Seiten und den schrägen dazwischen, die höher sind (`groundEdges`). So haben
 * Felder, die sich eine Ecke teilen, dort denselben Faktor, auch am Ende einer Mauer (sonst eine harte Stufe entlang
 * der Feldgrenze). Die Textur des Bodens bleibt, nur die Farbe der Ecke ändert sich. Ohne Boden (null) bleibt alles 1.
 */
export function cornerShade(
  heightAt: (x: number, y: number) => number | null,
  x: number,
  y: number,
  strength = EDGE_AO,
): Corners {
  const h = heightAt(x, y);
  const high = (dx: number, dy: number) => {
    const n = h === null ? null : heightAt(x + dx, y + dy);
    return n !== null && h !== null && n >= h + EDGE_RISE ? 1 : 0;
  };
  const corner = (sx: -1 | 1, sy: -1 | 1) => {
    const a = high(sx, 0),
      b = high(0, sy);
    const n = a && b ? 3 : a + b + high(sx, sy);
    return 1 - strength * Math.min(1, n * 0.45);
  };
  return { x0y0: corner(-1, -1), x1y0: corner(1, -1), x1y1: corner(1, 1), x0y1: corner(-1, 1) };
}
