// Höhlenwelt von Mitwachsen, was alle brauchen (Leiste, Album, Arten, Ansicht): die acht Höhlen-Tiere (Name, Ton,
// Gangart, Futter), Farben der Leuchtpilze, der Korb mit Leuchtpilzen, die Kanne mit Tropfwasser und die Kristall-Laterne,
// die die Figur trägt. Wohnorte und Modelle der Tiere braucht nur das Welt-Paket der Höhlenwelt:
// src/data/games/worlds/hoehle/mitwachsen-cave-animals.ts und mitwachsen-cave-models.ts. Die Gegend steht in `REGIONS`
// (Gegend 'hoehle'), ihr Zuhause in `HOMES.hoehle`.
// Konzept: docs/games/mitwachsen.md (Höhlenwelt) · Spec: docs/specs/mitwachsen.md (Abschnitt „Die Höhlen-Tiere“)

import type { Part } from '../../lib/games/front';
import { CARRY_DRESS, dress } from './mitwachsen-fine';
import type { SpeciesOf } from './mitwachsen-species';

/**
 * Kleine Leuchtpilze in Rosa, Türkis und Gelb: in den Beeten des Pilzgartens, im Korb der Figur, in der Pilzschale. Die
 * übrigen Farben der Grotte (`GROTTE_COLORS`) braucht nur ihr Welt-Paket. Rosa so hell wie die rosa Kristalle der Grotte: Alles,
 * was leuchtet, hat gegen den Boden unter der Dunkelmaske mindestens 3 : 1
 */
export const SHROOM_COLORS = ['#ff9cd4', '#6fd6f0', '#ffe08a'] as const;
const STEM = '#efe4d2'; // Stiel der Leuchtpilze

/** Korb mit Leuchtpilzen auf dem Rücken (nach dem Sammeln am Beet, bis zur Pilzschale); der Korb wie bei den Beeren */
export const SHROOM_BASKET_PARTS: Part[] = dress(
  [
    [-0.33, -0.17, 0.38, 0.21, 0.34, 0.3, '#b0803c', '#c9984e'], // Korb aus Weide
    [-0.335, -0.175, 0.47, 0.22, 0.35, 0.03, '#8a5f2a'], // Flechtband
    [-0.335, -0.175, 0.6, 0.22, 0.35, 0.03, '#8a5f2a'],
    [-0.12, -0.15, 0.7, 0.25, 0.04, 0.03, '#8a5f2a'], // Riemen über den Schultern
    [-0.12, 0.11, 0.7, 0.25, 0.04, 0.03, '#8a5f2a'],
    [-0.27, -0.11, 0.68, 0.03, 0.03, 0.07, STEM], // drei Stiele, darauf die Hüte in den drei Farben
    [-0.23, 0.0, 0.68, 0.03, 0.03, 0.09, STEM],
    [-0.2, -0.07, 0.68, 0.03, 0.03, 0.05, STEM],
    [-0.3, -0.14, 0.75, 0.09, 0.09, 0.04, SHROOM_COLORS[0], SHROOM_COLORS[0]],
    [-0.26, -0.03, 0.77, 0.09, 0.09, 0.04, SHROOM_COLORS[1], SHROOM_COLORS[1]],
    [-0.23, -0.1, 0.73, 0.09, 0.09, 0.04, SHROOM_COLORS[2], SHROOM_COLORS[2]],
  ],
  CARRY_DRESS,
);

/** Kanne aus hellem Stein mit Tropfwasser in der rechten Hand (in der Grotte statt des Eimers; bis zum Steintrog) */
export const JUG_PARTS: Part[] = [
  [-0.1, 0.27, 0.06, 0.2, 0.2, 0.2, '#9a96b0', '#b8b4cc'], // bauchige Kanne
  [-0.08, 0.29, 0.26, 0.16, 0.16, 0.03, '#b8b4cc', '#5fc8d8'], // Hals, oben Wasser
  [0.1, 0.33, 0.16, 0.05, 0.06, 0.04, '#9a96b0'], // Tülle nach vorn
  [-0.14, 0.34, 0.1, 0.04, 0.05, 0.14, '#8d86a8'], // Henkel hinten
];

/**
 * Kristall-Laterne in der linken Hand, vor dem Netz (in der Grotte, nach dem Hineinlaufen in ihren Sockel am Höhlenbett): ein
 * leuchtender türkiser Kristall in einem Rahmen aus hellem Silber. Kein Gold: In der Hand ist sie keine Aktion mehr;
 * nur auf ihrem Sockel trägt sie einen goldenen Rahmen (Welt-Paket der Höhlenwelt). Kein Feuer, keine Fackel
 */
export const LANTERN_PARTS: Part[] = dress(
  [
    [0.17, -0.36, 0.3, 0.03, 0.03, 0.07, '#8d86a8'], // Bügel bis zur Hand
    [0.1, -0.43, 0.28, 0.17, 0.17, 0.03, '#c9c4dc', '#e4e0f0'], // Deckel
    [0.12, -0.41, 0.09, 0.13, 0.13, 0.19, '#8fe0ea', '#d8f6fa'], // Kristall, leuchtet
    [0.1, -0.43, 0.06, 0.17, 0.17, 0.03, '#c9c4dc', '#e4e0f0'], // Boden
  ],
  CARRY_DRESS,
);

/** Funken, wenn die Figur die Kristall-Laterne nimmt: türkis, lila, weiß */
export const LANTERN_SPARKS = ['#8fe0ea', '#b48cf0', '#ffffff'] as const;

/** Funken beim Sammeln (Leuchtpilze hüpfen in den Korb) und beim Füttern mit Pilzen */
export const SHROOM_SPARKS = {
  gather: [...SHROOM_COLORS, '#ffffff'],
  feed: [...SHROOM_COLORS, '#ffd47e'],
} as const;

/** Die acht Arten der Höhlenwelt, in der Reihenfolge der Leiste (der Maulwurf zieht später als erster ein) */
export type CaveSpeciesId =
  'maulwurf' | 'dachs' | 'grottenolm' | 'eidechse' | 'siebenschlaefer' | 'fledermaus' | 'murmeltier' | 'gluehwuermchen';

/**
 * Töne und Gangart der Höhlen-Tiere wie im Konzept; ihre Modelle (`parts`, bei der Fledermaus auch `roost`) bringt
 * das Welt-Paket der Höhlenwelt mit (`CAVE_MODELS` in worlds/hoehle/mitwachsen-cave-models.ts, eingetragen mit
 * `addModels`), denn ein Höhlen-Tier zeigt sich erst mit ihm. Alle Töne in der Pentatonik; der Dachs brummt auf A3
 * (220 Hz, nicht 110: so tief klingen Lautsprecher von Handy und Tablet nicht). Die Gangart ist nur Zierde beim Gleiten.
 */
export const CAVE_SPECIES: { [K in CaveSpeciesId]: SpeciesOf<K> } = {
  maulwurf: {
    id: 'maulwurf',
    name: 'Maulwurf',
    scale: 1.35, // klein: etwas größer gezeichnet, damit man ihn gut sieht
    gait: 'huschen',
    // „mümm-mümm“: D4, E4
    tone: { notes: [293.66, 329.63], wave: 'triangle', len: 0.12, gap: 0.05, gain: 0.16 },
    parts: [], // Modell aus dem Welt-Paket der Höhlenwelt (CAVE_MODELS)
  },
  dachs: {
    id: 'dachs',
    name: 'Dachs',
    scale: 1.2,
    gait: 'watscheln',
    // tiefes Schnaufen auf A3, gleitet nach unten
    tone: { notes: [220], wave: 'triangle', len: 0.3, gap: 0, slide: 0.9, gain: 0.2 },
    parts: [], // Modell aus dem Welt-Paket der Höhlenwelt (CAVE_MODELS)
  },
  grottenolm: {
    id: 'grottenolm',
    name: 'Grottenolm',
    scale: 1.3,
    gait: 'robben',
    // „blubb“: C4, gleitet nach unten
    tone: { notes: [261.63], wave: 'sine', len: 0.16, gap: 0, slide: 0.7, gain: 0.2 },
    parts: [], // Modell aus dem Welt-Paket der Höhlenwelt (CAVE_MODELS)
  },
  eidechse: {
    id: 'eidechse',
    name: 'Sonnen-Eidechse',
    scale: 1.3,
    gait: 'huschen',
    // „tik-tik“: zweimal kurz G4
    tone: { notes: [392, 392], wave: 'triangle', len: 0.04, gap: 0.06, gain: 0.14 },
    parts: [], // Modell aus dem Welt-Paket der Höhlenwelt (CAVE_MODELS)
  },
  siebenschlaefer: {
    id: 'siebenschlaefer',
    name: 'Siebenschläfer',
    scale: 1.3,
    gait: 'huepfen',
    // Triller A4, C5, A4
    tone: { notes: [440, 523.25, 440], wave: 'sine', len: 0.07, gap: 0.01, gain: 0.13 },
    parts: [], // Modell aus dem Welt-Paket der Höhlenwelt (CAVE_MODELS)
  },
  fledermaus: {
    id: 'fledermaus',
    name: 'Fledermaus',
    scale: 1.3,
    gait: 'flattern',
    // leises Zirpen E5, G5
    tone: { notes: [659.25, 783.99], wave: 'sine', len: 0.06, gap: 0.03, gain: 0.05 },
    parts: [], // Modell aus dem Welt-Paket der Höhlenwelt (CAVE_MODELS)
    roost: [], // hängt tagsüber kopfüber im Kristallbogen (`Cell.perch`); Modell dazu aus dem Welt-Paket
  },
  murmeltier: {
    id: 'murmeltier',
    name: 'Murmeltier',
    scale: 1.25,
    gait: 'huepfen',
    // heller Pfiff A5
    tone: { notes: [880], wave: 'sine', len: 0.18, gap: 0, gain: 0.12 },
    parts: [], // Modell aus dem Welt-Paket der Höhlenwelt (CAVE_MODELS)
  },
  gluehwuermchen: {
    id: 'gluehwuermchen',
    name: 'Glühwürmchen',
    scale: 1.5, // winzig: deutlich größer gezeichnet
    gait: 'flattern',
    // Glöckchen C6, E6, ganz leise
    tone: { notes: [1046.5, 1318.51], wave: 'sine', len: 0.09, gap: 0.04, gain: 0.04 },
    parts: [], // Modell aus dem Welt-Paket der Höhlenwelt (CAVE_MODELS)
  },
};

/**
 * Futter je Art (Konzept „Sammeln“): Leuchtpilze aus dem Pilzgarten in der Pilzschale (`pilze`) oder Tropfmoos (`tropfmoos`),
 * das an der Tropfquelle und am Rand des Steintrogs wächst und an dem die Tiere selbst naschen
 */
export const CAVE_FOOD: Readonly<Record<CaveSpeciesId, 'pilze' | 'tropfmoos'>> = {
  maulwurf: 'pilze',
  dachs: 'pilze',
  grottenolm: 'tropfmoos',
  eidechse: 'tropfmoos',
  siebenschlaefer: 'pilze',
  fledermaus: 'tropfmoos',
  murmeltier: 'pilze',
  gluehwuermchen: 'tropfmoos',
};

const eaters = (food: 'pilze' | 'tropfmoos'): ReadonlySet<string> =>
  new Set(Object.entries(CAVE_FOOD).flatMap(([id, f]) => (f === food ? [id] : [])));
/** Pilzfresser: Sie naschen beim Füttern mit Pilzen zusätzlich (Schnapp-Hüpfer wie die Fischfresser) */
export const SHROOM_EATERS = eaters('pilze');
/** Moosfresser: Wird der Steintrog gefüllt, naschen sie am frischen Tropfmoos an seinem Rand (Schnapp-Hüpfer) */
export const MOSS_EATERS = eaters('tropfmoos');

/**
 * Tok, der Gleisbauer: der Bote der Höhlenwelt (ein Gast wie der verlaufene Pinguin, kein Tier der Leiste). Der Kern
 * kennt Name, Ton und Gangart, damit er singt, hüpft und in der Leiste als Gast steht; sein Modell (0,8-mal so groß wie
 * die Figur, roter Helm mit Lampe, Maulwurf obendrauf, Spitzhacke über der Schulter) bringt das Paket der Bahn mit
 * (`TOK_MODEL` in worlds/bahn/mitwachsen-tok-model.ts, eingetragen mit `addModels`). Ruf „Ju-hu“: E4–G4–E4 im Rechteck,
 * wie der Pinguin, aber erkennbar jemand anderes. Den Namen hört man nie im Spiel, nur die Live-Region sagt ihn
 */
export const TOK_SPECIES: { tok: SpeciesOf<'tok'> } = {
  tok: {
    id: 'tok',
    name: 'Tok',
    scale: 1, // das Modell hat schon seine Größe
    gait: 'huepfen',
    tone: { notes: [329.63, 392, 329.63], wave: 'square', len: 0.09, gap: 0.03, gain: 0.05 },
    parts: [], // Modell aus dem Paket der Bahn (TOK_MODEL)
  },
};

/**
 * Der erste Maulwurf (Kennung wie `animalId('hoehle', 'maulwurf')`; hier als Text, mitwachsen.ts importiert diese
 * Datei): Er sitzt auf Toks Helm, bis Tok mit Bau 2 in der Grotte ankommt (Paket der Bahn), und zieht dann als erstes
 * Höhlen-Tier ins Gehege am Höhlenbett. Erst danach erwacht das Portal am stillen See (`Portal.later`)
 */
export const FIRST_MOLE = 'hoehle:maulwurf';

/** Die Arten der Höhlenwelt samt Tok, ihrem Boten (für `SPECIES`, `SpeciesId`) */
export type CaveBeingId = CaveSpeciesId | 'tok';
export const CAVE_BEINGS: { [K in CaveBeingId]: SpeciesOf<K> } = { ...CAVE_SPECIES, ...TOK_SPECIES };
