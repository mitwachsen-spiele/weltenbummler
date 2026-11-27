// Aussehen des Gleises – rein, ohne DOM, gleich für 2D und 3D: Quader je Feld mit Gleis (`Cell.rail`): Holzschwellen und
// graue Schienen, gerade oder in einer rechtwinkligen Kurve, roter Prellbock an den Enden der Linie und, solange der
// Ausbau 1 ist, vor der Tür des Höhlentors; das Tunnelportal aus Stein mit Grasdach und die niedrigen Wände des oben
// offenen Einschnitts. Was liegt, sagt der Ausbau im Spielstand (`packs.bahn.built`): 0 nichts, 1 die Lichtung bis zum
// Prellbock, 2 die ganze Linie; solange Tok baut, läuft die Gleiswelle (`railShown`, bei reduzierter Bewegung und in 3D in
// drei Stufen). Bau 2: Ab der Abfahrt steht Ausbau 2 im Spielstand, doch bis Tok am Prellbock klopft, wartet der Bau
// (`State.work` ohne Ende, Fortschritt 0): Der Prellbock steht, durch die Tür liegt noch nichts; dann versinkt er
// (`BUILD2.sink`) und die Gleiswelle läuft durch Gang und Grotte (`BUILD2.wave`). Liegt nichts, zeigt sich das Feld wie sonst (Gras, Büschel, Blumen). Teil des Pakets der Bahn
// (view-2d.ts, view-3d.ts). Fein (Entwurf „Feine Grafik“, Issue 13): Schwellen mit Holz, Schienen und Puffer mit Metall,
// der Prellbock aus Lack, das Grasdach des Tunnelportals als Laub; Stein (Pfeiler, Sturz, Einschnitt) ohne Muster.
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Gleis als Boden)

import { BUILD, BUILD2, RAIL_COLORS } from '../../../../data/games/worlds/bahn/mitwachsen-bahn';
import type { Fine } from '../../../../lib/games/front';
import type { Cell, Rail } from '../../mitwachsen-cell';
import type { Box, DecoAt, DrawRails } from '../../mitwachsen-view';
import { builtOf } from './mitwachsen-built';

/** Quader in einem Feld, ohne Lage: x, y (nach vorn), z über dem Boden, Breite, Tiefe, Höhe, Seite, oben, Feinheit */
type Local = readonly [number, number, number, number, number, number, string, string, Fine?];

const [P1, P2, W] = [0.2, 0.71, 0.09]; // Schienen: Abstand vom Rand links und rechts, Breite
const RAIL_Z = 0.06; // Schienen liegen auf den Schwellen
/** Feinheit je Teil des Gleises */
export const RAIL_FINE = {
  sleeper: { skin: 'holz' },
  rail: { skin: 'metall' },
  buffer: { skin: 'lack' },
  grass: { skin: 'blatt' },
} as const satisfies Record<string, Fine>;
const sleeper = (y: number): Local => [0.06, y, 0, 0.88, 0.22, RAIL_Z, ...RAIL_COLORS.sleeper, RAIL_FINE.sleeper];
const rail = (x: number, y: number, d: number): Local => [
  x,
  y,
  RAIL_Z,
  W,
  d,
  0.07,
  ...RAIL_COLORS.rail,
  RAIL_FINE.rail,
];

/** Gerade von oben nach unten */
const STRAIGHT: readonly Local[] = [sleeper(0.1), sleeper(0.6), rail(P1, 0, 1), rail(P2, 0, 1)];
/** Kurve von oben nach rechts: die Schienen treffen sich innen bei (P2, P1), außen bei (P1, P2) */
const CURVE: readonly Local[] = [
  sleeper(0.06),
  [0.72, 0.06, 0, 0.22, 0.88, RAIL_Z, ...RAIL_COLORS.sleeper, RAIL_FINE.sleeper],
  rail(P2, 0, P1 + W),
  rail(P1, 0, P2 + W),
  [P2, P1, RAIL_Z, 1 - P2, W, 0.07, ...RAIL_COLORS.rail, RAIL_FINE.rail],
  [P1, P2, RAIL_Z, 1 - P1, W, 0.07, ...RAIL_COLORS.rail, RAIL_FINE.rail],
];
/**
 * Prellbock quer über dem Gleis, `y` seine Vorderkante (nach unten), mit zwei dunklen Puffern zur Strecke hin (oben);
 * `sunk` 0 … 1: so weit ist er schon im Boden versunken (Bau 2), ganz versunken ist er weg
 */
const buffer = (y: number, sunk = 0): Local[] => {
  const k = 1 - sunk;
  if (k <= 0) return [];
  return [
    [0.08, y, 0, 0.84, 0.3, 0.45 * k, ...RAIL_COLORS.buffer, RAIL_FINE.buffer],
    ...(k > 0.5
      ? [0.16, 0.64].map((x): Local => [
          x,
          y - 0.05,
          0.22 * k,
          0.2,
          0.05,
          0.14 * k,
          RAIL_COLORS.pads,
          RAIL_COLORS.pads,
          RAIL_FINE.rail,
        ])
      : []),
  ];
};
/** Ende der Linie, die Strecke kommt von oben: halbe Gerade, dann der Prellbock */
const END: readonly Local[] = [sleeper(0.1), rail(P1, 0, 0.7), rail(P2, 0, 0.7), ...buffer(0.62)];
/** Tunnelportal über der Geraden: zwei Pfeiler, Sturz, Grasdach */
const PORTAL: readonly Local[] = [
  ...STRAIGHT,
  [0, 0.3, 0, 0.14, 0.4, 1.5, ...RAIL_COLORS.stone],
  [0.86, 0.3, 0, 0.14, 0.4, 1.5, ...RAIL_COLORS.stone],
  [-0.04, 0.26, 1.5, 1.08, 0.48, 0.28, ...RAIL_COLORS.stone],
  [0, 0.28, 1.78, 1, 0.44, 0.1, ...RAIL_COLORS.grass, RAIL_FINE.grass],
];
/** Einschnitt: niedrige Steinwände links und rechts der Geraden, oben Gras */
const CUT: readonly Local[] = [
  ...STRAIGHT,
  [0, 0, 0, 0.12, 1, 0.4, RAIL_COLORS.stone[0], RAIL_COLORS.grass[1]],
  [0.88, 0, 0, 0.12, 1, 0.4, RAIL_COLORS.stone[0], RAIL_COLORS.grass[1]],
];

/** Vierteldrehungen im Uhrzeigersinn (oben → rechts) um die Mitte des Felds */
function turn(b: Local, k: number): Local {
  const [, , z, , , h, side, top, fine] = b;
  let [x, y, w, d] = [b[0], b[1], b[3], b[4]];
  for (let i = 0; i < k; i++) [x, y, w, d] = [1 - (y + d), x, d, w];
  return [x, y, z, w, d, h, side, top, fine];
}
/** Vierteldrehungen, die die Richtung oben (`n`) in die Richtung `l` bringen */
const QUARTER: Readonly<Record<string, number>> = { n: 0, e: 1, s: 2, w: 3 };

/** Form und Drehung eines Stücks aus seinen Richtungen (in beliebiger Reihe) */
function shape(to: string): [readonly Local[], number] {
  const set = [...to].sort().join('');
  if (to.length < 2) return [END, QUARTER[to] ?? 0];
  if (set === 'ns') return [STRAIGHT, 0];
  if (set === 'ew') return [STRAIGHT, 1];
  // Kurven: oben–rechts gedreht
  return [CURVE, { en: 0, es: 1, sw: 2, nw: 3 }[set] ?? 0];
}

/**
 * Ab welchem Augenblick des Baus (0 … 1, `BUILD.wave`) liegt ein Stück, das so weit (`along`) in seinem Ausbau liegt: Die
 * Gleiswelle läuft gleichmäßig vom Anfang bis zum Ende; bei reduzierter Bewegung kommt das Gleis in drei Stufen
 */
export function waveAt(along: number, reduced: boolean, stage: 1 | 2 = 1): number {
  const [from, to] = stage === 2 ? BUILD2.wave : BUILD.wave;
  const k = reduced ? Math.min(STAGES - 1, Math.floor(along * STAGES)) / STAGES : along;
  return from * (1 - k) + to * k; // am Ende genau `to`
}
/** Stufen der Gleiswelle bei reduzierter Bewegung (und in 3D, dort zuckt nichts) */
export const STAGES = 3;

/**
 * Wie viele der drei Stufen der Gleiswelle des Ausbaus `stage` liegen, solange gebaut wird (`work`), sonst undefined
 * (alles liegt)
 */
export const waveStage = (work: number | undefined, stage: 1 | 2 = 1): number | undefined =>
  work === undefined
    ? undefined
    : Array.from({ length: STAGES }, (_, k) => k / STAGES).filter((a) => work >= waveAt(a, true, stage)).length;

/**
 * Wie weit der Prellbock vor der Tür versunken ist (0 … 1): bei Ausbau 1 gar nicht, bei Ausbau 2 ganz, solange Tok baut
 * (Bau 2) von `BUILD2.sink` an; bei reduzierter Bewegung auf einmal, an seinem Ende
 */
export function sunkOf(at: Pick<DecoAt, 'packs' | 'reduced' | 'work'>): number {
  if (builtOf(at.packs) < 2) return 0;
  if (at.work === undefined) return 1;
  const [from, to] = BUILD2.sink;
  if (at.reduced) return at.work >= to ? 1 : 0;
  return Math.max(0, Math.min(1, (at.work - from) / (to - from)));
}

/**
 * Liegt das Stück schon? Nach dem Ausbau in `at.packs`; das Stück des Ausbaus, der gerade gebaut wird (`at.work`), erst,
 * wenn die Gleiswelle es erreicht hat
 */
export function railShown(r: Rail, at: Pick<DecoAt, 'packs' | 'reduced' | 'work'>): boolean {
  const built = builtOf(at.packs);
  if (r.stage > built) return false;
  return at.work === undefined || r.stage < built || at.work >= waveAt(r.along ?? 0, at.reduced, r.stage);
}

/**
 * Quader des Gleises auf dem Feld (x, y) nach dem Ausbau in `at.packs` und, solange gebaut wird, der Gleiswelle
 * (`DrawRails`); null, wenn dort (noch) keins liegt
 */
export const railBoxes: DrawRails = (c: Cell, x: number, y: number, at) => {
  const r = c.rail;
  if (!r || !railShown(r, at)) return null;
  // Prellbock vor der Tür, solange der Ausbau 1 ist (danach geht es weiter durch die Tür): Ende zur Strecke hin; bei
  // Bau 2 versinkt er, dann liegt dort eine Gerade (das Gleis durch die Tür kommt mit der Gleiswelle)
  const sunk = r.part === 'buffer' ? sunkOf(at) : 0;
  const end = r.part === 'end' || (r.part === 'buffer' && sunk < 1);
  const to = end ? r.to.slice(0, 1) : r.to;
  const [form, k] = shape(to);
  const sinking = end && r.part === 'buffer' && sunk > 0;
  const stub = [sleeper(0.1), rail(P1, 0, 0.7), rail(P2, 0, 0.7), ...buffer(0.62, sunk)];
  const own = r.part === 'portal' ? PORTAL : r.part === 'cut' ? CUT : sinking ? stub : form;
  const q = r.part === 'portal' || r.part === 'cut' ? shape(r.to)[1] : k;
  return own.map((b): Box => {
    const [bx, by, bz, w, d, h, side, top, fine] = turn(b, q);
    return fine
      ? [x + bx, y + by, c.h + bz, w, d, h, side, top, undefined, fine]
      : [x + bx, y + by, c.h + bz, w, d, h, side, top];
  });
};
