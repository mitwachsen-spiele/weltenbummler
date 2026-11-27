import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LEVEL_H, TILE_D, TILE_W, box, drawModel, paintWith, projection, type Part } from '../../lib/games/front';
import { SPECIES } from '../../data/games/mitwachsen';
import { CONTACT_KNEE, EDGE_STRIP, contactRadius, faceShade } from '../../lib/games/shade';
import { SKIN_PERIOD } from '../../lib/games/skins';
import {
  Fine2D,
  FootSpots,
  ICON_PAINTER,
  SPRITE_LIMIT,
  SPRITE_PIXELS,
  Sprites,
  boxesExtent,
  contactShadow,
  edgeShade,
  edgeStrip,
  glowHalo,
  modelExtent,
  spotRows,
} from './mitwachsen-fine-2d';
import type { Box } from './mitwachsen-view';

/** Kontext, der Aufrufe mitschreibt (Füllungen samt Füllart, Transformationen, Bilder) */
function recorder(scale = 1) {
  const log: string[] = [];
  const name = (f: unknown) => (typeof f === 'string' ? f : ((f as { kind?: string }).kind ?? 'object'));
  const ctx = {
    fillStyle: '' as unknown,
    strokeStyle: '' as unknown,
    lineWidth: 1,
    globalAlpha: 1,
    save: () => log.push('save'),
    restore: () => log.push('restore'),
    transform: (...m: number[]) => log.push(`transform ${m.map((v) => +v.toFixed(2)).join(',')}`),
    translate: (x: number, y: number) => log.push(`translate ${+x.toFixed(2)},${+y.toFixed(2)}`),
    scale: (x: number, y: number) => log.push(`scale ${+x.toFixed(2)},${+y.toFixed(2)}`),
    fillRect: (x: number, y: number, w: number, h: number) =>
      log.push(`fill ${name(ctx.fillStyle)} ${[x, y, w, h].map((v) => +v.toFixed(2)).join(',')}`),
    strokeRect: () => log.push('stroke'),
    beginPath: () => {},
    rect: (x: number, y: number, w: number, h: number) =>
      log.push(`rect ${[x, y, w, h].map((v) => +v.toFixed(2)).join(',')}`),
    clip: () => log.push('clip'),
    arc: () => log.push('arc'),
    fill: () => log.push(`fillpath ${name(ctx.fillStyle)}`),
    createPattern: (img: unknown) => ({
      kind: 'pattern',
      img,
      setTransform: (m: { s: number }) => log.push(`pattern ${+m.s.toFixed(4)}`),
    }),
    createLinearGradient: (...a: number[]) => {
      const g = { kind: `linear(${a.map((v) => +v.toFixed(1)).join(',')})`, stops: [] as string[] };
      return { ...g, addColorStop: (t: number, c: string) => log.push(`stop ${t} ${c}`) };
    },
    createRadialGradient: () => ({
      kind: 'radial',
      addColorStop: (t: number, c: string) => log.push(`stop ${+t.toFixed(2)} ${c}`),
    }),
    drawImage: (_c: unknown, x: number, y: number, w: number, h: number) =>
      log.push(`image ${[x, y, w, h].map((v) => +v.toFixed(1)).join(',')}`),
    getTransform: () => ({ a: scale }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: () => {},
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, log };
}

// Ohne Browser: Canvas und DOMMatrix als Attrappen
const made: { width: number; height: number; log: string[] }[] = [];
const g = globalThis as Record<string, unknown>;
const before = { document: g.document, DOMMatrix: g.DOMMatrix };
beforeAll(() => {
  g.document = {
    createElement: () => {
      const r = recorder();
      const c = { width: 0, height: 0, log: r.log, getContext: () => r.ctx };
      made.push(c);
      return c;
    },
  };
  g.DOMMatrix = class {
    s = 1;
    scale(s: number) {
      this.s = s;
      return this;
    }
  };
});
afterAll(() => {
  g.document = before.document;
  g.DOMMatrix = before.DOMMatrix;
});

const P = projection(0, 0, 0, 0, 1);

describe('Feine Flächen in 2D', () => {
  it('legt Muster in Feldern (eine Kachel je SKIN_PERIOD) und den Verlauf in Einheiten über die Fläche', () => {
    const { ctx, log } = recorder();
    const pen = new Fine2D();
    pen.face(ctx, { x: 10, y: 20, w: 32, h: 22, lu: 0.5, lv: 0.5, side: false }, { skin: 'holz' });
    expect(log).toEqual([
      'save',
      'transform 64,0,0,44,10,20', // Einheiten der Fläche: ein Feld
      `pattern ${+(SKIN_PERIOD.holz / 64).toFixed(4)}`,
      'fill pattern 0,0,0.5,0.5',
      'scale 0.5,0.5',
      `stop 0 ${faceShade(false)[0]}`,
      `stop 1 ${faceShade(false)[1]}`,
      'fill linear(0,0,0,1) 0,0,1,1',
      'restore',
    ]);
    // dasselbe Muster und derselbe Verlauf ein zweites Mal: aus dem Cache des Kontexts
    log.length = 0;
    pen.face(ctx, { x: 0, y: 0, w: 32, h: 22, lu: 0.5, lv: 0.5, side: false }, { skin: 'holz' });
    expect(log.filter((l) => l.startsWith('pattern') || l.startsWith('stop'))).toEqual([]);
  });

  it('schattiert Seiten dunkler (leuchtende halb so stark), ohne Muster nur den Verlauf, winzige Flächen gar nicht', () => {
    const { ctx, log } = recorder();
    const pen = new Fine2D();
    pen.face(ctx, { x: 0, y: 0, w: 10, h: 10, lu: 0.2, lv: 0.2, side: true }, { halo: true });
    expect(log).toContain(`stop 0 ${faceShade(true, true)[0]}`);
    expect(log.some((l) => l.startsWith('fill pattern'))).toBe(false);
    log.length = 0;
    pen.face(ctx, { x: 0, y: 0, w: 0.3, h: 10, lu: 0.01, lv: 0.2, side: true }, undefined);
    pen.face(ctx, { x: 0, y: 0, w: 10, h: 10, lu: 0, lv: 0.2, side: true }, undefined);
    expect(log).toEqual([]);
  });

  it('in Symbolgröße (Leiste unten) nur Verlauf und Oberkante, kein Muster und kein Leuchten', () => {
    const { ctx, log } = recorder();
    ICON_PAINTER.face(ctx, { x: 0, y: 0, w: 32, h: 22, lu: 0.5, lv: 0.5, side: false }, { skin: 'fell', halo: true });
    expect(log.some((l) => l.startsWith('pattern') || l.startsWith('fill pattern'))).toBe(false);
    expect(log).toContain(`stop 0 ${faceShade(false, true)[0]}`);
    expect('halo' in ICON_PAINTER).toBe(false);
    log.length = 0;
    drawModel(ctx, P, SPECIES.hase.parts, 0.5, 0.5, 0, 'e', 1, undefined, ICON_PAINTER);
    expect(log.filter((l) => l === 'stroke').length).toBeGreaterThan(0);
    expect(log.some((l) => l.includes('pattern'))).toBe(false);
  });

  it('Umrisse (Tafeln, verlorene Tiere) bleiben scharf: kein Muster, kein Verlauf, auch wenn der Kontext fein malt', () => {
    const { ctx, log } = recorder();
    paintWith(ctx, new Fine2D());
    drawModel(ctx, P, SPECIES.fuchs.parts, 0.5, 0.5, 0, 's', 1, '#4b5563');
    paintWith(ctx, null);
    expect(log.some((l) => l.includes('pattern') || l.startsWith('stop') || l === 'stroke')).toBe(false);
    expect(new Set(log.map((l) => l.split(' ')[1]))).toEqual(
      new Set(['#4b5563', 'rgba(255,255,255,.05)', 'rgba(0,0,0,.18)']),
    );
  });

  it('sammelt Leuchten mit Kennung aus ihrer Lage und gibt sie einmal je Bild ab', () => {
    const pen = new Fine2D();
    const { ctx } = recorder();
    paintWith(ctx, pen);
    box(ctx, P, 1, 2, 0, 0.2, 0.2, 0.4, '#ffe08a', null, { halo: true });
    paintWith(ctx, null);
    const out = pen.take();
    expect(out).toEqual([{ x: 1.1, y: 2.1, z: 0.2, size: 0.4, color: '#ffe08a', id: '1.10,2.10,0.20' }]);
    expect(pen.take()).toEqual([]);
  });
});

describe('Weicher Fleck und Schatten am Boden in 2D', () => {
  it('zeichnet einen runden Verlauf um die Mitte, kleiner und blasser beim Hüpfen', () => {
    const { ctx, log } = recorder();
    contactShadow(ctx, P, 1, 1, 0, 0.3);
    const r = contactRadius(0.3);
    expect(log).toContain(`translate ${TILE_W},${TILE_D}`);
    expect(log).toContain(`scale ${+(r * TILE_W).toFixed(2)},${+(r * TILE_D).toFixed(2)}`);
    expect(log).toContain('stop 0 rgba(29,40,56,0.320)');
    expect(log).toContain(`stop ${CONTACT_KNEE} rgba(29,40,56,0.240)`);
    expect(log).toContain('fillpath radial');
    const hop = recorder();
    contactShadow(hop.ctx, P, 1, 1, 0, 0.3, 0.6);
    expect(hop.log).toContain('stop 0 rgba(29,40,56,0.160)');
    const tiny = recorder();
    contactShadow(tiny.ctx, projection(0, 0, 0, 0, 0.001), 1, 1, 0, 0.3);
    expect(tiny.log).toEqual([]); // kleiner als ein halbes Pixel: nichts
  });

  it('zeichnet den Fleck oval, wenn ein Ding quer und tief verschieden breit ist (Bett, Trog, Iglu)', () => {
    const { ctx, log } = recorder();
    contactShadow(ctx, P, 1, 1, 0, [0.4, 0.2]);
    const r = contactRadius(0.4);
    expect(log).toContain(`scale ${+(r * TILE_W).toFixed(2)},${+((r / 2) * TILE_D).toFixed(2)}`);
  });

  it('Flecken über mehrere Reihen (Iglu): je Reihe nach ihrem Boden nur ihr Streifen, einer in einer Reihe gleich ganz', () => {
    expect(spotRows([2.5, 3.5, 1, 0.3, 0.3])).toEqual([3, 3]);
    expect(spotRows([2.5, 3.5, 1, 1.2, 1.4])).toEqual([1, 5]);
    const spots = new FootSpots();
    spots.begin();
    const one = recorder();
    spots.place(one.ctx, P, [2.5, 3.5, 1, 0.3, 0.3], 3);
    expect(one.log.filter((l) => l === 'fillpath radial')).toHaveLength(1);
    expect(one.log).not.toContain('clip');
    const { ctx, log } = recorder();
    spots.place(ctx, P, [2.5, 3.5, 1, 1.2, 1.4], 2); // Rückwand in Reihe 2, Fleck bis Reihe 5
    const strips = () => log.filter((l) => l.startsWith('rect'));
    expect(strips()).toEqual([`rect -100000,${2 * TILE_D - LEVEL_H},200000,${TILE_D}`]);
    for (let y = 3; y <= 7; y++) spots.row(ctx, P, y);
    // Reihen 3, 4, 5 je ein Streifen (eine Reihe tief, geschnitten), danach nichts mehr
    expect(strips()).toHaveLength(4);
    expect(strips()[3]).toBe(`rect -100000,${5 * TILE_D - LEVEL_H},200000,${TILE_D}`);
    expect(log.filter((l) => l === 'clip')).toHaveLength(4);
    expect(log.filter((l) => l === 'fillpath radial')).toHaveLength(4);
    // ein neues Bild vergisst die Flecken des vorigen
    spots.begin();
    spots.row(ctx, P, 4);
    expect(strips()).toHaveLength(4);
  });

  it('legt den Streifen von der Kante nach innen, quer dazu über das ganze Feld', () => {
    expect(edgeStrip(3, 4, [-1, 0])).toEqual([
      [3, 4.5],
      [3 + EDGE_STRIP.depth, 4.5],
    ]);
    expect(edgeStrip(3, 4, [0, 1])).toEqual([
      [3.5, 5],
      [3.5, 5 - EDGE_STRIP.depth],
    ]);
  });

  it('dunkelt nur Kanten zu höheren Nachbarn ab, nie auf Wasser', () => {
    const heights: Record<string, number | null> = { '0,0': 1, '-1,0': 2, '1,0': 1, '0,-1': 1.2, '0,1': 1 };
    const at = (x: number, y: number) => (`${x},${y}` in heights ? heights[`${x},${y}`]! : 1);
    const { ctx, log } = recorder();
    edgeShade(ctx, P, at, 0, 0);
    expect(log.filter((l) => l.startsWith('fill'))).toEqual([
      `fill linear(0,-18,22.4,-18) 0,-40,22.4,44`, // links: von der Kante nach innen, ganze Tiefe des Felds
    ]);
    expect(log).toContain(`stop 0 rgba(${EDGE_STRIP.rgb},${EDGE_STRIP.alpha})`);
    const none = recorder();
    edgeShade(none.ctx, P, (x, y) => (x === 0 && y === 0 ? null : 5), 0, 0);
    expect(none.log).toEqual([]);
  });
});

describe('Bild-Cache der feinen Dinge', () => {
  const boxes: Box[] = [
    [0.3, 0.3, 1, 0.4, 0.4, 1.5, '#7a5432', '#7a5432', undefined, { skin: 'rinde' }],
    [-0.2, 0, 2.5, 1.4, 1.1, 0.6, '#4f9a3c', '#4f9a3c', 'see', { halo: true }],
  ];

  it('umfasst alle Quader um den Anker', () => {
    const e = boxesExtent(boxes, [0.5, 0.5, 1]);
    [0.7, 0.7, 0.5, 0.6, 0, 2.1].forEach((v, i) => expect(e[i]).toBeCloseTo(v));
    const parts: Part[] = [[-0.2, -0.3, 0, 0.5, 0.6, 0.8, '#fff']];
    const [l, r, b, f, d, u] = modelExtent(parts, 2);
    expect([l, r, b, f]).toEqual([0.65, 0.65, 0.65, 0.65]);
    expect(d).toBeCloseTo(0.05);
    expect(u).toBeCloseTo(1.65);
  });

  it('zeichnet ein Ding einmal je Maßstab fein und setzt es danach nur noch; eine neue Welt leert den Cache', () => {
    made.length = 0;
    const sprites = new Sprites();
    const { ctx, log } = recorder(2);
    sprites.begin(ctx, 'welt');
    const pen = new Fine2D();
    let painted = 0;
    const paint = (c: CanvasRenderingContext2D, Q: typeof P) => {
      painted++;
      for (const b of boxes)
        box(c, Q, ...(b.slice(0, 8) as [number, number, number, number, number, number, string, string]), b[9]);
    };
    const at = [0.5, 0.5, 1] as const;
    sprites.draw(ctx, P, 'baum', at, boxesExtent(boxes, at), paint, pen);
    sprites.draw(ctx, P, 'baum', at, boxesExtent(boxes, at), paint, pen);
    expect(painted).toBe(1);
    expect(sprites.size).toBe(1);
    // ein Bild (dazu einmal je Seite die Kachel des Musters, 64 × 64)
    const pictures = made.filter((m) => m.width !== 64);
    expect(pictures).toHaveLength(1);
    // Geräte-Pixel: doppelt so groß gezeichnet, in CSS-Pixeln gesetzt
    const [c] = pictures;
    expect(c!.width).toBeGreaterThan(2 * (1.4 * TILE_W));
    const images = log.filter((l) => l.startsWith('image'));
    expect(images).toHaveLength(2);
    expect(images[0]).toBe(images[1]);
    expect(+images[0]!.split(' ')[1]!.split(',')[2]!).toBeCloseTo(c!.width / 2, 1);
    // im Bild fein gemalt (Muster der Rinde); die Krone ist zu groß zum Leuchten
    expect(c!.log.some((l) => l.startsWith('fill pattern'))).toBe(true);
    expect(pen.take()).toEqual([]);
    // anderer Maßstab: neues Bild
    sprites.draw(ctx, projection(0, 0, 0, 0, 0.5), 'baum', at, boxesExtent(boxes, at), paint, pen);
    expect(painted).toBe(2);
    // neue Welt: Cache leer
    sprites.begin(ctx, 'andere');
    expect(sprites.size).toBe(0);
  });

  it('meldet Leuchten im Bild an der Stelle, an die es gesetzt wird', () => {
    const sprites = new Sprites();
    const { ctx } = recorder();
    sprites.begin(ctx, 'w');
    const pen = new Fine2D();
    const lamp = (c: CanvasRenderingContext2D, Q: typeof P) =>
      box(c, Q, 0.4, 0.4, 1.2, 0.2, 0.2, 0.2, '#ffe08a', null, { halo: true });
    sprites.draw(ctx, P, 'lampe', [0.5, 0.5, 1], [0.2, 0.2, 0.2, 0.2, 0, 0.5], lamp, pen);
    sprites.draw(ctx, P, 'lampe', [3.5, 0.5, 2], [0.2, 0.2, 0.2, 0.2, 0, 0.5], lamp, pen);
    const out = pen.take();
    expect(out.map((h) => [+h.x.toFixed(2), +h.y.toFixed(2), +h.z.toFixed(2)])).toEqual([
      [0.5, 0.5, 1.3],
      [3.5, 0.5, 2.3],
    ]);
    // dasselbe Bild noch einmal obenauf (halb durchsichtige Figur): ohne Stift meldet es nichts doppelt
    sprites.draw(ctx, P, 'lampe', [3.5, 0.5, 2], [0.2, 0.2, 0.2, 0.2, 0, 0.5], lamp, null);
    expect(pen.take()).toEqual([]);
  });

  it('hält den Speicher aller Bilder unter der Grenze in Pixeln und gibt Verdrängte sofort frei', () => {
    const { ctx } = recorder();
    const pen = new Fine2D();
    const ext = [0.2, 0.2, 0.2, 0.2, 0, 0.3] as const;
    made.length = 0;
    new Sprites().draw(ctx, P, 'probe', [0, 0, 0], ext, () => undefined, pen);
    const one = made[0]!.width * made[0]!.height; // Pixel eines Bilds
    made.length = 0;
    const sprites = new Sprites(100, 3 * one); // Platz für drei Bilder
    sprites.begin(ctx, 'w');
    for (const k of ['a', 'b', 'c', 'd', 'e']) sprites.draw(ctx, P, k, [0, 0, 0], ext, () => undefined, pen);
    expect(sprites.size).toBe(3);
    expect(sprites.area).toBe(3 * one);
    expect(made.map((c) => c.width === 0)).toEqual([true, true, false, false, false]); // Verdrängte sind freigegeben
    // ein einzelnes Bild über der Grenze bleibt (sonst würde es jedes Bild neu gezeichnet)
    const tiny = new Sprites(100, 1);
    tiny.begin(ctx, 'w');
    tiny.draw(ctx, P, 'a', [0, 0, 0], ext, () => undefined, pen);
    expect(tiny.size).toBe(1);
    // neue Welt: alles frei
    sprites.begin(ctx, 'andere');
    expect(sprites.area).toBe(0);
    expect(SPRITE_PIXELS).toBeGreaterThan(1e7);
  });

  it('vergisst das am längsten nicht gebrauchte Bild, wenn es zu viele werden', () => {
    const sprites = new Sprites(2);
    const { ctx } = recorder();
    sprites.begin(ctx, 'w');
    const pen = new Fine2D();
    let painted = 0;
    const paint = () => void painted++;
    const ext = [0.5, 0.5, 0.5, 0.5, 0, 1] as const;
    for (const k of ['a', 'b', 'a', 'c', 'a', 'b']) {
      sprites.begin(ctx, 'w'); // je ein Bild
      sprites.draw(ctx, P, k, [0, 0, 0], ext, paint, pen);
    }
    expect(sprites.size).toBe(2);
    expect(painted).toBe(4); // a, b, c, und b noch einmal (a blieb, weil es gebraucht wurde)
    expect(SPRITE_LIMIT).toBeGreaterThan(100);
  });

  it('verdrängt keine Bilder des laufenden Bilds: mehr Dinge als die Grenze werden nicht jedes Bild neu gezeichnet', () => {
    const sprites = new Sprites(3);
    const { ctx } = recorder();
    const pen = new Fine2D();
    let painted = 0;
    const paint = () => void painted++;
    const ext = [0.5, 0.5, 0.5, 0.5, 0, 1] as const;
    const keys = ['a', 'b', 'c', 'd', 'e'];
    const frame = () => {
      sprites.begin(ctx, 'w');
      for (const k of keys) sprites.draw(ctx, P, k, [0, 0, 0], ext, paint, pen);
    };
    frame();
    expect(painted).toBe(5);
    expect(sprites.size).toBe(5); // wächst für dieses Bild über die Grenze
    frame();
    expect(painted).toBe(5); // im zweiten Bild nichts neu
    // zeigt der Schirm wieder weniger, schrumpft der Cache beim nächsten neuen Bild auf die Grenze
    sprites.begin(ctx, 'w');
    sprites.draw(ctx, P, 'f', [0, 0, 0], ext, paint, pen);
    expect(sprites.size).toBe(3);
  });
});

describe('Leuchten scharfer Quader (`glowHalo`)', () => {
  it('meldet das Leuchten eines Quaders der Art `glow` wie `box` mit Maler: nur mit `halo` und nur kompakt', () => {
    const pen = new Fine2D();
    glowHalo(pen, [1, 2, 3, 0.2, 0.4, 0.1, '#ff9cd4', '#ffffff', 'glow', { halo: true }]);
    glowHalo(pen, [1, 2, 3, 0.2, 0.4, 0.1, '#ff9cd4', '#ffffff', 'glow']); // ohne `halo`
    glowHalo(pen, [1, 2, 3, 0.2, 0.8, 0.1, '#ff9cd4', '#ffffff', 'glow', { halo: true }]); // zu lang
    const [h, ...rest] = pen.take();
    expect(rest).toEqual([]);
    expect(h).toMatchObject({ x: 1.1, y: 2.2, z: 3.05, size: 0.4, color: '#ff9cd4' });
    glowHalo({}, [1, 2, 3, 0.2, 0.4, 0.1, '#ff9cd4', '#ffffff', 'glow', { halo: true }]); // ein Maler ohne Leuchten
  });
});
