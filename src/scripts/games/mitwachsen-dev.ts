// Entwickler-Schalter – rein, ohne DOM: Was das Kind noch nicht erreichen kann, schon einmal ansehen („Blick hinein“).
// Er hängt nur an der Adresse der Spielseite (`/?entwickler=hoehle`), nie am Spielstand und nie am Menü: Das Kind
// findet ihn nicht. Mit ihm holt die Seite die genannten Pakete (mehrere mit Komma: `?entwickler=hoehle,bahn`), die
// Figur wacht im Bett der ersten genannten Welt auf (die Bahn hat keine: dann im Bett der Lichtung), und es wird nichts
// gespeichert, auch nicht über das Menü (`sandbox`; der Spielstand des Kindes bleibt, wie er war; nach dem Neuladen ohne
// Schalter wacht die Figur wieder dort auf, wo sie war). Die Tore bleiben zu, bis auf das Höhlentor mit der Bahn (unten):
// Hinaus geht es sonst nur durch Neuladen ohne Schalter. Er bleibt für den Blick in künftige Welten und um Stände der
// Bahn vorzuspielen, die das Kind erst nach langem Spielen erreicht. Die Bahn (`bahn`; für das Kind kommt sie nach der
// Eis-Welt und der ersten Heimfahrt mit dem Schlitten) holt die Grotte mit, damit das Gleis bis zum Bahnhof Fledermaus liegt, und die Fahr-Engine mit und spielt einen
// Ausbau vor (`devProgress`: `&bau=1` bis zum Prellbock in der Bucht, sonst 2, die ganze Linie; der Zug steht dann am
// Bahnhof Bär, Stufe `bereit`, die Figur kann einsteigen und fahren; bei 2 ist das Höhlentor schon offen, Stufe
// `offen`, der Maulwurf wohnt im Gehege am Höhlenbett und Tok im Lokschuppen, denn Bau 2 kommt erst nach dem Hau-ruck,
// außer mit `&vorladen=1`). Mit `&bau=1&tor=1` ist das Hau-ruck gemacht (Höhlentor offen, Stufe `offen`, Tok in der
// Bucht): Die nächste Fahrt von Bahnhof Bär spielt Bau 2. Mit `&bau=1&bucht=1` ist die erste Fahrt schon gemacht: Tok wartet
// in der Bucht (er sitzt zuerst neben dem Bett und hüpft hin, wenn die Figur aufwacht), zu Fuß zur Torplatte beginnt das
// Hau-ruck. Mit `&bau=0` spielt sie den Stand vor, in dem Tok kommt: noch nichts gebaut, Eistor offen (dafür holt sie das
// Paket der Eis-Welt mit), Eis-Leiste voll, erste Heimfahrt mit dem Schlitten gemacht; `&abend=1` macht es Abend (Tok
// kommt schlafend, `devLate`); `&vorladen=1` bringt die Grotte nicht mit: Sie kommt erst, wenn die Figur 6 Felder vor
// einem Halt steht (`RIDE_PRELOAD`), bis dahin schläft der Zug (bei Ausbau 2, dem Standard; mit `&bau=1` fährt er ohne
// sie bis zum Prellbock, sie wird nur vorgeladen). `&fest=1` (Ausbau 2) macht die Höhlen-Leiste voll und lässt die Figur im
// Höhlenbett aufwachen: Die nächste Fahrt auf die Lichtung ist die Laternenfahrt. `&eis=1` (mit `&bau=1` oder 2) holt
// die Eis-Welt mit und spielt dazu vor, was das Kind vor der Bahn schon hat (Eistor offen, Eis-Leiste voll, der
// Schlitten nach der ersten Heimfahrt), wie im echten Spielstand: Schlitten und Zug in einem Spiel. `&laterne=1` gibt der
// Figur im Höhlenbett die Kristall-Laterne in die Hand (`devLamp`): So sind die kleinen Lichtgeister gleich zu sehen.
// Die Grubenbahn (`grube`; für das Kind gräbt der Maulwurf ihren Gang erst später) holt die Grotte und die Fahr-Engine
// mit, die Figur wacht im Höhlenbett auf, und das Grubenbähnchen Funkel steht an seinem Halt (Stufe `bereit`, `withFunkel`):
// Gleis und Gang liegen, die Figur kann einsteigen und eine Runde fahren. Mit `&graben=1` ist der Gang noch Fels, der
// erste Maulwurf wohnt zu Hause und das Graben ist fällig (`withDig`; im Spiel ist es das, sobald er eingezogen ist):
// Geht die Figur zum Grubenhalt, gräbt er ihn.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitte „Die Kristallgrotte“, Entwickler-Schalter, und „Tok und die Bahn“)

import { REGIONS, animalId, type RegionId } from '../../data/games/mitwachsen';
import { FIRST_MOLE } from '../../data/games/mitwachsen-hoehle';
import type { PackId } from './mitwachsen-pack-types';
import type { Store } from './mitwachsen-save';
import type { Progress } from './mitwachsen-state';

/** Name des Schalters in der Adresse */
export const DEV_PARAM = 'entwickler';
/** Ausbau des Gleises, den der Schalter für die Bahn vorspielt (`&bau=0` oder `&bau=1`, sonst 2) */
export const DEV_BUILT = 'bau';
/** Abend vorspielen (`&abend=1`): Die Regeln sehen die Uhr des Kinds bei `BED_AT` (Tok kommt schlafend) */
export const DEV_EVENING = 'abend';
/**
 * Vorladen vorspielen (`&vorladen=1`): Die Bahn bringt die Grotte nicht mit, sie kommt erst, wenn die Figur 6 Felder vor
 * einem Halt steht (`RIDE_PRELOAD`); bis dahin schläft der Zug am Bahnhof (ab Ausbau 2)
 */
export const DEV_PRELOAD = 'vorladen';
/** Erste Fahrt schon gemacht vorspielen (`&bucht=1`, mit `&bau=1`): Tok wartet in der Bucht vor dem Höhlentor */
export const DEV_BAY = 'bucht';
/**
 * Hau-ruck schon gemacht vorspielen (`&tor=1`, mit `&bau=1`): Höhlentor offen, Stufe `offen`, Tok wartet in der Bucht;
 * die nächste Fahrt von Bahnhof Bär spielt Bau 2
 */
export const DEV_OPEN = 'tor';
/**
 * Laternenfahrt vorspielen (`&fest=1`, mit Ausbau 2): von jeder Höhlen-Art wohnt ein Tier am Höhlenbett (die
 * Höhlen-Leiste ist voll), die Figur wacht im Höhlenbett auf; die nächste Fahrt von Bahnhof Fledermaus auf die Lichtung
 * ist die Laternenfahrt
 */
export const DEV_FEAST = 'fest';
/**
 * Eis-Welt dazu vorspielen (`&eis=1`, mit `&bau=1` oder 2): Das Paket der Eis-Welt kommt mit, Eistor offen, Eis-Leiste
 * voll, der Schlitten hat seine erste Heimfahrt gemacht (Stufe `fest`) – wie bei `&bau=0`, nur mit gebauter Bahn
 */
export const DEV_ICE = 'eis';
/**
 * Kristall-Laterne in der Hand vorspielen (`&laterne=1`, mit dem Höhlenbett, etwa `?entwickler=hoehle&laterne=1`): Die
 * Figur wacht mit ihr auf, so sind die kleinen Lichtgeister in der Kristallhalle gleich zu sehen
 */
export const DEV_LAMP = 'laterne';
/**
 * Das Graben vorspielen (`&graben=1`, mit `?entwickler=grube`): Der Gang ist noch Fels, der erste Maulwurf wohnt am
 * Höhlenbett, das Graben ist fällig (Stufe `faellig`); kommt die Figur zum Grubenhalt, gräbt er den Glitzergang
 */
export const DEV_DIG = 'graben';
/** Pakete, die ein Paket im Blick hinein mitbringt: die Bahn die Grotte (dort endet ihr Gleis) und die Fahr-Engine (der Zug fährt) */
const WITH: Partial<Record<PackId, readonly PackId[]>> = { bahn: ['hoehle', 'fahrt'], grube: ['hoehle', 'fahrt'] };
/** Bett, in dem die Figur mit diesem Paket aufwacht: die Grubenbahn im Höhlenbett, die Pakete ohne Welt in keinem eigenen */
const BED: Partial<Record<PackId, RegionId | null>> = { bahn: null, fahrt: null, grube: 'hoehle' };

/** Was der Entwickler-Schalter will: welche Pakete er holt (leer: kein Schalter) und in welchem Bett die Figur aufwacht */
export type Glimpse = { packs: PackId[]; home: RegionId | null };

/** Ausbau, den der Schalter der Bahn vorspielt: 0 oder 1 aus `&bau=`, sonst 2 */
const builtIn = (search: string): 0 | 1 | 2 => {
  const b = new URLSearchParams(search).get(DEV_BUILT);
  return b === '0' ? 0 : b === '1' ? 1 : 2;
};

/**
 * Pakete, in die der Entwickler-Schalter blicken lässt (`?entwickler=<welt>[,<welt>…]` in `search`, der Adresse ab
 * „?“), soweit es sie gibt (`ids`), in der genannten Reihe, dazu was sie mitbringen (`WITH`; die Bahn mit `&bau=0`
 * auch die Eis-Welt, deren Tor dann offen ist, ebenso mit `&eis=1`; mit `&vorladen=1` ohne die Grotte, die holt dann das Vorladen am Halt);
 * `home`: die erste genannte Welt mit Bett (die Grubenbahn: das Höhlenbett), mit der Bahn allein die
 * Lichtung (mit `&fest=1` bei Ausbau 2 ohne `&vorladen=1` das Höhlenbett; null: kein Schalter). Kein Schalter oder nichts Bekanntes: keine Pakete
 */
export function glimpse(search: string, ids: readonly PackId[]): Glimpse {
  const named = (new URLSearchParams(search).get(DEV_PARAM) ?? '').split(',');
  const own = ids.filter((id) => named.includes(id)).sort((a, b) => named.indexOf(a) - named.indexOf(b));
  const ice = builtIn(search) === 0 || new URLSearchParams(search).get(DEV_ICE) === '1';
  const tok: PackId[] = own.includes('bahn') && ice ? ['eis'] : [];
  // mit `&vorladen=1` kommt die Grotte erst am Halt (außer, sie ist selbst genannt)
  const later = new URLSearchParams(search).get(DEV_PRELOAD) === '1' && !own.includes('hoehle');
  const brought = own.flatMap((id) => WITH[id] ?? []).filter((id) => !(later && id === 'hoehle'));
  const packs = [...new Set([...own, ...brought, ...tok])].filter((id) => ids.includes(id));
  // Laternenfahrt vorspielen nur, wo `devProgress` es tut (Ausbau 2, Tor offen, also nicht mit `&vorladen=1`)
  const q = new URLSearchParams(search);
  const feasting = own.includes('bahn') && q.get(DEV_FEAST) === '1' && builtIn(search) === 2;
  const feast = feasting && q.get(DEV_PRELOAD) !== '1' ? 'hoehle' : null;
  const beds = own.map((id) => (id in BED ? (BED[id] ?? null) : (id as RegionId)));
  const home = beds.find((r) => r !== null) ?? feast ?? (own.length ? 'lichtung' : null);
  return { packs, home };
}

/**
 * Was der Schalter dem Spielstand vorspielt (nur im Arbeitsspeicher, `sandbox`): mit der Grubenbahn Funkel an seinem
 * Halt (`withFunkel`), mit `&graben=1` statt dessen das fällige Graben (`withDig`); mit der Bahn ihren Ausbau
 * (`packs.bahn.built`, aus `&bau=`: 0, 1 oder 2, sonst 2), ab 1 den Zug am Bahnhof (`packs.fahrt.hoehle`, Stufe
 * `bereit`, wenn dort noch nichts steht; mit `&bucht=1` die erste Fahrt gemacht, `gefahren`); bei 2 dazu das offene
 * Höhlentor (Stufe `offen`: Bau 2 kommt erst nach dem Hau-ruck; nicht mit `&vorladen=1`, sonst käme die Grotte schon
 * mit dem offenen Tor) und den ersten Maulwurf im Gehege am Höhlenbett (er zieht mit Bau 2 ein); bei 1 mit `&tor=1` das
 * offene Höhlentor (Stufe `offen`, das Hau-ruck ist gemacht: Die nächste Fahrt spielt Bau 2); bei 2 mit `&fest=1` die
 * volle Höhlen-Leiste (Laternenfahrt); bei 0 dazu den Stand, in dem Tok kommt: Eistor offen,
 * von jeder Eis-Art ein Tier auf der Schneewiese (die Eis-Leiste voll) und die erste Heimfahrt mit dem Schlitten gemacht
 * (`packs.fahrt.schlitten`, Stufe `fest`); diesen Stand der Eis-Welt bei 1 und 2 auch mit `&eis=1`. Ohne Bahn bleibt
 * der Spielstand, wie er ist
 */
export function devProgress(dev: readonly PackId[], search: string, given: Progress): Progress {
  const digging = new URLSearchParams(search).get(DEV_DIG) === '1';
  const p = dev.includes('grube') ? (digging ? withDig(given) : withFunkel(given)) : given;
  if (!dev.includes('bahn')) return p;
  const built = builtIn(search);
  const packs = { ...p.packs, bahn: { built } };
  const fahrt = typeof p.packs.fahrt === 'object' && p.packs.fahrt !== null ? p.packs.fahrt : {};
  // gebaut: Der Zug steht da (Stufe `bereit`, wie nach Bau 1), wenn der Spielstand nicht schon weiter ist
  const was = (fahrt as { hoehle?: { stage?: unknown; gefahren?: unknown } }).hoehle;
  // Ausbau 2 mit offenem Höhlentor; nur `&vorladen=1` lässt es zu, damit die Grotte nicht schon mit dem Tor kommt;
  // Ausbau 1 mit `&tor=1`: das Hau-ruck ist gemacht, Bau 2 kommt mit der nächsten Fahrt
  const q = new URLSearchParams(search);
  const opened = (built === 2 && q.get(DEV_PRELOAD) !== '1') || (built === 1 && q.get(DEV_OPEN) === '1');
  const train = trainOf(was, opened, q.get(DEV_BAY) === '1');
  const open = opened ? [...new Set([...p.openGates, 'hoehle' as const])] : p.openGates;
  const feast = built === 2 && opened && q.get(DEV_FEAST) === '1';
  const garden = built === 2 && opened ? (feast ? withCave(p.garden) : withMole(p.garden)) : p.garden;
  if (!built) return withIce({ ...p, packs: { ...packs, fahrt } });
  const laid = { ...p, openGates: open, garden, packs: { ...packs, fahrt: { ...fahrt, hoehle: train } } };
  return q.get(DEV_ICE) === '1' ? withIce(laid) : laid;
}

/**
 * Mit der Grubenbahn: Funkel steht an seinem Halt in der Grotte (`packs.fahrt.grube`, Stufe `bereit`, sein Gang ist
 * gegraben), außer der Spielstand ist schon weiter; ob er schon gefahren ist (`gefahren`), bleibt
 */
function withFunkel(p: Progress): Progress {
  const fahrt = typeof p.packs.fahrt === 'object' && p.packs.fahrt !== null ? p.packs.fahrt : {};
  const was = (fahrt as { grube?: { stage?: unknown; gefahren?: unknown } }).grube;
  const stage = was?.stage === 'offen' || was?.stage === 'fest' ? was.stage : 'bereit';
  const grube = { stage, ...(was?.gefahren === true && { gefahren: true }) };
  return { ...p, packs: { ...p.packs, fahrt: { ...fahrt, grube } } };
}

/**
 * Mit der Grubenbahn und `&graben=1`: Der erste Maulwurf wohnt zu Hause, das Graben ist fällig (`packs.fahrt.grube`,
 * Stufe `faellig`; im Spiel reicht dafür sein Einzug, ohne Eintrag); der Gang ist noch Fels
 */
function withDig(p: Progress): Progress {
  const fahrt = typeof p.packs.fahrt === 'object' && p.packs.fahrt !== null ? p.packs.fahrt : {};
  const met = p.met.includes(FIRST_MOLE) ? p.met : [...p.met, FIRST_MOLE]; // er ist schon gefunden (kein Fragezeichen)
  return {
    ...p,
    met,
    garden: withMole(p.garden),
    packs: { ...p.packs, fahrt: { ...fahrt, grube: { stage: 'faellig' } } },
  };
}

/**
 * Der Stand der Eis-Welt, den das Kind vor der Bahn erreicht: Eistor offen, von jeder Eis-Art ein Tier auf der
 * Schneewiese (die Eis-Leiste voll), die erste Heimfahrt mit dem Schlitten gemacht (`packs.fahrt.schlitten`, Stufe `fest`)
 */
function withIce(p: Progress): Progress {
  const eis = REGIONS.find((r) => r.id === 'eis')?.animals ?? [];
  const home = new Set(p.garden.map((a) => a.id));
  const fahrt = typeof p.packs.fahrt === 'object' && p.packs.fahrt !== null ? p.packs.fahrt : {};
  return {
    ...p,
    openGates: [...new Set([...p.openGates, 'eis' as const])],
    garden: [
      ...p.garden,
      ...eis.map(({ species }) => ({ id: animalId('eis', species), species })).filter((a) => !home.has(a.id)),
    ],
    packs: { ...p.packs, fahrt: { ...fahrt, schlitten: { stage: 'fest' } } },
  };
}

/**
 * Eintrag des Zugs im Blick hinein: Stufe `offen` mit offenem Höhlentor, sonst `bereit` (wie nach Bau 1), außer der
 * Spielstand ist schon weiter; `bay`: die erste Fahrt ist gemacht (`gefahren`)
 */
function trainOf(was: { stage?: unknown; gefahren?: unknown } | undefined, opened: boolean, bay: boolean) {
  const stage = was?.stage === 'offen' || was?.stage === 'fest' ? was.stage : opened ? 'offen' : 'bereit';
  const ridden = stage === 'bereit' && (bay || was?.gefahren === true);
  return { stage, ...(ridden && { gefahren: true }) };
}

/** Laternenfahrt vorspielen: von jeder Höhlen-Art wohnt ein Tier am Höhlenbett (samt dem ersten Maulwurf) */
function withCave(garden: Progress['garden']): Progress['garden'] {
  const cave = REGIONS.find((r) => r.id === 'hoehle')?.animals ?? [];
  const home = new Set(garden.map((a) => a.id));
  const more = cave.map(({ species }) => ({ id: animalId('hoehle', species), species })).filter((a) => !home.has(a.id));
  return [...garden, ...more];
}

/** Nach Bau 2 wohnt der erste Maulwurf im Gehege am Höhlenbett (er zog mit Tok ein); schon da: dieselbe Liste */
const withMole = (garden: Progress['garden']): Progress['garden'] =>
  garden.some((a) => a.id === FIRST_MOLE) ? garden : [...garden, { id: FIRST_MOLE, species: 'maulwurf' }];

/** Spielt der Schalter Abend vor (`&abend=1`)? Nur zusammen mit einem Blick hinein (`dev`) */
export const devLate = (dev: readonly PackId[], search: string): boolean =>
  dev.length > 0 && new URLSearchParams(search).get(DEV_EVENING) === '1';

/**
 * Laterne, die der Schalter der Figur in die Hand gibt (`&laterne=1`): die der Grotte, wenn sie im Höhlenbett aufwacht
 * (`home`), sonst keine
 */
export const devLamp = (home: RegionId | null, search: string): RegionId | undefined =>
  home === 'hoehle' && new URLSearchParams(search).get(DEV_LAMP) === '1' ? 'hoehle' : undefined;

/**
 * Speicher für den Entwickler-Schalter: liest den Spielstand des Kindes, schreibt aber nur in den Arbeitsspeicher. So
 * ändert nichts, was im Blick hinein geschieht (Speichern, Menü: neue Welt, Welt löschen, Ton, Elternschalter), den
 * Spielstand im `localStorage`; nach dem Neuladen ist alles vergessen
 */
export function sandbox(store: Store): Store {
  const own = new Map<string, string | null>(); // null: hier gelöscht
  return {
    getItem: (k) => (own.has(k) ? own.get(k)! : store.getItem(k)),
    setItem: (k, v) => void own.set(k, String(v)),
    removeItem: (k) => void own.set(k, null),
  };
}
