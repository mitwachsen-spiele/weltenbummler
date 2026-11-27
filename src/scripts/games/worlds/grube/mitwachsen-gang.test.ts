// Klingeltore und Glitzergang der Grubenbahn (Rückmeldung zur Höhle, Schritt 16): Lage auf der Runde, Hineinlaufen zu Fuß,
// Körper (Tore, Scheibe, Wandkristalle, Wasserfall) in 2D und 3D gleich, Glitzerwelle, feste Bilder bei reduzierter
// Bewegung, Töne beim Durchfahren und zu Fuß mit höchstens sechs Stimmen, Echo nur ohne singendes Tor, Licht im Gang
import { describe, expect, it } from 'vitest';
import { DIRS, type Dir, type Part } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import { GANG_COLORS, LIFT } from '../../../../data/games/worlds/grube/mitwachsen-gang-model';
import { TUNNEL_LIGHT } from '../../mitwachsen-dusk';
import type { PackEvent } from '../../mitwachsen-pack-types';
import { RIDE_FOOT, footOf, type RideAt } from '../../mitwachsen-ride-view';
import { initialState, step, type Cmd, type GameEvent, type State } from '../../mitwachsen-state';
import type { Scored } from '../../sfx';
import { DUG, FAHRT_PACK, GRUBE_PACK, HOEHLE_PACK, worldOf } from '../../test-worlds';
import { funkelRoute, ringGate } from './mitwachsen-funkel';
import { funkelBodies, funkelScores } from './mitwachsen-funkel-look';
import { CRYSTAL_EVERY, GLOW_REACH, frameOf, gangOf, glitter, inGang } from './mitwachsen-gang';
import {
  ECHO,
  FOOT_GAP,
  GATE_NOTES,
  GangFx,
  RING_MS,
  footScore,
  gangBodies,
  gangDim,
  gateScore,
  tootScore,
} from './mitwachsen-gang-look';
import { pack } from './index';

const world = worldOf(1, [HOEHLE_PACK, GRUBE_PACK], DUG);
const route = funkelRoute(world, { packs: DUG })!;
const gang = gangOf(world, route)!;
const len = route.path.length - 1;
const AT: RideAt = { now: 0, frac: 1, reduced: false, lit: false };
const key = ([x, y]: readonly [number, number]) => `${x},${y}`;
const PENTA = [0, 2, 4, 7, 9];
const penta = (hz: number) => PENTA.includes(((Math.round(12 * Math.log2(hz / 261.63)) % 12) + 12) % 12);

/** Höchstens so viele Töne klingen zugleich (Beginn bis Ende jedes Tons, wie sfx.ts sie spielt) */
const voices = (notes: readonly Scored[]) =>
  Math.max(0, ...notes.map(([, , , , , d]) => notes.filter(([, l, , , , e]) => e <= d && d < e + l + 0.03).length));

/** Wach in der Grotte, auf dem Bahnsteig neben dem Halt */
function inCave(more: Partial<State> = {}): State {
  const s = initialState(world, { packs: DUG });
  const [x, y] = route.seats.home[0]!;
  return { ...s, sleeping: false, player: { x, y, dir: 'n' }, animals: [], ...more };
}

/** Funkel unterwegs mit der Figur beim Fortschritt `pos` */
const riding = (pos: number): State =>
  inCave({
    ride: { id: 'grube', phase: 'go', at: 0, pos, speed: 0.8, to: 'home', feast: false, jingleAt: 0, greeted: [] },
  });

describe('Glitzergang: Lage auf der Runde', () => {
  it('Tor am Eingang, dann Mitte, dann Tor am Ausgang, an den Enden des Gangs; dazwischen nur Gang', () => {
    const { in: i, out: o } = gang.gates;
    expect(world.cell(...route.path[i]!).chimeGate).toBe('in');
    expect(world.cell(...route.path[o]!).chimeGate).toBe('out');
    expect(0 < i && i < gang.mid && gang.mid < o && o < len).toBe(true);
    const parts = route.path.slice(i, o + 1).map((p) => world.cell(...p).lane?.part);
    expect(new Set(parts)).toEqual(new Set(['gang']));
    expect(world.cell(...route.path[i - 1]!).lane?.part).toBe('open');
    expect(world.cell(...route.path[o + 1]!).lane?.part).toBe('open');
    // beide Tore fest für Füße, Boden der Grotte; die Fahr-Engine fährt hindurch (eine ganze Runde: mitwachsen-funkel.test.ts)
    for (const g of [i, o])
      expect(world.cell(...route.path[g]!)).toMatchObject({ solid: true, h: 1, region: 'hoehle' });
    expect(frameOf(gang, 0, len)).toBe(0);
    expect(gang.frames).toEqual([0, i, gang.mid, o]);
  });

  it('Wasserfall an der Wand neben der Mitte, Kristalle je drei Felder an der Wand, nicht an Toren und Wasserfall; kein Wasser auf dem Gleis', () => {
    const mid = route.path[gang.mid]!;
    expect(Math.abs(gang.fall![0] - mid[0]) + Math.abs(gang.fall![1] - mid[1])).toBe(1);
    const wall = (p: Point) => {
      const c = world.cell(...p);
      return c.lane?.part === 'side' && !c.solid && !route.on.has(key(p));
    };
    expect(wall(gang.fall!)).toBe(true);
    expect(gang.crystals.length).toBeGreaterThanOrEqual(15);
    for (const c of gang.crystals) {
      expect(wall(c.at)).toBe(true);
      expect((c.i - gang.gates.in) % CRYSTAL_EVERY).toBe(0);
      expect(c.i - gang.gates.in).toBeGreaterThanOrEqual(CRYSTAL_EVERY);
      expect(gang.gates.out - c.i).toBeGreaterThanOrEqual(CRYSTAL_EVERY);
      expect(Math.abs(c.i - gang.mid)).toBeGreaterThan(2);
    }
    // an der Wand, nicht zur Höhle hin: zwei Felder weiter steht nie ein Zaunkristall
    for (const p of [gang.fall!, ...gang.crystals.map((c) => c.at)]) {
      const q = route.path.find((t) => Math.abs(t[0] - p[0]) + Math.abs(t[1] - p[1]) === 1)!;
      expect(world.cell(2 * p[0] - q[0], 2 * p[1] - q[1]).lane?.part).not.toBe('fence');
    }
    expect(route.path.filter((p) => world.cell(...p).ground === 'water')).toEqual([]);
    expect(world.cell(...gang.fall!).ground).not.toBe('water');
  });

  it('ohne Klingeltore (vor dem Graben) kein Glitzergang; feste Bilder stehen dann am Halt', () => {
    expect(gangOf(world, { ...route })).toEqual(gang);
    const bare = worldOf(1, [HOEHLE_PACK, GRUBE_PACK]); // vor dem Graben: auf denselben Feldern kein Tor
    expect(gangOf(bare, { ...route })).toBeUndefined();
    expect(frameOf(undefined, 40, len)).toBe(0);
    expect(frameOf(undefined, len, len)).toBe(len);
  });
});

describe('Klingeltor zu Fuß', () => {
  /** Die Figur auf dem offenen Gleis vor dem Tor, mit dem Pfeil zum Tor */
  function before(gate: number, from: number): { s: State; dir: Dir } {
    const [gx, gy] = route.path[gate]!;
    const [x, y] = route.path[from]!;
    const dir = (Object.entries(DIRS) as [Dir, readonly [number, number]][]).find(
      ([, [dx, dy]]) => x + dx === gx && y + dy === gy,
    )![0];
    return { s: { ...inCave(), wokeAt: -100, player: { x, y, dir } }, dir };
  }

  it('Hineinlaufen: das Tor klingt (Ereignis chimegate), die Figur bleibt stehen, ohne anzustoßen, an beiden Toren', () => {
    const rules = [HOEHLE_PACK, GRUBE_PACK, FAHRT_PACK];
    for (const [gate, from] of [
      [gang.gates.out, gang.gates.out + 1],
      [gang.gates.in, gang.gates.in - 1],
    ] as const) {
      const { s, dir } = before(gate, from);
      const out = step(s, world, { type: 'move', dir, fresh: true }, undefined, undefined, rules);
      const [gx, gy] = route.path[gate]!;
      expect(out.events.filter((e) => e.type !== 'step')).toEqual([{ type: 'chimegate', x: gx, y: gy, answer: true }]);
      expect([out.state.player.x, out.state.player.y]).toEqual(route.path[from]);
      expect(out.state.ride).toBeUndefined();
    }
  });

  it('die Regel trifft nur Klingeltore; ohne Paket ist das Tor nur fest', () => {
    const events: (PackEvent | { type: 'hop' })[] = [];
    const push = { push: (e: PackEvent | { type: 'hop' }) => events.push(e) };
    const move = { here: world.cell(0, 0), walks: false, cell: (x: number, y: number) => world.cell(x, y) };
    const ruled = inCave();
    expect(ringGate(ruled, world.cell(...route.path[gang.mid]!), 0, 0, push, move)).toBe(false);
    expect(ringGate(ruled, world.cell(...route.path[gang.gates.out]!), 3, 4, push, move)).toBe(true);
    expect(
      ringGate({ ...ruled, dozing: ['grube'] }, world.cell(...route.path[gang.gates.out]!), 3, 4, push, move),
    ).toBe(true);
    expect(events).toEqual([
      { type: 'chimegate', x: 3, y: 4, answer: true },
      { type: 'chimegate', x: 3, y: 4, answer: false }, // Funkel schläft: er antwortet nicht
    ]);
    expect(pack.rules?.bump === ringGate).toBe(true);
    const { s, dir } = before(gang.gates.out, gang.gates.out + 1);
    const plain = step(s, world, { type: 'move', dir, fresh: true }, undefined, undefined, [HOEHLE_PACK]);
    expect(plain.events.map((e) => e.type)).toContain('bump');
  });

  it('drei Töne, dann antwortet Funkel am Halt mit seinem Signal; gedrosselt, wenn der Pfeil gehalten wird', () => {
    const fx = new GangFx();
    const [gx, gy] = route.path[gang.gates.out]!;
    const tones = fx.ring(gx, gy, 1000);
    expect(tones).toEqual(footScore());
    expect(tones.slice(0, 3).map(([f]) => f)).toEqual(GATE_NOTES.slice(0, 3));
    expect(tones.slice(3).map(([f]) => f)).toEqual(
      funkelScores({ type: 'ride', what: 'go', id: 'grube', x: 0, y: 0 }).map(([f]) => f),
    );
    expect(Math.min(...tones.slice(3).map(([, , , , , d]) => d))).toBeGreaterThan(
      Math.max(...tones.slice(0, 3).map(([, , , , , d]) => d)),
    );
    expect(fx.ring(gx, gy, 1000 + FOOT_GAP - 1)).toEqual([]);
    expect(fx.ring(gx, gy, 1000 + FOOT_GAP)).toEqual(footScore());
    expect(fx.rangAt).toBe(1000 + FOOT_GAP);
    expect(pack.view?.score?.({ type: 'web', x: 0, y: 0 })).toBeUndefined(); // nur seine eigenen Ereignisse
  });

  it('schläft Funkel, klingt nur das Tor: drei Töne, kein Signal, kein Blinken', () => {
    const fx = new GangFx();
    const [gx, gy] = route.path[gang.gates.out]!;
    const tones = fx.ring(gx, gy, 1000, false);
    expect(tones).toEqual(footScore(false));
    expect(tones.map(([f]) => f)).toEqual(GATE_NOTES.slice(0, 3));
    expect(fx.rangAt).toBe(-Infinity);
    const loco = funkelBodies(inCave({ dozing: ['grube'] }), world, { ...AT, now: 1100 }, fx.rangAt).find((b) =>
      b.id.endsWith(':loco'),
    )!;
    expect(loco.glow).toBeUndefined();
    const awake = new GangFx();
    awake.ring(gx, gy, 1000);
    const lit = funkelBodies(inCave(), world, { ...AT, now: 1100 }, awake.rangAt).find((b) => b.id.endsWith(':loco'))!;
    expect(lit.glow).toBe(true);
  });
});

describe('Körper am Glitzergang', () => {
  const ids = (s: State, at: RideAt = AT, fx = new GangFx()) => gangBodies(s, world, at, fx).map((b) => b.id);
  const gold = (parts: readonly Part[]) => parts.some((p) => p[6] === GOLD.side || p[7] === GOLD.top);

  it('zwei Tore mit Scheibe, die Wandkristalle, der Wasserfall; nur in der Grotte und nach dem Graben; nie antippbar, kein Gold', () => {
    const all = gangBodies(inCave(), world, AT, new GangFx());
    expect(all.filter((b) => b.id.startsWith('grube-tor:')).map((b) => b.id)).toEqual([
      'grube-tor:in',
      'grube-tor:in:scheibe',
      'grube-tor:out',
      'grube-tor:out:scheibe',
    ]);
    expect(all.filter((b) => b.id.startsWith('grube-kristall:')).length).toBe(gang.crystals.length);
    expect(all.filter((b) => b.id === 'grube-fall').length).toBe(1);
    expect(all.some((b) => b.id.startsWith('ride:') || b.seat)).toBe(false);
    expect(all.some((b) => gold(b.parts))).toBe(false);
    expect(all.some((b) => b.parts.some((p) => p[8] === 'f'))).toBe(false); // keine Augen, kein Gesicht
    // ohne Fleck am Boden: Tor (Pfosten am Rand, in der Mitte das Gleis), Scheibe (im Sturz), Wasserfall; Kristalle mit
    expect(all.filter((b) => footOf(b) === 0).map((b) => b.id)).toEqual([
      'grube-tor:in',
      'grube-tor:in:scheibe',
      'grube-tor:out',
      'grube-tor:out:scheibe',
      'grube-fall',
    ]);
    expect(all.filter((b) => b.id.startsWith('grube-kristall:')).every((b) => footOf(b) === RIDE_FOOT)).toBe(true);
    const [bx, by] = world.homes.lichtung.bed;
    expect(ids(inCave({ player: { x: bx, y: by, dir: 's' } }))).toEqual([]);
    expect(gangBodies({ ...inCave(), packs: {} }, world, AT, new GangFx())).toEqual([]);
    // Tor quer über dem Gleis: es schaut in Fahrtrichtung, die Scheibe zur Kamera
    const gate = all.find((b) => b.id === 'grube-tor:in')!;
    const [a, n] = [route.path[gang.gates.in]!, route.path[gang.gates.in + 1]!];
    expect(DIRS[gate.dir]).toEqual([n[0] - a[0], n[1] - a[1]]);
    expect(all.find((b) => b.id === 'grube-tor:in:scheibe')!.dir).toBe('s');
  });

  it('fährt Funkel hindurch, hebt sich die Scheibe und die Röhren leuchten; sonst nicht', () => {
    const at = (pos: number) => gangBodies(riding(pos), world, AT, new GangFx());
    const disc = (b: ReturnType<typeof at>, k: 'in' | 'out') => b.find((x) => x.id === `grube-tor:${k}:scheibe`)!.z;
    const shine = (b: ReturnType<typeof at>, k: 'in' | 'out') =>
      b.find((x) => x.id === `grube-tor:${k}`)!.parts.some((p) => p[6] === GANG_COLORS.ring[0]);
    const still = at(10);
    const through = at(gang.gates.in + 1);
    expect(disc(through, 'in') - disc(still, 'in')).toBeCloseTo(LIFT);
    expect(disc(through, 'out')).toBeCloseTo(disc(still, 'out'));
    expect([shine(still, 'in'), shine(through, 'in'), shine(through, 'out')]).toEqual([false, true, false]);
    expect(through.find((b) => b.id === 'grube-tor:in')!.glow).toBe(true);
    expect(shine(at(gang.gates.out - 2), 'out')).toBe(true);
  });

  it('zu Fuß angestoßen: Röhren leuchten kurz, die Scheibe wackelt weich (bei reduzierter Bewegung nicht)', () => {
    const fx = new GangFx();
    const [gx, gy] = route.path[gang.gates.out]!;
    fx.ring(gx, gy, 1000);
    const disc = (now: number, reduced = false) =>
      gangBodies(inCave(), world, { ...AT, now, reduced }, fx).find((b) => b.id === 'grube-tor:out:scheibe')!.x - gx;
    const xs = [1000, 1060, 1120, 1250, 1400, 1000 + RING_MS].map((t) => disc(t));
    expect(Math.max(...xs.map(Math.abs))).toBeGreaterThan(0.02);
    expect(Math.max(...xs.map(Math.abs))).toBeLessThanOrEqual(0.07);
    expect(xs.at(-1)).toBe(0);
    expect([1060, 1120].map((t) => disc(t, true))).toEqual([0, 0]);
    const lit = gangBodies(inCave(), world, { ...AT, now: 1100 }, fx).find((b) => b.id === 'grube-tor:out')!;
    expect(lit.glow).toBe(true);
    const later = gangBodies(inCave(), world, { ...AT, now: 1000 + RING_MS }, fx).find(
      (b) => b.id === 'grube-tor:out',
    )!;
    expect(later.glow).toBeUndefined();
  });

  it('Glitzerwelle: im Gang leuchten die Kristalle nah am Sitz (mit Loch in der Dunkelmaske), weiter weg matt; draußen keiner', () => {
    const lit = (pos: number, reduced = false) =>
      gangBodies(riding(pos), world, { ...AT, reduced }, new GangFx())
        .filter((b) => b.id.startsWith('grube-kristall:') && b.glow)
        .map((b) => Number(b.id.split(':')[1]));
    const near = gang.crystals[4]!.i;
    expect(lit(near)).toEqual(gang.crystals.filter((c) => Math.abs(c.i - near) <= GLOW_REACH).map((c) => c.i));
    expect(lit(near).length).toBeGreaterThanOrEqual(1);
    expect(lit(near)).toEqual([...glitter(gang, near)]);
    expect(lit(near + 2 * GLOW_REACH + CRYSTAL_EVERY)).not.toEqual(lit(near)); // die Welle läuft mit
    expect(lit(10)).toEqual([]);
    expect(lit(gang.gates.out + 3)).toEqual([]);
    expect(
      gangBodies(inCave(), world, AT, new GangFx()).some((b) => b.id.startsWith('grube-kristall:') && b.glow),
    ).toBe(false);
    // bei reduzierter Bewegung leuchten an den festen Bildern im Gang alle Kristalle, ohne Welle; am Halt keiner
    const all = gang.crystals.map((c) => c.i);
    expect(all.length).toBeGreaterThanOrEqual(1);
    for (const pos of [gang.gates.in + 1, gang.mid + 1, gang.mid + 5, gang.gates.out - 1])
      expect(lit(pos, true)).toEqual(all);
    expect(lit(1, true)).toEqual([]);
  });

  it('Wasserfall: Streifen gleiten in Stufen (bei reduzierter Bewegung stehen sie), gleiche Teile je Schlüssel für 3D', () => {
    const fall = (now: number, reduced = false) =>
      gangBodies(inCave(), world, { ...AT, now, reduced }, new GangFx()).find((b) => b.id === 'grube-fall')!;
    const keys = new Set([0, 160, 320, 480].map((t) => fall(t).key));
    expect(keys.size).toBe(3);
    expect(new Set([0, 160, 320].map((t) => fall(t, true).key)).size).toBe(1);
    expect(fall(0).parts).toBe(fall(480).parts);
    expect([fall(0).x, fall(0).y]).toEqual(gang.fall);
  });
});

describe('Töne am Glitzergang', () => {
  it('Röhren D5 E5 G5 A5 C6 in der C-Pentatonik, weich im Dreieck: am Eingang aufwärts, am Ausgang abwärts; mit Nachhall', () => {
    expect(GATE_NOTES.every(penta)).toBe(true);
    expect(Math.min(...GATE_NOTES)).toBeGreaterThan(500); // über C5, so spielen Tablets sie
    const up = gateScore(true);
    const down = gateScore(false);
    expect(up.slice(0, 5).map(([f]) => f)).toEqual([...GATE_NOTES]);
    expect(down.slice(0, 5).map(([f]) => f)).toEqual([...GATE_NOTES].reverse());
    expect([...up, ...down].every(([, , w]) => w === 'triangle')).toBe(true);
    // Nachhall: der letzte Ton noch einmal, leiser und länger
    expect(up.at(-1)![0]).toBe(GATE_NOTES.at(-1));
    expect(up.at(-1)![3]).toBeLessThan(up[0]![3]);
    // anders als das Säulen-Glockenspiel (Sinus) und der Hau-ruck-Akkord (C4 E4 G4)
    expect(up.some(([f]) => f < 523)).toBe(false);
  });

  it('Tuten in der Mitte mit höchstens zwei leiseren Echos; ohne Echo, wenn gerade ein Tor singt', () => {
    const toot = tootScore(true);
    const sig = funkelScores({ type: 'ride', what: 'go', id: 'grube', x: 0, y: 0 });
    expect(toot.length).toBe(sig.length * (1 + ECHO.length));
    expect(ECHO.length).toBeLessThanOrEqual(2);
    const gains = [0, ...ECHO.map((_, i) => i + 1)].map((k) => toot[k * sig.length]![3]);
    expect(gains.every((g, i) => i === 0 || g < gains[i - 1]!)).toBe(true);
    expect(tootScore(false)).toEqual(sig);
  });

  it('jede Folge höchstens drei Stimmen, zu Fuß, beim Durchfahren und Tuten; alles in der Pentatonik, leise', () => {
    for (const notes of [gateScore(true), gateScore(false), footScore(), tootScore(true)]) {
      expect(voices(notes)).toBeLessThanOrEqual(3);
      expect(notes.every(([f]) => penta(f))).toBe(true);
      expect(Math.max(...notes.map(([, , , g]) => g))).toBeLessThanOrEqual(0.06);
    }
  });

  it('eine ganze Runde über step: Tor ein aufwärts, Tuten mit Echo, Tor aus abwärts, je einmal; nie mehr als sechs Stimmen', () => {
    const fx = new GangFx();
    const rules = [HOEHLE_PACK, GRUBE_PACK, FAHRT_PACK];
    // vom Bahnsteig aus einsteigen (auf dem Feld neben dem Sitz)
    const [sx, sy] = route.stops.home;
    const from = (Object.entries(DIRS) as [Dir, readonly [number, number]][])
      .map(([d, [dx, dy]]): [Point, Dir] => [[sx - dx, sy - dy], d])
      .find(([p]) => world.cell(...p).stop === 'grube')!;
    let s: State = { ...inCave(), wokeAt: -100, player: { x: from[0][0], y: from[0][1], dir: from[1] } };
    const events: GameEvent[] = [];
    const play = (c: Cmd) => {
      const out = step(s, world, c, undefined, undefined, rules);
      s = out.state;
      events.push(...out.events);
    };
    play({ type: 'move', dir: from[1], fresh: true });
    expect(s.ride?.id).toBe('grube');
    const heard: Scored[] = [];
    const dims: number[] = [];
    for (let i = 0; i < 400 && s.ride; i++) {
      play({ type: 'tick' });
      const now = s.tick * 100;
      // Töne mit ihrer Zeit auf der Uhr des Spiels (s)
      heard.push(...fx.ambient(world, s, now).map(([f, l, w, g, sl, d]): Scored => [f, l, w, g, sl, d + now / 1000]));
      dims.push(gangDim(s, world));
    }
    expect(s.ride).toBeUndefined();
    expect(heard.map(([f]) => f)).toEqual(
      [...gateScore(true), ...tootScore(true), ...gateScore(false)].map(([f]) => f),
    );
    expect(voices(heard)).toBeLessThanOrEqual(6);
    // Licht: im Gang 0,7 wie im Tunnel, sonst 1; kein „Uh-uh“ (keine Tunnelfelder auf der Runde)
    expect(new Set(dims)).toEqual(new Set([1, TUNNEL_LIGHT]));
    expect(route.dark).toBeUndefined();
    expect(events.some((e) => e.type === 'ride' && e.what === 'tunnel')).toBe(false);
    // eine neue Runde spielt alles wieder; ohne Fahrt nichts
    expect(fx.ambient(world, inCave(), 0)).toEqual([]);
  });

  it('springt die Fahrt über das Tor (seltene Bilder), klingt es trotzdem einmal; Echo nicht, wenn im selben Bild ein Tor singt', () => {
    const fx = new GangFx();
    const ride = riding(0).ride!;
    const at = (pos: number, now: number) => fx.ambient(world, inCave({ ride: { ...ride, pos } }), now);
    expect(at(0, 0)).toEqual([]);
    expect(at(gang.gates.in + 5, 1000)).toEqual(gateScore(true));
    expect(at(gang.gates.in + 6, 1100)).toEqual([]);
    expect(at(gang.mid + 1, 1200)).toEqual(tootScore(false)); // das Tor singt noch (SING_S)
    expect(at(len, 9000)).toEqual(gateScore(false));
    expect(at(0, 9100)).toEqual([]); // die nächste Runde beginnt
    expect(at(gang.gates.out + 1, 20000)).toEqual([...gateScore(true), ...tootScore(false), ...gateScore(false)]);
  });

  it('der Haken der Ansicht: Töne der Umgebung und Licht aus dem Paket; zu Fuß klingt das Tor über score', () => {
    expect(pack.view?.dim === gangDim).toBe(true);
    expect(pack.view?.ambient?.(world, inCave(), 0, () => true)).toEqual([]);
    const [gx, gy] = route.path[gang.gates.in]!;
    expect(pack.view?.score?.({ type: 'chimegate', x: gx, y: gy, answer: true })?.length).toBe(footScore().length);
    const ids = (pack.view?.bodies?.(inCave(), world, AT) ?? []).map((b) => b.id);
    expect(ids.slice(0, 3)).toEqual(['ride:grube:loco', 'ride:grube:seat', 'ride:grube:rear']); // Funkel, dann der Gang
    expect(ids).toContain('grube-tor:out:scheibe');
    expect(inGang(gang, gang.mid)).toBe(true);
    expect(gangDim(inCave(), world)).toBe(1);
    expect(gangDim(riding(gang.mid), world)).toBe(TUNNEL_LIGHT);
    expect(gangDim({ ...riding(gang.mid), ride: { ...riding(gang.mid).ride!, id: 'hoehle' } }, world)).toBe(1);
  });
});
