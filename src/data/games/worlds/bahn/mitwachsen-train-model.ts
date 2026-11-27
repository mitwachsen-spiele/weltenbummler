// Modelle der Höhlenbahn und von Bahnhof Bär, nur im Paket der Bahn (Teile wie in `front.ts`: vorn, rechts, unten, Länge,
// Breite, Höhe, Farbe, oben; eigene Voxel-Grafik nach der Skizze im Konzept, keine Lore, kein Gesicht): der kleine Zug aus
// Lok und zwei Wagen, Silber mit lila Fensterband und türkisem Leuchtstreifen, vorn im Zielfenster eine Fledermaus, an den
// Seiten der Lok eine Kristall-Raute, weiße Dampfwölkchen; im hinteren Wagen sitzt Tok, sobald er eingestiegen ist, und
// dort geht die Tür auf. Bahnhof Bär: Bahnsteig aus Holzplanken mit heller Kante, eine Stufe über dem Gleis; Grasdach auf
// vier Pfosten mit Bank für wartende Tiere, darauf das Schild „Bär auf Grün“ (ohne Text). Fahren:
// Die Figur sitzt im mittleren Wagen (das Dach dort ist offen, Kopf und Schultern schauen heraus), seine Tür hat bis zur
// ersten Fahrt einen goldenen Rahmen (nur dort kann das Kind etwas tun: einsteigen), im Tunnel und am Abend leuchten die
// Lampen. Sonst kein Gold.
// Fein (Entwurf „Feine Grafik“, Issue 13): Kasten aus Metall, Fensterband und Verglasung aus Lack, Räder mit hellen
// Naben, Nieten unten am Kasten, dunkle Fensterrahmen unter und über dem Fensterband und um das Zielfenster, zwei Puffer
// vorn und ein kurzer Schlot mit Kranz auf der Lok (dort steigt der Dampf auf); die Stirnlampen leuchten an weich in den
// Raum (`halo`), ebenso das Nachtlicht. Bahnhof Bär: Pfosten und Bank aus Holz, Grasdach als Laub, Schild aus Lack; die
// Reihen des Bahnsteigs bleiben Boden (ohne Muster).
// Spec: docs/specs/mitwachsen.md („Tok und die Bahn“, Bau 1)

import type { Fine, Part } from '../../../../lib/games/front';
import { HALT_NUMBER, numberBadge } from '../../mitwachsen-digits';
import { LOOK, figureParts } from '../../mitwachsen';
import { FIGURE_LEGS, dress, fine, type Dress } from '../../mitwachsen-fine';
import { GOLD } from '../../mitwachsen-portals';
import { TOK_MODEL } from './mitwachsen-tok-model';

/** Farben des Zugs und des Bahnhofs (Konzept „Zug und Bahnhöfe“), je Seite und Oberseite, wo es zwei gibt */
export const TRAIN_COLORS = {
  silver: ['#c9c6d6', '#dcd9e6'],
  lila: '#a07cff',
  light: '#6fd6f0', // türkiser Leuchtstreifen
  wheel: '#3c3f47',
  front: '#3a3550', // Zielfenster und offene Tür
  lamp: '#ffe08a',
  lit: '#fffbe6', // Lampe an (Tunnel, Abend), mit Schein
  glow: '#fff3b0',
  warm: '#ffc06a', // warmes Licht im Fensterband (ab 20 min, nachts bis „Gute Nacht“, auf der Laternenfahrt)
  night: '#f6dca0', // kleines Nachtlicht nach „Gute Nacht“
  mast: '#8a5a34', // Stange des Kristall-Wimpels
  steam: '#ffffff',
  puff: ['#e9ecf5', '#ffffff'], // Dampfkugel beim Umdrehen: Seiten leicht schattiert, oben weiß
  crystal: ['#b48cf0', '#6fd6f0', '#f08cc8'], // Raute: lila, türkis, rosa
  bat: { p: '#f2a7b8', g: '#a08c7c', k: '#1d2838', l: '#f2a7b8', w: '#b9b2dc' },
  hub: '#c9ced8', // Radnabe
  rivet: '#e6e8ef', // Niete
  rim: '#7f5cc8', // Fensterrahmen (dunkleres Lila)
  collar: '#35383f', // Kranz des Schlots (etwas dunkler als die Räder)
} as const;

export const STATION_COLORS = {
  plank: ['#c08a55', '#b37c49'],
  edge: '#f4e6c0',
  wood: '#8a5a34',
  bench: '#b07a48',
  roof: ['#5c9e34', '#73b746'],
  sign: '#7cbf4a',
  bear: { b: '#8a5a34', k: '#2e2b33', l: '#e8c9a0' },
} as const;

/** Bär für das Schild auf Grün, 8 × 8 Pixel (b braun, k dunkel, l hell; Punkt: frei) */
const BEAR = ['bb....bb', 'bbbbbbbb', '.bbbbbb.', '.bkbbkb.', '.bbllbb.', '.blkklb.', '..bllb..', '...bb...'];
/** Fledermaus im Zielfenster der Lok, 9 × 7 Pixel (aus der Skizze, ohne Zähne) */
export const BAT = ['..p...p..', '..pgggp..', 'w.gkgkg.w', 'ww.glg.ww', 'wwwgggwww', '.ww.g.ww.', '..w...w..'];

/**
 * Pixelbild als Teile auf einer Fläche, die nach vorn (+vorn) schaut: bei vorn `f`, Mitte quer bei `r`, Oberkante bei
 * `top`, je Pixel `px` groß
 */
export function pixels(
  rows: readonly string[],
  pal: Readonly<Record<string, string>>,
  f: number,
  r: number,
  top: number,
  px: number,
): Part[] {
  const out: Part[] = [];
  const w = Math.max(...rows.map((l) => l.length));
  rows.forEach((line, row) =>
    [...line].forEach((ch, col) => {
      const c = pal[ch];
      if (c) out.push([f, r + (w / 2 - col - 1) * px, top - (row + 1) * px, 0.012, px, px, c]);
    }),
  );
  return out;
}

/** Länge eines Wagens (die Lok gleich lang): Lok und zwei Wagen mit Lücken sind gut 5 Felder lang */
export const CAR = 1.6;
const L = CAR;
const HW = 0.46; // halbe Breite
const S = TRAIN_COLORS.silver;

/** Teil auf beiden Seiten: wie angegeben und quer gespiegelt */
const both = ([f, r, ...rest]: Part): Part[] => [
  [f, r, ...rest],
  [f, -r - rest[2], ...rest],
];

const HALO: Fine = { halo: true };
/** Metall auf Kasten, Rädern, Puffern und Schlot, Lack auf Fensterband, Zielfenster und Tür */
const TRAIN_DRESS: Dress = {
  ...Object.fromEntries([...S, TRAIN_COLORS.wheel].map((c) => [c, { skin: 'metall' }])),
  ...Object.fromEntries([TRAIN_COLORS.lila, TRAIN_COLORS.front].map((c) => [c, { skin: 'lack' }])),
};

/** Kasten eines Wagens (Mitte in der Mitte, vorn in Fahrtrichtung zum Prellbock von Bahnhof Bär) ohne Dach */
const BODY: readonly Part[] = [
  ...[-0.62, 0.32].flatMap((f) => [
    ...both([f, -HW + 0.04, 0.02, 0.3, 0.1, 0.18, TRAIN_COLORS.wheel]), // Räder, außen je eine helle Nabe
    ...both([f + 0.1, -HW + 0.034, 0.05, 0.1, 0.006, 0.1, TRAIN_COLORS.hub]),
  ]),
  [-L / 2, -HW, 0.16, L, 2 * HW, 0.4, ...S],
  [-L / 2, -HW, 0.56, L, 2 * HW, 0.3, TRAIN_COLORS.lila, TRAIN_COLORS.lila], // Fensterband
  ...[-0.42, 0, 0.42].map((f): Part => [f - 0.03, -HW - 0.006, 0.56, 0.06, 2 * HW + 0.012, 0.3, ...S]), // Fensterstege
  ...both([-L / 2, -HW - 0.012, 0.83, L, 0.04, 0.04, TRAIN_COLORS.light]), // Leuchtstreifen
  // Nieten unten am Kasten, neben Tür und Kristall-Raute
  ...[-0.74, -0.6, -0.46, 0.425, 0.565, 0.705].flatMap((f) =>
    both([f, -HW - 0.008, 0.22, 0.035, 0.008, 0.035, TRAIN_COLORS.rivet]),
  ),
];
/**
 * Dunkle Fensterrahmen unter und über dem Fensterband, außen auf den Stegen; auf der Seite einer offenen Tür oder ihres
 * goldenen Rahmens (`open`: +1 rechts, −1 links) fehlt das Stück davor
 */
const rims = (open: 0 | 1 | -1): Part[] =>
  [1, -1].flatMap((side) =>
    [[-L / 2, -0.32], [0.32, L / 2], ...(side === open ? [] : [[-0.32, 0.32]])].flatMap(([a, b]) =>
      [0.53, 0.8].map((z): Part => {
        const r = side > 0 ? HW + 0.006 : -HW - 0.012;
        return [a!, r, z, b! - a!, 0.006, 0.03, TRAIN_COLORS.rim];
      }),
    ),
  );
/** Dach, ganz oder (`open`) in der Mitte offen: Dort schaut Tok heraus */
const roof = (open: boolean): Part[] =>
  open
    ? [
        [-L / 2 + 0.04, -HW + 0.04, 0.86, 0.42, 2 * HW - 0.08, 0.1, ...S],
        [L / 2 - 0.46, -HW + 0.04, 0.86, 0.42, 2 * HW - 0.08, 0.1, ...S],
      ]
    : [[-L / 2 + 0.04, -HW + 0.04, 0.86, L - 0.08, 2 * HW - 0.08, 0.1, ...S]];

/** Lampen an der Front (aus, oder an mit einem kleinen Schein davor, der weich in den Raum leuchtet) */
const lamps = (lit: boolean): Part[] =>
  lit
    ? [
        ...both([L / 2, -HW + 0.06, 0.26, 0.03, 0.12, 0.08, TRAIN_COLORS.lit]),
        ...both([L / 2 + 0.03, -HW + 0.04, 0.24, 0.05, 0.16, 0.12, TRAIN_COLORS.glow]).map((p) => fine(p, HALO)),
      ]
    : both([L / 2, -HW + 0.06, 0.26, 0.03, 0.12, 0.08, TRAIN_COLORS.lamp]);

/** Front der Lok: Zielfenster mit Fledermaus; an den Seiten die Kristall-Raute (die Lampen kommen aus `lamps`) */
const FRONT: readonly Part[] = [
  [L / 2, -0.28, 0.6, 0.02, 0.56, 0.24, TRAIN_COLORS.front],
  ...pixels(BAT, TRAIN_COLORS.bat, L / 2 + 0.02, 0, 0.82, 0.026),
  ...both([0.1, -HW - 0.014, 0.36, 0.08, 0.012, 0.08, TRAIN_COLORS.crystal[0]]),
  ...both([0.02, -HW - 0.016, 0.3, 0.08, 0.012, 0.06, TRAIN_COLORS.crystal[1]]),
  ...both([0.18, -HW - 0.016, 0.3, 0.08, 0.012, 0.06, TRAIN_COLORS.crystal[2]]),
  // Rahmen um das Zielfenster unten und oben, zwei Puffer unter den Lampen, kurzer Schlot mit Kranz (dort dampft es)
  [L / 2, -0.3, 0.57, 0.02, 0.6, 0.03, TRAIN_COLORS.rim],
  [L / 2, -0.3, 0.84, 0.02, 0.6, 0.03, TRAIN_COLORS.rim],
  ...both([L / 2, -HW + 0.06, 0.16, 0.06, 0.1, 0.08, TRAIN_COLORS.wheel]),
  [0.3, -0.07, 0.96, 0.14, 0.14, 0.08, ...S],
  [0.28, -0.09, 1.04, 0.18, 0.18, 0.03, TRAIN_COLORS.collar],
];

/** Tok sitzt im hinteren Wagen: sein Modell, etwas tiefer, Kopf und Helm schauen oben heraus */
const RIDER: readonly Part[] = TOK_MODEL.map(([f, r, z, ...rest]): Part => [f, r, z + 0.32, ...rest]);

/** Die Figur sitzt im mittleren Wagen: ohne Beine, Kopf und Schultern schauen oben heraus */
const FIGURE: readonly Part[] = figureParts(LOOK)
  .slice(FIGURE_LEGS)
  .map(([f, r, z, ...rest]): Part => [f - 0.05, r, z + 0.06, ...rest]);

/** Offene Tür zur Seite des Bahnsteigs (`side` +1 rechts, −1 links) */
const door = (side: 1 | -1): Part => [-0.26, side > 0 ? HW : -HW - 0.03, 0.18, 0.52, 0.03, 0.66, TRAIN_COLORS.front];
/** Goldener Rahmen um die Tür zur Seite `side` bis zur ersten Fahrt: Hier steigt man ein */
const frame = (side: 1 | -1): Part[] => {
  const r = side > 0 ? HW + 0.004 : -HW - 0.034;
  return [
    [-0.32, r, 0.16, 0.06, 0.03, 0.74, GOLD.side, GOLD.top],
    [0.26, r, 0.16, 0.06, 0.03, 0.74, GOLD.side, GOLD.top],
    [-0.32, r, 0.86, 0.64, 0.03, 0.06, GOLD.side, GOLD.top],
  ];
};

/** Warmes Licht in den vier Fenstern zwischen den Stegen, auf beiden Seiten (kein Punktlicht, nur Farbe) */
const WARM: readonly Part[] = [-0.76, -0.36, 0.06, 0.48].flatMap((f) =>
  both([f, -HW - 0.01, 0.6, 0.28, 0.012, 0.2, TRAIN_COLORS.warm]),
);
/** Kleines Nachtlicht über der Tür der Lok, nach „Gute Nacht“ (die Lampen sind aus); es leuchtet weich */
const NIGHT: readonly Part[] = both([-0.06, -HW - 0.012, 0.9, 0.12, 0.012, 0.08, TRAIN_COLORS.night]).map((p) =>
  fine(p, HALO),
);
/**
 * Kristall-Wimpel nach der Laternenfahrt (Stufe `fest`): Stange auf dem Dach der Lok, ein lila Wimpel mit Kristall-Raute
 * in Türkis und Rosa (kein Gold: dort kann das Kind nichts tun)
 */
const PENNANT: readonly Part[] = [
  fine([-0.5, -0.03, 0.96, 0.05, 0.05, 0.62, TRAIN_COLORS.mast], { skin: 'holz' }),
  fine([-0.5, 0.02, 1.32, 0.02, 0.36, 0.24, TRAIN_COLORS.lila], { skin: 'stoff' }), // Wimpel aus Stoff
  [-0.5, 0.14, 1.4, 0.022, 0.1, 0.08, TRAIN_COLORS.crystal[1]],
  [-0.5, 0.25, 1.42, 0.022, 0.06, 0.04, TRAIN_COLORS.crystal[2]],
];

/**
 * Wagen des Zugs: die Lok (`loco`, `lit`: die Lampen leuchten), der mittlere (`rider`: mit der Figur), der hintere (mit
 * Tok, sobald er sitzt); `door`: die Tür zum Bahnsteig offen (+1 rechts, −1 links, 0 zu), `frame`: goldener Rahmen um
 * die Tür auf dieser Seite (0: keiner); `warm`: warmes Licht im Fensterband (jeder Wagen); `night`: nur das kleine
 * Nachtlicht der Lok (nach „Gute Nacht“); `pennant`: der Kristall-Wimpel auf der Lok (nach der Laternenfahrt)
 */
export type CarLook = {
  kind: 'loco' | 'mid' | 'rear';
  tok: boolean;
  door: 0 | 1 | -1;
  rider?: boolean;
  frame?: 0 | 1 | -1;
  lit?: boolean;
  warm?: boolean;
  night?: boolean;
  pennant?: boolean;
};
const FINE_BODY = dress(BODY, TRAIN_DRESS);
const FINE_FRONT = dress(FRONT, TRAIN_DRESS);
const FINE_ROOF = [dress(roof(false), TRAIN_DRESS), dress(roof(true), TRAIN_DRESS)] as const;

export const carParts = (k: CarLook): Part[] => [
  ...FINE_BODY,
  ...rims(k.door || k.frame || 0),
  ...FINE_ROOF[+((k.kind === 'rear' && k.tok) || !!k.rider)]!,
  ...(k.kind === 'loco' ? [...FINE_FRONT, ...lamps(!!k.lit)] : []),
  ...(k.kind === 'rear' && k.tok ? RIDER : []),
  ...(k.rider ? FIGURE : []),
  ...(k.door ? [fine(door(k.door), { skin: 'lack' })] : []),
  ...(k.frame ? frame(k.frame) : []),
  ...(k.warm ? WARM : []),
  ...(k.kind === 'loco' && k.night ? NIGHT : []),
  ...(k.kind === 'loco' && k.pennant ? PENNANT : []),
];

/** Weiße Dampfwölkchen über dem Schlot der Lok, je Phase (0 … 3) anders hoch (nicht bei reduzierter Bewegung) */
export const steamParts = (phase: number): Part[] =>
  [0, 1, 2].map((i): Part => {
    const k = (phase + i) % 4;
    const s = 0.1 + k * 0.03;
    return [0.32 - k * 0.12, -s / 2 + (i - 1) * 0.08, 1.08 + k * 0.2, s, s, s, TRAIN_COLORS.steam];
  });

/** Durchmesser der Dampfkugel über einem Wagen beim Umdrehen, ganz aufgeblüht (in Feldern; ein Wagen ist 1,6 lang) */
export const PUFF = 1.8;
/** Höhe der Mitte der Dampfkugel über dem Gleis: so deckt sie den Wagen samt Kopf der Figur und Wimpel */
const PUFF_Z = 0.7;

/**
 * Dampfkugel über einem Wagen, wenn der Zug bei der Abfahrt umdreht (`scale` 0 … 1 von `PUFF`): drei Kreuzbalken und ein
 * Würfel, zusammen rund, ganz deckend (eigene Voxel-Grafik), nie unter den Boden
 */
export const puffParts = (scale: number): Part[] => {
  const d = PUFF * scale;
  const cube = (l: number, w: number, h: number): Part => {
    const z0 = Math.max(0, PUFF_Z - h / 2);
    return [-l / 2, -w / 2, z0, l, w, PUFF_Z + h / 2 - z0, ...TRAIN_COLORS.puff];
  };
  const [a, b] = [d, d * 0.66];
  return [cube(a, b, b), cube(b, a, b), cube(b, b, a), cube(d * 0.86, d * 0.86, d * 0.86)];
};

// ---------- Bahnhof Bär ----------
// Eine Reihe des Bahnsteigs schaut vom Gleis weg (vorn): von −1 (Kante am Gleis) bis +1 (hinten), quer −0,5 … 0,5.

const SC = STATION_COLORS;
/** Planken einer Reihe mit heller Kante und der Stirnseite aus Holz zum Gleis hin (die Stufe) */
const row = (odd: boolean): Part[] => [
  [-1, -0.5, 0, 2, 1, 0.04, SC.plank[+odd]!, SC.plank[+odd]!],
  [-1, -0.5, 0.04, 0.1, 1, 0.015, SC.edge, SC.edge],
  [-1.03, -0.5, -1, 0.04, 1, 1.02, SC.wood],
];
/** Reihe des Bahnsteigs */
export const rowParts = (odd: boolean): Part[] => [...row(odd)];

/**
 * Maße des Dachs beider Bahnhöfe (Issue 15: kleiner und höher, damit man die Figur darunter sieht und die Kante frei
 * ist): Unterkante der Platte `z` über dem Bahnsteig, Dicke `h`, wie weit sie vom hinteren Rand zum Gleis reicht (`deep`:
 * nur die hintere Hälfte der zwei Dachreihen), Breite entlang des Gleises (`wide`, um die Mitte der zwei Reihen)
 */
export const ROOF_SIZE = { z: 2, h: 0.2, deep: 1.08, wide: 2.16 } as const;
/** Oberkante der Dachplatte über dem Bahnsteig: Dort sitzt das Schild (und an Bahnhof Fledermaus die Lampen) */
export const ROOF_TOP = ROOF_SIZE.z + ROOF_SIZE.h;
/** Die Dachplatte in einer Farbe: hinten über den zwei Dachreihen, vorn = vom Gleis weg (Mitte in der Mitte der vier Felder) */
export const roofPlate = (side: string, top: string): Part => [
  0,
  -ROOF_SIZE.wide / 2,
  ROOF_SIZE.z,
  ROOF_SIZE.deep,
  ROOF_SIZE.wide,
  ROOF_SIZE.h,
  side,
  top,
];
/** Zwei Pfosten am hinteren Rand des Bahnsteigs, vom Bahnsteig bis unter die Platte */
export const roofPosts = (color: string): Part[] =>
  [-0.92, 0.8].map((r): Part => [0.8, r, 0.04, 0.12, 0.12, ROOF_SIZE.z - 0.04, color]);

/**
 * Wo das Schild steht: mitten auf der Dachplatte, also von der Mitte der vier Dachfelder (x, y) die halbe Tiefe der
 * Platte vom Gleis weg (`side`: Richtung vom Gleis zum Bahnsteig)
 */
export const signAt = (x: number, y: number, side: readonly [number, number]) => ({
  x: x + (side[0] * ROOF_SIZE.deep) / 2,
  y: y + (side[1] * ROOF_SIZE.deep) / 2,
});

const WOOD: Fine = { skin: 'holz' };
/** Grasdach von Bahnhof Bär: nur die Platte, ein eigener Körper (ein späterer Durchblick träfe nur sie); Gras als Laub */
export const ROOF: readonly Part[] = [fine(roofPlate(...SC.roof), { skin: 'blatt' })];
/** Unter dem Grasdach: zwei Pfosten am hinteren Rand, davor die Bank (Lehne hinten); die Kante am Gleis bleibt frei */
export const ROOF_POSTS: readonly Part[] = dress(
  [
    ...roofPosts(SC.wood),
    [0.36, -0.6, 0.3, 0.4, 1.2, 0.08, SC.bench, SC.bench],
    [0.7, -0.6, 0.38, 0.06, 1.2, 0.3, SC.bench],
    ...[-0.5, 0.42].flatMap((r) => [0.4, 0.66].map((f): Part => [f, r, 0.04, 0.07, 0.07, 0.26, SC.wood])),
  ],
  { [SC.wood]: WOOD, [SC.bench]: WOOD },
);

/** Schild auf dem Dach, zur Kamera (Körper schaut nach Süden): Bär auf Grün, 2 × 2 Schildbreite, ohne Text */
export const SIGN: readonly Part[] = [
  fine([-0.05, -0.05, 0, 0.1, 0.1, 0.16, SC.wood], WOOD),
  fine([-0.03, -0.44, 0.16, 0.06, 0.88, 0.88, SC.sign, SC.sign], { skin: 'lack' }),
  ...pixels(BEAR, SC.bear, 0.03, 0, 0.96, 0.09),
  ...numberBadge(HALT_NUMBER.baer, 0.045, -0.31, 1.03), // oben rechts im Bild: Bahnhof 1 (Issue 40)
];
