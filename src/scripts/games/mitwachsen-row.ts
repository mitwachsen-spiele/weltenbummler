// 2D-Adapter für Dinge aus Quadern (mitwachsen-deco-look.ts): in die eigene Reihe klemmen und in Zeichenreihenfolge
// bringen. Die Ansicht von vorn malt je Quader Oberseite und Vorderseite übereinander; was später kommt, deckt zu.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Bild“, Zeile „Natur“)

import { LEVEL_H, TILE_D } from '../../lib/games/front';
import type { Box } from './mitwachsen-view';

/** So weit nach vorn darf ein Ding in 2D in die nächste Reihe ragen (Felder ab der Hinterkante seiner Reihe) */
export const ROW_FRONT = 1.12;

const K = LEVEL_H / TILE_D;
const EPS = 1e-9;
/** Bildzeilen eines Quaders in Feldern Tiefe (Pixel / TILE_D): von der Hinterkante oben bis zur Vorderkante unten */
const rows = (b: Box) => [b[1] - (b[2] + b[5]) * K, b[1] + b[4] - b[2] * K] as const;
/** Wie weit vorn der Quader in Bildzeile u gesehen wird: auf der Oberseite, darunter auf der Vorderseite */
const depth = (b: Box, u: number) => Math.min(b[1] + b[4], u + (b[2] + b[5]) * K);
/** Zeile, in der die Oberseite eines Quaders in seine Vorderseite übergeht */
const edge = (b: Box) => b[1] + b[4] - (b[2] + b[5]) * K;

/** Länge des Stücks [0, 1] einer Strecke von p nach q, auf dem sie über 0 liegt */
function above(p: number, q: number): number {
  if (p > EPS && q > EPS) return 1;
  if (p <= EPS && q <= EPS) return 0;
  const t = p / (p - q);
  return p > EPS ? t : 1 - t;
}

/**
 * Muss `a` in 2D vor `b` gezeichnet werden? Nur, wo sich beide im Bild überdecken. Dort entscheidet, wer auf mehr
 * Bildzeilen vorn liegt: Der kommt danach. Liegt einer ganz hinter oder unter dem anderen, ist das genau richtig;
 * durchdringen sich zwei, malt die Reihenfolge so am wenigsten falsch. Gleich vorn (etwa in einer Ebene): keiner
 */
export function before(a: Box, b: Box): boolean {
  if (a[0] + a[3] <= b[0] + EPS || b[0] + b[3] <= a[0] + EPS) return false;
  const [at, ab] = rows(a),
    [bt, bb] = rows(b);
  const u0 = Math.max(at, bt),
    u1 = Math.min(ab, bb);
  if (u1 <= u0 + EPS) return false;
  const cuts = [u0, edge(a), edge(b), u1].filter((u) => u >= u0 && u <= u1).sort((p, q) => p - q);
  let aFront = 0,
    bFront = 0;
  for (let i = 1; i < cuts.length; i++) {
    const p = cuts[i - 1]!,
      q = cuts[i]!;
    const dp = depth(a, p) - depth(b, p),
      dq = depth(a, q) - depth(b, q);
    aFront += (q - p) * above(dp, dq);
    bFront += (q - p) * above(-dp, -dq);
  }
  return bFront > aFront + EPS;
}

/**
 * Quader in Zeichenreihenfolge (topologisch über `before`, wenige Quader je Ding): stets den ersten, vor dem nichts mehr
 * gezeichnet werden muss; bei einem Kreis den ersten der Liste
 */
export function sortBoxes(boxes: readonly Box[]): Box[] {
  const n = boxes.length;
  const first = boxes.map((b) => boxes.map((a) => a !== b && before(a, b))); // first[j][i]: i vor j
  const done = new Array<boolean>(n).fill(false);
  const out: Box[] = [];
  while (out.length < n) {
    const open = (j: number) => !done[j] && !first[j]!.some((f, i) => f && !done[i]);
    let j = boxes.findIndex((_, k) => open(k));
    if (j < 0) j = done.indexOf(false);
    done[j] = true;
    out.push(boxes[j]!);
  }
  return out;
}

/**
 * Quader eines Dings in die eigene Reihe `row` klemmen und sortieren (`sortBoxes`). Ragt es weiter als `ROW_FRONT` nach
 * vorn, wird es in der Tiefe um die Feldmitte gestaucht (Breite und Höhe bleiben, wie in 3D): Sonst deckten Boden und
 * Tiere der Reihe davor die Krone halb zu
 */
export function clampRow(boxes: readonly Box[], row: number): Box[] {
  const mid = row + 0.5;
  const front = Math.max(mid, ...boxes.map((b) => b[1] + b[4]));
  const k = front > row + ROW_FRONT ? (ROW_FRONT - 0.5) / (front - mid) : 1;
  return sortBoxes(
    k === 1
      ? boxes
      : boxes.map(([bx, by, bz, w, d, hh, side, top, kind, fine]) => [
          bx,
          mid + (by - mid) * k,
          bz,
          w,
          d * k,
          hh,
          side,
          top,
          kind,
          fine,
        ]),
  );
}

/**
 * Merkt sich die fertig geklemmten und sortierten Quader (`make`) je Feld, solange sich sein Ding nicht ändert (`key`):
 * Die Ansicht zeichnet jedes Bild neu, die Quader eines Dings hängen aber nur an Feld und Zustand. Eine neue Welt oder
 * mehr als `limit` Felder leeren den Speicher
 */
export function rowCache(limit = 4096) {
  let owner: object | null = null;
  const memo = new Map<string, { key: string; boxes: readonly Box[] | null }>();
  return (world: object, x: number, y: number, key: string, make: () => readonly Box[] | null) => {
    if (world !== owner || memo.size >= limit) {
      owner = world;
      memo.clear();
    }
    const at = `${x},${y}`;
    const hit = memo.get(at);
    if (hit?.key === key) return hit.boxes;
    const boxes = make();
    memo.set(at, { key, boxes });
    return boxes;
  };
}
