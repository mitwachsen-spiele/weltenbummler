// Hinführen zu Sehenswürdigkeiten (Issue 28, Review vom 25.11.2026): Regeln in mitwachsen-sight.ts, Bild und Ton in
// mitwachsen-sight-look.ts. Geprüft wird in der Eis-Welt von Seed 1 (Schneehaufen, Eiszapfen-Glockenspiel), dazu die
// Liste aller Pakete: Jedes Spielzeug und jedes Fahrzeug hat einen Eintrag.
import { haloCompact } from '../../lib/games/shade';
import { describe, expect, it } from 'vitest';
import { GOLD } from '../../data/games/mitwachsen-portals';
import { STORIES } from '../../data/games/mitwachsen-stories';
import type { Point } from '../../data/games/mitwachsen';
import {
  AHEAD,
  CALL_EVERY,
  CALM,
  GIVE_UP,
  HEAR,
  LOSE,
  LURE,
  NEAR,
  PAUSE,
  REST,
  SIGHT_OF,
  STONES,
  TRIES,
  aheadOf,
  cellsOf,
  goalsOf,
  marksOf,
  quiet,
  sightStep,
  sightsOf,
  type Sight,
  type SightEvent,
} from './mitwachsen-sight';
import {
  FRIEND_COLORS,
  FRIEND_ID,
  FriendLook,
  HUSH,
  friendParts,
  friendScore,
  hush,
  melodyStart,
} from './mitwachsen-sight-look';
import { initialState, step, type State } from './mitwachsen-state';
import { canStep, kesselPlace } from './mitwachsen-world';
import { BAHN_PACK, DUG, EIS_PACK, FAHRT_PACK, GRUBE_PACK, HOEHLE_PACK, PACKS, worldOf } from './test-worlds';
import { FIRST_MOLE } from '../../data/games/mitwachsen-hoehle';
import type { Scored } from './sfx';

const world = worldOf(1);
const SIGHTS = sightsOf(PACKS);
const ALL = [EIS_PACK, HOEHLE_PACK, FAHRT_PACK, BAHN_PACK, GRUBE_PACK] as unknown as readonly {
  id: string;
  sights?: readonly Sight[];
  rules?: { vehicle?: { spec: { id: string } } };
}[];
const ICICLES = kesselPlace(1, EIS_PACK)
  .cells.filter(([x, y]) => world.cell(x, y).deco === 'icicle')
  .sort((a, b) => a[0] - b[0]);
const CHIME = ICICLES[0]!;
const key = ([x, y]: Point) => `${x},${y}`;

/** Wach in der Eis-Welt an (x, y), lange nach dem Aufwachen, ohne Tiere; alle Klangsteine gehört */
function at(x: number, y: number, more: Partial<State> = {}): State {
  const s = initialState(world, { openGates: ['eis'], heard: Object.keys(STORIES) as State['heard'] });
  return { ...s, sleeping: false, wokeAt: -1000, tick: 1000, player: { x, y, dir: 's' }, animals: [], ...more };
}
/** Ein begehbares Feld der Eis-Welt, `gap` Felder (±0,5) vom Feld `p` entfernt und mit Weg dorthin */
function fieldAt(p: Point, gap: number): Point {
  for (let r = 0; r < 40; r++)
    for (const [x, y] of kesselPlace(1, EIS_PACK).cells) {
      const d = Math.hypot(x - p[0], y - p[1]);
      if (Math.abs(d - gap) > 0.5 + r * 0.02 || world.cell(x, y).solid || world.cell(x, y).ground === 'water') continue;
      if (world.realm(x, y) !== 'eis') continue;
      const s = at(x, y);
      const [ax, ay] = aheadOf(s, world, p);
      if (Math.hypot(ax - p[0], ay - p[1]) < d) return [x, y];
    }
  throw new Error(`kein Feld ${gap} von ${key(p)}`);
}
/** `n` Takte Hinführen (nur diese Regeln), mit den Ereignissen */
function run(s: State, n: number, sights: readonly Sight[] = SIGHTS) {
  const events: SightEvent[] = [];
  let t = s;
  for (let i = 0; i < n; i++) {
    t = { ...t, tick: t.tick + 1 };
    sightStep(t, world, 'tick', events, sights);
  }
  return { s: t, events };
}
const only = (id: string) => SIGHTS.filter((x) => x.id === id);

describe('Hinführen: jede Sehenswürdigkeit ist eingetragen', () => {
  it('jedes Ereignis eines Spielzeugs gehört zu einer eingetragenen Sehenswürdigkeit oder hat einen Grund (`SIGHT_OF`)', () => {
    const ids = new Set(ALL.flatMap((p) => p.sights ?? []).map((x) => x.id));
    for (const [type, id] of Object.entries(SIGHT_OF)) if (id) expect(ids.has(id), `${type} → ${id}`).toBe(true);
    // umgekehrt: Was ein Paket einträgt, kann auch gefunden werden (über ein Ereignis oder aus dem Spielstand, `done`)
    const byEvent = new Set(Object.values(SIGHT_OF));
    for (const x of ALL.flatMap((p) => p.sights ?? [])) expect(!!x.done || byEvent.has(x.id), x.id).toBe(true);
    expect(new Set([...ids]).size).toBe(ALL.flatMap((p) => p.sights ?? []).length); // keine Kennung doppelt
  });

  it('jedes Paket mit Fahrzeug trägt dessen Halt ein (`haltSight`)', () => {
    const withRide = ALL.filter((p) => p.rules?.vehicle);
    expect(withRide.map((p) => p.id).sort()).toEqual(['bahn', 'eis', 'grube']);
    for (const p of withRide)
      expect(
        p.sights?.map((x) => x.id),
        p.id,
      ).toContain(`halt:${p.rules!.vehicle!.spec.id}`);
  });

  it('die Klangsteine stehen immer in der Liste; `cellsOf` findet die Zierde einer Gegend vom Bett aus', () => {
    expect(sightsOf([])).toEqual([STONES]);
    expect(SIGHTS[0]).toBe(STONES);
    const found = cellsOf(world, 'eis', 'test-zapfen', (c) => c.deco === 'icicle');
    expect(found.map(key).sort()).toEqual(ICICLES.map(key).sort());
    expect(cellsOf(world, 'eis', 'test-zapfen', () => false)).toBe(found); // je Welt und Name einmal
  });
});

describe('Hinführen: Ziel', () => {
  it('immer nur Dinge der Gegend der Figur, vom Bett nach hinten; Gefundenes und nicht Bereites fehlt', () => {
    const bed = world.homes.eis.bed;
    const s = at(bed[0], bed[1] + 2);
    const goals = goalsOf(s, world, SIGHTS);
    // der Rodelreifen steht vom ersten Besuch an auf seinem Berg und lockt bis zur ersten Abfahrt
    // dazu die Spielorte: Zahlen-Fähnchen und Laternen-Tannen (Issue 52)
    const all = ['eis:faehnchen', 'eis:glockenspiel', 'eis:laternen', 'eis:schneehaufen', 'halt:rodel'];
    expect(goals.map((g) => g.sight.id).sort()).toEqual(all);
    for (const g of goals) expect(world.realm(...g.at)).toBe('eis');
    const far = (id: string) =>
      Math.min(
        ...only(id)[0]!
          .cells(world, s)
          .map(([x, y]) => Math.hypot(x - bed[0], y - bed[1])),
      );
    expect(goals.map((g) => g.sight.id)).toEqual([...all].sort((a, b) => far(a) - far(b)));
    expect(
      goalsOf({ ...s, found: all.filter((id) => id !== 'eis:schneehaufen') }, world, SIGHTS).map((g) => g.sight.id),
    ).toEqual(['eis:schneehaufen']);
    const lazy: Sight = { ...only('eis:glockenspiel')[0]!, ready: () => false };
    expect(goalsOf(s, world, [lazy])).toEqual([]);
    // auf der Lichtung lockt nichts aus der Eis-Welt
    expect(goalsOf({ ...s, player: { x: 0, y: 3, dir: 's' } }, world, SIGHTS)).toEqual([]);
  });

  it('Klangsteine: Es lockt jeder Stein der Gegend, der noch nie erklang; gehört heißt gefunden', () => {
    const fresh = { ...at(0, 3), heard: [] };
    const goals = goalsOf(fresh, world, [STONES]);
    expect(goals).toHaveLength(1);
    expect(world.cell(...goals[0]!.at).deco).toBe('klangstein');
    expect(STONES.call(world, goals[0]!.at)).toEqual({ type: 'story', id: world.cell(...goals[0]!.at).story });
    expect(goalsOf(at(0, 3), world, [STONES])).toEqual([]);
  });
});

describe('Hinführen: Ruf und Freund', () => {
  const chime = only('eis:glockenspiel');

  it('der Ruf: nur in Hörweite, höchstens alle 7 s, mit dem eigenen Klang des Dings', () => {
    const [x, y] = fieldAt(CHIME, HEAR - 4);
    const near = run(at(x, y), CALL_EVERY * 2 + 10, chime);
    const calls = near.events.filter((e) => e.what === 'call');
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls.length).toBeLessThanOrEqual(3);
    expect(calls[0]).toMatchObject({ id: 'eis:glockenspiel', call: { type: 'icicle' } });
    expect(calls[0]!.near).toBeGreaterThan(0);
    expect(calls[0]!.near).toBeLessThan(1);
    const [fx, fy] = fieldAt(CHIME, HEAR + 4);
    expect(run(at(fx, fy), CALL_EVERY * 2, chime).events.filter((e) => e.what === 'call')).toEqual([]);
  });

  it('der Freund erscheint in Lockweite, steht drei Schritte vor der Figur auf ihrem Weg und zieht mit', () => {
    const start = fieldAt(CHIME, LURE - 6);
    const r = run(at(...start), 12, chime);
    expect(r.events.filter((e) => e.what === 'friend')).toHaveLength(1);
    const f = r.s.lure!.friend!;
    expect(f.id).toBe('eis:glockenspiel');
    const gap = (p: Point) => Math.hypot(p[0] - f.at[0], p[1] - f.at[1]);
    expect(gap([f.x, f.y])).toBeLessThan(gap(start)); // näher am Ding als die Figur
    expect(Math.abs(f.x - start[0]) + Math.abs(f.y - start[1])).toBe(AHEAD); // drei Schritte, jeder begehbar
    // die Figur geht auf sein Feld: Er rückt weiter vor, und der Abstand schrumpft
    const moved = run({ ...r.s, player: { x: f.x, y: f.y, dir: 's' } }, 2, chime).s.lure!.friend!;
    expect(gap([moved.x, moved.y])).toBeLessThan(gap([f.x, f.y]));
    expect(moved.stalled).toBeLessThanOrEqual(2);
    // weiter weg als die Lockweite erscheint er nicht
    const [ox, oy] = fieldAt(CHIME, LURE + 4);
    expect(run(at(ox, oy), 30, chime).s.lure?.friend).toBeUndefined();
  });

  it('nah am Ding schwebt er über ihm; der Weg führt nur über begehbare Felder', () => {
    const [x, y] = fieldAt(CHIME, NEAR);
    expect(aheadOf(at(x, y), world, CHIME)).toEqual(CHIME);
    const start = fieldAt(CHIME, 14);
    let p = start;
    for (let i = 0; i < 12; i++) {
      const next = aheadOf(at(...p), world, CHIME);
      if (key(next) === key(CHIME)) break;
      expect(Math.abs(next[0] - p[0]) + Math.abs(next[1] - p[1])).toBeLessThanOrEqual(AHEAD);
      expect(world.cell(...next).solid).toBe(false);
      p = next;
    }
    expect(Math.hypot(p[0] - CHIME[0], p[1] - CHIME[1])).toBeLessThan(
      Math.hypot(start[0] - CHIME[0], start[1] - CHIME[1]),
    );
    expect(canStep(world, ['eis'], p[0], p[1], p[0], p[1])).toBe(true);
  });

  it('folgt die Figur nicht, gibt er nach 15 s auf: höchstens zwei Versuche je Ziel und Tag, dazwischen Ruhe; nicht folgen hat keine Folge', () => {
    const start = at(...fieldAt(CHIME, LURE - 6));
    const one = run(start, GIVE_UP + 15, chime);
    expect(one.events.filter((e) => e.what === 'leave')).toHaveLength(1);
    expect(one.s.lure).toMatchObject({ tries: { 'eis:glockenspiel': 1 } });
    expect(one.s.lure!.friend).toBeUndefined();
    expect(run(one.s, REST - 30, chime).s.lure!.friend).toBeUndefined(); // Ruhe
    const two = run(one.s, REST + GIVE_UP + 30, chime);
    expect(two.s.lure!.tries).toEqual({ 'eis:glockenspiel': 2 });
    const done = run(two.s, REST + GIVE_UP * 2, chime);
    expect(done.events.filter((e) => e.what === 'friend')).toEqual([]); // heute nicht mehr
    expect(done.events.filter((e) => e.what === 'call')).toEqual([]); // und es ruft auch nicht mehr
    expect(TRIES).toBe(2);
    expect({ ...done.s, lure: undefined, tick: 0 }).toEqual({ ...start, lure: undefined, tick: 0 }); // sonst nichts
    // am nächsten Spieltag wieder
    const next = run({ ...done.s, day: done.s.day + 1 }, 15, chime);
    expect(next.events.filter((e) => e.what === 'friend')).toHaveLength(1);
    // sind die Versuche für das erste Ziel aufgebraucht, ist das nächste dran
    const bed = world.homes.eis.bed;
    const both = goalsOf(at(bed[0], bed[1] + 2), world, SIGHTS).map((g) => g.sight.id);
    const spent = run(
      at(bed[0], bed[1] + 2, { lure: { day: 0, tries: { [both[0]!]: TRIES }, callAt: 0, restUntil: 0 } }),
      10,
    );
    expect(spent.s.lure!.goal?.id).toBe(both[1]);
  });

  it('läuft die Figur weit weg, fliegt er fort, ohne dass es als Versuch zählt', () => {
    const r = run(at(...fieldAt(CHIME, LURE - 6)), 12, chime);
    const [fx, fy] = fieldAt(CHIME, LOSE + 6);
    const gone = run({ ...r.s, player: { x: fx, y: fy, dir: 's' } }, 3, chime);
    expect(gone.events.map((e) => e.what)).toEqual(['leave']);
    expect(gone.s.lure!.tries).toEqual({});
  });
});

describe('Hinführen: gefunden', () => {
  it('der erste Ton am Glockenspiel: gemerkt (gespeichert), der Freund freut sich und ist fort, danach für immer still', () => {
    const [x, y] = [CHIME[0] - 1, CHIME[1]];
    const lured = run(at(x - 6, y), 12, only('eis:glockenspiel')).s;
    expect(lured.lure!.friend?.id).toBe('eis:glockenspiel');
    const walk = (s: State) => step(s, world, { type: 'move', dir: 'e' }, undefined, undefined, PACKS);
    const r = walk({ ...lured, player: { x, y, dir: 'e' } });
    const types = r.events.map((e) => ('what' in e ? `${e.type}:${e.what}` : e.type));
    expect(types).toContain('icicle');
    expect(types).toContain('sight:found');
    expect(r.state.found).toEqual(['eis:glockenspiel']);
    expect(r.state.lure!.friend).toBeUndefined();
    expect(r.state.lure!.restUntil).toBe(r.state.tick + PAUSE);
    // noch einmal klingen: kein zweites Finden
    const again = walk({ ...r.state, player: { x, y, dir: 'e' } });
    expect(again.events.filter((e) => e.type === 'sight')).toEqual([]);
    // und das Glockenspiel lockt nie wieder
    const later = run(
      { ...r.state, player: { x: x - 6, y, dir: 'e' } },
      PAUSE + CALL_EVERY * 2,
      only('eis:glockenspiel'),
    );
    expect(later.events).toEqual([]);
  });

  it('ein Ereignis ohne eingetragene Sehenswürdigkeit (ihr Paket fehlt) merkt nichts', () => {
    const s = at(CHIME[0] - 1, CHIME[1]);
    const events = [{ type: 'icicle', x: CHIME[0], y: CHIME[1], note: 0 }];
    sightStep(s, world, 'move', events as unknown as Parameters<typeof sightStep>[3], [STONES]);
    expect(s.found).toEqual([]);
    expect(events).toHaveLength(1);
  });
});

describe('Hinführen: Ruhezeiten und Vorrang', () => {
  const base = at(...fieldAt(CHIME, 8));
  const lead = { ...base.animals[0]!, id: 'x', mode: 'lead' } as unknown as State['animals'][number];
  const herald = { id: 'tok', mode: 'herald' } as unknown as State['animals'][number];

  it.each([
    ['im Schlaf', { sleeping: true }],
    ['beim Fahren', { ride: { id: 'schlitten' } as unknown as State['ride'] }],
    ['am Abend', { late: true }],
    ['in den ersten 20 s nach dem Aufwachen', { wokeAt: base.tick - CALM + 5 }],
    ['solange der Pinguin fällig ist', { guideDue: 5 }],
    ['solange der Pinguin führt', { animals: [lead] }],
    ['solange ein Bote wach wartet', { animals: [herald] }],
    ['solange gebaut wird', { work: { from: 0, to: 9999 } }],
    ['solange gegraben wird', { dig: { from: 0, to: 9999 } }],
    ['beim Hau-ruck', { heave: { gate: 'hoehle', n: 1, at: 0 } }],
    ['solange das Eistor aufgeht', { ritual: base.tick + 60 }],
  ] as [string, Partial<State>][])('%s lockt nichts', (_, more) => {
    const s = { ...base, ...more };
    expect(quiet(s)).toBe(true);
    const r = run({ ...s, wokeAt: more.wokeAt === undefined ? s.wokeAt : s.tick + 500 }, 80);
    expect(r.events).toEqual([]);
    expect(r.s.lure?.friend).toBeUndefined();
  });

  it('sonst schon; ein Bote, der nur noch wohnt (Tok nach Bau 2) oder schläft, hält nichts auf; ein Freund verschwindet still, wenn Ruhe beginnt', () => {
    expect(quiet(base)).toBe(false);
    expect(quiet({ ...base, animals: [{ ...herald, solo: true }] })).toBe(false);
    expect(quiet({ ...base, animals: [{ ...herald, nap: true }] })).toBe(false);
    const r = run(base, 12);
    expect(r.s.lure!.friend).toBeDefined();
    const hushed = run({ ...r.s, late: true }, 2);
    expect(hushed.events).toEqual([]);
    expect(hushed.s.lure!.friend).toBeUndefined();
  });
});

describe('Hinführen: was die Pakete eintragen', () => {
  const cave = (more: Partial<State> = {}): State => {
    const [bx, by] = world.homes.hoehle.bed;
    return { ...at(bx, by + 2), openGates: ['eis', 'hoehle'], ...more };
  };
  const ofPack = (pack: unknown, id: string) => (pack as { sights: readonly Sight[] }).sights.find((x) => x.id === id)!;

  it('Eis-Welt: Es lockt nur ein Schneehaufen, der noch kein fertiger Schneemann ist', () => {
    const heaps = ofPack(EIS_PACK, 'eis:schneehaufen');
    const s = at(...world.homes.eis.bed);
    const all = heaps.cells(world, s);
    expect(all.length).toBeGreaterThan(0);
    for (const p of all) expect(world.cell(...p).deco).toBe('snowheap');
    const [x, y] = all[0]!;
    const built = { ...s, packs: { eis: { v: 1, snow: { [`${x},${y}`]: 3 } } } };
    expect(heaps.cells(world, built).map(key)).not.toContain(key([x, y]));
    expect(heaps.cells(world, built)).toHaveLength(all.length - 1);
    expect(heaps.call(world, [x, y])).toEqual({ type: 'snowman', x, y, stage: 1 });
  });

  it('Grotte: Laterne (nur solange sie auf dem Sockel steht), Säulen, Netze, Steg; vom Höhlenbett nach hinten die Laterne zuerst', () => {
    const goals = goalsOf(cave(), world, SIGHTS);
    // dazu die vier Spielorte (Issue 56): Echo-Wand, Leuchtpilze, Kristalltürmchen, Zahlen-Kristalle
    expect(goals.map((g) => g.sight.id).sort()).toEqual([
      'hoehle:echo',
      'hoehle:laterne',
      'hoehle:leuchtpilze',
      'hoehle:netze',
      'hoehle:saeulen',
      'hoehle:steg',
      'hoehle:tuermchen',
      'hoehle:zahlen',
    ]);
    expect(goals[0]!.sight.id).toBe('hoehle:laterne');
    const decos = Object.fromEntries(goals.map((g) => [g.sight.id, world.cell(...g.at).deco]));
    expect(decos).toEqual({
      'hoehle:echo': 'echostone',
      'hoehle:laterne': 'lantern',
      'hoehle:leuchtpilze': 'sleepshroom',
      'hoehle:netze': 'web',
      'hoehle:saeulen': 'column',
      'hoehle:steg': 'jetty',
      'hoehle:tuermchen': 'crystalheap',
      'hoehle:zahlen': 'numstone',
    });
    for (const g of goals)
      expect(g.sight.call(world, g.at).type).toBe(
        {
          'hoehle:echo': 'echo',
          'hoehle:laterne': 'lantern',
          'hoehle:leuchtpilze': 'caveshroom',
          'hoehle:netze': 'web',
          'hoehle:saeulen': 'column',
          'hoehle:steg': 'olm',
          'hoehle:tuermchen': 'cavetower',
          'hoehle:zahlen': 'numstone',
        }[g.sight.id],
      );
    expect(goalsOf(cave({ lamp: 'hoehle' }), world, SIGHTS).map((g) => g.sight.id)).not.toContain('hoehle:laterne');
    // ohne Grotte keine Laterne
    expect(ofPack(HOEHLE_PACK, 'hoehle:laterne').cells(worldOf(1, [EIS_PACK]), cave())).toEqual([]);
  });

  it('Grubenbahn: Vor dem Graben lockt der Grubenhalt, sobald der Maulwurf wohnt; nach dem Graben nicht mehr', () => {
    const w = worldOf(1, [HOEHLE_PACK, GRUBE_PACK]);
    const dig = ofPack(GRUBE_PACK, 'grube:graben');
    const s = cave();
    expect(dig.cells(w, s)).toHaveLength(1);
    expect(w.realm(...dig.cells(w, s)[0]!)).toBe('hoehle');
    expect(dig.ready!(s, w)).toBe(false); // der Maulwurf wohnt noch nicht
    const home = { ...s, garden: [{ id: FIRST_MOLE, species: 'maulwurf' as const }] };
    expect(dig.ready!(home, w)).toBe(true);
    expect(dig.done!(home)).toBe(false);
    expect(dig.done!({ ...home, packs: DUG })).toBe(true);
    expect(dig.call(w, [3, 4])).toEqual({ type: 'herald', what: 'dig', id: FIRST_MOLE, x: 3, y: 4 });
    expect(dig.cells(worldOf(1, [EIS_PACK]), s)).toEqual([]); // ohne Grotte kein Halt
  });

  it('Halt eines Fahrzeugs: Es lockt sein Sitz, solange es am Halt der Gegend steht, wach ist und noch nie gefahren hat', () => {
    const halt = ofPack(EIS_PACK, 'halt:schlitten');
    const s = at(...world.homes.eis.bed);
    expect(halt.cells(world, s)).toEqual([]); // noch nicht erschienen
    const here = { ...s, packs: { fahrt: { schlitten: { stage: 'bereit' } } } };
    const seat = halt.cells(world, here);
    expect(seat).toHaveLength(1);
    expect(world.cell(...seat[0]!).ride).toBe('schlitten');
    expect(halt.done!(here)).toBe(false);
    expect(halt.call(world, seat[0]!)).toMatchObject({ type: 'ride', what: 'nudge', id: 'schlitten' });
    expect(halt.cells(world, { ...here, dozing: ['schlitten'] })).toEqual([]); // schläft (ein Paket fehlt)
    expect(halt.done!({ ...here, packs: { fahrt: { schlitten: { stage: 'bereit', gefahren: true } } } })).toBe(true);
    expect(halt.done!({ ...here, packs: { fahrt: { schlitten: { stage: 'fest' } } } })).toBe(true);
    expect(goalsOf(here, world, [halt]).map((g) => g.sight.id)).toEqual(['halt:schlitten']);
  });
});

describe('Karte: Zeichen gefundener Sehenswürdigkeiten (Issue 32)', () => {
  const all = sightsOf(ALL);

  it('nichts gefunden: kein Zeichen, die Karte verrät nichts; jede Sehenswürdigkeit hat eine Farbe', () => {
    const fresh = { ...at(...world.homes.eis.bed), heard: [] };
    expect(marksOf(fresh, world, all)).toEqual([]);
    for (const x of all) expect(x.color, x.id).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('gefunden: ihre Felder in ihrer Farbe; Schneehaufen samt fertiger Schneemänner; Klangsteine je gehörtem Stein', () => {
    const s = at(...world.homes.eis.bed, { heard: [] });
    const chime = marksOf({ ...s, found: ['eis:glockenspiel'] }, world, all);
    expect(chime.map((m) => key(m.at)).sort()).toEqual(ICICLES.map(key).sort());
    expect(new Set(chime.map((m) => m.color))).toEqual(new Set(['#9fe0ff']));
    const heaps = only('eis:schneehaufen')[0]!.cells(world, s);
    const built = { ...s, found: ['eis:schneehaufen'], packs: { eis: { v: 1, snow: { [key(heaps[0]!)]: 3 } } } };
    expect(marksOf(built, world, only('eis:schneehaufen'))).toHaveLength(heaps.length);
    const heard = marksOf({ ...s, heard: ['bett'] }, world, [STONES]);
    expect(heard).toEqual([{ at: world.stones.get('bett'), color: STONES.color }]);
  });

  it('Halte: Zeichen am Sitz, sobald die Figur einmal gefahren ist; der Grubenhalt vor dem Graben hat kein eigenes', () => {
    const halt = only('halt:schlitten');
    const s = at(...world.homes.eis.bed);
    const here = { ...s, packs: { fahrt: { schlitten: { stage: 'bereit' } } } };
    expect(marksOf(here, world, halt)).toEqual([]);
    const rode = { ...s, packs: { fahrt: { schlitten: { stage: 'bereit', gefahren: true } } } };
    expect(marksOf(rode, world, halt)).toEqual([{ at: halt[0]!.cells(world, rode)[0], color: halt[0]!.color }]);
    const dig = all.filter((x) => x.id === 'grube:graben');
    expect(marksOf({ ...s, packs: DUG }, world, dig)).toEqual([]);
  });
});

describe('Hinführen: Bild und Ton', () => {
  it('der Freund: klein, über dem Boden, in seinen eigenen Farben, kein Gold; vier Bilder der Wippe', () => {
    const gold = new Set<string>(Object.values(GOLD));
    for (let k = 0; k < 4; k++)
      for (const [f, r, z, l, w, h, side, top] of friendParts(k)) {
        expect(Math.max(Math.abs(f), Math.abs(f + l), Math.abs(r), Math.abs(r + w))).toBeLessThanOrEqual(0.5); // nie breiter als sein Feld
        expect(z).toBeGreaterThanOrEqual(0.9);
        expect(z + h).toBeLessThanOrEqual(1.5);
        expect(gold.has(side) || gold.has(top ?? '')).toBe(false);
      }
    expect(friendParts(0)).not.toEqual(friendParts(1));
  });

  it('nur sein Kern leuchtet (`halo`, kompakt), Flügel und Schweif nicht', () => {
    for (let k = 0; k < 4; k++) {
      const lit = friendParts(k).filter((p) => p[9]?.halo);
      expect(lit.map((p) => p[6])).toEqual([FRIEND_COLORS.core]);
      expect(haloCompact(lit[0]![3], lit[0]![4], lit[0]![5])).toBe(true);
    }
  });

  it('er gleitet weich zu seinem Feld, glimmt im Dunkeln und steht bei reduzierter Bewegung gleich dort', () => {
    const look = new FriendLook();
    const lure = (x: number): State['lure'] => ({
      day: 0,
      tries: {},
      callAt: 0,
      restUntil: 0,
      friend: { id: 'a', at: [9, 0], x, y: 0, best: 9, stalled: 0, from: '' },
    });
    expect(look.bodies(undefined, () => 1, 0, false)).toEqual([]);
    const [first] = look.bodies(lure(2), () => 1, 0, false);
    expect(first).toMatchObject({ id: FRIEND_ID, x: 2, y: 0, z: 1, dir: 'e', beacon: true });
    const [mid] = look.bodies(lure(5), () => 1, 100, false);
    expect(mid!.x).toBeGreaterThan(2);
    expect(mid!.x).toBeLessThan(5);
    expect(look.bodies(lure(5), () => 1, 3000, false)[0]!.x).toBeCloseTo(5, 1);
    expect(look.bodies(lure(7), () => 1, 3010, true)[0]).toMatchObject({ x: 7, key: `${FRIEND_ID}:0` });
    expect(FRIEND_ID.startsWith('ride:')).toBe(false); // Antippen trifft ihn nicht
  });

  it('Töne: der Ruf ist der eigene Klang, leiser und kürzer; der Freund zwitschert hell', () => {
    const tones: Scored[] = [
      [440, 0.2, 'sine', 0.1, 1, 0],
      [660, 0.2, 'sine', 0.1, 1, 0.5],
      [880, 0.2, 'sine', 0.1, 1, 1.5],
    ];
    const far = hush(tones, 0);
    expect(far.map((t) => t[0])).toEqual([440, 660]); // was später als `HUSH.span` beginnt, fällt weg
    expect(far[0]![3]).toBeCloseTo(0.1 * HUSH.far);
    expect(hush(tones, 1)[0]![3]).toBeCloseTo(0.1 * HUSH.near);
    expect(hush(tones, 5)[0]![3]).toBeCloseTo(0.1 * HUSH.near);
    expect(melodyStart(STORIES.bett.melody)).toHaveLength(3);
    expect(melodyStart(STORIES.bett.melody)[0]![5]).toBe(0);
    for (const what of ['friend', 'found', 'leave'] as const) {
      expect(friendScore(what).length).toBeGreaterThan(0);
      for (const t of friendScore(what)) expect(t[3]).toBeLessThanOrEqual(0.05); // leise
    }
    expect(friendScore('call')).toEqual([]);
  });
});
