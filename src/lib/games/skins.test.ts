import { describe, expect, it } from 'vitest';
import { SKINS, SKIN_COLS, SKIN_PERIOD, skinAtlas, skinCell, skinPixels, type Skin } from './skins';

/** Kennzahlen einer Kachel: mittlere und größte Deckkraft (0 … 1), ob alles Grau ist */
function stats(px: Uint8ClampedArray) {
  let sum = 0,
    max = 0,
    gray = true;
  for (let i = 0; i < px.length; i += 4) {
    sum += px[i + 3]!;
    max = Math.max(max, px[i + 3]!);
    if (px[i] !== px[i + 1] || px[i] !== px[i + 2]) gray = false;
  }
  return { mean: sum / (px.length / 4) / 255, max: max / 255, gray };
}

describe('Feine Oberflächen (Skins)', () => {
  it('kennt zwölf Muster, jedes mit eigener Stelle im Atlas und einer Periode', () => {
    expect(SKINS).toHaveLength(12);
    const cells = new Set(SKINS.map((s) => skinCell(s).join(',')));
    expect(cells.size).toBe(12);
    for (const s of SKINS) expect(SKIN_PERIOD[s]).toBeGreaterThan(0.3);
    expect(SKIN_PERIOD.fell).toBeLessThan(SKIN_PERIOD.quilt); // Fell fein, Steppdecke grob
  });

  it('zeichnet jedes Muster leise und neutral: Grau mit Deckkraft, nie deckend, nie leer', () => {
    const bad: string[] = [];
    for (const s of SKINS) {
      const { mean, max, gray } = stats(skinPixels(s));
      if (!gray) bad.push(`${s}: nicht grau`);
      if (mean <= 0.002 || mean > 0.45) bad.push(`${s}: mittlere Deckkraft ${mean.toFixed(3)}`);
      if (max <= 0.05 || max > 0.96) bad.push(`${s}: größte Deckkraft ${max.toFixed(3)}`);
    }
    expect(bad).toEqual([]);
  });

  it('ist deterministisch: gleiche Pixel bei jedem Aufruf', () => {
    for (const s of ['fell', 'holz', 'eisblock'] satisfies Skin[]) expect(skinPixels(s)).toEqual(skinPixels(s));
  });

  it('unterscheidet die Muster voneinander', () => {
    const keys = new Set(SKINS.map((s) => Array.from(skinPixels(s, 16)).join(',')));
    expect(keys.size).toBe(SKINS.length);
  });

  it('kachelt nahtlos: Die Ränder gegenüber passen so gut zueinander wie Nachbarzeilen im Inneren', () => {
    const n = 64;
    const bad: string[] = [];
    for (const s of SKINS) {
      const px = skinPixels(s, n);
      const a = (x: number, y: number) => px[(y * n + x) * 4 + 3]!;
      const diff = (f: (i: number) => number) => {
        let d = 0;
        for (let i = 0; i < n; i++) d += Math.abs(f(i));
        return d / n;
      };
      // Sprung über die Naht (Zeile n−1 → 0, Spalte n−1 → 0) gegen den mittleren Sprung zwischen zwei Zeilen innen
      const seam = Math.max(
        diff((i) => a(i, n - 1) - a(i, 0)),
        diff((i) => a(n - 1, i) - a(0, i)),
      );
      let inner = 0;
      for (let y = 1; y < n; y++) inner += diff((i) => a(i, y - 1) - a(i, y));
      for (let x = 1; x < n; x++) inner += diff((i) => a(x - 1, i) - a(x, i));
      inner /= 2 * (n - 1);
      if (seam > inner * 3 + 4) bad.push(`${s}: Naht ${seam.toFixed(1)} gegen ${inner.toFixed(1)}`);
    }
    expect(bad).toEqual([]);
  });

  it('kachelt ohne Nahtstreifen: Randzeilen und -spalten decken so stark wie die im Inneren', () => {
    // Eine Linie über die ganze Kachel darf ihre Enden an der Naht nicht doppelt decken (sonst ein dunklerer Strich alle
    // Kachellängen). Steppdecke und Eisblock haben ihre Nähte gewollt am Rand.
    const n = 64;
    const bad: string[] = [];
    for (const s of SKINS.filter((s) => s !== 'quilt' && s !== 'eisblock')) {
      const px = skinPixels(s, n);
      const a = (x: number, y: number) => px[(y * n + x) * 4 + 3]!;
      const mean = (f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i)).reduce((p, c) => p + c) / n;
      for (const [name, line] of [
        ['Zeile', (k: number) => mean((i) => a(i, k))],
        ['Spalte', (k: number) => mean((i) => a(k, i))],
      ] as const) {
        const inner = Array.from({ length: n - 2 }, (_, k) => line(k + 1));
        const m = inner.reduce((p, c) => p + c) / inner.length;
        const sd = Math.sqrt(inner.reduce((p, c) => p + (c - m) ** 2, 0) / inner.length);
        for (const k of [0, n - 1])
          if (Math.abs(line(k) - m) > 2 * sd + 0.5)
            bad.push(`${s}: ${name} ${k} ${line(k).toFixed(1)} gegen ${m.toFixed(1)} ± ${sd.toFixed(1)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('legt alle Muster in einen Atlas aus Kacheln, jede an ihrer Stelle', () => {
    const size = 16;
    const { pixels, cols, rows } = skinAtlas(size);
    expect(cols).toBe(SKIN_COLS);
    expect(cols * rows).toBeGreaterThanOrEqual(SKINS.length);
    expect(pixels).toHaveLength(cols * rows * size * size * 4);
    const width = cols * size;
    for (const s of SKINS) {
      const tile = skinPixels(s, size);
      const [c, r] = skinCell(s);
      const row = (y: number) =>
        Array.from(
          pixels.subarray(((r * size + y) * width + c * size) * 4, ((r * size + y) * width + (c + 1) * size) * 4),
        );
      expect(row(0)).toEqual(Array.from(tile.subarray(0, size * 4)));
      expect(row(size - 1)).toEqual(Array.from(tile.subarray((size - 1) * size * 4)));
    }
  });
});
