// Welt-Paket der Eis-Welt: einziger Einstieg (`import('./worlds/eis')`). Alles, was nur die Eis-Welt braucht, kommt von
// hier: der Gletscherkessel hinter dem Eistor (Gelände, Zuhause, Wohnorte der Eis-Tiere, Eis-Portal), die Regeln des
// verlaufenen Pinguins, der zum Eistor führt und es öffnet, die Regeln der Schneemänner und des Eiszapfen-Glockenspiels
// (`rules`), der Schlitten zwischen Schneebett und Lichtung (`rules.ride`) und die Zeichenteile der 2D-Ansicht (Iglu,
// Fischkisten, Rutschspur, Wetter, Bild der Weltgrenze, Schlitten) samt den Modellen der zehn Eis-Tiere.
// Geladen wird es erst, wenn sein Tor eine Rolle spielt (`needsPack`). Nichts außerhalb dieses Ordners importiert
// statisch von hier (geprüft durch `npm run arch`), so bleibt es ein eigenes Paket, das der Browser nachlädt: im Build
// `_astro/welt-eis.<hash>.js` (Name aus astro.config.mjs), gemessen mit eigener Grenze (scripts/verify-bundles.ts).
// Sein 3D-Teil (view-3d.ts: Iglu, Fischkisten, Kessel, Tür und Eiszapfen des Eistors) braucht Three.js und kommt erst,
// wenn die 3D-Ansicht ihn will (`view3d`): `_astro/welt-eis-3d.<hash>.js`, ebenfalls mit eigener Grenze.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import type { GuideRules } from '../../mitwachsen-guide';
import type { HeraldRules } from '../../mitwachsen-herald';
import type { WorldPack } from '../../mitwachsen-pack-types';
import type { RideEngine, Vehicle } from '../../mitwachsen-rider';
import type { Sight } from '../../mitwachsen-sight';
import type { View2D } from '../../mitwachsen-view';
import type { View3D } from '../../mitwachsen-view-3d';
import { buildKessel, placeKessel } from './mitwachsen-kessel';
import { view } from './view-2d';
import { ICE_MODELS } from '../../../../data/games/worlds/eis/mitwachsen-ice-models';
import { ICE_FINE_MODELS } from '../../../../data/games/worlds/eis/mitwachsen-ice-fine';
import { guide, hold, meetGuide } from './mitwachsen-lead';
import { shut } from './mitwachsen-ritual';
import { rules as snowman } from './mitwachsen-snowman';
import { rules as chime } from './mitwachsen-chime';
import { sled } from './mitwachsen-sled';
import { tube } from './mitwachsen-tube';
import { cat, visit } from './mitwachsen-cat';
import { rules as places } from './mitwachsen-places';
import { PLACE_SIGHTS } from './mitwachsen-places-look';
import { SIGHTS } from './mitwachsen-sights';
import { haltSight } from '../../mitwachsen-ride-kit';

export const pack: WorldPack<GuideRules, View2D, View3D, RideEngine, HeraldRules, Vehicle, Sight> = {
  id: 'eis',
  gate: 'eis',
  build: buildKessel,
  place: placeKessel,
  lead: { guide, meetGuide, hold }, // Regeln des Pinguins (ein schlichtes Objekt, kein Modul-Namensraum: spart Bytes)
  // Tür im Vorspiel des Eistors (die Flügel sind noch zu); Schneemänner bauen; Eiszapfen klingen (ohne Halt, darum
  // zuletzt); der Schlitten mit dem Schlittenrentier (mitwachsen-sled.ts; seine Fahrregeln bringt das Paket der Fahrzeuge)
  // dazu der Rodelreifen am Rodelberg (mitwachsen-tube.ts): nur bergab, immer da
  rules: {
    // zuerst zählt `visit` die Besuche (nie ein Halt): Ab dem zweiten steht die Schneeraupe an ihrem Halt
    bump: (...a) => visit(...a) || shut(...a) || snowman.bump(...a) || places.bump(...a) || chime.bump(...a),
    vehicle: sled,
    more: [tube, cat], // Rodelreifen am Rodelberg, Schneeraupe auf ihrer Runde
  },
  // Schneehaufen und Eiszapfen-Glockenspiel locken, bis sie gefunden sind; Schlitten, Rodelreifen und Schneeraupe bis zur
  // ersten Fahrt; dazu Fähnchen und Laternen-Tannen
  sights: [...SIGHTS, haltSight(sled), haltSight(tube), haltSight(cat), ...PLACE_SIGHTS],
  view,
  view3d: () => import('./view-3d').then((m) => m.view3d),
  models: ICE_FINE_MODELS, // fein (Muster, Zehen, Krallen …); der Umriss von „Noch nicht“ bleibt die Grundform
  outlines: ICE_MODELS,
};
