// Feine Teile der zehn Eis-Tiere (Entwurf „Feine Grafik“, Issue 13), nur im Welt-Paket der Eis-Welt: Muster je Material
// über die Farbe eines Teils (Fell, glatte Haut als Lack, Horn) und ein paar Zusatzquader je Art (Zehen, Krallen, Hufe,
// Schnurrhaare, Glanz auf der Nase). Proportionen, Farben und Fußabdruck bleiben; jedes Zusatzteil liegt in der Hülle
// seines Modells (Test). Die Grundform ohne Feinteile bleibt `ICE_MODELS`: Aus ihr entsteht der Umriss von „Noch nicht“
// und der Leiste (`WorldPack.outlines`, `Species.outline`), so ändert er sich nicht.
// Spec: docs/specs/mitwachsen.md (Feinheit)

import type { Part } from '../../../../lib/games/front';
import type { IceSpeciesId } from '../../mitwachsen-eis';
import { dress, type Dress } from '../../mitwachsen-fine';
import { ICE_MODELS } from './mitwachsen-ice-models';

type IceFine = { readonly by: Dress; readonly extra: readonly Part[] };

const FELL = { skin: 'fell' } as const;
const LACK = { skin: 'lack' } as const;
const fell = (...colors: string[]): Dress => Object.fromEntries(colors.map((c) => [c, FELL]));
const W = '#ffffff';
/** Teil auf beiden Seiten: wie angegeben und an der Mitte gespiegelt */
const both = ([f, r, ...rest]: Part): Part[] => [
  [f, r, ...rest],
  [f, -r - rest[2], ...rest],
];

/** Feinheit je Eis-Tier: Muster je Farbe und Zusatzteile */
export const ICE_ANIMAL_FINE: Readonly<Record<IceSpeciesId, IceFine>> = {
  pinguin: {
    by: { '#262b36': LACK, ...fell('#f4f6f8') }, // glattes Gefieder auf dem Rücken, weicher Bauch
    extra: [
      ...both([0.16, -0.13, 0, 0.02, 0.03, 0.02, '#d9772e']),
      ...both([0.16, -0.075, 0, 0.02, 0.03, 0.02, '#d9772e']),
    ], // Zehen
  },
  eisbaer: {
    by: fell('#efe8d6', '#e4dcc6'),
    extra: both([0.29, -0.175, 0, 0.008, 0.11, 0.025, '#8a7f6a']), // Krallen
  },
  robbe: {
    by: { '#8f99a5': LACK, '#76808b': LACK },
    extra: [[0.442, -0.015, 0.165, 0.005, 0.015, 0.012, W, null, 'f']], // Glanz auf der Nase
  },
  schneeeule: {
    by: fell('#f3f3ee', '#e6e6de'),
    extra: both([0.12, 0.035, 0, 0.012, 0.06, 0.02, '#3a3a44']), // Krallen
  },
  walross: {
    by: { '#a8705a': LACK, '#8e5c48': LACK, ...fell('#d7ad92') },
    extra: both([0.5, -0.09, 0.14, 0.005, 0.02, 0.02, '#f7f2e3', null, 'f']), // Barthaar-Tupfen auf dem Schnauzbart
  },
  rentier: {
    by: fell('#8a6a50', '#efe7d8', '#5e4a3a'),
    extra: [
      ...both([0.2, -0.11, 0, 0.008, 0.07, 0.035, '#2e241c']), // Hufe vorn
      ...both([-0.15, -0.11, 0, 0.008, 0.07, 0.035, '#2e241c']),
    ],
  },
  polarfuchs: {
    by: fell('#eef2f8', '#c3ccd9', '#d9dfe8'),
    extra: both([0.43, -0.12, 0.26, 0.01, 0.07, 0.008, '#9aa6b5', null, 'f']), // Schnurrhaare
  },
  moschusochse: {
    by: { ...fell('#4a3426', '#3d2a1e', '#a88c6a'), '#e3d6b8': LACK }, // Zottelfell, glatte Hörner
    extra: [
      ...both([0.22, -0.14, 0, 0.008, 0.08, 0.03, '#5a4a38']), // Hufe
      ...both([-0.2, -0.14, 0, 0.008, 0.08, 0.03, '#5a4a38']),
    ],
  },
  papageitaucher: {
    by: { '#23262e': LACK, '#e3532c': LACK },
    extra: both([0.1, 0.025, 0, 0.015, 0.025, 0.015, '#d9772e']), // Zehen
  },
  lemming: {
    by: fell('#c98e4a'),
    extra: both([0.18, -0.09, 0.07, 0.006, 0.06, 0.006, '#f4f0e6', null, 'f']), // Schnurrhaare
  },
};

/** Die Modelle der Eis-Tiere fein (Grundform, Zusatzteile, Muster); die Grundform allein bleibt `ICE_MODELS` */
export const ICE_FINE_MODELS = {} as Record<IceSpeciesId, readonly Part[]>;
for (const id of Object.keys(ICE_MODELS) as IceSpeciesId[]) {
  const { by, extra } = ICE_ANIMAL_FINE[id];
  ICE_FINE_MODELS[id] = dress([...ICE_MODELS[id], ...extra], by);
}
