// Zugang zum Pilzwald in 3D (Entwurf „Welten-Zugänge“, Idee c: das verwachsene Pilztor). Zwei gedrungene blaue
// Riesenpilze auf bemoosten Sockeln stehen als Torpfosten. Zu ist der Durchgang dazwischen mit weichen Pilzranken
// (rosa-lila, weiß, türkis) zugewachsen: Bögen, Schlingen und Locken in drei Lagen hintereinander, vom Boden bis unter
// die Hüte, mit flachen Hütchen, Myzelpolstern und leuchtenden Spitzen; mitten darin schläft eine flache Leuchtknospe.
// Auch Stiele und Hutränder sind bewachsen. Beim Öffnen wacht die Knospe auf, Licht läuft die Ranken entlang, sie ziehen
// sich zurück, die Spitzen rollen sich zuerst ein, und sie kringeln sich wie Farn an den Stielen ein. Offen hängt oben
// eine Girlande aus zwei umeinander gedrehten Ranken mit der Knospe zwischen den Hüten, der Weg ist frei.
// Gehört zur 3D-Ansicht und wird nur mit ihr nachgeladen (Three.js).
//
// Feste Teile (Pilze, Sockel, Stiel- und Hutranken, Polster, Knospe, Schild) baut `build`; die Ranken im Durchgang,
// die Girlande und das Glühwürmchen wiegen sich in `motion` (16 Takte, 2 s) und lassen jede Zelle des festen Rasters aus.
// Formregel: Riesenpilze gedrungen (Hut viel breiter als der Stiel hoch), Ranken nur in Bögen und Locken, zur Spitze
// dünner; Hütchen flach und seitlich auf der Ranke – nie ein Stab mit Kopf.

import {
  BEATS,
  VOX,
  Vox,
  ease,
  hash3,
  seg,
  type GateBuild,
  type GateCtx,
  type GateMotion,
  plantInto,
} from './mitwachsen-gate-kit';
import { GIANT, giantBoxes, octagonReach, stemPieceRadius, type Giant } from './mitwachsen-gate-flora';
import type { PlateLook } from './mitwachsen-plate';

type Cam = GateCtx['cam'];
type Pair = readonly [string, string];
/** Farbe eines Voxels: fest (Zeichenkette) oder selbst leuchtend; null bleibt leer */
type Paint = string | { c: string; glow: true } | null;
type Shape = (x: number, y: number, z: number, i: number, j: number, k: number) => Paint;

const BLAU = ['#4f7fd9', '#3a63b8', '#d7e4ff', '#2c4a8a', '#3a5a9a'] as const; // Hut, Rand, Tupfen, zwei Lamellen
const STIEL = ['#efe4d2', '#e0d2ba'] as const; // Stiel, Rille
const MOOS = ['#8a76cc', '#7462b4', '#a594e3', '#e08cff', '#8d8798'] as const; // Moos, dunkel, hell, leuchtend, Fels
const MYZEL = ['#d6c4f2', '#b79fe6', '#ece2fb'] as const;
/** Ranken: hell und dunkel (Unterseite); kräftig und selbst leuchtend, damit sie sich vom lila Boden abheben */
const ROSA: Pair = ['#f4b0ee', '#a95cc4'];
const WEISS: Pair = ['#fdfaff', '#9f86cc'];
const TUERKIS: Pair = ['#7fe0d4', '#2f8a84'];
const VCOL = [ROSA, WEISS, TUERKIS] as const;
const TIPS = ['#ffd6ff', '#fffbe6', '#d4fff8'] as const; // leuchtende Spitzen je Rankenfarbe
const LAMELLE = '#f3c6ff';
const HUT = ['#c48ae8', '#8f56c0', '#6cc7bd', '#3f948c', '#f2a3c9', '#c76f9c', '#f6efe2', '#cdbd9f']; // je zwei
const hutPair = (n: number): Pair => [HUT[(n % 4) * 2] ?? '#fff', HUT[(n % 4) * 2 + 1] ?? '#fff'];

const BAY_K = 4; // erste Voxel-Reihe der Bucht (z ≥ 0,5): dort baut der Zugang nichts
const PX = 3.5; // Mitte der Riesenpilze (x ±PX)
const PZ = -0.75; // … in der Tiefe (Stiel)
const HZ = -0.95; // Mitte der Hüte in der Tiefe: vorn enden sie knapp vor der Bucht
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const vx = (x: number) => Math.floor(x * VOX);
/** Voxel am Stiel setzen: nie in der Bucht, nie im Durchgang (|x| < 2,5 unter 3 Feldern Höhe) */
const put = (v: Vox, [i, j, k]: readonly [number, number, number], c: string, part?: 'bright') => {
  if (k < BAY_K && (Math.abs((i + 0.5) / VOX) > 2.5 || j >= 3 * VOX)) v.set(i, j, k, c, part);
};
/** Ranken: Zustand 0 verwachsen … 1 eingerollt; Licht läuft vorher die Ranken entlang */
const curl = (t: number) => ease(seg(t, 0.35, 0.95));
const wakeAt = (t: number) => (t <= 0.2 ? 0 : seg(t, 0.2, 0.4) * 1.15);
/** Unterkante der Hüte (heben sich beim Öffnen ein wenig) */
const hatY = (t: number) => 3.32 + 0.15 * curl(t);

const SIX = [1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1];
/** alle Richtungen außer nach unten (die Kamera schaut immer schräg von oben) */
const FIVE = [1, 0, 0, -1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -1];
/**
 * Körper aus einer Formfunktion (Voxelmitte → Farbe) im Quader [x0, y0, z0, x1, y1, z1]: gesetzt wird nur die Hülle
 * (Voxel mit einem leeren Nachbarn), unter dem Boden zählt als voll. So kostet das Innere keine Voxel. Nichts bei z ≥ 0,5.
 * Mit `cam` fällt auch weg, was nur nach unten oder von der Kamera weg frei liegt (die Kamera schaut immer schräg von oben),
 * mit `all` nur, was nach unten frei liegt (Zugang zur Front gebaut: die Kamera kann von jeder Seite kommen).
 */
function shell(v: Vox, box: readonly number[], f: Shape, cam?: Cam, all = false) {
  const [x0 = 0, y0 = 0, z0 = 0, x1 = 0, y1 = 0, z1 = 0] = box;
  const [i0, j0, k0] = [vx(x0), Math.max(0, vx(y0)), vx(z0)];
  const [ni, nj, nk] = [Math.ceil(x1 * VOX) - i0, Math.ceil(y1 * VOX) - j0, Math.min(Math.ceil(z1 * VOX), BAY_K) - k0];
  const grid: Paint[] = [];
  const at = (i: number, j: number, k: number) => ((k - k0) * nj + (j - j0)) * ni + (i - i0);
  for (let k = k0; k < k0 + nk; k++)
    for (let j = j0; j < j0 + nj; j++)
      for (let i = i0; i < i0 + ni; i++)
        grid[at(i, j, k)] = f((i + 0.5) / VOX, (j + 0.5) / VOX, (k + 0.5) / VOX, i, j, k);
  const inside = (i: number, j: number, k: number) =>
    i >= i0 && i < i0 + ni && j >= j0 && j < j0 + nj && k >= k0 && k < k0 + nk;
  const full = (i: number, j: number, k: number) => j < 0 || (inside(i, j, k) && grid[at(i, j, k)] != null);
  // mit `cam` nur, was die Kamera sehen kann: oben, zur Kamera hin und quer dazu
  const seen = cam ? [0, 1, 0, cam[0], 0, cam[1], cam[1], 0, -cam[0], -cam[1], 0, cam[0]] : SIX;
  const free = (i: number, j: number, k: number, dirs: number[]) => {
    for (let d = 0; d < dirs.length; d += 3)
      if (!full(i + (dirs[d] ?? 0), j + (dirs[d + 1] ?? 0), k + (dirs[d + 2] ?? 0))) return true;
    return false;
  };
  // mit `all` kommt nur dazu, was ohne fehlt; es übermalt nichts (Moos): So sieht der Zugang genauso aus
  const keep = all
    ? (i: number, j: number, k: number) => free(i, j, k, FIVE) && (!v.has(i, j, k) || free(i, j, k, seen))
    : (i: number, j: number, k: number) => free(i, j, k, seen);
  for (let k = k0; k < k0 + nk; k++)
    for (let j = j0; j < j0 + nj; j++)
      for (let i = i0; i < i0 + ni; i++) {
        const p = grid[at(i, j, k)];
        if (!p || !keep(i, j, k)) continue;
        if (typeof p === 'string') v.set(i, j, k, p);
        else v.set(i, j, k, p.c, 'bright');
      }
}

/* ---------- Die zwei Riesenpilze: Sockel (Voxel), Stiel und Hut (feine Modelle, mitwachsen-gate-flora.ts) ---------- */

const HAT = GIANT.hat; // Hut 4,4 breit, der sichtbare Stiel nur etwa 2,5 hoch
/** So weit über der Oberfläche von Stiel und Hut liegt die Mitte einer Ranke: Ihr Voxel (1/8) berührt sie immer */
const CLING = 3 / 64;

/** bemooster Felssockel um den Fuß des Stiels; bleibt ganz neben dem Weg (|x| ≥ 2,5) */
function socketPaint(cx: number, x: number, y: number, z: number, i: number, j: number, k: number): Paint {
  const d = ((x - cx) / 1.6) ** 2 + (y / 0.95) ** 2 + ((z - PZ) / 1.2) ** 2;
  if (Math.abs(x) < 2.5 || d > 1 + (hash3(i, j, k) - 0.5) * 0.25) return null;
  const h = hash3(i, j, k + 7);
  if (h < 0.05) return { c: MOOS[3], glow: true };
  return h < 0.2 ? MOOS[2] : h < 0.45 ? MOOS[1] : h < 0.85 ? MOOS[0] : MOOS[4];
}

/** Sockel eines Riesenpilzes aus Voxeln (Fels und Moos gehören zum Torhaus) */
function socket(v: Vox, side: number, cam: Cam, all?: boolean) {
  const cx = side * PX;
  const box = [cx - 1.7, 0, PZ - 1.3, cx + 1.7, 1.05, PZ + 1.3];
  shell(v, box, (x, y, z, i, j, k) => socketPaint(cx, x, y, z, i, j, k), cam, all);
}

/** Stiel und Hut eines Riesenpilzes als feines Modell: Hut gestuft in Lack mit Tupfen, Stiel mit Fasern */
export const giantOf = (side: number, t: number): Giant => ({ x: side * PX, z: PZ, hatZ: HZ, hatY: hatY(t) });

/**
 * Ranken um den Stiel: ein welliges Band rundherum, mit Leuchtspitzen, Moos und flachen Hütchen als Konsolen; sie
 * liegen auf der Oberfläche des feinen Stiels (Achteck, `octagonReach`), `CLING` darüber
 */
function stemVines(v: Vox, side: number, t: number) {
  const cx = side * PX;
  for (let a = 0; a < 170; a++) {
    const f = (a / 170) * 2 * Math.PI,
      [nx, nz] = [Math.cos(f), Math.sin(f)];
    const y = 1.75 + 0.55 * Math.sin(2 * f + side) + 0.22 * Math.sin(5 * f);
    const r = stemPieceRadius(y, hatY(t)) * octagonReach(f) + CLING;
    const [x, z] = [cx + nx * r, PZ + nz * r];
    if (z >= 0.5 || Math.abs(x) < 2.5) continue;
    const c = (side > 0 ? TUERKIS : ROSA)[a % 9 < 2 ? 1 : 0];
    const at = (dx: number, dy: number, dz: number) => [vx(x + dx), vx(y + dy), vx(z + dz)] as const;
    put(v, at(0, 0, 0), c);
    if (a % 2) put(v, at(0, -1 / 8, 0), c);
    if (a % 23 === 7) put(v, at(nx / 8, 1 / 8, nz / 8), TIPS[0], 'bright');
    if (a % 31 === 3) put(v, at(nx / 8, -1 / 8, nz / 8), MOOS[2]);
    if (a % 43 !== 20) continue;
    const [h0, h1] = hutPair(a + side + 4);
    for (let d = -2; d <= 2; d++)
      for (let e = 1; e <= 3; e++)
        put(v, at((nx * e - nz * d) / 8, 1 / 8, (nz * e + nx * d) / 8), e === 3 || Math.abs(d) === 2 ? h1 : h0);
  }
}

/**
 * Bögen unter dem Hutrand: zwei Ranken hängen in weichen Bögen rundherum, an den tiefsten Stellen leuchtet es; sie
 * hängen am Rand der untersten Lage des feinen Huts (Achteck, `octagonReach`)
 */
function rimVines(v: Vox, side: number, t: number) {
  const [cx, hy] = [side * PX, hatY(t) + 0.1];
  const c = side > 0 ? ROSA : TUERKIS;
  for (let a = 0; a < 200; a++) {
    const f = (a / 200) * 2 * Math.PI;
    const reach = octagonReach(f);
    const [x, z] = [cx + (HAT.r1 * reach + CLING) * Math.cos(f), HZ + (HAT.r2 * reach + CLING) * Math.sin(f)];
    if (z >= 0.5) continue;
    const bog = Math.abs(Math.sin(f * 6 + side));
    const [i, j, k] = [vx(x), vx(hy - 0.3 * bog), vx(z)];
    v.set(i, j, k, c[a % 7 < 2 ? 1 : 0]);
    if (bog > 0.985) v.set(i, j - 1, k, TIPS[a % 2 ? 0 : 2], 'bright');
    if (a % 3 === 0) v.set(i, vx(hy - 0.15 * Math.abs(Math.cos(f * 6 + side))), k, WEISS[0]);
  }
}

/* ---------- Myzelpolster und Leuchtknospe ---------- */

// Polster: je Mitte (x, z), Halbachsen (rx, ry, rz) und die Seite, zu der es sich beim Öffnen zieht
const PADS = [
  -1.9, -0.05, 0.7, 0.55, 0.55, -1, -0.75, -1.05, 0.65, 0.42, 0.55, -1, 0.85, 0.05, 0.62, 0.45, 0.45, 1, 2.0, -0.9,
  0.62, 0.62, 0.62, 1, 0.1, -1.55, 0.6, 0.38, 0.4, 1,
];
function pads(v: Vox, g: number) {
  for (let n = 0; n < PADS.length; n += 6) {
    const [x = 0, z = 0, rx = 1, ry = 1, rz = 1, side = 1] = PADS.slice(n, n + 6);
    const s = 1 - 0.45 * g,
      w = rx * s,
      cx = lerp(x, side * (2.65 + w), g);
    shell(v, [cx - w - 0.1, 0, z - rz - 0.1, cx + w + 0.1, ry + 0.1, z + rz + 0.1], (px, py, pz, i, j, k) => {
      const d = ((px - cx) / w) ** 2 + (py / (ry * s)) ** 2 + ((pz - z) / rz) ** 2;
      if (d > 1 + (hash3(i, j, k) - 0.5) * 0.3) return null;
      const h = hash3(i, j, k + 3);
      return h < 0.05 ? { c: TIPS[1], glow: true } : h < 0.3 ? MYZEL[1] : h < 0.4 ? MYZEL[2] : MYZEL[0];
    });
  }
}

/** Leuchtknospe: flacher, breiter Leuchtpilz; schläft mitten im Geflecht, offen sitzt sie auf der Girlande */
function bud(v: Vox, t: number) {
  const awake = ease(seg(t, 0.15, 0.3)) > 0.3,
    up = ease(seg(t, 0.45, 0.95));
  const [j0, k0] = [Math.round(lerp(1.55, 3.85, up) * VOX), Math.round(lerp(-0.05, -0.25, up) * VOX)];
  const part = awake ? 'bright' : 'solid';
  const [cap, cap2, gill] = awake ? ['#c8fff6', '#8edbd2', '#fff6c8'] : ['#9d8cd0', '#7a6aa8', '#c9b8ec'];
  for (let a = -3; a <= 3; a++)
    for (let b = -2; b <= 2; b++) {
      const r = a * a + b * b * 2.2;
      if (r > 11) continue;
      v.set(a, j0, k0 + b, r < 3 ? gill : cap2, part);
      if (r < 6) v.set(a, j0 + 1, k0 + b, (a + b) % 3 === 0 && r > 1 ? '#ffffff' : cap, part);
    }
}

/* ---------- Schild und Moos ---------- */

/** Schild: gedrungener Fliegenpilz (Hut 12 breit, Stiel 4 breit und 3 hoch) im Holzrahmen */
const SIGN = [
  '.bbbbbbbbbbbbbb.',
  'bhhhhhrrrrhhhhhb',
  'bhhhrrwwrrrrhhhb',
  'bhhrrrwwrrrrrhhb',
  'bhrrrrrrrrwwrrhb',
  'bhrwwrrrrrwwrrhb',
  'bhrwwrrrrrrrrrhb',
  'bhlllllllllllllb',
  'bhhhhhsssshhhhhb',
  'bhhhhhsssshhhhhb',
  'bmmmmssssssmmmmb',
  '.bbbbbbbbbbbbbb.',
];
const SIGN_PAL = { b: '#8a5a32', h: '#f6efe0', r: '#d9473a', w: '#ffffff', l: LAMELLE, s: STIEL[0], m: MOOS[0] };
export const SIGN_AT = { x: 5.75, z: -0.625 };
/** Schild zur Kamera, nur wenn der Zugang nicht hinten liegt; auf der Seite, die der Kamera näher ist */
function sign(v: Vox, cam: Cam) {
  if (cam[1] > 0) return;
  const [x, z] = [(cam[0] < 0 ? -1 : 1) * SIGN_AT.x, SIGN_AT.z];
  v.fill(x - 1 / 8, 0, z - 1 / 8, x + 1 / 8, 5 / 8, z + 1 / 8, SIGN_PAL.b);
  v.image(x, 5 / 8, z, SIGN, SIGN_PAL, cam, 'solid');
}

/** lila Moos auf dem Fels neben dem Durchgang, in Flecken aus 2 × 2 Voxeln, hier und da ein leuchtender Punkt */
function moss(v: Vox) {
  for (let k = -20; k < BAY_K - 1; k++)
    for (let i = -36; i < 36; i++) {
      if (i > -21 && i < 20) continue; // Voxel −21 endet bei x −2,5, Voxel 20 beginnt bei 2,5
      const h = hash3(i >> 1, k >> 1, 5);
      if (h > 0.4) continue;
      if (hash3(i, k, 6) < 0.04) v.set(i, 0, k, MOOS[3], 'bright');
      else v.set(i, 0, k, h < 0.1 ? MOOS[2] : h < 0.22 ? MOOS[1] : MOOS[0]);
    }
}

/** alle festen Voxel des Zugangs bei Öffnung `g.open` (0 zu … 1 offen) */
export function pilzVox(g: Pick<GateCtx, 'open' | 'cam' | 'all'>): Vox {
  const t = Math.min(1, Math.max(0, g.open));
  const v = new Vox();
  moss(v);
  for (const side of [-1, 1]) {
    socket(v, side, g.cam, g.all); // mit `all` die ganze Hülle (außer nach unten)
    stemVines(v, side, t);
    rimVines(v, side, t);
  }
  pads(v, curl(t));
  bud(v, t);
  sign(v, g.cam);
  return v;
}

export const build: GateBuild = (p, g) => {
  pilzVox(g).emit(p);
  const t = Math.min(1, Math.max(0, g.open));
  for (const side of [-1, 1]) plantInto(p, giantBoxes(giantOf(side, t)));
  return [];
};

/* ---------- Ranken im Durchgang (bewegt) ---------- */

/**
 * Eine Ranke je Zeile: Ansatz A (x, y), Ziel B, Bogen (wölbt den Weg nach oben), Phase der Welle, Schlinge (Anfang als
 * Anteil, Radius; negativ zur anderen Seite), Farbe (0 rosa, 1 weiß, 2 türkis), Tiefe zu und offen, Länge der Farnlocke,
 * Hütchen (Anteil, Farbe; −1 ohne). Zu läuft sie von A nach B mit sanfter Welle und Schlinge; offen ist sie eine
 * Farnlocke ab A, deren Krümmung zur Spitze wächst: links nach oben außen eingerollt, rechts gespiegelt, an der Girlande
 * (A über 3,5) unter ihr. Dazwischen wird die Krümmung gemischt, die Spitze rollt zuerst ein.
 */
const ROWS: (readonly number[])[] = [
  // vorn: großer Bogen von links mit Locke am Ende, Schlinge von rechts nach links oben
  [-2.45, 0.2, 2.0, 1.3, 2.1, 0, 0.8, -0.32, 0, 0.28, 0.36, 2.6, 0.45, 0],
  [2.5, 0.55, -2.1, 2.7, -0.5, 1.4, 0.45, 0.4, 2, 0.22, 0.36, 2.4, 0.75, 3],
  // Mitte: weiß quer herab mit Schlinge, türkis Bogen von rechts
  [-2.55, 2.6, 2.2, 0.55, 0.5, 1, 0.38, -0.42, 1, -0.5, 0.36, 2.4, 0.15, 1],
  [2.5, 0.25, -2.2, 0.9, 1.7, 2.6, 0.78, 0.34, 2, -0.65, 0.36, 2.2, -1, 0],
  // hinten: rosa Bogen, weiß von rechts oben mit Schlinge
  [-2.5, 0.3, 2.3, 0.6, 2.7, 0.5, 0.6, 0.3, 0, -1.25, -1.9, 2.2, 0.3, 2],
  [2.6, 3.0, -2.3, 1.4, 0.3, 2.2, 0.42, 0.4, 1, -1.1, -1.9, 2.2, -1, 0],
  // hängen an der Girlande herab; offen rollen sie sich unter ihr ein
  [-1.2, 3.65, -1.3, 2.2, 0, 0.4, 0.42, 0.32, 0, -0.2, -0.2, 1.2, 0.15, 1],
  [1.3, 3.65, 1.4, 2.1, 0, 4.1, 0.42, -0.32, 2, -0.2, -0.2, 1.2, 0.15, 3],
];

/** Weg einer Ranke zu als Punkte (x, y) */
function path(r: readonly number[]) {
  const [ax = 0, ay = 0, bx = 0, by = 0, bow = 0, ph = 0, l0 = 0, lr = 0] = r;
  const [dx, dy] = [bx - ax, by - ay],
    len = Math.hypot(dx, dy);
  const pts: [number, number][] = [];
  for (let n = 0; n <= 300; n++) {
    const u = n / 300,
      w = 2 * Math.PI * seg(u, l0, l0 + 0.17);
    const a = len * u - Math.abs(lr) * Math.sin(w);
    const b = 0.12 * Math.sin(2 * Math.PI * u + ph) * Math.sin(Math.PI * u) + lr * (1 - Math.cos(w));
    pts.push([ax + (dx * a - dy * b) / len, ay + (dy * a + dx * b) / len + bow * Math.sin(Math.PI * u)]);
  }
  return pts;
}

const M = 200; // Stützstellen der Richtung je Ranke
/** Ranke aus einer Zeile: Richtung des Wegs je Bogenlänge (fortlaufend, ohne Sprung) und die Farnlocke offen */
function trace(r: readonly number[]) {
  const pts = path(r),
    N = pts.length - 1;
  const head: number[] = [],
    sl: number[] = [0];
  for (let n = 0; n < N; n++) {
    const [p, p2] = [pts[n]!, pts[n + 1]!];
    head.push(Math.atan2(p2[1] - p[1], p2[0] - p[0]));
    sl.push(sl[n]! + Math.hypot(p2[0] - p[0], p2[1] - p[1]));
  }
  const L = sl[N]!,
    hs = new Float32Array(M + 1);
  let [idx, acc, prev] = [0, head[0]!, head[0]!];
  hs[0] = acc;
  for (let m = 1; m <= M; m++) {
    while (idx < N - 1 && sl[idx + 1]! < (m / M) * L) idx++;
    const h = head[idx]!;
    acc += Math.atan2(Math.sin(h - prev), Math.cos(h - prev));
    hs[m] = acc;
    prev = h;
  }
  const [ax = 0, ay = 0, , , , , , , ci = 0, z = 0, zo = 0, Lo = 2, hu = -1, hc = 0] = r;
  const [hang, sg] = [ay > 3.5, ax < 0 ? 1 : -1];
  const th = hang ? -Math.PI / 2 - 0.5 * sg : Math.PI / 2 + 0.55 * sg;
  const [k0, k1] = hang ? [3.4, 8] : [lerp(2.6, 1.6, (Lo - 1.4) / 1.2), 6.5];
  const c = VCOL[ci] ?? ROSA,
    tip = TIPS[ci] ?? TIPS[0];
  return { A: [ax, ay] as const, c, tip, z, zo, Lo, th, k0, k1, sg, hut: [hu, hc] as const, L, hs, th0: head[0]! };
}
const VINES = ROWS.map(trace);
type Vine = (typeof VINES)[number];

/** Richtung der verwachsenen Ranke bei Bogenlänge s */
const headAt = (q: Vine, s: number) => {
  const f = Math.max(0, Math.min(1, s / q.L)) * M,
    a = Math.floor(f);
  return lerp(q.hs[a] ?? 0, q.hs[Math.min(M, a + 1)] ?? 0, f - a);
};

/** Zeichnet in das Raster des Takts: lässt Zellen aus, die das feste Raster belegt */
type Pen = (i: number, j: number, k: number, c: string, glow?: boolean) => void;

/** flaches, breites Hütchen auf der Ranke (5 × 3 Voxel, darunter leuchtende Lamellen) */
function hat(pen: Pen, i: number, j: number, k: number, ci: number) {
  const [c0, c1] = hutPair(ci);
  for (let d = -1; d <= 1; d++) pen(i + d, j + 1, k, LAMELLE, true);
  for (let d = -2; d <= 2; d++)
    for (let e = -1; e <= 1; e++) pen(i + d, j + 2, k + e, Math.abs(d) === 2 || e ? c1 : c0);
  for (let d = -1; d <= 1; d++) pen(i + d, j + 3, k, c0);
}

/** eine Ranke im Zustand g (0 verwachsen … 1 eingerollt), Licht bis Anteil `wake`, wiegt sich mit Phase `sw` */
function vine(pen: Pen, q: Vine, g: number, wake: number, sw: number) {
  // erst zieht sich die Ranke zum Ansatz zurück, dann dreht sie sich und rollt sich ein: kein weites Schwenken
  const Lv = lerp(q.L, q.Lo, ease(seg(g, 0, 0.65))),
    n = Math.ceil(Lv * VOX),
    ds = Lv / n;
  const dth = Math.atan2(Math.sin(q.th - q.th0), Math.cos(q.th - q.th0));
  let [x, y] = q.A;
  let th = q.th0 + dth * ease(seg(g, 0.3, 0.85));
  const ph = q.A[0] * 3.1 + q.A[1] * 1.7;
  const z0 = lerp(q.z, q.zo, ease(seg(g, 0.1, 0.7)));
  for (let s = 0; s <= n; s++) {
    const u = s / n,
      gu = ease(seg(g * 1.5 - (1 - u) * 0.5, 0, 1));
    const dc = s ? headAt(q, s * ds) - headAt(q, (s - 1) * ds) : 0,
      uo = Math.min(1, (s * ds) / q.Lo);
    const ko = q.sg * (q.k0 + (q.k1 - q.k0) * uo * uo) * ds;
    th += lerp(dc, ko, gu) + 0.07 * u * Math.sin(sw + ph + u * 1.6) * ds;
    x += Math.cos(th) * ds;
    y = Math.max(0.07, y + Math.sin(th) * ds);
    const [i, j, k] = [vx(x), vx(y), vx(Math.min(0.45, z0 + 0.22 * Math.sin(u * 5.3 + ph) * (1 - g)))];
    if (u > 0.93) {
      pen(i, j, k, q.tip, true);
      continue;
    }
    const front = Math.abs(u - wake) < 0.07,
      c0 = front ? q.tip : q.c[0];
    pen(i, j, k, c0, true);
    // zur Spitze dünner: am Ansatz drei Voxel (dazu die dunkle Unterseite), in der Mitte zwei, an der Spitze einer
    if (u < 0.8 - 0.4 * g) pen(i, j - 1, k, front ? q.tip : q.c[1], wake > u);
    if (u < 0.5 - 0.35 * g) pen(i, j, k - 1, c0, true);
    if (Math.round(q.hut[0] * n) === s && g < 0.9) hat(pen, i, j, k, q.hut[1]);
  }
}

/** Girlande oben zwischen den Hüten: zwei umeinander gedrehte Ranken mit Leuchtpünktchen; hängt leicht durch */
function garland(pen: Pen, g: number, wake: number, sw: number) {
  const sag = lerp(0.3, 0.42, g);
  for (let w = 0; w < 2; w++) {
    const c = w ? ROSA : WEISS;
    for (let i = -22; i < 22; i++) {
      const x = (i + 0.5) / VOX,
        u = 1 - (x / 2.75) ** 2,
        a = x * 3.2 + w * Math.PI;
      const y = 3.95 - sag * u + 0.1 * Math.sin(a) + 0.09 * u * Math.sin(sw + x * 0.8);
      const z = -0.2 + 0.11 * Math.cos(a) + 0.08 * u * Math.cos(sw + x * 0.8);
      pen(i, vx(y), vx(z), i % 5 === 0 ? c[1] : c[0], wake > 0.1);
      if (w === 0 && i % 6 === 3) pen(i, vx(y) - 1, vx(z) + 1, TIPS[i % 12 === 3 ? 2 : 0], true);
    }
  }
}

/** Glühwürmchen: kreist langsam um die schlafende Knospe, offen um die Girlande */
function firefly(pen: Pen, g: number, beat: number) {
  const a = (2 * Math.PI * beat) / BEATS;
  const [i, j, k] = [vx(0.75 * Math.sin(a)), vx(lerp(2.45, 4.45, g) + 0.2 * Math.cos(a)), vx(0.3 + 0.1 * Math.cos(a))];
  pen(i, j, k, '#e8ff7a', true);
  pen(i + 1, j, k, '#e8ff7a', true);
  pen(i, j + 1, k - 1, '#f4f8fb');
  pen(i + 1, j + 1, k - 1, '#f4f8fb');
}

/** festes Raster je Öffnung und Lage, einmal gebaut (motion fragt es in jedem Takt) */
const fixed = new Map<string, Vox>();
function fixedVox(g: Pick<GateCtx, 'open' | 'cam' | 'all'>) {
  const key = `${g.open},${g.cam[0]},${g.cam[1]},${!!g.all}`;
  let v = fixed.get(key);
  if (!v) {
    if (fixed.size > 40) fixed.clear();
    v = pilzVox(g);
    fixed.set(key, v);
  }
  return v;
}

/** alle bewegten Voxel im Takt `beat` (Ranken, Girlande, Glühwürmchen); keiner liegt in einer festen Zelle */
export function motionVox(g: Pick<GateCtx, 'open' | 'cam' | 'all'>, beat: number): Vox {
  const t = Math.min(1, Math.max(0, g.open));
  const solid = fixedVox(g);
  const v = new Vox();
  const pen: Pen = (i, j, k, c, glow) => {
    if (j < 0 || k >= BAY_K || solid.has(i, j, k)) return;
    v.set(i, j, k, c, glow ? 'bright' : 'solid');
  };
  const b = ((beat % BEATS) + BEATS) % BEATS,
    sw = (2 * Math.PI * b) / BEATS;
  const [c, wake] = [curl(t), wakeAt(t)];
  garland(pen, c, wake, sw);
  for (const q of VINES) vine(pen, q, c, wake, sw);
  firefly(pen, c, b);
  return v;
}

export const motion: GateMotion = (p, g, beat) => {
  motionVox(g, beat).emit(p);
};

/** Torplatte vor dem Zugang (mitwachsen-plate-3d.ts, Zeichen in Farben aus `PALETTE`): flacher, blauer Pilzhut mit hellen Tupfen, der von unten glimmt (leuchtende Lamellen darunter) */
export const plate: PlateLook = {
  face: [BLAU[1], BLAU[0]],
  mark: ['.d....d....d.', '....d....d...', '..d....d....d'],
  under: 'F',
  deep: true, // zwei Voxel dick: sinkt einen Voxel tiefer, sonst steckten die Füße im Hut
};
