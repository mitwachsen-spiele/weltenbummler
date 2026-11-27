// Feine Teile der acht Höhlen-Tiere und der Tupfspinne (Entwurf „Feine Grafik“, Issue 13), nur im Welt-Paket der
// Höhlenwelt: Muster je Material über die Farbe eines Teils (Fell, glatte Haut und Flughaut als Lack) und ein paar
// Zusatzquader je Art (Krallen, Zehen, Füßchen, Schnurrhaare, Tupfen, Fingerknochen der Flügel). Das Hinterteil des
// Glühwürmchens leuchtet weich (`halo`). Die Tupfspinne bleibt ohne Haare (kein Fell): Körper und Kopf glatt wie Lack.
// Die Lichtgeister bleiben weiche Tropfen (ohne Muster). Proportionen, Farben und Fußabdruck bleiben; jedes Zusatzteil
// liegt in der Hülle seines Modells, steckt in nichts und berührt sein Teil (Test). Die Grundform ohne Feinteile bleibt
// `CAVE_MODELS`: Aus ihr entsteht der Umriss von „Noch nicht“ und der Leiste (`WorldPack.outlines`).
// Spec: docs/specs/mitwachsen.md (Feinheit)

import type { Part } from '../../../../lib/games/front';
import type { CaveSpeciesId } from '../../mitwachsen-hoehle';
import { dress, type Dress } from '../../mitwachsen-fine';
import { BAT_ROOST, CAVE_MODELS, SPIDER_MODELS, type SpiderPose } from './mitwachsen-cave-models';
import { GROTTE_COLORS } from './mitwachsen-grotte';

type CaveFine = { readonly by: Dress; readonly extra: readonly Part[] };

const FELL = { skin: 'fell' } as const;
const LACK = { skin: 'lack' } as const;
const fell = (...colors: string[]): Dress => Object.fromEntries(colors.map((c) => [c, FELL]));
const lack = (...colors: string[]): Dress => Object.fromEntries(colors.map((c) => [c, LACK]));

/** Teil wie in den Skizzen von mitwachsen-cave-models.ts (x rechts, y hoch, z vom Betrachter weg), um `lift` angehoben */
const s = (x: number, y: number, z: number, w: number, h: number, d: number, c: string, lift = 0): Part => [
  -(z + d),
  -(x + w),
  y + lift,
  d,
  w,
  h,
  c,
];
/** Teil auf beiden Seiten: wie angegeben und an der Mitte (x = 0) gespiegelt */
const both = (x: number, y: number, z: number, w: number, h: number, d: number, c: string, lift = 0): Part[] => [
  s(x, y, z, w, h, d, c, lift),
  s(-x - w, y, z, w, h, d, c, lift),
];

const CLAW = '#efe8dc';
const RIB = '#6e6690';

/** Feinheit je Höhlen-Tier: Muster je Farbe und Zusatzteile */
export const CAVE_ANIMAL_FINE: Readonly<Record<CaveSpeciesId, CaveFine>> = {
  maulwurf: {
    by: fell('#2e2b33'),
    extra: [...both(-0.33, 0, -0.25, 0.04, 0.03, 0.01, CLAW), ...both(-0.27, 0, -0.25, 0.04, 0.03, 0.01, CLAW)], // Krallen an den Grabehänden
  },
  dachs: {
    by: fell('#8a8f96', '#9aa0a8', '#f2f0ea', '#2e2b33'),
    extra: both(-0.19, 0, -0.31, 0.06, 0.02, 0.01, '#d8d4c8'), // Krallen an den Vorderbeinen
  },
  grottenolm: {
    by: lack('#f3ead8'), // glatte Haut
    extra: both(-0.18, 0, -0.15, 0.02, 0.015, 0.01, '#e9dec8'), // Fingerchen an den Vorderbeinen
  },
  eidechse: {
    by: lack('#5fb8a0', '#4fa38c'), // glatte Schuppen
    extra: [
      s(-0.04, 0.13, -0.05, 0.08, 0.005, 0.06, '#4fa38c'), // Tupfen auf dem Rücken
      s(-0.03, 0.13, 0.12, 0.06, 0.005, 0.05, '#4fa38c'),
      ...both(-0.2, 0, -0.11, 0.03, 0.015, 0.01, '#4fa38c'), // Zehen vorn
    ],
  },
  siebenschlaefer: {
    by: fell('#b9bcc6', '#d3d6de'),
    extra: [
      ...both(-0.22, 0.37, -0.27, 0.07, 0.008, 0.01, '#f4f4f6'), // Schnurrhaare
      ...both(-0.15, 0, -0.24, 0.08, 0.03, 0.04, '#e6e7ec'), // Füßchen
    ],
  },
  fledermaus: {
    by: { ...fell('#7a6a5e', '#a08c7c'), ...lack('#8a82b0') }, // Fell, Flughaut glatt
    extra: [
      ...both(-0.42, 0.32, -0.04, 0.02, 0.005, 0.1, RIB, 0.15),
      ...both(-0.3, 0.32, -0.04, 0.02, 0.005, 0.1, RIB, 0.15),
    ], // Fingerknochen
  },
  murmeltier: {
    by: fell('#b08850', '#8a6a3c'),
    extra: [
      ...both(-0.11, 0.32, -0.21, 0.06, 0.02, 0.01, '#5a4632'), // Krallen an den Pfoten
      ...both(-0.15, 0, -0.19, 0.1, 0.03, 0.04, '#8a6a3c'), // Füße
    ],
  },
  gluehwuermchen: {
    by: { ...lack('#2f4a2a', '#24381f'), '#d8ff6a': { halo: true } }, // glatter Panzer, das Hinterteil leuchtet
    extra: [],
  },
};

/** Die Modelle der Höhlen-Tiere fein (Grundform, Zusatzteile, Muster); die Grundform allein bleibt `CAVE_MODELS` */
export const CAVE_FINE_MODELS = {} as Record<CaveSpeciesId, readonly Part[]>;
for (const id of Object.keys(CAVE_MODELS) as CaveSpeciesId[]) {
  const { by, extra } = CAVE_ANIMAL_FINE[id];
  CAVE_FINE_MODELS[id] = dress([...CAVE_MODELS[id], ...extra], by);
}

/** Die Fledermaus kopfüber, fein wie fliegend (ohne Zusatzteile: Die Flügel sind angelegt) */
export const CAVE_FINE_ROOST: readonly Part[] = dress(BAT_ROOST, CAVE_ANIMAL_FINE.fledermaus.by);

/** Die Tupfspinne fein: Körper und Kopf glatt (Lack), ohne Haare; Tupfen, Beine und Gesicht wie immer */
export const SPIDER_FINE_MODELS = {} as Record<SpiderPose, readonly Part[]>;
for (const pose of Object.keys(SPIDER_MODELS) as SpiderPose[])
  SPIDER_FINE_MODELS[pose] = dress(SPIDER_MODELS[pose], lack(GROTTE_COLORS.spider.body));
