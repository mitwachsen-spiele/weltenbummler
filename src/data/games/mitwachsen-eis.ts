// Eis-Welt von Mitwachsen, was alle brauchen (Leiste, Album, Arten, Ansicht): Farben der Fische, das Netz mit
// Fischen und die zehn Eis-Tiere (Name, Ton, Gangart). Maße des Gletscherkessels, Wohnorte und Modelle der Tiere
// braucht nur das Welt-Paket der Eis-Welt: worlds/eis/mitwachsen-kessel.ts und mitwachsen-ice-models.ts. Die Gegend steht in `REGIONS` (Gegend 'eis'), ihr Zuhause in `HOMES.eis`.
// Konzept: docs/games/mitwachsen.md · Spec: docs/specs/mitwachsen.md

import type { Part } from '../../lib/games/front';
import { CARRY_DRESS, dress } from './mitwachsen-fine';
import type { SpeciesOf } from './mitwachsen-species';

/**
 * Silberblaue Fische (Rücken, heller Bauch) und ihre Schwanzflossen: am Netz der Figur und in der Fischkiste. Die übrigen
 * Farben der Eis-Welt (`ICE_COLORS`) und der Eiskristalle (`ICE_CRYSTALS`) braucht nur ihr Welt-Paket:
 * src/data/games/worlds/eis/mitwachsen-ice-colors.ts
 */
export const FISH_COLORS = {
  fish: ['#9fb4c8', '#dfe9f2'],
  fin: '#7f96ad',
} as const;

/** Netz mit zwei silberblauen Fischen in der linken Hand (nach dem Fangen, bis zur Eisschale); gespiegelt zum Eimer */
export const FISH_PARTS: Part[] = dress(
  [
    [-0.11, -0.47, 0.06, 0.22, 0.2, 0.19, '#d8cfb4', FISH_COLORS.fish[0]], // Netz, oben schauen die Fische heraus
    [-0.115, -0.475, 0.13, 0.23, 0.21, 0.02, '#b9ae90'], // Maschen
    [-0.115, -0.475, 0.25, 0.23, 0.21, 0.03, '#8a5f2a'], // Rand
    [-0.01, -0.38, 0.28, 0.02, 0.02, 0.08, '#5d4a2f'], // Stiel bis zur Hand
    [-0.07, -0.44, 0.22, 0.06, 0.05, 0.1, ...FISH_COLORS.fish], // zwei Fische, die Schwänze stehen über den Rand
    [-0.09, -0.46, 0.31, 0.1, 0.09, 0.06, FISH_COLORS.fin],
    [0.02, -0.37, 0.22, 0.06, 0.05, 0.08, ...FISH_COLORS.fish],
    [0.0, -0.39, 0.29, 0.1, 0.09, 0.06, FISH_COLORS.fin],
  ],
  CARRY_DRESS,
);

/** Funken beim Fangen (Platsch) und beim Füttern mit Fisch (silbern und goldgelb) */
export const FISH_SPARKS = {
  catch: ['#9fb4c8', '#dfe9f2', '#3f8fd8'],
  feed: ['#dfe9f2', '#c3ced8', '#ffd47e', '#f2d14b'],
} as const;

/** Iglu der Schneewiese: Höhe der Kuppel und Reihen aus Schneeblöcken (gezeichnet in mitwachsen-ice-look.ts) */
export const IGLOO_H = 2.8;
export const IGLOO_LAYERS = 7;
/**
 * Sims vorn über dem Bogen, auf der zweitobersten Reihe: Mitte des Platzes vor der obersten Reihe (vor der Rückwand
 * gemessen) und Höhe über dem Boden. Dort sitzt beim Polarlicht die Schneeeule (in 3D unter der Kopfzeile gut zu sehen).
 */
export const IGLOO_LEDGE = { ahead: 3.08, z: (IGLOO_H * (IGLOO_LAYERS - 1)) / IGLOO_LAYERS } as const;

// ---------- Tiere der Eis-Welt ----------

/** Die zehn Arten der Eis-Welt, in der Reihenfolge der Leiste */
export type IceSpeciesId =
  | 'pinguin'
  | 'eisbaer'
  | 'robbe'
  | 'schneeeule'
  | 'walross'
  | 'rentier'
  | 'polarfuchs'
  | 'moschusochse'
  | 'papageitaucher'
  | 'lemming';

/**
 * Fischfresser: Sie machen beim Füttern mit Fisch zusätzlich einen Schnapp-Hüpfer. Rentier, Moschusochse und Lemming
 * scharren lieber am Moosfleck (am Rand der Eisschale liegt auch ein Büschel Moos für sie).
 */
export const FISH_EATERS: ReadonlySet<string> = new Set<IceSpeciesId>([
  'pinguin',
  'eisbaer',
  'robbe',
  'schneeeule',
  'walross',
  'polarfuchs',
  'papageitaucher',
]);

/**
 * Töne und Gangart der Eis-Tiere; ihre Modelle (`parts`) bringt das Welt-Paket der Eis-Welt mit (`ICE_MODELS` in
 * worlds/eis/mitwachsen-ice-models.ts, eingetragen mit `addModels`), denn ein Eis-Tier zeigt sich erst mit ihm. Töne in der Pentatonik, von tief (Walross, Moschusochse, Eisbär) bis hoch (Lemming, Papageitaucher), damit man jedes
 * Tier am Ton erkennt. Die Gangart (`gait`) ist nur Zierde beim Gleiten.
 */
export const ICE_SPECIES: { [K in IceSpeciesId]: SpeciesOf<K> } = {
  pinguin: {
    id: 'pinguin',
    name: 'Pinguin',
    scale: 1.15,
    gait: 'watscheln',
    // fröhliches Tröten, aufwärts
    tone: { notes: [392, 440], wave: 'square', len: 0.1, gap: 0.03, gain: 0.05 },
    parts: [], // Modell aus dem Welt-Paket der Eis-Welt (ICE_MODELS)
  },
  eisbaer: {
    id: 'eisbaer',
    name: 'Eisbärkind',
    scale: 1.2,
    // tiefes, freundliches Brummen, gleitet leicht nach unten
    tone: { notes: [130.81, 146.83], wave: 'triangle', len: 0.26, gap: 0.06, slide: 0.88, gain: 0.22 },
    parts: [], // Modell aus dem Welt-Paket der Eis-Welt (ICE_MODELS)
  },
  robbe: {
    id: 'robbe',
    name: 'Robbe',
    scale: 1.2,
    gait: 'robben',
    // kurzes, hohes Bellen
    tone: { notes: [659.25, 659.25], wave: 'square', len: 0.07, gap: 0.06, gain: 0.05 },
    parts: [], // Modell aus dem Welt-Paket der Eis-Welt (ICE_MODELS)
  },
  schneeeule: {
    id: 'schneeeule',
    name: 'Schneeeule',
    scale: 1.2,
    gait: 'flattern',
    // weiches Huhu
    tone: { notes: [392, 329.63], wave: 'sine', len: 0.32, gap: 0.1, gain: 0.2 },
    parts: [], // Modell aus dem Welt-Paket der Eis-Welt (ICE_MODELS)
  },
  walross: {
    id: 'walross',
    name: 'Walross',
    scale: 1.15,
    gait: 'robben',
    // tiefes Grunzen, leise, gleitet nach unten
    tone: { notes: [65.41], wave: 'sawtooth', len: 0.5, gap: 0, slide: 0.85, gain: 0.08 },
    parts: [], // Modell aus dem Welt-Paket der Eis-Welt (ICE_MODELS)
  },
  rentier: {
    id: 'rentier',
    name: 'Rentier',
    scale: 1.15,
    // kurzes Grunzen aus zwei Tönen
    tone: { notes: [293.66, 261.63], wave: 'triangle', len: 0.12, gap: 0.04, gain: 0.18 },
    parts: [], // Modell aus dem Welt-Paket der Eis-Welt (ICE_MODELS)
  },
  polarfuchs: {
    id: 'polarfuchs',
    name: 'Polarfuchs',
    scale: 1.25,
    gait: 'huepfen',
    // helles Kläffen
    tone: { notes: [440, 523.25], wave: 'triangle', len: 0.08, gap: 0.04, gain: 0.16 },
    parts: [], // Modell aus dem Welt-Paket der Eis-Welt (ICE_MODELS)
  },
  moschusochse: {
    id: 'moschusochse',
    name: 'Moschusochse',
    scale: 1.15,
    // tiefes Muhen, leise und lang
    tone: { notes: [98], wave: 'sawtooth', len: 0.55, gap: 0, slide: 0.94, gain: 0.07 },
    parts: [], // Modell aus dem Welt-Paket der Eis-Welt (ICE_MODELS)
  },
  papageitaucher: {
    id: 'papageitaucher',
    name: 'Papageitaucher',
    scale: 1.3,
    gait: 'huschen',
    // schnelles Schnarren, leise
    tone: { notes: [1318.51, 1567.98, 1318.51], wave: 'square', len: 0.05, gap: 0.02, gain: 0.035 },
    parts: [], // Modell aus dem Welt-Paket der Eis-Welt (ICE_MODELS)
  },
  lemming: {
    id: 'lemming',
    name: 'Lemming',
    scale: 1.3, // winzig: etwas größer gezeichnet, damit man ihn gut sieht
    gait: 'huschen',
    // Piepsen in schneller Folge
    tone: { notes: [880, 1046.5, 880, 1046.5], wave: 'sine', len: 0.05, gap: 0.015, gain: 0.12 },
    parts: [], // Modell aus dem Welt-Paket der Eis-Welt (ICE_MODELS)
  },
};
