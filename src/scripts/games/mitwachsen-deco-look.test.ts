import { describe, expect, it } from 'vitest';
import type { Cell, Deco } from './mitwachsen-cell';
import { PILZ_OVER } from './mitwachsen-home';
import { decoBoxes, fenceBoxes, lilyBoxes, shelterBoxes, type Neighbours, type Shelter } from './mitwachsen-deco-look';
import { haloCompact } from '../../lib/games/shade';
import { TREE_HULL, treeBoxes } from './mitwachsen-tree-look';
import type { Box } from './mitwachsen-view';

const cell = (deco: Deco | null, extra: Partial<Cell> = {}): Cell => ({
  h: 1,
  ground: 'grass',
  deco,
  region: 'wild',
  solid: false,
  ...extra,
});
/** Welt aus einer Karte der Nachbarn ("x,y" → Deko-Art), sonst leer */
const around = (map: Record<string, Deco>): Neighbours => ({ cell: (x, y) => ({ deco: map[`${x},${y}`] ?? null }) });
const SHELTER: Shelter = { x0: 10, y0: 20, x1: 16, y1: 22 };
const at = (deco: Deco, extra: Partial<Cell> = {}, world = around({}), picked = {}) =>
  decoBoxes(world, cell(deco, extra), 3, 5, picked, () => SHELTER);

const OWN: Deco[] = [
  'tree',
  'bush',
  'flower',
  'fern',
  'boulder',
  'mushroom',
  'reed',
  'lily',
  'cactus',
  'crystal',
  'stalagmite',
  'bigshroom',
  'trough',
  'watertrough',
  'cloudpuff',
  'hedge',
  'arch',
  'fence',
];

describe('Dinge aus einer Quelle für 2D und 3D (decoBoxes)', () => {
  it.each(OWN)('%s: Quader mit Größe, rund um sein Feld', (deco) => {
    const boxes = at(deco)!;
    expect(boxes.length).toBeGreaterThan(0);
    expect(boxes.every((b) => b[3] > 0 && b[4] > 0 && b[5] > 0)).toBe(true);
    // höchstens so weit über das Feld wie die breiteste Baumkrone (Palme)
    const { x, y } = TREE_HULL.palm;
    expect(
      boxes.every((b) => b[0] >= 3 + x[0] && b[0] + b[3] <= 3 + x[1] && b[1] >= 5 + y[0] && b[1] + b[4] <= 5 + y[1]),
    ).toBe(true);
  });

  it('was sich bewegt oder Regeln zeigt, zeichnen die Ansichten selbst', () => {
    for (const deco of [
      'bed',
      'sign',
      'klangstein',
      'gate',
      'bridge',
      'biggate',
      'gatetower',
      'portal',
      'igloo',
    ] as const)
      expect(at(deco), deco).toBeNull();
    expect(decoBoxes(around({}), cell(null), 0, 0, {}, () => SHELTER)).toBeNull();
  });

  it('Baum nach seiner Art (ohne Art eine Eiche), Busch ohne Beeren, wenn gepflückt', () => {
    expect(at('tree', { tree: 'pine' })).toEqual(treeBoxes('pine', 3, 5, 1));
    expect(at('tree')).toEqual(treeBoxes('oak', 3, 5, 1));
    const full = at('bush')!.length;
    expect(at('bush', {}, around({}), { '3,5': 1 })!.length).toBe(full - 5);
    expect(at('bush', {}, around({}), { '4,5': 1 })!.length).toBe(full);
  });

  it('Farbe aus dem Feld: Blume, Kristall (leuchtet, kompakte Teile mit `halo`), Riesenpilz', () => {
    expect(at('flower', { color: '#5aa6e8' })![1]![6]).toBe('#5aa6e8');
    expect(at('flower')![1]![6]).toBe('#ffffff');
    const gems = at('crystal', { color: '#6fd6f0' })!;
    const lit = gems.filter((b) => b[9]?.halo);
    expect(lit).toHaveLength(4); // Säule, Spitze, zwei Nebenkristalle
    expect(lit[0]![6]).toBe('#6fd6f0');
    // leuchten wird nur, was kompakt ist: die Spitze und die Nebenkristalle, nicht die hohe Säule
    expect(lit.filter((b) => haloCompact(b[3], b[4], b[5]))).toHaveLength(3);
    // Lichtkanten liegen vorn auf der Säule, knapp davor (kein Flimmern)
    const [pillar] = lit;
    const edges = gems.filter((b) => b[6] === '#ffffff');
    expect(edges).toHaveLength(2);
    expect(edges[0]![1]).toBeGreaterThan(pillar![1] + pillar![4] - 0.01);
    expect(at('crystal')![0]![6]).toBe('#b48cf0');
    const shroom = at('bigshroom', { color: '#9b78e0' })!;
    expect(shroom.filter((b) => b[8] === 'see' && b[6] === '#9b78e0')).toHaveLength(2);
    expect(at('bigshroom')![1]![6]).toBe('#d9473a');
  });

  it('kleiner Pilz: Stiel, Hut mit Kuppe leuchtet kompakt, Tupfen vorn auf dem Hut', () => {
    const [stem, cap, top, ...dots] = at('mushroom')!;
    expect(stem![5]).toBeCloseTo(0.16);
    expect([cap, top].every((b) => b![9]?.halo && haloCompact(b![3], b![4], b![5]))).toBe(true);
    expect(dots).toHaveLength(2);
    expect(dots.every((b) => b[6] === '#ffffff' && b[1] >= cap![1] + cap![4] - 0.01)).toBe(true);
  });

  it('Futtertrog mit Heu und Möhren, Wassertrog mit Wasser; beide aus Holz', () => {
    const hay = at('trough')!,
      water = at('watertrough')!;
    expect(hay.some((b) => b[6] === '#d9b85a') && hay.some((b) => b[6] === '#f08a3c')).toBe(true);
    expect(water.some((b) => b[6] === '#3f8fd8')).toBe(true);
    expect(water.some((b) => b[6] === '#d9b85a')).toBe(false);
    expect(hay.filter((b) => b[9]?.skin === 'holz').length).toBeGreaterThanOrEqual(8);
  });

  it('Seerose knapp über dem Wasser (0,82), egal wie hoch das Feld steht', () => {
    expect(lilyBoxes(2, 4).every((b) => b[2] > 0.82)).toBe(true);
    expect(at('lily', { h: 0 })).toEqual(lilyBoxes(3, 5));
  });
});

describe('Hecke, Rosenbogen und Zaun verbinden sich mit ihren Nachbarn', () => {
  it('Hecke: ein Busch je Nachbar mit Hecke oder Bogen dazu, durchsichtig vor der Figur', () => {
    const alone = at('hedge')!;
    const joined = at('hedge', {}, around({ '3,4': 'hedge', '4,5': 'arch', '2,5': 'fence' }))!;
    expect(joined.length - alone.length).toBe(2);
    expect(joined.filter((b) => b[6] === '#3f9a3c').every((b) => b[8] === 'see')).toBe(true);
    for (const [map, n] of [
      [{ '2,5': 'hedge' }, 1],
      [{ '3,6': 'hedge' }, 1],
    ] as const)
      expect(at('hedge', {}, around(map))!.length - alone.length).toBe(n);
    // gelbe Blüte nur auf manchen Feldern
    const flowers = [0, 1, 2].map(
      (x) => decoBoxes(around({}), cell('hedge'), x, 0, {}, () => SHELTER)!.filter((b) => b[6] === '#f2d14b').length,
    );
    expect(flowers).toEqual([1, 0, 0]);
  });

  it('Rosenbogen quer zur Hecke: zwei Pfosten, Laub obenauf, vier Rosen', () => {
    const across = at('arch', {}, around({ '2,5': 'hedge', '4,5': 'hedge' }))!;
    const along = at('arch', {}, around({ '3,4': 'hedge', '3,6': 'hedge' }))!;
    for (const boxes of [across, along]) {
      expect(boxes.filter((b) => b[5] === 1.3)).toHaveLength(2);
      expect(boxes.filter((b) => b[6] === '#e77fb3' || b[6] === '#ffffff')).toHaveLength(4);
    }
    const posts = (boxes: readonly Box[]) => boxes.filter((b) => b[5] === 1.3).map((b) => b[0]);
    expect(new Set(posts(across)).size).toBe(2); // nebeneinander
    expect(new Set(posts(along)).size).toBe(1); // hintereinander
  });

  it('Zaun: Pfosten und eine Latte je Nachbar mit Zaun oder Tor', () => {
    const world = around({ '3,4': 'fence', '2,5': 'gate', '4,5': 'fence', '3,6': 'fence' });
    expect(fenceBoxes(world, 3, 5, 1)).toHaveLength(5);
    expect(fenceBoxes(around({}), 3, 5, 1)).toHaveLength(1);
    expect(fenceBoxes(world, 3, 5, 1).every((b) => b[9]?.skin === 'holz')).toBe(true);
  });

  it('Gartentor: Flügel klappt beim Öffnen zur Seite weg, offen ist er weg', () => {
    const across = around({ '3,5': 'gate', '2,5': 'fence', '4,5': 'fence' });
    const along = around({ '3,5': 'gate', '3,4': 'fence', '3,6': 'fence' });
    expect(fenceBoxes(across, 3, 5, 1, 1)[0]![3]).toBe(1);
    expect(fenceBoxes(across, 3, 5, 1, 0.5)[0]![3]).toBe(0.5);
    expect(fenceBoxes(along, 3, 5, 1, 0.25)[0]![4]).toBe(0.25);
    expect(fenceBoxes(along, 3, 5, 1, 0)).toEqual([]);
  });
});

describe('Riesenpilz am Unterstand (shelterBoxes)', () => {
  it('Stiel auf seinem Feld, der Hut deckt den ganzen Unterstand und ragt `PILZ_OVER` über', () => {
    const boxes = at('shelterpilz')!;
    expect(boxes).toEqual(shelterBoxes(3, 5, 1, SHELTER));
    const stem = boxes[0]!;
    expect(stem[8]).toBeUndefined();
    expect(stem[0] >= 3 && stem[0] + stem[3] <= 4).toBe(true);
    const cap = boxes.filter((b) => b[8] === 'see');
    expect(Math.min(...cap.map((b) => b[0]))).toBeCloseTo(SHELTER.x0 - PILZ_OVER);
    expect(Math.max(...cap.map((b) => b[0] + b[3]))).toBeCloseTo(SHELTER.x1 + 1 + PILZ_OVER);
    const rim = cap.filter((b) => b[6] === '#d9473a');
    expect(Math.max(...rim.map((b) => b[1] + b[4]))).toBeCloseTo(SHELTER.y1 + 1 + PILZ_OVER);
    expect(cap.filter((b) => b[6] === '#ffffff')).toHaveLength(13); // Tupfen
  });

  it('Tupfen liegen auf dem Hut oder vorn an ihm: keiner schwebt, keiner steckt im Hut (auch beim Riesenpilz)', () => {
    const inside = (p: number, lo: number, len: number) => p > lo + 1e-9 && p < lo + len - 1e-9;
    for (const boxes of [shelterBoxes(3, 5, 1, SHELTER), at('bigshroom')!]) {
      const dots = boxes.filter((b) => b[6] === '#ffffff');
      const caps = boxes.filter((b) => b[8] === 'see' && b[6] !== '#ffffff');
      for (const [dx, dy, dz, dw, dd, dh] of dots) {
        const [mx, my] = [dx + dw / 2, dy + dd / 2];
        const under = (b: Box) => inside(mx, b[0], b[3]) && inside(my, b[1], b[4]);
        // getragen: Oberseite eines Hutteils genau darunter, oder vorn an seiner Front
        const lies = caps.some((b) => under(b) && Math.abs(b[2] + b[5] - dz) < 1e-9);
        const hangs = caps.some((b) => inside(mx, b[0], b[3]) && Math.abs(b[1] + b[4] - dy) < 1e-9);
        expect(lies || hangs, `${dx},${dy},${dz}`).toBe(true);
        const buried = caps.some((b) => under(b) && inside(dz + dh / 2, b[2], b[5]));
        expect(buried, `${dx},${dy},${dz}`).toBe(false);
      }
    }
  });
});
