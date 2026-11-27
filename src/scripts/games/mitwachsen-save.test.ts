import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FIGURE,
  INDEX_KEY,
  cleanName,
  deleteWorld,
  loadIndex,
  loadWorld,
  migrate,
  newWorld,
  parseWorldCode,
  progressFrom,
  saveWorld,
  withProgress,
  worldCode,
  worldKey,
  type Store,
} from './mitwachsen-save';
import { Fog } from './mitwachsen-fog';
import { packAt } from './mitwachsen-pack';
import { initialState, progressOf, step } from './mitwachsen-state';
import { beyondRing } from './mitwachsen-world';
import { worldOf } from './test-worlds';
import { plateMid } from './mitwachsen-plate';
import { REGIONS, animalId, regionAnimalList } from '../../data/games/mitwachsen';

/** Speicher im Arbeitsspeicher wie localStorage */
function memoryStore(): Store & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}
/** Speicher, der jeden Zugriff verweigert (privates Fenster, gesperrt) */
const brokenStore: Store = {
  getItem: () => {
    throw new Error('verboten');
  },
  setItem: () => {
    throw new Error('voll');
  },
  removeItem: () => {
    throw new Error('verboten');
  },
};

describe('Welten speichern', () => {
  it('speichert eine Welt, liest sie wieder und trägt sie als aktuelle Welt in den Index ein', () => {
    const store = memoryStore();
    const w = newWorld('a1', 12345, 'Bobos Insel', 'Bobo');
    expect(saveWorld(store, w)).toBe(true);
    expect(loadWorld(store, 'a1')).toEqual(w);
    expect(loadIndex(store)).toEqual({
      v: 5,
      worlds: [{ id: 'a1', worldName: 'Bobos Insel', figureName: 'Bobo' }],
      current: 'a1',
    });
  });

  it('verwaltet mehrere Welten; Umbenennen zieht den Index mit', () => {
    const store = memoryStore();
    saveWorld(store, newWorld('a', 1, 'Erste'));
    saveWorld(store, newWorld('b', 2, 'Zweite'));
    saveWorld(store, { ...newWorld('a', 1, 'Erste'), worldName: 'Umbenannt', figureName: 'Mo' });
    const index = loadIndex(store);
    expect(index.worlds.map((w) => [w.id, w.worldName, w.figureName])).toEqual([
      ['a', 'Umbenannt', 'Mo'],
      ['b', 'Zweite', DEFAULT_FIGURE],
    ]);
    expect(index.current).toBe('a');
  });

  it('übernimmt den Fortschritt aus dem Spiel und gibt ihn für den Start zurück', () => {
    const w = newWorld('a', 1, 'X');
    const p = {
      met: ['zuhause:hase'],
      garden: [{ id: 'zuhause:hase', species: 'hase' as const }],
      openGates: ['eis' as const],
      portals: ['lava' as const],
      position: [3, 4] as [number, number],
      day: 5,
      heard: ['bett' as const, 'eis' as const],
      found: ['eis:glockenspiel'],
      packs: { eis: { v: 1, snow: { '3,4': 2 } } },
    };
    expect(progressFrom(withProgress(w, p))).toEqual(p);
  });

  it('der Spielstand der Fahrzeuge (packs.fahrt) übersteht Speichern, Laden und einen Zug, ohne Umzug im Kern', () => {
    const store = memoryStore();
    const fahrt = { schlitten: { stage: 'fest' }, spaeter: { stage: 'offen', schlaeft: true } };
    const packs = { eis: { v: 1, snow: { '3,4': 2 } }, fahrt };
    const w = withProgress(newWorld('f', 1, 'X'), { ...progressFrom(newWorld('f', 1, 'X')), packs });
    expect(saveWorld(store, w)).toBe(true);
    const loaded = loadWorld(store, 'f')!;
    expect(loaded.packs).toEqual(packs);
    const world = worldOf(1);
    const s = step(initialState(world, progressFrom(loaded)), world, { type: 'tick' }).state;
    expect(progressOf(s).packs).toEqual(packs); // auch nach einem Zug, unverändert
  });

  it('läuft ohne Fehler weiter, wenn der Browser nichts speichern lässt', () => {
    expect(saveWorld(brokenStore, newWorld('a', 1, 'X'))).toBe(false);
    expect(loadWorld(brokenStore, 'a')).toBeNull();
    expect(loadIndex(brokenStore)).toEqual({ v: 5, worlds: [], current: null });
  });

  it('übersteht kaputte Daten: falsches JSON, fremder Index, unbekannte aktuelle Welt', () => {
    const store = memoryStore();
    store.setItem(worldKey('x'), '{kaputt');
    expect(loadWorld(store, 'x')).toBeNull();
    store.setItem(INDEX_KEY, JSON.stringify({ v: 4, worlds: [{ id: 'a' }, 42, { nope: true }], current: 'weg' }));
    expect(loadIndex(store)).toEqual({
      v: 5,
      worlds: [{ id: 'a', worldName: 'Meine Welt', figureName: DEFAULT_FIGURE }],
      current: 'a',
    });
  });
});

describe('Welten löschen', () => {
  it('entfernt Spielstand und Eintrag; die nächste Welt wird aktuell', () => {
    const store = memoryStore();
    saveWorld(store, newWorld('a', 1, 'Erste'));
    saveWorld(store, newWorld('b', 2, 'Zweite')); // aktuell
    const index = deleteWorld(store, 'b');
    expect(index.worlds.map((w) => w.id)).toEqual(['a']);
    expect(index.current).toBe('a');
    expect(loadWorld(store, 'b')).toBeNull();
    expect(loadIndex(store)).toEqual(index);
  });

  it('lässt die aktuelle Welt, wenn eine andere gelöscht wird; die letzte hinterlässt keine aktuelle', () => {
    const store = memoryStore();
    saveWorld(store, newWorld('a', 1, 'Erste'));
    saveWorld(store, newWorld('b', 2, 'Zweite'));
    expect(deleteWorld(store, 'a').current).toBe('b');
    expect(deleteWorld(store, 'b')).toEqual({ v: 5, worlds: [], current: null });
  });

  it('übersteht einen Speicher, der nichts zulässt', () => {
    expect(deleteWorld(brokenStore, 'a')).toEqual({ v: 5, worlds: [], current: null });
  });
});

describe('Format und Umzug (migrate)', () => {
  it('lehnt Fremdes ab: anderes Spiel, unbekannte Version, fehlender Seed', () => {
    const ok = newWorld('a', 1, 'X');
    expect(migrate(ok)).toEqual(ok);
    expect(migrate({ ...ok, game: 'anderes-spiel' })).toBeNull();
    expect(migrate({ ...ok, game: 'threeyear' })).toBeNull(); // threeyear gab es nur in Version 1
    expect(migrate({ ...ok, v: 99 })).toBeNull();
    expect(migrate({ ...ok, seed: 'abc' })).toBeNull();
    expect(migrate(null)).toBeNull();
    expect(migrate([1, 2])).toBeNull();
  });

  it('verwirft unbekannte Tore und Tierarten, räumt Listen auf und repariert Felder', () => {
    const raw = {
      ...newWorld('a', 1, 'X'),
      openGates: ['eis', 'nordtor', 3],
      metAnimals: ['b', 'a', 'a', 7],
      homeAnimals: [
        { id: 'p', species: 'hase' },
        { id: 'q', species: 'drache' },
        { id: 'r', species: 'constructor' }, // Eigenschaft jedes Objekts, aber keine Tierart
        'kaputt',
      ],
      position: [1.5, 2],
      visits: -3,
      day: -2.5,
      portals: ['lava', 'westtor', 3],
      explored: { '0,0': 42, '1,1': 'AAAA' },
      heard: ['eis', 'bett', 'eis', 'nordtor', 'constructor', 7],
      worldName: '<script>Welt',
    };
    const w = migrate(raw)!;
    expect(w.day).toBe(0);
    expect(w.portals).toEqual(['lava']);
    expect(w.explored).toEqual({ '1,1': 'AAAA' });
    expect(w.heard).toEqual(['bett', 'eis']); // unbekannte Geschichten fallen weg
    expect(w.openGates).toEqual(['eis']);
    expect(w.metAnimals).toEqual(['a', 'b']);
    expect(w.homeAnimals).toEqual([{ id: 'p', species: 'hase' }]);
    expect(w.position).toEqual([0, 0]);
    expect(w.visits).toBe(0);
    expect(w.worldName).toBe('scriptWelt');
  });
});

describe('Eis-Portal im Spielstand', () => {
  it('Eis-Portal kommt mit dem Spielstand wieder (Unbekanntes fällt weg)', () => {
    const store = memoryStore();
    const w = { ...newWorld('a', 1, 'X'), portals: ['lava', 'eiskessel'] as ('lava' | 'eiskessel')[] };
    saveWorld(store, w);
    expect(loadWorld(store, 'a')!.portals).toEqual(['lava', 'eiskessel']);
    expect(migrate({ ...w, portals: ['eiskessel', 'westtor', 'kessel', 3, 'pilze'] })!.portals).toEqual([
      'eiskessel',
      'pilze',
    ]);
    expect(progressFrom(loadWorld(store, 'a')!).portals).toEqual(['lava', 'eiskessel']);
  });

  it('alter v4-Stand (vor dem Eis-Portal gespeichert) lädt mit neuer Version, sonst unverändert', () => {
    // so, wie ihn die Spielseite bisher geschrieben hat: Portale nur an Toren
    const old = {
      v: 4,
      game: 'mitwachsen',
      age: 3,
      id: 'k7',
      seed: 2026,
      worldName: 'Bobos Insel',
      figureName: 'Bobo',
      openGates: [],
      metAnimals: ['lichtung:hase', 'lichtung:igel'],
      homeAnimals: [{ id: 'lichtung:hase', species: 'hase' }],
      portals: ['lava', 'pilze', 'eis'],
      position: [12, -3],
      visits: 7,
      day: 4,
      explored: { '0,0': '//////////////////////////////////////////8=' }, // Lichtung um das Bett erkundet
      heard: ['bett', 'eis'],
    };
    const store = memoryStore();
    store.setItem(worldKey('k7'), JSON.stringify(old));
    // nur die Version ändert sich: Der Nebel liegt auf der Lichtung, nicht im Land der Eis-Welt
    // … und ohne Zustand der Welt-Pakete (gespeichert vor den Schneemännern) gibt es eben keinen
    // … und ohne gefundene Sehenswürdigkeiten (gespeichert vor dem Hinführen, Issue 28): eine leere Liste
    expect(loadWorld(store, 'k7')).toEqual({ ...old, v: 5, packs: {}, found: [] });
    expect(migrate(old)).toEqual({ ...old, v: 5, packs: {}, found: [] });
  });
});

describe('Offenes Eistor im Spielstand', () => {
  it('das Eistor bleibt nach dem Laden offen; die Position im Tal kommt mit', () => {
    const store = memoryStore();
    const w = { ...newWorld('e', 7, 'X'), openGates: ['eis' as const], position: [40, -60] as [number, number] };
    saveWorld(store, w);
    const back = loadWorld(store, 'e')!;
    expect(back.v).toBe(5);
    expect(progressFrom(back)).toMatchObject({ openGates: ['eis'], position: [40, -60] });
    // die anderen sieben bleiben auch aus einem Spielstand zu (das filtert `initialState`, hier nur Format und Umzug)
    expect(migrate({ ...w, openGates: ['eis', 'sand', 'westtor'] })!.openGates).toEqual(['eis', 'sand']);
  });
});

describe('Torplatte im Spielstand', () => {
  it('ein Stand mit der Figur genau auf einer Plattenzelle (gespeichert vor der Platte) lädt: Bett der Lichtung, Platte begehbar', () => {
    const store = memoryStore();
    const w = worldOf(7);
    for (const gate of ['eis', 'sand'] as const) {
      const [x, y] = plateMid(w.gates.get(gate)!);
      for (const openGates of [[], ['eis' as const]]) {
        const saved = { ...newWorld('p', 7, 'X'), openGates, position: [x, y] as [number, number] };
        saveWorld(store, saved);
        const back = loadWorld(store, 'p')!;
        expect(progressFrom(back)).toMatchObject({ openGates, position: [x, y] });
        const s = initialState(w, progressFrom(back));
        expect([s.player.x, s.player.y]).toEqual([...w.homes.lichtung.bed]); // aufgewacht im Bett der Lichtung
        expect(w.cell(x, y).plate).toBe(gate); // die Platte gibt es nur in der Welt, nicht im Spielstand
        expect(Object.keys(back)).not.toContain('plate');
      }
    }
  });
});

describe('Pinguin in der Bucht im Spielstand', () => {
  it('gespeichert, während der Pinguin in der Bucht an der Platte wartet: lädt mit zugem Tor, ohne Stehzeit, er kommt wieder', () => {
    const store = memoryStore();
    const w = worldOf(1);
    const door = w.gates.get('eis')!;
    const lichtung = regionAnimalList(REGIONS[0]).map(({ id, species }) => ({ id, species }));
    // die Leiste voll, die Figur auf der Torplatte, der Pinguin neben ihr in der Bucht (im Spiel nach 0,3 s Stehen)
    let s = { ...initialState(w, { garden: lichtung }), sleeping: false, still: 3 };
    const [px, py] = plateMid(door);
    s = { ...s, player: { x: px, y: py, dir: 'n' as const } };
    saveWorld(store, withProgress(newWorld('b', 1, 'B'), progressOf(s)));
    const back = loadWorld(store, 'b')!;
    expect(back.openGates).toEqual([]);
    expect(Object.keys(back)).not.toContain('still');
    const again = initialState(w, progressFrom(back));
    expect(again.openGates).toEqual([]);
    expect(again.still).toBe(0);
    expect(again.ritual).toBe(-1);
    expect(again.animals.some((a) => a.mode === 'lead')).toBe(false); // er taucht am Bett wieder auf und führt neu
    expect([again.player.x, again.player.y]).toEqual([...w.homes.lichtung.bed]);
  });
});

describe('Namen und Welt-Code', () => {
  it('säubert Namen und nimmt sonst den Ersatz', () => {
    expect(cleanName('  Bobo  ', 'X')).toBe('Bobo');
    expect(cleanName('Ömer & Jö', 'X')).toBe('Ömer  Jö');
    expect(cleanName('<>{}', 'Ersatz')).toBe('Ersatz');
    expect(cleanName('a'.repeat(40), 'X')).toHaveLength(16);
  });

  it('die Figur heißt ohne eigenen Namen Jonas, auch bei leerem oder ungültigem Namen', () => {
    expect(DEFAULT_FIGURE).toBe('Jonas');
    expect(newWorld('neu', 1, 'Meine Welt').figureName).toBe('Jonas');
    expect(newWorld('leer', 1, 'Meine Welt', '<>').figureName).toBe('Jonas');
  });

  it('macht aus dem Seed einen Code und zurück', () => {
    for (const seed of [0, 1, 123456789, 0xffffffff]) expect(parseWorldCode(worldCode(seed))).toBe(seed);
    expect(parseWorldCode(' 1a2b ')).toBe(parseInt('1A2B', 36));
    expect(parseWorldCode('hallo welt')).toBeNull();
    expect(parseWorldCode('ZZZZZZZ')).toBeNull(); // größer als 32 Bit
  });
});

describe('Umzug vom Arbeitstitel threeyear (Version 1)', () => {
  const v1 = {
    v: 1,
    game: 'threeyear',
    id: 'alt',
    seed: 4711,
    worldName: 'Bobos Insel',
    figureName: 'Bobo',
    openGates: ['gartentor'],
    metAnimals: ['zuhause:hase', 'zuhause:igel'],
    penAnimals: [{ id: 'zuhause:hase', species: 'hase' }],
    position: [2, 3],
    visits: 7,
  };

  it('macht aus einer threeyear-Welt eine Mitwachsen-Welt ab 3 auf der Lichtung', () => {
    const w = migrate(v1)!;
    expect(w).toMatchObject({ v: 5, game: 'mitwachsen', age: 3, id: 'alt', seed: 4711, worldName: 'Bobos Insel' });
    expect(w.metAnimals).toEqual(['lichtung:hase', 'lichtung:igel']); // Hase und Igel gibt es auch auf der Lichtung
    expect(w.openGates).toEqual([]);
    expect(w.homeAnimals).toEqual([]);
  });

  it('übernimmt Index und Welten aus dem Speicher und schreibt sie im neuen Format zurück', () => {
    const store = memoryStore();
    store.setItem(worldKey('alt'), JSON.stringify(v1));
    store.setItem(
      INDEX_KEY,
      JSON.stringify({ v: 1, worlds: [{ id: 'alt', worldName: 'Bobos Insel', figureName: 'Bobo' }], current: 'alt' }),
    );
    const index = loadIndex(store);
    expect(index.current).toBe('alt');
    const w = loadWorld(store, 'alt')!;
    expect(w.metAnimals).toEqual(['lichtung:hase', 'lichtung:igel']);
    saveWorld(store, w);
    expect(JSON.parse(store.getItem(worldKey('alt'))!)).toMatchObject({
      v: 5,
      game: 'mitwachsen',
      age: 3,
      homeAnimals: [],
    });
    expect((JSON.parse(store.getItem(INDEX_KEY)!) as { v: number }).v).toBe(5);
  });

  it('setzt ein unbekanntes Alter auf 3', () => {
    expect(migrate({ ...newWorld('a', 1, 'X'), age: 9 })!.age).toBe(3);
  });
});

describe('Umzug auf die Lichtung (Version 2 und 3)', () => {
  it('Version 2: Tiere im Gehege und alte Tore verschwinden, gefundene Tiere der Lichtung bleiben', () => {
    const v2 = {
      ...newWorld('b', 2, 'X'),
      v: 2,
      metAnimals: ['zuhause:igel', 'teich:ente'],
      penAnimals: [{ id: 'zuhause:igel', species: 'igel' }],
    } as Record<string, unknown>;
    delete v2.homeAnimals;
    const w = migrate(v2)!;
    expect(w.v).toBe(5);
    expect(w.metAnimals).toEqual(['lichtung:igel']);
    expect(w.homeAnimals).toEqual([]);
    expect('penAnimals' in w).toBe(false);
  });

  it('Version 3: Zuhause wird Lichtung, Blumenwiese und Teich beginnen neu', () => {
    const v3 = {
      ...newWorld('c', 3, 'X'),
      v: 3,
      metAnimals: ['zuhause:hase', 'wiese:schaf'],
      openGates: ['gartentor'],
      homeAnimals: [{ id: 'zuhause:hase', species: 'hase' }],
    };
    const w = migrate(v3)!;
    expect(w.metAnimals).toEqual(['lichtung:hase']);
    expect(w.openGates).toEqual([]);
    expect(w.homeAnimals).toEqual([]);
    expect(w.position).toEqual([0, 0]);
  });
});

describe('Umzug ins Gletschertal (Version 5)', () => {
  /**
   * Echter Spielstand aus dem kleinen Gletscherkessel (mit dem Spiel vor dem Gletschertal gespeichert, Seed 2026): Eistor
   * offen, die Figur im Kessel, Pinguin, Robbe und Lemming zu Hause, Lichtung, Gang und Kessel erkundet, beide Portale
   * wach. Leere Fischkisten speichert das Spiel nicht.
   */
  const OLD = {
    v: 4,
    game: 'mitwachsen',
    age: 3,
    id: 'kessel',
    seed: 2026,
    worldName: 'Bobos Welt',
    figureName: 'Bobo',
    openGates: ['eis'],
    metAnimals: ['eis:lemming:1', 'eis:pinguin', 'eis:robbe:2', 'lichtung:hase:1'],
    homeAnimals: [
      { id: 'eis:pinguin', species: 'pinguin' },
      { id: 'eis:robbe:2', species: 'robbe' },
      { id: 'eis:lemming:1', species: 'lemming' },
      { id: 'lichtung:hase:1', species: 'hase' },
    ],
    position: [114, 62],
    visits: 12,
    day: 9,
    explored: {
      '-1,-1': 'AAAAAAAAAAAAAAAAAOAA+AD8AP4A/4D/gP/A/8D/wP8=',
      '0,-1': 'AAAAAAAAAAAAAAAADwA/AH8A/wD/Af8D/wP/B/8H/wc=',
      '-1,0': 'wP/A/8D/wP+A/4D/AP8A/gD8APgA4AAAAAAAAAAAAAA=',
      '0,0': '/wf/B/8H/wf/A/8D/wH/AH8APwAPAAAAAAAAAAAAAAA=',
      '4,2': 'AAD///////////////////////////////////////8=',
      '3,2': 'AAD///////////////////////////////////////8=',
      '2,2': 'AADA//D/+P/8//z//v/+//7//v/+//z//P/4//D/wP8=',
      '5,2': 'AAD///////////////////////////////////////8=',
      '6,2': 'AAD///////////////////////////////////////8=',
      '7,2': '/x//P/9///////////////////////////////9//z8=',
      '7,1': 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPgD/g8=',
      '8,2': 'AAAAAAAAAAAAAAEAAQABAAEAAQABAAEAAAAAAAAAAAA=',
      '7,3': '/x/+D/gDAAAAAAAAAAAfAH8A/wD/Af8B/wP/A/8D/wM=',
      '6,3': 'AAAAAAAAAAAAAAAAAAAAAADAAOAA8ADwAPgA+AD4APg=',
      '6,4': 'APgA8ADwAOAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      '7,4': '/wP/Af8B/wB/AB8AAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    },
    portals: ['eis', 'eiskessel'],
    heard: ['bett', 'eis-offen'],
  };

  it('lädt ohne Fehler: Nebel im Land der Eis-Welt einmal verworfen, Lichtung und Gang bleiben erkundet, sonst alles gleich', () => {
    const store = memoryStore();
    store.setItem(worldKey('kessel'), JSON.stringify(OLD));
    const w = loadWorld(store, 'kessel')!;
    const { explored, ...rest } = w;
    const { explored: before, ...oldRest } = OLD;
    expect(rest).toEqual({ ...oldRest, v: 5, packs: {}, found: [] });
    const was = Fog.from(before),
      now = Fog.from(explored);
    const world = worldOf(OLD.seed);
    let kept = 0,
      dropped = 0;
    for (let y = -150; y <= 150; y++)
      for (let x = -150; x <= 200; x++) {
        if (!was.has(x, y)) continue;
        const ice = beyondRing(x, y) && packAt([x, y], world.gates, beyondRing);
        expect(now.has(x, y), `${x},${y}`).toBe(!ice);
        if (ice) dropped++;
        else kept++;
      }
    expect(kept).toBeGreaterThan(300); // Lichtung und Weg zum Tor
    expect(dropped).toBeGreaterThan(300); // der alte Kessel
    expect(now.has(...world.homes.lichtung.bed)).toBe(true);
    expect(now.has(...world.homes.eis.bed)).toBe(false); // das neue Schneebett liegt im Nebel (die Ansicht lichtet ihn)
    expect(migrate(w)).toEqual(w); // nur einmal
  });

  it('startet im neuen Schneebett; Eis-Tiere zu Hause auf der gewanderten Schneewiese, Portale wach, spielt weiter', () => {
    const world = worldOf(OLD.seed);
    const w = migrate(OLD)!;
    let s = initialState(world, progressFrom(w), w.seed ^ w.visits);
    expect([s.player.x, s.player.y]).toEqual([...world.homes.eis.bed]);
    expect(s.portals).toEqual(['eis', 'eiskessel']);
    expect(s.openGates).toEqual(['eis']);
    const home = s.animals.filter((a) => a.mode === 'home');
    expect(home.map((a) => a.id).sort()).toEqual(OLD.homeAnimals.map((a) => a.id).sort());
    for (const a of home.filter((a) => a.realm === 'eis')) {
      expect(world.cell(a.x, a.y).garden, a.id).toBe(true);
      expect(Math.hypot(a.x - world.homes.eis.bed[0], a.y - world.homes.eis.bed[1]), a.id).toBeLessThanOrEqual(7);
    }
    const dirs = ['n', 'e', 's', 'w'] as const;
    for (let i = 0; i < 400; i++)
      s = step(s, world, i % 3 ? { type: 'tick' } : { type: 'move', dir: dirs[(i >> 4) % 4]! }).state;
    expect(s.sleeping).toBe(false);
    expect(world.realm(s.player.x, s.player.y)).toBe('eis');
    const back = withProgress(w, progressOf(s));
    expect(migrate(JSON.parse(JSON.stringify(back)))).toEqual(back);
  });

  it('derselbe Stand mit der Figur hinter dem Felsring, aber heute neben dem Tal: auch im Schneebett', () => {
    // Der alte Kessel lag anders als das neue Tal: Eine gespeicherte Stelle kann heute hinter dem Felsring neben Gang
    // oder Tal liegen, auf keinem Feld des Tals (`wakeRealm`); die Figur wacht trotzdem im neuen Schneebett auf
    const world = worldOf(OLD.seed);
    const { mid, out } = world.gates.get('eis')!;
    const beside: [number, number][] = [];
    for (let t = 10; t < 60; t++)
      for (const u of [-12, 12]) {
        const p: [number, number] = [mid[0] + out[0] * t - out[1] * u, mid[1] + out[1] * t + out[0] * u];
        if (beyondRing(...p) && world.realm(...p) === 'lichtung') beside.push(p);
      }
    expect(beside.length).toBeGreaterThan(10);
    for (const position of beside) {
      const w = migrate({ ...OLD, position })!;
      expect(w.position, position.join()).toEqual(position); // der Umzug selbst lässt die Position stehen
      const s = initialState(world, progressFrom(w), w.seed ^ w.visits);
      expect([s.player.x, s.player.y], position.join()).toEqual([...world.homes.eis.bed]);
      expect(s.portals).toEqual(['eis', 'eiskessel']);
    }
  });
});

describe('Fünf Eis-Tiere je Art (früher drei)', () => {
  it('alter Stand mit allen 30 Eis-Tieren zu Hause lädt: Sie bleiben auf der Schneewiese, die neuen 20 laufen wild im Tal', () => {
    const world = worldOf(2026);
    const ice = (REGIONS.find((r) => r.id === 'eis')?.animals ?? []).map((a) => a.species);
    expect(ice).toHaveLength(10);
    // so, wie die Spielseite ihn mit drei Tieren je Art geschrieben hat: alle 30 gefunden und zu Hause
    const homeAnimals = [1, 2, 3].flatMap((n) => ice.map((species) => ({ id: animalId('eis', species, n), species })));
    const old = {
      ...newWorld('fuenf', 2026, 'Bobos Welt'),
      openGates: ['eis' as const],
      metAnimals: homeAnimals.map((a) => a.id).sort(),
      homeAnimals,
      portals: ['eis' as const, 'eiskessel' as const],
      position: [...world.homes.eis.bed] as [number, number],
      visits: 20,
      day: 14,
    };
    const store = memoryStore();
    store.setItem(worldKey('fuenf'), JSON.stringify(old));
    const w = loadWorld(store, 'fuenf')!;
    expect(w).toEqual(old); // nichts umzuziehen: neue Tiere kommen von selbst dazu
    const s = initialState(world, progressFrom(w), w.seed ^ w.visits);
    const eis = s.animals.filter((a) => a.realm === 'eis');
    expect(eis).toHaveLength(50);
    const home = eis.filter((a) => a.mode === 'home');
    expect(home.map((a) => a.id).sort()).toEqual(homeAnimals.map((a) => a.id).sort());
    for (const a of home) expect(world.cell(a.x, a.y).garden, a.id).toBe(true);
    const wild = eis.filter((a) => a.mode === 'wander');
    expect(wild.map((a) => a.id).sort()).toEqual(
      [4, 5].flatMap((n) => ice.map((species) => animalId('eis', species, n))).sort(),
    );
    const spots = new Set(world.spotsOf('eis').map(([x, y]) => `${x},${y}`));
    for (const a of wild) expect(spots.has(`${a.x},${a.y}`), a.id).toBe(true); // im Tal, nicht auf der Wiese
    // die Leiste zeigt weiter Arten: Jede Eis-Art ist gefunden
    expect(new Set(progressOf(s).met.map((id) => id.split(':')[1])).size).toBe(10);
    expect(withProgress(w, progressOf(s)).homeAnimals).toEqual(w.homeAnimals); // gespeichert wie zuvor
  });
});
