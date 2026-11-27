// Bild und Ton des Grubenbähnchens Funkel (Rückmeldung zur Höhle, Schritt 15): Körper am Halt und unterwegs, Gold nur an
// der Tür bis zur ersten Fahrt, eigenes schmales Gleisbild, Töne in der Pentatonik
import { describe, expect, it } from 'vitest';
import type { Part } from '../../../../lib/games/front';
import { DIGITS } from '../../../../data/games/mitwachsen-digits';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import {
  FENCE_CRYSTAL,
  FUNKEL_COLORS,
  GRUBE_RAIL,
  HALT_COLORS,
  HALT_SIGN,
  PLANK,
  STONE_H,
  funkelParts,
  lapStoneParts,
} from '../../../../data/games/worlds/grube/mitwachsen-funkel-model';
import type { RideEvent } from '../../mitwachsen-pack-types';
import { withRidden } from '../../mitwachsen-ride-save';
import type { RideAt } from '../../mitwachsen-ride-view';
import { initialState, type State } from '../../mitwachsen-state';
import { DUG, GRUBE_PACK, HOEHLE_PACK, worldOf } from '../../test-worlds';
import { FUNKEL, funkelRoute, lapStonesOf } from './mitwachsen-funkel';
import { gangOf } from './mitwachsen-gang';
import {
  BLINK_MS,
  FUNKEL_ID,
  funkelBodies,
  funkelFx,
  funkelScores,
  grubeRails,
  haltBodies,
  lapScore,
  railShape,
} from './mitwachsen-funkel-look';
import { pack } from './index';

const world = worldOf(1, [HOEHLE_PACK, GRUBE_PACK], DUG);
const route = funkelRoute(world, { packs: DUG })!;
const AT: RideAt = { now: 0, frac: 1, reduced: false, lit: false };
const colors = (parts: readonly Part[]) => new Set(parts.flatMap((p) => [p[6], p[7] ?? p[6]]));
const gold = (parts: readonly Part[]) => parts.some((p) => p[6] === GOLD.side || p[7] === GOLD.top);
const PENTA = [0, 2, 4, 7, 9];
const penta = (hz: number) => PENTA.includes(((Math.round(12 * Math.log2(hz / 261.63)) % 12) + 12) % 12);

/** Wach in der Grotte, auf dem Bahnsteig neben dem Halt */
function inCave(packs: Record<string, unknown> = DUG, more: Partial<State> = {}): State {
  const s = initialState(world, { packs });
  const [x, y] = route.seats.home[0]!;
  return { ...s, sleeping: false, player: { x, y, dir: 'n' }, animals: [], ...more };
}

describe('Bild von Funkel', () => {
  it('am Halt: Lok vorn, erster Wagen am Sitz, zweiter dahinter, jeder in Fahrtrichtung; nur in der Grotte', () => {
    const bodies = funkelBodies(inCave(), world, AT);
    expect(bodies.map((b) => b.id)).toEqual([`${FUNKEL_ID}:loco`, `${FUNKEL_ID}:seat`, `${FUNKEL_ID}:rear`]);
    const [loco, seat, rear] = bodies;
    expect([seat!.x, seat!.y]).toEqual(route.stops.home);
    expect([loco!.x, loco!.y]).toEqual(route.path[1]);
    expect([rear!.x, rear!.y]).toEqual(route.path.at(-2));
    expect(bodies.some((b) => b.seat)).toBe(false); // ohne Fahrt sitzt niemand drin
    const bed = world.homes.lichtung.bed;
    expect(funkelBodies(inCave(DUG, { player: { x: bed[0], y: bed[1], dir: 's' } }), world, AT)).toEqual([]);
    expect(funkelBodies(inCave({}), world, AT)).toEqual([]); // vor dem Graben kein Bähnchen
  });

  it('Petrol und Creme; Gold nur am Rahmen der Tür des ersten Wagens bis zur ersten Fahrt, nicht wenn es schläft', () => {
    const bodies = funkelBodies(inCave(), world, AT);
    const all = colors(bodies.flatMap((b) => b.parts));
    expect(all.has(FUNKEL_COLORS.petrol[0])).toBe(true);
    expect(all.has(FUNKEL_COLORS.cream[0])).toBe(true);
    expect(bodies.filter((b) => gold(b.parts)).map((b) => b.id)).toEqual([`${FUNKEL_ID}:seat`]);
    const after = funkelBodies(inCave(withRidden({ ...DUG }, 'grube')), world, AT);
    expect(after.some((b) => gold(b.parts))).toBe(false);
    const dozing = funkelBodies(inCave(DUG, { dozing: ['grube'] }), world, AT);
    expect(dozing.some((b) => gold(b.parts))).toBe(false);
    // während einer Fahrt kein Gold, auch nicht in der ersten eigenen (dort gibt es nichts zu tun), wie beim Zug
    const going = {
      phase: 'go',
      at: 0,
      pos: 10,
      speed: 0.8,
      to: 'home',
      feast: false,
      jingleAt: 0,
      greeted: [],
    } as const;
    for (const id of ['grube', 'hoehle'] as const) {
      const riding = funkelBodies(inCave(DUG, { ride: { ...going, id, greeted: [] } }), world, AT);
      expect(riding.some((b) => gold(b.parts))).toBe(false);
    }
    // die Tür geht zum Bahnsteig auf, wenn das Kind anstößt
    const nudged = funkelBodies(inCave(DUG, { nudged: { id: 'grube', at: 0 }, tick: 3 }), world, AT);
    expect(nudged[1]!.parts.length).toBe(bodies[1]!.parts.length + 1);
  });

  it('keine Augen, kein Gesicht im Dunkeln: die runde Lampe ist sein Gesicht; sie leuchtet beim Fahren und am Abend', () => {
    for (const kind of ['loco', 'seat', 'rear'] as const)
      for (const lit of [false, true]) expect(funkelParts({ kind, lit }).some((p) => p[8] === 'f')).toBe(false);
    const off = colors(funkelParts({ kind: 'loco' }));
    const on = colors(funkelParts({ kind: 'loco', lit: true }));
    expect(off.has(FUNKEL_COLORS.lamp) && !off.has(FUNKEL_COLORS.lit)).toBe(true);
    expect(on.has(FUNKEL_COLORS.lit)).toBe(true);
    const evening = funkelBodies(inCave(), world, { ...AT, lit: true });
    expect(colors(evening[0]!.parts).has(FUNKEL_COLORS.lit)).toBe(true);
    // am Halt leuchtet die Lampe am Abend: die Dunkelmaske öffnet dort ein kleines Loch (`glow`), ohne Licht nicht
    expect(evening.filter((b) => b.glow).map((b) => b.id)).toEqual([`${FUNKEL_ID}:loco`]);
    expect(funkelBodies(inCave(), world, AT).some((b) => b.glow)).toBe(false);
    // stößt das Kind zu Fuß ein Klingeltor an, antwortet es am Halt: Die Lampe blinkt BLINK_MS lang, danach ist sie aus
    const lamp = (now: number, reduced = false) =>
      colors(funkelBodies(inCave(), world, { ...AT, now, reduced }, 1000)[0]!.parts).has(FUNKEL_COLORS.lit);
    const blinks = [1000, 1100, 1250, 1450, 1650, BLINK_MS + 1100].map((t) => lamp(t));
    expect(blinks).toEqual([true, true, false, true, false, false]);
    expect([1250, 1650].map((t) => lamp(t, true))).toEqual([true, true]); // bei reduzierter Bewegung ruhig an
    expect(lamp(900)).toBe(false);
  });

  it('unterwegs: die Figur sitzt im ersten Wagen, die Wagen gleiten; bei reduzierter Bewegung feste Bilder', () => {
    const ride = {
      id: 'grube',
      phase: 'go',
      at: 0,
      pos: 40.5,
      speed: 0.8,
      to: 'home',
      feast: false,
      jingleAt: 0,
      greeted: [],
    } as const;
    const s = inCave(DUG, { ride: { ...ride, greeted: [] } });
    const bodies = funkelBodies(s, world, AT);
    expect(bodies.find((b) => b.seat)?.id).toBe(`${FUNKEL_ID}:seat`);
    expect(colors(bodies[0]!.parts).has(FUNKEL_COLORS.lit)).toBe(true);
    expect(bodies.some((x) => x.glow)).toBe(false); // beim Fahren öffnet die Maske um Sitz und Lampe (`seat`)
    const [a, b] = [route.path[40]!, route.path[41]!];
    expect(bodies[1]!.x).toBeCloseTo(a[0] + (b[0] - a[0]) * 0.5);
    expect(bodies[1]!.y).toBeCloseTo(a[1] + (b[1] - a[1]) * 0.5);
    // bei reduzierter Bewegung feste Bilder: Halt, Klingeltor ein, Mitte des Gangs mit Wasserfall, Klingeltor aus, Halt;
    // dazwischen steht es (kein Gleiten), am Ende wieder am Halt
    const g = gangOf(world, route)!;
    const len = route.path.length - 1;
    const calmAt = (pos: number) => {
      const b = funkelBodies(inCave(DUG, { ride: { ...ride, pos, greeted: [] } }), world, { ...AT, reduced: true });
      return [b[1]!.x, b[1]!.y];
    };
    const frames = [0, g.gates.in - 0.5, g.gates.in, g.mid + 0.5, g.gates.out + 3, len - 0.2, len];
    expect(frames.map(calmAt)).toEqual(
      [0, 0, g.gates.in, g.mid, g.gates.out, g.gates.out, 0].map((i) => [...route.path[i]!]),
    );
    // fährt die Figur mit einem anderen Fahrzeug, steht Funkel am Halt, ohne sie
    const other = funkelBodies({ ...s, ride: { ...s.ride!, id: 'hoehle' } }, world, AT);
    expect(other.some((x) => x.seat)).toBe(false);
  });

  it('eigenes schmales Gleis: gerade und Kurven in allen Richtungen, im Feld (die Farben gegen das Gleis der Höhlenbahn prüft mitwachsen-ride-mix.test.ts)', () => {
    for (const to of ['ns', 'ew', 'ne', 'es', 'sw', 'wn']) {
      const shape = railShape(to)!;
      expect(shape.length).toBeGreaterThan(3);
      for (const [x, y, , w, d] of shape) {
        expect(x).toBeGreaterThanOrEqual(-1e-9);
        expect(y).toBeGreaterThanOrEqual(-1e-9);
        expect(x + w).toBeLessThanOrEqual(1 + 1e-9);
        expect(y + d).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
    expect(railShape('nn')).toBeUndefined();
    expect(new Set(railShape('ns')!.flatMap((b) => [b[6], b[7]]))).toEqual(
      new Set([...GRUBE_RAIL.sleeper, ...GRUBE_RAIL.rail]),
    );
    // jedes Feld der Runde zeigt sein Gleis; daneben nichts
    const missing = route.path.filter((p) => !grubeRails(world.cell(...p), ...p, { packs: DUG, reduced: false }));
    expect(missing).toEqual([]);
    const [bx, by] = world.homes.hoehle.bed;
    expect(grubeRails(world.cell(bx, by), bx, by, { packs: DUG, reduced: false })).toBeNull();
    expect(pack.view?.rails).toBe(grubeRails);
  });

  it('3D ohne eigenen Teil mit Three.js: dasselbe Gleis aus derselben Datei', async () => {
    const v = await pack.view3d!();
    expect(v.rails).toBe(grubeRails);
  });
});

describe('Töne von Funkel', () => {
  const ev = (what: RideEvent['what'], more: Partial<RideEvent> = {}): RideEvent => ({
    type: 'ride',
    what,
    id: 'grube',
    x: 0,
    y: 0,
    ...more,
  });
  const all: RideEvent['what'][] = [
    'nudge',
    'go',
    'stop',
    'board',
    'arrive',
    'leave',
    'wave',
    'alight',
    'snore',
    'shoo',
  ];

  it('sein Signal D5 → A5 beim Anstoßen und Losfahren, abwärts bei der Ankunft; alles in der C-Pentatonik, leise', () => {
    expect(funkelScores(ev('go')).map(([f]) => f)).toEqual(FUNKEL.signal);
    expect(funkelScores(ev('nudge')).map(([f]) => f)).toEqual(FUNKEL.signal);
    expect(funkelScores(ev('arrive')).map(([f]) => f)).toEqual([...FUNKEL.signal].reverse());
    const tones = all.flatMap((w) => funkelScores(ev(w, { ring: true })));
    expect(tones.filter(([f]) => !penta(f))).toEqual([]);
    expect(Math.max(...tones.map(([, , , gain]) => gain))).toBeLessThanOrEqual(0.06);
    // nie mehr als zwei Töne zugleich (weit unter den sechs Stimmen von sfx.ts)
    for (const w of all) {
      const score = funkelScores(ev(w, { ring: true }));
      const at = (t: number) => score.filter(([, len, , , , d]) => d <= t && t < d + len).length;
      expect(Math.max(0, ...score.map(([, , , , , d]) => at(d)))).toBeLessThanOrEqual(2);
    }
  });

  it('antwortet nur auf seine eigenen Ereignisse; Figur hüpft beim Winken und Aussteigen, Zzz beim Schlafen', () => {
    expect(funkelFx(ev('go', { id: 'hoehle' }))).toBeUndefined();
    expect(funkelFx(ev('board', { id: 'schlitten' }))).toBeUndefined();
    expect(funkelFx(ev('alight'))).toMatchObject({ who: 'player', heart: true });
    expect(funkelFx(ev('wave'))).toMatchObject({ who: 'player' });
    expect(funkelFx(ev('shoo', { who: 'a' }))).toMatchObject({ who: 'a' });
    expect(funkelFx(ev('snore'))).toMatchObject({ zzz: true });
    expect(pack.view?.rideFx === funkelFx).toBe(true);
  });
});

describe('Bahnsteig an Funkels Halt (Issue 39)', () => {
  it('Planken auf jedem Feld des Bahnsteigs und ein Schild zur Kamera, erst wenn gegraben ist und die Figur in der Grotte ist; kein Gold, nicht antippbar', () => {
    const bodies = haltBodies(inCave(), world);
    const planks = bodies.filter((b) => b.id.startsWith('grube:steg:'));
    const sign = bodies.filter((b) => b.id === 'grube:schild');
    expect(planks.length).toBeGreaterThanOrEqual(4);
    expect(sign).toHaveLength(1);
    for (const b of planks) {
      const c = world.cell(b.x, b.y);
      expect([c.stop, c.solid, !!c.ride]).toEqual(['grube', false, false]); // begehbar wie zuvor
      expect(b.z).toBe(c.h);
      expect(b.parts).toBe(PLANK);
      expect(b.foot).toBe(0); // liegt flach: kein Fleck am Boden
    }
    expect(new Set(planks.map((b) => `${b.x},${b.y}`)).size).toBe(planks.length);
    // das Schild steht auf dem Feld des Bahnsteigs, das am weitesten vom Sitz liegt
    const far = (b: { x: number; y: number }) => Math.hypot(b.x - route.stops.home[0], b.y - route.stops.home[1]);
    expect(far(sign[0]!)).toBe(Math.max(...planks.map(far)));
    expect(sign[0]).toMatchObject({ dir: 's', parts: HALT_SIGN });
    for (const b of bodies) {
      expect(b.id.startsWith('ride:')).toBe(false);
      // Gold tragen nur die Zahlensteine, die das Kind wählen kann (Issue 48)
      if (!b.id.startsWith('grube:stein:')) expect(gold(b.parts)).toBe(false);
    }
    // flach: Die Planke ragt kaum über den Boden; das Schild ist höher als die Figur
    expect(Math.max(...PLANK.map((q) => q[2] + q[5]))).toBeLessThan(0.1);
    expect(Math.max(...HALT_SIGN.map((q) => q[2] + q[5]))).toBeGreaterThan(1.4);
    expect(colors(HALT_SIGN).has(HALT_COLORS.board[0])).toBe(true);
    // vor dem Graben und von der Lichtung aus nichts
    expect(haltBodies(inCave({}), world)).toEqual([]);
    expect(haltBodies(inCave(DUG, { player: { x: 0, y: 3, dir: 's' } }), world)).toEqual([]);
    expect(pack.view!.bodies!(inCave(), world, AT).some((b) => b.id === 'grube:schild')).toBe(true);
  });
});

describe('Zahlensteine und Lichter auf dem Wagendach (Issue 48)', () => {
  const stones = (state: State) => haltBodies(state, world).filter((b) => b.id.startsWith('grube:stein:'));

  it('vier Steine auf ihren Feldern, zur Kamera, im Dunkel zu sehen; nur der gewählte ist Petrol, die anderen tragen Gold', () => {
    const cells = lapStonesOf(world, { packs: DUG });
    for (const chosen of [1, 2, 3, 4]) {
      const bodies = stones(inCave(DUG, chosen === 1 ? {} : { laps: { grube: chosen } }));
      expect(bodies.map((b) => [b.x, b.y])).toEqual(cells);
      bodies.forEach((b, i) => {
        const mine = i + 1 === chosen;
        expect(b.dir).toBe('s');
        expect(b.z).toBe(world.cell(b.x, b.y).h);
        expect(b.glow, `Stein ${i + 1}, gewählt ${chosen}`).toBe(true); // im Dunkel der Grotte zu sehen
        expect(gold(b.parts)).toBe(!mine); // Gold: Hier kann das Kind etwas tun
        expect(colors(b.parts).has(FUNKEL_COLORS.petrol[0])).toBe(mine);
        expect(b.parts).toEqual(lapStoneParts(i + 1, mine));
      });
    }
    expect(stones(inCave({}))).toEqual([]); // vor dem Graben keine
  });

  it('jede Ziffer steht obenauf und vorn, mit so vielen Pixeln wie ihr Zeichen; der Stein bleibt in seinem Feld', () => {
    const pixels = (n: number) => DIGITS[n]!.join('').split('#').length - 1;
    for (const n of [1, 2, 3, 4] as const) {
      const parts = lapStoneParts(n, false);
      const ink = parts.filter((p) => p[6] === GOLD.top);
      expect(ink.filter((p) => p[2] === STONE_H)).toHaveLength(pixels(n)); // obenauf
      expect(ink.filter((p) => p[0] === 0.42)).toHaveLength(pixels(n)); // vorn
      for (const [f, r, z, l, w, h] of parts) {
        expect(Math.min(f, r)).toBeGreaterThanOrEqual(-0.5);
        expect(l).toBeGreaterThan(0);
        expect(Math.max(f + l, r + w)).toBeLessThanOrEqual(0.5);
        expect(z).toBeGreaterThanOrEqual(0);
        expect(z + h).toBeLessThanOrEqual(1);
      }
    }
    expect(new Set([1, 2, 3, 4].map((n) => JSON.stringify(lapStoneParts(n, false)))).size).toBe(4);
  });

  it('Lichter auf dem Dach des zweiten Wagens: am Halt so viele wie gewählt, unterwegs so viele Runden wie noch kommen', () => {
    const lit = (state: State) => {
      const rear = funkelBodies(state, world, AT).find((b) => b.id === `${FUNKEL_ID}:rear`)!;
      return rear.parts.filter((p) => p[2] === 0.76 && p[6] === FENCE_CRYSTAL).length;
    };
    const sockets = funkelParts({ kind: 'rear', lights: 2 }).filter((p) => p[2] === 0.76);
    expect(sockets).toHaveLength(4); // immer vier Fassungen, die übrigen dunkel
    expect(sockets.filter((p) => p[6] === FUNKEL_COLORS.window)).toHaveLength(2);
    expect(lit(inCave())).toBe(1);
    expect(lit(inCave(DUG, { laps: { grube: 3 } }))).toBe(3);
    const ride = {
      id: 'grube',
      phase: 'go',
      at: 0,
      pos: 12,
      speed: 0.5,
      to: 'home',
      feast: false,
      jingleAt: 0,
      greeted: [],
    };
    const riding = (laps?: number) =>
      inCave(DUG, { laps: { grube: 4 }, ride: { ...ride, ...(laps && { laps }) } as State['ride'] });
    expect([4, 3, 2].map((n) => lit(riding(n)))).toEqual([4, 3, 2]);
    expect(lit(riding())).toBe(1); // die letzte Runde
    // jedes Licht liegt mitten über einer Scheibe von Dach, Fensterband und Kasten: 2D reiht die Teile nach ihrer Mitte,
    // sonst verschwände ein Licht vor der Mitte des Wagens unter ihm (so gesehen im Browser)
    const rear = funkelParts({ kind: 'rear', lights: 4 });
    const mid = (p: Part) => +(p[0] + p[3] / 2).toFixed(4);
    for (const light of rear.filter((p) => p[6] === FENCE_CRYSTAL)) {
      const under = rear.filter((p) => p !== light && mid(p) === mid(light) && p[2] < light[2]);
      expect(under.map((p) => p[2]).sort()).toEqual([0.12, 0.18, 0.46, 0.7]); // Rahmen, Kasten, Fensterband, Dach
      expect(rear.some((p) => p[3] > 0.5 && p[2] + p[5] > 0.2)).toBe(false); // kein langer Kasten über den Rädern
    }
    // der erste Wagen trägt keine Lichter: Dort schaut die Figur heraus und verdeckte sie
    expect(funkelParts({ kind: 'seat', rider: true }).some((p) => p[6] === FENCE_CRYSTAL)).toBe(false);
    const keys = new Set([1, 2, 3, 4].map((n) => funkelBodies(riding(n), world, AT)[2]!.key));
    expect(keys.size).toBe(4); // je Zahl ein eigenes Bild
  });

  it('Töne: so viele wie die Zahl, aufwärts in der Pentatonik; nach jeder Runde ein heller Ton', () => {
    for (const n of [1, 2, 3, 4]) {
      const score = lapScore(n);
      expect(score).toHaveLength(n);
      expect(score.every(([hz]) => penta(hz))).toBe(true);
      expect(score.every(([hz], i) => i === 0 || hz > score[i - 1]![0])).toBe(true);
    }
    const lap = funkelScores({ type: 'ride', what: 'lap', id: 'grube', x: 0, y: 0 });
    expect(lap).toHaveLength(1);
    expect(penta(lap[0]![0])).toBe(true);
    expect(pack.view!.score!({ type: 'lapstone', x: 0, y: 0, n: 3 })).toHaveLength(3);
    expect(pack.sights!.map((x) => x.id)).toContain('grube:zahlensteine');
  });
});
