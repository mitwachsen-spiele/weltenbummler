// Abend in der Kristallgrotte (Schritt 13, Schmuck mit Zug): Lichtschächte golden-orange (in 2D am Boden, `ground`; in
// 3D auf der Ebene darüber), Fledermaus-Runden um den Schacht über dem Höhlenbett, am Abend und im Schlaf im Höhlenbett
// (mitwachsen-dusk-look.ts, gezeichnet von `caveWeather`)
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Projection } from '../../../../lib/games/front';
import { GROTTE } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { SkyScene } from '../../mitwachsen-sky';
import { initialState, type State } from '../../mitwachsen-state';
import { kesselPlace } from '../../mitwachsen-world';
import { HOEHLE_PACK, worldOf } from '../../test-worlds';
import { fakeDocument } from '../../test-canvas';
import { Chime } from './mitwachsen-chime-look';
import { caveWeather, type CaveFx } from './mitwachsen-cave-sky';
import { Drips } from './mitwachsen-drips';
import {
  DUSK_ALPHA,
  DUSK_ROUND,
  drawDusk,
  duskAlpha,
  duskAway,
  duskBat,
  duskGround,
  hanging,
  roundCentre,
  shaftsNear,
} from './mitwachsen-dusk-look';
import { glowOver } from './mitwachsen-cave-look';
import { Olm } from './mitwachsen-olm-look';
import { fx, ground, view } from './view-2d';

// Ohne Browser: Die Fledermäuse kommen fein aus dem Bild-Cache, dafür Canvas als Attrappe
let restore = () => {};
beforeAll(() => void (restore = fakeDocument()));
afterAll(() => restore());

const W = worldOf(1, [HOEHLE_PACK]);
const cells = kesselPlace(1, HOEHLE_PACK).cells.map((p) => ({ p, c: W.cell(...p) }));
const P: Projection = (x, y, z) => [x * 10, (y - z) * 10];
const canvas = () => {
  const fills: string[] = [];
  const raw = { globalAlpha: 1, fillStyle: '', fillRect: () => void fills.push(raw.fillStyle), drawImage: () => {} };
  return { ctx: raw as unknown as CanvasRenderingContext2D, fills };
};

/** Die Fledermäuse der Welt, wie sie zu Beginn im Kristallbogen hängen; die Figur mitten im Lichtfleck der Kristallhalle */
function inHall(): State {
  const hall = cells.filter(({ c }) => c.shaft === 1 && !c.solid);
  const [x, y] = hall[Math.floor(hall.length / 2)]!.p;
  return { ...initialState(W), sleeping: false, player: { x, y, dir: 's' } };
}
/** Die Figur im Höhlenbett: wach oder schlafend */
function inBed(sleeping: boolean): State {
  const [x, y] = W.homes.hoehle.bed;
  return { ...initialState(W), sleeping, player: { x, y, dir: 's' } };
}
const scene = (evening: number, reduced = false, now = 1000, lit3d = false) =>
  ({ now, reduced, evening, lit3d, explored: () => true, zoom: 1 }) as unknown as SkyScene & { evening: number };

describe('Abend in der Kristallgrotte', () => {
  it('jeder der drei Lichtschächte hat seinen Lichtfleck (`Cell.shaft`), nur dort, wo Licht ist', () => {
    const marked = cells.filter(({ c }) => c.shaft !== undefined);
    expect(new Set(marked.map(({ c }) => c.shaft))).toEqual(new Set([0, 1, 2]));
    expect(marked.every(({ c }) => (c.light ?? 0) > 0)).toBe(true);
    expect(GROTTE.shafts).toHaveLength(3);
  });

  it('vor dem Abend nichts; ab 20 min in 2D golden-orange am Boden der Lichtflecken, je abendlicher, desto mehr', () => {
    const lit = cells.find(({ c }) => c.shaft !== undefined && !c.solid && (c.light ?? 0) >= 0.3)!;
    const [x, y] = lit.p;
    const day = ground(lit.c, x, y, true, 0)!;
    expect(day[6]).toBe(glowOver(lit.c.light!));
    const eve = ground(lit.c, x, y, true, 1)!;
    const half = ground(lit.c, x, y, true, 0.5)!;
    expect(eve[6]).not.toBe(day[6]);
    expect(eve[6]).toBe(duskGround(lit.c.light!, lit.c.shaft, 1));
    expect(eve[6]).toMatch(/^rgba\(255, 1[67]\d, 9\d, 0\.45\)$/); // voll golden-orange (#ffa65c), so deckend wie erlaubt
    expect(half[6]).not.toBe(eve[6]);
    // Licht neben Kristallen ohne Schacht bleibt am Abend hell
    expect(duskGround(0.3, undefined, 1)).toBe(glowOver(0.3));
    expect(duskAlpha(0.35, 1)).toBeCloseTo(DUSK_ALPHA);
    expect(duskAlpha(0.35, 0.5)).toBeCloseTo(DUSK_ALPHA / 2);
    expect(duskAlpha(0, 1)).toBe(0);
  });

  it('in 2D liegt in der Luft nichts Oranges über Figur und Tieren; nur in 3D auf der Ebene darüber, nahe der Figur', () => {
    const s = inHall();
    const day = canvas();
    expect(drawDusk(day.ctx, W, P, scene(0), s, () => {})).toBeUndefined();
    expect(day.fills).toEqual([]);
    const flat = canvas();
    drawDusk(flat.ctx, W, P, scene(1), s, () => {});
    expect(flat.fills).not.toContain('#ffa65c');
    const deep = canvas();
    drawDusk(deep.ctx, W, P, scene(1, false, 1000, true), s, () => {});
    expect(deep.fills).toContain('#ffa65c');
    expect(shaftsNear(W, s.player.x, s.player.y).get(1)!.length).toBeGreaterThan(0);
  });

  it('am Abend fliegen die hängenden Fledermäuse (höchstens zwei) Runden um den Schacht über dem Höhlenbett; solange ist ihr Platz leer', () => {
    const s = inHall();
    const centre = roundCentre(W)!;
    const [bx, by] = W.homes.hoehle.bed;
    expect(Math.hypot(centre.x - 0.5 - bx, centre.y - 0.5 - by)).toBeLessThan(2); // der Schacht über dem Bett
    const near: number[][] = [];
    drawDusk(canvas().ctx, W, P, scene(1), inBed(false), (x, y) => near.push([x, y]));
    expect(near.length).toBeGreaterThan(0); // vom Bett aus zu sehen
    for (const [x, y] of near) expect(Math.hypot(x! - centre.x, y! - centre.y)).toBeCloseTo(DUSK_ROUND.r);
    const from = hanging(W, s);
    expect(from.length).toBeGreaterThan(0);
    expect(from.length).toBeLessThanOrEqual(DUSK_ROUND.most);
    const flown: number[][] = [];
    const dusk = drawDusk(canvas().ctx, W, P, scene(1), s, (x, y, z) => flown.push([x, y, z]))!;
    expect(flown).toHaveLength(from.length);
    for (const [x, y] of from) {
      expect(duskAway(dusk, x, y, 1100)).toBe(true);
      expect(duskAway(dusk, x, y, 1600)).toBe(false); // nicht mehr gezeichnet (die Figur ging hinaus): sie hängt wieder
    }
    expect(duskAway(dusk, 9999, 9999, 1100)).toBe(false);
    // über die Haken des Pakets: `caveWeather` merkt es sich, `away` sagt es den Ansichten
    caveWeather(fx)(canvas().ctx, W, scene(1, false, 5000), P, s);
    expect(view.away!(...from[0]!, 5100)).toBe(true);
    caveWeather(fx)(canvas().ctx, W, scene(0, false, 6000), P, s);
    expect(view.away!(...from[0]!, 6100)).toBe(false);
  });

  it('schläft die Figur im Höhlenbett, fliegen sie ihre Runden auch ohne Abend; wach ohne Abend nicht, woanders schlafend nicht', () => {
    const flown: unknown[] = [];
    const night = drawDusk(canvas().ctx, W, P, scene(0), inBed(true), () => flown.push(1))!;
    expect(flown.length).toBeGreaterThan(0);
    expect(night.away.size).toBe(flown.length);
    expect(drawDusk(canvas().ctx, W, P, scene(0), inBed(false), () => {})).toBeUndefined();
    const [lx, ly] = W.homes.lichtung.bed;
    const lichtung = { ...inBed(true), player: { x: lx, y: ly, dir: 's' as const } };
    expect(drawDusk(canvas().ctx, W, P, scene(0), lichtung, () => {})).toBeUndefined();
    expect(drawDusk(canvas().ctx, W, P, scene(0, true), inBed(true), () => flown.push(1))!.away.size).toBe(0);
  });

  it('bei reduzierter Bewegung fliegt keine (sie hängen weiter), das Abendlicht bleibt; ohne hängende Fledermaus keine Runde', () => {
    const s = inHall();
    const flown: unknown[] = [];
    const calm = canvas();
    const dusk = drawDusk(calm.ctx, W, P, scene(1, true, 1000, true), s, () => flown.push(1))!;
    expect(flown).toEqual([]);
    expect(dusk.away.size).toBe(0);
    expect(calm.fills).toContain('#ffa65c');
    const none = drawDusk(canvas().ctx, W, P, scene(1), { ...s, animals: [] }, () => flown.push(1))!;
    expect(flown).toEqual([]);
    expect(none.away.size).toBe(0);
  });

  it('die Runde ist ein Kreis um die Mitte des Schachts, darüber, zwei Fledermäuse um eine halbe Runde versetzt', () => {
    const c = { x: 10, y: 20, z: 1 };
    for (const ms of [0, 1500, 3000, 4500]) {
      const b = duskBat(ms, 0, 2, c);
      expect(Math.hypot(b.x - c.x, b.y - c.y)).toBeCloseTo(DUSK_ROUND.r);
      expect(b.z).toBeGreaterThan(c.z + 1.5);
      const o = duskBat(ms, 1, 2, c);
      expect(Math.hypot(o.x - (2 * c.x - b.x), o.y - (2 * c.y - b.y))).toBeLessThan(1e-9);
    }
  });

  it('der Schmuck der Grotte ohne Abend (`evening` fehlt) bleibt, wie er war', () => {
    const f: CaveFx = { chime: new Chime(), drips: new Drips(), olm: new Olm(), light: {} };
    const c = canvas();
    caveWeather(f)(c.ctx, W, { ...scene(0), evening: undefined } as unknown as SkyScene, P, inHall());
    expect(f.dusk).toBeUndefined();
  });
});
