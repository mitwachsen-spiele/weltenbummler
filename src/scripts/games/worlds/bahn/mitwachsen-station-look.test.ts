// Der Zug fährt immer vorwärts (Rückmeldung zur Höhle, Punkt 1): Geparkt behält er die Richtung, mit der er ankam; er
// dreht nur am Takt, an dem er losfährt, hinter einer ganz deckenden Dampfkugel je Wagen, bei reduzierter Bewegung ohne
// Wolke (mitwachsen-station-look.ts `headingOf`, `puffOf`). Nur Bild: Regeln, Spielstand und Welt bleiben. Reine Regeln
// über `step` mit den Paketen wie im Spiel, das Bild über `stationBodies`
import { describe, expect, it } from 'vitest';
import { DIRS, type Part } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import { PUFF, carParts, type CarLook } from '../../../../data/games/worlds/bahn/mitwachsen-train-model';
import { DEPART } from '../../mitwachsen-ride-kit';
import { withTok } from '../../mitwachsen-ride-save';
import type { RideAt, RideBody } from '../../mitwachsen-ride-view';
import type { End } from '../../mitwachsen-rider';
import { initialState, step, type Cmd, type State } from '../../mitwachsen-state';
import type { World } from '../../mitwachsen-world';
import { BAHN_PACK, FAHRT_PACK, HOEHLE_PACK, worldOf } from '../../test-worlds';
import { withBuilt } from './mitwachsen-built';
import { FLIES } from './mitwachsen-feast-look';
import { PUFF_T, REAR_ROW, headingOf, puffOf, stationBodies, stationOf } from './mitwachsen-station-look';
import { TRAIN, farOf, lineOf, trainRoute } from './mitwachsen-train';

const W1 = worldOf(1, [BAHN_PACK], { bahn: { built: 1 } });
const W2 = worldOf(1, [HOEHLE_PACK, BAHN_PACK], { bahn: { built: 2 } });
const RULES = [BAHN_PACK, FAHRT_PACK];
const TICK: Cmd = { type: 'tick' };
const AT: RideAt = { now: 0, frac: 1, reduced: false, lit: false };
/** Nach Bau 1, vor der ersten Fahrt: Tok sitzt im hinteren Wagen */
const READY = withBuilt(withTok({}, { stage: 'bereit' }), 1);
/** Nach dem Hau-ruck und Bau 2: der Zug fährt bis Bahnhof Fledermaus */
const OPEN = withBuilt(withTok({}, { stage: 'offen', gefahren: true }), 2);
const STEPS = 4; // Größen einer Dampfkugel (`PUFF_STEPS`)

function awake(world: World, p: Point, packs: Record<string, unknown>, more: Partial<State> = {}): State {
  const s = initialState(world, { packs });
  return { ...s, sleeping: false, wokeAt: -100, player: { x: p[0], y: p[1], dir: 's' }, animals: [], ...more };
}
const tick = (s: State, world: World, c: Cmd = TICK) => step(s, world, c, undefined, undefined, RULES).state;
/** Einsteigen per Antippen (die Figur steht am Halt) */
const board = (s: State, world: World) =>
  tick(s, world, { type: 'move', dir: 'n', fresh: true, tap: true, ride: TRAIN.id });

/** Ein Bild der Fahrt: Wagen nach Art, Dampfkugeln, Dampf, Glühwürmchen */
type Frame = {
  s: State;
  cars: Record<CarLook['kind'], RideBody>;
  puffs: RideBody[];
  steam?: RideBody;
  flies: RideBody[];
};
function frame(s: State, world: World, at: RideAt = AT): Frame {
  const all = stationBodies(s, world, at);
  const car = (kind: string) => all.find((b) => b.id === `ride:hoehle:${kind}`)!;
  return {
    s,
    cars: { loco: car('loco'), mid: car('mid'), rear: car('rear') },
    puffs: all.filter((b) => b.id.startsWith('ride:hoehle:puff:')),
    steam: all.find((b) => b.id === 'ride:hoehle:dampf'),
    flies: all.filter((b) => b.id.startsWith('bahn:gluehwurm:')),
  };
}

/** Stelle eines Körpers im Gleis von Bahnhof Bär an (das nächste Feld der Linie) */
function idxOf(line: readonly Point[], b: Pick<RideBody, 'x' | 'y'>): number {
  let best = 0;
  line.forEach(([x, y], i) => {
    if (Math.hypot(x - b.x, y - b.y) < Math.hypot(line[best]![0] - b.x, line[best]![1] - b.y)) best = i;
  });
  return best;
}

/**
 * Wohin die Lok im Bild schaut: `home`, wenn sie weiter zur Höhle steht als der hintere Wagen und ihre Blickrichtung
 * das Gleis hinauf zeigt; `out` umgekehrt; `?` wenn Lage und Blick nicht zusammenpassen
 */
function lookOf(f: Frame, world: World): End | '?' {
  const line = lineOf(world, farOf(f.s));
  const [l, r] = [idxOf(line, f.cars.loco), idxOf(line, f.cars.rear)];
  const i = Math.max(1, Math.min(line.length - 2, l));
  const [dx, dy] = DIRS[f.cars.loco.dir];
  const up = dx * (line[i + 1]![0] - line[i - 1]![0]) + dy * (line[i + 1]![1] - line[i - 1]![1]);
  if (l > r && up > 0) return 'home';
  if (l < r && up < 0) return 'out';
  return '?';
}

/** Fahren, bis die Figur ausgestiegen ist; je Takt Bilder bei `fracs` (nach dem Einsteigen, vor jedem Takt) */
function ride(world: World, s: State, fracs = [0, 0.5, 1], reduced = false): { s: State; frames: Frame[] } {
  let x = board(s, world);
  const frames: Frame[] = [];
  for (let i = 0; i < 500 && x.ride; i++) {
    for (const frac of fracs) frames.push(frame(x, world, { ...AT, frac, reduced }));
    x = tick(x, world);
  }
  return { s: x, frames };
}

/** Quader eines Modells als Hülle [vorn, rechts, unten] bis [vorn, rechts, oben] */
function hull(parts: readonly Part[]): [number[], number[]] {
  const lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity];
  for (const [f, r, z, l, w, h] of parts)
    [f, r, z].forEach((v, k) => {
      lo[k] = Math.min(lo[k]!, v);
      hi[k] = Math.max(hi[k]!, v + [l, w, h][k]!);
    });
  return [lo, hi];
}

describe('Der Zug fährt immer vorwärts: geparkt wie angekommen', () => {
  const st = stationOf(W1)!;

  it('nach Bau 1 an Bahnhof Bär: die Lok schaut zu Bär, Tok sitzt im hinteren Wagen auf REAR_ROW, bis der Zug zum ersten Mal abfährt', () => {
    const s = awake(W1, st.rows[3]!.edge, READY);
    const f = frame(s, W1);
    expect(lookOf(f, W1)).toBe('out');
    const rear = st.line[REAR_ROW]!;
    expect(Math.hypot(f.cars.rear.x - rear[0], f.cars.rear.y - rear[1])).toBeLessThan(0.6);
    expect(f.cars.rear.key).toMatch(/:rear:1/); // Tok sitzt darin
    // eingestiegen, Türen zu: bis zur Abfahrt bleibt alles, wie es ist
    const { frames } = ride(W1, s, [1]);
    const seated = frames.filter((x) => x.s.ride?.phase === 'seated');
    expect(seated.length).toBe(DEPART);
    const bad = seated.filter(
      (x) =>
        lookOf(x, W1) !== 'out' ||
        Math.hypot(x.cars.rear.x - rear[0], x.cars.rear.y - rear[1]) >= 0.6 ||
        !/:rear:1/.test(x.cars.rear.key),
    );
    expect(bad.map((x) => x.s.tick)).toEqual([]);
  });

  it('nach jeder Ankunft: am Prellbock in der Bucht und an Bahnhof Fledermaus zur Höhle, zurück an Bahnhof Bär zu Bär', () => {
    const there = ride(W1, awake(W1, st.rows[3]!.edge, READY)).s;
    expect(there.docked?.hoehle).toBe('home');
    expect(lookOf(frame(there, W1), W1)).toBe('home');
    const back = ride(W1, there).s;
    expect(back.docked?.hoehle).toBe('out');
    expect(lookOf(frame(back, W1), W1)).toBe('out');
    // mit Ausbau 2 und offenem Höhlentor bis Bahnhof Fledermaus
    const st2 = stationOf(W2)!;
    const cave = ride(W2, awake(W2, st2.rows[3]!.edge, OPEN, { openGates: ['hoehle'] })).s;
    expect(W2.realm(cave.player.x, cave.player.y)).toBe('hoehle');
    expect(lookOf(frame(cave, W2), W2)).toBe('home');
    expect(lookOf(frame(ride(W2, cave).s, W2), W2)).toBe('out');
  });
});

describe('Der Zug fährt immer vorwärts: er dreht nur bei der Abfahrt hinter Dampf', () => {
  const st = stationOf(W1)!;
  const start = awake(W1, st.rows[3]!.edge, READY);

  it('unterwegs schaut die Lok in Fahrtrichtung (`ride.to`), zur Höhle wie zu Bär; Dampf und Tür drehen mit', () => {
    const there = ride(W1, start);
    const back = ride(W1, there.s);
    const bad: string[] = [];
    for (const f of [...there.frames, ...back.frames]) {
      const ride = f.s.ride!;
      if (ride.phase === 'seated') continue;
      if (lookOf(f, W1) !== ride.to) bad.push(`Takt ${f.s.tick} nach ${ride.to}: ${lookOf(f, W1)}`);
      if (f.steam && f.steam.dir !== f.cars.loco.dir) bad.push(`Takt ${f.s.tick}: Dampf schaut ${f.steam.dir}`);
    }
    expect(bad).toEqual([]);
    expect(headingOf({ phase: 'seated', to: 'home' })).toBe('out');
    expect(headingOf({ phase: 'seated', to: 'out' })).toBe('home');
    // aus der Bucht in die Höhle (`Ride.from`): steht schon zum Tor, dreht also nicht
    expect(headingOf({ phase: 'seated', to: 'home', from: { end: 'home', pos: 9 } })).toBe('home');
    for (const phase of ['go', 'stop', 'arrive'] as const)
      for (const to of ['home', 'out'] as const) expect(headingOf({ phase, to })).toBe(to);
  });

  it('der Wechsel kommt genau am Takt der Abfahrt, nie ohne ganz deckende Dampfkugeln über allen drei Wagen', () => {
    for (const s of [start, ride(W1, start).s]) {
      const { frames } = ride(W1, s, [0, 0.25, 0.5, 0.75, 1]);
      const turns: string[] = [];
      const bad: string[] = [];
      frames.forEach((f, i) => {
        const prev = frames[i - 1];
        if (!prev || lookOf(prev, W1) === lookOf(f, W1)) return;
        turns.push(`${prev.s.ride!.phase}→${f.s.ride!.phase}`);
        for (const x of [prev, f])
          if (x.puffs.length !== 3 || x.puffs.some((p) => !p.key.endsWith(`:puff:${STEPS}`)))
            bad.push(`Takt ${x.s.tick}: ${x.puffs.map((p) => p.key).join(' ')}`);
      });
      expect(turns).toEqual(['seated→go']);
      expect(bad).toEqual([]);
      // Dampf über der Lok springt beim Wechsel ans andere Ende: während der Wolke ist keiner da
      expect(frames.filter((f) => f.puffs.length && f.steam).map((f) => f.s.tick)).toEqual([]);
      // die Wolke wächst vor dem Wechsel und vergeht danach; sonst keine
      const shown = frames.filter((f) => f.puffs.length > 0);
      const ticks = shown.map((f) => f.s.tick - (f.s.ride!.phase === 'seated' ? f.s.ride!.at + DEPART : 0));
      expect(shown.length).toBeGreaterThan(0);
      expect(Math.min(...ticks.filter((t) => t < 0))).toBeGreaterThanOrEqual(PUFF_T.from - 1);
      expect(frames.filter((f) => f.s.ride!.phase === 'arrive' && f.puffs.length)).toEqual([]);
    }
  });

  it('je Wagen eine Kugel über seiner Mitte, 1,8 Felder groß, die den ganzen Wagen samt Figur, Tok und Wimpel deckt', () => {
    const { frames } = ride(W1, start, [1]);
    const full = frames.find((f) => f.puffs.length === 3 && f.puffs[0]!.key.endsWith(`:puff:${STEPS}`))!;
    for (const kind of ['loco', 'mid', 'rear'] as const) {
      const car = full.cars[kind];
      expect(full.puffs.some((p) => Math.hypot(p.x - car.x, p.y - car.y) < 1e-6 && p.z === car.z)).toBe(true);
    }
    expect(full.puffs.map((p) => p.foot)).toEqual([0, 0, 0]); // Dampf schwebt: kein Fleck am Boden
    const [plo, phi] = hull(full.puffs[0]!.parts);
    expect(phi[0]! - plo[0]!).toBeCloseTo(PUFF);
    // jede Form eines Wagens, gedreht in jede Richtung (quer wie längs liegt sie in der Kugel)
    const looks: CarLook[] = [
      { kind: 'loco', tok: false, door: 0, lit: true, pennant: true },
      { kind: 'mid', tok: false, door: 0, rider: true },
      { kind: 'rear', tok: true, door: 0 },
    ];
    for (const look of looks) {
      const [lo, hi] = hull(carParts(look));
      const across = Math.max(...[0, 1].map((k) => Math.max(-lo[k]!, hi[k]!)));
      expect(across, look.kind).toBeLessThanOrEqual(Math.min(-plo[1]!, phi[1]!, -plo[0]!, phi[0]!) + 0.02);
      expect(hi[2]!, look.kind).toBeLessThanOrEqual(phi[2]!);
    }
  });

  it('bei reduzierter Bewegung keine Wolke: der Zug steht nach der Abfahrt einfach richtig herum da', () => {
    const { frames } = ride(W1, start, [0, 0.5, 1], true);
    expect(frames.filter((f) => f.puffs.length)).toEqual([]);
    const bad = frames.filter((f) => lookOf(f, W1) !== headingOf(f.s.ride!));
    expect(bad.map((f) => f.s.tick)).toEqual([]);
    expect(puffOf(frames[0]!.s, W1, { ...AT, reduced: true })).toBeUndefined();
  });

  it('ohne Fahrt des Zugs nie eine Wolke; nichts davon steht im Spielstand', () => {
    expect(puffOf(start, W1, AT)).toBeUndefined();
    expect(frame(start, W1).puffs).toEqual([]);
    const { s } = ride(W1, start);
    expect(s.packs).toEqual(withTok(READY, { stage: 'bereit', gefahren: true }));
  });

  it('die Glühwürmchen der Laternenfahrt folgen dem letzten Wagen, in welche Richtung er auch fährt', () => {
    const st2 = stationOf(W2)!;
    const s = awake(W2, st2.rows[3]!.edge, OPEN, { openGates: ['hoehle'] });
    const r = trainRoute(W2, s)!;
    const line = lineOf(W2, true);
    const bad: string[] = [];
    for (const to of ['home', 'out'] as const) {
      const pos = to === 'home' ? r.path.length - 12 : 12; // tief in der Grotte
      const ride = { id: TRAIN.id, phase: 'go', at: 0, pos, speed: 0.5, to, feast: true, jingleAt: 0, greeted: [] };
      const f = frame({ ...s, ride } as State, W2);
      const rear = idxOf(line, f.cars.rear);
      if (f.flies.length !== FLIES.n) bad.push(`${to}: ${f.flies.length} Glühwürmchen`);
      if (lookOf(f, W2) !== to) bad.push(`${to}: Lok schaut ${lookOf(f, W2)}`);
      for (const fly of f.flies) {
        const i = idxOf(line, fly);
        if (to === 'home' ? i > rear : i < rear) bad.push(`${to}: Glühwürmchen bei ${i}, hinterer Wagen bei ${rear}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('auf der Laternenfahrt (ab Bahnhof Fledermaus) springen die Glühwürmchen nie sichtbar: während der Wolke sind keine da', () => {
    const st2 = stationOf(W2)!;
    const s = awake(W2, st2.rows[3]!.edge, OPEN, { openGates: ['hoehle'] });
    const there = ride(W2, s);
    expect(there.s.ride).toBeUndefined();
    const { frames } = ride(W2, there.s, [0, 0.25, 0.5, 0.75, 1]);
    // die Festfahrt ist die Fahrt aus der Höhle (`to` = out); das Bild liest nur `ride.feast`
    const fracs = frames.map((_, i) => [0, 0.25, 0.5, 0.75, 1][i % 5]!);
    const feast = frames.map((f, i) =>
      frame({ ...f.s, ride: { ...f.s.ride!, feast: true } }, W2, { ...AT, frac: fracs[i]! }),
    );
    expect(feast.some((f) => f.puffs.length)).toBe(true);
    expect(feast.some((f) => f.flies.length === FLIES.n)).toBe(true);
    const bad: string[] = [];
    feast.forEach((f, i) => {
      if (f.puffs.length && (f.flies.length || f.steam))
        bad.push(`Takt ${f.s.tick}: Glühwürmchen oder Dampf in der Wolke`);
      const prev = feast[i - 1];
      if (!prev || prev.flies.length !== f.flies.length) return;
      f.flies.forEach((fly, k) => {
        const p = prev.flies[k]!;
        if (Math.hypot(fly.x - p.x, fly.y - p.y) > 1.2) bad.push(`Takt ${f.s.tick}: ${fly.id} springt`);
      });
    });
    expect(bad).toEqual([]);
  });
});

describe('Der Zug fährt immer vorwärts: am Tunnelportal', () => {
  it('beim Heranrollen (Bau 1) schaut die Lok zu Bär und kommt als Erstes aus dem Portal; was dahinter ist, bleibt verborgen', () => {
    const st = stationOf(W1)!;
    const s = { ...awake(W1, st.rows[3]!.edge, READY), work: { from: 0, to: 80 }, tick: 0 } as State;
    // Bau ohne Tok auf der Lichtung: der Zug rollt; je Bild nur Wagen vor dem Portal, die Lok zuerst
    const bad: string[] = [];
    let seen = 0;
    for (let t = 0; t <= 80; t++) {
      const all = stationBodies({ ...s, tick: t }, W1, AT);
      const kinds = ['loco', 'mid', 'rear'].filter((k) => all.some((b) => b.id === `ride:hoehle:${k}`));
      if (!kinds.length) continue;
      seen++;
      if (kinds[0] !== 'loco') bad.push(`Takt ${t}: ${kinds.join(',')}`);
      for (const k of kinds) {
        const b = all.find((x) => x.id === `ride:hoehle:${k}`)!;
        if (st.portal !== undefined && idxOf(st.line, b) > st.portal) bad.push(`Takt ${t}: ${k} hinter dem Portal`);
      }
      if (kinds.length === 3 && lookOf(frame({ ...s, tick: t }, W1), W1) !== 'out') bad.push(`Takt ${t}: Richtung`);
    }
    expect(seen).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  });
});
