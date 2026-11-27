// Zugang zur Lavaberge in 3D (Entwurf „Welten-Zugänge“, Idee E): die Glutkaskade über Basaltstufen.
// Quer im Durchgang liegen vier Basaltstufen übereinander, oben ein Glutteich; über alle Stufen rinnt Lava wie Honig
// und bildet eine glühende Wand, höher als die Figur. Links und rechts steinerne Wangen (man erkennt die Treppe, kommt
// aber nicht hinauf), daneben Säulenbasalt, zur Gasse hin abgestuft wie die Kaskade. Bewegt (`motion`): helle Glutbänder
// wandern langsam über Tritte und Fälle nach unten. Beim Öffnen erkaltet die Glut von oben Stufe für Stufe zu dunklem
// Stein mit glimmenden Fugen; dann sinken die Stufen zu einem flachen Basaltweg ab (anders als im Entwurf, wo man die
// Treppe hinaufsteigt: Im Spiel läuft die Figur auf dem Gelände). Neben dem Gang steht ein großer Glutbaum als
// Wahrzeichen (feines Modell, mitwachsen-gate-flora.ts: leuchtende Krone wie eine Laterne, nichts brennt), an ihm
// das Flammenzeichen als Schild zur Kamera.
// Gehört zur 3D-Ansicht und wird nur mit ihr nachgeladen (Three.js).

import {
  Vox,
  VOX,
  ease,
  hash3,
  homeOf,
  plantInto,
  seg,
  type GateBuild,
  type GateCtx,
  type GateMotion,
  type Part,
} from './mitwachsen-gate-kit';
import { glowTreeBoxes, type GlowTree } from './mitwachsen-gate-flora';
import type { PlateLook } from './mitwachsen-plate';

/* ---------- Farben ---------- */
const RIM = '#2a2b30'; // Fugen im Basalt, Rand am Fuß
const SIDE = ['#4a4c56', '#50525c', '#565964'] as const; // Säulen, je Säule etwas anders
const DECK = '#8a8c98'; // Säulen-Deckel, Oberkante der Wangen
const STONE = '#45474f'; // Stein der Stufen
const STONE_TOP = '#5a5d68';
const LAVA = ['#ff9a30', '#ff8a24', '#ffa23c'] as const; // auf den Tritten
const FALL = ['#f26a1a', '#ea6218', '#f47422'] as const; // an den Stirnseiten tiefer: So liest man die Stufen
const POND = '#ff8424'; // Teich oben
const SAUM = ['#fff0b0', '#fff8dc'] as const; // wo die Lava über die Kante quillt
const CRUST = '#7a3018'; // Glut kurz vor dem Erkalten
const FUGE = '#ff7a1a';
const BAND = ['#ffe2a0', '#ffc066', '#ffa443'] as const; // Glutbänder: Mitte, halb, Rand

/** Farbe zwischen a und b (#rrggbb), t 0 … 1 */
function mix(a: string, b: string, t: number) {
  const ch = (c: string, k: number) => parseInt(c.slice(1 + 2 * k, 3 + 2 * k), 16);
  const v = [0, 1, 2].map((k) => Math.round(ch(a, k) + (ch(b, k) - ch(a, k)) * t));
  return `#${v.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

type Cell = { c: string; part: Part; top?: string };
const key = (i: number, j: number, k: number) => `${i},${j},${k}`;
const NEIGHBOURS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;

/**
 * Ein voller Körper (Stufen, Säulen, Stamm, Krone), von dem nur die Hülle ins Raster kommt: Voxel, an denen ein
 * Nachbar fehlt. Innen sieht man ohnehin nichts, so bleibt der Zugang unter der Voxel-Grenze. Unter dem Boden (j < 0)
 * gilt als voll.
 */
class Body {
  private cells = new Map<string, Cell & { i: number; j: number; k: number }>();
  add(i: number, j: number, k: number, c: string, part: Part = 'solid', top?: string) {
    this.cells.set(key(i, j, k), { i, j, k, c, part, top });
  }
  private full(i: number, j: number, k: number) {
    return j < 0 || this.cells.has(key(i, j, k));
  }
  emit(vox: Vox) {
    for (const v of this.cells.values())
      if (!NEIGHBOURS.every(([a, b, c]) => this.full(v.i + a, v.j + b, v.k + c)))
        vox.set(v.i, v.j, v.k, v.c, v.part, v.top);
  }
}

/* ---------- Die Kaskade (Voxel-Koordinaten: i = 8x, j = 8y, k = 8z) ---------- */
type Step = { kb: number; kf: number; top: number };
/** Stufen von unten (0, vorn) nach oben (3, hinten, mit dem Teich): hinterste und vorderste Reihe, Höhe in Voxeln */
const STEPS: readonly Step[] = [
  { kb: -3, kf: 0, top: 5 },
  { kb: -7, kf: -4, top: 10 },
  { kb: -11, kf: -8, top: 15 },
  { kb: -20, kf: -12, top: 20 },
];
const step = (n: number): Step => STEPS[n] ?? { kb: 1, kf: FRONT - 1, top: 1 }; // sonst das Becken am Fuß
const POOL = 4; // Becken am Fuß (k 1 … 2) erkaltet als Letztes
const [GAP0, GAP1] = [-20, 19]; // Durchgang x −2,5 … 2,5
const [LAVA0, LAVA1] = [-18, 17]; // dazwischen fließt es, außen die Wangen
const [BACK, FRONT] = [-22, 3]; // Rand hinten (zwei Reihen) und vorn (eine Reihe)

/** Zustand beim Öffnen: Erkalten je Stufe (0 … 3) und Becken (4) von oben nach unten, dann Absinken zum Weg */
type Flow = { cool: number[]; sink: number };
export function flow(open: number): Flow {
  const cool = STEPS.map((_, n) => seg(open, 0.05 + 0.1 * (3 - n), 0.2 + 0.1 * (3 - n)));
  cool.push(seg(open, 0.45, 0.55));
  return { cool, sink: ease(seg(open, 0.55, 1)) };
}
/** Fließt dort noch Lava (Stufe oder Becken n)? */
const flowing = (f: Flow, n: number) => (f.cool[n] ?? 1) < 0.35;
/** Höhe beim Absinken: bis auf eine Platte von einem Voxel */
const sunk = (h: number, f: Flow) => Math.max(1, Math.round(h * (1 - f.sink)));

/** Was in Reihe k steht: Stufe n (0 … 3), Becken (4) oder Rand (−1), und wie hoch */
function region(k: number, f: Flow): { n: number; top: number } {
  if (k < BACK || k > FRONT) return { n: -1, top: 0 };
  if (k < step(3).kb) return { n: -1, top: sunk(21, f) };
  const n = STEPS.findIndex((s) => k >= s.kb && k <= s.kf);
  if (n >= 0) return { n, top: sunk(step(n).top, f) };
  return k < FRONT ? { n: POOL, top: 1 } : { n: -1, top: sunk(2, f) };
}
/** Unterkante des Falls vor Stufe n: Oberkante der Stufe darunter */
const below = (n: number, f: Flow) => (n > 0 ? sunk(step(n - 1).top, f) : 0);
const cheek = (i: number) => i < LAVA0 || i > LAVA1;

/** Ist (i, j, k) Oberfläche der Lava (Tritt, Fall oder Becken), und von welcher Stufe? −1 sonst */
function surface(i: number, j: number, k: number, f: Flow) {
  if (cheek(i)) return -1;
  const r = region(k, f);
  if (r.n === POOL) return j === 0 ? POOL : -1;
  if (r.n < 0) return -1;
  if (j === r.top - 1) return r.n;
  return k === step(r.n).kf && j >= below(r.n, f) ? r.n : -1;
}

/** Farbe einer Lava-Oberfläche je nach Erkalten: Glut, dunkelrot, dann Stein mit glimmenden Fugen */
function lavaCell(i: number, j: number, k: number, n: number, f: Flow): Cell {
  const c = f.cool[n] ?? 1;
  if (c < 0.35) {
    const pond = n === 3 && k < step(3).kf - 3 && j === step(3).top - 1;
    const pal = n < POOL && j < region(k, f).top - 1 ? FALL : LAVA;
    return { c: pond ? POND : (pal[Math.floor(hash3(i, j, k) * pal.length)] ?? pal[0]), part: 'bright' };
  }
  if (c < 0.7) return { c: mix(LAVA[1], CRUST, seg(c, 0.35, 0.7)), part: 'bright' };
  const cols = [-12, -1, 10].map((x) => x + (n % 2) * 3);
  const flat = region(k, f).top === 1;
  const fuge = n === POOL ? i % 6 === 0 : cols.includes(i) || (flat && k === step(n).kf);
  return fuge ? { c: FUGE, part: 'bright' } : { c: STONE, part: 'solid', top: STONE_TOP };
}

/** Säulen-Muster auf dem Rand hinten: je sechs Voxel eine Säule, etwas anders getönt */
const backWall = (i: number): Cell => {
  const c = SIDE[Math.floor(hash3(Math.floor((i + 24) / 6), 3, 9) * SIDE.length)] ?? SIDE[0];
  return { c: (i + 24) % 6 === 0 ? RIM : c, part: 'solid', top: DECK };
};

/** Ein Voxel der Kaskade: Lava-Oberfläche, Rand hinten, Wange oder Stein */
function cascadeCell(i: number, j: number, k: number, n: number, f: Flow): Cell {
  const s = surface(i, j, k, f);
  if (s >= 0) return lavaCell(i, j, k, s, f);
  if (n < 0 && k < 0 && !cheek(i)) return backWall(i);
  return { c: k === FRONT ? RIM : STONE, part: 'solid', top: cheek(i) ? DECK : STONE_TOP };
}

/** Kaskade: Kern aus Stein, Wangen, Ränder, darauf die Lava-Oberfläche oder erkalteter Stein */
function cascade(b: Body, f: Flow) {
  const extra = f.sink < 1 ? 1 : 0; // Wangen ragen einen Voxel über den Tritt
  for (let k = BACK; k <= FRONT; k++) {
    const r = region(k, f);
    const wange = r.n >= 0 ? Math.max(r.top, region(k - 1, f).top) + extra : r.top;
    for (let i = GAP0; i <= GAP1; i++)
      for (let j = 0; j < (cheek(i) ? wange : r.top); j++) {
        const v = cascadeCell(i, j, k, r.n, f);
        b.add(i, j, k, v.c, v.part, v.top);
      }
  }
}

/** Heller Saum, wo die Lava über die Kante quillt, und der Quellwulst hinten im Teich (nur wo es noch fließt) */
function saum(vox: Vox, f: Flow) {
  STEPS.forEach((s, n) => {
    if (!flowing(f, n)) return;
    for (let i = LAVA0; i <= LAVA1; i++) {
      const c = SAUM[(i >> 1) & 1] ?? SAUM[0];
      vox.set(i, s.top, s.kf, c, 'bright');
      if (hash3(i >> 1, n, 6) < 0.5) vox.set(i, s.top, s.kf + 1, c, 'bright'); // hängt über die Kante
      if (hash3(i >> 1, n, 5) < 0.4) vox.set(i, s.top + 1, s.kf, SAUM[1], 'bright');
      if (n === 3) vox.set(i, s.top, s.kb, hash3(i >> 1, 7, 2) < 0.5 ? SAUM[0] : SAUM[1], 'bright');
    }
  });
}

/* ---------- Glutbänder (bewegt) ---------- */
type Spot = { j: number; k: number; s: number; n: number };
/**
 * Weg der Lava über die Kaskade in einer Spalte, von der Quelle bis ins Becken: Zellen gleich über bzw. vor der
 * Oberfläche (dort baut `build` nie etwas); s zählt den Weg in Voxeln (unter dem Saum durch ohne Zelle). n sagt, zu
 * welcher Stufe die Zelle gehört (der Fall zur Stufe, von der er fällt).
 */
function path(): Spot[] {
  const out: Spot[] = [];
  let s = 0;
  const top = step(3);
  for (let k = top.kb + 1; k < top.kf; k++) out.push({ j: top.top, k, s: s++, n: 3 });
  for (let n = 3; n >= 0; n--) {
    const st = step(n);
    const next = step(n - 1 >= 0 ? n - 1 : POOL); // darunter: nächste Stufe oder das Becken
    s++; // unter dem Saum
    for (let j = st.top - 1; j > next.top; j--) out.push({ j, k: st.kf + 1, s: s++, n });
    for (let k = next.kb; k < next.kf + (n ? 0 : 1); k++) out.push({ j: next.top, k, s: s++, n: n ? n - 1 : POOL });
  }
  return out;
}
const PATH = path();
const PERIOD = 8; // Voxel zwischen zwei Bändern; sie wandern einen halben Voxel je Takt (16 Takte = eine Runde)
/** Versatz der Bänder je Spalte: sanft gewellt, nicht als starre Linie */
const shift = (i: number) => Math.round(2 * (1.5 * Math.sin((i >> 1) * 0.7) + hash3(i >> 1, 3, 77))) / 2;

/** Glutbänder im Takt `beat` in ein eigenes Raster (auch für Tests) */
export function bands(g: GateCtx, beat: number): Vox {
  const f = flow(g.open);
  const vox = new Vox();
  for (let i = LAVA0; i <= LAVA1; i++)
    for (const c of PATH) {
      if (!flowing(f, c.n)) continue;
      const u = (((c.s - shift(i) - beat / 2) % PERIOD) + PERIOD) % PERIOD;
      const d = Math.min(u, PERIOD - u); // Abstand zur Mitte des Bands
      const color = d < 0.25 ? BAND[0] : d < 0.75 ? BAND[1] : d < 1.25 ? BAND[2] : null;
      if (color) vox.set(i, c.j, c.k, color, 'bright');
    }
  return vox;
}

export const motion: GateMotion = (p, g, beat) => bands(g, beat).emit(p);

/* ---------- Säulenbasalt zu beiden Seiten ---------- */
/** Höhe der Säulen je Spalte (0 an der Gasse, 1 außen) und Reihe (0 vorn … nach hinten): steigt wie die Kaskade */
const HEIGHT = [
  [1, 1.75, 2.5, 3],
  [1.25, 2],
] as const;

/** Eine Säule mit gekappten Ecken (sechseckig wirkend), vorn mit einer Querfuge */
function column(b: Body, side: number, ci: number, r: number, hh: number) {
  const r8 = (v: number) => Math.round(v * VOX);
  const a = 2.5 + 0.75 * ci;
  const [x0, x1] = side < 0 ? [-a - 0.75, -a] : [a, a + 0.75];
  const z1 = 0.5 - (ci === 1 ? 0.375 : 0) - 0.75 * r; // versetzt wie echter Säulenbasalt
  const h = hh + Math.round(hash3(ci, r, side + 5) * 2) / 8;
  const [i0, i1, k0, k1] = [r8(x0), r8(x1), r8(z1 - 0.75), r8(z1)];
  const color = SIDE[Math.floor(hash3(ci * 7 + r, side, 7) * SIDE.length)] ?? SIDE[0];
  const fuge = Math.round((0.4 + hash3(ci, r, side * 3) * (h - 0.8)) * VOX);
  for (let i = i0; i < i1; i++)
    for (let k = k0; k < k1; k++) {
      // Ecken eine Stufe tiefer und dunkel: Fuge zwischen den Säulen, oben sechseckig wirkend (innen voll, spart Voxel)
      const corner = (i === i0 || i === i1 - 1) && (k === k0 || k === k1 - 1);
      for (let j = 0; j < r8(h) - (corner ? 1 : 0); j++)
        b.add(i, j, k, corner || (k === k1 - 1 && j === fuge) ? RIM : color, 'solid', corner ? RIM : DECK);
    }
}
const basalt = (b: Body) =>
  [-1, 1].forEach((side) => HEIGHT.forEach((rows, ci) => rows.forEach((h, r) => column(b, side, ci, r, h))));

/* ---------- Glutbaum (feines Modell: mitwachsen-gate-flora.ts) ---------- */
type Tree = GlowTree;
/**
 * Lage des Baums: neben dem Gang auf dem Säulenbasalt, auf Höhe des Teichs (Stamm bei |x| ≥ 3, die Krone erst ab
 * gut 4 Feldern Höhe). Ein Zugang sieht die Kamera in Ruhe aus der Richtung `cam` (`GateCtx.home`, meist von Süden):
 * Liegt er hinten, steht der Baum links (rechts oben im Bild liegt die Karte), sonst rechts, wo ihn die Kamera ganz im
 * Bild hat. Dreht die Kamera auf der Torplatte zur Front, bleibt er dort stehen (entschieden am 25.11.2026: lieber von
 * vorn zum Teil unter der Karte als ein Baum, der beim Drehen die Seite wechselt).
 */
export const treeAt = (cam: readonly [number, number]): Tree => ({
  x: cam[1] > 0 ? -3 : 3,
  z: -2.125,
  y: 2.875,
  h: 4.75,
  k: 1.4,
});

/* ---------- Weltzeichen: Flamme auf runder Basaltplakette, schaut zur Kamera ---------- */
const FLAME = [
  '...oooooo...',
  '..oddddddo..',
  '.oddddrdddo.',
  'oddddrrddddo',
  'odddrrrdrddo',
  'oddrrRrrrddo',
  'oddrRRRrrddo',
  'odrrRYYRrrdo',
  'odrRYYYYRrdo',
  '.odrRYYRrdo.',
  '..oddddddo..',
  '...oooooo...',
];
export const SIGN_D = 1.125; // vor dem Stamm und vor der Krone
export const SIGN_Y = 3.875; // über dem Säulenbasalt und dem Felsring

function sign(vox: Vox, t: Tree, cam: readonly [number, number]) {
  const [x, z] = [t.x + cam[0] * SIGN_D, t.z + cam[1] * SIGN_D];
  vox.image(x, SIGN_Y, z, FLAME, { o: '#6b6f78', d: RIM }, cam, 'solid', 2);
  vox.image(x, SIGN_Y, z, FLAME, { r: '#ff7a1a', R: '#ff9a3c', Y: '#ffe08a' }, cam, 'bright', 2);
}

/** Alle festen Voxel des Zugangs in einem Raster (auch für Tests) */
export function voxels(g: GateCtx): Vox {
  const f = flow(g.open);
  const vox = new Vox();
  const b = new Body(); // Kaskade und Säulen in einem Körper: Wo sie aneinanderstoßen, fällt die Wand weg
  cascade(b, f);
  basalt(b);
  b.emit(vox);
  saum(vox, f);
  sign(vox, treeAt(homeOf(g)), g.cam); // der Baum bleibt, wo er aus der Ruhe-Kamera steht; nur sein Schild dreht
  return vox;
}

/** Wie hell der Glutbaum glüht: heller, sobald der Weg frei ist */
export const treeLit = (open: number) => 0.75 + 0.25 * ease(seg(open, 0.7, 1));

export const build: GateBuild = (p, g) => {
  voxels(g).emit(p);
  // Glutbaum als feines Modell (mitwachsen-gate-flora.ts): Stamm mit Rinde, Krone leuchtet von innen
  const tree = glowTreeBoxes(treeAt(homeOf(g)), treeLit(g.open));
  plantInto(p, tree.solid);
  plantInto(p, tree.bright, true);
  return [];
};

/** Torplatte vor dem Zugang (mitwachsen-plate-3d.ts, Zeichen in Farben aus `PALETTE`): Basalt mit warm glimmenden Rissen (Orange und Gelb der Glut, kein Rot) */
export const plate: PlateLook = {
  face: [STONE, STONE_TOP],
  mark: ['...r.........r....', '....rr......r.....', '......rRr..rr....r', '.rr......rR....rr.', 'r..........r......'],
};
