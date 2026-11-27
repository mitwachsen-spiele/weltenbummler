import { describe, expect, it } from 'vitest';
import { projection } from '../../lib/games/front';
import { HALO_LIMIT } from '../../lib/games/shade';
import type { Cell } from './mitwachsen-cell';
import {
  HALO_CAVE,
  HALO_HIDDEN,
  HaloPass,
  RISE_3D,
  haloAlpha,
  hidden,
  rgbOf,
  riseOf,
  standing,
  type HaloLit,
  type HaloScene,
  type HaloView,
} from './mitwachsen-halo';

type Spot = Pick<Cell, 'h' | 'ground' | 'deco' | 'light' | 'region'>;
const SOUTH: HaloView = { rise: 1.1, to: [0, 1] };
const flat: Spot = { h: 1, ground: 'grass', deco: null, region: 'lichtung' };

/** Bild mit ebenem Boden, alles erkundet; `cells` ändert einzelne Felder ("x,y") */
function scene(cells: Record<string, Partial<Spot>> = {}, over: Partial<HaloScene> = {}): HaloScene {
  return {
    explored: () => true,
    night: 0,
    focus: [0, 0],
    cell: (x, y) => ({ ...flat, ...cells[`${x},${y}`] }),
    view: SOUTH,
    ...over,
  };
}
const halo = (id: string, x: number, y: number, z = 1.3): HaloLit => ({ id, x, y, z, size: 0.3, color: '#ffe08a' });

describe('Leuchten: Auswahl', () => {
  it('leuchtet tagsüber leise und nachts kräftiger, nie über die Grenzen', () => {
    expect(haloAlpha(0)).toBeCloseTo(0.3);
    expect(haloAlpha(1)).toBeCloseTo(0.55);
    expect(haloAlpha(3)).toBeCloseTo(0.55);
    expect(haloAlpha(-1)).toBeCloseTo(0.3);
  });

  it('zeigt nur Leuchten auf erkundeten Feldern und keins auf einer Lichtinsel der Grotte', () => {
    const pass = new HaloPass();
    const sc = scene({ '2,0': { light: 0.3 } }, { explored: (x) => x < 5 });
    const ids = pass.pick([halo('a', 0.5, 0.5), halo('b', 2.5, 0.5), halo('c', 6.5, 0.5)], sc).map((l) => l.h.id);
    expect(ids).toEqual(['a']);
  });

  it('in der Kristallgrotte leiser (`HALO_CAVE`): dort leuchtet fast alles, die Dunkelmaske bleibt dunkel', () => {
    const lit = new HaloPass().pick([halo('a', 0.5, 0.5), halo('b', 2.5, 0.5)], scene({ '2,0': { region: 'hoehle' } }));
    const alpha = Object.fromEntries(lit.map((l) => [l.h.id, l.alpha]));
    expect(alpha.a).toBeCloseTo(haloAlpha(0));
    expect(alpha.b).toBeCloseTo(haloAlpha(0) * HALO_CAVE);
    expect(HALO_CAVE).toBeLessThan(1);
  });

  it('höchstens HALO_LIMIT zugleich, die nächsten zur Figur, und behält Gezeigte gegen knapp Nähere (Hysterese)', () => {
    const pass = new HaloPass();
    const many = Array.from({ length: HALO_LIMIT + 10 }, (_, i) => halo(`h${i}`, i + 0.5, 0.5));
    const first = pass.pick(many, scene());
    expect(first).toHaveLength(HALO_LIMIT);
    expect(first.map((l) => l.h.id)).toContain('h0');
    expect(first.map((l) => l.h.id)).not.toContain(`h${HALO_LIMIT + 5}`);
    // die Figur rückt ein Feld weiter: Das bisher letzte bleibt, das neue am anderen Ende kommt noch nicht dazu
    const next = pass.pick(many, scene({}, { focus: [1, 0] })).map((l) => l.h.id);
    expect(next).toContain(`h${HALO_LIMIT - 1}`);
    expect(next).toContain('h0');
  });

  it('dämpft Leuchten hinter Hügeln und Baumkronen', () => {
    const pass = new HaloPass();
    const sc = scene({ '0,1': { h: 4 }, '3,1': { deco: 'tree' } });
    const lit = pass.pick([halo('frei', 6.5, 0.5), halo('hügel', 0.5, 0.5), halo('baum', 3.5, 0.5)], sc);
    const alpha = Object.fromEntries(lit.map((l) => [l.h.id, l.alpha]));
    expect(alpha.frei).toBeCloseTo(haloAlpha(0));
    expect(alpha['hügel']).toBeCloseTo(haloAlpha(0) * HALO_HIDDEN);
    expect(alpha.baum).toBeCloseTo(haloAlpha(0) * HALO_HIDDEN);
  });
});

describe('Leuchten: Verdeckung', () => {
  it('zählt Gelände und hohe Dinge, nie Wasser, Lava oder Himmel', () => {
    expect(standing({ h: 2, ground: 'grass', deco: null })).toBe(2);
    expect(standing({ h: 2, ground: 'grass', deco: 'tree' })).toBeCloseTo(4.4);
    expect(standing({ h: 1, ground: 'grass', deco: 'bigshroom' })).toBe(3);
    expect(standing({ h: 1, ground: 'grass', deco: 'gatetower' })).toBe(4);
    expect(standing({ h: 1, ground: 'grass', deco: 'biggate' })).toBe(4);
    for (const ground of ['water', 'lava', 'sky'] as const) expect(standing({ h: 3, ground, deco: null })).toBe(0);
  });

  it('sieht über niedrige Felder davor, nicht über einen Hügel direkt davor; weiter vorn muss er höher sein', () => {
    const at = (cells: Record<string, number>) => (x: number, y: number) => cells[`${x},${y}`] ?? 1;
    const south = (rise: number): HaloView => ({ rise, to: [0, 1] });
    expect(hidden(at({}), 0.5, 0.5, 1.3, south(1.1))).toBe(false);
    expect(hidden(at({ '0,1': 3 }), 0.5, 0.5, 1.3, south(1.1))).toBe(true);
    expect(hidden(at({ '0,3': 3 }), 0.5, 0.5, 1.3, south(1.1))).toBe(false); // weit vorn: der Blick ist schon darüber
    expect(hidden(at({ '0,3': 6 }), 0.5, 0.5, 1.3, south(1.1))).toBe(true);
    expect(hidden(at({ '0,3': 3 }), 0.5, 0.5, 1.3, south(0.5))).toBe(true); // flacher Blick: verdeckt
    expect(hidden(at({ '0,6': 9 }), 0.5, 0.5, 1.3, south(1.1))).toBe(false); // nur die nächsten vier Felder
    expect(hidden(at({ '0,-1': 9 }), 0.5, 0.5, 1.3, south(1.1))).toBe(false); // hinter dem Leuchten zählt nichts
    expect(RISE_3D).toBeGreaterThan(1.1); // die 3D-Kamera schaut steiler herab als 2D von vorn
    expect(RISE_3D).toBeCloseTo(riseOf(55));
    expect(riseOf(45)).toBeCloseTo(1);
  });

  it('prüft die Seite, von der die Kamera schaut, auch wenn sie auf einer Torplatte dreht', () => {
    const at = (cells: Record<string, number>) => (x: number, y: number) => cells[`${x},${y}`] ?? 1;
    const deg = (d: number): HaloView => {
      const r = (d * Math.PI) / 180;
      return { rise: riseOf(45), to: [Math.sin(r), Math.cos(r)] };
    };
    const south = at({ '0,1': 4 }),
      north = at({ '0,-1': 4 }),
      east = at({ '1,0': 4 }),
      west = at({ '-1,0': 4 });
    // aus Süden (0°): nur der Hügel im Süden verdeckt
    expect([south, north, east, west].map((h) => hidden(h, 0.5, 0.5, 1.3, deg(0)))).toEqual([
      true,
      false,
      false,
      false,
    ]);
    // −155° (Torfront im Norden, TARGET_DEG): die Kamera steht fast im Norden
    expect([south, north, east, west].map((h) => hidden(h, 0.5, 0.5, 1.3, deg(-155)))).toEqual([
      false,
      true,
      false,
      false,
    ]);
    // 90°: aus Osten, −90°: aus Westen
    expect([south, north, east, west].map((h) => hidden(h, 0.5, 0.5, 1.3, deg(90)))).toEqual([
      false,
      false,
      true,
      false,
    ]);
    expect([south, north, east, west].map((h) => hidden(h, 0.5, 0.5, 1.3, deg(-90)))).toEqual([
      false,
      false,
      false,
      true,
    ]);
    // schräg (45°): der Blick geht über das Feld südöstlich, ein Hügel dort verdeckt
    expect(hidden(at({ '1,1': 4 }), 0.5, 0.5, 1.3, deg(45))).toBe(true);
    expect(hidden(at({ '1,1': 4 }), 0.5, 0.5, 1.3, deg(-45))).toBe(false);
    expect(hidden(at({ '9,9': 9 }), 0.5, 0.5, 1.3, { rise: 1, to: [0, 0] })).toBe(false); // ohne Richtung nichts
  });

  it('verhüllt Leuchten am Nebelrand so wie das Ding darunter', () => {
    const pass = new HaloPass();
    const seen = (x: number) => (x < 2 ? 1 : x < 4 ? 0.4 : 0);
    const lit = pass.pick(
      [halo('klar', 0.5, 0.5), halo('rand', 2.5, 0.5), halo('weg', 4.5, 0.5)],
      scene({}, { view: { ...SOUTH, seen } }),
    );
    const alpha = Object.fromEntries(lit.map((l) => [l.h.id, l.alpha]));
    expect(alpha.klar).toBeCloseTo(haloAlpha(0));
    expect(alpha.rand).toBeCloseTo(haloAlpha(0) * 0.4);
    expect(alpha.weg).toBe(0);
  });
});

describe('Leuchten: Zeichnen', () => {
  /** Kontext, der die Kreise mitschreibt */
  function recorder() {
    const log: string[] = [];
    let stops: string[] = [];
    const ctx = {
      globalCompositeOperation: 'source-over',
      fillStyle: '' as unknown,
      save: () => log.push('save'),
      restore: () => log.push('restore'),
      createRadialGradient: (...a: number[]) => {
        stops = [];
        log.push(`grad ${a.map((v) => Math.round(v)).join(',')}`);
        return { addColorStop: (_: number, c: string) => stops.push(c) };
      },
      fillRect: () => log.push(`fill ${ctx.globalCompositeOperation} ${stops.join(' ')}`),
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, log };
  }
  const P = projection(0, 0, 100, 100, 1);

  it('zeichnet jeden weichen Kreis aufhellend in der Farbe des Teils, mindestens 6 px groß', () => {
    const { ctx, log } = recorder();
    new HaloPass().draw(ctx, P, [{ ...halo('a', 0.5, 0.5), size: 0.01, color: '#7fd6ff' }], scene());
    expect(log[0]).toBe('save');
    expect(log[1]).toMatch(/^grad 132,70,0,132,70,6$/);
    expect(log[2]).toBe('fill screen rgba(127,214,255,0.300) rgba(127,214,255,0)');
    expect(log[3]).toBe('restore');
  });

  it('misst den Radius gleich, wie auch die Kamera dreht, und lässt ganz Verhüllte weg', () => {
    // eine gedrehte Projektion: Bodenachse x geht nach unten, y nach rechts (Kamera aus Osten)
    const turned = (x: number, y: number, z: number) => [50 + y * 40, 50 + x * 40 - z * 10] as [number, number];
    const { ctx, log } = recorder();
    const sc = scene({}, { view: { ...SOUTH, seen: (x) => (x < 2 ? 1 : 0) } });
    new HaloPass().draw(ctx, turned, [{ ...halo('a', 0.5, 0.5), size: 0.3 }, halo('b', 3.5, 0.5)], sc);
    expect(log[1]).toMatch(/,18$/); // 0,3 × 1,5 = 0,45 Felder × 40 px
    expect(log.filter((l) => l.startsWith('fill'))).toHaveLength(1);
  });

  it('zeichnet nichts ohne Leuchten', () => {
    const { ctx, log } = recorder();
    new HaloPass().draw(ctx, P, [], scene());
    expect(log).toEqual([]);
  });

  it('liest Farben als #rgb, #rrggbb und rgb(a), Unbekanntes leuchtet weiß', () => {
    expect(rgbOf('#ffe08a')).toBe('255,224,138');
    expect(rgbOf('#f80')).toBe('255,136,0');
    expect(rgbOf('rgba(10, 20,30,.5)')).toBe('10,20,30');
    expect(rgbOf('gold')).toBe('255,255,255');
  });
});
