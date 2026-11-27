// Farben der Grotte (Konzept „Höhle nach dem ersten Spielen“, Punkt 4, Schritt 7): Stalagmiten und Felsbrocken mit
// dunklem Fuß und der Farbe ihrer Zone an der Spitze, Flecken im Grottenboden in 2D, der Boden in 3D etwas dunkler, und
// der reine Kontrasttest mit den echten Farben: dunkle Dinge gegen den Boden, Leuchtendes gegen die Maske, Gold gegen den
// Boden. Helligkeit heißt relative Luminanz (wie WCAG), Kontrast (L1 + 0,05) / (L2 + 0,05).
import { describe, expect, it } from 'vitest';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import { SHROOM_COLORS } from '../../../../data/games/mitwachsen-hoehle';
import { GROTTE, GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { Cell } from '../../mitwachsen-cell';
import type { Box } from '../../mitwachsen-view';
import { adornBoxes, caveBoxes, columnBoxes, lighten, patchOf } from './mitwachsen-cave-look';
import { fromMouth } from './mitwachsen-grotte';
import { crystalOf, tipOf, veinOf } from './mitwachsen-fill';
import { FLOOR, brightness, masked, rgbOf, type Rgb } from './mitwachsen-mask';
import { faceShade, vertexShade } from '../../../../lib/games/shade';
import { view } from './view-2d';
import { view3d } from './view-3d';

const C = GROTTE_COLORS;
const contrast = (a: Rgb, b: Rgb) => {
  const [x, y] = [brightness(a), brightness(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** Jeder Boden der Grotte, wie er gezeichnet wird: 2D (Kern) mit beiden Flecken, 3D */
const FLOORS: [string, Rgb][] = [
  ['2D', FLOOR],
  ['Fleck kühl', rgbOf(C.patches[0])],
  ['Fleck rosé', rgbOf(C.patches[1])],
  ['3D', rgbOf(C.floor)],
];
/** Boden unter der vollen Maske (abseits der Figur), auch auf den Flecken */
const DARK = FLOORS.map(([name, c]): [string, Rgb] => [name, masked(c, GROTTE.dark.mask)]);
/** Was leuchtet: Kristalle (auch Büsche, Felder, Lampen, Bogen, Säulen), Leuchtpilze (auch Beete und Schale), Leuchtmoos */
const GLOWING = [...C.crystals, ...SHROOM_COLORS, C.glowmoss[1], C.decoShroom];

/** Farbton (0 … 360) und Sättigung (HSL, 0 … 1) */
function hueSat(hex: string): [number, number] {
  const [r, g, b] = rgbOf(hex).map((v) => v / 255) as unknown as [number, number, number];
  const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)];
  const d = max - min;
  if (d === 0) return [0, 0];
  const hue = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hue * 60, d / (1 - Math.abs(max + min - 1))];
}
/** Liest sich als Gold: Farbton nahe dem des Golds (±15°, Gold selbst: 37°, 0,86) und nicht grau, oder Gelb bis Orange kräftig */
const GOLD_HUE = hueSat(GOLD.top)[0];
const goldish = (hex: string) => {
  const [h, s] = hueSat(hex);
  return (Math.abs(h - GOLD_HUE) <= 15 && s > 0.35) || (h >= 20 && h <= 65 && s > 0.6);
};
/** Liest sich als Wasser: Türkis bis Blau */
const watery = (hex: string) => {
  const [h, s] = hueSat(hex);
  return h >= 160 && h <= 220 && s > 0.3;
};

const cell = (deco: Cell['deco'], extra: Partial<Cell> = {}): Cell => ({
  h: 1,
  ground: 'grotto',
  deco,
  region: 'hoehle',
  solid: !!deco,
  biome: 'hoehle',
  ...extra,
});
const world = { homes: { hoehle: { shelterStem: [0, 0], shelter: { x0: 0, x1: 0, y1: 0 } } } } as never;
const lowest = (boxes: readonly Box[]) => boxes.reduce((a, b) => (b[2] < a[2] ? b : a));
const highest = (boxes: readonly Box[]) => boxes.reduce((a, b) => (b[2] > a[2] ? b : a));

describe('Farben der Grotte: Kontrast mit den echten Farben', () => {
  it('dunkle Dinge gegen den Boden mindestens 3 : 1: Fuß und Mitte der Stalagmiten und Felsbrocken auf jedem Boden (2D, Flecken, 3D)', () => {
    const bad = C.stal.flatMap((c) =>
      FLOORS.filter(([, f]) => contrast(rgbOf(c), f) < 3).map(
        ([n, f]) => `${c} auf ${n}: ${contrast(rgbOf(c), f).toFixed(2)}`,
      ),
    );
    expect(bad).toEqual([]);
    // der Fuß wie im Konzept, etwa 4 : 1 gegen den Boden in 2D
    expect(C.stal[0]).toBe('#5a5478');
    expect(contrast(rgbOf(C.stal[0]), FLOOR)).toBeGreaterThan(4);
  });

  it('Leuchtendes gegen die Maske mindestens 3 : 1: Kristalle und Leuchtpilze gegen den Boden unter der vollen Maske, auch auf den Flecken', () => {
    const bad = GLOWING.flatMap((c) =>
      DARK.filter(([, f]) => contrast(rgbOf(c), f) < 3).map(
        ([n, f]) => `${c} über ${n}: ${contrast(rgbOf(c), f).toFixed(2)}`,
      ),
    );
    expect(bad).toEqual([]);
    // Säulen leuchten in den Farben der Kristalle (beim Klingen noch heller)
    const column = columnBoxes(cell('column', { note: 0 }), 3, 4).find((b) => b[9]?.halo)!; // die Säule
    expect(C.crystals).toContain(column[6]);
    expect(brightness(rgbOf(lighten(C.crystals[0], 0.3)))).toBeGreaterThan(brightness(rgbOf(C.crystals[0])));
  });

  it('mit Verlauf (Feine Grafik): der Fuß wird zur Unterkante dunkler, also nur kontrastreicher; Leuchtendes wird halb so stark schattiert, im Mittel nicht dunkler als früher als flacher Block, und seine helle Oberseite hält 3 : 1', () => {
    // 2D: die Seite schwarz überdeckt von oben nach unten (`faceShade`), 3D: Eckfarben (`vertexShade`)
    const alpha = (c: string) => Number(/,([\d.]+)\)$/.exec(c)![1]);
    const dim = (c: Rgb, a: number): Rgb => c.map((v) => v * (1 - a)) as unknown as Rgb;
    const [, bottom] = faceShade(true).map(alpha) as [number, number];
    for (const [name, f] of FLOORS) {
      expect(contrast(dim(rgbOf(C.stal[0]), bottom), f), name).toBeGreaterThan(4); // Fuß an der Unterkante
      expect(contrast(dim(rgbOf(C.stal[0]), 1 - vertexShade().sideBottom), f), name).toBeGreaterThan(4); // 3D
    }
    const lit = faceShade(true, true).map(alpha);
    const FLAT = 0.18; // so dunkel war die Vorderseite eines flachen Blocks (`box` ohne Maler)
    expect((lit[0]! + lit[1]!) / 2).toBeLessThanOrEqual(FLAT);
    expect(1 - vertexShade(true).sideBottom).toBeLessThanOrEqual(FLAT);
    // die Oberseite wird aufgehellt (weiß), nie abgedunkelt: Was als Farbe 3 : 1 hält, hält es oben auch
    expect(faceShade(false, true).every((c) => c.startsWith('rgba(255,255,255,'))).toBe(true);
    expect(Math.min(vertexShade(true).topFront, vertexShade(true).topBack)).toBeGreaterThanOrEqual(1);
  });

  it('Gold gegen den Boden: im Licht die Seite des Golds mindestens 2,4 : 1 auf jedem Boden, im Dunkel sein Licht mindestens 3 : 1', () => {
    for (const [name, f] of FLOORS) expect(contrast(rgbOf(GOLD.side), f), name).toBeGreaterThanOrEqual(2.4);
    for (const [name, f] of DARK) expect(contrast(rgbOf(GOLD.light), f), name).toBeGreaterThanOrEqual(3);
    // der Boden bleibt hell: Die Flecken sind kaum dunkler als er, der Boden in 3D heller als in 2D (die Maske rechnet mit 2D)
    for (const p of C.patches) expect(brightness(rgbOf(p))).toBeGreaterThan(brightness(FLOOR) * 0.85);
    expect(brightness(rgbOf(C.floor))).toBeGreaterThan(brightness(FLOOR));
  });

  it('keine neue Farbe liest sich als Gold, Türkis bleibt dem Wasser: Spitzen, Fuß und Flecken', () => {
    // auch die hellen Tupfen obenauf, wie sie gezeichnet werden
    const tips = Object.values(C.tips);
    const own = [...tips, ...tips.map((c) => lighten(c, 0.3)), ...C.stal, ...C.patches];
    expect(own.filter(goldish)).toEqual([]);
    expect(own.filter(watery)).toEqual([]);
    expect(own.filter((c) => Object.values(GOLD).includes(c as never))).toEqual([]);
    expect(watery(C.water[0])).toBe(true); // die Probe trifft das Wasser
    expect(goldish(GOLD.top)).toBe(true); // und das Gold
    expect(goldish('#c99a5a')).toBe(true); // auch ein Ocker nahe am Gold (der erste Entwurf des Lehmhangs)
  });
});

describe('Farben je Zone (`tipOf`)', () => {
  it('Pilzgarten grün, Kristallhalle lila, Tropfsteingrotte rosa, Lehmhang ocker; je Zone eine eigene Farbe', () => {
    const { garden, hall, drip, clay } = GROTTE;
    expect(tipOf(...fromMouth([garden.across, garden.out]))).toBe(C.tips.garden);
    expect(tipOf(...fromMouth([hall.across, hall.out]))).toBe(C.tips.hall);
    expect(tipOf(...fromMouth([drip.across, drip.out]))).toBe(C.tips.drip);
    // der ganze Hang, auch an beiden Enden (er liegt von `out - long/2` bis `out + long/2` um `out`)
    for (const dv of [-(clay.long >> 1), 0, clay.long >> 1])
      for (const du of [0, 2 * clay.step - 1])
        expect(tipOf(...fromMouth([clay.across - du, clay.out + dv])), `${du} ${dv}`).toBe(C.tips.clay);
    expect(C.tips).toEqual({ garden: '#86b45a', hall: '#8f6ad8', drip: '#c0609a', clay: '#a9825e' });
    expect(new Set(Object.values(C.tips)).size).toBe(4);
  });

  it('der See hat keine eigene Farbe (Türkis nur fürs Wasser): dort und am Ende die Tropfsteingrotte', () => {
    expect(tipOf(...fromMouth([GROTTE.lake.across, GROTTE.lake.out]))).toBe(C.tips.drip);
    expect(tipOf(...fromMouth(GROTTE.portal))).toBe(C.tips.drip);
    // überall in der Grotte eine der vier Farben
    const seen = new Set<string>();
    for (let v = -GROTTE.shape.ry; v <= GROTTE.shape.ry; v += 4)
      for (let u = -GROTTE.shape.rx; u <= GROTTE.shape.rx; u += 4) seen.add(tipOf(u, v));
    expect([...seen].sort()).toEqual(Object.values(C.tips).sort());
  });
});

describe('Stalagmiten und Felsbrocken: dunkler Fuß, Spitze in der Farbe der Zone', () => {
  it('Stalagmit: unten der Fuß, oben die Spitze in seiner Farbe (`Cell.color`) mit hellem Tupfen; drei Höhen wie bisher', () => {
    for (const note of [0, 1, 2]) {
      const boxes = caveBoxes(world, cell('stalagmite', { note, color: C.tips.drip }), 3, 4)!;
      expect(lowest(boxes)[6]).toBe(C.stal[0]);
      expect(highest(boxes)[6]).toBe(C.tips.drip);
      expect(highest(boxes)[7]).toBe(lighten(C.tips.drip, 0.3));
      const top = Math.max(...boxes.map((b) => b[2] + b[5]));
      expect(top).toBeCloseTo(1 + 1.15 * (1 + note * 0.5), 5);
    }
    // ohne Farbe (ältere Felder) lila wie die Halle; draußen in der Landschaft zeichnet die Ansicht wie immer
    expect(highest(caveBoxes(world, cell('stalagmite'), 0, 0)!)[6]).toBe(C.tips.hall);
    expect(caveBoxes(world, cell('stalagmite', { region: 'wild' }), 0, 0)).toBeNull();
  });

  it('Felsbrocken: dunkler Fuß, obenauf eine Kappe in seiner Farbe; draußen wie immer', () => {
    const boxes = caveBoxes(world, cell('boulder', { color: C.tips.clay }), 3, 4)!;
    expect(lowest(boxes)[6]).toBe(C.stal[0]);
    expect(highest(boxes).slice(6, 8)).toEqual([C.tips.clay, lighten(C.tips.clay, 0.3)]);
    expect(caveBoxes(world, cell('boulder', { region: 'wild' }), 0, 0)).toBeNull();
  });
});

describe('Flecken im Grottenboden (2D) und Boden in 3D', () => {
  const { cool, warm } = GROTTE.patch;
  it('2D: wo das Rauschen des Bodens unter `cool` liegt kühl lila, über `warm` zart rosé, dazwischen nichts', () => {
    expect(patchOf(cell(null, { shade: cool - 0.1 }))).toBe(C.patches[0]);
    expect(patchOf(cell(null, { shade: warm + 0.1 }))).toBe(C.patches[1]);
    expect(patchOf(cell(null, { shade: 0 }))).toBeUndefined();
    expect(patchOf(cell(null))).toBeUndefined();
    const flat = view.ground(cell(null, { shade: -1 }), 2, 3, false)!;
    expect(flat).toEqual([2, 3, 1, 1, 1, 0.01, C.patches[0], C.patches[0]]);
    expect(view.ground(cell(null, { shade: 0 }), 2, 3, false)).toBeNull();
  });

  it('2D: Licht und Randschatten haben Vorrang; kein Fleck auf Moos, Steg, Fels oder draußen', () => {
    expect(view.ground(cell(null, { shade: -1, light: 0.3 }), 2, 3, false)?.[6]).not.toBe(C.patches[0]);
    expect(view.ground(cell(null, { shade: -1, dim: 0.2 }), 2, 3, false)?.[6]).not.toBe(C.patches[0]);
    for (const c of [
      cell(null, { shade: -1, ground: 'grass' }),
      cell('jetty', { shade: -1, ground: 'path' }),
      cell('rock', { shade: -1, region: 'border' }),
      cell(null, { shade: -1, region: 'wild' }),
    ])
      expect(patchOf(c), `${c.ground} ${c.region}`).toBeUndefined();
  });

  it('3D: der Boden etwas dunkler als früher (#e6e2f2), ohne Flecken', () => {
    expect(view3d.ground(cell(null), [])?.top).toBe(C.floor);
    expect(view3d.ground(cell(null, { shade: -1 }), [])?.top).toBe(C.floor);
    expect(brightness(rgbOf(C.floor))).toBeLessThan(brightness(rgbOf('#e6e2f2')));
  });
});

describe('Fülle (Schritt 8): Kristallfelder, Adern, Leuchtmoos', () => {
  it('Kristalle je Zone in einer Farbe: Halle und Lehmhang lila, Tropfsteingrotte, See und Pilzgarten rosa, nie Türkis', () => {
    const { garden, hall, drip, clay, lake } = GROTTE;
    const [lila, , rosa] = C.crystals;
    expect(crystalOf(...fromMouth([hall.across, hall.out]))).toBe(lila);
    expect(crystalOf(...fromMouth([drip.across, drip.out]))).toBe(rosa);
    expect(crystalOf(...fromMouth([lake.across, lake.out]))).toBe(rosa);
    expect(crystalOf(...fromMouth([drip.across + drip.basin, drip.out]))).toBe(rosa); // am Felsbecken
    expect(crystalOf(...fromMouth([garden.across, garden.out]))).toBe(rosa);
    expect(crystalOf(...fromMouth([clay.across, clay.out]))).toBe(lila);
    // Türkis bleibt dem Wasser: kein Kristall der Füllung, auch kein flaches Kristallfeld, liest sich als Wasser
    const zones = [garden, hall, drip, clay, lake].map((z) => crystalOf(...fromMouth([z.across, z.out])));
    expect(zones.filter(watery)).toEqual([]);
    expect(zones).not.toContain(C.crystals[1]);
  });

  it('Adern nur Rosa (Tropfsteingrotte) oder Lila (sonst): nie Türkis oder Blau, nie Gold, dunkler als der Boden, aber zu sehen', () => {
    const { hall, drip, garden, lake } = GROTTE;
    expect(veinOf(...fromMouth([drip.across, drip.out]))).toBe(C.veins[1]);
    expect(veinOf(...fromMouth([lake.across, lake.out]))).toBe(C.veins[1]);
    expect(veinOf(...fromMouth([hall.across, hall.out]))).toBe(C.veins[0]);
    expect(veinOf(...fromMouth([garden.across, garden.out]))).toBe(C.veins[0]);
    const hues = C.veins.map((c) => hueSat(c)[0]);
    expect(hues[0]).toBeGreaterThan(240); // Lila
    expect(hues[0]).toBeLessThan(290);
    expect(hues[1]).toBeGreaterThan(300); // Rosa
    expect([...C.veins].filter(watery)).toEqual([]);
    expect([...C.veins].filter(goldish)).toEqual([]);
    for (const v of C.veins)
      for (const [name, f] of FLOORS) {
        expect(brightness(rgbOf(v)), `${v} ${name}`).toBeLessThan(brightness(f)); // leuchtet nicht
        expect(contrast(rgbOf(v), f), `${v} ${name}`).toBeGreaterThanOrEqual(1.4); // ein Streifen, kein Hauch
      }
  });

  it('Leuchtmoos hellgrün #86e05a, gegen den Boden unter der Maske mindestens 3 : 1, heller als das Moos der Wiese, nie Gold', () => {
    expect(C.glowmoss[1]).toBe('#86e05a');
    for (const m of C.moss) expect(brightness(rgbOf(C.glowmoss[1]))).toBeGreaterThan(brightness(rgbOf(m)));
    expect([...C.glowmoss].filter(goldish)).toEqual([]);
    expect([...C.glowmoss].filter(watery)).toEqual([]);
    // das Polster zeigt die helle Farbe obenauf, an der Wand wächst es hoch (`note` die Seite)
    const flat = adornBoxes(cell('glowmoss', { solid: false }), 3, 4)!;
    const wall = adornBoxes(cell('glowmoss', { solid: false, note: 0 }), 3, 4)!;
    expect(flat.every((b) => b[7] === C.glowmoss[1])).toBe(true);
    expect(Math.max(...flat.map((b) => b[2] + b[5]))).toBeLessThan(1.15);
    const climb = wall.reduce((a, b) => (b[5] > a[5] ? b : a));
    expect(climb[5]).toBeGreaterThan(0.8);
    expect(climb[3]).toBeGreaterThan(climb[4]); // Norden: an der Wand quer, dünn
    expect(climb[1]).toBe(4); // an der Nordkante des Felds
  });
});

describe('Sammelstellen (Schritt 9): Deko-Pilze, Beete, Tropfquelle', () => {
  it('Deko-Pilze haben eine eigene Farbe, die nie gesammelt wird: Weiß-Blau, nicht in SHROOM_COLORS und weit weg von jeder', () => {
    expect(C.decoShroom).toBe('#cfe8ff');
    expect(SHROOM_COLORS as readonly string[]).not.toContain(C.decoShroom);
    expect(C.shrooms as readonly string[]).not.toContain(C.decoShroom);
    // auch nicht fast gleich: jeder Kanal einer Sammelfarbe weicht deutlich ab
    for (const k of SHROOM_COLORS) {
      const d = rgbOf(k).map((v, i) => Math.abs(v - rgbOf(C.decoShroom)[i]!));
      expect(Math.max(...d), k).toBeGreaterThan(40);
    }
    expect(goldish(C.decoShroom)).toBe(false);
  });

  it('Pilzbeet: der dunkle Felsrand hebt sich vom Moos ab (mindestens 2 : 1), die Pilze vom Rand (mindestens 3 : 1); nirgends Gold', () => {
    expect(C.bedRim[0]).toBe('#4a3f6b');
    for (const m of C.moss) expect(contrast(rgbOf(C.bedRim[0]), rgbOf(m)), m).toBeGreaterThanOrEqual(2);
    for (const k of SHROOM_COLORS) expect(contrast(rgbOf(k), rgbOf(C.bedRim[1])), k).toBeGreaterThanOrEqual(3);
    expect([...C.bedRim, ...C.bright].filter(goldish)).toEqual([]);
  });

  it('Pilze der Beete, wie gezeichnet: nur das gelbe Beet liest sich als Gold (offene Frage an den Vater, docs/todo.md)', () => {
    // Je Beet eine Farbe, fünf Pilze, der Hut obenauf heller: Das gelbe Beet (#ffe08a) liegt im Farbton des Golds. Bis der
    // Vater entscheidet (Gelb bleibt oder wird etwa Gelbgrün), hält der Test fest, dass es nur dieses eine ist.
    const caps = new Set<string>();
    for (let x = 0; x < 12; x++)
      for (const b of caveBoxes(world, cell('shroombed'), x, 0, true) ?? []) if (b[2] > 1.3) caps.add(b[6]).add(b[7]);
    const yellow = SHROOM_COLORS[2];
    expect([...caps].filter(goldish).sort()).toEqual([yellow, lighten(yellow, 0.25)].sort());
  });

  it('Tropfquelle und Ufersteine hell: heller als der Fels der Grotte, gegen den Boden unter der Maske mindestens 3 : 1', () => {
    for (const b of C.bright) {
      expect(brightness(rgbOf(b))).toBeGreaterThan(brightness(rgbOf(C.rock[1])));
      for (const [name, f] of DARK) expect(contrast(rgbOf(b), f), `${b} ${name}`).toBeGreaterThanOrEqual(3);
    }
  });
});
