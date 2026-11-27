// Bäume und Beerenbüsche als Modelle aus Quadern (Entwurf „Feine Grafik“): schmaler Stamm mit Fuß und Ast, Krone in
// Stufen aus mehreren Quadern in drei Tönen, gleich für 2D und 3D (`Box`, wie die Dinge der Welt-Pakete). Feld, Hindernis
// und Größe bleiben: Jede Art bleibt in der Hülle, die sie als Blockbaum hatte (`TREE_HULL`). Laub ist `see` (in 3D vor
// der Figur durchsichtig), Stamm, Ast, Beeren und Kokosnüsse sind fest. Teile stoßen aneinander, statt ineinander zu
// stecken: 2D malt Quader nacheinander (mitwachsen-row.ts), Durchdringendes malte es falsch.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Bild“, Zeilen „Natur“ und „Beerenbüsche“)

import type { Fine } from '../../lib/games/front';
import { hash } from '../../lib/games/rng';
import type { TreeKind } from './mitwachsen-cell';
import type { Box } from './mitwachsen-view';

/** Hülle eines Modells relativ zur Ecke seines Felds: x von … bis, y (nach vorn) von … bis, Höhe bis */
export type Hull = { readonly x: readonly [number, number]; readonly y: readonly [number, number]; readonly z: number };

/**
 * Hülle je Baumart, gemessen an den Blockbäumen vor dem Umbau (mitwachsen-trees-3d.ts, 27.11.2026): Größer wird kein
 * Baum, sonst ragte er weiter über Torplatten, Bahnsteige, Halte und die Laternen vor den Tannen (Eis-Welt), deren Lage
 * an die Form der Tanne gekoppelt ist
 */
export const TREE_HULL: Readonly<Record<TreeKind, Hull>> = {
  oak: { x: [-0.4, 1.4], y: [-0.4, 1.4], z: 3.15 },
  autumn: { x: [-0.4, 1.4], y: [-0.4, 1.4], z: 3.15 },
  red: { x: [-0.4, 1.4], y: [-0.4, 1.4], z: 3.15 },
  winter: { x: [-0.4, 1.4], y: [-0.4, 1.4], z: 3.15 },
  blossom: { x: [-0.4, 1.4], y: [-0.4, 1.43], z: 3.15 },
  birch: { x: [0.05, 0.95], y: [0.05, 0.95], z: 2.75 },
  pine: { x: [-0.25, 1.25], y: [-0.25, 1.25], z: 2.4 },
  snowpine: { x: [-0.25, 1.25], y: [-0.25, 1.25], z: 2.52 },
  palm: { x: [-0.72, 2.13], y: [-0.85, 1.95], z: 2.42 },
  dead: { x: [0.15, 0.9], y: [0.4, 0.6], z: 1.5 },
};
/** Hülle des Beerenbuschs (gemessen wie die Bäume, samt Beeren) */
export const BUSH_HULL: Hull = { x: [0.05, 0.97], y: [0.12, 0.94], z: 0.75 };

/** Laub je Baumart: Farbe der Seiten und der Oberseite (die Krone mischt daraus ihre drei Töne) */
export const LEAVES: Readonly<Record<TreeKind, readonly [string, string]>> = {
  oak: ['#3f9a3c', '#5ab651'],
  birch: ['#6aab3a', '#8fcf5a'],
  autumn: ['#d9732e', '#f0a04a'],
  red: ['#b8452e', '#d9603a'],
  blossom: ['#e595bd', '#f6c3dc'],
  winter: ['#cfdbe2', '#ffffff'],
  pine: ['#2f6f3a', '#3f8a48'],
  snowpine: ['#2f6f3a', '#ffffff'],
  palm: ['#3f9a3c', '#5ab651'],
  dead: ['#4a3426', '#5d3e21'],
};
const BARK = '#7a5432',
  BARK_FOOT = '#6e4a2c',
  BARK_TOP = '#93683f';
const BERRY: readonly [string, string] = ['#c8323a', '#ef5b5b'];
const RINDE: Fine = { skin: 'rinde' },
  BLATT: Fine = { skin: 'blatt' },
  NADEL: Fine = { skin: 'nadel' },
  HOLZ: Fine = { skin: 'holz' },
  SCHNEE: Fine = { skin: 'schnee' };

/** Farbe zwischen a (t = 0) und b (t = 1), beide #rrggbb */
export function mix(a: string, b: string, t: number): string {
  const p = (c: string, i: number) => parseInt(c.slice(1 + 2 * i, 3 + 2 * i), 16);
  const ch = (i: number) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t);
  return `#${[0, 1, 2].map((i) => ch(i).toString(16).padStart(2, '0')).join('')}`;
}

/** Töne der Krone aus dem Laub einer Art: unten dunkel, Schatten, Mitte, hell, oben */
const tones = ([side, top]: readonly [string, string]) => ({
  under: mix(side, '#000000', 0.3),
  shade: mix(side, '#000000', 0.15),
  main: side,
  light: mix(side, top, 0.5),
  top,
});
/** Oberseite eines Teils: etwas heller als seine Seiten */
const lit = (c: string) => mix(c, '#ffffff', 0.14);

/**
 * Sammler im Maß des Entwurfs: x nach rechts, `up` nach oben, `back` nach hinten (vorn ist −), um die Mitte (cx, cy)
 * des Modells; waagerecht mit `sx`, senkrecht mit `sz` gestaucht, auf Höhe h
 */
export function sketch(cx: number, cy: number, h: number, sx: number, sz: number) {
  const out: Box[] = [];
  const add = (
    x: number,
    up: number,
    back: number,
    w: number,
    hh: number,
    d: number,
    side: string,
    top: string,
    fine?: Fine,
    see?: boolean,
  ) => {
    out.push([
      cx + x * sx,
      cy - (back + d) * sx,
      h + up * sz,
      w * sx,
      d * sx,
      hh * sz,
      side,
      top,
      see ? 'see' : undefined,
      fine,
    ]);
  };
  return { out, add };
}

/** Laubbaum (Eiche, Herbst-, Rot-, Blüten- und Winterbaum): Stamm mit Fuß und Ast, Krone in drei Stufen */
function broadleaf(kind: TreeKind, x: number, y: number, h: number): Box[] {
  const t = tones(LEAVES[kind]);
  const { out, add } = sketch(x + 0.5, y + 0.5, h, 0.6, 0.78);
  const leaf = (lx: number, up: number, back: number, w: number, hh: number, d: number, c: string, top = lit(c)) =>
    add(lx, up, back, w, hh, d, c, top, BLATT, true);
  add(-0.34, 0, -0.34, 0.68, 0.22, 0.68, BARK_FOOT, BARK_FOOT, RINDE);
  add(-0.22, 0.22, -0.22, 0.44, 1.73, 0.44, BARK, BARK_TOP, RINDE); // Stamm vom Fuß bis zur Krone
  add(0.22, 1.45, -0.07, 0.4, 0.14, 0.14, BARK, BARK_TOP, RINDE); // Ast nach rechts
  add(0.5, 1.59, -0.07, 0.14, 0.36, 0.14, BARK, BARK_TOP, RINDE);
  leaf(-0.95, 1.95, -0.9, 1.9, 0.1, 1.8, t.under); // Kronenboden
  // Ausbuchtungen hinten, links und rechts vor der Hauptkrone (in 2D zuerst gezeichnet), dann vorn
  leaf(-0.62, 2.4, 1.0, 1.25, 0.7, 0.45, t.shade);
  leaf(-1.5, 2.2, -0.6, 0.5, 0.72, 1.25, t.shade);
  leaf(1.0, 2.15, -0.5, 0.5, 0.78, 1.1, t.main);
  leaf(-1.05, 2.05, -1.0, 2.1, 1.0, 2.0, t.main);
  leaf(-0.6, 1.98, -1.38, 1.2, 0.72, 0.38, t.light);
  leaf(-0.78, 3.05, -0.72, 1.55, 0.6, 1.45, t.light); // zweite Stufe
  leaf(-0.4, 3.65, -0.36, 0.8, 0.36, 0.72, t.top, t.top); // Spitze
  // Lichtblätter vorn, jedes liegt auf der Front, vor der es sitzt (oben Hauptkrone, unten vordere Ausbuchtung)
  leaf(-0.52, 2.9, -1.03, 0.3, 0.22, 0.03, t.top, t.top);
  leaf(0.25, 2.5, -1.41, 0.26, 0.2, 0.03, t.top, t.top);
  leaf(-0.28, 2.2, -1.42, 0.22, 0.16, 0.03, t.shade);
  if (kind === 'blossom')
    for (let i = 0; i < 8; i++) {
      // Blüten vorn auf der Krone: vor der vorderen Ausbuchtung, sonst vor der Hauptkrone
      const r = hash(17, x, y, i);
      const bx = -0.95 + (r % 180) / 100,
        up = 2.12 + ((r >>> 8) % 80) / 100;
      const front = Math.abs(bx + 0.08) < 0.6 && up < 2.66 ? -1.4 : -1.02;
      add(bx, up, front, 0.15, 0.12, 0.02, '#ffffff', '#ffffff', undefined, true);
    }
  return out;
}

/** Birke: weißer Stamm mit dunklen Ringen und kurzem Ast, schmale Krone in drei Stufen */
function birch(x: number, y: number, h: number): Box[] {
  const t = tones(LEAVES.birch);
  const b = (bx: number, by: number, bz: number, w: number, d: number, hh: number, c: string, top: string): Box => [
    x + bx,
    y + by,
    h + bz,
    w,
    d,
    hh,
    c,
    top,
  ];
  const leaf = (bx: number, by: number, bz: number, w: number, d: number, hh: number, c: string, top = lit(c)): Box => [
    x + bx,
    y + by,
    h + bz,
    w,
    d,
    hh,
    c,
    top,
    'see',
    BLATT,
  ];
  return [
    [x + 0.37, y + 0.37, h, 0.26, 0.26, 0.1, '#d8d2c4', '#e8e4d8', undefined, RINDE],
    [x + 0.41, y + 0.41, h + 0.1, 0.18, 0.18, 1.2, '#e8e4d8', '#f3efe6', undefined, RINDE],
    ...[0.35, 0.8, 1.2].map((z) => b(0.405, 0.585, z, 0.19, 0.015, 0.05, '#3a3a44', '#3a3a44')),
    b(0.59, 0.45, 1.1, 0.2, 0.1, 0.08, '#e8e4d8', '#f3efe6'), // Ast
    leaf(0.1, 0.12, 1.3, 0.8, 0.76, 0.1, t.under),
    leaf(0.05, 0.05, 1.4, 0.9, 0.9, 0.68, t.main),
    leaf(0.15, 0.15, 2.08, 0.7, 0.7, 0.4, t.light),
    leaf(0.3, 0.3, 2.48, 0.4, 0.4, 0.27, t.top, t.top),
  ];
}

/** Höhe einer Stufe der Tanne: Jede steht auf der darunter (2D malt sich Durchdringendes falsch) */
const STEP = 0.46;

/** Tanne: Stamm, vier Stufen Nadeln nach oben schmaler; die Schneetanne mit Schnee auf jeder Stufe und an der Kante */
function conifer(snowy: boolean, x: number, y: number, h: number): Box[] {
  const [side, top] = LEAVES[snowy ? 'snowpine' : 'pine'];
  const { out, add } = sketch(x + 0.5, y + 0.5, h, 1, 1);
  add(-0.1, 0, -0.1, 0.2, 0.5, 0.2, BARK, BARK_TOP, RINDE);
  for (let i = 0; i < 4; i++) {
    const r = 0.75 - i * 0.17,
      up = 0.5 + i * STEP;
    const c = i % 2 ? mix(side, '#ffffff', 0.06) : side;
    add(-r, up, -r, 2 * r, STEP, 2 * r, c, snowy ? '#f4f8fb' : lit(top), NADEL, true);
    if (!snowy) continue;
    // Haube nur obenauf: Auf den unteren Stufen steckte sie in der nächsten (deren Oberseite ist schon Schnee)
    if (i === 3) add(-r * 0.7, up + STEP, -r * 0.7, r * 1.4, 0.05, r * 1.4, '#f4f8fb', '#ffffff', SCHNEE, true);
    add(-r, up + STEP - 0.06, -r, 2 * r, 0.06, 0.05, '#eaf3f9', '#ffffff', SCHNEE, true); // Schnee an der Kante vorn
  }
  if (snowy) add(-0.06, 0.5 + 4 * STEP + 0.05, -0.06, 0.12, 0.08, 0.12, '#f4f8fb', '#ffffff', SCHNEE, true);
  return out;
}

/** Palme: leicht schräger Stamm aus Stücken, oben Wedel im Kreuz und schräg, Wedelspitzen hängen, Kokosnüsse */
function palm(x: number, y: number, h: number): Box[] {
  const [side, top] = LEAVES.palm;
  const { out, add } = sketch(x + 0.58, y + 0.55, h, 1, 0.83);
  for (let i = 0; i < 6; i++)
    add(
      -0.13 + (i - 5) * 0.026,
      i * 0.45,
      -0.13,
      0.26,
      Math.min(0.45, 2.65 - i * 0.45),
      0.26,
      i % 2 ? '#a8804e' : '#b88f58',
      '#c9a066',
      HOLZ,
    );
  add(-0.25, 2.77, -0.25, 0.5, 0.13, 0.5, mix(side, '#000000', 0.2), side, NADEL, true); // Schopf auf den Wedeln
  for (const [dx, dz] of [
    [-1.2, 0],
    [1.2, 0],
    [0, -1],
    [0, 1],
    [-0.8, -0.7],
    [0.8, 0.7],
  ] as const) {
    const c = dx && dz ? mix(side, '#000000', 0.12) : side;
    add(
      Math.min(0, dx) - 0.1,
      2.65,
      Math.min(0, dz) - 0.1,
      Math.abs(dx) + 0.2,
      0.12,
      Math.abs(dz) + 0.2,
      c,
      top,
      NADEL,
      true,
    );
  }
  for (const [tx, tz, w, d] of [
    [-1.3, -0.1, 0.25, 0.2],
    [1.05, -0.1, 0.25, 0.2],
    [-0.1, -1.1, 0.2, 0.22],
    [-0.1, 0.88, 0.2, 0.22],
  ] as const)
    add(tx, 2.35, tz, w, 0.3, d, side, top, NADEL, true); // Wedelspitzen unter den Wedeln
  add(-0.14, 2.5, -0.32, 0.14, 0.14, 0.14, '#6b4423', '#7a5a2a');
  add(0.04, 2.47, -0.3, 0.14, 0.14, 0.14, '#5d3a1e', '#6e5226');
  return out;
}

/** Kahler Baum der Lavaberge: Stamm mit Fuß, zwei Äste mit Zweigen nach oben */
function dead(x: number, y: number, h: number): Box[] {
  const [side, top] = LEAVES.dead;
  const b = (bx: number, by: number, bz: number, w: number, d: number, hh: number, c = side): Box => [
    x + bx,
    y + by,
    h + bz,
    w,
    d,
    hh,
    c,
    c === side ? top : c,
    undefined,
    RINDE,
  ];
  return [
    b(0.36, 0.4, 0, 0.28, 0.2, 0.1, '#3f2c20'),
    b(0.41, 0.41, 0.1, 0.18, 0.18, 1.4),
    b(0.15, 0.45, 0.9, 0.26, 0.1, 0.1),
    b(0.15, 0.45, 1.0, 0.1, 0.1, 0.3),
    b(0.59, 0.45, 1.15, 0.26, 0.1, 0.1),
    b(0.78, 0.46, 1.25, 0.08, 0.08, 0.2),
  ];
}

/** Baum der Art `kind` auf dem Feld (x, y) in Höhe h */
export function treeBoxes(kind: TreeKind, x: number, y: number, h: number): readonly Box[] {
  switch (kind) {
    case 'pine':
    case 'snowpine':
      return conifer(kind === 'snowpine', x, y, h);
    case 'palm':
      return palm(x, y, h);
    case 'dead':
      return dead(x, y, h);
    case 'birch':
      return birch(x, y, h);
    default:
      return broadleaf(kind, x, y, h);
  }
}

/**
 * Beerenbusch: niedrig und rund in zwei Stufen mit Ausbuchtungen links und rechts (Laub `see`), rote Beeren vorn und oben,
 * damit man ihn nicht für einen Baumwipfel hält; `berries` false (gepflückt): keine, bis sie nachwachsen
 */
export function bushBoxes(x: number, y: number, h: number, berries: boolean): readonly Box[] {
  const t = tones(LEAVES.oak);
  const { out, add } = sketch(x + 0.5, y + 0.5, h, 0.8, 0.93);
  add(-0.46, 0, -0.4, 0.92, 0.55, 0.8, t.main, t.top, BLATT, true);
  add(-0.3, 0.55, -0.28, 0.6, 0.15, 0.56, t.light, lit(t.top), BLATT, true); // obere Stufe auf dem Busch
  add(-0.56, 0.04, -0.16, 0.24, 0.4, 0.44, t.shade, t.main, BLATT, true);
  add(0.32, 0.04, -0.2, 0.24, 0.42, 0.5, t.main, t.top, BLATT, true);
  if (!berries) return out;
  for (const [bx, up, back] of [
    [-0.28, 0.2, -0.5],
    [0.02, 0.32, -0.5],
    [0.24, 0.12, -0.5],
    [-0.12, 0.7, -0.05],
    [0.12, 0.7, 0.1],
  ] as const)
    add(bx, up, back, 0.1, 0.1, 0.1, BERRY[0], BERRY[1]);
  return out;
}
