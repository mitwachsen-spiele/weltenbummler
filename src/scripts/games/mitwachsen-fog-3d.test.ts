// Nebel-Maske der 3D-Ansicht: erkundet = 255, zweimal weich verwischt
import { describe, expect, it } from 'vitest';
import { fogMask, fogSeen } from './mitwachsen-fog-3d';

describe('Nebel-Maske (3D)', () => {
  it('alles erkundet: überall 255; nichts: überall 0', () => {
    expect([...fogMask(() => true, 0, 0, 4)]).toEqual(Array(16).fill(255));
    expect([...fogMask(() => false, 0, 0, 4)]).toEqual(Array(16).fill(0));
  });

  it('Felder ab (ox, oy); der Rand ist weich, weit weg bleibt es 0', () => {
    const mask = fogMask((x, y) => x >= 10 && y >= 20, 6, 20, 8); // Spalten 0 … 3 im Nebel, 4 … 7 erkundet
    const row = [...mask.slice(3 * 8, 4 * 8)];
    expect(row[0]).toBe(0);
    expect(row[7]).toBe(255);
    for (let i = 1; i < 8; i++) expect(row[i]!).toBeGreaterThanOrEqual(row[i - 1]!); // steigt gleichmäßig an
    expect(row[3]! > 0 && row[4]! < 255).toBe(true); // Übergang über die Grenze
  });

  it('sagt je Feld, wie deutlich es durch den Nebel zu sehen ist, wie der Shader mischt; außerhalb nichts', () => {
    const mask = Uint8Array.from([255, 128, 20, 0]); // 2 × 2 ab Feld (10, 20)
    expect(fogSeen(mask, 10, 20, 2, 10, 20)).toBe(1);
    expect(fogSeen(mask, 10, 20, 2, 11, 20)).toBeCloseTo(0.5, 2);
    expect(fogSeen(mask, 10, 20, 2, 10, 21)).toBe(0); // unter der Schwelle 0,08
    expect(fogSeen(mask, 10, 20, 2, 11, 21)).toBe(0);
    for (const [x, y] of [
      [9, 20],
      [12, 20],
      [10, 19],
      [10, 22],
    ] as const)
      expect(fogSeen(mask, 10, 20, 2, x, y)).toBe(0);
  });
});
