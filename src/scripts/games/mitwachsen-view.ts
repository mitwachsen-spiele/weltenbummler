// Haken der 2D-Ansicht für die Welten hinter den Toren: Was nur eine Welt zeigt (Eis-Welt: Iglu, Eisschale, Eistrog,
// Fischkiste, Rutschspur, Wetter, Bild der Weltgrenze), zeichnet ihr Welt-Paket (worlds/<welt>/view-2d.ts, mit dem Paket
// nachgeladen). Der Kern kennt nur die Haken: je Deko-Art eine Zeichnung (`drawDeco`), solange das Paket lädt ein
// einfacher Block in Kartenfarbe. Gleich für 2D und die Ebene über 3D (dort nur Wetter und Leiste).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import { box, type Fine, type FinePainter, type Projection } from '../../lib/games/front';
import { MARK_FRINGE, softMark } from '../../lib/games/shade';
import type { GateId, RegionId, SpeciesId } from '../../data/games/mitwachsen';
import type { HeraldEvent } from './mitwachsen-herald';
import type { Deco } from './mitwachsen-cell';
import type { PackEvent, RideEvent } from './mitwachsen-pack-types';
import type { GoodNight, RideAt, RideBody, RideFx } from './mitwachsen-ride-view';
import type { Guest } from './mitwachsen-guest-look';
import { mapColor } from './mitwachsen-map';
import type { SkyScene } from './mitwachsen-sky';
import type { State } from './mitwachsen-state';
import type { Cell, World } from './mitwachsen-world';
import type { Scored, Sfx } from './sfx';
import type { Hint } from './mitwachsen-guide';
import type { PlateLook } from './mitwachsen-plate';

/**
 * Quader: x (rechts), y (nach vorn), z (Höhe), Breite, Tiefe, Höhe, Farbe der Seiten und oben, Art in 3D: `see` wird
 * vor der Figur durchsichtig (wie Laub und der Hut des Riesenpilzes), `sway` wiegt sich im Wind (wie die Grasbüschel),
 * `glow` leuchtet aus sich selbst, so hell, wie das Paket sagt (`View3D.glow`; Eiskristalle beim Polarlicht); zuletzt
 * die Feinheit (`Fine`: Muster, Leuchten kompakter Teile), die erst ein feiner Maler zeigt
 */
export type Box = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  string,
  string,
  ('see' | 'sway' | 'glow')?,
  Fine?,
];

/**
 * Töne zu einem Ereignis aus den Regeln einer Welt: Jedes geladene Paket wird gefragt und antwortet nur auf die
 * Ereignisse seiner Welt (Eis-Welt: Eiszapfen, Schneemann; Grotte: Säule, Grottenolm), so stört keins das andere
 */
export const packScore = (views: Iterable<View2D>, e: PackEvent): Scored[] =>
  [...views].flatMap((v) => v.score?.(e) ?? []);

/** Ist das Tier am Sitzplatz (x, y) gerade nur im Bild eines Pakets unterwegs (`View2D.away`)? */
export const awayIn = (views: Iterable<View2D>, x: number, y: number, now: number) =>
  [...views].some((v) => v.away?.(x, y, now) ?? false);

/**
 * Einen Quader von vorn zeichnen (nichts, wenn keiner da ist); `painter` wie bei `box` (undefined: der Maler des
 * Kontexts, null: flach, etwa Böden)
 */
export function drawBox(
  ctx: CanvasRenderingContext2D,
  P: Projection,
  b: Box | null | undefined,
  painter?: FinePainter | null,
) {
  if (b) box(ctx, P, b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[9], painter);
}

/**
 * Flache Marke am Boden (Kufenspur, Schneefleck am Halt) mit weichem Rand (Entwurf „Feine Grafik“): zuerst der um den
 * Saum gewachsene Quader halb durchsichtig (`softMark`, `MARK_FRINGE`), dann die Marke selbst, flach. Läuft sie über die
 * ganze Länge eines Felds, bleibt diese Achse hart (sonst Lücken zwischen den Feldern)
 */
export function drawMark(ctx: CanvasRenderingContext2D, P: Projection, b: Box) {
  const [x, y, z, w, d, h, side, top] = b;
  const s = softMark(x, y, w, d);
  if (s.w !== w || s.d !== d) {
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * MARK_FRINGE;
    drawBox(ctx, P, [s.x, s.y, z, s.w, s.d, h, side, top], null);
    ctx.globalAlpha = a;
  }
  drawBox(ctx, P, b, null);
}

/**
 * Was eine Zeichnung vom Bild weiß: Zeit, reduzierte Bewegung, geleerte Büsche und Fischkisten ("x,y"), Zustand der
 * Welt-Pakete (`State.packs`, Eis-Welt: wie weit jeder Schneemann gewachsen ist), wie weit ein Bote mit seiner Arbeit ist
 * (`work`, 0 … 1, `workOf` in mitwachsen-herald.ts; Tok baut: Die Gleiswelle läuft; ohne: er baut nichts)
 */
export type DecoAt = {
  now: number;
  reduced: boolean;
  picked: Readonly<Record<string, number>>;
  packs: Readonly<Record<string, unknown>>;
  work?: number;
};

/** Zeichnung einer Deko-Art: Quader, die in der Reihe ihrer Vorderkante drankommen; null: wie sonst zeichnen */
export type DrawDeco = (world: World, c: Cell, x: number, y: number, at: DecoAt) => readonly Box[] | null;

/** Was sich die Leiste über das Umklappen merkt: welche Gegend sie zeigt, welche davor und seit wann */
export type Turn = { shown?: RegionId; from?: RegionId; at?: number };

/**
 * Wetter und Bild der Weltgrenze einer Welt: was Ansicht, Leiste und Töne beim Öffnen ihres Tors vom Paket brauchen.
 * Der Kern kennt nur diese Form, jede Welt füllt sie in ihrem Paket (Eis-Welt: worlds/eis/view-2d.ts).
 */
export type Sky = {
  /**
   * Wetter in der Luft (die Ansicht ruft es, sobald die Welt Plätze hat); `state`: der Zustand (Grotte: Lichtkreis um die
   * Figur, größer mit der Kristall-Laterne)
   */
  weather(ctx: CanvasRenderingContext2D, world: World, sc: SkyScene, P: Projection, state?: State): void;
  /** Licht am Nachthimmel (Eis-Welt: Polarlicht über dem Schneebett, dazu leuchten in 2D die Eiskristalle) */
  aurora(ctx: CanvasRenderingContext2D, sc: SkyScene, P: Projection): void;
  /** Pfeil zum Tor über einem wartenden Tier (bei hx, hy) */
  waitArrow(
    ctx: CanvasRenderingContext2D,
    world: World,
    P: Projection,
    a: { x: number; y: number; realm: RegionId },
    b: { x: number; y: number; z: number },
    head: readonly [number, number],
    px: number,
  ): void;
  /** Zeichen der Gegend in der Leiste, unten mittig bei (cx, bottom), `size` breit */
  realmSign(ctx: CanvasRenderingContext2D, realm: RegionId, cx: number, bottom: number, size: number): void;
  /** Umklappen der Leiste beim Wechsel der Gegend: gezeigte Gegend und wie weit die Leiste offen ist (0 … 1) */
  turnAlbum(t: Turn, realm: RegionId, now: number, reduced: boolean): [RegionId, number];
  /** Gast am Tor der Welt (der führende Pinguin), sonst null */
  guestAt(world: World, state: State): Guest | null;
  /** Töne beim Öffnen des Tors; `at`: Takte (0,1 s), bis die Flügel aufschwingen (sonst 12, also 1,2 s) */
  gateScore(at?: number): Scored[];
};

/**
 * Spuren am Boden einer Welt (Eis-Welt: Fußspuren im Schnee), nur Bild: `step` je Bild (in beiden Ansichten), `draw`
 * in 2D je Reihe nach ihrem Boden
 */
export type Trail = {
  step(world: World, state: State, sc: SkyScene): void;
  draw(ctx: CanvasRenderingContext2D, world: World, P: Projection, y: number): void;
};

/**
 * Gleis auf einem Feld mit Strecke (`Cell.ride`, Paket der Bahn): seine Quader (Schwellen, Schienen, Prellbock,
 * Tunnelportal, Einschnitt), je nach Ausbau im Zustand der Pakete (`at.packs`) und, solange gebaut wird, wie weit die
 * Gleiswelle ist (`at.work`; bei reduzierter Bewegung in Stufen, `at.reduced`); null: dort liegt (noch) nichts, das Feld
 * zeigt sich wie sonst. Gleich für 2D und 3D. Liegt Gleis, zeigt das Feld weder Grasbüschel noch Blumen
 */
export type DrawRails = (
  c: Cell,
  x: number,
  y: number,
  at: Pick<DecoAt, 'packs' | 'reduced' | 'work'>,
) => readonly Box[] | null;

/**
 * Wann die 2D-Ansicht das Gleis eines Felds zeichnet: sonst in der Reihe seiner Vorderkante (`later`, wie die Dinge der
 * Welt-Pakete) statt Büscheln, Blumen und Deko; auf einem Feld des Tors (die Tür des Höhlentors auf der Spur u −2) gleich
 * (`now`) und danach die Tür darüber (`deco`), sonst fehlte ihr dort ein Streifen, solange sie zu ist oder aufgeht
 */
export function railsOrder(
  c: Cell,
  rails: readonly Box[],
): { now: readonly Box[]; later: readonly Box[]; deco: boolean } {
  return c.gate ? { now: rails, later: [], deco: true } : { now: [], later: rails, deco: false };
}

/** Weicher Fleck am Boden unter einem Teil des Gleises: Mitte (x, y), Höhe des Bodens, Halbbreite */
export type RailFoot = readonly [number, number, number, number];
/**
 * Ab `low` steht ein Teil des Gleises (Prellbock, Pfeiler des Tunnelportals; Schwellen sind flacher), bis `long` ist es
 * kompakt; unter `full` (Höhe des Prellbocks) wird sein Fleck mit der Höhe kleiner, so schrumpft er beim Versinken stetig
 */
const RAIL_STANDS = { low: 0.1, full: 0.45, long: 0.9 } as const;
/**
 * Wo das Gleis eines Felds einen weichen Fleck auf den Boden wirft (nur 2D; in 3D macht das die Sonne): unter jedem
 * stehenden, kompakten Teil, das auf dem Boden steht (Prellbock, Pfeiler des Portals), nicht unter Schwellen, Schienen,
 * dem Sturz oder den langen Wänden des Einschnitts; ein niedriges Teil (versinkender Prellbock, Bau 2) mit kleinerem Fleck
 */
export const railFeet = (c: Pick<Cell, 'h'>, boxes: readonly Box[]): RailFoot[] =>
  boxes
    .filter((b) => Math.abs(b[2] - c.h) < 1e-9 && b[5] >= RAIL_STANDS.low && Math.max(b[3], b[4]) <= RAIL_STANDS.long)
    .map((b): RailFoot => [
      b[0] + b[3] / 2,
      b[1] + b[4] / 2,
      c.h,
      ((b[3] + b[4]) / 4) * Math.min(1, b[5] / RAIL_STANDS.full),
    ]);

/**
 * Gleis eines Felds mit Strecke (`Cell.ride`) in 2D zeichnen (`railsOrder`; `rails` fragt die Pakete, nur dort): gleich
 * oder in `later`; false, wenn das Feld sonst nichts mehr zeigt (liegt kein Gleis, true). `shadow` zeichnet vorher
 * die weichen Flecken unter stehenden Teilen (`railFeet`)
 */
export function placeRails(
  ctx: CanvasRenderingContext2D,
  P: Projection,
  c: Cell,
  rails: () => readonly Box[] | null | undefined,
  later: Box[],
  shadow?: (foot: RailFoot) => void,
): boolean {
  const boxes = c.ride ? rails() : null;
  if (!boxes) return true;
  if (shadow) for (const f of railFeet(c, boxes)) shadow(f);
  const order = railsOrder(c, boxes);
  for (const b of order.now) drawBox(ctx, P, b);
  later.push(...order.later);
  return order.deco;
}

/** Zeichenteile einer Welt aus ihrem Paket (ein Paket ohne eigene Welt, die Bahn, hat keinen Himmel, `sky`) */
export type View2D = {
  /** je Deko-Art, die nur diese Welt hat, ihre Zeichnung */
  decos: Partial<Record<Deco, DrawDeco>>;
  /**
   * flach auf dem Boden eines Felds (Rutschspur, glänzt bei offenem Tor der Welt; Lichtfleck der Grotte, am Abend
   * `evening` golden-orange), sonst null
   */
  ground(c: Cell, x: number, y: number, open: boolean, evening?: number): Box | null;
  /** Gleis auf Feldern mit Strecke (Paket der Bahn) */
  rails?: DrawRails;
  sky?: Sky;
  /** Himmel hinter der Welt in 2D (drei Streifen von oben), solange die Figur in ihr ist (Grotte), sonst blau */
  heaven?: readonly string[];
  /** Wasser dieser Welt (Grotte: türkis): Farbe und Glanz, sonst blau wie überall */
  water?: readonly [string, string];
  trail?: Trail;
  /**
   * Töne zu Ereignissen der Regeln dieser Welt (Eis-Welt: Ploppen, wenn ein Schneemann wächst); ein Ereignis einer
   * anderen Welt: undefined. Gefragt werden alle geladenen Pakete (`packScore`)
   */
  score?(e: PackEvent): Scored[] | undefined;
  /**
   * Sitzplatz (x, y), dessen Tier gerade nur im Bild dieses Pakets unterwegs ist (Grotte: die verschlafene Fledermaus auf
   * ihrer Runde): Die Ansichten zeichnen es solange nicht an seinem Platz (nicht bei reduzierter Bewegung)
   */
  away?(x: number, y: number, now: number): boolean;
  /**
   * Töne der Umgebung, je Bild gefragt, solange das Spiel läuft (nicht im Menü, nicht im Schlaf), in beiden Ansichten
   * (Grotte: „plink“ der Tropfsteine); `explored`: was die Figur schon kennt (aus dem Nebel kommt nichts); meist leer
   */
  ambient?(world: World, state: State, now: number, explored: (x: number, y: number) => boolean): readonly Scored[];
  /** Klang der Torplatte vor dem Tor dieser Welt statt des Klonks (Eis-Welt: Klirren; `plateTones` in sfx.ts) */
  clink?: readonly Scored[];
  /** Schmuck der Torplatte vor dem Tor dieser Welt (Eis-Welt: Scholle mit Schneeflocke; wie `GateLook.plate` in 3D) */
  plate?: PlateLook;
  /**
   * „Noch nicht“ am Tor dieser Welt, je Bild gefragt (Eis-Welt: worlds/eis/mitwachsen-plate-hint.ts): Steht die Figur
   * auf seiner Torplatte und fehlt noch etwas, zeigt es das in Bild und Ton (`now` ms, reduzierte Bewegung) und lichtet
   * den Nebel im Gang bis zur Mündung (`lift(true)`); liefert, was das Bild zeigt. Dreht die 3D-Ansicht (`r3d`) zur
   * Torfront, wartet es, bis sie angekommen ist
   */
  hint?(
    state: State,
    world: World,
    now: number,
    reduced: boolean,
    sfx: Pick<Sfx, 'score'>,
    lift: (peek: true) => void,
    r3d?: { arrived(): boolean } | null,
  ): Hint;
  /**
   * Fahrzeug dieser Welt (Eis-Welt: Schlitten, worlds/eis/mitwachsen-sled-look.ts; Bahn: Zug,
   * worlds/bahn/mitwachsen-train-look.ts; Haken in mitwachsen-ride-view.ts), gleich für 2D und 3D: Körper je Bild
   * (Fahrzeug samt sitzender Figur, Zugtier, Laternenpfahl), flache Marken am Boden (Spur, Fleck am Halt) und Ton, Hüpfer,
   * Herz und Funken zu jedem seiner Ereignisse (ein Ereignis eines anderen Fahrzeugs: undefined)
   */
  bodies?(state: State, world: World, at: RideAt): readonly RideBody[];
  marks?(state: State, world: World): readonly Box[];
  rideFx?(e: RideEvent, state: State): RideFx | undefined;
  /**
   * „Gute Nacht, Fahrzeuge“: Schläft die Figur im Bett der Lichtung und steht sein Fahrzeug in Sichtweite (`bedSight` in
   * mitwachsen-ride-kit.ts), seine Töne dazu (Zug: Pfiff; die Spielseite reiht alle nacheinander, höchstens 4 s, und
   * macht danach sein Licht aus); sonst undefined. Gefragt einmal beim Einschlafen
   */
  goodNight?(state: State, world: World): GoodNight | undefined;
  /**
   * Licht der Szene (1 wie immer): Fährt die Figur durch einen Tunnel (Bahn: Tunnelportal, Einschnitt, Gang), dimmt es
   * auf das 0,7-Fache, nie dunkler als die Dämmerung (`tunnelNight` in mitwachsen-dusk.ts), in 2D und 3D gleich
   */
  dim?(state: State, world: World): number;
  /**
   * Tor dieser Welt, das ihr Paket gerade Stück für Stück öffnet, und wie weit (0 … 1, wie die Ansicht ihn sonst führt):
   * das Hau-ruck am Höhlentor rollt den Stein in Dritteln (worlds/hoehle/mitwachsen-heave-look.ts); null: keins. Je Bild
   * gefragt, gilt in 2D, 3D und auf der Postkarte; bei reduzierter Bewegung springt es
   */
  ajar?(state: State, reduced: boolean): readonly [GateId, number] | null;
  /**
   * Bote dieser Welt (Bahn: Tok, worlds/bahn/mitwachsen-tok-look.ts; Grubenbahn: der Maulwurf gräbt,
   * worlds/grube/mitwachsen-dig-look.ts): Ton, Hüpfer, Herz und Funken zu seinen Ereignissen (eines anderen: undefined)
   */
  heraldFx?(e: HeraldEvent, state: State): RideFx | undefined;
  /**
   * Was dem Tor `gate` als nächster Schritt fehlt, wenn es eines ist, das nie aufgeht (Bahn: am Höhlentor Tok, solange
   * nichts gebaut ist): „noch nicht“ zeigt dann seinen Umriss statt des Zeichens der Welt (mitwachsen-hint-look.ts)
   */
  lacks?(state: State, gate: GateId): SpeciesId | undefined;
};

/** Deko-Arten, die nur ein Welt-Paket zeichnet: Ohne seine Zeichnung steht dort ein einfacher Block */
const PACKED: ReadonlySet<Deco> = new Set<Deco>([
  'igloo',
  'icebowl',
  'fishcrate',
  'snowheap',
  'shroombowl',
  'shroombed',
  'dripspring',
  'stonetrough',
  'shed',
  'cavelamp',
  'torch',
  'column',
  'crystalarch',
  'crystalbush',
  'lantern',
  'waterfall',
  'web',
  'sleepshroom',
  'crystalheap',
  'echostone',
]);

/**
 * Quader eines Dings, das ein Welt-Paket zeichnet (`view`, null solange es lädt): seine Zeichnung je Deko-Art, ohne sie
 * ein einfacher Block in der Farbe der Karte. null: kein Ding eines Pakets, die Ansicht zeichnet wie sonst. Gleich für
 * 2D und 3D (dort mit den Zeichnungen aus dem 3D-Teil des Pakets, `View3D.decos`).
 */
export function drawDeco(
  view: Pick<View2D, 'decos'> | null,
  world: World,
  c: Cell,
  x: number,
  y: number,
  at: DecoAt,
): readonly Box[] | null {
  if (!c.deco) return null;
  const draw = view?.decos[c.deco];
  if (draw) return draw(world, c, x, y, at);
  if (!PACKED.has(c.deco)) return null;
  const color = mapColor(c);
  return [[x + 0.15, y + 0.15, c.h, 0.7, 0.7, 0.5, color, color]];
}
