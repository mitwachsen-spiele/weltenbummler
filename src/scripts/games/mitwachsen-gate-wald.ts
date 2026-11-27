// Zugang zum Wald in 3D (Entwurf „Welten-Zugänge“, Wald C): der Spechtbaum am Waldsaum. Ein uralter Baum, breit wie
// ein Haus, steht im Felsring; durch seinen Stamm führt ein Spitzbogen. Zu ist er mit einer Tür aus drei Bahnen heller
// Rinde verschlossen, über dem Bogen das Spechtloch, daneben der Specht. Beim Öffnen klopft der Specht dreimal, bei
// jedem Klopfen läuft ein grünes Licht über die Tür und eine Bahn gleitet in den Stamm (erst die mittlere nach oben,
// dann die linke, dann die rechte). Offen sitzt der Specht im leuchtenden Nest. Über der grünen Krone ein Herbstwipfel
// in zwei Stufen: so hoch und bunt steht kein Baum auf der Lichtung. Daneben dunkle Tannen auf dem Fels.
// Gehört zur 3D-Ansicht und wird nur mit ihr nachgeladen (Three.js).
//
// Der Stamm (das Torhaus) ist aus Quadern mit Rindentextur (als Voxel wären es Zehntausende); Krone und Tannen sind
// feine Modelle wie die Bäume der Lichtung (Blatt- und Nadelmuster, mitwachsen-gate-flora.ts); alles Kleine (Tür,
// Bogenrand, Moos, Spechtloch, Specht, Schild) liegt in einem Voxel-Raster davor.

import { Vox, ease, hash3, plantInto, seg, type GateBuild, type GateCtx, type Parts } from './mitwachsen-gate-kit';
import { firBoxes, leafBox } from './mitwachsen-gate-flora';
import type { PlateLook } from './mitwachsen-plate';

const F = {
  bark: '#dccbb6', // Tönung der Rindentextur
  rinde: '#5d3e21',
  rindeHell: '#7a5a3a',
  rahmen: ['#7d5a38', '#6e4c2c'],
  fuge: '#3a2a1a',
  loch: '#2a1d12',
  bahn: '#8a6a45',
  bahnDunkel: '#7d5e3b',
  bahnHell: '#957550',
  schnitz: '#a8865a',
  holzHell: '#c99a62',
  moos: ['#6aa84f', '#5a9a40', '#7fbf5f'],
  leucht: '#7fdc6a', // grünes Licht beim Klopfen
  nest: ['#fff2a8', '#ffcf7a'],
  zweig: ['#8a6a45', '#6b4a2b'],
  specht: '#2b2b2b',
  kappe: '#c8323a',
  brust: '#f2efe6',
  schnabel: '#a8a294',
} as const;
/** Laub je Art: Seite, Oberseite */
const LAUB = {
  gruen: ['#3f9a3c', '#5ab651'],
  dunkel: ['#2f7a34', '#3f9a3c'],
  herbst: ['#d9732e', '#f39a4e'],
  rot: ['#b8452a', '#d2603a'],
} as const;
type Laub = keyof typeof LAUB;

// Maße in Voxeln (1/8 Feld): Bogen |i| < 20 (x ±2,5), gerade bis j 24 (3 Felder), Spitze bei j 32 (4 Felder)
const AW = 20;
const AS = 24;
const AH = 8;
const KF = 3; // Lage der Stirn: Voxel k 3 (z 0,375 … 0,5)
const KD = 1; // Lage der Tür: k 1, eingelassen
// Stamm in Feldern
const ZF = 0.375; // Stirn
const ZB = -2.25; // Rückseite
const XO = 4.125; // Außenkante der Pfeiler
const TOP = 5.5; // Oberkante des Stamms, darauf die Krone
const KNOCK = [0.1, 0.4, 0.7]; // die drei Klopfer, danach gleitet je eine Bahn (0,2 lang)
const HOLE = [0, 38] as const; // Spechtloch (i, j)

/** Liegt Zelle (i, j) der Stirn im Spitzbogen? */
export function inArch(i: number, j: number) {
  const x = Math.abs(i + 0.5);
  if (j < 0 || x >= AW) return false;
  if (j < AS) return true;
  const t = (j + 0.5 - AS) / AH;
  return t < 1 && x < AW * Math.cos((t * Math.PI) / 2);
}

/** Liegt eine Zelle im Abstand `d` (Schachbrett) um (i, j) im Bogen? */
const ring = (i: number, j: number, d: number) => {
  for (let a = -d; a <= d; a++)
    if (inArch(i + a, j - d) || inArch(i + a, j + d) || inArch(i - d, j + a) || inArch(i + d, j + a)) return true;
  return false;
};

let RIM: Map<number, number> | null = null;
const rimKey = (i: number, j: number) => (i + 64) * 256 + j;
/** Abstand (Schachbrett, bis 4) jeder Zelle der Stirn zum Bogen; im Bogen 0 */
function rimDist() {
  if (RIM) return RIM;
  RIM = new Map();
  for (let j = 0; j < AS + AH + 4; j++)
    for (let i = -AW - 4; i < AW + 4; i++) {
      let best = inArch(i, j) ? 0 : 9;
      for (let d = 1; d <= 4 && best > 4; d++) if (ring(i, j, d)) best = d;
      RIM.set(rimKey(i, j), best);
    }
  return RIM;
}

/** Stamm und Laub aus Quadern; jeder Laubquader rückt ein wenig, damit keine zwei Flächen in einer Ebene liegen */
class Boxes {
  private n = 0;
  constructor(private p: Parts) {}

  /** Rinde: in Stücke um ein Feld geteilt, damit die Textur so fein ist wie an den Bäumen der Lichtung */
  bark(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const cuts = (a: number, b: number) => {
      const n = Math.max(1, Math.round(b - a));
      return Array.from({ length: n + 1 }, (_, q) => a + ((b - a) * q) / n);
    };
    const [xs, ys, zs] = [cuts(x0, x1), cuts(y0, y1), cuts(z0, z1)];
    const inside = (q: number, list: number[]) => q > 0 && q < list.length - 2;
    for (let a = 0; a < xs.length - 1; a++)
      for (let b = 0; b < ys.length - 1; b++)
        for (let c = 0; c < zs.length - 1; c++) {
          if (inside(a, xs) && inside(b, ys) && inside(c, zs)) continue; // ganz innen sieht man nie
          const [ax, bx, ay, by, az, bz] = [xs[a]!, xs[a + 1]!, ys[b]!, ys[b + 1]!, zs[c]!, zs[c + 1]!];
          this.p.solid.box(ax, ay, az, bx - ax, by - ay, bz - az, F.bark, F.bark, 'log', 'logTop');
        }
  }

  /** Laub (Quader von Ecke zu Gegenecke), fein mit Blatt-Muster wie die Kronen der Lichtung */
  leaf(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, look: Laub) {
    const e = ++this.n * 0.0011;
    const [side, top] = LAUB[look];
    plantInto(this.p, [leafBox(x0 - e, y0 + e, z0 - e, x1 + e, y1, z1 + e, side, top)]);
  }

  /** Laubballen: unten und oben schmaler, in der Mitte über Kreuz (achteckig) */
  lump(cx: number, cz: number, y0: number, hx: number, hz: number, h: number, look: Laub) {
    const at = (fx: number, fz: number, a: number, b: number) =>
      this.leaf(cx - hx * fx, y0 + h * a, cz - hz * fz, cx + hx * fx, y0 + h * b, cz + hz * fz, look);
    at(0.7, 0.7, 0, 0.3);
    at(1, 0.72, 0.2, 0.8);
    at(0.72, 1, 0.24, 0.76);
    at(0.6, 0.6, 0.7, 1);
  }

  /** Dunkle Tanne in Stufen auf schmalem Stamm (feines Modell, mitwachsen-gate-flora.ts) */
  tanne(x: number, z: number, s: number) {
    plantInto(this.p, firBoxes(x, z, s));
  }
}

/** Stamm: zwei Pfeiler, Sturz über dem Bogen, Wölbung an den Seiten, Wurzelfüße in den Fels */
function trunk(b: Boxes) {
  const feet = [
    [4.125, 4.625, -0.5, 0.25, 1.5],
    [4.625, 5.125, -0.375, 0.125, 0.875],
    [5.125, 5.5, -0.25, 0, 0.375],
  ] as const;
  for (const s of [-1, 1]) {
    const [x0, x1] = s < 0 ? [-XO, -2.5] : [2.5, XO];
    b.bark(x0, 0, ZB, x1, TOP, ZF);
    const [w0, w1] = s < 0 ? [-4.5, -4] : [4, 4.5];
    b.bark(w0, 0.25, -2, w1, 5, 0);
    for (const [a, c, z0, z1, h] of feet) b.bark(s < 0 ? -c : a, 0, z0, s < 0 ? -a : c, h, z1);
  }
  b.bark(-2.5, (AS + AH) / 8, ZB, 2.5, TOP, ZF);
}

/** Krone aus Laubballen, darüber der Herbstwipfel in zwei Stufen; Tannen am Waldsaum */
function crown(b: Boxes) {
  b.lump(-2.6, -1.3, TOP - 0.3, 2.3, 1.5, 1.6, 'dunkel');
  b.lump(2.8, -1.2, TOP - 0.25, 2.2, 1.6, 1.5, 'dunkel');
  b.lump(-4.7, -0.9, TOP - 0.45, 0.9, 1.0, 1.1, 'herbst');
  b.lump(5.0, -0.8, TOP - 0.4, 0.85, 0.95, 1.0, 'herbst');
  b.lump(0.1, -1.0, TOP, 2.6, 1.5, 1.5, 'gruen');
  b.lump(0, -0.1, TOP - 0.15, 4.4, 0.55, 0.8, 'gruen'); // Laubsaum über der Stirn
  b.lump(0, -1.0, TOP + 1.3, 1.5, 1.1, 1.2, 'herbst');
  b.lump(0, -1.0, TOP + 2.35, 0.85, 0.7, 0.75, 'rot');
  b.tanne(-5.6, -1.4, 1.1);
  b.tanne(5.7, -1.5, 1.2);
  b.tanne(-6, -3.4, 0.9);
}

/** Stirn: Bogenrand (dunkle Lippe, Rahmen aus Rinde), Zwickel neben der Spitze vorn und hinten, Moosgürtel */
function front(v: Vox, flash: boolean) {
  const rim = rimDist();
  for (let j = 0; j < AS + AH + 4; j++)
    for (let i = -AW - 4; i < AW + 4; i++) {
      const d = rim.get(rimKey(i, j)) ?? 9;
      if (d === 0) continue;
      if (Math.abs(i + 0.5) < AW && j >= AS && j < AS + AH) {
        v.set(i, j, KF - 1, F.rinde);
        v.set(i, j, ZB * 8, d === 1 ? F.fuge : F.rindeHell);
      }
      if (d === 1) v.set(i, j, KF, flash ? F.leucht : F.fuge, flash ? 'bright' : 'solid');
      else if (d <= 3) v.set(i, j, KF, hash3(i, j, 8) < 0.15 ? F.moos[0] : F.rahmen[d - 2]!);
    }
  for (let i = -XO * 8; i < XO * 8; i++) {
    if (Math.abs(i + 0.5) < AW + 4) continue;
    const h = 1 + Math.floor(hash3(i, 2, 12) * 4);
    for (let j = 0; j < h; j++) v.set(i, j, KF, F.moos[Math.floor(hash3(i, j, 14) * 3)]!);
  }
}

// Tür in drei Bahnen [von, bis) in i; die erste Spalte der zweiten und dritten ist die Fuge
const BAHN = [
  [-AW, -7],
  [-7, 6],
  [6, AW],
] as const;
const LEAF = ['..x..', '.xxx.', 'xxxxx', 'xx.xx', '.x.x.', '..x..', '..x..'];

/** Farbe einer Zelle der Tür an ihrem Platz in der geschlossenen Tür */
function plank(p: number, si: number, sj: number) {
  if (p > 0 && si === BAHN[p]![0]) return F.fuge;
  const leaf = LEAF[20 - sj];
  if (p === 1 && leaf && Math.abs(si) <= 2 && leaf[si + 2] === 'x') return F.schnitz;
  if (hash3(si, 3, 5) < 0.28) return F.bahnDunkel;
  return hash3(si, sj >> 2, 6) < 0.08 ? F.bahnHell : F.bahn;
}

/** Die Tür: drei Bahnen gleiten nacheinander in den Stamm; beim Klopfen leuchten ihre Ränder grün */
function door(v: Vox, open: number, flash: boolean) {
  const t = KNOCK.map((k) => ease(seg(open, k, k + 0.2)));
  const shift = [
    [-Math.round(t[1]! * 14), 0],
    [0, Math.round(t[0]! * 34)],
    [Math.round(t[2]! * 14), 0],
  ] as const;
  for (let j = 0; j < AS + AH; j++)
    for (let i = -AW; i < AW; i++) {
      if (!inArch(i, j)) continue;
      for (let p = 0; p < 3; p++) {
        const [si, sj] = [i - shift[p]![0], j - shift[p]![1]];
        const [a, b] = BAHN[p]!;
        if (si < a || si >= b || !inArch(si, sj)) continue;
        const edge = si === a || si === b - 1 || sj === 0 || !inArch(si, sj + 1);
        if (flash && edge) v.set(i, j, KD, F.leucht, 'bright');
        else v.set(i, j, KD, plank(p, si, sj));
        break;
      }
    }
}

// Specht von der Seite (Schnabel links), Kopf im Nest
const SPECHT = ['.rrr..', 'bkkk..', '.wkk..', '.wkkk.', '.wkkk.', '..kkk.', '...kk.', '....k.'];
const KOPF = ['.rrr.', 'bkkk.', '.wkw.'];
const SPECHT_PAL = { r: F.kappe, k: F.specht, w: F.brust, b: F.schnabel };

/** Spechtloch mit Rand; offen leuchtet darin das Nest und der Specht schaut heraus, sonst sitzt er daneben */
function hole(v: Vox, open: number, flash: boolean) {
  const [hi, hj] = HOLE;
  const lit = open >= 1;
  for (let dj = -5; dj <= 5; dj++)
    for (let di = -5; di <= 5; di++) {
      const r = Math.hypot(di + 0.5, dj + 0.5);
      if (r > 5) continue;
      const [i, j] = [hi + di, hj + dj];
      if (r > 3.6) v.set(i, j, KF, dj > 2 ? F.moos[0] : F.rindeHell);
      else if (!lit) v.set(i, j, KF, F.loch);
      else if (dj <= -2) v.set(i, j, KF, F.zweig[Math.floor(hash3(i, j, 4) * 2)]!, 'bright');
      else v.set(i, j, KF, F.nest[dj > 1 ? 0 : 1], 'bright');
    }
  if (lit) {
    v.image(hi / 8, (hj - 1) / 8, KF / 8, KOPF, SPECHT_PAL, [0, 1], 'solid');
    return;
  }
  // zu sitzt er neben dem Loch; beim Öffnen dicht daran und klopft mit vorgestrecktem Kopf
  const x = open > 0 ? (hi + 7 - (flash ? 1 : 0)) / 8 : (hi + 10) / 8;
  v.image(x, (hj - 6) / 8, KF / 8, SPECHT, SPECHT_PAL, [0, 1], 'solid');
}

// Weltzeichen: Eichenblatt auf runder Holzscheibe
const BLATT = [
  '....RRRRRR....',
  '..RRhhhhhhRR..',
  '.RhhhhhhhLLhR.',
  '.RhhhhhLLLLhR.',
  'RhhhhLLLLlLhhR',
  'RhhhLLLLlLLhhR',
  'RhhLLLLlLLLhhR',
  'RhhLLLlLLLhhhR',
  'RhhLLlLLLhhhhR',
  'RhhLlLLLhhhhhR',
  '.RhhlhhhhhhhR.',
  '.RhlhhhhhhhhR.',
  '..RRhhhhhhRR..',
  '....RRRRRR....',
];
const BLATT_PAL = { R: F.rinde, h: F.holzHell, L: F.leucht, l: '#2f5e2a' };

/** Das Blatt-Schild am Stamm, auf der Seite zur Kamera */
function sign(v: Vox, cam: readonly [number, number]) {
  const [cx, cz] = cam;
  let at: [number, number, number] = [-3.375, 1.0, KF / 8]; // vorn am linken Pfeiler
  if (cx > 0) at = [4.5, 1.25, -1.125];
  else if (cx < 0) at = [-4.625, 1.25, -1.125];
  else if (cz < 0) at = [-3.5, 3.125, ZB - 0.125]; // über dem Fels dahinter; das Bild läuft hier nach −x
  v.image(at[0], at[1], at[2], BLATT, BLATT_PAL, cam);
}

/** Klopft der Specht gerade? (die Öffnung wächst in Zehntelschritten) */
const knocking = (open: number) => KNOCK.some((k) => open > k - 1e-6 && open < k + 0.05);

/** Das Voxel-Raster des Zugangs (Tür, Bogenrand, Moos, Spechtloch, Specht, Schild) */
export function raster(g: Pick<GateCtx, 'open' | 'cam'>) {
  const v = new Vox();
  const flash = knocking(g.open);
  front(v, flash);
  if (g.open < 1) door(v, g.open, flash);
  hole(v, g.open, flash);
  sign(v, g.cam);
  return v;
}

export const build: GateBuild = (p, g) => {
  const b = new Boxes(p);
  trunk(b);
  crown(b);
  raster(g).emit(p);
  return [];
};

/** Torplatte vor dem Zugang (mitwachsen-plate-3d.ts, Zeichen in Farben aus `PALETTE`): Baumscheibe: Rinde außen, helle Jahresringe innen (klopft hohl, sfx.ts) */
const RINGS = ['...wwwwwwwwww...', '.ww..........ww.', 'w...wwwTTwww...w'] as const;
export const plate: PlateLook = { face: [F.rinde, '#93683f'], mark: [...RINGS, ...[...RINGS].reverse()] };
