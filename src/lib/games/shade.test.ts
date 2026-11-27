import { describe, expect, it } from 'vitest';
import {
  CONTACT_KNEE,
  CONTACT_MID,
  EDGE_AO,
  HALO_HYST,
  HALO_LIMIT,
  contactAlpha,
  contactFall,
  contactRadius,
  cornerShade,
  edgeAlpha,
  edgeVisible,
  edgeWidth,
  faceShade,
  groundEdges,
  haloCompact,
  haloPick,
  haloRadius,
  vertexShade,
  type HaloCand,
} from './shade';

describe('Seitenverlauf und Oberkante', () => {
  it('macht Seiten unten dunkler, die Oberseite hinten heller als vorn; leuchtende Teile an den Seiten nur halb', () => {
    const s = vertexShade();
    expect(s).toEqual({ sideTop: 1, sideBottom: 0.86, topFront: 1.02, topBack: 1.08 });
    const h = vertexShade(true);
    expect(h.sideBottom).toBeCloseTo(0.93);
    expect([h.topFront, h.topBack]).toEqual([s.topFront, s.topBack]); // Oberseite wie im Entwurf ohne Unterschied
  });

  it('verläuft in 2D und 3D in dieselbe Richtung: Oberseite hinten heller, Seite unten dunkler', () => {
    const alpha = (c: string) => Number(/,([\d.]+)\)$/.exec(c)![1]);
    const [back, front] = faceShade(false).map(alpha) as [number, number];
    const { topBack, topFront } = vertexShade();
    expect(back > front).toBe(topBack > topFront);
    for (const halo of [false, true]) {
      const [top, bottom] = faceShade(true, halo).map(alpha) as [number, number];
      expect(bottom).toBeGreaterThan(top);
      expect(vertexShade(halo).sideBottom).toBeLessThan(1);
      expect(faceShade(false, halo)).toEqual(faceShade(false));
    }
  });

  it('legt in 2D einen Verlauf über Seite und Oberseite', () => {
    expect(faceShade(true)).toEqual(['rgba(0,0,0,0.14)', 'rgba(0,0,0,0.3)']);
    expect(faceShade(true, true)).toEqual(['rgba(0,0,0,0.07)', 'rgba(0,0,0,0.15)']);
    expect(faceShade(false)).toEqual(['rgba(255,255,255,.1)', 'rgba(255,255,255,.02)']);
  });

  it('zeigt die helle Oberkante nur an Quadern, die groß genug sind', () => {
    expect(edgeVisible(0.12, 0.08, 0.05)).toBe(true);
    expect(edgeVisible(0.11, 0.5, 0.5)).toBe(false); // schmal
    expect(edgeVisible(0.5, 0.07, 0.5)).toBe(false); // flach in der Tiefe
    expect(edgeVisible(0.5, 0.5, 0.04)).toBe(false); // Plättchen
    expect(edgeAlpha()).toBeLessThan(edgeAlpha(true));
    expect(edgeWidth(0.2)).toBe(0.6);
    expect(edgeWidth(2)).toBeCloseTo(1.8);
  });
});

describe('Leuchten', () => {
  it('leuchtet nur kompakt (größte Kante höchstens 0,6), mit Radius nach der größten Kante', () => {
    expect(haloCompact(0.6, 0.2, 0.3)).toBe(true);
    expect(haloCompact(0.2, 0.2, 0.61)).toBe(false);
    expect(haloRadius(0.2, 0.4, 0.1)).toBeCloseTo(0.6);
    expect(haloRadius(0.6, 0.6, 0.6)).toBeLessThanOrEqual(0.9);
  });

  const ring = (n: number, r: number, tag = 'c'): HaloCand[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `${tag}${i}`,
      x: Math.cos((i / n) * Math.PI * 2) * r,
      y: Math.sin((i / n) * Math.PI * 2) * r,
    }));

  it('nimmt alle, solange es nicht mehr als die Grenze sind', () => {
    const c = ring(10, 3);
    expect(haloPick(c, [0, 0], new Set())).toEqual(c);
  });

  it('nimmt die nächsten zur Figur, höchstens die Grenze', () => {
    const near = ring(HALO_LIMIT, 4, 'n');
    const far = ring(30, 20, 'f');
    const picked = haloPick([...far, ...near], [0, 0], new Set());
    expect(picked).toHaveLength(HALO_LIMIT);
    expect(picked.every((c) => c.id.startsWith('n'))).toBe(true);
    expect(haloPick([...far, ...near], [0, 0], new Set(), 5)).toHaveLength(5);
  });

  it('hält schon gezeigte Leuchten, bis ein neues deutlich näher ist (Hysterese)', () => {
    const shown = { id: 'alt', x: 10, y: 0 };
    const rival = { id: 'neu', x: 10 - HALO_HYST + 0.5, y: 0 };
    const near = ring(3, 1);
    // ohne Vorgeschichte gewinnt das nähere
    expect(haloPick([shown, rival, ...near], [0, 0], new Set(), 4).map((c) => c.id)).toContain('neu');
    // war „alt“ schon zu sehen, bleibt es, solange „neu“ nicht um mehr als HALO_HYST näher ist
    const keep = haloPick([shown, rival, ...near], [0, 0], new Set(['alt']), 4).map((c) => c.id);
    expect(keep).toContain('alt');
    expect(keep).not.toContain('neu');
    const closer = { id: 'neu', x: 10 - HALO_HYST - 0.5, y: 0 };
    expect(haloPick([shown, closer, ...near], [0, 0], new Set(['alt']), 4).map((c) => c.id)).toContain('neu');
  });

  it('entscheidet bei gleichem Abstand nach Kennung (kein Flackern durch Reihenfolge)', () => {
    const c = [
      { id: 'b', x: 1, y: 0 },
      { id: 'a', x: -1, y: 0 },
      { id: 'c', x: 0, y: 1 },
      { id: 'a', x: 0, y: -1 },
    ];
    expect(haloPick(c, [0, 0], new Set(), 2).map((x) => x.id)).toEqual(['a', 'a']);
    expect(haloPick([...c].reverse(), [0, 0], new Set(), 3).map((x) => x.id)).toEqual(['a', 'a', 'b']);
  });
});

describe('Weicher Fleck unter Körpern', () => {
  it('ist etwas größer als der Fußabdruck und schrumpft und verblasst beim Hüpfen', () => {
    expect(contactRadius(0.3)).toBeCloseTo(0.405);
    expect(contactRadius(0.3, 0.3)).toBeLessThan(contactRadius(0.3));
    expect(contactRadius(0.3, 5)).toBeCloseTo(contactRadius(0.3, 0.6)); // nicht kleiner als ganz oben
    expect(contactRadius(0.3, -1)).toBeCloseTo(contactRadius(0.3)); // unter dem Boden zählt nicht
    expect(contactAlpha()).toBeCloseTo(0.32);
    expect(contactAlpha(0.6)).toBeCloseTo(0.16);
  });

  it('ändert sich bei reduzierter Bewegung nur in Stufen', () => {
    const lifts = Array.from({ length: 61 }, (_, i) => i / 100);
    const steps = new Set(lifts.map((l) => contactRadius(0.3, l, true).toFixed(6)));
    expect(steps.size).toBe(3);
    expect(new Set(lifts.map((l) => contactAlpha(l, true).toFixed(6))).size).toBe(3);
  });
  it('bleibt bis zum Knick kräftig und fällt dann weich auf 0 am Rand', () => {
    expect(contactFall(0)).toBe(1);
    expect(contactFall(-0.2)).toBe(1); // innen nie mehr als die Mitte
    expect(contactFall(CONTACT_KNEE)).toBeCloseTo(CONTACT_MID);
    expect(contactFall(1)).toBe(0);
    expect(contactFall(1.5)).toBe(0);
    const r = Array.from({ length: 101 }, (_, i) => contactFall(i / 100));
    expect(r.every((v, i) => i === 0 || v <= r[i - 1]!)).toBe(true); // nach außen nie heller
  });
});

describe('Weicher Schatten am Boden neben Höherem', () => {
  // Kleine Karte: Zahlen sind Höhen, W Wasser, L Lava, H Himmel (kein Boden)
  const map = ['1121', '1W11', '1L32', '11H1'];
  const at = (x: number, y: number) => {
    const ch = map[y]?.[x];
    return ch === undefined || ch === 'W' || ch === 'L' || ch === 'H' ? null : Number(ch);
  };
  const dirs = (x: number, y: number) => groundEdges(at, x, y).map(([dx, dy]) => `${dx},${dy}`);

  it('findet Kanten zu höheren Nachbarn an den vier Seiten', () => {
    expect(dirs(1, 0)).toEqual(['1,0']); // rechts ein Block höher
    expect(dirs(3, 1)).toEqual(['0,1']); // vorn ein Block höher
    expect(dirs(3, 2)).toEqual(['-1,0']); // links die 3
  });

  it('kennt keine Kanten an Ecken (schräge Nachbarn), neben Wasser, Lava und Himmel und auf ihnen', () => {
    expect(dirs(3, 3)).toEqual(['0,-1']); // die 3 schräg links oben zählt nicht, nur die 2 darüber
    expect(dirs(0, 1)).toEqual([]); // rechts Wasser
    expect(dirs(0, 2)).toEqual([]); // rechts Lava
    expect(dirs(1, 3)).toEqual([]); // rechts Himmel, oben Lava
    expect(dirs(1, 1)).toEqual([]); // Wasser selbst
    expect(dirs(2, 3)).toEqual([]); // Himmel selbst
  });

  it('zählt ein stehendes Ding ab einer halben Ebene als höher', () => {
    const thing = (x: number, y: number) => (x === 1 && y === 0 ? 1.5 : 1);
    expect(groundEdges(thing, 0, 0)).toEqual([[1, 0]]);
    const low = (x: number, y: number) => (x === 1 && y === 0 ? 1.4 : 1);
    expect(groundEdges(low, 0, 0)).toEqual([]);
  });

  it('dunkelt in 3D die Ecken an höheren Nachbarn ab, eingeschlossen am stärksten, ohne Boden gar nicht', () => {
    const one = 1 - EDGE_AO * 0.45,
      two = 1 - EDGE_AO * 0.9,
      full = 1 - EDGE_AO;
    expect(cornerShade(at, 0, 3)).toEqual({ x0y0: 1, x1y0: 1, x1y1: 1, x0y1: 1 }); // nichts Höheres ringsum
    // (1, 0): rechts die 2 – beide rechten Ecken haben sie an der Seite, schräg dahinter (2, 1) nichts Höheres
    expect(cornerShade(at, 1, 0)).toEqual({ x0y0: 1, x1y0: one, x1y1: one, x0y1: 1 });
    // (3, 1): vorn die 2, schräg vorn links die 3, schräg hinten links die 2 – vorn links Seite und schräg, vorn
    // rechts nur die Seite, hinten links nur schräg
    const c = cornerShade(at, 3, 1);
    expect(c.x0y1).toBeCloseTo(two);
    expect(c.x1y1).toBeCloseTo(one);
    expect(c.x0y0).toBeCloseTo(one);
    expect(c.x1y0).toBe(1);
    // (3, 2): links die 3, sonst nichts Höheres ringsum
    const d = cornerShade(at, 3, 2);
    expect(d.x0y0).toBeCloseTo(one);
    expect(d.x0y1).toBeCloseTo(one);
    expect(cornerShade(at, 1, 1)).toEqual({ x0y0: 1, x1y0: 1, x1y1: 1, x0y1: 1 }); // Wasser selbst
    const pit = (x: number, y: number) =>
      x === 0 && y === 0 ? 0 : x === 1 && y === 0 ? 1 : x === 0 && y === 1 ? 1 : 0;
    expect(cornerShade(pit, 0, 0).x1y1).toBeCloseTo(full); // zwei Seiten: ganz eingeschlossen, schräg zählt nicht mehr
    expect(cornerShade(pit, 0, 0, 0.5).x1y0).toBeCloseTo(1 - 0.5 * 0.45);
  });

  it('gibt Feldern, die sich eine Ecke teilen, dort denselben Faktor (keine Stufe am Ende einer Mauer)', () => {
    // Mauer aus Höhe 3 in der Mitte einer Fläche aus Höhe 1: jede Ecke des Gitters gleich, egal von welchem Feld aus
    const wall = new Set(['2,2', '3,2', '4,2']);
    const h = (x: number, y: number) => (wall.has(`${x},${y}`) ? 3 : 1);
    const bad: string[] = [];
    for (let gy = 1; gy <= 4; gy++)
      for (let gx = 1; gx <= 6; gx++) {
        const seen = (
          [
            [gx - 1, gy - 1, 'x1y1'],
            [gx, gy - 1, 'x0y1'],
            [gx - 1, gy, 'x1y0'],
            [gx, gy, 'x0y0'],
          ] as const
        )
          .filter(([x, y]) => !wall.has(`${x},${y}`))
          .map(([x, y, k]) => cornerShade(h, x, y)[k]);
        if (new Set(seen).size > 1) bad.push(`${gx},${gy}: ${seen.join(' ')}`);
      }
    expect(bad).toEqual([]);
    expect(cornerShade(h, 1, 2).x1y0).toBeLessThan(1); // am Ende der Mauer liegt Schatten
    expect(cornerShade(h, 1, 1).x1y1).toBe(cornerShade(h, 1, 2).x1y0); // auch schräg davor
  });
});
