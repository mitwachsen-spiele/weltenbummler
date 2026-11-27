// Zugang zur Sandwelt in 3D (Entwurf „Welten-Zugänge“, Idee a): ein vom Wind geschliffener Bogen aus gestreiftem
// Sandstein. Zu füllt eine Düne den Durchgang, aus dem Bogen rieseln Sandfäden wie in der Sanduhr. Beim Öffnen reißen
// die Fäden ab, die Düne rinnt von der Mitte her in den Boden, darunter liegen helle Platten, und die trockene Mulde im
// linken Pfeiler füllt sich mit Wasser. Offen hängen Tonglöckchen unter dem Bogen. Zwei hohe Palmen der Oase ragen
// hinter den Pfeilern über den Fels (feine Modelle: mitwachsen-gate-flora.ts), oben auf dem Bogen sitzt die Sonnenscheibe mit Pyramide und schaut zur Kamera.
// Gehört zur 3D-Ansicht und wird nur mit ihr nachgeladen (Three.js).

import { Vox, ease, hash3, plantInto, seg, type GateBuild, type GateCtx } from './mitwachsen-gate-kit';
import { palmBoxes, type Palm } from './mitwachsen-gate-flora';
import type { PlateLook } from './mitwachsen-plate';

const SST = ['#b9965c', '#d1b273', '#e2c78e'] as const; // Sandstein dunkel, mittel, hell
const SST_TOP = '#ead29a';
const DUNE = { top: '#efdeaa', side: '#ecd9a2' };
const FADEN = '#fff1c4'; // Sandfäden leuchten im Gegenlicht
const PLATE = { top: SST[2], side: SST[1] };
const MULDE = { dry: '#b48d58', crack: '#8f6a3e' };
const WATER = { c: '#7fc8ff', glint: '#b8e2ff' };
const TON = { c: '#c96f4a', top: '#d98a62', dark: '#8a4a2a', cord: '#a0764a' };

// Maße in Voxeln (1/8 Feld): Pfeiler |i| 20 … 32 (x 2,5 … 4), Tiefe k −6 … 4 (z −0,75 … 0,5), Brücke ab j 32 (y 4)
const P_IN = 20,
  P_OUT = 32,
  K0 = -6,
  K1 = 4,
  BRIDGE = 32,
  TOP = 40;

/** Abstand eines Index von der Mitte, gespiegelt: rechts i, links −i − 1 (so liegen beide Pfeiler gleich) */
const mirror = (i: number) => (i < 0 ? -i - 1 : i);
/** Unterkante des Bogens über dem Durchgang: am Rand 3, in der Mitte 4 Felder hoch */
export const archJ = (i: number) => {
  const x = (i + 0.5) / 8;
  return Math.round(8 * (3 + Math.sqrt(Math.max(0, 1 - (x / 2.5) ** 2))));
};
/** Oberkante der Brücke: Schultern an den Enden gerundet, vorn einzelne ausgewaschene Kerben */
function topJ(i: number, k: number) {
  const d = (P_OUT - mirror(i) - 0.5) / 8;
  const shoulder = d < 0.6 ? Math.round((Math.sqrt(Math.max(0, 0.36 - (0.6 - d) ** 2)) / 0.6) * 4) - 4 : 0;
  const notch = k === K1 - 1 && hash3(i, 3, 19) < 0.18 ? 1 : 0;
  return TOP + shoulder - notch;
}

/** Steht hier Sandstein? Pfeiler (mit Taille, Mulde links, ausgewaschenen Kanten) oder Brücke mit Bogen */
function stone(i: number, j: number, k: number) {
  if (j < 0 || k < K0 || k >= K1) return false;
  const a = mirror(i);
  if (a >= P_OUT) return false;
  if (j >= BRIDGE) return j < topJ(i, k) && (a >= P_IN || j >= archJ(i));
  if (j >= 24 && a < P_IN) return j >= archJ(i);
  return pillar(i, j, k, a);
}

/** Pfeiler unter der Brücke: Taille, Mulde links, vorn ausgewaschene Kanten */
function pillar(i: number, j: number, k: number, a: number) {
  const e = j >= 16 && j < 24 ? 1 : 0; // Taille: je Seite ein Achtel schmaler
  if (a < P_IN + e || a >= P_OUT - e || k >= K1 - e) return false;
  if (i < 0 && a >= 23 && a < 30 && k >= 0 && j < 8) return false; // Mulde im linken Pfeiler
  const corner = (a === P_IN + e || a === P_OUT - 1 - e) && k === K1 - 1 - e;
  return !(corner && hash3(i, j, k) < 0.4);
}

/** Richtungen, in denen eine Außenfläche zählt: nie nach unten, nie von der Kamera weg (die sieht keiner; mit `all` doch) */
function seen(cam: GateCtx['cam'], every = false): [number, number, number][] {
  const dirs: [number, number, number][] = [
    [0, 1, 0],
    [1, 0, 0],
    [-1, 0, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  return dirs.filter(([x, y, z]) => every || y === 1 || x !== -cam[0] || z !== -cam[1]);
}

/** Bogen und Pfeiler als Schale: nur Voxel, die eine sichtbare Außenseite haben (spart Voxel, innen ist es hohl) */
function arch(v: Vox, cam: GateCtx['cam'], all?: boolean) {
  const dirs = seen(cam, all);
  for (let j = 0; j < TOP; j++)
    for (let k = K0; k < K1; k++)
      for (let i = -P_OUT; i < P_OUT; i++) {
        if (!stone(i, j, k)) continue;
        if (!dirs.some(([x, y, z]) => !stone(i + x, j + y, k + z))) continue;
        const band = Math.floor(j / 4);
        const c = SST[(band + (j >= BRIDGE ? 1 : 0)) % 3]!;
        v.set(i, j, k, c, 'solid', stone(i, j + 1, k) ? c : j >= TOP - 2 ? SST_TOP : SST[2]);
      }
}

/** Mulde im linken Pfeiler: Steinrand, rissiger Boden, Wasser je nach Öffnung (0 trocken … 3 voll und glitzernd) */
function mulde(v: Vox, level: number) {
  const RISSE = new Set(['1,1', '2,2', '2,3', '3,2', '4,1', '5,2', '6,1', '3,0', '1,2']);
  for (let k = 0; k < 4; k++)
    for (let a = 23; a < 30; a++) {
      const i = -a - 1;
      const rim = a === 23 || a === 29 || k === 3;
      if (rim) {
        const h = hash3(a, k, 7) < 0.35 ? 2 : 3;
        for (let j = 0; j < h; j++) v.set(i, j, k, hash3(a, j, k) < 0.3 ? SST[0] : SST[1]);
        continue;
      }
      const dry = level === 0 && RISSE.has(`${a - 24},${k}`);
      v.set(i, 0, k, dry ? MULDE.crack : MULDE.dry);
      for (let j = 1; j <= Math.min(level, 2); j++) {
        const glint = j === 2 && level >= 3 && hash3(a, k, 31) < 0.25;
        v.set(i, j, k, glint ? WATER.glint : WATER.c);
      }
    }
}

/** Dünenkamm quer zum Tor: an den Pfeilern 1,25, in der Mitte 2,5 Felder hoch */
function crest(x: number) {
  const p: [number, number][] = [
    [-2.5, 1.25],
    [-2, 1.5],
    [-1, 2],
    [0, 2.5],
    [1, 2],
    [2, 1.5],
    [2.5, 1.25],
  ];
  for (let n = 1; n < p.length; n++) {
    const [xa, ha] = p[n - 1]!,
      [xb, hb] = p[n]!;
    if (x <= xb) return ha + ((hb - ha) * (Math.max(x, xa) - xa)) / (xb - xa);
  }
  return 1.25;
}

/** Höhe der Düne in Voxeln; `u` wie weit sie versickert ist (0 … 1,1), von der Mitte her zuerst */
function duneH(i: number, k: number, u: number) {
  const [x, z] = [(i + 0.5) / 8, (k + 0.5) / 8];
  const back = z < -0.5 ? Math.max(0, (z + 1) / 0.5) : 1;
  const front = z > 0 ? (1 - z / 0.5) ** 1.3 : 1;
  let h = crest(x) * back * front + (hash3(i >> 1, k, 9) < 0.25 ? 0.125 : 0);
  if (u > 0) h -= u * (1.5 + 3.3 * (1 - Math.min(1, Math.hypot(x / 2.6, (z + 0.5) / 1.2))));
  return Math.max(0, Math.round(h * 8));
}

/** Düne im Durchgang (|x| < 2,5, z −1 … 0,5) als Höhenfeld: je Säule nur so tief, dass keine Lücke entsteht */
function dune(v: Vox, u: number, from: number) {
  const h = (i: number, k: number) => (i < -20 || i >= 20 || k < -8 ? Infinity : k >= K1 ? 0 : duneH(i, k, u));
  for (let k = -8; k < K1; k++)
    for (let i = -20; i < 20; i++) {
      const top = h(i, k);
      const low = Math.min(top - 1, h(i + 1, k), h(i - 1, k), h(i, k + 1), h(i, k - 1));
      for (let j = Math.max(from, low); j < top; j++) v.set(i, j, k, DUNE.side, 'solid', DUNE.top);
    }
}

/** Helle Platten unter der Düne: drei Felder breit, Fugen ein Achtel, vom Tor bis zwei Felder in den Gang */
function plates(v: Vox) {
  for (let k = -20; k < K1; k++)
    for (let i = -12; i < 12; i++) {
      if ((i + 12) % 8 === 7 || (k + 20) % 8 === 7) continue;
      v.set(i, 0, k, PLATE.side, 'solid', PLATE.top);
    }
}

/** Sandfäden aus dem Bogen auf die Düne, gestrichelt wie rieselnder Sand; `cut` 0 … 1 reißt sie von oben her ab */
function threads(v: Vox, cut: number) {
  [-13, -9, -4, 0, 4, 9, 13].forEach((i, n) => {
    const top0 = archJ(i) - 1,
      bot = duneH(i, 1, 0);
    const top = Math.round(top0 - cut * (top0 - bot));
    for (let j = bot; j <= top; j++) if ((top0 - j + n) % 4 !== 3) v.set(i, j, 1, FADEN, 'bright');
  });
}

/** Tonglöckchen an einer Schnur unter dem Bogen; die Schnur hängt durch, kein Glöckchen reicht unter 3 Felder */
function bells(v: Vox) {
  const cordJ = (i: number) => {
    const x = (i + 0.5) / 8;
    return Math.max(27, Math.round(8 * (archJ(i) / 8 - 0.45 * Math.sin((Math.PI * (x + 2.5)) / 5))) - 1);
  };
  for (let i = -19; i < 19; i++) v.set(i, Math.min(cordJ(i), archJ(i) - 1), 2, TON.cord);
  for (const bx of [-12, -6, 0, 6, 12]) {
    const j = cordJ(bx);
    for (let di = -1; di < 1; di++)
      for (let dk = 1; dk < 3; dk++) for (let dj = 1; dj < 3; dj++) v.set(bx + di, j - dj, dk, TON.c, 'solid', TON.top);
    v.set(bx, j - 3, 2, TON.dark);
  }
}

/** Zwei hohe Palmen der Oase hinter den Pfeilern, nach außen geneigt (feine Modelle, mitwachsen-gate-flora.ts) */
export const PALMS: readonly Palm[] = [
  { x: -4.6, z: -1.1, h: 6.9, lean: -0.4, turn: 0.2 },
  { x: 4.6, z: -1.3, h: 7.5, lean: 0.4, turn: 0.6 },
];

/** Weltzeichen der Sandwelt wie auf der Portal-Plattform: Sonne über Pyramide in runder Scheibe */
const SIGN = [
  '.....ffffff.....',
  '...ffbbbbbbff...',
  '..fbbbbyybbbbf..',
  '.fbbbbyyyybbbbf.',
  '.fbbbbyyyybbbbf.',
  'fbbbbbbyybbbbbbf',
  'fbbbbbbbbbbbbbbf',
  'fbbbbbbaAbbbbbbf',
  'fbbbbbbaAbbbbbbf',
  'fbbbbbaaAAbbbbbf',
  '.fbbbaaaAAAbbbf.',
  '.fbbaaaaAAAAbbf.',
  '..fssssssssssf..',
  '...ffssssssff...',
  '.....ffffff.....',
];
const SIGN_PAL = { f: SST[0], b: '#3f86cf', y: '#ffd34d', a: '#efdeaa', A: '#d1b273', s: '#e3cf95' };

/** Wasser in der Mulde je nach Öffnung: trocken, bis es nach dem Versickern gluckert und voll wird */
const waterLevel = (open: number) => (open >= 1 ? 3 : open >= 0.8 ? 2 : open >= 0.6 ? 1 : 0);

/** Das Voxel-Raster des Zugangs in einem Zustand (auch für Tests) */
export function sandGate(g: GateCtx): Vox {
  const v = new Vox();
  arch(v, g.cam, g.all);
  mulde(v, waterLevel(g.open));
  const u = 1.1 * ease(seg(g.open, 0.2, 0.73)); // die Düne versickert, nachdem die Fäden abgerissen sind
  if (g.open >= 0.5) plates(v);
  dune(v, u, g.open >= 0.5 ? 1 : 0);
  if (g.open < 0.2) threads(v, seg(g.open, 0, 0.2));
  if (g.open >= 0.9) bells(v);
  // Schild auf der Brücke, Unterkante auf ihrer Oberseite; schaut immer zur Kamera
  v.image(0, TOP / 8, -0.625, SIGN, SIGN_PAL, g.cam, 'bright', 1);
  return v;
}

export const build: GateBuild = (p, g) => {
  sandGate(g).emit(p);
  for (const palm of PALMS) plantInto(p, palmBoxes(palm));
  return [];
};

/** Torplatte vor dem Zugang (mitwachsen-plate-3d.ts, Zeichen in Farben aus `PALETTE`): Fliese aus Sandstein mit leuchtender Sonne */
export const plate: PlateLook = {
  face: [SST[1], SST[2]],
  mark: ['R..R..R', '.RRRRR.', 'RRR3RRR', '.RRRRR.', 'R..R..R'],
};
