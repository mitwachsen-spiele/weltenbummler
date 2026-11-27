import { describe, expect, it } from 'vitest';
import { GRASS_SIDE, GRASS_TOP, PAL_GRASS } from '../voxel/textures';
import {
  DIRS,
  LEVEL_H,
  TILE_D,
  TILE_W,
  box,
  cellAt,
  drawModel,
  eyes,
  frontBlock,
  projection,
  type FaceRect,
  type Fine,
  type FinePainter,
  type HaloAt,
  type Part,
  paintWith,
  painterOf,
} from './front';

/** Kontext, der mitschreibt, was gezeichnet wird: Füllungen und Striche samt Farbe */
function recorder() {
  const log: string[] = [];
  const ctx = {
    fillStyle: '' as unknown,
    strokeStyle: '' as unknown,
    lineWidth: 1,
    globalAlpha: 1,
    fillRect(x: number, y: number, w: number, h: number) {
      log.push(`fill ${String(ctx.fillStyle)} ${[x, y, w, h].map((v) => +v.toFixed(2)).join(',')}`);
    },
    strokeRect(x: number, y: number, w: number, h: number) {
      log.push(
        `stroke ${String(ctx.strokeStyle)} ${ctx.lineWidth} ${[x, y, w, h].map((v) => +v.toFixed(2)).join(',')}`,
      );
    },
    setTransform() {},
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, log };
}

/** Maler, der mitschreibt, welche Flächen und Leuchten er bekommt */
function painter(withHalo = true) {
  const faces: [FaceRect, Fine | undefined][] = [];
  const halos: HaloAt[] = [];
  const p: FinePainter = { face: (_ctx, f, fine) => faces.push([f, fine]) };
  if (withHalo) p.halo = (at) => halos.push(at);
  return { p, faces, halos };
}

describe('Ansicht von vorn', () => {
  it('bildet den Kamerapunkt auf den Ursprung ab und rückt je Feld um eine Kachel weiter', () => {
    const p = projection(5, 7, 100, 200);
    expect(p(5, 7, 0)).toEqual([100, 200]);
    expect(p(6, 7, 0)).toEqual([100 + TILE_W, 200]);
    expect(p(5, 8, 0)).toEqual([100, 200 + TILE_D]);
    expect(p(5, 7, 1)).toEqual([100, 200 - LEVEL_H]); // eine Ebene höher liegt weiter oben
    expect(projection(0, 0, 0, 0, 2)(1, 1, 0)).toEqual([2 * TILE_W, 2 * TILE_D]);
  });

  it('findet unter einem Bildschirmpunkt das Feld wieder, auch gezoomt und auf Höhe', () => {
    for (const scale of [1, 0.75, 1.5])
      for (const z of [0, 1, 2])
        for (const [x, y] of [
          [0, 0],
          [3, -2],
          [-4, 5],
        ] as const) {
          const [sx, sy] = projection(1, 2, 320, 240, scale)(x + 0.5, y + 0.5, z);
          expect(cellAt(sx, sy, z, 1, 2, 320, 240, scale)).toEqual([x, y]);
        }
  });

  it('kennt vier Blickrichtungen mit je einem Schritt', () => {
    for (const [dx, dy] of Object.values(DIRS)) expect(Math.abs(dx) + Math.abs(dy)).toBe(1);
  });

  it('setzt Augen spiegelgleich auf alle drei sichtbaren Seiten, mit Glanzpunkt', () => {
    const parts = eyes(0.5, 0.3, 1, 0.1, 0.12, 0.08);
    expect(parts).toHaveLength(8);
    expect(parts.filter((p) => p[6] === '#ffffff')).toHaveLength(4);
    expect(new Set(parts.map((p) => p[8]))).toEqual(new Set(['f', 'r', 'l']));
  });
});

describe('Quader von vorn: flach und fein', () => {
  const P = projection(0, 0, 0, 0);

  it('zeichnet ohne Maler wie immer: Oberseite mit 5 % Weiß, Vorderseite mit 18 % Schwarz', () => {
    const { ctx, log } = recorder();
    box(ctx, P, 0, 0, 0, 1, 1, 1, '#808080', '#a0a0a0');
    expect(log).toEqual([
      `fill #a0a0a0 0,${-LEVEL_H},${TILE_W},${TILE_D}`,
      `fill rgba(255,255,255,.05) 0,${-LEVEL_H},${TILE_W},${TILE_D}`,
      `fill #808080 0,${TILE_D - LEVEL_H},${TILE_W},${LEVEL_H}`,
      `fill rgba(0,0,0,.18) 0,${TILE_D - LEVEL_H},${TILE_W},${LEVEL_H}`,
    ]);
  });

  it('gibt mit Maler jede Fläche samt ihrer Größe in Feldern weiter und zieht die helle Oberkante', () => {
    const { ctx, log } = recorder();
    const { p, faces, halos } = painter();
    const fine: Fine = { skin: 'holz' };
    box(ctx, P, 0, 0, 0, 0.5, 0.25, 0.75, '#808080', null, fine, p);
    expect(faces.map(([f, k]) => [f.side, f.lu, f.lv, k])).toEqual([
      [false, 0.5, 0.25, fine],
      [true, 0.5, 0.75, fine],
    ]);
    const [top, side] = faces.map(([f]) => f);
    expect(top!.w).toBeCloseTo(0.5 * TILE_W);
    expect(top!.h).toBeCloseTo(0.25 * TILE_D);
    expect(side!.y).toBeCloseTo(top!.y + top!.h); // Vorderseite schließt unten an
    expect(side!.h).toBeCloseTo(0.75 * LEVEL_H);
    expect(log.filter((l) => l.startsWith('fill rgba'))).toEqual([]); // keine flache Schattierung mehr
    expect(log.filter((l) => l.startsWith('stroke'))).toEqual([
      `stroke rgba(255,255,255,0.38) 0.9 0,${-0.75 * LEVEL_H},${0.5 * TILE_W},${0.25 * TILE_D}`,
    ]);
    expect(halos).toEqual([]); // leuchtet nicht
  });

  it('lässt die Oberkante an kleinen Teilen weg und passt ihre Breite dem Maßstab an', () => {
    const { ctx, log } = recorder();
    box(ctx, P, 0, 0, 0, 0.1, 0.1, 0.1, '#000000', null, undefined, painter().p);
    expect(log.some((l) => l.startsWith('stroke'))).toBe(false);
    const big = recorder();
    box(big.ctx, projection(0, 0, 0, 0, 2), 0, 0, 0, 1, 1, 1, '#000000', null, undefined, painter().p);
    expect(big.log.find((l) => l.startsWith('stroke'))).toContain(' 1.8 ');
  });

  it('meldet kompakte leuchtende Teile mit Mitte und Größe, lange Streifen nicht', () => {
    const { ctx, log } = recorder();
    const { p, halos } = painter();
    box(ctx, P, 1, 1, 0, 0.2, 0.2, 0.4, '#ffe08a', null, { halo: true }, p);
    expect(halos).toHaveLength(1);
    const { x, y, z, size, color } = halos[0]!;
    expect([x, y, z]).toEqual([1.1, 1.1, 0.2]); // Mitte in der Welt, die Ansicht projiziert selbst
    expect(size).toBeCloseTo(0.4);
    expect(color).toBe('#ffe08a');
    expect(log.find((l) => l.startsWith('stroke'))).toContain('rgba(255,255,255,0.6)'); // hellere Kante
    box(ctx, P, 0, 0, 0, 2, 0.2, 0.2, '#ffe08a', null, { halo: true }, p);
    expect(halos).toHaveLength(1);
    // ohne Leuchten-Haken kein Fehler
    box(ctx, P, 0, 0, 0, 0.2, 0.2, 0.2, '#ffe08a', null, { halo: true }, painter(false).p);
  });

  it('reicht die Feinheit der Teile eines Modells weiter, Umrisse (mono) bleiben scharf', () => {
    const fur: Fine = { skin: 'fell' };
    const parts: Part[] = [
      [-0.2, -0.2, 0, 0.4, 0.4, 0.4, '#c08a55', null, undefined, fur],
      [0.2, -0.1, 0.2, 0.1, 0.2, 0.1, '#2e2b33'],
    ];
    const a = painter();
    drawModel(recorder().ctx, P, parts, 0, 0, 0, 's', 1, undefined, a.p);
    expect(a.faces.map(([, k]) => k)).toEqual([fur, fur, undefined, undefined]);
    const b = painter();
    const flat = recorder();
    drawModel(flat.ctx, P, parts, 0, 0, 0, 's', 1, '#000000', b.p);
    expect(b.faces).toEqual([]);
    expect(flat.log.filter((l) => l.includes('rgba(0,0,0,.18)'))).toHaveLength(2);
  });

  it('malt mit dem Maler des Kontexts, bis er weggenommen wird; null bleibt flach', () => {
    const { ctx, log } = recorder();
    const a = painter();
    paintWith(ctx, a.p);
    expect(painterOf(ctx)).toBe(a.p);
    box(ctx, P, 0, 0, 0, 0.5, 0.5, 0.5, '#808080');
    expect(a.faces).toHaveLength(2);
    box(ctx, P, 0, 0, 0, 0.5, 0.5, 0.5, '#808080', null, undefined, null); // Gelände: flach trotz Maler
    expect(a.faces).toHaveLength(2);
    expect(log.filter((l) => l.includes('rgba(0,0,0,.18)'))).toHaveLength(1);
    drawModel(ctx, P, [[0, 0, 0, 0.3, 0.3, 0.3, '#808080']], 0, 0, 0, 's', 1, '#000000'); // Umriss bleibt scharf
    expect(a.faces).toHaveLength(2);
    paintWith(ctx, null);
    expect(painterOf(ctx)).toBeUndefined();
    box(ctx, P, 0, 0, 0, 0.5, 0.5, 0.5, '#808080');
    expect(a.faces).toHaveLength(2);
  });
});

describe('Blöcke des Geländes', () => {
  it('bleiben 8 × 8 mit feiner Körnung: Bild aus Oberseite und Vorderseite', () => {
    const fills: number[] = [];
    const ctx = {
      fillStyle: '',
      globalAlpha: 1,
      setTransform() {},
      fillRect() {
        fills.push(1);
      },
    };
    const doc = globalThis as { document?: unknown };
    const before = doc.document;
    doc.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
    try {
      const c = frontBlock(GRASS_TOP, GRASS_SIDE, PAL_GRASS);
      expect([c.width, c.height]).toEqual([TILE_W * 2, (TILE_D + LEVEL_H) * 2]);
      // je Fläche 64 Texel (mit Farbschichten), 256 Unterpixel Körnung und eine Schattierung
      expect(fills.length).toBeGreaterThanOrEqual(2 * (64 + 256 + 1));
    } finally {
      doc.document = before;
    }
  });
});
