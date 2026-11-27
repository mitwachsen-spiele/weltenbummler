// Paket der Grubenbahn: einziger Einstieg (`import('./worlds/grube')`). Das Grubenbähnchen Funkel ist das zweite
// Fahrzeug der Höhlenwelt (Ausnahme „ein zweites Fahrzeug nur innerhalb einer Welt“): Es fährt eine Schleife in der
// Kristallgrotte und verlässt sie nie. Das Paket hat keine eigene Welt; es legt sein schmales Gleis in die Schleife, die
// die Grotte freihält (`lay`, mitwachsen-funkel.ts; erst, wenn der Gang gegraben ist, `packs.fahrt.grube`; vorher baut
// sein Ankommen die Welt nicht neu, `lays`), und bringt
// das Bähnchen für die Fahr-Engine (`rules.vehicle`; die Fahrregeln bringt das Paket der Fahrzeuge, worlds/fahrt/), dazu
// sein Bild und seine Töne für 2D und 3D (mitwachsen-funkel-look.ts; Modell in
// src/data/games/worlds/grube/mitwachsen-funkel-model.ts), dazu den Glitzergang mit seinen zwei Klingeltoren (Schritt 16:
// mitwachsen-gang.ts, rein; Bild und Ton in mitwachsen-gang-look.ts, Modelle in mitwachsen-gang-model.ts; zu Fuß klingt
// ein Tor über `rules.bump`, `ringGate`) und den Maulwurf, der den Gang gräbt, sobald er zu Hause wohnt und die Figur am
// Grubenhalt steht (Schritt 17, ohne Wartezeit seit Issue 14: `rules.herald` aus mitwachsen-dig.ts, rein; Erdwelle und Töne in mitwachsen-dig-look.ts,
// Modell und Zeitplan in mitwachsen-dig-model.ts; mit dem Gang kommt der Klangstein `grube` am Halt). Ein 3D-Teil mit
// Three.js ist nicht nötig: Gleis und Körper
// sind Quader wie in 2D, darum kommt `view3d` aus derselben Datei. Geladen wird es mit der Grotte (`ALONG` in
// mitwachsen-packs.ts); der Entwickler-Schalter spielt den gegrabenen Gang vor (`/?entwickler=grube`,
// mitwachsen-dev.ts), mit `&graben=1` das fällige Graben. Nichts außerhalb dieses Ordners importiert statisch von hier (geprüft durch `npm run arch`): im
// Build `_astro/welt-grube.<hash>.js` mit eigener Grenze (scripts/verify-bundles.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Welt-Pakete“ und „Die Grubenbahn Funkel“)

import type { GuideRules } from '../../mitwachsen-guide';
import type { HeraldRules } from '../../mitwachsen-herald';
import type { WorldPack } from '../../mitwachsen-pack-types';
import type { RideEngine, Vehicle } from '../../mitwachsen-rider';
import type { Sight } from '../../mitwachsen-sight';
import type { View2D } from '../../mitwachsen-view';
import type { View3D } from '../../mitwachsen-view-3d';
import { DIG_RULES, DIG_SIGHT, FUNKEL_SIGHT, STONES_SIGHT } from './mitwachsen-dig';
import { digBodies, digFx } from './mitwachsen-dig-look';
import { dug, funkel, layGrube, ringGate } from './mitwachsen-funkel';
import { funkelBodies, funkelFx, grubeRails, haltBodies, lapScore } from './mitwachsen-funkel-look';
import { GangFx, gangBodies, gangDim } from './mitwachsen-gang-look';

/** Was am Glitzergang zuletzt klang (je Spielseite eins) */
const fx = new GangFx();

const view: View2D = {
  decos: {},
  ground: () => null,
  rails: grubeRails,
  bodies: (state, world, at) => [
    ...funkelBodies(state, world, at, fx.rangAt),
    ...gangBodies(state, world, at, fx),
    ...digBodies(state, world, at), // die Erdwelle, solange der Maulwurf gräbt
    ...haltBodies(state, world), // Planken und Schild am Halt
  ],
  rideFx: funkelFx,
  heraldFx: digFx, // der Maulwurf gräbt
  // zu Fuß ans Klingeltor; ein Zahlenstein gewählt: so viele Töne wie seine Zahl
  score: (e) =>
    e.type === 'chimegate'
      ? fx.ring(e.x, e.y, performance.now(), e.answer)
      : e.type === 'lapstone'
        ? lapScore(e.n)
        : undefined,
  ambient: (world, state, now) => fx.ambient(world, state, now), // Röhren beim Durchfahren, Tuten mit Echo
  dim: gangDim, // im Glitzergang wie im Tunnel
};
const view3d: View3D = { decos: {}, ground: () => null, rails: grubeRails };

export const pack: WorldPack<GuideRules, View2D, View3D, RideEngine, HeraldRules, Vehicle, Sight> = {
  id: 'grube',
  lay: layGrube,
  lays: dug, // vor dem Graben kein Neubau, wenn das Paket mit der Grotte ankommt
  rules: { bump: ringGate, vehicle: funkel, herald: DIG_RULES },
  // vor dem Graben lockt der Grubenhalt (erst dort gräbt der Maulwurf), danach Funkel bis zur ersten Fahrt, dann die Zahlensteine
  sights: [DIG_SIGHT, FUNKEL_SIGHT, STONES_SIGHT],
  view,
  view3d: () => Promise.resolve(view3d),
};
