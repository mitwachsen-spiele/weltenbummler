import { describe, expect, it } from 'vitest';
import { Vox, parts, plantInto } from './mitwachsen-gate-kit';
import type { GateBox } from './mitwachsen-gate-flora';

/** Anzahl Vierecke und ihre Normalen in allen Teilen */
function quads(p: ReturnType<typeof parts>) {
  const out: { part: string; n: [number, number, number]; pos: number[] }[] = [];
  for (const [part, g] of Object.entries(p)) {
    if (g.empty) continue;
    const geo = g.build();
    const pos = geo.getAttribute('position').array,
      nor = geo.getAttribute('normal').array;
    for (let v = 0; v < pos.length / 3; v += 4)
      out.push({ part, n: [nor[v * 3]!, nor[v * 3 + 1]!, nor[v * 3 + 2]!], pos: [...pos.slice(v * 3, v * 3 + 12)] });
  }
  return out;
}

describe('Baukasten der Zugänge', () => {
  it('ein Voxel hat sechs Flächen, ein Quader aus gleichen Voxeln auch: verdeckte fallen weg, gleiche Reihen werden eins', () => {
    const one = new Vox();
    one.set(0, 0, 0, '#ffffff');
    const p1 = parts();
    one.emit(p1);
    expect(quads(p1)).toHaveLength(6);
    const block = new Vox();
    block.fill(0, 0, 0, 1, 1, 1, '#808080'); // 8 × 8 × 8 Voxel
    const p2 = parts();
    block.emit(p2);
    // je Richtung eine Fläche je Reihe: oben/unten/vorn/hinten 8 Reihen, links/rechts 8 Reihen
    expect(quads(p2)).toHaveLength(6 * 8);
  });

  it('zwischen Voxeln verschiedener Teile entsteht keine Fläche, außen bekommt jeder Teil seine eigenen', () => {
    const v = new Vox();
    v.set(0, 0, 0, '#ffffff', 'solid');
    v.set(1, 0, 0, '#ff0000', 'bright');
    const p = parts();
    v.emit(p);
    const q = quads(p);
    expect(q).toHaveLength(10);
    expect(q.filter((f) => f.part === 'bright')).toHaveLength(5);
  });

  it('Flächen rücken ein wenig nach außen, damit sie nie in einer Fläche des Geländes liegen', () => {
    const v = new Vox();
    v.fill(0, 0, 0, 1, 1, 1, '#808080');
    const p = parts();
    v.emit(p);
    const top = quads(p).filter((f) => f.n[1] === 1);
    for (const f of top) for (let i = 1; i < 12; i += 3) expect(f.pos[i]).toBeCloseTo(1.004, 6);
  });

  it('ein Bild zeigt mit seiner Vorderseite zur angegebenen Richtung, links und rechts aus Sicht des Betrachters', () => {
    const rows = ['ab'];
    const pal = { a: '#ff0000', b: '#0000ff' };
    for (const [face, right] of [
      [
        [0, 1],
        [1, 0],
      ],
      [
        [1, 0],
        [0, -1],
      ],
      [
        [0, -1],
        [-1, 0],
      ],
      [
        [-1, 0],
        [0, 1],
      ],
    ] as const) {
      const v = new Vox();
      v.image(0, 0, 0, rows, pal, face);
      // „b“ steht rechts von „a“, von der Kamera aus gesehen
      const cells = [-1, 0, 1].flatMap((i) => [-1, 0, 1].map((k) => [i, k] as const));
      const placed = cells.filter(([i, k]) => v.has(i, 0, k));
      expect(placed).toHaveLength(2);
      const [a, b] = placed.sort((p, q) => (p[0] - q[0]) * right[0] + (p[1] - q[1]) * right[1]);
      expect([b![0] - a![0], b![1] - a![1]]).toEqual([right[0], right[1]]);
    }
  });

  it('feine Pflanzen: winzige Teile ohne Schattenwurf in `plantTiny`, leuchtende in `bright`, sonst `plant`', () => {
    const big: GateBox = [0, 0, 0, 0.3, 0.3, 0.3, '#336633', '#448844', { skin: 'blatt' }];
    const tiny: GateBox = [0, 0.3, 0, 0.04, 0.3, 0.01, '#ddccbb', '#ddccbb', {}];
    const p = parts();
    plantInto(p, [big, tiny]);
    expect([p.plant.empty, p.plantTiny.empty, p.bright.empty]).toEqual([false, false, true]);
    const q = parts();
    plantInto(q, [big, tiny], true);
    expect([q.plant.empty, q.plantTiny.empty, q.bright.empty]).toEqual([true, true, false]);
  });
});
