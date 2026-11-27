// <larmic-mitwachsen>: das Spiel Mitwachsen (Stufe ab 3). Verbindet die reinen Teile (Welt, Regeln, Speichern) mit dem
// Browser: Tastatur, Takt, Kamera, Töne, Menü und Canvas. Alle Regeln stecken getestet in mitwachsen-state.ts.
// Listener auf document/window hängen an einem AbortController und verschwinden mit der Komponente; so stört das
// Spiel nach einem Seitenwechsel (View Transitions) niemanden.
// Konzept: docs/games/mitwachsen.md · Spec: docs/specs/mitwachsen.md

import type { EdgeEvent } from './mitwachsen-edge';
import { due } from './mitwachsen-waystone';
import { waystoneSparks } from './mitwachsen-waystone-look';
import { later } from '../../lib/games/later';
import { chunkOf } from '../../lib/games/chunks';
import { projection } from '../../lib/games/front';
import type { World3D as World3DType } from './mitwachsen-3d';
import { GAME_COLORS, LOOK, SPECIES, TIRED_TALK, realmOfAnimal, type GateId } from '../../data/games/mitwachsen';
import { LANTERN_SPARKS } from '../../data/games/mitwachsen-hoehle';
import { Renderer, type Body, type Float, type Particle, type Scene } from './mitwachsen-render';
import { SPARKS, fly, glints, sparks, BIRD_COLOR } from './mitwachsen-glyphs';
import { Sfx } from './sfx';
import { nightIn, tunnelNight } from './mitwachsen-dusk';
import { plateToy } from './mitwachsen-plate-toy';
import { postcard } from './mitwachsen-plate';
import { StoryPlayer } from './mitwachsen-story';
import { NOTE_COLORS } from './mitwachsen-stone-look';
import { FriendLook, SIGHT_SPARKS, sightScore } from './mitwachsen-sight-look';
import { marksOf, sightsOf } from './mitwachsen-sight';
import {
  DEFAULT_FIGURE,
  cleanName,
  deleteWorld,
  loadIndex,
  newWorld,
  progressFrom,
  saveWorld,
  withProgress,
  worldCode,
  type SavedWorld,
  type Store,
} from './mitwachsen-save';
import { FREE_KEYS, InputPace, KEYS, STEP_MS, stops } from './input-pace';
import { listenTouch } from './mitwachsen-touch';
import { drawMap } from './mitwachsen-map';
import { Fog, START_REVEAL, lookAround } from './mitwachsen-fog';
import { attachPack, initialState, progressOf, step, type Cmd, type GameEvent, type State } from './mitwachsen-state';
import { reshapes, type ChoreEvent } from './mitwachsen-chores';
import { createWorld, gatePlaces, standHeight, type World } from './mitwachsen-world';
import { unstick } from './mitwachsen-free';
import { GUIDE_GATE, pending, type GuideRules } from './mitwachsen-guide';
import { PACK_IDS, Packs, dawnOf, type LoadedPack } from './mitwachsen-packs';
import { preloadOf } from './mitwachsen-preload';
import type { Need } from './mitwachsen-pack';
import { devLamp, devLate, devProgress, glimpse, sandbox } from './mitwachsen-dev';
import { randomId, randomSeed, savedOrNew, showName } from './mitwachsen-world-list';
import { platformLift, portalColor } from './mitwachsen-portal';
import { HOME_STAGGER, SNAP_DELAY, hopOf, nibblers, snaps } from './mitwachsen-gait';
import { windAt } from './mitwachsen-weather';
import { Air, postures, stepSound } from './mitwachsen-air';
import { heldTired, restPose, type Pose } from './mitwachsen-tired';
import { advance, evening, freshDay, late, loadTired, newDay, saveTired, type Tired } from './mitwachsen-tired';
import type { TiredEvent } from './mitwachsen-tired';
import type { PackEvent } from './mitwachsen-pack-types';
import { CHORUS_MS, ownSeat, seatOf, withHop, type RideBody } from './mitwachsen-ride-view';
import { GoodNights, endsBedtime, rideLight } from './mitwachsen-bedtime';
import { awayIn, packScore } from './mitwachsen-view';
import { listenTap } from './mitwachsen-tap';
import { heraldOf } from './mitwachsen-herald';
import { SLEEP_EVENT, type GameMoment } from './pwa-update';
import { browserStore } from './browser-store';

const TICK_MS = 100; // Takt der Regeln
const SAVE_EVERY_MS = 10_000; // Position regelmäßig sichern
const SIT_MS = 2500; // so lange setzt sich die müde Figur hin (Laufen geht in der Zeit nicht)
const INFO_KEY = 'larmic.games.mitwachsen.info'; // Hinweis für Eltern schon gesehen
const SPEED = (1000 / STEP_MS) * 1.1; // Felder pro Sekunde beim Gleiten: etwas schneller als der Takt, also weich

const noop = () => {};
/** Ereignisse aus den Regeln einer Welt (`PackEvent`): Ihre Töne kommen aus dem Paket dieser Welt (`packScore`) */
// als Tabelle über alle Arten: Fehlt eine neue, bricht die Typprüfung (am 26.11.2026 fehlte `lapstone`, der Zahlenstein
// blieb im Spiel stumm)
const PACK_TYPES: Record<PackEvent['type'], true> = {
  snowman: true,
  icicle: true,
  column: true,
  olm: true,
  web: true,
  chimegate: true,
  lantern: true,
  heave: true,
  lapstone: true,
  numflag: true,
  treelamp: true,
  caveshroom: true,
  cavetower: true,
  numstone: true,
  echo: true,
};
const PACKED: ReadonlySet<string> = new Set(Object.keys(PACK_TYPES));
const packed = (e: { type: string }): e is PackEvent => PACKED.has(e.type);
/** Davon zeigt und spielt das Paket alles selbst (Säule, Grottenolm, Netz, Klingeltor, Zahlenstein) */
type PackOnly = Extract<
  PackEvent,
  { type: 'column' | 'olm' | 'web' | 'chimegate' | 'lapstone' | 'numflag' | 'numstone' | 'echo' }
>;
const PACK_ONLY: ReadonlySet<string> = new Set<PackOnly['type']>([
  'column',
  'olm',
  'web',
  'chimegate',
  'lapstone',
  'numflag',
  'numstone',
  'echo',
]);
const packOnly = (e: { type: string }): e is PackOnly => PACK_ONLY.has(e.type);

class LarmicMitwachsen extends HTMLElement {
  private store!: Store;
  private saved!: SavedWorld;
  private world!: World;
  private state!: State;
  private renderer!: Renderer;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private menu!: HTMLDialogElement;
  private info!: HTMLDialogElement; // Hinweis für Eltern zur Bildschirmzeit
  private bubble!: HTMLElement; // Sprechblase der müden Figur
  private bubbleTimer: number | undefined;
  private tired!: Tired;
  private lastTiredSave = 0;
  private sitUntil = 0; // bis dahin sitzt die müde Figur
  private dawned = false; // in dieser Welt begann ein neuer echter Spieltag (`WorldPack.dawn` auch für spät geladene)
  private tiredLater: TiredEvent | null = null; // Gähnen oder „ins Bett“ während einer Fahrt: kommt nach dem Aussteigen
  private friend = new FriendLook(); // der Funkelfreund des Hinführens (mitwachsen-sight-look.ts)
  private rides: readonly RideBody[] = []; // Körper eines Fahrzeugs in diesem Bild (aus dem Welt-Paket)
  private tickAt = 0; // wann der letzte Takt lief (das Fahrzeug gleitet zwischen den Takten weiter)
  private lastInput = 0; // letzte Eingabe: Spielt lange niemand, setzt sich die Figur und liest
  private pose: Pose = 'stand';
  private sfx = new Sfx();
  private story = new StoryPlayer(this.sfx); // Klangsteine
  private air = new Air(this.sfx); // Wetter, wo die Figur ist: Rauschen und Windspiel des Pustewinds
  private listening = false; // die Figur sitzt am Klangstein und hört zu, bis sie losgeht
  private globals: AbortController | null = null;
  private timer: number | undefined;
  private raf = 0;
  // Test-Uhr der Browser-Tests (e2e/helpers.ts): Mit `window.__MW_TEST` ruhen Takt und Bildschleife, der Test spielt
  // Takte (`apply`) und zeichnet Bilder (`frame`) selbst
  private manual = '__MW_TEST' in window;
  private lastFrame = 0;
  private lastSave = 0;
  private pace = new InputPace(); // ruhiger Takt: Tippen ist nicht schneller als Halten
  private size = { w: 0, h: 0, zoom: 1, dpr: 1 };
  private bodies = new Map<string, Body>();
  private hops = new Map<string, number>(); // Zeitpunkt des letzten Sing-Hüpfers je Wesen
  // Takt der Regeln, an dem die Flügel eines Tors aufschwingen (0 = schon offen): Ruht der Takt (Menü, Hinweis, Tab
  // verborgen), warten sie mit, wie Vorspiel und Ritual des Eistors
  private gates = new Map<string, number>();
  private floats: (Float & { born: number; who?: string })[] = [];
  private particles: Particle[] = [];
  // seit wann die Figur schläft (performance.now): für die Überblendung und App-Updates. Solange ein Welt-Paket lädt,
  // gibt es noch keine Figur: wie eine Welt, die schlafend öffnet (unendlich lange), sonst wartete ein App-Update
  private nightSince = -Infinity;
  private nights = new GoodNights(); // „Gute Nacht, Fahrzeuge“ (mitwachsen-bedtime.ts)
  private dayAt = 0;
  private resize: ResizeObserver | null = null;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private fog = new Fog(); // erkundete Felder; der Rest liegt im Nebel
  private seen = (x: number, y: number) => this.fog.has(x, y); // Ist das Feld erkundet? (Regeln, Bild, Karte)
  private seenAt = '';
  private map!: HTMLCanvasElement;
  private mapCtx!: CanvasRenderingContext2D;
  private lastMap = 0;
  private touchUi!: HTMLElement;
  private r3d: World3DType | null = null; // 3D-Ansicht, solange sie zeichnen kann
  private gl3d: World3DType | null = null; // die geladene 3D-Ansicht, auch wenn ihr Kontext gerade fehlt
  private guide?: GuideRules; // Regeln des verlaufenen Pinguins (aus dem Paket der Eis-Welt), sobald er fällig ist
  private packs = new Packs((pack) => this.arrive(pack)); // Welt-Pakete (worlds/), geladen erst bei Bedarf
  private dimmed = 1; // Licht im Tunnel (1: wie immer), gleitet zum Ziel der Pakete (`View2D.dim`)
  // Entwickler-Schalter (`?entwickler=hoehle`, mitwachsen-dev.ts): Pakete, in die geblickt wird; dann wird nichts gespeichert
  private glimpse = glimpse(location.search, PACK_IDS);
  private dev = this.glimpse.packs.length > 0;
  private opening = ''; // Welt, die gerade öffnet (wartet vielleicht auf ein Paket)
  private live = ''; // Welt, zu der `state` gehört; solange sie nicht `opening` ist, ruhen Takt und Speichern
  // Postkarte der Torfront, nachgeladen mit der ersten
  private card = later(() => import('./mitwachsen-card').then((m) => m.postcardView(this.querySelector('.mw-card')!)));
  private plates = plateToy(this.sfx, (at, colors) => this.burst('', colors, 6, at, true)); // Torplatten
  // „noch nicht“ an den Toren, die nie aufgehen: Bild und Ton nachgeladen mit dem ersten Schritt auf eine Torplatte
  private never = later(() => import('./mitwachsen-hint-look').then((m) => m.never()));
  /**
   * „Noch nicht“: an einem Tor mit Schlüssel (Haken im Paket seiner Welt, heute am Eistor), steht die Figur dort ohne
   * seinen Boten; an den Toren, die nie aufgehen, zeigen sie das Zeichen ihrer Welt (mitwachsen-hint-look.ts). In 3D,
   * wenn die Kamera vorn ist
   */
  private hint = (now: number, { state, world } = this) => {
    const plate = world.cell(state.player.x, state.player.y).plate;
    const a = [state, world, now, this.reduced.matches, this.sfx, this.lift, this.r3d] as const;
    // fehlt einem Tor, das nie aufgeht, ein nächster Schritt aus einem Paket (am Höhlentor Tok), zeigt es dessen Umriss
    const lack = plate && this.renderer.first((v) => v.lacks?.(state, plate));
    return this.never(plate)?.(...a, lack) ?? this.packs.hint(...a); // die Haken der Pakete je Bild, auch neben der Platte
  };

  connectedCallback() {
    this.canvas = this.querySelector('canvas.mw-canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.menu = this.querySelector('dialog.mw-settings')!;
    this.info = this.querySelector('dialog.mw-info')!;
    this.bubble = this.querySelector('.mw-bubble')!;
    this.map = this.querySelector('canvas.mw-map')!;
    this.mapCtx = this.map.getContext('2d')!;
    this.touchUi = this.querySelector('.mw-touch')!;
    this.renderer = new Renderer(this.ctx);
    // mit dem Entwickler-Schalter schreibt nichts in den Spielstand des Kindes, auch das Menü nicht
    this.store = this.dev ? sandbox(browserStore().store) : browserStore().store;
    this.sfx.muted = this.store.getItem('larmic.games.muted') === '1';
    this.tired = loadTired(this.store, Date.now());
    this.packs.extra = this.glimpse.packs; // seine Pakete holen, auch ohne Bedarf
    void this.openWorld(loadIndex(this.store).current).then(() => this.begin());
  }

  /** Die Welt ist offen (mit den Welt-Paketen, die sie gleich braucht): das Spiel starten */
  private begin() {
    if (!this.isConnected || this.globals || !this.saved) return; // inzwischen weg (oder schon gestartet)
    this.listen();
    this.resize = new ResizeObserver(() => this.measure());
    this.resize.observe(this.canvas);
    this.measure();
    this.classList.add('ready');
    this.start();
    // `settled`: das erste Bild der endgültigen Ansicht ist gezeichnet (3D, sonst 2D); darauf warten die Browser-Tests
    void this.load3d().then(() => requestAnimationFrame(() => this.classList.add('settled')));
    // Beim ersten Öffnen: erst der Hinweis für Eltern, dann geht es los
    if (this.store.getItem(INFO_KEY) !== '1') this.openInfo();
  }

  /**
   * 3D-Ansicht nachladen: Three.js kommt erst jetzt (import()), nie mit der Startseite. Ohne WebGL oder wenn das Laden
   * scheitert, bleibt die 2D-Ansicht. Bis die 3D-Ansicht bereit ist, läuft das Spiel schon in 2D.
   */
  private async load3d() {
    // Three.js braucht WebGL2; ohne gar nicht erst laden. Den Prüf-Kontext sofort wieder freigeben.
    const probe = document.createElement('canvas').getContext('webgl2');
    if (!probe) return;
    probe.getExtension('WEBGL_lose_context')?.loseContext();
    try {
      const { World3D } = await import('./mitwachsen-3d');
      if (!this.isConnected || !this.globals) return;
      const canvas = this.querySelector<HTMLCanvasElement>('canvas.mw-canvas3d')!;
      this.gl3d = this.r3d = new World3D(canvas, LOOK);
      for (const pack of this.packs.loaded) this.gl3d.use(pack); // 3D-Teile der Welt-Pakete, die schon da sind
      this.classList.add('three');
      this.measure();
      // Verliert das Gerät den Kontext (App-Wechsel, Speicherdruck), springt die 2D-Ansicht ein, bis er zurück ist
      canvas.addEventListener(
        'webglcontextlost',
        () => {
          this.r3d = null;
          this.classList.remove('three');
        },
        { signal: this.globals.signal },
      );
      canvas.addEventListener(
        'webglcontextrestored',
        () => {
          this.r3d = this.gl3d;
          this.classList.add('three');
          this.measure();
        },
        { signal: this.globals.signal },
      );
    } catch {
      this.r3d = null; // 2D reicht
    }
  }

  disconnectedCallback() {
    this.save();
    this.stop();
    this.globals?.abort();
    this.globals = null;
    this.resize?.disconnect();
    this.story.stop();
    this.sfx.close();
    clearTimeout(this.bubbleTimer);
    this.gl3d?.dispose();
    this.gl3d = this.r3d = null;
  }

  // ---------- Welten ----------

  /**
   * Welt laden (oder eine neue anlegen) und das Spiel darauf starten. Braucht sie ein Welt-Paket, das noch fehlt (ihr
   * Tor ist offen, der Pinguin fällig, die Figur war im Kessel oder nah am Tor), wartet sie kurz darauf (`Packs.wait`);
   * so lange ruht die alte Welt (`live`): kein Takt, kein Speichern, eine gelöschte käme sonst zurück
   */
  private async openWorld(id: string | null) {
    const saved = savedOrNew(this.store, id);
    const p = progressFrom(saved);
    this.opening = saved.id;
    await this.packs.wait({ ...p, at: [p.position] }, gatePlaces(saved.seed));
    if (this.opening !== saved.id) return; // inzwischen wurde eine andere Welt geöffnet
    this.saved = { ...saved, visits: saved.visits + 1 };
    if (!this.dev) saveWorld(this.store, this.saved);
    // Entwickler-Schalter: Der Spielstand bekommt, was er vorspielt (die Bahn: ihren Ausbau, bei 0 den Stand, in dem Tok
    // kommt), schon für den Bau der Welt
    let progress = progressFrom(this.saved);
    if (this.dev) progress = devProgress(this.glimpse.packs, location.search, progress);
    // Start nach mehr als `BREAK` Pause, ein neuer echter Spieltag: Was am Abend schlafend kam (Tok), wacht auf
    // (`WorldPack.dawn`; die Uhr des Kinds läuft erst nach dem Start weiter, beim Wechsel der Welt ist es nie so)
    this.dawned = newDay(this.tired, Date.now()); // auch für Pakete, die erst später kommen (`arrive`)
    if (this.dawned) progress.packs = dawnOf(this.packs.loaded, progress.packs);
    this.world = createWorld(this.saved.seed, this.packs.loaded, progress.packs);
    this.seenAt = '';
    this.state = initialState(this.world, progress, this.saved.seed ^ this.saved.visits);
    // Entwickler-Schalter: Die Figur schläft im Bett der Welt, in die geblickt wird (nur, wenn ihr Paket da ist; die Bahn
    // allein: im Bett der Lichtung)
    const { home } = this.glimpse;
    if (home && (home === 'lichtung' || this.packs.get(home))) {
      const [x, y] = this.world.homes[home].bed;
      const lamp = devLamp(home, location.search); // `&laterne=1`: mit der Kristall-Laterne in der Hand
      this.state = { ...this.state, player: { ...this.state.player, x, y }, ...(lamp && { lamp }) };
    }
    this.live = this.saved.id;
    // Nebel: Am Anfang ist nur ein kleines Stück um das Bett zu sehen (die Figur liegt darin), ebenso, wenn das Bett
    // noch im Nebel liegt (etwa nach dem Umzug in das Gletschertal, Spielstand Version 5)
    this.fog = Fog.from(this.saved.explored);
    const { x, y } = this.state.player;
    if (!this.fog.has(x, y)) this.fog.reveal(x, y, START_REVEAL);
    this.bodies.clear();
    this.floats = [];
    this.particles = [];
    this.gates = new Map(this.state.openGates.map((g) => [g, 0]));
    // Eine Welt öffnet nachts (die Figur schläft im Bett): gleich dunkel, ohne Überblendung beim Laden
    this.nightSince = -Infinity;
    this.dayAt = 0;
    this.renderName();
    if (this.menu.open) void this.renderMenu(); // sonst füllt openMenu es beim Öffnen
  }

  private save() {
    // eine Welt öffnet (`state` gehört nicht zu `saved`), oder der Entwickler-Schalter blickt nur hinein
    if (!this.saved || this.opening !== this.live || this.dev) return;
    this.saved = { ...withProgress(this.saved, progressOf(this.state)), explored: this.fog.serialize() };
    saveWorld(this.store, this.saved);
    saveTired(this.store, this.tired);
    this.lastSave = performance.now();
  }

  /**
   * Ein Welt-Paket ist angekommen: in die laufende Welt einbauen (nur die betroffenen Stücke entstehen neu, die 3D-Ansicht
   * tauscht sie aus, ohne zu flackern), die Tiere seiner Welt ziehen ein, die Ansicht bekommt seine Zeichenteile (die
   * 3D-Ansicht lädt ihre nach)
   */
  private arrive(pack: LoadedPack) {
    if (pack.view) this.renderer.views.set(pack.gate ?? pack.id, pack.view);
    this.gl3d?.use(pack); // sein 3D-Teil kommt nach (mit Three.js)
    if (!(this.world as World | undefined)) return; // entsteht gleich mit ihm; sonst immer einbauen (zweimal: egal)
    const { world, chunks } = this.world.attach(pack);
    this.world = world;
    // kam es nach einem neuen echten Spieltag (Start oder lange Pause), gilt sein Haken `dawn` noch (Tok wacht auf)
    if (this.dawned && pack.dawn) this.state = { ...this.state, packs: pack.dawn(this.state.packs) };
    this.state = attachPack(this.state, world);
    this.gl3d?.adopt(world, chunks);
  }

  /** Für Updates der App (pwa-register.ts): Was im Spiel gerade los ist; entschieden wird in pwa-update.ts */
  updateMoment(): GameMoment {
    return {
      // Solange die Welt-Pakete laden, gibt es noch keinen Zustand und nichts zu verlieren
      sleeping: (this.state as State | undefined)?.sleeping ?? true,
      sleepingFor: performance.now() - this.nightSince, // eine Welt öffnet schlafend: dann unendlich
      menuOpen: this.menu.open,
      infoOpen: this.info.open,
      firstInfo: this.info.open && this.store.getItem(INFO_KEY) !== '1',
    };
  }

  /** Menü oder Hinweis offen: Das Spiel ruht */
  private paused = () => this.menu.open || this.info.open;

  // ---------- Takt und Eingabe ----------

  private start() {
    this.lastInput = performance.now(); // nach Menü, Hinweis oder Tab-Wechsel: frisch, die Figur steht
    if (this.manual) return;
    if (this.timer === undefined && !this.paused() && document.visibilityState === 'visible')
      this.timer = window.setInterval(() => this.apply({ type: 'tick', held: this.pace.held() }), TICK_MS);
    if (!this.raf) this.raf = requestAnimationFrame(() => this.frame(performance.now()));
  }

  private stop() {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private apply(cmd: Cmd) {
    if (this.opening !== this.live) return; // die alte Welt ruht, bis die neue steht
    if (cmd.type !== 'tick' || this.state.ride) this.lastInput = performance.now(); // jemand spielt (auch: fährt)
    if (cmd.type === 'tick') this.tickAt = performance.now();
    // nur ein neuer Druck (kein gehaltener Pfeil) steigt in ein Fahrzeug
    else if (cmd.type === 'move' && this.pace.lastFresh && !cmd.fresh) cmd = { ...cmd, fresh: true };
    const go = () => (this.pace.halt('pause', performance.now()), this.apply(cmd)); // nach Blinzeln: Takt frisch
    if (cmd.type === 'move' && (performance.now() < this.sitUntil || this.r3d?.blink(go))) return; // müde, gedreht
    // Abend für die Regeln (Tok kommt dann schon schlafend): aus der Uhr des Kinds, im Blick hinein auch per `&abend=1`
    const dusk = late(this.tired, Date.now()) || devLate(this.glimpse.packs, location.search);
    if (this.state.late !== dusk) this.state = { ...this.state, late: dusk };
    if (endsBedtime(cmd, this.state.sleeping)) this.nights.end(); // jede Taste beendet „Gute Nacht“ sofort
    const { state, events } = step(this.state, this.world, cmd, this.seen, this.guide, this.packs.loaded);
    this.state = state;
    // Ist die Leiste der Lichtung voll, gelten die Regeln des Pinguins aus dem Paket der Eis-Welt (bis er im Kessel wohnt)
    if (!this.guide && pending(state)) this.guide = this.packs.at(GUIDE_GATE)?.lead;
    // Pakete der Welten holen, sobald ihr Tor eine Rolle spielt; vor einem Halt, was sein Fahrzeug braucht (Vorladen)
    const at: Need['at'] = [[state.player.x, state.player.y], state.held];
    const ride = preloadOf(this.packs.loaded, this.world, state, at);
    void this.packs.want({ ...state, at, ride }, this.world.gates);
    this.lift();
    if (events.length) this.react(events);
    if (cmd.type === 'tick') this.ageTired();
    if (cmd.type === 'tick') this.chain(state.tick);
    // Moosfresser naschen selbst am Tropfmoos (Schnapp-Hüpfer ohne Zutun des Kinds)
    if (cmd.type === 'tick')
      for (const id of nibblers(state, (x, y) => this.world.cell(x, y))) this.hops.set(`snap:${id}`, performance.now());
    if (performance.now() - this.lastSave > SAVE_EVERY_MS) this.save();
  }

  // ---------- Müde werden ----------

  /** Spielzeit fortschreiben (läuft im Takt, also nur bei sichtbarer Seite und geschlossenem Menü) */
  private ageTired() {
    // nach mehr als `BREAK` Pause (Seite lange im Hintergrund) beginnt ein neuer echter Spieltag: Tok wacht auf
    if (newDay(this.tired, Date.now())) {
      this.dawned = true;
      this.state = { ...this.state, packs: dawnOf(this.packs.loaded, this.state.packs) };
    }
    // Liest oder döst die Figur, spielt gerade niemand: Die Uhr fürs Müdewerden läuft dann nicht
    const { tired, event } = advance(this.tired, Date.now(), !this.state.sleeping && this.pose === 'stand');
    this.tired = tired;
    // im Fahrzeug setzt sich die Figur nicht hin: Gähnen und „ins Bett“ kommen nach dem Aussteigen
    const { now, held } = heldTired(this.tiredLater, event, !!this.state.ride);
    this.tiredLater = held;
    if (now) this.getTired(now);
    if (!this.dev && performance.now() - this.lastTiredSave > 5000) {
      saveTired(this.store, this.tired);
      this.lastTiredSave = performance.now();
    }
  }

  /** Die Figur setzt sich kurz hin, gähnt und sagt es in einer Sprechblase. Ein gehaltener Pfeil bleibt gehalten: Danach läuft sie weiter */
  private getTired(kind: TiredEvent) {
    this.sitUntil = performance.now() + SIT_MS;
    this.sfx.yawn();
    this.bubble.dataset.kind = kind;
    this.bubble.querySelector('.mw-bubble-text')!.textContent = TIRED_TALK[kind];
    this.bubble.hidden = false;
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = window.setTimeout(() => (this.bubble.hidden = true), kind === 'bed' ? 12_000 : 7_000);
  }

  private openInfo() {
    this.pace.clear();
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    (document.activeElement as HTMLElement | null)?.blur();
    this.info.showModal();
  }

  /** Nebel um die Figur lichten; geänderte Stücke baut die 3D-Ansicht neu. `peek`: bis zur Mündung („noch nicht“) */
  private lift = (peek?: boolean) => {
    const { x, y } = this.state.player;
    if (`${x},${y}` === this.seenAt && !peek) return;
    this.seenAt = `${x},${y}`;
    const changed = lookAround(this.fog, this.world.gates.values(), x, y, peek); // auch durchs Tor in den Gang
    if (changed.length) this.gl3d?.invalidate(changed);
  };

  private listen() {
    this.globals = new AbortController();
    const signal = this.globals.signal;
    document.addEventListener(
      'keydown',
      (e) => {
        if (this.paused() || e.metaKey || e.ctrlKey || e.altKey || FREE_KEYS.has(e.key) || /^F\d+$/.test(e.key)) return;
        const t = e.target as HTMLElement | null;
        if (t?.closest('input, textarea, select')) return;
        // Buttons bleiben bedienbar (Enter, im Menü auch die Leertaste). Zahnrad oben: Die Leertaste drückt es nicht,
        // sonst öffnet das Kind nach einem Mausklick von Papa das Menü.
        if (t?.closest('button, a') && (e.key === 'Enter' || (e.key === ' ' && !t.closest('.mw-top, .mw-touch'))))
          return;
        const dir = KEYS[e.key];
        // Ab 3 gibt es keine Aktionstaste: Tiere und Bett gehen durch Hineinlaufen. Die Leertaste tut nichts
        // (sie scrollt auch nicht und drückt keinen Button); andere Tasten bleiben frei.
        if (!dir) {
          if (e.key === ' ') e.preventDefault();
          return;
        }
        e.preventDefault();
        if (e.repeat) return this.pace.repeat(dir); // gehalten: Takt im Bild (poll); hält auch ein falsches keyup aus
        this.sfx.unlock();
        const go = this.pace.press(dir, performance.now());
        if (go) this.apply({ type: 'move', dir: go });
      },
      { signal },
    );
    document.addEventListener(
      'keyup',
      (e) => {
        const dir = KEYS[e.key];
        if (dir) this.pace.release(dir);
      },
      { signal },
    );
    // Losgelassene Tasten kommen nicht an, wenn das Fenster den Fokus verliert: dann nichts weiterlaufen lassen
    window.addEventListener('blur', () => this.pace.clear(), { signal });
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'hidden') {
          this.pace.clear();
          this.save();
          this.stop();
          this.story.stop();
          this.sfx.suspend();
        } else this.start();
      },
      { signal },
    );
    window.addEventListener('pagehide', () => this.save(), { signal });

    this.querySelector('.mw-gear')!.addEventListener('click', () => void this.openMenu(), { signal });
    listenTouch(this, signal, this.pace, this.sfx, (dir) => this.apply({ type: 'move', dir }));
    // Antippen eines Fahrzeugs oder von Tok (mitwachsen-tap.ts): in 2D und 3D über die Projektion der Ansicht
    listenTap(this.canvas, signal, () => this.tapScene(), this.apply.bind(this));
    // Beim Schließen gibt der Dialog den Fokus ans Zahnrad zurück; die Leertaste öffnete dann sofort wieder das Menü
    this.menu.addEventListener(
      'close',
      () => {
        (document.activeElement as HTMLElement | null)?.blur();
        this.start();
      },
      { signal },
    );
    this.menu.addEventListener('click', (e) => this.menuClick(e), { signal });
    this.info.addEventListener(
      'close',
      () => {
        try {
          this.store.setItem(INFO_KEY, '1');
        } catch {
          /* dann kommt der Hinweis beim nächsten Mal wieder */
        }
        (document.activeElement as HTMLElement | null)?.blur();
        this.start();
      },
      { signal },
    );
    this.info.addEventListener(
      'click',
      (e) => {
        if ((e.target as HTMLElement).closest('[data-act="info-close"]')) this.info.close();
      },
      { signal },
    );
    this.bubble.addEventListener(
      'click',
      (e) => {
        if ((e.target as HTMLElement).closest('[data-act="info"]')) this.openInfo();
      },
      { signal },
    );
    this.menu.addEventListener('change', (e) => this.menuChange(e), { signal });
  }

  /** Ereignisse der Regeln: Töne, Herzen, Noten, Tore, Nacht – und sofort speichern, was zählt */
  private react(events: GameEvent[]) {
    const now = performance.now();
    let persist = false;
    let homes = 0; // Tiere, die in diesem Zug einziehen
    // Begegnung (Tier gefunden oder getroffen, Beeren, Fische, Füttern, Portal): Die Figur bleibt kurz stehen, dann läuft
    // sie mit gehaltenem Pfeil weiter; aus dem Bett erst nach neuem Druck (stops in input-pace.ts)
    this.pace.halt(stops(events, this.state.animals.find((a) => a.mode === 'lead')?.id), now);
    for (const e of events) {
      switch (e.type) {
        case 'step':
        case 'swap': // im Kessel knirscht es auf Schnee und Eis
          this.sfx[stepSound(this.world, this.state.player.x, this.state.player.y)](e.type === 'step' ? e.climb : 0);
          this.listening = false;
          break;
        case 'story':
          this.story.toggle(e.id);
          this.listening = true;
          persist ||= e.first;
          break;
        case 'bump':
          this.sfx.bump();
          this.hops.set('bump', now);
          break;
        case 'sing':
          this.sfx.play(SPECIES[e.species].tone);
          this.hops.set(e.id, now);
          this.float('note', e.id, GAME_COLORS.note, now);
          if (e.first) {
            this.sfx.friend();
            this.float('heart', e.id, GAME_COLORS.heart, now + 250);
            this.burst(e.id, [GAME_COLORS.heart, '#ffffff', '#e77fb3'], 16);
            persist = true;
          }
          break;
        case 'follow':
          this.float('heart', e.id, GAME_COLORS.heart, now + 150);
          break;
        case 'realm': // Weltwechsel an der Gangmitte: hoher Glockenton in eine Welt hinter einem Tor, tiefer zurück
          this.sfx.bell(e.to !== 'lichtung');
          break;
        case 'breath': // ein kalter Atemzug weht aus dem offenen Eistor Schnee auf die Lichtung
          this.burst('', SPARKS.snow, 30, { x: e.x, y: e.y, z: this.world.cell(e.x, e.y).h + 1 });
          break;
        case 'hop': // das Eistor geht auf: Jeder Pfeil lässt die Figur nur hüpfen
          this.hops.set('player', now);
          break;
        case 'home':
          // Zu Hause angekommen: Das Tier ruft seinen eigenen Ton, dazu ein heller Klang und ein Herz. Ziehen mehrere
          // zugleich ein, rufen sie kurz nacheinander, damit man jedes hört
          this.cheer(e, now, HOME_STAGGER * homes++);
          this.burst(e.id, SPARKS[realmOfAnimal(e.id)], 14); // in der Eis-Welt eine Funkenwolke in Eisblau
          persist = true;
          break;
        case 'portal': // Plattform erwacht bzw. gereist (Funken in der Farbe ihres Portals)
        case 'teleport':
          this.sfx[e.type === 'portal' ? 'gate' : 'portal']();
          this.burst('player', [portalColor(e.id), '#ffffff'], e.type === 'portal' ? 24 : 18);
          persist = true;
          break;
        case 'ready':
          this.sfx.pling();
          break;
        // das Eistor geht mit dem Pinguin auf: nach dem Vorspiel Eiszapfen-Lied, Türflügel, Rumms und Akkord, wenn die
        // Kamera vorn ist (`at` in Takten, worlds/eis/mitwachsen-ritual.ts); die Flügel im Takt der Regeln
        case 'gate':
          this.sfx.score(this.packs.at(e.id)?.view?.sky?.gateScore(e.at) ?? []); // Töne aus dem Paket seiner Welt
          this.gates.set(e.id, this.state.tick + e.at);
          persist = true;
          break;
        case 'call':
          this.sfx.call();
          this.hops.set('player', now);
          this.float('note', 'player', GAME_COLORS.note, now);
          break;
        case 'sleep':
          this.goodNight(now);
          persist = true;
          break;
        case 'wake':
          this.nights.stop();
          this.sfx.wake();
          this.dayAt = now;
          this.hops.set('player', now);
          break;
        default:
          // Ein Tier ruft und hüpft (Wiese, Weltgrenze, der Pinguin), sonst Handgriffe: pflücken, fangen, nachwachsen,
          // schöpfen, füttern, tränken; und was die Regeln einer Welt melden (Schneemann, Eiszapfen); Fahrzeug und Bote
          // aus einem Welt-Paket (Schlitten, Tok): Bild und Ton kommen mit seiner Ansicht
          if ('species' in e) this.cheer(e, now);
          else if ('what' in e) this.effect(e, now);
          else this.chore(e, now);
      }
    }
    if (persist) this.save();
  }

  /**
   * Ein Tier ruft kurz mit seinem Ton und hüpft: Ein Tier der Wiese hüpft zur Seite (die Figur geht weiter, ohne
   * anzuhalten). An der Weltgrenze setzt sich ein Tier mit Herz auf seinen Warteplatz bzw. hüpft vor Freude und reiht
   * sich wieder ein. Der verlaufene Pinguin taucht in einer kleinen Schneewolke auf und piept; bei der Figur angekommen,
   * zeigt er ein Herz. Geht das Eistor auf, rutscht er durch den Gang, dreht sich um, hüpft und zeigt ein Herz. Zu
   * Hause angekommen klingt dazu ein heller Klang; `later` ms später, wenn mehrere zugleich einziehen.
   */
  private cheer(e: GameEvent & { id: string; species: keyof typeof SPECIES }, now: number, later = 0) {
    if (e.type === 'guide') this.burst(e.id, SPARKS.snow, 14, { x: e.x, y: e.y, z: this.world.cell(e.x, e.y).h });
    this.sfx.play(SPECIES[e.species].tone, later / 1000);
    if (e.type === 'home') this.sfx.home(later / 1000);
    this.hops.set(e.id, now + later);
    if (e.type === 'guide' || e.type === 'peep' || e.type === 'aside') return;
    this.float('heart', e.id, GAME_COLORS.heart, now + later + 150);
    if (e.type !== 'arrive') this.hops.set(`seat:${e.id}`, now); // gleitet zum Warteplatz, in die Kette, durch den Gang
  }

  /**
   * Ein Fahrzeug oder Bote aus einem Welt-Paket (Schlitten, Tok): Töne, Hüpfer, Herz und Funken, wie seine Ansicht sagt
   * (`View2D.rideFx`, `View2D.heraldFx`; Funken nicht bei reduzierter Bewegung); was zählt (erschienen, Fest), gleich speichern
   */
  private effect(e: Extract<GameEvent, { type: 'ride' | 'herald' | 'sight' }>, now: number) {
    if (e.type === 'sight') return this.sight(e);
    const fx = this.renderer.first((v) =>
      e.type === 'ride' ? v.rideFx?.(e, this.state) : v.heraldFx?.(e, this.state),
    );
    this.sfx.score(fx?.score ?? []);
    if (fx?.who) this.hops.set(fx.who, now);
    if (fx?.who && fx.heart) this.float('heart', fx.who, GAME_COLORS.heart, now + 150);
    for (const id of fx?.chorus ?? []) this.hops.set(id, now + CHORUS_MS); // antworten kurz danach (Pfeif-Gruß)
    if (fx?.burst) this.burst('', fx.burst, 24, { x: e.x, y: e.y, z: this.world.cell(e.x, e.y).h + 0.4 });
    if (fx?.zzz && !this.reduced.matches) {
      const z = this.world.cell(e.x, e.y).h + 1.2; // ein schlafendes Fahrzeug: Zzz über dem Dach (Ort statt Wesen)
      this.floats.push({ kind: 'zzz', who: 'spot', color: GAME_COLORS.star, born: now, x: e.x, y: e.y, z, age: 0 });
    }
    if (e.type === 'herald' && e.relay) this.relay();
    if (e.persist) this.save();
  }

  /**
   * Hinführen (mitwachsen-sight-look.ts): Ein Ding ruft leise mit seinem eigenen Klang; der Funkelfreund erscheint,
   * freut sich oder fliegt fort, mit Zwitschern und ein paar Funken. Gefunden wird gleich gespeichert
   */
  private sight(e: Extract<GameEvent, { type: 'sight' }>) {
    this.sfx.score(sightScore(e, [...this.renderer.views.values()], this.state));
    if (e.what !== 'call') this.burst('', SIGHT_SPARKS, 10, { x: e.x, y: e.y, z: this.world.cell(e.x, e.y).h + 0.6 });
    if (e.what === 'found') this.save();
  }

  /**
   * Der Spielstand der Pakete, nach dem ein Paket ohne eigene Welt legt, hat sich geändert (Tok baut: Bau 1): die Welt
   * neu bauen (`World.relay`); wie beim Ankommen eines Pakets entstehen nur die betroffenen Stücke neu, ohne zu flackern.
   * Wer nun auf einem festen Feld stünde, rückt zur Seite (`unstick`)
   */
  private relay() {
    const { world, chunks } = this.world.relay(this.state.packs);
    this.world = world;
    this.state = unstick(this.state, world);
    this.gl3d?.adopt(world, chunks);
  }

  /**
   * Was das Antippen sieht: die Körper der Fahrzeuge, den Boten (Tok, wo er gerade gezeichnet ist; es gibt ihn nur mit
   * dem Paket der Bahn), die Projektion der Ansicht und die Figur (nicht, solange es ruht)
   */
  private tapScene() {
    const t = heraldOf(this.state);
    const b = t && this.bodies.get(t.id);
    const rides = b ? [...this.rides, { id: t.id, x: b.x, y: b.y, z: b.z, being: true as const }] : this.rides;
    if (this.paused() || !rides.length) return null;
    return {
      rides,
      project: (x: number, y: number, z: number) => this.project(x, y, z),
      player: this.state.player,
    };
  }

  /**
   * Körper eines Fahrzeugs für dieses Bild (aus dem Welt-Paket): zwischen den Takten weitergleitend (`frac`), mit
   * Laterne am Abend und in der Nacht
   */
  private rideFrame(t: number, night: number) {
    const asleep = this.state.sleeping ? this.nights.out((t - this.nightSince) / 1000) : []; // nach „Gute Nacht“
    const frac = Math.min(1, (t - this.tickAt) / TICK_MS);
    // Laterne und Lampen am Abend und nachts, ab 20 min warmes Licht (Fensterband des Zugs)
    const { lit, warm } = rideLight(night, evening(this.tired), this.state.sleeping, this.state.late);
    const at = { now: t, frac, reduced: this.reduced.matches, lit, warm, asleep };
    // die Figur sitzt nur im Fahrzeug ihrer Fahrt (`ownSeat`), wie viele Pakete auch Körper liefern
    this.rides = ownSeat(
      this.renderer.all((v) => v.bodies?.(this.state, this.world, at) ?? []),
      this.state.ride?.id,
    ).concat(this.friend.bodies(this.state.lure, (x, y) => this.world.cell(x, y).h, t, at.reduced));
  }

  /**
   * Licht dieses Bilds: Fährt die Figur durch einen Tunnel, dimmt es (`View2D.dim` der Pakete, das kleinste zählt); es
   * gleitet in gut einer halben Sekunde hin (bei reduzierter Bewegung sofort)
   */
  private dimFrame(dt: number): number {
    const goal = Math.min(1, ...this.renderer.all((v) => (v.dim ? [v.dim(this.state, this.world)] : [])));
    this.dimmed = this.reduced.matches ? goal : this.dimmed + (goal - this.dimmed) * Math.min(1, dt * 3);
    return this.dimmed;
  }

  /** Ins Bett gebracht: Schlaflied, Nacht; der Tag ist zu Ende, morgen ist die Figur wieder ausgeschlafen */
  private goodNight(now: number) {
    this.story.stop();
    this.sfx.lullaby();
    this.nightSince = now;
    // die Fahrzeuge in Sichtweite sagen nacheinander gute Nacht und machen ihr Licht aus (`View2D.goodNight`)
    this.nights.start(this.renderer.all((v) => [v.goodNight?.(this.state, this.world)].filter((g) => g !== undefined)));
    this.tired = freshDay(Date.now());
    this.sitUntil = 0;
    this.bubble.hidden = true;
    // Gute Nacht: eine sichere Stelle, um eine neue Version der App zu übernehmen (pwa-register.ts)
    this.dispatchEvent(new CustomEvent(SLEEP_EVENT, { bubbles: true }));
  }

  /** Der Rand einer Welt antwortet: weicher Ton; aus der Hecke schaut ein Vogel, vom Eis rieselt Glitzer, die Grotte hallt */
  private edge(e: EdgeEvent, now: number) {
    this.sfx.edge(e.kind === 'cave');
    const at = { x: e.x, y: e.y, z: this.world.cell(e.x, e.y).h };
    if (e.kind === 'ice') this.burst('', SPARKS.eis, 6, at, true);
    // der Vogel sitzt vorn auf der Hecke (ein Zeichen schwebt 0,9 über seinem Ort), nicht oben auf dem Fels dahinter
    if (e.kind === 'hedge')
      this.floats.push({ kind: 'bird', who: 'spot', color: BIRD_COLOR, born: now, ...at, z: at.z - 1.1, age: 0 });
  }

  /** Lichterkette der Wegsteine: Schwingen die Flügel eines Tors auf, läuft ein Glitzern vom Bett zum Tor */
  private chain(tick: number) {
    for (const [id, at] of this.gates)
      for (const [x, y] of at ? due(this.world.waystones.get(id as GateId) ?? [], at, tick) : [])
        this.burst('', waystoneSparks(id as GateId), 5, { x, y, z: this.world.cell(x, y).h - 0.6 });
  }

  private float(kind: Float['kind'], who: string, color: string, born: number) {
    if (this.reduced.matches && kind !== 'heart') return;
    this.floats.push({ kind, who, color, born, x: 0, y: 0, z: 0, age: 0 });
  }

  /**
   * Funken am Wesen `who` (oder am Punkt `at`, wenn es noch nicht zu sehen ist); `glint`: nur ein kurzes Glitzern, das
   * es auch bei reduzierter Bewegung gibt (dann blitzt es still auf)
   */
  private burst(who: string, colors: readonly string[], n: number, at?: Omit<Body, 'hop'>, glint = false) {
    const b = at ?? this.bodies.get(who);
    if ((this.reduced.matches && !glint) || !b) return;
    const [p, zoom] = [this.project(b.x + 0.5, b.y + 0.5, b.z + 0.8), this.size.zoom];
    this.particles.push(...(glint ? glints(p, colors, zoom, this.reduced.matches) : sparks(p, colors, n, zoom)));
  }

  // ---------- Bild ----------

  private measure() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const [w, h] = [this.canvas.clientWidth, this.canvas.clientHeight];
    if (!w || !h) return;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    // Etwa 18 Felder breit, auf großen Schirmen nicht riesig, auf kleinen nicht winzig
    this.size = { w, h, dpr, zoom: Math.min(1.25, Math.max(0.5, w / (18 * 64))) };
    this.gl3d?.resize(w, h, dpr);
    this.map.width = this.map.height = Math.round(this.map.clientWidth * dpr); // die Karte ist quadratisch
  }

  /** Bildschirmpunkt eines Weltpunkts – aus der 3D-Kamera, sonst aus der Ansicht von vorn */
  private project(x: number, y: number, z: number): [number, number] {
    if (this.r3d) return this.r3d.project(x, y, z);
    const cam = this.camera();
    const { w, h, zoom } = this.size;
    return projection(cam.x + 0.5, cam.y + 0.5, w / 2, h / 2 + 30 * zoom, zoom)(x, y, z);
  }

  private camera() {
    return this.bodies.get('player') ?? { x: this.state.player.x, y: this.state.player.y };
  }

  /**
   * Wesen gleiten zu ihrem Feld; große Sprünge (Aufwachen, Heimkehr) springen direkt. Im Fahrzeug folgt die Figur seinem
   * Sitz; hüpft sie (winkt), hüpft er mit
   */
  private glide(dt: number, now: number) {
    const snap = this.reduced.matches;
    const seat = seatOf(this.rides);
    if (seat) {
      const hop = snap ? 0 : hopOf('player', 0, now - (this.hops.get('player') ?? -1e9));
      this.bodies.set('player', { x: seat.x, y: seat.y, z: seat.z, hop });
      this.rides = withHop(this.rides, hop);
    }
    const targets = new Map<string, { x: number; y: number }>();
    targets.set('player', this.state.player);
    for (const a of this.state.animals) targets.set(a.id, a);
    for (const id of this.bodies.keys()) if (!targets.has(id)) this.bodies.delete(id);
    if (seat) targets.delete('player');
    const poses = postures(this.world, this.state); // Pustewind: zusammenrücken, aufplustern; Eule auf dem Iglu
    for (const [id, t] of targets) {
      const pose = poses.get(id);
      const c = this.world.cell(t.x, t.y); // auf einer Portal-Plattform etwas höher (Sockel bzw. Mittelfeld)
      const ground = (standHeight(this.world, this.state.openGates, t.x, t.y) ?? c.h) + platformLift(c);
      const sits =
        id === 'player' && (now < this.sitUntil || this.pose !== 'stand' || (this.listening && !!this.story.playing)); // müde, lesend, zuhörend
      const z = pose?.z ?? (sits ? ground - 0.35 : ground); // sitzt im Gras
      const [tx, ty] = [t.x + (pose?.dx ?? 0), t.y + (pose?.dy ?? 0)];
      let b = this.bodies.get(id);
      // Weite Wege gleiten bis zum Ziel: an der Weltgrenze zum Warteplatz und zurück, der Pinguin durch den Gang
      const far = this.hops.has(`seat:${id}`) ? 40 : 2.5;
      if (!b || snap || Math.abs(b.x - tx) + Math.abs(b.y - ty) > far) b = { x: tx, y: ty, z, hop: 0 };
      const [dx, dy] = [tx - b.x, ty - b.y];
      const d = Math.hypot(dx, dy);
      const stepLen = SPEED * dt;
      if (d <= stepLen) {
        [b.x, b.y] = [tx, ty];
        this.hops.delete(`seat:${id}`);
      } else {
        b.x += (dx / d) * stepLen;
        b.y += (dy / d) * stepLen;
      }
      b.z += (z - b.z) * Math.min(1, dt * 14);
      const moving = Math.min(1, Math.hypot(tx - b.x, ty - b.y));
      const sung = now - (this.hops.get(id) ?? -1e9);
      const snapped = now - (this.hops.get(`snap:${id}`) ?? -1e9); // Schnapp-Hüpfer beim Füttern (Fisch-, Pilz- und Moosfresser) und beim Naschen am Tropfmoos
      b.hop = snap ? 0 : hopOf(id, moving, sung, snapped); // je Gangart der Art (watscheln, robben, hüpfen …)
      b.puff = pose?.puff ?? 1;
      this.bodies.set(id, b);
    }
  }

  /**
   * Beeren gepflückt, Fische gefangen, nachgewachsen, Eimer geschöpft; Beeren, Fische oder Wasser in den Trog; ein
   * Schneehaufen wächst um eine Kugel (es ploppt, Töne aus dem Welt-Paket, und gleich gespeichert: der Schneemann
   * bleibt); ein Eiszapfen klingt (Ton aus dem Welt-Paket) und glitzert, die Figur läuft weiter; eine Kristallsäule
   * klingt, der Grottenolm taucht am Steg auf, das Netz einer Tupfspinne klingt wie eine Harfe (Bild und Ton aus dem Paket der Höhlenwelt), ein Klingeltor am Glitzergang
   * spielt drei Töne (aus dem Paket der Grubenbahn); die Figur nimmt die
   * Kristall-Laterne (Ton aus dem Paket, sie hüpft, es glitzert)
   */
  private chore(e: ChoreEvent | Extract<GameEvent, { type: PackEvent['type'] | 'bob' | 'edge' }>, now: number) {
    if (e.type === 'bob') return void this.hops.set(e.id, now); // der Pinguin hüpft still neben der Torplatte
    if (e.type === 'edge') return this.edge(e, now); // der Rand einer Welt antwortet (mitwachsen-edge.ts)
    if (reshapes(e)) this.gl3d?.rebuild([chunkOf(e.x, e.y).join(',')]); // leer, wieder voll, gewachsen
    if (packed(e)) this.sfx.score(packScore(this.renderer.views.values(), e)); // Töne aus dem Paket der Welt des Ereignisses
    if (packOnly(e)) return; // Säule, Grottenolm, Netz, Klingeltor: Bild und Ton aus dem Paket
    // Laternen-Tanne angezündet, Leuchtpilz geweckt, Türmchen gewachsen: Es bleibt (Bild und Ton aus dem Paket)
    if (e.type === 'treelamp' || e.type === 'caveshroom' || e.type === 'cavetower') return void this.save();
    if (e.type === 'heave') {
      // Hau-ruck am Höhlentor: Figur und Tok lehnen sich an den Stein (Bild und Ton aus dem Paket der Höhlenwelt)
      if (e.n > 0) this.hops.set('player', now);
      if (e.n > 0 && e.who) this.hops.set(e.who, now);
      return;
    }
    if (e.type === 'lantern') {
      // Kristall-Laterne genommen: Die Figur hüpft, es glitzert (der Lichtkreis wächst im Bild des Pakets)
      this.hops.set('player', now);
      return this.burst('player', LANTERN_SPARKS, 12);
    }
    if (e.type === 'icicle')
      return this.burst('', SPARKS.eis, 6, { x: e.x, y: e.y - 0.35, z: this.world.cell(e.x, e.y).h }, true);
    if (e.type === 'regrow') return;
    if (e.type === 'pick' || e.type === 'catch' || e.type === 'gather' || e.type === 'fill' || e.type === 'snowman') {
      // Die Figur hüpft vor Freude: Beeren springen heraus, Fische platschen, Leuchtpilze hüpfen in den Korb, beim
      // Schöpfen spritzen Tropfen, Schnee stiebt
      if (e.type !== 'snowman') this.sfx[e.type]();
      this.hops.set('player', now);
      this.burst('player', SPARKS[e.type === 'snowman' ? 'snow' : e.type], 12);
      if (e.type === 'snowman') this.save();
      return;
    }
    // Alle Tiere der Wiese hüpfen und bekommen ein Herz
    this.sfx[e.type === 'feed' ? 'feed' : 'pour']();
    // Fischfresser schnappen nach Fisch, Pilzfresser naschen Pilze, Moosfresser am Tropfmoos des Steintrogs
    const food = e.type === 'feed' ? e.food : 'water';
    this.burst('player', SPARKS[e.type === 'feed' ? e.food : 'pour'], 16);
    e.ids.forEach((id, i) => {
      this.hops.set(id, now);
      if (snaps(id, food)) this.hops.set(`snap:${id}`, now + SNAP_DELAY);
      this.float('heart', id, GAME_COLORS.heart, now + 100 + i * 60);
    });
  }

  /** Am Klangstein: Noten steigen auf, solange die Figur zuhört; Menü oder Hinweis halten die Geschichte an */
  private storyFrame(t: number) {
    if (this.paused()) this.story.stop();
    const fresh = this.floats.some((f) => f.kind === 'note' && f.who === 'player' && t - f.born < 900);
    if (this.listening && this.story.playing && !fresh && !this.reduced.matches)
      this.float('note', 'player', NOTE_COLORS.top, t);
  }

  /** Je Bild: Klangsteine, dazu Töne der Umgebung aus den Welt-Paketen */
  private sounds(t: number) {
    this.storyFrame(t);
    this.ambient(t);
    if (this.state.sleeping) this.sfx.score(this.nights.tones((t - this.nightSince) / 1000)); // „Gute Nacht“
  }

  /** Töne der Umgebung aus den Welt-Paketen (Grotte: „plink“ der Tropfsteine), nur, solange gespielt wird */
  private ambient(t: number) {
    if (!this.paused() && !this.state.sleeping)
      this.sfx.score(this.renderer.all((v) => v.ambient?.(this.world, this.state, t, this.seen) ?? []));
  }

  /** Im Bett oder eingenickt über dem Buch: ab und zu steigt ein Zzz auf (nicht bei reduzierter Bewegung) */
  private dozeFrame(t: number) {
    const dozing = this.state.sleeping || this.pose === 'doze';
    if (dozing && !this.floats.some((f) => f.kind === 'zzz' && t - f.born < 1000) && !this.reduced.matches)
      this.floats.push({
        kind: 'zzz',
        who: this.state.sleeping ? 'bed' : 'player',
        color: GAME_COLORS.star,
        born: t,
        x: this.state.player.x, // im Schlaf liegt die Figur im Bett ihrer Gegend: Dort steigt das Zzz auf
        y: this.state.player.y,
        z: 0,
        age: 0,
      });
  }

  private frame(t: number) {
    // Eine Uhr für alles: Tasten, Ereignisse und Bild laufen über performance.now(). Die Bildzeit von rAF kann auf dem
    // Mac weit davon abweichen (z. B. nach dem Ruhezustand); dann lief ein gehaltener Pfeil nie weiter.
    if (!this.manual) this.raf = requestAnimationFrame(() => this.frame(performance.now()));
    const dt = Math.min(0.05, (t - (this.lastFrame || t)) / 1000);
    this.lastFrame = t;
    if (!this.size.w) this.measure();
    if (!this.size.w) return;
    // Gehaltener Pfeil oder gemerkter Tipp: im ruhigen Takt weiterlaufen (sitzt die müde Figur, verwirft apply den Schritt)
    const next = this.paused() ? null : this.pace.poll(t);
    if (next) this.apply({ type: 'move', dir: next });
    // Nacht blendet ein und aus (ohne Überblendung bei reduzierter Bewegung)
    const fade = (since: number, ms: number) => (this.reduced.matches ? 1 : Math.min(1, (t - since) / ms));
    const night = this.state.sleeping ? fade(this.nightSince, 1500) : 1 - fade(this.dayAt, 900);
    this.rideFrame(t, night);
    this.glide(dt, t);
    this.sounds(t);

    const bump = t - (this.hops.get('bump') ?? -1e9);
    const shake = !this.reduced.matches && bump < 200 ? Math.sin(bump / 18) * 0.06 * (1 - bump / 200) : 0;
    const player = this.bodies.get('player')!;
    const cam = { x: player.x + shake, y: player.y };

    this.pose = restPose(this.state, this.paused(), t - this.lastInput);
    this.dozeFrame(t);

    // Schwebende Herzen und Noten folgen ihrem Wesen
    this.floats = this.floats.filter((f) => t - f.born < 1300);
    const floats: Float[] = [];
    for (const f of this.floats) {
      if (t < f.born) continue;
      const b =
        f.who === 'bed'
          ? { x: f.x, y: f.y, z: 1.3, hop: 0 }
          : f.who === 'spot'
            ? { x: f.x, y: f.y, z: f.z, hop: 0 }
            : this.bodies.get(f.who!);
      if (!b) continue;
      floats.push({ ...f, x: b.x, y: b.y, z: b.z + (f.who === 'player' ? 1.5 : 0.9), age: t - f.born });
    }
    this.particles = fly(this.particles, dt);

    const gates = new Map<string, number>();
    // in Takten seit dem Aufschwingen (Schritte von 0,1 s; die 3D-Ansicht baut ohnehin nur in Zehnteln neu)
    for (const [id, at] of this.gates)
      gates.set(id, at ? Math.max(0, fade(t - (this.state.tick - at) * TICK_MS, 900)) : 1);
    // ein Tor, das ein Paket Stück für Stück öffnet (Hau-ruck: der Rollstein des Höhlentors in Dritteln)
    const ajar = this.renderer.first((v) => v.ajar?.(this.state, this.reduced.matches));
    if (ajar) gates.set(ajar[0], ajar[1]);

    const { dpr, w, h, zoom } = this.size;
    const mood = this.world.climate(Math.round(player.x), Math.round(player.y));
    const realm = this.world.realm(Math.round(player.x), Math.round(player.y));
    const { weather, glance, aurora } = this.air.frame(this.world, this.state, this.paused(), this.reduced.matches);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    const scene: Scene = {
      width: w,
      height: h,
      zoom,
      cam,
      bodies: this.bodies,
      gates: gates as Scene['gates'],
      // die Grotte bleibt hell wie die Dämmerung; im Tunnel gedimmt, nie dunkler als sie
      night: tunnelNight(nightIn(realm, night), this.dimFrame(dt)),
      evening: rideLight(0, evening(this.tired), this.state.sleeping, this.state.late).evening,
      weather,
      aurora: aurora * night,
      glance,
      pose: this.pose,
      mood,
      realm,
      lit3d: !!this.r3d,
      wind: this.reduced.matches ? 0 : windAt(mood, weather),
      floats,
      particles: this.particles,
      now: t,
      look: LOOK,
      reduced: this.reduced.matches,
      bottomInset: this.touchUi.offsetParent ? this.touchUi.offsetHeight + 16 : 0,
      explored: this.seen,
      away: (x, y) => !this.reduced.matches && awayIn(this.renderer.views.values(), x, y, t), // Fledermaus auf Runde
      // Torplatte unter den Füßen (wo der Körper gerade ist, nicht das Ziel des Schritts): Ton, einsinken
      plate: this.plates(this.world, player, this.state.sleeping, this.packs.loaded, t),
      hint: this.hint(t), // „noch nicht“ an den Toren
      rides: this.rides,
    };
    this.postcard(postcard(scene.plate, t, this.world.gates), gates);
    if (this.r3d) {
      // 3D-Welt, darüber die durchsichtige 2D-Ebene mit Zeichen, Pfeil, Nacht und Leiste
      this.r3d.render(this.world, this.state, scene);
      this.ctx.clearRect(0, 0, w, h);
      this.renderer.overlay(this.world, this.state, scene, this.r3d.project, this.r3d.halos(), this.r3d.haloView());
    } else this.renderer.draw(this.world, this.state, scene);
    if (t - this.lastMap > 100) this.drawMiniMap(player, dpr, t); // Karte etwa zehnmal pro Sekunde
  }

  /** Karte oben rechts, um die gleitende Figur; dazu die Zeichen gefundener Sehenswürdigkeiten (mitwachsen-sight.ts) */
  private drawMiniMap(player: { x: number; y: number }, dpr: number, t: number) {
    this.lastMap = t;
    const [ctx, now] = [this.mapCtx, this.reduced.matches ? 0 : t];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const marks = marksOf(this.state, this.world, sightsOf(this.packs.loaded));
    drawMap(ctx, this.world, this.state, player.x, player.y, this.map.clientWidth, this.seen, now, marks);
  }

  /**
   * Postkarte der Torfront nach 1 s auf einer Platte (`id`), in 3D vor dem Bild, das die Ecke übermalt, die sie braucht;
   * mitwachsen-card.ts lädt erst mit der ersten Postkarte nach
   */
  private postcard(id: GateId | null, open: Map<string, number>) {
    this.card(id)?.(id, this.world, this.state, this.r3d, open, this.renderer.guestAt);
  }

  // ---------- Kopf und Menü ----------

  private renderName() {
    showName(this.querySelector('.mw-name'), this.saved.figureName);
  }

  private async openMenu() {
    if (this.menu.open) return;
    this.pace.clear();
    this.save();
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    // Erst füllen, dann zeigen: Beim ersten Öffnen lädt der Inhalt nach, ein leeres Menü soll niemand sehen
    await this.renderMenu();
    if (this.menu.open) return; // zweimal schnell aufs Zahnrad
    // Ohne Fokus auf dem Zahnrad gibt der Dialog beim Schließen keinen Fokus dorthin zurück
    (document.activeElement as HTMLElement | null)?.blur();
    this.menu.showModal();
  }

  /**
   * Menü füllen, nachgeladen mit seinen seltenen Handgriffen (mitwachsen-menu.ts); `flip`: Elternschalter „Kamera
   * bewegen“ oder „Höhle dunkel“ vorher umlegen
   */
  private async renderMenu(flip?: 'motion' | 'cave') {
    (await import('./mitwachsen-menu').catch(noop))?.renderMenu(
      this.menu,
      this.store,
      this.saved,
      this.sfx.muted,
      flip,
    );
  }

  /** Welt löschen mit Rückfrage im Menü: erster Klick fragt, zweiter löscht (innerhalb von 4 Sekunden) */
  private async removeWorld(button: HTMLElement, id: string) {
    const { confirmDelete } = await import('./mitwachsen-menu'); // seltene Handgriffe im Menü: erst jetzt geladen
    if (!confirmDelete(button)) return;
    const index = deleteWorld(this.store, id);
    // Die gespielte Welt ist weg: zur nächsten wechseln oder eine neue anlegen
    if (id === this.saved.id) void this.openWorld(index.current);
    else void this.renderMenu();
  }

  private menuClick(e: Event) {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-world], [data-act], [data-delete]');
    if (!t) return;
    if (t.dataset.delete) {
      void this.removeWorld(t, t.dataset.delete);
      return;
    }
    if (t.dataset.world && t.dataset.world !== this.saved.id) {
      this.save();
      void this.openWorld(t.dataset.world);
      return;
    }
    switch (t.dataset.act) {
      case 'new':
        this.save();
        this.saved = newWorld(
          randomId(),
          randomSeed(),
          `Welt ${loadIndex(this.store).worlds.length + 1}`,
          this.saved.figureName,
        );
        saveWorld(this.store, this.saved);
        void this.openWorld(this.saved.id);
        break;
      case 'copy': {
        // Schreiben noch in der Geste des Klicks (Safari verlangt das), erst danach das Menü-Modul laden
        const written = (async (code: string) => navigator.clipboard.writeText(code))(worldCode(this.saved.seed));
        void import('./mitwachsen-menu').then((m) => m.copyCode(t, written, this.menu), noop);
        break;
      }
      case 'sound':
        this.sfx.muted = !this.sfx.muted;
        try {
          this.store.setItem('larmic.games.muted', this.sfx.muted ? '1' : '0');
        } catch {
          /* egal */
        }
        if (this.sfx.muted) this.sfx.suspend();
        else this.sfx.unlock();
        void this.renderMenu();
        break;
      case 'motion': // Elternschalter „Kamera bewegen“ (im Menü-Modul, an der Spielfläche für die 3D-Ansicht)
        void this.renderMenu('motion');
        break;
      case 'cave': // Elternschalter „Höhle dunkel“ (im Menü-Modul, an der Spielfläche für die Dunkelmaske der Grotte)
        void this.renderMenu('cave');
        break;
      case 'fullscreen':
        this.menu.close();
        this.requestFullscreen?.().catch(() => {});
        break;
      case 'close':
        this.menu.close();
        break;
      case 'info':
        this.menu.close();
        this.openInfo();
        break;
    }
  }

  private menuChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.id === 'mw-world-name') this.saved = { ...this.saved, worldName: cleanName(input.value, 'Meine Welt') };
    else if (input.id === 'mw-figure-name')
      this.saved = { ...this.saved, figureName: cleanName(input.value, DEFAULT_FIGURE) };
    else return;
    this.save();
    this.renderName();
    void this.renderMenu();
  }
}

if (!customElements.get('larmic-mitwachsen')) customElements.define('larmic-mitwachsen', LarmicMitwachsen);
