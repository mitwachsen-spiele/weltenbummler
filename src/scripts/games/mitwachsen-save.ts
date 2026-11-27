// Spielstände von Mitwachsen im localStorage – rein bis auf den übergebenen Speicher, damit testbar.
// Ein Index listet die Welten, jede Welt liegt unter einem eigenen Schlüssel: Eine kaputte Welt reißt die anderen
// nicht mit. Jeder Zugriff fängt Fehler ab (privates Fenster, voller Speicher); das Spiel läuft dann ohne Speichern.
// Spezifikation: docs/specs/mitwachsen.md

import { GATES, REGIONS, SPECIES, animalId, type GateId, type SpeciesId } from '../../data/games/mitwachsen';
import type { HomeAnimal, Progress } from './mitwachsen-state';
import { STORIES, type StoryId } from '../../data/games/mitwachsen-stories';
import { PORTAL_IDS, type PortalId } from '../../data/games/mitwachsen-portals';
import { Fog } from './mitwachsen-fog';
import { packAt } from './mitwachsen-pack';
import { beyondRing, gatePlaces } from './mitwachsen-world';

export const PREFIX = 'larmic.games.';
export const INDEX_KEY = `${PREFIX}index`;
export const worldKey = (id: string) => `${PREFIX}world.${id}`;
// 1: „threeyear“ · 2: mit Alter · 3: Garten statt Gehege · 4: Start auf der Lichtung · 5: Gletschertal statt kleinem Kessel
export const VERSION = 5;
export const AGES = [3] as const; // Altersstufen, die es schon gibt
export type Age = (typeof AGES)[number];

/** Nur das, was vom localStorage gebraucht wird – in Tests ersetzbar */
export type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type SavedWorld = {
  v: typeof VERSION;
  game: 'mitwachsen';
  age: Age; // Altersstufe der Welt: schaltet Fähigkeiten frei
  id: string;
  seed: number;
  worldName: string;
  figureName: string;
  openGates: GateId[];
  metAnimals: string[];
  homeAnimals: HomeAnimal[];
  portals: PortalId[]; // wache Portal-Plattformen (je Tor eines und das Eis-Portal)
  position: [number, number];
  visits: number;
  day: number; // Tage der Welt (jedes Schlafen einer), Blumen und Pilze wachsen damit
  explored: Record<string, string>; // Nebel: erkundete Felder je Stück (Base64), siehe mitwachsen-fog.ts
  heard: StoryId[]; // Geschichten, deren Klangstein schon erklungen ist
  found: string[]; // gefundene Sehenswürdigkeiten: Sie locken nie wieder (mitwachsen-sight.ts). Ältere Stände ohne: []
  // Zustand der Welt-Pakete je Kennung (`packs.eis`: gebaute Schneemänner). Jedes Paket liest und migriert seinen Eintrag
  // selbst (worlds/eis/mitwachsen-snowman.ts); hier wird er nur getragen, auch wenn das Paket fehlt. Ältere Stände ohne: {}
  packs: Record<string, unknown>;
};
export type Index = {
  v: typeof VERSION; // Index von Version 1 hat dasselbe Format und wird übernommen
  worlds: { id: string; worldName: string; figureName: string }[];
  current: string | null;
};

export const DEFAULT_FIGURE = 'Jonas';
export const MAX_NAME = 16;

/** Namen säubern: Buchstaben, Ziffern, Leerzeichen und wenige Satzzeichen, gekürzt */
export const cleanName = (name: string, fallback: string) =>
  name
    .replace(/[^\p{L}\p{N} .'-]/gu, '')
    .trim()
    .slice(0, MAX_NAME) || fallback;

/** Welt-Code zum Weitergeben: der Seed in Basis 36, gut lesbar */
export const worldCode = (seed: number) => (seed >>> 0).toString(36).toUpperCase().padStart(7, '0');
export function parseWorldCode(code: string): number | null {
  const clean = code.trim().toUpperCase();
  if (!/^[0-9A-Z]{1,7}$/.test(clean)) return null;
  const n = parseInt(clean, 36);
  return n <= 0xffffffff ? n : null;
}

export function newWorld(
  id: string,
  seed: number,
  worldName: string,
  figureName = DEFAULT_FIGURE,
  age: Age = 3,
): SavedWorld {
  return {
    v: VERSION,
    game: 'mitwachsen',
    age,
    id,
    seed: seed >>> 0,
    worldName: cleanName(worldName, 'Meine Welt'),
    figureName: cleanName(figureName, DEFAULT_FIGURE),
    openGates: [],
    metAnimals: [],
    homeAnimals: [],
    position: [0, 0],
    visits: 0,
    day: 0,
    explored: {},
    portals: [],
    heard: [],
    found: [],
    packs: {},
  };
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const strings = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : []);

/** Version 1 (Arbeitstitel „threeyear“) → 2: neuer Spielname, Alter 3 – sonst gleich */
const fromV1 = (raw: Record<string, unknown>): Record<string, unknown> => ({
  ...raw,
  v: 2,
  game: 'mitwachsen',
  age: 3,
});
/** Version 2 → 3: Aus dem Gehege wird der Garten, aus `penAnimals` werden `homeAnimals` */
function fromV2(raw: Record<string, unknown>): Record<string, unknown> {
  const { penAnimals, ...rest } = raw;
  return { ...rest, v: 3, homeAnimals: penAnimals };
}

/**
 * Version 3 → 4: Die Welt beginnt jetzt auf der Lichtung (nur das Bett, keine Gegenden, kein Garten).
 * Gefundene Tiere des alten Zuhauses bleiben gefunden, wenn es sie auf der Lichtung gibt; der Rest beginnt neu.
 */
function fromV3(raw: Record<string, unknown>): Record<string, unknown> {
  const lichtung = new Set(REGIONS[0].animals.map((a) => a.species));
  const met = (Array.isArray(raw.metAnimals) ? raw.metAnimals : [])
    .filter((id): id is string => typeof id === 'string' && id.startsWith('zuhause:'))
    .map((id) => id.slice('zuhause:'.length))
    .filter((sp): sp is SpeciesId => lichtung.has(sp as SpeciesId))
    .map((sp) => animalId('lichtung', sp));
  return { ...raw, v: 4, metAnimals: met, openGates: [], homeAnimals: [], position: [0, 0] };
}

/**
 * Version 4 → 5: Aus dem kleinen Gletscherkessel wurde ein langes Gletschertal, das Schneebett liegt woanders. Was hinter
 * dem Felsring im Land der Eis-Welt erkundet war, passt nicht mehr zum neuen Tal und liegt wieder im Nebel (einmal,
 * die Lichtung und ihr Gang bleiben erkundet). Alles andere bleibt: Die Figur startet wie immer im Bett ihrer Gegend,
 * eine Position im alten Kessel also im Schneebett (`initialState`); Eis-Tiere zu Hause wohnen auf der Schneewiese, die
 * mit dem Bett gewandert ist; wache Portale hängen an ihrer Kennung. Leere Fischkisten werden nicht gespeichert.
 */
function fromV4(raw: Record<string, unknown>): Record<string, unknown> {
  if (typeof raw.seed !== 'number' || !Number.isFinite(raw.seed)) return { ...raw, v: 5 };
  // derselbe Seed wie die Welt: `migrate` speichert ihn unten als `seed >>> 0`, daraus baut das Spiel die Welt. `packAt`
  // grenzt auf das Land der Eis-Welt ein (ihre Hülle, sonst das nächste Tor, das aufgehen kann): Der alte Kessel liegt
  // darin, der Nebel hinter anderen Toren (die Grotte hinter dem Höhlentor) bleibt bei diesem Umzug unberührt
  const gates = gatePlaces(raw.seed >>> 0);
  const fog = Fog.from(raw.explored);
  fog.forget((x, y) => beyondRing(x, y) && packAt([x, y], gates, beyondRing));
  return { ...raw, v: 5, explored: fog.serialize() };
}

/** Ältere Versionen Schritt für Schritt umziehen (Version 1 hieß noch „threeyear“) */
function upgrade(input: Record<string, unknown>): Record<string, unknown> {
  let raw = input;
  if (raw.v === 1 && raw.game === 'threeyear') raw = fromV1(raw);
  for (const [v, step] of [
    [2, fromV2],
    [3, fromV3],
    [4, fromV4],
  ] as const)
    if (raw.v === v && raw.game === 'mitwachsen') raw = step(raw);
  return raw;
}

/**
 * Gespeicherte Daten in das aktuelle Format bringen: ältere Versionen Schritt für Schritt umziehen, dann aufräumen.
 * Unbekanntes wird verworfen statt das Spiel zu stören: fremde Tore, Tierarten, Alter oder kaputte Felder.
 * Neuere Versionen als diese und fremde Spiele → null.
 */
export function migrate(input: unknown): SavedWorld | null {
  if (!isRecord(input)) return null;
  const raw = upgrade(input);
  if (raw.v !== VERSION || raw.game !== 'mitwachsen') return null;
  if (typeof raw.id !== 'string' || typeof raw.seed !== 'number' || !Number.isFinite(raw.seed)) return null;
  const gates = new Set<string>(GATES.map((g) => g.id));
  const portals = new Set<string>(PORTAL_IDS); // alle Portale, auch das Eis-Portal (nicht nur die der Tore)
  const garden = Array.isArray(raw.homeAnimals)
    ? raw.homeAnimals.filter(
        (p): p is HomeAnimal =>
          isRecord(p) && typeof p.id === 'string' && typeof p.species === 'string' && Object.hasOwn(SPECIES, p.species),
      )
    : [];
  const pos = Array.isArray(raw.position) && raw.position.length === 2 && raw.position.every(Number.isInteger);
  return {
    v: VERSION,
    game: 'mitwachsen',
    age: AGES.find((a) => a === raw.age) ?? 3,
    id: raw.id,
    seed: raw.seed >>> 0,
    worldName: cleanName(typeof raw.worldName === 'string' ? raw.worldName : '', 'Meine Welt'),
    figureName: cleanName(typeof raw.figureName === 'string' ? raw.figureName : '', DEFAULT_FIGURE),
    openGates: strings(raw.openGates).filter((g): g is GateId => gates.has(g)),
    metAnimals: [...new Set(strings(raw.metAnimals))].sort(),
    homeAnimals: garden.map((p) => ({ id: p.id, species: p.species })),
    position: pos ? (raw.position as [number, number]) : [0, 0],
    visits: typeof raw.visits === 'number' && raw.visits >= 0 ? Math.floor(raw.visits) : 0,
    day: typeof raw.day === 'number' && raw.day >= 0 && Number.isFinite(raw.day) ? Math.floor(raw.day) : 0,
    portals: strings(raw.portals).filter((p): p is PortalId => portals.has(p)),
    heard: [...new Set(strings(raw.heard))].filter((id): id is StoryId => Object.hasOwn(STORIES, id)).sort(),
    found: [...new Set(strings(raw.found))].sort(),
    packs: isRecord(raw.packs) ? { ...raw.packs } : {},
    explored: isRecord(raw.explored)
      ? Object.fromEntries(Object.entries(raw.explored).filter(([, v]) => typeof v === 'string') as [string, string][])
      : {},
  };
}

function read(store: Store, key: string): unknown {
  try {
    const text = store.getItem(key);
    return text === null ? null : JSON.parse(text);
  } catch {
    return null;
  }
}
function write(store: Store, key: string, value: unknown): boolean {
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadIndex(store: Store): Index {
  const raw = read(store, INDEX_KEY);
  if (!isRecord(raw) || ![1, 2, 3, 4, VERSION].includes(raw.v as number) || !Array.isArray(raw.worlds))
    return { v: VERSION, worlds: [], current: null };
  const worlds = raw.worlds
    .filter((w): w is Record<string, unknown> => isRecord(w) && typeof w.id === 'string')
    .map((w) => ({
      id: w.id as string,
      worldName: cleanName(typeof w.worldName === 'string' ? w.worldName : '', 'Meine Welt'),
      figureName: cleanName(typeof w.figureName === 'string' ? w.figureName : '', DEFAULT_FIGURE),
    }));
  const current =
    typeof raw.current === 'string' && worlds.some((w) => w.id === raw.current) ? raw.current : (worlds[0]?.id ?? null);
  return { v: VERSION, worlds, current };
}

export const saveIndex = (store: Store, index: Index) => write(store, INDEX_KEY, index);
export const loadWorld = (store: Store, id: string) => migrate(read(store, worldKey(id)));

/** Welt speichern und ihren Eintrag im Index (Name, aktuelle Welt) mitziehen */
export function saveWorld(store: Store, world: SavedWorld, makeCurrent = true): boolean {
  if (!write(store, worldKey(world.id), world)) return false;
  const index = loadIndex(store);
  const entry = { id: world.id, worldName: world.worldName, figureName: world.figureName };
  const at = index.worlds.findIndex((w) => w.id === world.id);
  if (at >= 0) index.worlds[at] = entry;
  else index.worlds.push(entry);
  if (makeCurrent) index.current = world.id;
  return saveIndex(store, index);
}

/**
 * Welt löschen: Spielstand und Eintrag im Index. War sie die aktuelle Welt, wird die erste übrige aktuell (oder keine).
 * Liefert den neuen Index.
 */
export function deleteWorld(store: Store, id: string): Index {
  try {
    store.removeItem(worldKey(id));
  } catch {
    /* dann bleibt der Spielstand liegen, der Index vergisst ihn trotzdem */
  }
  const index = loadIndex(store);
  index.worlds = index.worlds.filter((w) => w.id !== id);
  if (index.current === id) index.current = index.worlds[0]?.id ?? null;
  saveIndex(store, index);
  return index;
}

/** Fortschritt aus dem Spiel in die gespeicherte Welt übernehmen */
export const withProgress = (world: SavedWorld, p: Progress): SavedWorld => ({
  ...world,
  openGates: [...p.openGates],
  metAnimals: [...p.met],
  homeAnimals: [...p.garden],
  portals: [...p.portals],
  position: [...p.position],
  day: p.day,
  heard: [...p.heard],
  found: [...p.found],
  packs: { ...p.packs },
});

/** Fortschritt einer gespeicherten Welt für den Spielstart */
export const progressFrom = (w: SavedWorld): Progress => ({
  met: [...w.metAnimals],
  garden: [...w.homeAnimals],
  openGates: [...w.openGates],
  portals: [...w.portals],
  position: [...w.position],
  day: w.day,
  heard: [...w.heard],
  found: [...w.found],
  packs: { ...w.packs },
});
