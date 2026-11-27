// Welt-Pakete laden (Browser): per import() aus dem Netz oder dem Cache des Service Workers, je Paket ein Lader
// (`LOADERS`), aber erst, wenn sein Tor eine Rolle spielt (`needsPack`, mitwachsen-pack.ts; jedes Paket für sich) oder
// die Figur 6 Felder vor dem Halt eines Fahrzeugs steht, das es braucht (`RIDE_PRELOAD`, mitwachsen-preload.ts). Braucht eine Welt das Paket schon beim Öffnen, wartet der Start
// höchstens `PACK_WAIT_MS` darauf; sonst kommt es im Takt nach, sobald es nötig wird, und wird in die laufende Welt
// eingebaut (`arrive`). Scheitert das Laden, läuft das Spiel ohne diese Welt weiter, still wie ohne WebGL: Hinter ihrem
// Tor steht eine Eisklippe, der Spielstand behält alles; beim nächsten Bedarf (frühestens nach `RETRY_MS`) neu versucht.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import type { Part } from '../../lib/games/front';
import { REGIONS, SPECIES, type GateId, type SpeciesId } from '../../data/games/mitwachsen';
import type { GuideRules, Hint } from './mitwachsen-guide';
import { bahnWanted, fahrtWanted, needsPack, type GateAt, type Need } from './mitwachsen-pack';
import type { PackId, WorldPack } from './mitwachsen-pack-types';
import type { RideEngine, Vehicle } from './mitwachsen-rider';
import type { Sight } from './mitwachsen-sight';
import type { HeraldRules } from './mitwachsen-herald';
import type { View2D } from './mitwachsen-view';
import type { View3D } from './mitwachsen-view-3d';
import { beyondRing } from './mitwachsen-world';

/** Ein geladenes Welt-Paket mit den Regeln und Zeichenteilen, die es der Ansicht mitbringt (3D-Teil auf Abruf) */
export type LoadedPack = WorldPack<GuideRules, View2D, View3D, RideEngine, HeraldRules, Vehicle, Sight>;

/**
 * Ein neuer echter Spieltag (mehr als `BREAK` Pause, mitwachsen-tired.ts): Zustand der Pakete nach den Haken `dawn` der
 * geladenen Pakete (Bahn: Tok, der am Abend schlafend kam, wacht auf); ohne Haken bleibt er, wie er ist. Der Maulwurf
 * der Grubenbahn wartet seit Issue 14 auf keinen Spieltag mehr
 */
export const dawnOf = (packs: readonly Pick<LoadedPack, 'dawn'>[], saved: Record<string, unknown>) =>
  packs.reduce((p, pack) => pack.dawn?.(p) ?? p, saved);

/** So lange wartet der Start höchstens auf ein Paket, das die Welt gleich braucht; dann geht es ohne los */
export const PACK_WAIT_MS = 4000;
/** Nach einem gescheiterten Laden frühestens so viel später wieder versuchen */
export const RETRY_MS = 30_000;

/**
 * Ein Lader je Welt-Paket (per import(), einziger Einstieg `worlds/<welt>/index.ts`). Eine Gegend ohne Eintrag hat noch
 * kein Paket: Hinter ihrem Tor baut die Welt dann, was ohne Paket dort steht (mitwachsen-behind.ts). Das Paket der
 * Höhlenwelt (die Kristallgrotte) wie jede Welt hinter einem Tor mit Schlüssel (`needsPack`) oder vor einem Halt des
 * Zugs (`preloadOf`); das Paket der Bahn (Tok, Gleis, Zug), sobald das Eistor offen ist (`bahnWanted`); das Paket der
 * Fahrzeuge (die Fahr-Engine), sobald es ein Fahrzeug geben kann (`fahrtWanted`); das Paket der Grubenbahn (Gleis und
 * Bähnchen Funkel in der Grotte) mit der Grotte (`ALONG`). Der Entwickler-Schalter holt seine Pakete auch ohne Bedarf
 * (`Packs.extra`).
 */
const LOADERS: Partial<Record<PackId, () => Promise<LoadedPack>>> = {
  eis: () => import('./worlds/eis').then((m) => m.pack),
  hoehle: () => import('./worlds/hoehle').then((m) => m.pack),
  bahn: () => import('./worlds/bahn').then((m) => m.pack),
  fahrt: () => import('./worlds/fahrt').then((m) => m.pack),
  grube: () => import('./worlds/grube').then((m) => m.pack),
};
/** Pakete, die immer mit einem anderen kommen: die Grubenbahn mit der Grotte (dort liegt ihre Schleife) */
export const ALONG: Partial<Record<PackId, PackId>> = { grube: 'hoehle' };
/** Die Pakete, die es gibt (je Lader eines) */
export const PACK_IDS = Object.keys(LOADERS) as PackId[];
/** Ein Paket holen; ohne Lader scheitert es (wie ein Netzfehler) */
const loadPack = (id: PackId) => LOADERS[id]?.() ?? Promise.reject(new Error(`kein Welt-Paket ${id}`));

type Models = Partial<Record<SpeciesId, readonly Part[]>>;
/**
 * Modelle von Arten aus einem Welt-Paket eintragen (Eis-Welt: ihre zehn Tiere, `ICE_MODELS`; Höhlenwelt: ihre acht,
 * `roosts` die Fledermaus kopfüber; `outlines` die Grundform ohne Feinteile für den Umriss): sobald das Paket ankommt, bevor eines seiner Tiere erscheint. Bis dahin ist ihr
 * Modell leer (der Kern kennt nur Name, Ton, Gangart). Ändert `SPECIES` für die ganze Seite (in Tests: test-worlds.ts
 * ruft es beim Import).
 */
export function addModels(models: Models = {}, roosts: Models = {}, solos: Models = {}, outlines: Models = {}) {
  for (const [id, parts] of Object.entries(models) as [SpeciesId, readonly Part[]][]) SPECIES[id].parts = parts;
  for (const [id, parts] of Object.entries(outlines) as [SpeciesId, readonly Part[]][]) SPECIES[id].outline = parts;
  for (const [id, parts] of Object.entries(roosts) as [SpeciesId, readonly Part[]][]) SPECIES[id].roost = parts;
  for (const [id, parts] of Object.entries(solos) as [SpeciesId, readonly Part[]][]) SPECIES[id].solo = parts;
}
const noop = () => {};

/** Die Welt-Pakete einer Spielseite: welche schon da sind, und Laden bei Bedarf, jedes für sich */
export class Packs {
  private ready: LoadedPack[] = [];
  private loading = new Map<PackId, Promise<unknown>>();
  private failedAt = new Map<PackId, number>();
  /** Höchstens so lange wartet `wait`; ein Test setzt es hoch, wenn er den wartenden Start prüft (langsame Pipeline) */
  waitMs = PACK_WAIT_MS;
  /** Diese Pakete holt `want` immer, auch ohne Bedarf (Entwickler-Schalter, mitwachsen-dev.ts) */
  extra: readonly PackId[] = [];

  /** `arrive`: ein Paket ist angekommen (einbauen), `load` holt es (im Test ersetzbar), `ids`: diese Pakete gibt es */
  constructor(
    private readonly arrive: (pack: LoadedPack) => void,
    private readonly load: (id: PackId) => Promise<LoadedPack> = loadPack,
    private readonly ids: readonly PackId[] = PACK_IDS,
  ) {}

  /** Die geladenen Pakete (für `createWorld`) */
  get loaded(): readonly LoadedPack[] {
    return [...this.ready];
  }

  get(id: PackId): LoadedPack | undefined {
    return this.ready.find((p) => p.id === id);
  }

  /** Das geladene Paket der Welt hinter dem Tor `gate` (undefined: keines da) */
  at(gate: GateId | undefined): LoadedPack | undefined {
    return gate && this.ready.find((p) => p.gate === gate);
  }

  /**
   * „Noch nicht“ je Bild: fragt den Haken `View2D.hint` jedes geladenen Pakets, wo die Figur auch steht (jeder prüft
   * selbst, ob sie auf der Platte seines Tors steht). Nur so vergeht ein gezeigter Umriss samt Wackeln nach `HINT_MS`
   * von selbst, auch wenn die Figur die Platte schon verlassen hat, und was neben der Platte noch ausstand, verfällt.
   * Liefert, was ein Tor gerade zeigt (`id` gesetzt), sonst die Antwort des ersten Pakets, ohne Paket null
   */
  hint(...a: Parameters<NonNullable<View2D['hint']>>): Hint | null {
    const all = this.ready.flatMap((p) => (p.view?.hint ? [p.view.hint(...a)] : []));
    return all.find((h) => h.id) ?? all[0] ?? null;
  }

  /**
   * Braucht der Spielstand ein Paket und fehlt es noch, wird es geholt; erfüllt, sobald alle nötigen da sind (oder
   * scheiterten). Jedes Paket für sich: sein Tor (`behind` seiner Gegend; ohne eigenes Tor die Bahn: `bahnWanted`, die
   * Fahrzeuge: `fahrtWanted`; die Grubenbahn, wann immer die Grotte gewollt ist, `ALONG`) oder ein Halt in der Nähe
   * (`need.ride`, Vorladen: `preloadOf`), sein Laden, sein Neuversuch
   */
  want(need: Need, gates: ReadonlyMap<GateId, GateAt>, now = performance.now()): Promise<void> {
    return Promise.all(this.ids.map((id) => this.wantOne(id, need, gates, now))).then(noop);
  }

  private wantOne(id: PackId, need: Need, gates: ReadonlyMap<GateId, GateAt>, now: number) {
    const as = ALONG[id] ?? id; // gewollt wie das Paket, mit dem es kommt
    const gate = REGIONS.find((r) => r.id === as)?.behind;
    const own = as === 'bahn' ? bahnWanted(need) : as === 'fahrt' && fahrtWanted(need);
    const wanted =
      this.extra.includes(id) ||
      this.extra.includes(as) ||
      !!need.ride?.includes(as) ||
      (gate ? needsPack(need, gates, beyondRing, gate) : own);
    if (this.get(id) || !wanted) return Promise.resolve();
    if (!this.loading.has(id) && now - (this.failedAt.get(id) ?? -Infinity) >= RETRY_MS)
      this.loading.set(
        id,
        this.load(id).then(
          (pack) => {
            addModels(pack.models, pack.roosts, pack.solos, pack.outlines);
            this.ready.push(pack);
            this.arrive(pack);
          },
          () => {
            this.failedAt.set(id, performance.now());
            this.loading.delete(id);
          },
        ),
      );
    return this.loading.get(id) ?? Promise.resolve();
  }

  /** Wie `want`, aber höchstens `waitMs` warten (Öffnen einer Welt: das Netz kann beim ersten Besuch hängen) */
  wait(need: Need, gates: ReadonlyMap<GateId, GateAt>, ms = this.waitMs): Promise<void> {
    return Promise.race([this.want(need, gates), new Promise<void>((done) => setTimeout(done, ms))]);
  }
}
