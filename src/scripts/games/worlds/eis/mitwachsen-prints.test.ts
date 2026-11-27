import { describe, expect, it } from 'vitest';
import type { SkyScene } from '../../mitwachsen-sky';
import { initialState, type State } from '../../mitwachsen-state';
import type { World } from '../../mitwachsen-world';
import { EIS_PACK, worldOf } from '../../test-worlds';
import { Prints, soft, trail } from './mitwachsen-prints';
import { MAX_MARKS, OPACITY, layer, printLayer } from './view-3d-prints';
import { fringeAlpha } from '../../../../lib/games/shade';

const world = worldOf(1);

/** Zwei Nachbarfelder aus Schnee nahe dem Schneebett (von a nach b: nach Osten) */
function snowPair(w: World): [[number, number], [number, number]] {
  const [bx, by] = w.homes.eis.bed;
  for (let y = by - 12; y <= by + 12; y++)
    for (let x = bx - 12; x <= bx + 12; x++)
      if (soft(w.cell(x, y)) && soft(w.cell(x + 1, y)) && !w.cell(x + 1, y).solid)
        return [
          [x, y],
          [x + 1, y],
        ];
  throw new Error('kein Schnee');
}

const scene = (now: number, cam: readonly [number, number], extra: Partial<SkyScene> = {}): SkyScene => ({
  width: 800,
  height: 600,
  zoom: 1,
  now,
  cam: { x: cam[0], y: cam[1] },
  reduced: false,
  mood: { id: 'eis', strength: 1 },
  wind: 0,
  weather: { cloud: 0, rain: 0, rainbow: 0, snow: 0, wind: 0, gust: 0, sparkle: 0 },
  aurora: 0,
  explored: () => true,
  ...extra,
});

/** Zustand mit der Figur auf (x, y) und ohne Tiere (oder mit den angegebenen) */
const at = (s: State, x: number, y: number, animals: State['animals'] = []): State => ({
  ...s,
  player: { ...s.player, x, y },
  animals,
});

describe('Fußspuren im Schnee (Eis-Welt, nur Bild)', () => {
  const base = initialState(world, {}, 1);
  const [a, b] = snowPair(world);

  it('die Figur geht ein Feld weiter: auf dem Schnee hinter ihr bleibt ein Stiefel-Abdruck in Laufrichtung', () => {
    const p = new Prints();
    p.step(world, at(base, ...a), scene(0, a));
    expect(p.seen).toEqual([]);
    const [s, sc] = [at(base, ...b), scene(100, b)];
    const before = [JSON.stringify(base), JSON.stringify(s), JSON.stringify(sc)];
    p.step(world, s, sc);
    expect(p.seen).toHaveLength(1);
    expect(p.seen[0]![0]).toMatchObject({ x: a[0], y: a[1], dir: 'e', kind: 'stiefel' });
    // der Spielstand (und was die Ansicht übergibt) bleibt, wie er war
    expect([JSON.stringify(base), JSON.stringify(s), JSON.stringify(sc)]).toEqual(before);
  });

  it('jedes Tier mit seinem Abdruck: Pinguin-Dreizack, Hufe beim Rentier, Tatzen beim Eisbärkind', () => {
    const kinds = (['pinguin', 'rentier', 'eisbaer'] as const).map((species) => {
      const p = new Prints();
      const animal = ([x, y]: readonly [number, number]) => [
        { ...base.animals[0]!, id: `${species}-1`, species, x, y },
      ];
      p.step(world, at(base, ...a, animal(a)), scene(0, a));
      p.step(world, at(base, ...a, animal(b)), scene(100, a));
      return p.seen.map(([pr]) => pr.kind);
    });
    expect(kinds).toEqual([['dreizack'], ['huf'], ['tatze']]);
  });

  it('kein Abdruck bei einem Sprung (Aufwachen, Reise), fern der Kamera, im Nebel oder ohne Schnee', () => {
    const p = new Prints();
    p.step(world, at(base, ...a), scene(0, a));
    p.step(world, at(base, a[0] + 3, a[1]), scene(100, a)); // gesprungen
    expect(p.seen).toEqual([]);
    const far = new Prints();
    far.step(world, at(base, ...a), scene(0, [a[0] + 40, a[1]]));
    far.step(world, at(base, ...b), scene(100, [a[0] + 40, a[1]]));
    expect(far.seen).toEqual([]);
    const fog = new Prints();
    fog.step(world, at(base, ...a), scene(0, a, { explored: () => false }));
    fog.step(world, at(base, ...b), scene(100, a, { explored: () => false }));
    expect(fog.seen).toEqual([]);
    expect(fog.tracks.live(false)).toHaveLength(1); // gemerkt, aber im Nebel nicht gezeigt
    // am Nebelrand (zwei Felder weiter liegt Nebel) auch nicht: Dort liegen Dunst (2D) und Nebel (3D) über dem Boden
    const edge = new Prints();
    const explored = (x: number) => x < a[0] + 2;
    edge.step(world, at(base, ...a), scene(0, a, { explored }));
    edge.step(world, at(base, ...b), scene(100, a, { explored }));
    expect(edge.seen).toEqual([]);
    edge.step(world, at(base, ...b), scene(200, a, { explored: (x) => x < a[0] + 3 }));
    expect(edge.seen).toHaveLength(1);
    // auf der Lichtung kein Schnee
    const [lx, ly] = world.homes.lichtung.bed;
    const grass = new Prints();
    grass.step(world, at(base, lx, ly + 2), scene(0, [lx, ly]));
    grass.step(world, at(base, lx + 1, ly + 2), scene(100, [lx, ly]));
    expect(grass.tracks.live(false)).toEqual([]);
    expect(soft({ ...world.cell(...a), slide: true })).toBe(false); // die Rutschspur glänzt aus Eis
  });

  it('verweht beim Pustewind schneller; eine andere Welt vergisst alle Spuren', () => {
    const blow = (wind: number) => {
      const p = new Prints();
      p.step(world, at(base, ...a), scene(0, a));
      p.step(world, at(base, ...b), scene(100, a));
      const weather = { cloud: 0, rain: 0, rainbow: 0, snow: 0, wind, gust: 0, sparkle: 0 };
      for (let t = 1100; t <= 30_100; t += 1000) p.step(world, at(base, ...b), scene(t, a, { weather }));
      return p.seen[0]?.[1] ?? 0;
    };
    expect(blow(0)).toBeGreaterThan(0);
    expect(blow(1)).toBe(0);
    const p = new Prints();
    p.step(world, at(base, ...a), scene(0, a));
    p.step(world, at(base, ...b), scene(100, a));
    const other = worldOf(42);
    p.step(other, at(initialState(other, {}, 1), ...a), scene(200, a));
    expect(p.tracks.live(false)).toEqual([]);
  });

  it('2D: kleine blaugraue Rechtecke in der Reihe des Abdrucks, nie golden; 3D: Plättchen mit Obergrenze', () => {
    const p = new Prints();
    p.step(world, at(base, ...a), scene(0, a));
    p.step(world, at(base, ...b), scene(100, a));
    const rects: string[] = [];
    const ctx = { fillStyle: '' } as unknown as CanvasRenderingContext2D;
    ctx.fillRect = (_x, _y, w, h) => void rects.push(`${ctx.fillStyle as string} ${w}×${h}`);
    const P = (x: number, y: number, z: number): [number, number] => [x * 32, y * 16 - z * 16];
    p.draw(ctx, world, P, a[1] + 1); // andere Reihe: nichts
    expect(rects).toEqual([]);
    p.draw(ctx, world, P, a[1]);
    expect(rects).toHaveLength(4); // zwei Stiefel, je erst der weiche Saum, dann der Abdruck
    const [outer, inner] = fringeAlpha(0.42);
    for (const r of rects.slice(0, 2))
      expect(r).toMatch(new RegExp(`^rgba\\(84,112,140,${outer.toFixed(3)}\\) [1-9]\\d*×[1-9]\\d*$`));
    for (const r of rects.slice(2))
      expect(r).toMatch(new RegExp(`^rgba\\(84,112,140,${inner.toFixed(3)}\\) [1-9]\\d*×[1-9]\\d*$`));
    expect(1 - (1 - outer) * (1 - inner)).toBeCloseTo(0.42, 9); // in der Mitte so deutlich wie ohne Saum
    // 3D: je Teil eines Abdrucks ein Plättchen, höchstens MAX_MARKS
    const l = printLayer(p);
    l.update(world);
    expect(l.drawn()).toBe(2);
    expect(l.object.geometry.drawRange.count).toBe(12); // je Plättchen eine Fläche nach oben (6 Ecken)
    const many = printLayer({ seen: Array.from({ length: 400 }, () => p.seen[0]!), rev: 0 });
    many.update(world);
    expect(many.drawn()).toBe(800); // je Stiefel zwei Plättchen
  });

  it('reduzierte Bewegung: Abdrücke verschwinden in Stufen, in 2D und 3D', () => {
    const p = new Prints();
    const levels = new Set<number>();
    const alphas = new Set<string>();
    const l = printLayer(p);
    p.step(world, at(base, ...a), scene(0, a, { reduced: true }));
    for (let t = 100; t <= 41_100; t += 500) {
      p.step(world, at(base, ...b), scene(t, a, { reduced: true }));
      for (const [, v] of p.seen) levels.add(v);
      l.update(world);
      const color = l.object.geometry.getAttribute('color');
      if (l.drawn()) alphas.add(color.getW(0).toFixed(3));
    }
    expect([...levels].sort()).toEqual([1 / 3, 2 / 3, 1]);
    expect([...alphas].sort()).toEqual([1 / 3, 2 / 3, 1].map((v) => Math.fround(OPACITY * v).toFixed(3)));
    expect(p.seen).toEqual([]); // nach 40 s verweht
  });

  it('eine Kette tritt in dieselben Felder: höchstens zwei Abdrücke je Feld', () => {
    const p = new Prints();
    const chain = (where: readonly [number, number]) =>
      (['pinguin', 'rentier', 'eisbaer', 'polarfuchs'] as const).map((species, i) => ({
        ...base.animals[0]!,
        id: `${species}-${i}`,
        species,
        x: where[0],
        y: where[1],
      }));
    p.step(world, at(base, ...a, chain(a)), scene(0, a));
    p.step(world, at(base, ...b, chain(b)), scene(100, a));
    expect(p.seen).toHaveLength(2);
  });

  it('3D füllt nur neu, wenn sich etwas Sichtbares ändert, die neuesten Abdrücke zuerst', () => {
    const p = new Prints();
    p.step(world, at(base, ...a), scene(0, a));
    p.step(world, at(base, ...b), scene(100, a));
    const rev = p.rev;
    p.step(world, at(base, ...b), scene(150, a)); // ein Bild später: gleich deutlich
    expect(p.rev).toBe(rev);
    const l = printLayer(p);
    l.update(world);
    const pos = l.object.geometry.getAttribute('position');
    pos.setX(0, -99);
    l.update(world); // nichts geändert: nicht neu gefüllt
    expect(pos.getX(0)).toBe(-99);
    // mehr Abdrücke, als Plättchen da sind: die neuesten bleiben
    const old = p.seen[0]![0];
    const young = { ...old, x: old.x + 1, born: 99 };
    const many = printLayer({ seen: [[young, 1], ...Array.from({ length: MAX_MARKS }, () => p.seen[0]!)], rev: 1 });
    many.update(world);
    expect(many.drawn()).toBe(MAX_MARKS);
    expect(many.object.geometry.getAttribute('position').getX(0)).toBeGreaterThan(old.x + 1);
  });

  it('kommt mit dem Paket: 2D über den Haken `trail`, 3D über `layer` des 3D-Teils', async () => {
    expect(EIS_PACK.view!.trail).toBe(trail);
    expect((await EIS_PACK.view3d!()).layer!.object.children).toContain(layer.object); // samt Schneespur
  });
});
