import { describe, expect, it } from 'vitest';
import { GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import { ARCH_PERCH } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-animals';
import type { Cell } from '../../mitwachsen-cell';
import { drawDeco, type DecoAt, type Turn } from '../../mitwachsen-view';
import { HOEHLE_PACK, worldOf } from '../../test-worlds';
import { FALL_MS, SHED_H, band, caveBoxes, glowOver, lighten, waterfallBoxes } from './mitwachsen-cave-look';
import { TURN_MS, view } from './view-2d';
import { view3d } from './view-3d';
import { openScore } from './mitwachsen-heave-look';

const w = worldOf(1, [HOEHLE_PACK]);
const at: DecoAt = { now: 0, reduced: false, picked: {}, packs: {} };
const cell = (deco: Cell['deco'], extra: Partial<Cell> = {}): Cell => ({
  h: 1,
  ground: 'grotto',
  deco,
  region: 'hoehle',
  solid: true,
  biome: 'hoehle',
  ...extra,
});

describe('Dinge der Kristallgrotte, gleich für 2D und 3D', () => {
  it('jede Deko-Art der Grotte hat Quader, in 2D und 3D dieselben', () => {
    for (const deco of [
      'shroombowl',
      'stonetrough',
      'cavelamp',
      'column',
      'crystalarch',
      'glowshroom',
      'shroombed',
      'dripspring',
      'dripmoss',
      'jetty',
      'crystalbush',
      'boulder',
      'mosstop',
      'clay',
      'puddle',
      'fern',
      'crystalfield',
      'vein',
      'glowmoss',
      'shore',
      'web',
    ] as const) {
      const c = cell(deco, { note: 2, color: '#6fd6f0' });
      // Pilzschale und Steintrog sind leer, bis die Figur sie füllt (`picked`); alles andere wie es steht
      const boxes = caveBoxes(w, c, 5, 7, deco !== 'shroombowl' && deco !== 'stonetrough')!;
      expect(boxes.length, deco).toBeGreaterThan(0);
      expect(drawDeco(view, w, c, 5, 7, at), deco).toEqual(boxes);
      expect(drawDeco(view3d, w, c, 5, 7, at), deco).toEqual(boxes);
      for (const b of boxes) expect(b[2], deco).toBeGreaterThanOrEqual(1); // nichts unter dem Boden
    }
    expect(caveBoxes(w, cell('tree'), 0, 0)).toBeNull();
  });

  it('Pilzbeet voll, bis es abgeerntet ist (`picked`), dann leer, in 2D und 3D gleich; Tropfmoos flach, am Steintrog ein Büschel; nirgends Gold', () => {
    const c = cell('shroombed', { ground: 'grass' });
    const full = drawDeco(view, w, c, 5, 7, at)!;
    const empty = drawDeco(view, w, c, 5, 7, { ...at, picked: { '5,7': 0 } })!;
    expect(full).toEqual(caveBoxes(w, c, 5, 7, true));
    expect(empty).toEqual(caveBoxes(w, c, 5, 7, false));
    expect(drawDeco(view3d, w, c, 5, 7, { ...at, picked: { '5,7': 0 } })).toEqual(empty);
    expect(drawDeco(view, w, c, 5, 7, { ...at, picked: { '6,7': 0 } })).toEqual(full); // ein anderes Beet ist leer
    const top = (boxes: readonly (readonly number[] | readonly unknown[])[]) =>
      Math.max(...boxes.map((b) => (b[2] as number) + (b[5] as number)));
    expect(top(full)).toBeGreaterThan(top(empty)); // die Pilze stehen über dem Rand
    expect(top(caveBoxes(w, cell('dripmoss', { solid: false }), 0, 0)!)).toBeLessThan(1.2); // begehbar, flach
    const trough = caveBoxes(w, cell('stonetrough'), 0, 0)!;
    expect(trough.some((b) => b[6] === GROTTE_COLORS.moss[0])).toBe(true); // Tropfmoos am Rand
    const gold: unknown[] = Object.values(GOLD);
    for (const deco of ['shroombed', 'dripspring', 'dripmoss', 'stonetrough', 'shroombowl'] as const) {
      const colors = [true, false].flatMap((f) => caveBoxes(w, cell(deco), 0, 0, f)!.flatMap((b) => [b[6], b[7]]));
      expect(
        colors.filter((x) => gold.includes(x)),
        deco,
      ).toEqual([]);
    }
  });

  it('Pilzschale und Steintrog leer, bis die Figur sie füllt (`picked` merkt den Takt), in 2D und 3D gleich: voll Pilze bzw. Wasser, leer der dunkle Boden', () => {
    const top = (boxes: readonly (readonly unknown[])[]) =>
      Math.max(...boxes.map((b) => (b[2] as number) + (b[5] as number)));
    const bowl = cell('shroombowl', { ground: 'grass' });
    const empty = drawDeco(view, w, bowl, 5, 7, at)!;
    const full = drawDeco(view, w, bowl, 5, 7, { ...at, picked: { '5,7': 3 } })!;
    expect(empty).toEqual(caveBoxes(w, bowl, 5, 7, false));
    expect(full).toEqual(caveBoxes(w, bowl, 5, 7, true));
    expect(drawDeco(view3d, w, bowl, 5, 7, { ...at, picked: { '5,7': 3 } })).toEqual(full);
    const shrooms = (boxes: readonly (readonly unknown[])[]) =>
      boxes.filter((b) => (GROTTE_COLORS.shrooms as readonly unknown[]).includes(b[6])).length;
    expect([shrooms(empty), shrooms(full) >= 3]).toEqual([0, true]); // leer keine Pilze, voll ein Häufchen
    expect(top(full)).toBeGreaterThan(top(empty));
    const trough = cell('stonetrough', { ground: 'grass' });
    const wet = (boxes: readonly (readonly unknown[])[]) => boxes.some((b) => b[6] === GROTTE_COLORS.water[0]);
    expect(wet(drawDeco(view, w, trough, 5, 7, at)!)).toBe(false);
    expect(wet(drawDeco(view, w, trough, 5, 7, { ...at, picked: { '5,7': 3 } })!)).toBe(true);
    expect(wet(drawDeco(view3d, w, trough, 5, 7, { ...at, picked: { '5,7': 3 } })!)).toBe(true);
  });

  it('Pilzbeet: dunkler Felsrand, voll ein Büschel aus fünf Pilzen in einer Farbe etwa 0,7 hoch wie ein Beerenbusch, leer Stümpfe', () => {
    const c = cell('shroombed', { ground: 'grass' });
    const full = caveBoxes(w, c, 5, 7, true)!;
    const empty = caveBoxes(w, c, 5, 7, false)!;
    expect(full[0]![6]).toBe(GROTTE_COLORS.bedRim[0]); // der Rand
    expect(GROTTE_COLORS.bedRim[0]).toBe('#4a3f6b');
    const caps = full.filter((b) => (GROTTE_COLORS.shrooms as readonly string[]).includes(b[6]));
    expect([caps.length, new Set(caps.map((b) => b[6])).size]).toEqual([5, 1]);
    const top = (boxes: readonly (readonly number[] | readonly unknown[])[]) =>
      Math.max(...boxes.map((b) => (b[2] as number) + (b[5] as number)));
    expect(top(full) - 1).toBeCloseTo(0.7, 1);
    expect(top(empty) - 1).toBeLessThan(0.3); // Stümpfe
    expect(empty.some((b) => (GROTTE_COLORS.shrooms as readonly string[]).includes(b[6]))).toBe(false);
    // je Beet eine der drei Farben, über viele Beete alle drei
    const colors = new Set<string>();
    for (let x = 0; x < 12; x++)
      colors.add(
        caveBoxes(w, c, x, 3, true)!.find(
          (b) => b[6] !== GROTTE_COLORS.bedRim[0] && b[6] !== GROTTE_COLORS.moss[0] && b[6] !== '#efe4d2',
        )![6],
      );
    expect([...colors].sort()).toEqual([...GROTTE_COLORS.shrooms].sort());
  });

  it('Deko-Pilz klein und weiß-blau, kleiner als ein Pilz im Beet; Tropfquelle heller Fels mit Wasserstreifen; helle Steine am Ufer flach', () => {
    const deco = caveBoxes(w, cell('glowshroom', { solid: false }), 0, 0)!;
    expect(deco.some((b) => b[6] === GROTTE_COLORS.decoShroom)).toBe(true);
    expect(Math.max(...deco.map((b) => b[2] + b[5])) - 1).toBeLessThan(0.2);
    const spring = caveBoxes(w, cell('dripspring', { ground: 'grass' }), 0, 0)!;
    expect(spring[0]!.slice(6, 8)).toEqual([...GROTTE_COLORS.bright]);
    const stripe = spring.find((b) => b[6] === GROTTE_COLORS.water[0])!;
    expect(stripe[5]).toBeGreaterThan(0.4); // ein Streifen vorn hinab
    const shore = caveBoxes(w, cell('shore', { solid: false }), 0, 0)!;
    expect(shore.every((b) => b[6] === GROTTE_COLORS.bright[0])).toBe(true);
    expect(Math.max(...shore.map((b) => b[2] + b[5])) - 1).toBeLessThan(0.15);
  });

  it('Kristallbogen: Pfeiler nur an den Enden, der Bogen läuft über alle fünf; Säulen so hoch wie ihr Ton', () => {
    const pillar = caveBoxes(w, cell('crystalarch', { note: 0 }), 0, 0)!;
    const span = caveBoxes(w, cell('crystalarch', { note: 2 }), 0, 0)!;
    expect(pillar.length).toBe(span.length + 1);
    expect(Math.min(...span.map((b) => b[2]))).toBeGreaterThanOrEqual(4); // darunter geht man durch
    // die Unterkante des Bogens ist der Sitzplatz der Fledermäuse (`Cell.perch`): sie hängen genau darunter
    expect(Math.min(...span.map((b) => b[2]))).toBe(1 + ARCH_PERCH);
    // Säulen so hoch, wie ihr Ton es sagt: der tiefste (C5) die höchste, Boden 1 + Höhe 5
    const tops = [0, 1, 2, 3, 4].map((note) =>
      Math.max(...caveBoxes(w, cell('column', { note }), 0, 0)!.map((b) => b[2] + b[5])),
    );
    expect(tops[0]).toBeCloseTo(6);
    expect(tops.every((t, i) => i === 0 || t < tops[i - 1]!)).toBe(true);
  });

  it('Stalagmiten in drei Höhen, draußen in der Landschaft wie immer', () => {
    const tops = [0, 1, 2].map((note) => {
      const boxes = caveBoxes(w, cell('stalagmite', { note }), 0, 0)!;
      return Math.max(...boxes.map((b) => b[2] + b[5]));
    });
    expect(tops[0]).toBeLessThan(tops[1]!);
    expect(tops[1]).toBeLessThan(tops[2]!);
    expect(caveBoxes(w, cell('stalagmite', { region: 'wild' }), 0, 0)).toBeNull();
  });

  it('Unterstand am Bett: jedes Feld der Rückwand ist Kristallwand, die Mitte trägt Dach (vor der Figur durchsichtig) und Pfosten', () => {
    const home = w.homes.hoehle;
    const [sx, sy] = home.shelterStem;
    const side = caveBoxes(w, w.cell(sx - 1, sy), sx - 1, sy)!;
    const mid = caveBoxes(w, w.cell(sx, sy), sx, sy)!;
    expect(side.length).toBe(2);
    expect(mid.length).toBe(8); // Wand, Kristall, Dach mit Fuge vorn, zwei Pfosten aus Holz auf einem Steinfuß
    const roof = mid.find((b) => b[8] === 'see')!;
    expect(roof[2]).toBe(1 + SHED_H);
    expect(roof[0]).toBeLessThan(home.shelter.x0);
    expect(roof[0] + roof[3]).toBeGreaterThan(home.shelter.x1 + 1);
    expect(roof[1] + roof[4]).toBeCloseTo(home.shelter.y1 + 1);
  });
});

describe('Füllung der Grotte', () => {
  it('Kristallbusch niedriger als die Figur, Moos, Lehm und Pfütze flach; Farn und Felsbrocken draußen wie immer; nirgends Gold', () => {
    const top = (boxes: readonly (readonly unknown[])[]) =>
      Math.max(...boxes.map((b) => (b[2] as number) + (b[5] as number)));
    const bush = caveBoxes(w, cell('crystalbush', { color: GROTTE_COLORS.crystals[0] }), 0, 0)!;
    expect(top(bush)).toBeLessThan(1.8); // niedrig wie ein Busch: Boden 1 + weniger als 0,8
    expect(bush.some((b) => b[6] === GROTTE_COLORS.crystals[0])).toBe(true); // in seiner Farbe
    // Moos nur unter den Lichtschächten: der Busch steht auf Stein, nicht auf einem Moospolster
    const moss: unknown[] = [...GROTTE_COLORS.moss];
    expect(bush.filter((b) => moss.includes(b[6]) || moss.includes(b[7]))).toEqual([]);
    for (const deco of ['mosstop', 'clay', 'puddle'] as const)
      expect(top(caveBoxes(w, cell(deco, { solid: false }), 0, 0)!), deco).toBeLessThan(1.2);
    expect(caveBoxes(w, cell('puddle'), 0, 0)!.some((b) => b[6] === GROTTE_COLORS.water[0])).toBe(true); // türkis
    expect(caveBoxes(w, cell('clay'), 0, 0)!.some((b) => b[6] === GROTTE_COLORS.clay[0])).toBe(true);
    for (const deco of ['fern', 'boulder'] as const) {
      expect(caveBoxes(w, cell(deco, { region: 'wild' }), 0, 0), deco).toBeNull();
      expect(drawDeco(view, w, cell(deco, { region: 'wild' }), 0, 0, at), deco).toBeNull();
    }
    const gold: unknown[] = Object.values(GOLD);
    for (const deco of ['crystalbush', 'boulder', 'mosstop', 'clay', 'puddle', 'fern'] as const) {
      const colors = caveBoxes(w, cell(deco, { color: GROTTE_COLORS.crystals[2] }), 3, 4)!.flatMap((b) => [b[6], b[7]]);
      expect(
        colors.filter((x) => gold.includes(x)),
        deco,
      ).toEqual([]);
    }
  });

  it('Fülle: Kristallfeld, Ader und Leuchtmoos flach (niedriger als ein Leuchtpilz, die Ader ein Hauch), das Feld in seiner Farbe und in der Mitte voller; nirgends Gold; draußen nichts', () => {
    const top = (boxes: readonly (readonly unknown[])[]) =>
      Math.max(...boxes.map((b) => (b[2] as number) + (b[5] as number)));
    const color = GROTTE_COLORS.crystals[2];
    const edge = caveBoxes(w, cell('crystalfield', { solid: false, note: 0, color }), 3, 4)!;
    const mid = caveBoxes(w, cell('crystalfield', { solid: false, note: 1, color }), 3, 4)!;
    expect(top(mid)).toBeLessThan(1.4);
    expect(mid.length).toBeGreaterThan(edge.length);
    expect(top(mid)).toBeGreaterThan(top(edge));
    // in seiner Farbe, der größte Splitter mit hellerer Spitze (fein)
    expect(mid.every((b) => b[6] === color || b[6] === lighten(color, 0.45))).toBe(true);
    for (const note of [0, 1, 2, 3]) {
      const vein = caveBoxes(w, cell('vein', { solid: false, note, color: GROTTE_COLORS.veins[0] }), 3, 4)!;
      expect(top(vein), `Ader ${note}`).toBeLessThan(1.03);
      expect(vein.every((b) => b[6] === GROTTE_COLORS.veins[0] && b[0] >= 3 && b[0] + b[3] <= 4.001)).toBe(true);
    }
    for (const note of [undefined, 0, 1, 2, 3]) {
      const moss = caveBoxes(w, cell('glowmoss', { solid: false, note }), 3, 4)!;
      expect(top(moss), `Leuchtmoos ${note}`).toBeLessThan(note === undefined ? 1.15 : 2);
      expect(moss.every((b) => b[0] >= 3 && b[0] + b[3] <= 4.001 && b[1] >= 4 && b[1] + b[4] <= 5.001)).toBe(true);
    }
    const gold: unknown[] = Object.values(GOLD);
    for (const deco of ['crystalfield', 'vein', 'glowmoss', 'waterfall'] as const) {
      const colors = caveBoxes(w, cell(deco, { note: 1 }), 3, 4)!.flatMap((b) => [b[6], b[7]]);
      expect(
        colors.filter((x) => gold.includes(x)),
        deco,
      ).toEqual([]);
      expect(caveBoxes(w, cell(deco, { region: 'wild' }), 3, 4), deco).toBeNull();
    }
  });

  it('Wasserfall am See: Fels mit türkisem Wasser an der Südseite bis auf den See (0,8), Schaum unten; in 2D gleiten helle Streifen hinunter, bei reduzierter Bewegung und in 3D stehen sie still', () => {
    const c = cell('waterfall');
    const still = caveBoxes(w, c, 3, 4)!;
    expect(still).toEqual(waterfallBoxes(c, 3, 4));
    expect(drawDeco(view3d, w, c, 3, 4, at)).toEqual(still);
    expect(drawDeco(view, w, c, 3, 4, { ...at, reduced: true, now: 1234 })).toEqual(still);
    const stream = still.find((b) => b[6] === GROTTE_COLORS.water[0])!;
    expect(stream[2]).toBe(0.8); // bis auf das Wasser des Sees
    expect(stream[1] + stream[4]).toBeGreaterThan(4.9); // an der Südseite, zur Kamera hin
    expect(stream[1] + stream[4]).toBeLessThanOrEqual(5); // im eigenen Feld: der See bleibt, wie er ist
    expect(Math.max(...still.map((b) => b[2] + b[5]))).toBeGreaterThan(3); // ein Merkzeichen, höher als die Figur
    const a = drawDeco(view, w, c, 3, 4, { ...at, now: 0 })!;
    const b = drawDeco(view, w, c, 3, 4, { ...at, now: FALL_MS / 4 })!;
    expect(a).not.toEqual(b);
    // die Streifen fallen (z sinkt) und bleiben am Wasserfall
    const glint = (boxes: readonly (readonly unknown[])[]) => boxes.filter((g) => g[6] === '#ffffff');
    expect(glint(b)[0]![2] as number).toBeLessThan(glint(a)[0]![2] as number);
    for (const g of [...glint(a), ...glint(b)]) expect(g[2] as number).toBeGreaterThanOrEqual(0.8);
  });

  it('Wasser in der Grotte türkis, in 2D und 3D; nie die Farbe der Probe im Bundle-Gate', () => {
    expect(view.water).toEqual(GROTTE_COLORS.water);
    expect(view3d.water).toBe(GROTTE_COLORS.water[0]);
    expect([...GROTTE_COLORS.water].map((c) => c.toLowerCase())).not.toContain('#7fd6ff');
    // türkis: Grün und Blau kräftig, Grün nicht schwächer als ein Viertel unter Blau, Rot deutlich schwächer
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(GROTTE_COLORS.water[0].slice(i, i + 2), 16)) as [
      number,
      number,
      number,
    ];
    expect(r).toBeLessThan(g * 0.6);
    expect(g).toBeGreaterThan(b * 0.75);
  });
});

describe('Zeichenteile der Grotte (2D)', () => {
  it('Lichtfleck als helles Licht obenauf, sonst nichts; kein Wetter, kein Gast; Töne am Tor aus dem Hau-ruck', () => {
    const lit = view.ground(cell(null, { light: 0.3 }), 2, 3, false)!;
    expect(lit.slice(0, 6)).toEqual([2, 3, 1, 1, 1, 0.01]);
    expect(lit[6]).toBe(glowOver(0.3));
    expect(glowOver(0.9)).toBe('rgba(255, 246, 220, 0.45)'); // nie grell
    expect(view.ground(cell(null), 2, 3, false)).toBeNull();
    expect(view.sky!.guestAt(w, {} as never)).toBeNull();
    expect(view.sky!.gateScore()).toEqual(openScore());
    expect(view.heaven).toEqual(GROTTE_COLORS.heaven);
  });

  it('die Leiste klappt beim Wechsel der Gegend um (bei reduzierter Bewegung sofort)', () => {
    const t: Turn = {};
    expect(view.sky!.turnAlbum(t, 'lichtung', 0, false)).toEqual(['lichtung', 1]);
    expect(view.sky!.turnAlbum(t, 'hoehle', 1000, false)).toEqual(['lichtung', 1]);
    expect(view.sky!.turnAlbum(t, 'hoehle', 1000 + TURN_MS / 4, false)).toEqual(['lichtung', 0.5]);
    expect(view.sky!.turnAlbum(t, 'hoehle', 1000 + TURN_MS, false)).toEqual(['hoehle', 1]);
    expect(view.sky!.turnAlbum({ shown: 'lichtung', at: 0 }, 'hoehle', 1, true)).toEqual(['hoehle', 1]);
  });

  it('Zeichen der Gegend: Kristall der Grotte, Blatt der Lichtung, sonst keins', () => {
    const drawn: string[] = [];
    const ctx = {
      set fillStyle(c: string) {
        drawn.push(c);
      },
      fillRect: () => {},
    } as unknown as CanvasRenderingContext2D;
    view.sky!.realmSign(ctx, 'hoehle', 50, 50, 16);
    expect(drawn).toContain(GROTTE_COLORS.crystals[0]);
    drawn.length = 0;
    view.sky!.realmSign(ctx, 'eis', 50, 50, 16);
    expect(drawn).toEqual([]);
  });
});

describe('3D-Teil der Grotte', () => {
  it('Grottenstein in den Schichten, Lichtflecken auch auf Moos; Landschaft draußen bleibt, wie sie ist', () => {
    const floor = view3d.ground(cell(null, { solid: false, light: 0.2 }), [])!;
    expect(floor).toMatchObject({ top: GROTTE_COLORS.floor, side: band(1), light: 0.2 });
    const wall = view3d.ground(cell('rock', { region: 'border', h: 4 }), [])!;
    expect(wall).toMatchObject({ top: GROTTE_COLORS.bands[0], side: band(4) });
    expect(view3d.ground(cell(null, { ground: 'grass', light: 0.3 }), [])).toMatchObject({ light: 0.3 });
    expect(view3d.ground(cell(null, { ground: 'grass' }), [])).toBeNull();
    expect(view3d.ground(cell(null, { region: 'wild' }), [])).toBeNull();
    expect(view3d.ground(cell(null, { biome: 'eis' }), [])).toBeNull();
    expect(view3d.bedFrame!(cell('bed'))).toBeNull();
  });

  it('Höhlenhimmel und Nebel-Maske nur in der Grotte; das Höhlentor hat keine Flügel', () => {
    expect(view3d.air).toEqual({ realm: 'hoehle', sky: GROTTE_COLORS.sky, mist: GROTTE_COLORS.mist });
    expect(view3d.gate).toBe('hoehle');
    expect(view3d.look!.door(1, false, 0)).toEqual([]);
    expect(view3d.look!.icicle(0, 0)).toBe('#ffffff');
  });
});
