// Paket der Bahn: einziger Einstieg (`import('./worlds/bahn')`). Die Höhlenbahn hat keine eigene Welt hinter einem Tor;
// sie legt ihr Gleis in die gebauten Welten (`lay`, erst ab Ausbau 1, mitwachsen-built.ts): auf der Lichtung von
// Bahnhof Bär durch Tunnelportal und Einschnitt bis an den Prellbock vor dem Höhlentor, mit der Grotte durch Tür und
// Gang weiter bis zum Bahnhof Fledermaus (mitwachsen-line.ts, Trassen-Suche in mitwachsen-trace.ts), und zeichnet es
// je nach Ausbau in 2D und 3D (mitwachsen-rail-look.ts). Dazu Tok, der Bote der Höhlenwelt: Er erscheint am Bett der
// Lichtung und wartet am künftigen Bahnhof Bär (`rules.herald`, mitwachsen-tok.ts; Modell `TOK_MODEL`, Bild und Ton in
// mitwachsen-tok-look.ts, Spielstand in mitwachsen-ride-save.ts, `dawn`: am nächsten echten Spieltag wacht er auf). Läuft
// die Figur in ihn hinein, baut er Bahnhof Bär, das Gleis bis vor das Höhlentor und den Zug (Bau 1, mitwachsen-build.ts;
// Bahnhof und Zug als Körper in mitwachsen-station-look.ts, Modelle in mitwachsen-train-model.ts). Danach fährt der Zug
// (`rules.vehicle`, mitwachsen-train.ts; die Fahrregeln bringt das Paket der Fahrzeuge, worlds/fahrt/; Ton und Licht im
// Tunnel in mitwachsen-train-look.ts): die erste Fahrt bis zum Prellbock in der Bucht, dort hüpft Tok an seinen Platz
// neben der Torplatte; das Hau-ruck am Höhlentor bringt das Paket der Höhlenwelt. Bei der nächsten Fahrt danach Bau 2
// (mitwachsen-build2.ts; steigt das Kind nach dem Hau-ruck in der Bucht ein, fährt der Zug von dort direkt in die
// Höhle, `onward2`, sonst von Bahnhof Bär aus): Am Prellbock klopft Tok, der Prellbock versinkt, Bahnhof Fledermaus
// und der Lokschuppen entstehen, der Zug fährt bis in die Grotte; der Maulwurf von Toks Helm zieht als erstes
// Höhlen-Tier ein (bis dahin wohnt er nicht in der Grotte, `away`), und Tok wohnt von nun an im Lokschuppen, ohne ihn (`solos`). Mit dem Gleis setzt
// es seine Klangsteine (mitwachsen-stones.ts): am Bahnhof Bär ab Bau 1 (`bahnhof`), am Lokschuppen ab Bau 2 (`lokschuppen`).
// Schmuck mit Zug (mitwachsen-feast-look.ts): Pfeif-Gruß der Murmeltiere, die Laternenfahrt nach voller Höhlen-Leiste
// (`feast`, danach der Kristall-Wimpel), warmes Licht ab 20 min und „Gute Nacht, Bahn“ mit Nachtlicht.
// Das Spiel holt es, sobald das Eistor offen ist (`bahnWanted`); der Entwickler-Schalter spielt seine Stände vor
// (`/?entwickler=bahn`, mitwachsen-dev.ts). Nichts außerhalb dieses Ordners importiert statisch von hier
// (geprüft durch `npm run arch`): im Build `_astro/welt-bahn.<hash>.js`, sein 3D-Teil `_astro/welt-bahn-3d.<hash>.js`,
// beide mit eigener Grenze (scripts/verify-bundles.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Welt-Pakete“ und „Tok und die Bahn“)

import type { GuideRules } from '../../mitwachsen-guide';
import type { HeraldRules } from '../../mitwachsen-herald';
import type { WorldPack } from '../../mitwachsen-pack-types';
import type { RideEngine, Vehicle } from '../../mitwachsen-rider';
import type { Sight } from '../../mitwachsen-sight';
import type { View2D } from '../../mitwachsen-view';
import type { View3D } from '../../mitwachsen-view-3d';
import { TOK_MODEL, TOK_SOLO } from '../../../../data/games/worlds/bahn/mitwachsen-tok-model';
import { FIRST_MOLE } from '../../../../data/games/mitwachsen-hoehle';
import { builtOf } from './mitwachsen-built';
import { layLine } from './mitwachsen-line';
import { layStones } from './mitwachsen-stones';
import { TOK_RULES } from './mitwachsen-tok';
import { wakeRides } from '../../mitwachsen-ride-save';
import { train } from './mitwachsen-train';
import { haltSight } from '../../mitwachsen-ride-kit';
import { view } from './view-2d';

export const pack: WorldPack<GuideRules, View2D, View3D, RideEngine, HeraldRules, Vehicle, Sight> = {
  id: 'bahn',
  lay: (laid) => layStones(laid, layLine(laid)),
  rules: { bump: () => false, herald: TOK_RULES, vehicle: train },
  sights: [haltSight(train)], // der Zug am Halt lockt bis zur ersten Fahrt (solange Tok wartet, führt er)
  dawn: wakeRides,
  away: (packs) => (builtOf(packs) < 2 ? [FIRST_MOLE] : []), // er sitzt bis Bau 2 auf Toks Helm
  models: { tok: TOK_MODEL },
  solos: { tok: TOK_SOLO },
  view,
  view3d: () => import('./view-3d').then((m) => m.view3d),
};
