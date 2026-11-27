// Pflanzen in den Torhäusern als feine Modelle (Entwurf „Feine Grafik“, Paket P7b): Palmen am Sandtor, Glutbaum am
// Lavator, Tannen und Laubkrone am Spechtbaum des Waldes, die zwei Riesenpilze des Pilztors. Wie die Bäume der Lichtung
// (mitwachsen-tree-look.ts): schmaler Stamm mit Rinde, Krone in Stufen aus Quadern mit Muster, an derselben Stelle und
// in derselben Größe wie vorher die Voxel. Die Bauten der Torhäuser (Wände, Bögen, Dächer, Platten) bleiben Block-Kit.
// Rein (ohne Three.js): liefert Quader in Torhaus-Koordinaten, die 3D-Ansicht legt sie in den Teil `plant`
// (mitwachsen-gate-kit.ts, `plantInto`).
//
// Koordinaten wie im Torhaus: x entlang des Tors (Mitte 0), y nach oben, z nach vorn (+z schaut zur Lichtung).
// Spezifikation: docs/specs/mitwachsen.md (Zeile „Feinheit“, Torhäuser)

import type { Fine } from '../../lib/games/front';

/** Quader eines feinen Teils im Torhaus: Ecke (x, y, z), Größe (Breite, Höhe, Tiefe), Seite, Oberseite, Feinheit */
export type GateBox = readonly [
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  side: string,
  top: string,
  fine: Fine,
];

const RINDE: Fine = { skin: 'rinde' },
  HOLZ: Fine = { skin: 'holz' },
  NADEL: Fine = { skin: 'nadel' },
  BLATT: Fine = { skin: 'blatt' },
  HAAR: Fine = { skin: 'haar' },
  LACK: Fine = { skin: 'lack' },
  GLUT: Fine = { skin: 'blatt', halo: true };

/** Farbe zwischen a (t = 0) und b (t = 1), beide #rrggbb */
export function tint(a: string, b: string, t: number): string {
  const p = (c: string, i: number) => parseInt(c.slice(1 + 2 * i, 3 + 2 * i), 16);
  const ch = (i: number) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t);
  return `#${[0, 1, 2].map((i) => ch(i).toString(16).padStart(2, '0')).join('')}`;
}

/** Quader um die Mitte (cx, cz) mit halber Breite rx, halber Tiefe rz, von y0 bis y1 */
const around = (
  cx: number,
  cz: number,
  rx: number,
  rz: number,
  y0: number,
  y1: number,
  side: string,
  top: string,
  fine: Fine,
): GateBox => [cx - rx, y0, cz - rz, 2 * rx, y1 - y0, 2 * rz, side, top, fine];

/**
 * Achteck um die Mitte (cx, cz) in der Ellipse mit Halbachsen rx, rz, von y0 bis y1: drei Quader (breit, tief, Mitte),
 * jeder mit einer Ecke auf der Ellipse; die tieferen Quader enden je `lip` (höchstens 0,02) unter und über dem breiten
 * (kein Paar Flächen in einer Ebene)
 */
export function octagon(
  cx: number,
  cz: number,
  rx: number,
  rz: number,
  y0: number,
  y1: number,
  side: string,
  top: string,
  fine: Fine,
  lip = Math.min(0.02, (y1 - y0) / 6),
): GateBox[] {
  const [a, b, c] = [Math.cos(Math.PI / 8), Math.sin(Math.PI / 8), Math.SQRT1_2];
  return [
    around(cx, cz, rx * a, rz * b, y0, y1, side, top, fine),
    around(cx, cz, rx * b, rz * a, y0 + lip, y1 - lip, side, top, fine),
    around(cx, cz, rx * c, rz * c, y0 + 2 * lip, y1 - 2 * lip, side, top, fine),
  ];
}

/**
 * Abstand von der Mitte bis zur Oberfläche des Achtecks (`octagon`) mit Radius 1 in Richtung `angle` (Bogenmaß; bei
 * einer Ellipse der Winkel der Parameterdarstellung: Der Punkt (rx·k·cos, rz·k·sin) liegt auf der Oberfläche)
 */
export function octagonReach(angle: number): number {
  const [a, b, c] = [Math.cos(Math.PI / 8), Math.sin(Math.PI / 8), Math.SQRT1_2];
  const [u, v] = [Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle))];
  const exit = (hx: number, hz: number) => Math.min(u > 1e-9 ? hx / u : Infinity, v > 1e-9 ? hz / v : Infinity);
  return Math.max(exit(a, b), exit(b, a), exit(c, c));
}

/**
 * So weit wächst der n-te Quader nach allen Seiten (`spread`): Kein Paar Flächen liegt in einer Ebene (kein Flackern),
 * auch nicht mit den Voxeln des Torhauses (sie liegen auf Achteln, um 0,004 nach außen gerückt)
 */
export const GROW = { base: 0.0014, step: 0.0004, cycle: 16 } as const;
export const growOf = (n: number) => GROW.base + (n % GROW.cycle) * GROW.step;

/** Jeden Quader um seinen eigenen kleinen Betrag größer: so flackern Teile, die sich berühren, nicht */
export function spread(boxes: readonly GateBox[]): GateBox[] {
  return boxes.map(([x, y, z, w, h, d, side, top, fine], n) => {
    const e = growOf(n);
    return [x - e, y - e, z - e, w + 2 * e, h + 2 * e, d + 2 * e, side, top, fine];
  });
}

/* ---------- Palme (Sandtor) ---------- */

export const PALM = { bark: ['#8a6238', '#a0764a'], leaf: '#4e9a52', leafDark: '#3f7f44', nut: '#6b4423' } as const;
/** Lage einer Palme: Fuß (x, z), Höhe, Neigung oben (Felder, quadratisch nach außen), Drehung der Wedel */
export type Palm = { x: number; z: number; h: number; lean: number; turn: number };
const PALM_SEG = 0.45; // Stammstücke wie an der Palme der Oase
const FROND = { n: 6, step: 0.25 } as const; // je Wedel sechs Stücke bis 1,5 Felder hinaus
/** Fiedern eines Wedels: halbe Breite, wie weit sie in den Stiel greifen und unter ihm hängen (0,05 dick) */
export const PINNA = { half: 0.08, grip: 0.01, drop: 0.03 } as const;
/** Höhe eines Wedels über der Krone im Abstand r: steigt erst, hängt dann durch (wie vorher die Voxel) */
export const frondY = (r: number) => 0.125 + 0.7 * r - 0.88 * r * r;

/** Palme: Stamm aus Stücken nach außen geneigt, Schopf, sechs hängende Wedel mit Fiedern, zwei Kokosnüsse */
export function palmBoxes(o: Palm): GateBox[] {
  const out: GateBox[] = [];
  const lean = (y: number) => o.x + o.lean * (y / o.h) ** 2;
  for (let i = 0, y = 0; y < o.h; i++, y += PALM_SEG) {
    const y1 = Math.min(o.h, y + PALM_SEG);
    const c = PALM.bark[i % 2]!;
    out.push(around(lean((y + y1) / 2), o.z, 0.13, 0.13, y, y1, c, PALM.bark[1], HOLZ));
  }
  const [cx, top] = [lean(o.h), o.h];
  out.push(around(cx, o.z, 0.25, 0.25, top, top + 0.13, PALM.leafDark, PALM.leaf, NADEL)); // Schopf
  out.push(around(cx - 0.08, o.z + 0.2, 0.07, 0.07, top - 0.2, top - 0.06, PALM.nut, '#7a5a2a', {}));
  out.push(around(cx + 0.1, o.z + 0.19, 0.07, 0.07, top - 0.23, top - 0.09, '#5d3a1e', '#6e5226', {}));
  for (let f = 0; f < 6; f++) {
    const a = (f / 6) * Math.PI * 2 + o.turn;
    const [dx, dz] = [Math.cos(a), Math.sin(a) * 0.85];
    for (let s = 1; s <= FROND.n; s++) {
      const [r0, r1] = [(s - 1) * FROND.step, s * FROND.step];
      const [a0, a1] = [frondY(r0), frondY(r1)];
      const [px, pz] = [cx + dx * r1, o.z + dz * r1];
      const half = 0.16 - 0.015 * s; // zur Spitze schmaler
      const c = s % 3 === 2 ? PALM.leafDark : PALM.leaf;
      // jedes Stück reicht von r0 bis r1 (und um `half` darüber hinaus): Der Wedel ist in jeder Richtung geschlossen
      const [x0, x1] = [Math.min(cx + dx * r0, px) - half, Math.max(cx + dx * r0, px) + half];
      const [z0, z1] = [Math.min(o.z + dz * r0, pz) - half, Math.max(o.z + dz * r0, pz) + half];
      const [y0, y1] = [top + Math.min(a0, a1), top + Math.max(a0, a1) + 0.08];
      out.push([x0, y0, z0, x1 - x0, y1 - y0, z1 - z0, c, PALM.leaf, NADEL]);
      if (s % 2 || s === FROND.n) continue;
      // Fiedern zur Seite, etwas tiefer als der Stiel, an ihn gesetzt (sie greifen um `PINNA.grip` in ihn hinein)
      const off = half + PINNA.half - PINNA.grip;
      for (const side of [-1, 1])
        out.push(
          around(
            px - dz * side * off,
            pz + dx * side * off,
            PINNA.half,
            PINNA.half,
            y0 - PINNA.drop,
            y0 - PINNA.drop + 0.05,
            c,
            c,
            NADEL,
          ),
        );
    }
  }
  return out;
}

/* ---------- Glutbaum (Lavator) ---------- */

/** Lage des Glutbaums: Stamm bei (x, z) von y bis h, Krone mal k */
export type GlowTree = { x: number; z: number; y: number; h: number; k: number };
export const GLOW_BARK = { side: '#3b2a22', top: '#4a3529' } as const;
/** Krone: drei Ballen (dx, dz, dy, rx, rz, ry, wie vorher, mal k) */
export const GLOW_CROWN = [
  [0, 0, 0.36, 0.66, 0.66, 0.48],
  [0.06, -0.04, 0.86, 0.5, 0.5, 0.38],
  [-0.03, 0.02, 1.22, 0.3, 0.3, 0.24],
] as const;
/** Lagen eines Ballens: von … bis (in Halbachsen nach oben) und Breite (in Halbachsen) */
const LAYERS = [
  [-1, -0.55, 0.8],
  [-0.55, 0.5, 1],
  [0.5, 1, 0.72],
] as const;
export const SPARK = '#ffe08a';

/** Farben der Krone, heller, sobald der Weg frei ist (`lit` 0,75 … 1) */
export const glowColors = (lit: number) => ({
  base: tint('#d9772e', '#ff9a3c', lit),
  top: tint('#eea040', '#ffc24d', lit),
  under: tint('#b8562a', '#d9702e', lit),
  crack: tint('#c8601a', '#ff8a2a', lit),
});

/**
 * Glutbaum: dunkler Stamm mit Rinde (fest) und Glutriss im Zickzack auf allen vier Seiten, Krone aus drei runden
 * Ballen, jede in drei Lagen über Kreuz, mit Funken vorn (leuchtet von innen: `bright`)
 */
export function glowTreeBoxes(t: GlowTree, lit: number): { solid: GateBox[]; bright: GateBox[] } {
  const c = glowColors(lit);
  const solid = [around(t.x, t.z, 0.25, 0.25, t.y, t.h, GLOW_BARK.side, GLOW_BARK.top, RINDE)];
  const bright: GateBox[] = [];
  const glow: Fine = { halo: true };
  const [cx, cz] = [Math.round(t.x * 8) / 8, Math.round(t.z * 8) / 8];
  // Riss: Stücke zu 0,625, im Wechsel eine Achtel links und rechts der Mitte, 0,008 vor der Rinde
  for (let y = t.y + 0.25, n = 0; y + 0.3 < t.h - 0.25; y += 0.625, n++) {
    const u = n % 2 ? -1 / 16 : 1 / 16;
    const y1 = Math.min(t.h - 0.25, y + 0.625);
    bright.push([cx + u - 0.055, y, cz + 0.25, 0.11, y1 - y, 0.012, c.crack, c.crack, glow]);
    bright.push([cx - u - 0.055, y, cz - 0.262, 0.11, y1 - y, 0.012, c.crack, c.crack, glow]);
    bright.push([cx + 0.25, y, cz - u - 0.055, 0.012, y1 - y, 0.11, c.crack, c.crack, glow]);
    bright.push([cx - 0.262, y, cz + u - 0.055, 0.012, y1 - y, 0.11, c.crack, c.crack, glow]);
  }
  GLOW_CROWN.forEach(([dx, dz, dy, rx, rz, ry], b) => {
    const [bx, by, bz] = [t.x + dx * t.k, t.h + dy * t.k, t.z + dz * t.k];
    const [ax, ay, az] = [rx * t.k, ry * t.k, rz * t.k];
    LAYERS.forEach(([lo, hi, wide], l) => {
      const color = l === 2 ? c.top : b === 0 && l === 0 ? c.under : c.base;
      const [y0, y1] = [by + lo * ay, by + hi * ay];
      bright.push(...octagon(bx, bz, ax * wide, az * wide, y0, y1, color, c.top, GLUT));
    });
    // Funken vorn auf der mittleren Lage, links und rechts neben dem tiefen Quader (vor dem breiten)
    for (const [fx, fy] of [
      [-0.8, 0.1],
      [0.78, -0.25],
    ] as const)
      bright.push([bx + fx * ax - 0.035, by + fy * ay, bz + 0.383 * az, 0.07, 0.07, 0.012, SPARK, SPARK, glow]);
  });
  return { solid, bright };
}

/* ---------- Tanne und Laubkrone (Spechtbaum am Waldsaum) ---------- */

export const FIR = { bark: '#5d3e21', barkTop: '#7a5a3a', side: '#24563a', top: '#2f6a45' } as const;
/** Stufen der Tanne: halbe Breite, von, bis (mal Größe s) */
export const FIR_TIERS = [
  [0.8, 0.45, 1.25],
  [0.6, 1.1, 1.85],
  [0.4, 1.7, 2.4],
  [0.18, 2.3, 2.8],
] as const;

/** Dunkle Tanne in vier Stufen auf schmalem Stamm (Rinde), Nadeln, jede zweite Stufe etwas heller */
export function firBoxes(x: number, z: number, s: number): GateBox[] {
  const out = [around(x, z, 0.1 * s, 0.1 * s, 0, 0.7 * s, FIR.bark, FIR.barkTop, RINDE)];
  FIR_TIERS.forEach(([w, a, b], i) => {
    const side = i % 2 ? tint(FIR.side, '#ffffff', 0.06) : FIR.side;
    out.push(around(x, z, w * s, w * s, a * s, b * s, side, tint(FIR.top, '#ffffff', 0.08), NADEL));
  });
  return out;
}

/** Laub einer Krone: ein Quader von Ecke zu Gegenecke mit Blatt-Muster */
export const leafBox = (
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  side: string,
  top: string,
): GateBox => [x0, y0, z0, x1 - x0, y1 - y0, z1 - z0, side, top, BLATT];

/* ---------- Riesenpilze (Pilztor) ---------- */

/** Riesenpilz als Torpfosten: Mitte des Stiels (x, z), Mitte des Huts in der Tiefe, Unterkante des Huts */
export type Giant = { x: number; z: number; hatZ: number; hatY: number };
export const GIANT = {
  hat: { r1: 2.2, r2: 1.45, h: 1.9 }, // Hut 4,4 breit, 2,9 tief, 1,9 hoch (wie vorher)
  stem: { bottom: 0.99, top: 0.84, height: 3.8 },
  colors: { hat: '#4f7fd9', rim: '#3a63b8', spot: '#d7e4ff', gill: '#2c4a8a', stem: '#efe4d2', groove: '#e0d2ba' },
} as const;
/** Lagen des Huts: Höhe über der Unterkante von … bis und Breite (in Hutradien); vorn reicht er bis z 0,5 */
const HAT_LAYERS = [
  [0.12, 0.45, 1],
  [0.45, 0.95, 0.9],
  [0.95, 1.4, 0.7],
  [1.4, 1.72, 0.45],
  [1.72, 1.9, 0.22],
] as const;
/** Tupfen: auf Lage l, im Ring vor der Lage darüber, seitlich (x, ±) oder vorn (z) */
const SPOTS = [
  [1, 'x', -1],
  [1, 'z', 1],
  [2, 'x', 1],
  [2, 'z', 1],
  [3, 'x', -1],
] as const;

/** Radius des Stiels auf Höhe y: unten breiter, oben schmaler (fassförmig) */
export const stemRadius = (y: number) =>
  GIANT.stem.bottom + (GIANT.stem.top - GIANT.stem.bottom) * Math.min(1, Math.max(0, y / 4));

/** Grenzen der Stiel-Stücke: bis in die Lamellen (der Hut sitzt immer über 3 Feldern: Das letzte Stück ist nie leer) */
const stemCuts = (hatY: number) => [0, 1, 2, 3, Math.min(GIANT.stem.height, hatY + 0.06)] as const;

/** Radius des Stiel-Stücks auf Höhe y (die Stücke enden bei 1, 2, 3 und knapp über der Unterkante des Huts `hatY`) */
export const stemPieceRadius = (y: number, hatY: number) =>
  stemRadius(stemCuts(hatY)[Math.min(4, Math.max(1, Math.floor(y) + 1))]!);

/**
 * Riesenpilz: Stiel in vier Stücken, jedes ein Achteck (Fasern, `haar`) mit zwei Rillen vorn; Hut in fünf Lagen, jede
 * ein Achteck (Lack), darunter die Lamellen, Tupfen auf den Stufen. Innerhalb der Hülle der Voxel von vorher (die Ranken
 * um Stiel und Hutrand bleiben außen)
 */
export function giantBoxes(g: Giant): GateBox[] {
  const { hat, colors } = GIANT;
  const out: GateBox[] = [];
  const cuts = stemCuts(g.hatY);
  for (let i = 0; i < 4; i++) {
    const [y0, y1] = [cuts[i]!, cuts[i + 1]!];
    const r = stemRadius(y1);
    out.push(...octagon(g.x, g.z, r, r, y0, y1, colors.stem, colors.stem, HAAR, 0.006)); // Stücke dicht an dicht
    for (const fx of [-0.2, 0.2])
      // Rillen vorn auf dem tiefen Quader
      out.push([
        g.x + fx * r - 0.02,
        y0 + 0.1,
        g.z + 0.924 * r,
        0.04,
        y1 - y0 - 0.2,
        0.01,
        colors.groove,
        colors.groove,
        {},
      ]);
  }
  const y = g.hatY;
  out.push(...octagon(g.x, g.hatZ, hat.r1 * 0.88, hat.r2 * 0.88, y + 0.04, y + 0.12, colors.gill, colors.gill, {}));
  HAT_LAYERS.forEach(([lo, hi, wide], l) => {
    const c = l === 0 ? colors.rim : colors.hat;
    out.push(...octagon(g.x, g.hatZ, hat.r1 * wide, hat.r2 * wide, y + lo, y + hi, c, colors.hat, LACK));
  });
  for (const [l, axis, sign] of SPOTS) {
    const [, hi, wide] = HAT_LAYERS[l];
    const up = HAT_LAYERS[l + 1]![2];
    // Mitte des Rings zwischen dieser Lage und der darüber, auf dem breiten (x) bzw. tiefen (z) Quader
    const r = ((wide + up) / 2) * 0.924;
    const [px, pz] = axis === 'x' ? [g.x + sign * r * hat.r1, g.hatZ] : [g.x, g.hatZ + sign * r * hat.r2];
    const at = y + hi - (axis === 'x' ? 0 : 0.02); // der tiefe Quader endet 0,02 unter dem breiten
    out.push(around(px, pz, 0.1, 0.08, at, at + 0.012, colors.spot, colors.spot, {}));
  }
  out.push(around(g.x, g.hatZ, 0.12, 0.1, y + hat.h, y + hat.h + 0.012, colors.spot, colors.spot, {})); // Kuppe
  return out;
}
