// Welt-Pakete – nur Typen: Was eine Welt hinter einem Tor dem Kern liefert. Der Kern (Spielseite, sofort geladen) kennt
// Regeln, Eingabe, Lichtung und Tiere; alles, was nur eine Welt braucht (Gelände, Wohnorte, Regeln ihres Schlüssels),
// steckt in ihrem Paket unter src/scripts/games/worlds/<welt>/ und kommt per import() (einziger Einstieg: index.ts).
// Fehlt ein Paket (noch nicht nötig oder Laden gescheitert), baut die Welt hinter dem Gang seines Tors eine Klippe;
// das Spiel läuft ohne. Wann es nötig ist, entscheidet mitwachsen-pack.ts (`needsPack`).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import type { Dir, Part } from '../../lib/games/front';
import type { GateId, Point, RegionId, SpeciesId } from '../../data/games/mitwachsen';
import type { RideId } from '../../data/games/mitwachsen-rides';
import type { StoryId } from '../../data/games/mitwachsen-stories';
import type { Cell } from './mitwachsen-cell';
import type { Portal, PortalId } from './mitwachsen-portal';

/**
 * Kennung eines Welt-Pakets: die Gegend hinter einem Tor, deren Welt es baut (Eis-Welt, Höhlenwelt), oder ein Paket, das
 * keine eigene Welt hat: `'bahn'` legt etwas in die gebauten Welten (das Gleis der Höhlenbahn auf Lichtung und Grotte,
 * `WorldPack.lay`), `'fahrt'` bringt nur Regeln (die Fahr-Engine aller Fahrzeuge, `WorldRules.ride`), `'grube'` legt
 * das Gleis des Grubenbähnchens Funkel in die Grotte und bringt das Bähnchen (`WorldRules.vehicle`). Unter ihr steht
 * auch sein Zustand in `State.packs` (`packs.fahrt`: der Spielstand der Fahrzeuge); je Kennung ein Lader in
 * mitwachsen-packs.ts
 */
export type PackId = Exclude<RegionId, 'lichtung'> | 'bahn' | 'fahrt' | 'grube';

/** Gang hinter einem Tor, in Koordinaten u (entlang des Tors) und t (nach außen) */
export type Gang = {
  at: (u: number, t: number) => Point;
  depth: number; // t der Torreihe
  end: number; // letzte Reihe des Gangs durch den Felsring
  half: number; // Boden des Gangs: u von −half bis half
  wall: number; // daneben auf jeder Seite so viele Felder Wand
};

/** Lage einer Welt hinter ihrem Gang: ihr Bett und alle Felder samt Klippen (wo ihre Mitte liegt, weiß nur ihr Paket) */
export type KesselPlace = { bed: Point; cells: readonly Point[] };

/**
 * Eine gebaute Welt: Bett, ihre Felder (`realm`, als "x,y"), Wohnplätze und Wohnorte ihrer Tiere, Klangstein und
 * Portal (als Eintrag für `world.portals`)
 */
export type Kessel = {
  bed: Point;
  realm: ReadonlySet<string>;
  spots: readonly Point[];
  spawns: ReadonlyMap<string, Point>;
  stone: Point;
  /** weitere Klangsteine dieser Welt mit eigener Geschichte (Grotte: `lichtgeister` in der Kristallhalle) */
  more?: readonly [StoryId, Point][];
  portal: [PortalId, Portal];
};

/**
 * Ereignis aus den Regeln einer Welt (Eis-Welt: ein Schneehaufen wächst um eine Kugel, Stufe 1 bis 3; ein Eiszapfen
 * des Glockenspiels klingt mit seiner Tonhöhe `note`, 0 tief. Höhlenwelt: eine Kristallsäule des Säulen-Glockenspiels
 * klingt mit ihrem Ton `note`, 0 = C5, `perch`: Sitzplatz im Kristallbogen nahe der Säule, an dem gerade eine Fledermaus
 * hängt (die verschlafene Fledermaus, die nach je vier Tönen eine Runde dreht), keiner: fehlt; der Grottenolm taucht am
 * Ende des Stegs auf (x, y: die Planke); die Figur läuft gegen das Netz einer Tupfspinne (x, y: das Netz); die Figur nimmt die Kristall-Laterne von ihrem Sockel (x, y: der Sockel);
 * Hau-ruck am Höhlentor: das Hau-ruck beginnt (`n` 0) bzw. ein Stoß rollt den Stein (`n` 1 bis 3; x, y: Mitte der Tür;
 * `who`: Tok, er lehnt sich mit an den Stein); Grubenbahn: die Figur läuft gegen ein Klingeltor des Glitzergangs (x, y: das
 * Tor; es spielt drei Töne, Funkel am Halt antwortet, `answer`: nur, wenn er nicht schläft))
 */
export type PackEvent =
  | { type: 'snowman'; x: number; y: number; stage: number }
  | { type: 'icicle'; x: number; y: number; note: number }
  | { type: 'column'; x: number; y: number; note: number; perch?: Point }
  | { type: 'olm'; x: number; y: number }
  | { type: 'web'; x: number; y: number }
  | { type: 'chimegate'; x: number; y: number; answer: boolean }
  | { type: 'lantern'; x: number; y: number }
  | { type: 'heave'; x: number; y: number; n: number; who?: string }
  | { type: 'lapstone'; x: number; y: number; n: number } // Zahlenstein an einer Rundfahrt gewählt: so viele Runden (Issue 48)
  | { type: 'numflag'; x: number; y: number; n: number } // Zahlen-Fähnchen der Eis-Welt bimmelt (Issue 52)
  | { type: 'treelamp'; x: number; y: number } // Laternen-Tanne der Eis-Welt angezündet (bleibt an, gleich gespeichert)
  | { type: 'caveshroom'; x: number; y: number } // schlafender Leuchtpilz der Grotte geweckt (bleibt an, gleich gespeichert; Issue 56)
  | { type: 'cavetower'; x: number; y: number; stage: number } // Kristalltürmchen um eine Stufe gewachsen (gleich gespeichert)
  | { type: 'numstone'; x: number; y: number; n: number } // Zahlen-Kristall der Grotte klingt
  | { type: 'echo'; x: number; y: number }; // Echo-Wand der Grotte antwortet

/**
 * Was die Regeln einer Welt vom Zustand sehen und ändern dürfen: den gespeicherten Zustand der Welt-Pakete (`packs`, je
 * Paket unter seiner Kennung in seinem eigenen Format; der Kern trägt ihn nur und speichert ihn mit), Figur und Tiere,
 * Takt und Beginn des Rituals am Eistor (`ritual`, mitwachsen-guide.ts), die Laterne in der Hand (`lamp`, nicht gespeichert)
 */
export type Ruled = {
  packs: Record<string, unknown>;
  tick: number;
  ritual: number;
  player: { x: number; y: number };
  animals: { species: SpeciesId; x: number; y: number; dir: Dir; mode: string; rest: number }[];
  lamp?: RegionId; // die Figur trägt die Laterne dieser Gegend (Grotte: Kristall-Laterne; der Kern legt sie zurück)
  dozing?: readonly string[]; // Fahrzeuge, die am Halt schlafen (`State.dozing`, nur lesen)
  laps?: Partial<Record<string, number>>; // gewählte Runden je Rundfahrt (`State.laps`, nicht gespeichert)
};

/**
 * Eine Fahrt mit einem Fahrzeug (nicht gespeichert; Regeln im Paket der Fahrzeuge, worlds/fahrt/mitwachsen-ride.ts): `phase`
 * eingestiegen (`seated`, gleich geht es los), unterwegs (`go`), hält vor einem Hindernis (`stop`), angekommen (`arrive`,
 * gleich steigt die Figur aus); `at` Takt, an dem die Phase begann; `pos` Fortschritt auf der Strecke in Feldern,
 * `speed` Felder je Takt; `to` Halt, zu dem es fährt: sein Zuhause in der Welt (`home`) oder der Halt auf der
 * Lichtung (`out`; für das Kind die Heimfahrt); `feast` die Festfahrt (erste Heimfahrt);
 * `jingleAt` Takt des letzten Bimmelns; `greeted` Tiere, die auf der Festfahrt schon gewinkt haben; `stopover` ein Halt
 * unterwegs, den das Paket des Fahrzeugs beim Abfahren ansagt (`Vehicle.depart`, `Vehicle.hold`): steht noch aus
 * (`ahead`) oder ist gemacht (`done`; der Zug bei Bau 2: Tok versenkt den Prellbock und fährt dann im hinteren Wagen mit);
 * `from` beginnt die Fahrt mitten auf der Strecke (`Vehicle.onward`, der Zug aus der Bucht in die Höhle): an welchem
 * Halt eingestiegen wurde (`end`, sonst immer der Halt gegenüber von `to`) und bei welchem Fortschritt (`pos`)
 */
export type Ride = {
  id: RideId;
  phase: 'seated' | 'go' | 'stop' | 'arrive';
  at: number;
  pos: number;
  speed: number;
  to: 'home' | 'out';
  feast: boolean;
  jingleAt: number;
  greeted: string[];
  stopover?: 'ahead' | 'done';
  from?: { end: 'home' | 'out'; pos: number };
  laps?: number; // Rundfahrt: so viele Runden kommen noch, die laufende mitgezählt (fehlt: eine)
};

/**
 * Ereignis eines Fahrzeugs (ein Typ, Unterart `what`): erscheint (`appear`, mit `persist` gespeichert), trabt herbei
 * (`come`), schnaubt (`snort`), stößt sanft an (`nudge`), Figur steigt ein (`board`) oder gleich wieder aus (`leave`),
 * fährt los (`go`), Figur winkt im Sitz (`wave`), hält vor einem Hindernis (`stop`), Tier hüpft beiseite (`shoo`, `who`),
 * kommt an (`arrive`), Figur steigt aus (`alight`), Fest nach der ersten Heimfahrt (`feast`, gespeichert), ein Tier
 * winkt am Weg (`cheer`, `who`), der Pinguin winkt zum Abschied (`farewell`), gleich kommt ein Tunnel (`tunnel`:
 * „Uh-uh“), ein Gast steigt nach der Fahrt aus und geht an seinen Platz (`guest`, `who`: Tok an seinem Platz neben der
 * Torplatte). `from`: Feld, von dem es herbeitrabt (`appear`); `ring`: das Fahrzeug bimmelt bzw. tutet dazu (`wave`,
 * höchstens alle 1,5 s)
 */
export type RideEvent = {
  type: 'ride';
  what:
    | 'appear'
    | 'come'
    | 'snort'
    | 'nudge'
    | 'board'
    | 'leave'
    | 'go'
    | 'wave'
    | 'stop'
    | 'shoo'
    | 'arrive'
    | 'alight'
    | 'feast'
    | 'cheer'
    | 'farewell'
    | 'tunnel'
    | 'guest'
    | 'snore'
    | 'lap'; // Rundfahrt: eine Runde ist um, es geht ohne Halt in die nächste
  id: RideId;
  x: number;
  y: number;
  who?: string;
  from?: Point;
  ring?: true;
  persist?: true;
};

/**
 * Regeln einer Welt aus ihrem Paket (Eis-Welt: Schneemänner bauen, Glockenspiel). `step` bekommt sie hereingereicht,
 * sobald das Paket da ist. `bump`: Die Figur läuft in das Feld (x, y) mit dem Inhalt `c`; `move` sagt, auf welchem
 * Feld sie steht (`here`), ob der Schritt ginge (`walks`) und was auf anderen Feldern ist (`cell`). true, wenn der Zug damit erledigt ist (sie bleibt stehen),
 * sonst geht es weiter wie immer (auch nach einem Ereignis, etwa dem Ton eines Eiszapfens). `ride`: die Fahr-Engine
 * aller Fahrzeuge (Paket der Fahrzeuge; `RideEngine` in mitwachsen-rider.ts, hier nur als Parameter, weil die Welt diese
 * Datei kennt). `vehicle`: das Fahrzeug einer Welt (Eis-Welt: der Schlitten, Bahn: der Zug; `Vehicle`, ebenso). `herald`:
 * Regeln des Boten einer Welt (Paket der Bahn: Tok; `HeraldRules` in mitwachsen-herald.ts, ebenso nur als Parameter).
 * `ritual`: das Ritual am Tor dieser Welt, das ihr Bote aufschließt, in derselben Form (Höhlenwelt: Hau-ruck mit Tok,
 * worlds/hoehle/mitwachsen-heave.ts; Tok selbst kommt aus dem Paket der Bahn).
 */
export type WorldRules<Ride = never, Herald = never, Vehicle = never> = {
  bump(
    s: Ruled,
    c: Cell,
    x: number,
    y: number,
    events: { push(e: PackEvent | { type: 'hop' }): unknown }, // `hop`: Die Figur hüpft nur (Eistor im Vorspiel)
    move: { here: Cell; walks: boolean; cell: (x: number, y: number) => Cell },
  ): boolean;
  ride?: Ride;
  herald?: Herald;
  ritual?: Herald;
  vehicle?: Vehicle;
  more?: readonly Vehicle[]; // weitere Fahrzeuge derselben Welt (Eis-Welt: der Rodelreifen neben dem Schlitten)
};

/** Liegt ein Feld ganz hinter dem Felsring der Lichtung? */
export type Beyond = (x: number, y: number) => boolean;

/** Ein großes Tor, wie es `lay` sieht: Kennung, Felder der Tür, ihre Mitte, nach außen (`GatePlace` in mitwachsen-world.ts) */
export type Door = { id: GateId; cells: readonly Point[]; mid: Point; out: Point };

/**
 * Was `lay` von der gebauten Welt bekommt: die Karte der festen Felder (Lichtung, Gänge, Welten aus Paketen; `lay`
 * ändert sie), die Tore und je Gegend mit Zuhause ihr Bett und die Felder, auf denen die Figur dort aufwacht; dazu der
 * Spielstand der Pakete (`State.packs`), mit dem die Welt gebaut wird: Was ein Paket legt, darf nur davon abhängen
 * (die Bahn legt ihr Gleis erst ab Ausbau 1, vorher bleibt die Lichtung, wie sie ist)
 */
export type Laid = {
  seed: number;
  map: Map<string, Cell>;
  gates: ReadonlyMap<GateId, Door>;
  beds: ReadonlyMap<RegionId, { bed: Point; wake: readonly Point[] }>;
  packs: Readonly<Record<string, unknown>>;
};

/**
 * Ein Welt-Paket. `build` baut die Welt hinter seinem Tor `gate` in die Karte der festen Felder (`map`, dort liegt schon
 * der Gang durch den Felsring; `passage` liefert ein Feld des Gangs), `place` sagt nur, wo sie läge; beides hat nur ein
 * Paket mit eigener Welt. `lay`: Ein Paket ohne eigene Welt (die Bahn) legt etwas in die fertig gebaute Karte (das Gleis
 * auf Lichtung und Grotte), nachdem alle Welten stehen und bevor die Lichtung ihre unerreichbaren Ecken zu Fels macht; es
 * liefert die Klangsteine, die es dabei gesetzt hat (Bahn: am Bahnhof Bär und am Lokschuppen), sie kommen zu
 * `World.stones`. `lead`: Regeln, die das Paket der
 * Ansicht mitbringt (Eis-Welt: der verlaufene Pinguin führt zum Tor und öffnet es, `GuideRules`). `view`: ihre
 * Zeichenteile für die Ansicht (Eis-Welt: `View2D` aus mitwachsen-view.ts, Wetter und Bild der Weltgrenze). `view3d`:
 * lädt ihren 3D-Teil nach (`View3D` aus mitwachsen-view-3d.ts; braucht Three.js, darum ein eigener `import()`, erst wenn
 * die 3D-Ansicht da ist). `models`: Modelle der Tiere dieser Welt (`addModels`), `roosts` ihre Ruhehaltungen (Höhlenwelt:
 * die Fledermaus kopfüber, `Species.roost`). `rules`: Regeln, die nur in dieser
 * Welt gelten (Eis-Welt: Schneehaufen wachsen zu Schneemännern, `vehicle`: der Schlitten; Bahn: `herald`, Tok, und
 * `vehicle`, der Zug; Fahrzeuge: `ride`, die Fahr-Engine), `step` hereingereicht.
 * `dawn`: Ein neuer echter Spieltag beginnt (mehr als `BREAK` Pause, mitwachsen-tired.ts): neuer Zustand der Pakete (Bahn:
 * Tok, der am Abend schlafend kam, wacht auf); die Spielseite fragt es beim Start und nach langer Pause.
 * `away`: Tiere, die nach dem Spielstand der Pakete gerade nicht in ihrer Welt wohnen (Bahn: der erste Maulwurf sitzt
 * bis Bau 2 auf Toks Helm); die Welt merkt sie sich (`World.away`), sie werden nicht verteilt. `solos`: Modell einer
 * Art ohne den, der auf ihr sitzt (Tok ohne den Maulwurf), für Tiere mit `solo`. `outlines`: Grundform einer Art ohne
 * ihre Feinteile (`Species.outline`, Eis-Tiere): Daraus entsteht der Umriss von „Noch nicht“.
 */
export type WorldPack<
  Rules = unknown,
  View = unknown,
  View3 = unknown,
  Ride = unknown,
  Herald = unknown,
  Vehicle = unknown,
  Sight = unknown,
> = {
  id: PackId;
  gate?: GateId; // das Tor, hinter dem seine Welt liegt (`REGIONS`: `behind` der Gegend `id`); ohne eigene Welt keins
  build?(
    seed: number,
    gang: Gang,
    beyond: Beyond,
    passage: (x: number, y: number) => Cell,
    map: Map<string, Cell>,
  ): Kessel;
  place?(seed: number, gang: Gang, beyond: Beyond): KesselPlace;
  lay?(laid: Laid): readonly [StoryId, Point][] | void;
  /**
   * Nur für ein Paket ohne eigene Welt: Legt `lay` nach dem Spielstand `packs` überhaupt etwas (Grubenbahn: erst, wenn
   * der Gang gegraben ist)? Wenn nicht, baut `World.attach` die Welt nicht neu, merkt sich das Paket aber für `relay`.
   * Dann darf es nach diesem Spielstand auch keine Tiere fortschicken (`away`) und keine Klangsteine setzen
   */
  lays?(packs: Readonly<Record<string, unknown>>): boolean;
  lead?: Rules;
  rules?: WorldRules<Ride, Herald, Vehicle>;
  /**
   * Sehenswürdigkeiten dieses Pakets (`Sight` in mitwachsen-sight.ts): jedes Spielzeug, zu dem das Kind hingeführt wird,
   * bis es es einmal gefunden hat. Wer ein neues Spielzeug baut, trägt es hier ein (Regel in CLAUDE.md)
   */
  sights?: readonly Sight[];
  dawn?(packs: Readonly<Record<string, unknown>>): Record<string, unknown>;
  away?(packs: Readonly<Record<string, unknown>>): readonly string[];
  view?: View;
  view3d?: () => Promise<View3>;
  models?: Partial<Record<SpeciesId, readonly Part[]>>;
  roosts?: Partial<Record<SpeciesId, readonly Part[]>>;
  solos?: Partial<Record<SpeciesId, readonly Part[]>>;
  outlines?: Partial<Record<SpeciesId, readonly Part[]>>;
};
