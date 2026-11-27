// Welt-Paket der Höhlenwelt: einziger Einstieg (`import('./worlds/hoehle')`). Alles, was nur die Höhlenwelt braucht,
// kommt von hier: die Kristallgrotte hinter dem Höhlentor (Lage, Gelände mit allen Zonen, Zuhause mit Unterstand an der Kristallwand,
// Licht, Portal am stillen See, Fundorte der acht Höhlen-Tiere, Pilzbeete, Tropfquelle und Tropfmoos zum Sammeln) und
// die Zeichenteile der 2D-Ansicht samt den Modellen der Höhlen-Tiere (die Fledermaus auch kopfüber), dazu ihr Schmuck:
// Säulen-Glockenspiel, Grottenolm am Steg und Tropfsteine (Regeln in mitwachsen-cave-rules.ts, Bild und Ton in
// view-2d.ts), die kleinen Lichtgeister in der Kristallhalle samt Klangstein (mitwachsen-ghost.ts, mitwachsen-ghost-look.ts), die
// Tupfspinnen an ihren Netzen, die wie eine Harfe klingen (mitwachsen-spider.ts, mitwachsen-spider-look.ts), ihre Füllung (mitwachsen-fill.ts) und ihr Licht: Ränder im Dunkel, Lichtkreis um die Figur und die
// Kristall-Laterne am Bett (mitwachsen-glow.ts, mitwachsen-lantern.ts; die Regel der Laterne ist Teil von `rules`). Die
// Regeln des Sammelns stehen bei den Handgriffen im Kern (mitwachsen-chores.ts). Dazu das Hau-ruck am Höhlentor: Tok
// (aus dem Paket der Bahn) und die Figur schieben den Rollstein in drei Stößen in seine Nische (`rules.ritual`,
// mitwachsen-heave.ts; Bild und Ton in mitwachsen-heave-look.ts). Das Spiel holt dieses Paket, sobald die Figur dem
// Höhlentor nah ist oder vor einem Halt des Zugs steht (`needsPack`, `preloadOf`); der Entwickler-Schalter holt es auch
// so (`/?entwickler=hoehle`, mit der Bahn auch `?entwickler=bahn`, mitwachsen-dev.ts). Nichts außerhalb dieses Ordners importiert statisch von hier
// (geprüft durch `npm run arch`): im Build `_astro/welt-hoehle.<hash>.js` (Name aus astro.config.mjs), gemessen mit
// eigener Grenze (scripts/verify-bundles.ts). Sein 3D-Teil (view-3d.ts) kommt erst, wenn die 3D-Ansicht ihn will
// (`view3d`): `_astro/welt-hoehle-3d.<hash>.js`, ebenfalls mit eigener Grenze.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Welt-Pakete“ und „Die Kristallgrotte“)

import type { GuideRules } from '../../mitwachsen-guide';
import type { HeraldRules } from '../../mitwachsen-herald';
import type { WorldPack } from '../../mitwachsen-pack-types';
import type { RideEngine, Vehicle } from '../../mitwachsen-rider';
import type { Sight } from '../../mitwachsen-sight';
import type { View2D } from '../../mitwachsen-view';
import type { View3D } from '../../mitwachsen-view-3d';
import { buildGrotte, placeGrotte } from './mitwachsen-grotte';
import { rules } from './mitwachsen-cave-rules';
import { HEAVE } from './mitwachsen-heave';
import { SIGHTS } from './mitwachsen-sights';
import { view } from './view-2d';
import { CAVE_MODELS } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-models';
import { CAVE_FINE_MODELS, CAVE_FINE_ROOST } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-fine';

export const pack: WorldPack<GuideRules, View2D, View3D, RideEngine, HeraldRules, Vehicle, Sight> = {
  id: 'hoehle',
  gate: 'hoehle',
  build: buildGrotte,
  place: placeGrotte,
  rules: { ...rules, ritual: HEAVE }, // Säulen-Glockenspiel, Grottenolm am Steg, Netze der Tupfspinnen, Kristall-Laterne; Hau-ruck am Höhlentor
  sights: SIGHTS, // Laterne, Säulen-Glockenspiel, Netze und Steg locken, bis sie gefunden sind
  view,
  view3d: () => import('./view-3d').then((m) => m.view3d),
  models: CAVE_FINE_MODELS, // fein (Fell, Lack, Krallen …), mitwachsen-cave-fine.ts
  roosts: { fledermaus: CAVE_FINE_ROOST }, // kopfüber im Kristallbogen
  outlines: CAVE_MODELS, // Grundform ohne Feinteile: Umriss von „Noch nicht“ bleibt
};
