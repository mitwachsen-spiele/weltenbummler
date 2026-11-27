import { describe, expect, it } from 'vitest';
import { LOOK, REGIONS, figureParts } from '../../data/games/mitwachsen';
import { Air, postures, stepSound, turnHead } from './mitwachsen-air';
import { initialState, regionAnimals, type State } from './mitwachsen-state';
import { BLOCK, gustOf, windy } from './mitwachsen-weather';
import { IGLOO_LEDGE } from '../../data/games/mitwachsen-eis';
import { worldOf } from './test-worlds';
import type { Part } from '../../lib/games/front';

const world = worldOf(1);
const EIS = world.homes.eis;
/** alle Tiere wohnen auf ihrer Wiese (mit oder ohne den Pinguin) */
const garden = (penguin = true) =>
  REGIONS.flatMap((r) => regionAnimals(r.id))
    .filter((id) => penguin || id !== 'eis:pinguin')
    .map((id) => ({ id, species: id.split(':')[1] as 'hase' }));
/** erster Abschnitt mit bzw. ohne Pustewind */
const block = (wind: boolean) => {
  let b = 1;
  while (windy(world.seed, 0, b * BLOCK) !== wind) b++;
  return b;
};
/** wacher Zustand im Kessel neben dem Schneebett (bzw. auf der Lichtung) zum Takt `tick` */
const at = (tick: number, where: 'eis' | 'lichtung' = 'eis', penguin = true): State => {
  const [x, y] = where === 'eis' ? EIS.wake[0]! : world.homes.lichtung.wake[0]!;
  return { ...initialState(world, { garden: garden(penguin) }), sleeping: false, tick, player: { x, y, dir: 's' } };
};

describe('Kopf in die Böe drehen', () => {
  it('nur der Kopf dreht sich zur Seite, der Körper bleibt; das Gesicht zeigt nach rechts', () => {
    const parts = figureParts(LOOK);
    const turned = turnHead(parts);
    const body = parts.filter((p) => p[2] < 0.74);
    expect(turned.filter((p) => p[2] < 0.74)).toEqual(body);
    const head = parts.filter((p) => p[2] >= 0.74);
    expect(turned).toHaveLength(body.length + head.filter((p) => p[8] !== 'r').length); // das rechte Auge zeigt nach hinten
    expect(turned.filter((p) => p[8] === 'r').length).toBe(head.filter((p) => p[8] === 'f').length);
    for (const p of turned.filter((p) => p[2] >= 0.74)) {
      const orig = head.find((o) => o[2] === p[2] && o[3] === p[4] && o[4] === p[3] && o[1] === -(p[0] + p[3]));
      expect(orig, JSON.stringify(p)).toBeDefined(); // um die Hochachse gedreht: vorn wird rechts
      expect(p[1]).toBe(orig![0]);
    }
  });
  it('die Feinheit (Muster, Leuchten) dreht sich mit, auch an Gesichtsteilen', () => {
    const fine = { skin: 'haar' as const, halo: true as const };
    const parts = figureParts(LOOK).map((p): Part => [p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], fine]);
    const turned = turnHead(parts);
    expect(turned.filter((p) => p[2] >= 0.74).length).toBeGreaterThan(0);
    for (const p of turned) expect(p[9]).toBe(fine);
  });
});

describe('Haltungen beim Pustewind', () => {
  it('im Wind rücken Pinguine und Moschusochsen zusammen, die Eule plustert sich, das Eisbärkind rollt sich ein', () => {
    const s = at(block(true) * BLOCK + 500);
    const poses = postures(world, s);
    const ice = s.animals.filter((a) => a.realm === 'eis' && a.mode === 'home');
    expect(poses.size).toBe(ice.length);
    for (const a of ice) {
      const p = poses.get(a.id)!;
      expect(Math.abs(p.dx)).toBeLessThanOrEqual(0.3);
      expect(Math.abs(p.dy)).toBeLessThanOrEqual(0.3);
      expect(p.puff).toBe(a.species === 'schneeeule' ? 1.2 : a.species === 'eisbaer' ? 0.85 : 1);
      if (a.species !== 'pinguin' && a.species !== 'moschusochse') expect([p.dx, p.dy]).toEqual([0, 0]);
    }
    // Pinguine rücken zur Mitte ihrer Gruppe
    const penguins = ice.filter((a) => a.species === 'pinguin');
    const mx = penguins.reduce((n, a) => n + a.x, 0) / penguins.length;
    for (const a of penguins) expect(Math.sign(poses.get(a.id)!.dx)).toBe(Math.sign(mx - a.x));
    for (const a of s.animals.filter((a) => a.realm === 'lichtung')) expect(poses.has(a.id)).toBe(false);
  });

  it('ohne Wind, vor dem Pinguin und auf der Lichtung: keine besondere Haltung', () => {
    expect(postures(world, at(block(false) * BLOCK + 500)).size).toBe(0);
    expect(postures(world, at(block(true) * BLOCK + 500, 'eis', false)).size).toBe(0);
    expect(postures(world, { ...at(block(true) * BLOCK + 500), animals: [] }).size).toBe(0);
  });

  it('nachts im Schneebett sitzt eine Schneeeule der Wiese oben auf dem Iglu, vorn auf dem Sims (nur Bild)', () => {
    const s: State = { ...at(500), sleeping: true, player: { x: EIS.bed[0], y: EIS.bed[1], dir: 's' } };
    const poses = postures(world, s);
    expect(poses.size).toBe(1);
    const [id, p] = [...poses][0]!;
    const owl = s.animals.find((a) => a.id === id)!;
    expect(owl.species).toBe('schneeeule');
    const [sx, sy] = EIS.shelterStem;
    expect([owl.x + p.dx, owl.y + p.dy + 0.5, p.z]).toEqual([
      sx,
      sy + IGLOO_LEDGE.ahead,
      world.cell(sx, sy).h + IGLOO_LEDGE.z,
    ]);
    // Schläft die Figur im Bett der Lichtung, bleibt die Eule, wo sie ist
    const lichtung = { ...s, player: { x: 0, y: 0, dir: 's' as const } };
    expect(postures(world, lichtung).size).toBe(0);
    expect(postures(world, { ...s, animals: s.animals.filter((a) => a.species !== 'schneeeule') }).size).toBe(0);
  });
});

describe('Wetter, wo die Figur ist: Rauschen, Windspiel, Kopfdrehen, Polarlicht', () => {
  const fake = () => {
    const calls = { loop: [] as number[], chimes: [] as boolean[], giggles: [] as boolean[] };
    return {
      calls,
      sound: {
        windLoop: (l: number) => calls.loop.push(l),
        chime: (s: boolean) => calls.chimes.push(s),
        giggle: (s: boolean) => calls.giggles.push(s),
      },
    };
  };
  const wind = block(true) * BLOCK;

  it('im Kessel rauscht der Pustewind; an der Spitze jeder Böe klingt einmal das Windspiel', () => {
    const { calls, sound } = fake();
    const air = new Air(sound);
    let glances = 0;
    for (let t = wind + 300; t < wind + 1500; t++) {
      const r = air.frame(world, at(t), false, false);
      expect(r.weather.wind).toBe(1);
      expect(r.aurora).toBe(0);
      if (r.glance) glances++;
    }
    expect(Math.min(...calls.loop)).toBeGreaterThan(0.5);
    expect(Math.max(...calls.loop)).toBeLessThanOrEqual(1);
    const peaks = new Set<number>();
    for (let t = wind + 300; t < wind + 1500; t++) {
      const { start, len } = gustOf(world.seed, 0, t);
      if (start + Math.floor(len / 2) >= wind + 300) peaks.add(start + Math.floor(len / 2));
    }
    expect(calls.chimes).toHaveLength(peaks.size); // je Böe genau einmal
    expect(calls.chimes.every((soft) => !soft)).toBe(true);
    expect(glances).toBe(peaks.size * 8); // je Böe kurz den Kopf drehen
    expect(calls.giggles).toEqual(calls.chimes); // und einmal leise lachen
  });

  it('still bei Pause, im Schlaf, auf der Lichtung und ohne Wind; bei reduzierter Bewegung leise, ohne Kopfdrehen', () => {
    for (const [s, quiet] of [
      [at(wind + 500), true],
      [{ ...at(wind + 500), sleeping: true }, false],
      [at(wind + 500, 'lichtung'), false],
      [at(block(false) * BLOCK + 500), false],
      [at(wind + 500, 'eis', false), false],
    ] as const) {
      const { calls, sound } = fake();
      const air = new Air(sound);
      for (let t = 0; t < 900; t++) air.frame(world, { ...s, tick: s.tick + t }, quiet, false);
      expect(calls.loop.every((l) => l === 0)).toBe(true);
      expect([calls.chimes, calls.giggles]).toEqual([[], []]);
    }
    const { calls, sound } = fake();
    const air = new Air(sound);
    const loud = fake();
    const air2 = new Air(loud.sound);
    for (let t = wind + 300; t < wind + 900; t++) {
      expect(air.frame(world, at(t), false, true).glance).toBe(false);
      air2.frame(world, at(t), false, false);
    }
    calls.loop.forEach((l, i) => expect(l).toBeCloseTo(loud.calls.loop[i]! / 2));
    expect(calls.chimes.length).toBeGreaterThan(0);
    expect(calls.chimes.every((soft) => soft)).toBe(true);
    expect(calls.giggles).toEqual(calls.chimes); // das Lachen bleibt, leise
  });

  it('Lichtung: das Wetter der Lichtung; nachts im Schneebett leuchtet das Polarlicht', () => {
    const { sound } = fake();
    const air = new Air(sound);
    const r = air.frame(world, at(wind + 500, 'lichtung'), false, false);
    expect([r.weather.wind, r.weather.snow, r.weather.sparkle]).toEqual([0, 0, 0]);
    const bed = { ...at(wind + 500), sleeping: true, player: { x: EIS.bed[0], y: EIS.bed[1], dir: 's' as const } };
    expect(air.frame(world, bed, false, false).aurora).toBe(1);
    expect(air.frame(world, { ...bed, player: { x: 0, y: 0, dir: 's' } }, false, false).aurora).toBe(0);
  });
});

describe('Knirschen', () => {
  it('im Kessel knirscht es auf Schnee und Eis; auf der Lichtung bleibt jeder Schritt ein Tapp, auch auf Schnee', () => {
    const snowy = (realm: 'eis' | 'lichtung') => {
      const out: [number, number][] = [];
      for (let y = -130; y <= 130; y++)
        for (let x = -130; x <= 130; x++)
          if (world.realm(x, y) === realm && /^(snow|ice)$/.test(world.cell(x, y).ground)) out.push([x, y]);
      return out;
    };
    const lichtung = snowy('lichtung');
    expect(lichtung.length).toBeGreaterThan(0); // Schneeflecken und Eis-Landschaft gibt es auch auf der Lichtung
    for (const [x, y] of lichtung) expect(stepSound(world, x, y)).toBe('step');
    expect(snowy('eis').every(([x, y]) => stepSound(world, x, y) === 'crunch')).toBe(true);
    expect(stepSound(world, ...EIS.wake[0]!)).toBe('crunch');
    expect(stepSound(world, ...world.homes.lichtung.wake[0]!)).toBe('step');
  });
});
