// Der Maulwurf gräbt den Glitzergang (Rückmeldung zur Höhle, Schritt 17; ohne Wartezeit seit Issue 14): fällig, sobald er
// zu Hause wohnt (keine Uhr, auch alte Spielstände), Beginn erst am Grubenhalt, das Graben über `step` mit den Paketen
// wie im Spiel (Erdwelle, Gang gegraben, Funkel rollt an den Halt, die Figur hüpft nur), Bild und Ton
import { describe, expect, it } from 'vitest';
import { DIRS, type Dir } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import { FIRST_MOLE } from '../../../../data/games/mitwachsen-hoehle';
import {
  BED_PART,
  CRUMB_PARTS,
  DIG,
  DIG_NEAR,
  DIG_SEEN,
  MOUND_PARTS,
} from '../../../../data/games/worlds/grube/mitwachsen-dig-model';
import { GOLD } from '../../../../data/games/mitwachsen-portals';
import type { HeraldEvent } from '../../mitwachsen-herald';
import { dawnOf } from '../../mitwachsen-packs';
import { stageOf } from '../../mitwachsen-ride-save';
import { initialState, step, type Cmd, type GameEvent, type State } from '../../mitwachsen-state';
import type { World } from '../../mitwachsen-world';
import { BAHN_PACK, FAHRT_PACK, GRUBE_PACK, HOEHLE_PACK, worldOf } from '../../test-worlds';
import { DIG_RULES, canDig, digAt, digDue, haltOf, moleHome, moleSettled } from './mitwachsen-dig';
import { LAID_ID, MOUND_ID, MOUND_STAGES, digBodies, digFx, digScore, laidParts, moundAt } from './mitwachsen-dig-look';
import { FUNKEL, funkelRoute, laneOf } from './mitwachsen-funkel';
import { funkelAt, funkelBodies, railShape } from './mitwachsen-funkel-look';
import { gangOf } from './mitwachsen-gang';
import { pack } from './index';

const RULES = [GRUBE_PACK, FAHRT_PACK];
const TICK: Cmd = { type: 'tick' };
const MOLE = { id: FIRST_MOLE, species: 'maulwurf' } as const;
const DUE = { fahrt: { grube: { stage: 'faellig' } } };
const AT = { now: 0, frac: 0, reduced: false, lit: false };

/** Grotte mit Paket der Grubenbahn, der Gang noch Fels (je Seed einmal) */
const caveOf = (seed = 1) => worldOf(seed, [HOEHLE_PACK, GRUBE_PACK]);

/** Wach, Höhlentor offen, der erste Maulwurf zu Hause (als einziges Tier), die Figur `gap` Felder vom Sitz am Halt */
function ready(world: World, packs: Record<string, unknown> = {}, gap = 3): State {
  const s = initialState(world, { packs, garden: [MOLE], openGates: ['eis', 'hoehle'] });
  const [sx, sy] = haltOf(world)!;
  const at = freeAround(world, [sx, sy], gap);
  return {
    ...s,
    sleeping: false,
    wokeAt: -100,
    player: { x: at[0], y: at[1], dir: 's' },
    animals: s.animals.filter((a) => a.id === FIRST_MOLE),
  };
}

/** Ein freies Feld der Grotte genau `gap` Felder (Schachbrett) vom Sitz, nicht auf der Schleife */
function freeAround(world: World, [sx, sy]: Point, gap: number): Point {
  for (let dy = -gap; dy <= gap; dy++)
    for (let dx = -gap; dx <= gap; dx++) {
      const [x, y] = [sx + dx, sy + dy];
      const c = world.cell(x, y);
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== gap || c.solid || c.lane || c.ride) continue;
      if (world.realm(x, y) === 'hoehle' && c.ground !== 'water') return [x, y];
    }
  throw new Error(`kein freies Feld ${gap} vom Halt`);
}

/** Spielt Befehle; baut die Welt neu wie die Spielseite, wenn ein Ereignis es will (`relay`) */
function play(s0: State, w0: World, cmds: readonly Cmd[]) {
  let [s, world] = [s0, w0];
  const events: GameEvent[] = [];
  for (const c of cmds) {
    const out = step(s, world, c, undefined, undefined, RULES);
    s = out.state;
    events.push(...out.events);
    if (out.events.some((e) => e.type === 'herald' && e.relay)) world = world.relay(s.packs).world;
  }
  return { s, world, events };
}

const heralds = (events: readonly GameEvent[]) =>
  events.filter((e): e is HeraldEvent => e.type === 'herald').map((e) => e.what);
const ticks = (n: number) => Array.from({ length: n }, () => TICK);

describe('Der Maulwurf gräbt den Glitzergang', () => {
  it('fällig, sobald der erste Maulwurf zu Hause wohnt: ohne Uhr und ohne neuen Spieltag, auch in alten Spielständen', () => {
    expect('dawn' in pack).toBe(false); // kein Haken mehr für den neuen Spieltag
    expect(pack.rules?.herald).toBe(DIG_RULES);
    expect(moleHome([MOLE])).toBe(true);
    expect(moleHome([])).toBe(false);
    // wohnt er zu Hause und hat Funkel noch keinen Eintrag (eben eingezogen oder ein alter Spielstand): fällig
    expect(digDue({}, [MOLE])).toBe(true);
    expect(digDue({ bahn: { built: 2 } }, [MOLE])).toBe(true);
    // ein alter Spielstand mit der Stufe `faellig` (oder der Entwickler-Schalter) bleibt fällig
    expect(digDue(DUE, [MOLE])).toBe(true);
    expect(digDue(DUE, [])).toBe(true);
    // ohne ihn oder schon gegraben: nicht
    expect(digDue({}, [])).toBe(false);
    expect(digDue({ fahrt: { grube: { stage: 'bereit', gefahren: true } } }, [MOLE])).toBe(false);
    // ein neuer echter Spieltag ändert daran nichts; Tok wacht weiter erst dann auf
    const tok = { fahrt: { hoehle: { stage: 'offen', schlaeft: true } } };
    const want = { fahrt: { hoehle: { stage: 'offen' } } };
    expect(dawnOf([BAHN_PACK, GRUBE_PACK], tok)).toEqual(want);
    expect(dawnOf([GRUBE_PACK, BAHN_PACK], tok)).toEqual(want);
    // am Halt gräbt er gleich am Tag des Einzugs, ohne Eintrag im Spielstand
    const world = caveOf();
    expect(heralds(play(ready(world), world, [TICK]).events)).toEqual(['dig']);
    expect(heralds(play(ready(world, DUE), world, [TICK]).events)).toEqual(['dig']);
    // auch aus der alten Stufe `faellig` wird beim Graben `bereit`
    const old = play(ready(world, DUE), world, ticks(1 + Math.round(DIG.pop * DIG.ticks)));
    expect(stageOf(old.s.packs, FUNKEL.id)).toBe('bereit');
  });

  it('nicht ohne den Maulwurf zu Hause, nicht während Bau 2, nicht im Zug, nicht im Schlaf, nicht solange er noch zur Wiese läuft', () => {
    const world = caveOf();
    const s = ready(world);
    expect(canDig(s, world)).toBe(true);
    // ohne ihn zu Hause gräbt nie jemand, auch direkt am Halt
    const none = play({ ...s, garden: [], animals: [] }, world, ticks(30));
    expect(none.s.dig).toBeUndefined();
    expect(heralds(none.events)).toEqual([]);
    expect(none.s.packs).toEqual({});
    expect(canDig({ ...s, work: { from: 0, to: Infinity } }, world)).toBe(false); // Bau 2 wartet auf den Zug
    expect(canDig({ ...s, ride: {} }, world)).toBe(false);
    expect(canDig({ ...s, sleeping: true }, world)).toBe(false);
    // eben eingezogen läuft er erst zu seiner Wiese: Solange spränge er sichtbar an den Halt, also noch nicht
    const mole = s.animals.find((a) => a.id === FIRST_MOLE)!;
    expect(world.cell(mole.x, mole.y).garden).toBe(true);
    const walking = { ...s, animals: [{ ...mole, x: s.player.x + 1, y: s.player.y }] };
    expect(world.cell(s.player.x + 1, s.player.y).garden).toBeUndefined();
    expect(moleSettled(walking, world)).toBe(false);
    expect(canDig(walking, world)).toBe(false);
    expect(moleSettled(s, world)).toBe(true);
    expect(moleSettled({ animals: [] }, world)).toBe(true); // er folgt der Figur oder fehlt: Es klopft trotzdem am Halt
  });

  it('beginnt erst nah am Grubenhalt, wach, nicht im Fahrzeug, nicht im Schlaf', () => {
    const world = caveOf();
    const near = ready(world, {}, DIG_NEAR);
    expect(canDig(near, world)).toBe(true);
    expect(canDig(ready(world, {}, DIG_NEAR + 1), world)).toBe(false);
    expect(DIG_NEAR).toBeLessThanOrEqual(6); // wirklich am Halt: Das Kind sieht zu
    expect(canDig({ ...near, sleeping: true }, world)).toBe(false);
    expect(canDig({ ...near, work: { from: 0, to: 10 } }, world)).toBe(false);
    expect(canDig({ ...near, ride: {} }, world)).toBe(false);
    expect(canDig({ ...near, packs: { fahrt: { grube: { stage: 'bereit' } } } }, world)).toBe(false);
    const [bx, by] = world.homes.lichtung.bed;
    expect(canDig({ ...near, player: { x: bx, y: by, dir: 's' } }, world)).toBe(false); // nicht in der Grotte
    // ein Pfeil allein beginnt es nicht (nur der Takt), damit es nie mitten im Schritt losgeht
    expect(play(near, world, [{ type: 'move', dir: 'n' }]).s.dig).toBeUndefined();
  });

  it('das ganze Graben über step: klopfen, Erdwelle, Gang gegraben (gespeichert, Welt neu), Funkel rollt an den Halt; die Figur hüpft nur', () => {
    const world = caveOf();
    const s0 = ready(world);
    expect(funkelRoute(world, s0)).toBeUndefined(); // vorher Fels, kein Gleis
    const seat = haltOf(world)!;
    // der erste Takt: Der Maulwurf hüpft aus der Erde neben den Halt und klopft
    let r = play(s0, world, [TICK]);
    expect(heralds(r.events)).toEqual(['dig']);
    expect(r.s.dig).toEqual({ from: 1, to: 1 + DIG.ticks });
    const mole = r.s.animals.find((a) => a.id === FIRST_MOLE)!;
    const cell = world.cell(mole.x, mole.y);
    expect([cell.lane, cell.ride, cell.stop, cell.solid]).toEqual([undefined, undefined, undefined, false]);
    expect(Math.max(Math.abs(mole.x - seat[0]), Math.abs(mole.y - seat[1]))).toBeLessThanOrEqual(3);
    expect(mole.rest).toBeGreaterThan(DIG.ticks);
    // jeder Pfeil lässt die Figur nur hüpfen, auch zum Halt hin, auch ein Antippen
    const before = { ...r.s.player };
    const dirs = Object.keys(DIRS) as Dir[];
    r = play(r.s, r.world, [
      ...dirs.map((dir): Cmd => ({ type: 'move', dir, fresh: true })),
      { type: 'move', dir: 'n', tap: true },
    ]);
    expect([r.s.player.x, r.s.player.y]).toEqual([before.x, before.y]);
    expect(r.events.filter((e) => e.type === 'hop')).toHaveLength(5);
    expect(r.s.ride).toBeUndefined();
    // bis zum Augenblick `pop`: Der Gang ist gegraben, Stufe `bereit` gleich gespeichert, die Welt neu gebaut
    const popAt = Math.round(DIG.pop * DIG.ticks);
    r = play(r.s, r.world, ticks(popAt - 1));
    expect(stageOf(r.s.packs, FUNKEL.id)).toBeUndefined(); // bis dahin ist nichts gespeichert
    r = play(r.s, r.world, [TICK]);
    const dugEvent = r.events.find((e): e is HeraldEvent => e.type === 'herald' && e.what === 'dug')!;
    expect(dugEvent).toMatchObject({ relay: true, persist: true, x: seat[0], y: seat[1] });
    expect(stageOf(r.s.packs, FUNKEL.id)).toBe('bereit');
    expect(r.s.dig?.laid).toBe(true);
    const route = funkelRoute(r.world, r.s)!;
    expect(route.loop).toBe(true);
    expect(r.world.stones.get('grube')).toBeDefined(); // der Klangstein kommt mit dem Gang
    // die Figur steht noch, wo sie stand (sie stand nie auf dem Gang)
    expect(r.world.cell(r.s.player.x, r.s.player.y).solid).toBe(false);
    // bis zum Ende: Funkel ist an den Halt gerollt, das Graben vorbei, gelaufen werden darf wieder
    r = play(r.s, r.world, ticks(DIG.ticks - popAt));
    expect(heralds(r.events)).toEqual(['rolled']);
    expect(r.s.dig).toBeUndefined();
    const free = dirs.find((d) => {
      const c = r.world.cell(r.s.player.x + DIRS[d][0], r.s.player.y + DIRS[d][1]);
      return !c.solid && !c.ride && !c.stop;
    })!;
    const walked = play(r.s, r.world, [{ type: 'move', dir: free, fresh: true }]);
    expect([walked.s.player.x, walked.s.player.y]).not.toEqual([r.s.player.x, r.s.player.y]);
    // der Maulwurf läuft danach von selbst heim auf seinen Platz am Höhlenbett
    const home = r.s.animals.find((a) => a.id === FIRST_MOLE)!;
    const later = play(r.s, r.world, ticks(400)).s.animals.find((a) => a.id === FIRST_MOLE)!;
    const gap = (a: typeof home) => Math.abs(a.x - a.spawn[0]) + Math.abs(a.y - a.spawn[1]);
    expect(gap(later)).toBeLessThan(gap(home));
    // nur einmal: Danach ist nichts mehr fällig
    expect(digDue(r.s.packs, r.s.garden)).toBe(false);
  });

  it('wer vor dem Augenblick `pop` neu lädt, sieht es noch einmal (`State.dig` wird nicht gespeichert); danach ist der Gang gegraben', () => {
    const world = caveOf();
    let r = play(ready(world), world, ticks(10));
    expect(r.s.dig).toBeDefined();
    expect(r.s.packs).toEqual({}); // gespeichert ist noch nichts
    expect(digDue(r.s.packs, r.s.garden)).toBe(true);
    const reloaded = ready(world, r.s.packs);
    r = play(reloaded, world, [TICK]);
    expect(heralds(r.events)).toEqual(['dig']);
  });

  it('Erdwelle: einmal die künftige Runde entlang, vom Halt bis zurück zum Halt; bei reduzierter Bewegung drei feste Bilder', () => {
    const n = 160;
    const [from, to] = DIG.wave;
    expect(moundAt(from - 0.01, n, false)).toBeUndefined();
    expect(moundAt(to, n, false)).toBeUndefined();
    expect(moundAt(from, n, false)).toBe(0);
    const steps = Array.from({ length: 50 }, (_, i) => moundAt(from + ((to - from) * i) / 50, n, false)!);
    expect(steps.every((p, i) => i === 0 || p > steps[i - 1]!)).toBe(true);
    expect(steps.at(-1)!).toBeGreaterThan(n * 0.95);
    // langsam los und langsam an (am Halt sieht das Kind zu), in der Mitte schnell
    expect(moundAt(from + (to - from) * 0.2, n, false)!).toBeLessThan(n * 0.05);
    expect(moundAt(from + (to - from) * 0.8, n, false)!).toBeGreaterThan(n * 0.95);
    expect(moundAt(from + (to - from) * 0.5, n, false)!).toBeCloseTo(n / 2);
    const calm = new Set(Array.from({ length: 50 }, (_, i) => moundAt(from + ((to - from) * i) / 50, n, true)));
    expect(calm.size).toBe(MOUND_STAGES);
    // als Körper: über der künftigen Runde, glimmt (kleines Loch der Dunkelmaske), kein Gold, nie antippbar
    const world = caveOf();
    const s = { ...ready(world), tick: 30, dig: { from: 1, to: 1 + DIG.ticks } };
    const [b] = digBodies(s, world, AT);
    expect(b).toMatchObject({ id: MOUND_ID, beacon: true, parts: MOUND_PARTS });
    expect(b!.id.startsWith('ride:')).toBe(false);
    const lane = new Set(laneOf(world).map(([x, y]) => `${x},${y}`));
    expect(
      lane.has(`${Math.round(b!.x)},${Math.round(b!.y)}`) || lane.has(`${Math.floor(b!.x)},${Math.floor(b!.y)}`),
    ).toBe(true);
    expect(b!.z).toBeGreaterThanOrEqual(world.cell(Math.floor(b!.x), Math.floor(b!.y)).h);
    expect(MOUND_PARTS.some((p) => p[6] === GOLD.side || p[7] === GOLD.top)).toBe(false);
    expect(digBodies(ready(world), world, AT)).toEqual([]); // ohne Graben nichts
    expect(digBodies({ ...s, tick: 1 + Math.round(DIG.pop * DIG.ticks) }, world, AT)).toEqual([]); // nach der Welle
    expect(digAt({ tick: 1 + DIG.ticks, dig: s.dig })).toBeUndefined();
  });

  it('das Gleis wächst mit: Hinter dem Erdhügel bleibt Stück für Stück Gleis liegen, auf dem Fels des Gangs Glitzerkrümel, bis der Gang aufgeht', () => {
    const world = caveOf();
    const lane = laneOf(world);
    const base = ready(world);
    const at = (w: number): State => ({ ...base, tick: 1 + w * DIG.ticks, dig: { from: 1, to: 1 + DIG.ticks } });
    const [from, to] = DIG.wave;
    const laid = (w: number, reduced = false) =>
      digBodies(at(w), world, { ...AT, reduced }).filter((b) => b.id.startsWith(`${LAID_ID}:`));
    const indexOf = (b: { id: string }) => Number(b.id.split(':')[1]);
    // solange er klopft, liegt nichts; dann wächst es vom ersten Feld des Halts an, lückenlos hinter dem Hügel
    expect(digBodies(at(from / 2), world, AT)).toEqual([]);
    const early = laid(from + (to - from) * 0.25);
    const mound = moundAt(from + (to - from) * 0.25, lane.length, false)!;
    expect(early.length).toBeGreaterThan(2);
    expect(early.map(indexOf)).toEqual(early.map((_, k) => k));
    expect(Math.max(...early.map(indexOf))).toBeLessThan(mound);
    expect(laid(from + (to - from) * 0.3).length).toBeGreaterThan(early.length);
    // jedes Stück liegt genau dort und so herum, wo nach dem Graben das echte Gleis liegt
    const dug = worldOf(1, [HOEHLE_PACK, GRUBE_PACK], { fahrt: { grube: { stage: 'bereit' } } });
    const all = laid((to + DIG.pop) / 2); // nach der Welle, vor `pop`: Alles liegt, der Hügel ist weg
    expect(digBodies(at((to + DIG.pop) / 2), world, AT).some((b) => b.id === MOUND_ID)).toBe(false);
    const rails = all.filter((b) => b.key !== `${LAID_ID}:kruemel`);
    expect(all.every((b) => b.foot === 0)).toBe(true); // Gleis und Krümel liegen flach: kein Fleck am Boden
    expect(rails.length).toBeGreaterThan(8);
    for (const b of rails) {
      const [x, y] = lane[indexOf(b)]!;
      expect([b.x, b.y, b.z, b.dir]).toEqual([x, y, world.cell(x, y).h, 's']);
      const real = dug.cell(x, y);
      expect(real.ride).toBe(FUNKEL.id);
      const dirs = [...real.lane!.to!].sort().join('');
      expect(b.key).toBe(`${LAID_ID}:${dirs}`);
      expect(b.parts).toBe(laidParts(dirs));
      expect(world.cell(x, y).lane?.part).toBe('open');
    }
    // auf dem Fels des Gangs liegen Glitzerkrümel (auf jedem zweiten Feld), oben auf dem Fels
    const far = lane.findIndex(([x, y]) => world.cell(x, y).lane?.part === 'gang');
    const [gx, gy] = lane[far + 6]!;
    const inGang = digBodies({ ...at((to + DIG.pop) / 2), player: { x: gx, y: gy, dir: 's' } }, world, AT);
    const crumbs = inGang.filter((b) => b.key === `${LAID_ID}:kruemel`);
    expect(crumbs.length).toBeGreaterThan(3);
    for (const b of crumbs) {
      expect(b.parts).toBe(CRUMB_PARTS);
      expect(world.cell(b.x, b.y).lane?.part).toBe('gang');
      expect(b.z).toBe(world.cell(b.x, b.y).h);
      expect(indexOf(b) % 2).toBe(0);
    }
    // nur, was die Figur am Halt sehen kann; nichts davon antippbar, nichts glimmt, kein Gold
    for (const b of [...all, ...inGang.filter((x) => x.id !== MOUND_ID)]) {
      expect(b.id.startsWith('ride:')).toBe(false);
      expect(b.beacon).toBeUndefined();
      expect(b.parts.some((p) => p[6] === GOLD.side || p[7] === GOLD.top)).toBe(false);
    }
    const seen = (b: { x: number; y: number }) =>
      Math.max(Math.abs(b.x - base.player.x), Math.abs(b.y - base.player.y));
    expect(Math.max(...all.map(seen))).toBeLessThanOrEqual(DIG_SEEN);
    expect(all.length).toBeLessThan(lane.length / 2);
    // ab `pop` liegt das echte Gleis in der Welt: keine Körper mehr
    expect(digBodies(at(DIG.pop), world, AT)).toEqual([]);
    expect(digBodies({ ...at(to), dig: { from: 1, to: 1 + DIG.ticks, laid: true } }, world, AT)).toEqual([]);
    // bei reduzierter Bewegung liegt es in denselben drei festen Bildern hinter dem Hügel
    const calm = new Set(Array.from({ length: 30 }, (_, i) => laid(from + ((to - from) * i) / 30, true).length));
    expect(calm.size).toBeLessThanOrEqual(MOUND_STAGES);
    // das Modell eines Stücks: Bett frischer Erde, darauf dieselben Quader wie das echte Gleis, alles im Feld
    for (const dirs of ['ns', 'ew', 'en', 'es', 'sw', 'nw']) {
      const parts = laidParts(dirs)!;
      expect(parts[0]).toBe(BED_PART);
      expect(parts).toHaveLength(railShape(dirs)!.length + 1);
      for (const [f, r, z, fl, rw] of parts) {
        expect(Math.min(f, r)).toBeGreaterThanOrEqual(-0.5 - 1e-9);
        expect(Math.max(f + fl, r + rw)).toBeLessThanOrEqual(0.5 + 1e-9);
        expect(z).toBeGreaterThanOrEqual(0);
      }
    }
    expect(laidParts('nn')).toBeUndefined();
  });

  it('Funkel rollt nach dem Graben aus dem Gang an den Halt: Lampe an, kein Gold; bei reduzierter Bewegung gleich am Halt', () => {
    const world = worldOf(1, [HOEHLE_PACK, GRUBE_PACK], { fahrt: { grube: { stage: 'bereit' } } });
    const base = ready(world, { fahrt: { grube: { stage: 'bereit' } } });
    const r = funkelRoute(world, base)!;
    const n = r.path.length - 1;
    const out = gangOf(world, r)!.gates.out;
    const at = (b: number) => ({
      ...base,
      tick: 1 + Math.round(b * DIG.ticks),
      dig: { from: 1, to: 1 + DIG.ticks, laid: true as const },
    });
    expect(funkelAt(r, at(DIG.pop), AT, world)).toBe(out); // wartet am Klingeltor des Ausgangs
    const mid = funkelAt(r, at((DIG.roll[0] + DIG.roll[1]) / 2), AT, world);
    expect(mid).toBeGreaterThan(out);
    expect(mid).toBeLessThan(n);
    expect(funkelAt(r, at(DIG.roll[1]), AT, world)).toBe(0); // am Halt
    expect(funkelAt(r, at(DIG.pop), { ...AT, reduced: true }, world)).toBe(0);
    expect(funkelAt(r, base, AT, world)).toBe(0); // ohne Graben am Halt
    const bodies = funkelBodies(at(DIG.pop), world, AT);
    const seat = bodies.find((b) => b.id.endsWith(':seat'))!;
    expect(seat.key).toBe('ride:grube:seat:0000'); // ohne goldenen Rahmen an der Tür, Tür zu
    expect(bodies.find((b) => b.id.endsWith(':loco'))!.key).toBe('ride:grube:loco:1000'); // Lampe an
  });

  it('Töne: in der C-Pentatonik, über 500 Hz, leise, höchstens sechs Stimmen zugleich; nur seine eigenen Ereignisse', () => {
    const score = digScore();
    const PENTA = [0, 2, 4, 7, 9];
    for (const [f, , , gain] of score) {
      const semis = Math.round(12 * Math.log2(f / 261.63));
      expect(PENTA, `${f} Hz`).toContain(((semis % 12) + 12) % 12);
      expect(f).toBeGreaterThan(500);
      expect(gain).toBeLessThanOrEqual(0.05);
    }
    const voices = Math.max(
      ...score.map(([, , , , , at]) => score.filter(([, len, , , , b]) => b <= at && at < b + len).length),
    );
    expect(voices).toBeLessThanOrEqual(6);
    expect(Math.max(...score.map(([, len, , , , at]) => at + len))).toBeLessThan((DIG.ticks * 100) / 1000 + 0.5);
    const e = (what: HeraldEvent['what']): HeraldEvent => ({ type: 'herald', what, id: FIRST_MOLE, x: 0, y: 0 });
    expect(digFx(e('dig'))).toMatchObject({ who: FIRST_MOLE, score });
    expect(digFx(e('dug'))?.score).toEqual([]);
    expect(digFx(e('rolled'))?.score).toEqual([]);
    expect(digFx(e('build'))).toBeUndefined(); // Tok baut: nicht der Maulwurf
    expect(pack.view?.heraldFx?.(e('dig'), ready(caveOf()))).toEqual(digFx(e('dig')));
  });
});
