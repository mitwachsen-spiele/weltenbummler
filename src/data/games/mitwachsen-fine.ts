// Feine Teile der Figur, der Tiere der Lichtung und dessen, was die Figur trägt (Entwurf „Feine Grafik“, Issue 13):
// Muster je Material (Fell, Haar, Stoff, Lack, Metall …) über die Farbe eines Teils und kleine Zusatzquader (Sohlen,
// Nase, Strähnen, Bündchen; Schnurrhaare, Innenohren, Pfoten, Krallen, Nasenlöcher …). Ohne Schalter: Die Modelle in
// mitwachsen.ts, mitwachsen-hoehle.ts und mitwachsen-eis.ts hängen sich hier ein. Proportionen, Farben, Fußabdruck und
// Kollision bleiben; jedes Zusatzteil liegt in der Hülle seines Modells (Test „Feinteile in der Hülle“).
// Spec: docs/specs/mitwachsen.md (Feinheit)

import type { Fine, Part } from '../../lib/games/front';
import type { Skin } from '../../lib/games/skins';

/** Feinheit je Farbe (Farbe der Seite eines Teils) */
export type Dress = Readonly<Record<string, Fine>>;

/** Allen Teilen dieser Farben je Farbe ihr Muster bzw. Leuchten geben; Gesichtsteile (Augen) und Teile mit eigener Feinheit bleiben */
export const dress = (parts: readonly Part[], by: Dress): Part[] =>
  parts.map((p) => {
    const fine = by[p[6]];
    return fine && !p[8] && !p[9] ? [p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7] ?? null, undefined, fine] : p;
  });

/** Dieselbe Feinheit für mehrere Farben */
const all = (colors: readonly string[], fine: Fine): Dress => Object.fromEntries(colors.map((c) => [c, fine]));
const skin = (s: Skin): Fine => ({ skin: s });
const FELL = skin('fell');

/** Etwas dunkler (Nase im Hautton): jeder Kanal × k */
export function darker(hex: string, k = 0.94): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = (s: number) =>
    Math.round(((n >> s) & 255) * k)
      .toString(16)
      .padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

// ---------- Figur ----------

/** Aussehen der Figur, soweit die Feinheit es braucht (`Look` in mitwachsen.ts) */
type Colors = { skin: string; hair: string; shirt: string; sleeve: string; pants: string };

/** So viele Teile vorn im Modell der Figur sind Beine (Hose, Schuhe, Sohlen): Wer sitzt, zeigt sie nicht */
export const FIGURE_LEGS = 6;
const SOLE = '#25272d';
const SHOE = '#6b4a36';
const COLLAR = '#f6f3ec';
const BELT = '#2a2f3d';

/**
 * Figur fein: dunkle Sohlen unter den Schuhen (gleich nach den Beinen, `FIGURE_LEGS`), Nase im Hautton, zwei Strähnen
 * an den Schläfen, Bündchen in Hemdfarbe am Ende der Ärmel; Stoff auf Hemd, Ärmeln, Hose und Kragen, Haar auf dem Haar,
 * Lack auf Schuhen und Gürtel. `base` ist das Modell aus mitwachsen.ts: Beine (vier Teile) vorn
 */
export function fineFigure(l: Colors, base: readonly Part[]): Part[] {
  const soles: Part[] = [
    [-0.075, -0.215, 0, 0.18, 0.2, 0.02, SOLE],
    [-0.075, 0.015, 0, 0.18, 0.2, 0.02, SOLE],
  ];
  const extra: Part[] = [
    [-0.065, -0.305, 0.42, 0.13, 0.09, 0.04, l.shirt], // Bündchen
    [-0.065, 0.215, 0.42, 0.13, 0.09, 0.04, l.shirt],
    [0.24, -0.03, 0.815, 0.03, 0.06, 0.045, darker(l.skin)], // Nase
    [0.245, -0.23, 0.93, 0.012, 0.08, 0.06, l.hair], // Strähnen an den Schläfen, neben den Augen
    [0.245, 0.15, 0.95, 0.012, 0.07, 0.04, l.hair],
  ];
  const by: Dress = {
    ...all([l.shirt, l.sleeve, l.pants, COLLAR], skin('stoff')),
    ...all([SHOE, BELT], skin('lack')),
    [l.hair]: skin('haar'),
  };
  return dress([...base.slice(0, 4), ...soles, ...base.slice(4), ...extra], by);
}

/** Buch auf dem Schoß fein: Stoff auf Ärmeln und Einband */
export const fineBook = (l: Colors, parts: readonly Part[]): Part[] =>
  dress(parts, all([l.sleeve, '#c0453a'], skin('stoff')));

// ---------- Was die Figur trägt ----------

/**
 * Feinheit von Korb, Eimer, Kanne, Netz und Laterne: Korb aus Weide geflochten (Stoff), Beeren und Fische glänzen
 * (Lack), das Blatt (Blatt), Eimer und Rahmen der Laterne aus Metall, das Netz geknüpft (Steppnaht als Maschen); der
 * Kristall der Laterne und die Hüte der Leuchtpilze leuchten (`halo`)
 */
export const CARRY_DRESS: Dress = {
  '#b0803c': skin('stoff'), // Korb
  '#c8323a': skin('lack'), // Beeren
  '#3f9a3c': skin('blatt'),
  ...all(['#98a3ae', '#76818c', '#c9c4dc'], skin('metall')), // Eimer, Rand, Rahmen der Laterne
  '#d8cfb4': skin('quilt'), // Netz
  '#9fb4c8': skin('lack'), // Fische
  '#8fe0ea': { halo: true }, // Kristall der Laterne
  ...all(['#ff9cd4', '#6fd6f0', '#ffe08a'], { halo: true }), // Hüte der Leuchtpilze (`SHROOM_COLORS`)
};

// ---------- Tiere der Lichtung ----------

type AnimalFine = { readonly by: Dress; readonly extra: readonly Part[] };
const W = '#ffffff';

/**
 * Feinheit der zwölf Tiere der Lichtung (nach dem Entwurf: Hase, Eichhörnchen, Fuchs, Igel, Ente; die anderen nach
 * demselben Muster): Fell auf den Fellfarben, Lack auf glatter Haut und Panzer, Nadeln auf den Stacheln; dazu je ein
 * paar Zusatzteile. Augenglanz haben alle schon (`eyes`)
 */
export const ANIMAL_FINE: Readonly<Record<string, AnimalFine>> = {
  hase: {
    by: all(['#cbbfae', '#f6f3ec', '#efe6d8', '#bdb09e'], FELL),
    extra: [
      [0.315, -0.15, 0.25, 0.01, 0.1, 0.008, W, null, 'f'], // Schnurrhaare
      [0.315, 0.05, 0.25, 0.01, 0.1, 0.008, W, null, 'f'],
    ],
  },
  igel: {
    by: { '#6a5038': FELL, ...all(['#4a3828', '#5d4632'], skin('nadel')) },
    extra: [[0.29, -0.015, 0.085, 0.005, 0.015, 0.012, W, null, 'f']], // Glanz auf der Nase
  },
  schaf: {
    by: all(['#f3efe6', '#f7f4ee', '#ece7dc'], FELL),
    extra: [
      [0.25, -0.17, 0.46, 0.06, 0.05, 0.005, '#c98a8a'], // Ohren innen
      [0.25, 0.12, 0.46, 0.06, 0.05, 0.005, '#c98a8a'],
      [0.4, -0.04, 0.34, 0.006, 0.08, 0.02, '#55555f', null, 'f'], // Nase
    ],
  },
  kuh: {
    by: { '#f3efe6': FELL },
    extra: [
      [0.36, -0.19, 0.505, 0.006, 0.05, 0.035, '#e7a3b0', null, 'f'], // Ohren innen
      [0.36, 0.14, 0.505, 0.006, 0.05, 0.035, '#e7a3b0', null, 'f'],
    ],
  },
  biene: {
    by: { '#f2c94c': FELL },
    extra: [-0.07, 0.03].flatMap((f): Part[] => [
      [f, -0.06, 0.3, 0.02, 0.02, 0.04, '#2a2018'], // Beinchen
      [f, 0.04, 0.3, 0.02, 0.02, 0.04, '#2a2018'],
    ]),
  },
  ente: {
    by: all(['#f2d14b', '#e3bd35'], FELL),
    extra: [
      [0.23, -0.03, 0.26, 0.015, 0.015, 0.004, '#c0602a'], // Nasenlöcher
      [0.23, 0.015, 0.26, 0.015, 0.015, 0.004, '#c0602a'],
    ],
  },
  frosch: {
    by: { '#5fa64a': skin('lack') },
    extra: [
      [0.2, -0.04, 0.16, 0.006, 0.02, 0.015, '#2f5a28', null, 'f'], // Nasenlöcher
      [0.2, 0.02, 0.16, 0.006, 0.02, 0.015, '#2f5a28', null, 'f'],
      [0.19, -0.225, 0, 0.03, 0.08, 0.012, '#6dbd57'], // Schwimmfüße vorn
      [0.19, 0.145, 0, 0.03, 0.08, 0.012, '#6dbd57'],
    ],
  },
  schildkroete: {
    by: all(['#4f8a3a', '#3f7a2e'], skin('lack')),
    extra: [
      [0.32, -0.05, 0.11, 0.005, 0.1, 0.008, '#5f8a45', null, 'f'], // Mund
      [0.16, -0.155, 0, 0.008, 0.07, 0.02, '#e8edd8'], // Krallen
      [0.16, 0.085, 0, 0.008, 0.07, 0.02, '#e8edd8'],
    ],
  },
  fuchs: {
    by: all(['#e0782e', '#f6f3ec'], FELL),
    extra: [
      [0.24, -0.1, 0.44, 0.008, 0.05, 0.06, '#3a2a22', null, 'f'], // Ohren innen dunkel
      [0.24, 0.05, 0.44, 0.008, 0.05, 0.06, '#3a2a22', null, 'f'],
    ],
  },
  eichhoernchen: {
    by: all(['#b4551f', '#c45f28', '#d9824a', '#f0d9b5'], FELL),
    extra: [
      [-0.38, -0.1, 0.6, 0.12, 0.2, 0.03, '#e08a4a'], // helle Schwanzspitze
      [0.28, -0.02, 0.27, 0.01, 0.04, 0.03, '#3a2a22', null, 'f'], // Nase
      [0.16, -0.13, 0, 0.08, 0.06, 0.05, '#8f3f16'], // dunkle Pfoten
      [0.16, 0.07, 0, 0.08, 0.06, 0.05, '#8f3f16'],
    ],
  },
  baer: {
    by: all(['#8a5a34', '#6e4527', '#a77a4c'], FELL),
    extra: [
      [0.52, -0.03, 0.345, 0.005, 0.06, 0.01, '#5a3a24', null, 'f'], // Mund
      [0.26, -0.165, 0, 0.008, 0.11, 0.025, '#e8dcc8'], // Krallen
      [0.26, 0.055, 0, 0.008, 0.11, 0.025, '#e8dcc8'],
    ],
  },
  ziege: {
    by: all(['#eadfcd', '#d9cbb4'], FELL),
    extra: [
      [0.23, -0.145, 0.54, 0.05, 0.05, 0.005, '#e8b4b0'], // Ohren innen
      [0.23, 0.09, 0.54, 0.05, 0.05, 0.005, '#e8b4b0'],
      [0.41, -0.025, 0.44, 0.005, 0.05, 0.008, '#8a6a58', null, 'f'], // Mund
    ],
  },
};

/** Alle Arten fein (die ohne Eintrag in `ANIMAL_FINE` bleiben, wie sie sind: ihre Modelle bringen die Welt-Pakete) */
export function fineSpecies<K extends string, T extends { readonly parts: readonly Part[]; outline?: readonly Part[] }>(
  all: Record<K, T>,
): Record<K, T> {
  const out = { ...all };
  for (const id of Object.keys(all) as K[]) {
    const f = ANIMAL_FINE[id];
    if (f) out[id] = { ...all[id], parts: dress([...all[id].parts, ...f.extra], f.by), outline: all[id].parts };
  }
  return out;
}
