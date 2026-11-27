import { describe, expect, it } from 'vitest';
import { GrayRaster, bezier, cover } from './raster';

describe('Graustufen-Raster', () => {
  it('mischt übereinander wie ein Canvas (source-over), Grau gewichtet nach Deckkraft', () => {
    const r = new GrayRaster(4);
    r.blend(1, 1, 1, 0.5);
    expect(r.alpha[5]).toBeCloseTo(0.5);
    expect(r.gray[5]).toBeCloseTo(1);
    r.blend(1, 1, 0, 0.5);
    expect(r.alpha[5]).toBeCloseTo(0.75);
    expect(r.gray[5]).toBeCloseTo(1 / 3); // 0,25 Weiß unter 0,5 Schwarz
    r.blend(1, 1, 1, 0); // nichts
    expect(r.alpha[5]).toBeCloseTo(0.75);
  });

  it('legt alles um den Rand herum (nahtlos kachelbar)', () => {
    const r = new GrayRaster(4);
    r.blend(-1, 4, 1, 1);
    expect(r.alpha[3]).toBe(1); // (3, 0)
    r.rect(3.5, 1, 1, 1, 0, 1); // halb im letzten Pixel der Zeile, halb links wieder herein
    expect(r.alpha[4 + 3]).toBeCloseTo(0.5);
    expect(r.alpha[4]).toBeCloseTo(0.5);
  });

  it('deckt ein Pixel nur einmal, auch wenn eine Form über den Rand hinaus reicht', () => {
    const r = new GrayRaster(8);
    r.stroke(
      [
        [4, 0],
        [4, 8],
      ],
      2,
      0,
      0.5,
    ); // senkrecht über die ganze Kachel: die runden Enden fallen auf den Körper der Linie am anderen Ende
    expect(r.alpha[0 * 8 + 4]).toBeCloseTo(r.alpha[4 * 8 + 4]!);
    expect(r.alpha[7 * 8 + 4]).toBeCloseTo(0.5);
  });

  it('deckt Randpixel eines Rechtecks anteilig', () => {
    const r = new GrayRaster(8);
    r.rect(1, 1, 1.5, 1, 0, 1);
    expect(r.alpha[9]).toBeCloseTo(1);
    expect(r.alpha[10]).toBeCloseTo(0.5);
    expect(r.alpha[11]).toBe(0);
  });

  it('zieht Linien mit runden Enden und füllt Ellipsen, geglättet', () => {
    const r = new GrayRaster(16);
    r.stroke(
      [
        [2, 8],
        [8, 8],
        [8, 2],
      ],
      2,
      1,
      1,
    );
    expect(r.alpha[8 * 16 + 5]).toBe(1); // auf der Linie
    expect(r.alpha[4 * 16 + 8]).toBe(1); // zweite Strecke
    expect(r.alpha[12 * 16 + 5]).toBe(0); // weit daneben
    const dot = new GrayRaster(8);
    dot.stroke(
      [
        [4, 4],
        [4, 4],
      ],
      2,
      0,
      1,
    ); // Strecke ohne Länge: ein runder Punkt
    expect(dot.alpha[3 * 8 + 3]).toBeGreaterThan(0.5);
    const e = new GrayRaster(16);
    e.ellipse(8, 8, 4, 2, 0, 0, 0.5);
    expect(e.alpha[8 * 16 + 8]).toBeCloseTo(0.5);
    expect(e.alpha[8 * 16 + 14]).toBe(0);
    expect(e.alpha[4 * 16 + 8]).toBe(0); // schmal in der Höhe
    expect(cover(-1)).toBe(0);
    expect(cover(0)).toBe(0.5);
    expect(cover(2)).toBe(1);
  });

  it('teilt eine Bézierkurve in Stücke von Anfang bis Ende', () => {
    const pts = bezier([0, 0], [1, 2], [3, 2], [4, 0], 4);
    expect(pts).toHaveLength(5);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[4]).toEqual([4, 0]);
    expect(pts[2]![1]).toBeCloseTo(1.5);
  });
});
