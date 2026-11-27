// Spielorte im Gletschertal (Issue 52): Zahlen-Fähnchen bimmeln im Vorbeilaufen, Laternen-Tannen gehen an und bleiben
// an. Ihre Lage über die Seeds prüft mitwachsen-valley.test.ts
import { describe, expect, it } from 'vitest';
import { DIGITS } from '../../../../data/games/mitwachsen-digits';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import type { Cell } from '../../mitwachsen-cell';
import { mapColor } from '../../mitwachsen-map';
import { SIGHT_OF } from '../../mitwachsen-sight';
import { initialState, progressOf, step, type GameEvent, type State } from '../../mitwachsen-state';
import { kesselPlace, standHeight } from '../../mitwachsen-world';
import { EIS_PACK, worldOf } from '../../test-worlds';
import { hangLamps, litOf, placeFlags } from './mitwachsen-places';
import { LAMP_SCORE, PLACE_COLORS, PLACE_SIGHTS, flagBoxes, flagScore, lampBodies } from './mitwachsen-places-look';
import { view } from './view-2d';
import { view3d } from './view-3d';

const world = worldOf(1, [EIS_PACK]);
const RULES = [EIS_PACK];
const CELLS = kesselPlace(1, EIS_PACK).cells.map((p) => [p, world.cell(...p)] as const);
const FLAGS = CELLS.filter(([, c]) => c.deco === 'numflag').sort((a, b) => a[1].note! - b[1].note!);
const LAMPS = CELLS.filter(([, c]) => c.lamp).map(([p]) => p);
const PENTA = [0, 2, 4, 7, 9];
const penta = (hz: number) => PENTA.includes(((Math.round(12 * Math.log2(hz / 261.63)) % 12) + 12) % 12);
const DIRS = { e: [1, 0], w: [-1, 0], s: [0, 1], n: [0, -1] } as const;
type Dir = keyof typeof DIRS;

function at(x: number, y: number, more: Partial<State> = {}): State {
  const s = initialState(world, {});
  return { ...s, sleeping: false, wokeAt: -100, openGates: ['eis'], player: { x, y, dir: 's' }, animals: [], ...more };
}
const move = (s: State, dir: Dir) => step(s, world, { type: 'move', dir, fresh: true }, undefined, undefined, RULES);
const of = <T extends GameEvent['type']>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

describe('Laternen-Tannen', () => {
  /** Eine Laternen-Tanne mit einem freien Feld daneben und der Richtung von dort zu ihr */
  const [tree, from, dir] = LAMPS.flatMap((p) =>
    (Object.entries(DIRS) as [Dir, readonly [number, number]][])
      .filter(([, [dx, dy]]) => standHeight(world, ['eis'], p[0] - dx, p[1] - dy) !== null)
      .map(([d, [dx, dy]]) => [p, [p[0] - dx, p[1] - dy], d] as const),
  )[0]!;

  it('hineinlaufen zündet sie an: Ereignis, die Figur bleibt stehen ohne Anstoßen; sie bleibt an und ist gespeichert', () => {
    const s = at(...from);
    expect(litOf(s.packs).size).toBe(0);
    const r = move(s, dir);
    expect(of(r.events, 'treelamp')).toEqual([{ type: 'treelamp', x: tree[0], y: tree[1] }]);
    expect(of(r.events, 'bump')).toEqual([]);
    expect(r.state.player).toMatchObject({ x: from[0], y: from[1] });
    expect([...litOf(r.state.packs)]).toEqual([tree.join(',')]);
    // gespeichert mit dem Zustand der Pakete: Nach dem Laden ist sie noch an
    const saved = JSON.parse(JSON.stringify(progressOf(r.state))) as ReturnType<typeof progressOf>;
    expect([...litOf(saved.packs)]).toEqual([tree.join(',')]);
    // noch einmal hinein: Sie brennt schon, die Figur stößt an wie an jeder Tanne
    const again = move(r.state, dir);
    expect(of(again.events, 'treelamp')).toEqual([]);
    expect(of(again.events, 'bump')).toHaveLength(1);
    expect(again.state.packs).toBe(r.state.packs);
  });

  it('Schneemänner und Laternen teilen den Zustand der Eis-Welt und verlieren einander nicht', () => {
    const lit = move(at(...from), dir).state;
    const [heap] = CELLS.find(([, c]) => c.deco === 'snowheap')!;
    const built = move({ ...lit, player: { x: heap[0] - 1, y: heap[1], dir: 'e' } }, 'e').state;
    expect(built.packs.eis).toMatchObject({ v: 1, snow: { [heap.join(',')]: 1 }, lit: [tree.join(',')] });
    const both = move({ ...built, player: { x: from[0], y: from[1], dir } }, dir).state; // brennt schon
    expect(both.packs).toBe(built.packs);
    const other = { snow: { [heap.join(',')]: 2 }, v: 1 };
    const first = move(at(...from, { packs: { eis: other } }), dir).state;
    expect(first.packs.eis).toMatchObject({ ...other, lit: [tree.join(',')] });
  });

  it('kaputte und alte Einträge ergeben keine brennende Laterne', () => {
    expect(litOf({}).size).toBe(0);
    expect(litOf({ eis: { v: 1, snow: {} } }).size).toBe(0);
    expect([...litOf({ eis: { lit: ['3,-4', 7, 'x', null, '12,5'] } })]).toEqual(['3,-4', '12,5']);
    expect(litOf({ eis: { lit: 'ja' } }).size).toBe(0);
  });

  it('hangLamps: nur Tannen, höchstens zwölf, weit auseinander, je Seed dieselben', () => {
    const pine: Cell = { h: 1, ground: 'snow', deco: 'tree', tree: 'snowpine', region: 'eis', solid: true };
    const map = new Map<string, Cell>();
    const cells: [number, number][] = [];
    for (let y = 0; y < 80; y += 4)
      for (let x = 0; x < 80; x += 4) {
        cells.push([x, y]);
        map.set(`${x},${y}`, pine);
      }
    map.set('2,2', { ...pine, deco: null, tree: undefined, solid: false });
    cells.push([2, 2]);
    const again = new Map(map);
    hangLamps(3, cells, map);
    hangLamps(3, cells, again);
    const hung = [...map].filter(([, c]) => c.lamp).map(([k]) => k.split(',').map(Number) as [number, number]);
    expect(hung).toHaveLength(12);
    expect(hung.every((p) => hung.every((q) => p === q || Math.hypot(p[0] - q[0], p[1] - q[1]) >= 16))).toBe(true);
    expect(map.get('2,2')!.lamp).toBeUndefined();
    expect([...again]).toEqual([...map]);
  });

  it('Bild: je Tanne in der Nähe eine Laterne vorn am Baum, blass oder türkis; nur in der Eis-Welt; kein Gold', () => {
    const s = at(...from);
    const off = lampBodies(s, world).find((b) => b.x === tree[0] && b.y === tree[1] + 1)!;
    expect(off).toMatchObject({ key: 'eis:laterne:aus', dir: 's', z: world.cell(...tree).h });
    const on = lampBodies(move(s, dir).state, world).find((b) => b.x === tree[0] && b.y === tree[1] + 1)!;
    expect(on.key).toBe('eis:laterne:an');
    const colors = (b: typeof on) => new Set(b.parts.flatMap((p) => [p[6], p[7] ?? p[6]]));
    expect(colors(on).has(PLACE_COLORS.on[0])).toBe(true);
    expect(colors(off).has(PLACE_COLORS.on[0])).toBe(false);
    // fein: Der Kristall leuchtet weich nur, wenn sie brennt; Haken und Rahmen aus Metall; sie hängt, kein Fleck am Boden
    expect(on.parts.filter((p) => p[9]?.halo).map((p) => p[6])).toEqual([PLACE_COLORS.on[0], PLACE_COLORS.on[1]]);
    expect(off.parts.some((p) => p[9]?.halo)).toBe(false);
    expect(off.parts.filter((p) => p[6] === PLACE_COLORS.hook).every((p) => p[9]?.skin === 'metall')).toBe(true);
    expect([on.foot, off.foot]).toEqual([0, 0]);
    for (const b of [on, off]) {
      expect(colors(b).has(GOLD.top) || colors(b).has(GOLD.side)).toBe(false);
      expect(b.id.startsWith('ride:')).toBe(false); // nicht antippbar
      // der Körper steht ein Feld vor der Tanne und hängt an dessen hinterer Kante: vorn am Baum, zur Kamera
      expect(b.parts.every((p) => p[0] >= -0.5 && p[0] + p[3] <= -0.1)).toBe(true);
    }
    expect(lampBodies(s, world).length).toBeLessThan(LAMPS.length); // nur die nahen
    expect(lampBodies(at(0, 3), world)).toEqual([]);
    expect(view.bodies!(s, world, { now: 0, frac: 1, reduced: false, lit: false }).some((b) => b.id === off.id)).toBe(
      true,
    );
  });
});

describe('Zahlen-Fähnchen', () => {
  /** Ein Fähnchen, an dem die Figur von zwei Feldern links aus vorbeilaufen kann */
  const [[fx, fy], flag] = FLAGS.find(([[x, y]]) =>
    [-3, -2, -1, 1, 2].every((dx) => standHeight(world, ['eis'], x + dx, y) !== null && !world.cell(x + dx, y).deco),
  )!;

  it('neun Fähnchen 1 bis 9, flach und begehbar; die Karte zeigt dort Schnee', () => {
    expect(FLAGS.map(([, c]) => c.note)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (const [, c] of FLAGS) {
      expect(c.solid).toBe(false);
      expect(mapColor(c)).toBe(mapColor({ ...c, deco: null }));
    }
  });

  it('kommt die Figur in seine Nähe, bimmelt es einmal; sie läuft weiter; erst nach dem Weggehen bimmelt es wieder', () => {
    let s = at(fx - 3, fy);
    const rings: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = move(s, 'e');
      rings.push(of(r.events, 'numflag').length);
      for (const e of of(r.events, 'numflag')) expect(e).toEqual({ type: 'numflag', x: fx, y: fy, n: flag.note });
      expect(r.state.player.x).toBe(s.player.x + 1); // kein Halt: auch über das Fähnchen läuft sie hinweg
      s = r.state;
    }
    // von −3: nach −2 nichts, nach −1 bimmelt es, dann auf dem Fähnchen und daneben still, danach weg
    expect(rings).toEqual([0, 1, 0, 0, 0]);
    expect(s.player.x).toBe(fx + 2);
    expect(of(move(s, 'w').events, 'numflag')).toHaveLength(1); // wieder herein: es bimmelt wieder
    expect(progressOf(s).packs).toEqual({ eis: { v: 1, snow: {}, gast: 1 } }); // kein Spielstand der Fähnchen: nur der erste Besuch des Tals
  });

  it('placeFlags: jedes auf dem nächsten blanken Feld, nie auf Gesperrtem, nie am Glockenspiel; ohne Platz fehlt die Nummer', () => {
    const snow: Cell = { h: 1, ground: 'snow', deco: null, region: 'eis', solid: false };
    const map = new Map<string, Cell>();
    for (let y = -10; y <= 10; y++) for (let x = -10; x <= 40; x++) map.set(`${x},${y}`, snow);
    map.set('0,0', { ...snow, deco: 'tree', solid: true });
    map.set('20,0', { ...snow, deco: 'icicle' });
    for (let y = -10; y <= 10; y++) for (let x = 30; x <= 40; x++) map.set(`${x},${y}`, { ...snow, ground: 'ice' });
    placeFlags(
      [
        [0, 0],
        [10, 0],
        [20, 0],
        [36, 0],
      ],
      map,
      new Set(['10,0']),
    );
    const flags = [...map]
      .filter(([, c]) => c.deco === 'numflag')
      .map(([k, c]) => [k, c.note] as const)
      .sort((a, b) => a[1]! - b[1]!);
    expect(flags.map(([, n]) => n)).toEqual([1, 2, 3]); // die 4 fände nur Eis: Sie fehlt
    const [one, two, three] = flags.map(([k]) => k.split(',').map(Number) as [number, number]);
    expect(Math.hypot(...one!)).toBe(1); // neben der Tanne
    expect(Math.hypot(two![0] - 10, two![1])).toBe(1); // neben dem gesperrten Feld
    expect(Math.max(Math.abs(three![0] - 20), Math.abs(three![1]))).toBe(5); // fünf Felder vom Eiszapfen
  });

  it('Bild: Mast und blaues Tuch mit der Ziffer in Weiß zur Kamera, so viele Pixel wie das Zeichen, im Feld, ohne Gold', () => {
    for (let n = 1; n <= 9; n++) {
      const boxes = flagBoxes({ h: 2, ground: 'snow', deco: 'numflag', region: 'eis', solid: false, note: n }, 5, -3);
      const ink = boxes.filter((b) => b[6] === PLACE_COLORS.ink);
      expect(ink).toHaveLength(DIGITS[n]!.join('').split('#').length - 1);
      const cloth = boxes.find((b) => b[6] === PLACE_COLORS.cloth[0])!;
      for (const [x, y, z, w, d, h, side] of boxes) {
        expect(x).toBeGreaterThanOrEqual(5);
        expect(x + w).toBeLessThanOrEqual(6);
        expect(y).toBeGreaterThanOrEqual(-3);
        expect(y + d).toBeLessThanOrEqual(-2);
        expect(z).toBeGreaterThanOrEqual(2);
        expect(z + h).toBeLessThanOrEqual(3.5);
        expect(side).not.toBe(GOLD.side);
      }
      // jede Ziffer liegt vor dem Tuch (zur Kamera) und in seiner Fläche
      for (const [x, y, z, w, , h] of ink) {
        expect(y).toBeGreaterThanOrEqual(cloth[1] + cloth[4] - 1e-9);
        expect(x).toBeGreaterThanOrEqual(cloth[0]);
        expect(x + w).toBeLessThanOrEqual(cloth[0] + cloth[3] + 1e-9);
        expect(z).toBeGreaterThanOrEqual(cloth[2]);
        expect(z + h).toBeLessThanOrEqual(cloth[2] + cloth[5] + 1e-9);
      }
    }
    const c = FLAGS[0]![1];
    const [x, y] = FLAGS[0]![0];
    const hook = { now: 0, reduced: false, picked: {}, packs: {} } as never;
    expect(view.decos.numflag!(world, c, x, y, hook)).toEqual(flagBoxes(c, x, y));
    expect(view3d.decos.numflag!(world, c, x, y, hook)).toEqual(flagBoxes(c, x, y));
  });
});

describe('Spielorte: Töne und Hinführen', () => {
  it('Töne in der Pentatonik: Fähnchen höher mit der Zahl, die Laterne drei Töne hinauf; die Ansicht spielt beide', () => {
    const first = Array.from({ length: 9 }, (_, i) => flagScore(i + 1));
    expect(first.every((score) => score.length === 2 && score.every(([hz]) => penta(hz)))).toBe(true);
    expect(first.every((score, i) => i === 0 || score[0]![0] > first[i - 1]![0]![0])).toBe(true);
    expect(LAMP_SCORE.every(([hz]) => penta(hz))).toBe(true);
    expect(LAMP_SCORE.every(([hz], i) => i === 0 || hz > LAMP_SCORE[i - 1]![0])).toBe(true);
    expect(view.score!({ type: 'numflag', x: 0, y: 0, n: 4 })).toEqual(flagScore(4));
    expect(view.score!({ type: 'treelamp', x: 0, y: 0 })).toEqual(LAMP_SCORE);
  });

  it('beide sind Sehenswürdigkeiten: Fähnchen bis eines bimmelt, Laternen nur die, die noch aus sind; brennende stehen auf der Karte', () => {
    expect(EIS_PACK.sights!.map((s) => s.id)).toEqual(expect.arrayContaining(['eis:faehnchen', 'eis:laternen']));
    expect([SIGHT_OF.numflag, SIGHT_OF.treelamp]).toEqual(['eis:faehnchen', 'eis:laternen']);
    const [flags, lamps] = PLACE_SIGHTS as [(typeof PLACE_SIGHTS)[number], (typeof PLACE_SIGHTS)[number]];
    const s = { ...at(0, 0), found: [] } as never;
    expect(flags.cells(world, s)).toHaveLength(9);
    expect(lamps.cells(world, s)).toHaveLength(LAMPS.length);
    expect(lamps.marks!(world, s)).toEqual([]);
    const one = LAMPS[0]!;
    const lit = { ...at(0, 0, { packs: { eis: { v: 1, snow: {}, lit: [one.join(',')] } } }), found: [] } as never;
    expect(lamps.cells(world, lit)).toHaveLength(LAMPS.length - 1);
    expect(lamps.marks!(world, lit)).toEqual([one]);
    expect(flags.call(world, FLAGS[2]![0])).toMatchObject({ type: 'numflag', n: 3 });
  });
});
