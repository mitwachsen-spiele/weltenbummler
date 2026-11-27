// Kleine Lichtgeister (Konzept „Höhle nach dem ersten Spielen“, Punkt 9, Schritt 11): Verstecke seitlich an den Säulen,
// nur im Licht der Laterne zu sehen, Verstecken im Lichtkreis, Freudenrunde, eigenes leises Kichern, Bild und Klangstein.
import { describe, expect, it } from 'vitest';
import { SPECIES } from '../../../../data/games/mitwachsen';
import { RIDES } from '../../../../data/games/mitwachsen-rides';
import { CAVE_SPECIES } from '../../../../data/games/mitwachsen-hoehle';
import { ICE_SPECIES } from '../../../../data/games/mitwachsen-eis';
import { GHOST_MODEL } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-models';
import { GROTTE, GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { Scored } from '../../sfx';
import { HOEHLE_PACK, reachable, seedsFor, seedRange, worldOf } from '../../test-worlds';
import { COLUMN_SCALE } from './mitwachsen-chime-look';
import {
  ghostAt,
  giggleScore,
  hideoutsOf,
  inLight,
  joyScore,
  lightsOf,
  nextHideout,
  startGhosts,
  stepGhosts,
  type Ghosts,
  type GhostInput,
  type Hideout,
} from './mitwachsen-ghost';
import { GHOST_FOOT, GhostFx, drawGhosts, glimmerBoxes, wreathAlpha, wreathBoxes } from './mitwachsen-ghost-look';
import { projection } from '../../../../lib/games/front';
import { anyContext } from '../../test-canvas';
import { FLOOR, brightness, rgbOf, type Rgb } from './mitwachsen-mask';

const G = GROTTE.ghost;
const w = worldOf(1, [HOEHLE_PACK]);
const hs = hideoutsOf(w);
/** Feld der Figur so, dass die Mitte ihres Felds bei (x, y) liegt */
const cellAt = (x: number, y: number) => ({ x: Math.floor(x), y: Math.floor(y) });
const lantern = (p: { x: number; y: number }) => [{ x: p.x + 0.5, y: p.y + 0.5, r: GROTTE.circle.lantern }];
const input = (now: number, player: { x: number; y: number }, extra: Partial<GhostInput> = {}): GhostInput => ({
  now,
  player,
  lights: lantern(player),
  awake: true,
  ...extra,
});
/** Die Geister `ms` lang in Schritten von 50 ms bedenken; die Töne aller Schritte dazu */
function run(gs: Ghosts, from: number, ms: number, at: (now: number) => GhostInput) {
  const tones: Scored[][] = [];
  for (let t = from; t <= from + ms; t += 50) {
    const s = stepGhosts(gs, hs, at(t));
    [gs] = [s.ghosts];
    if (s.tones.length) tones.push(s.tones);
  }
  return { gs, tones };
}

describe('Lichtgeister: Verstecke', () => {
  it('je Säule eins im Osten und eins im Westen, nie im Norden oder Süden, auf freiem Boden der Grotte (Seeds)', () => {
    const bad: string[] = [];
    for (const seed of seedsFor(seedRange(1, 20))) {
      const world = worldOf(seed, [HOEHLE_PACK]);
      const found = hideoutsOf(world);
      if (found.length !== 2 * GROTTE.hall.columns.length) bad.push(`Seed ${seed}: ${found.length} Verstecke`);
      for (const h of found) {
        const [cx, cy] = h.column;
        const dx = h.x - cx - 0.5;
        const beside = world.cell(cx + Math.sign(dx), cy);
        if (world.cell(cx, cy).deco !== 'column') bad.push(`Seed ${seed}: keine Säule bei ${cx},${cy}`);
        if (Math.abs(Math.abs(dx) - G.side) > 1e-9 || Math.abs(h.y - cy - 0.5 + G.back) > 1e-9)
          bad.push(`Seed ${seed}: ${h.side} nicht seitlich (${dx}, ${h.y - cy - 0.5})`);
        if ((h.side === 'e') !== dx > 0) bad.push(`Seed ${seed}: Seite ${h.side} passt nicht`);
        if (beside.solid || beside.ground === 'water' || beside.region !== 'hoehle')
          bad.push(`Seed ${seed}: Versteck bei ${cx},${cy} ${h.side} nicht auf freiem Boden`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('ohne Grotte keine Verstecke', () => {
    expect(hideoutsOf(worldOf(1, []))).toEqual([]);
  });

  it('am Anfang zwei Geister an den äußeren Verstecken, unsichtbar', () => {
    const gs = startGhosts(hs);
    expect(gs.list.map((g) => g.at)).toEqual([0, hs.length - 1]);
    expect(gs.list.every((g) => g.alpha === 0)).toBe(true);
    expect(startGhosts([hs[0]!]).list).toHaveLength(1);
    expect(startGhosts([]).list).toHaveLength(0);
  });
});

describe('Lichtgeister: nur im Licht', () => {
  const s = (extra: object = {}) => ({ player: cellAt(hs[0]!.x, hs[0]!.y + 3), ...extra });

  it('Licht ist die Laterne in der Hand (wach, zu Fuß, in der Grotte), sonst keins', () => {
    expect(lightsOf(w, s())).toEqual([]);
    const [l] = lightsOf(w, s({ lamp: 'hoehle' }));
    expect(l?.r).toBe(GROTTE.circle.lantern);
    expect(lightsOf(w, s({ lamp: 'hoehle', sleeping: true }))).toEqual([]);
    expect(lightsOf(w, s({ lamp: 'hoehle', ride: {} }))).toEqual([]);
    expect(lightsOf(w, { player: { x: 0, y: 0 }, lamp: 'hoehle' })).toEqual([]); // auf der Lichtung
  });

  it('inLight: im Kreis ja, außerhalb nein', () => {
    const lights = [{ x: 0, y: 0, r: 2 }];
    expect(inLight(lights, 1.5, 1)).toBe(true);
    expect(inLight(lights, 2, 1)).toBe(false);
    expect(inLight([], 0, 0)).toBe(false);
  });

  it('im Licht blendet er in 0,4 s ein, ohne Licht in 0,4 s aus; ohne Laterne bleibt er unsichtbar', () => {
    const h = hs[0]!;
    const me = cellAt(h.x, h.y + 3); // im Licht, aber nicht zu nah
    let gs = startGhosts(hs, 0);
    gs = stepGhosts(gs, hs, input(200, me)).ghosts;
    expect(gs.list[0]!.alpha).toBeCloseTo(0.5, 5);
    gs = stepGhosts(gs, hs, input(400, me)).ghosts;
    expect(gs.list[0]!.alpha).toBe(1);
    gs = stepGhosts(gs, hs, input(600, me, { lights: [] })).ghosts;
    expect(gs.list[0]!.alpha).toBeCloseTo(0.5, 5);
    gs = stepGhosts(gs, hs, input(800, me, { lights: [] })).ghosts;
    expect(gs.list[0]!.alpha).toBe(0);
    const dark = run(startGhosts(hs, 0), 0, 2000, (t) => input(t, me, { lights: [] }));
    expect(dark.gs.list[0]!.alpha).toBe(0);
    expect(dark.tones).toEqual([]);
  });

  it('abends und nachts schlafen sie: blenden aus, kichern nicht und schweben nicht weg', () => {
    const h = hs[0]!;
    const near = cellAt(h.x, h.y);
    const { gs, tones } = run(startGhosts(hs, 0), 0, 3000, (t) => input(t, near, { awake: false }));
    expect(gs.list[0]!.alpha).toBe(0);
    expect(gs.list[0]!.at).toBe(0);
    expect(tones).toEqual([]);
  });

  it('wird er sichtbar, kichert er einmal', () => {
    const h = hs[0]!;
    const { tones } = run(startGhosts(hs, 0), 0, 1000, (t) => input(t, cellAt(h.x, h.y + 3)));
    expect(tones).toEqual([giggleScore()]);
  });
});

describe('Lichtgeister: Verstecken', () => {
  it('nächstes Versteck: weiter als 2, höchstens 3,5 Felder von der Figur, das fernste, nicht das eigene, nicht besetzt', () => {
    const h = hs[0]!;
    const me = cellAt(h.x, h.y);
    const next = nextHideout(hs, 0, me)!;
    const d = (o: Hideout) => Math.hypot(o.x - me.x - 0.5, o.y - me.y - 0.5);
    expect(d(hs[next]!)).toBeGreaterThan(G.near);
    expect(d(hs[next]!)).toBeLessThanOrEqual(G.hop);
    const farther = hs.filter((o, i) => i !== 0 && d(o) > G.near && d(o) <= G.hop && d(o) > d(hs[next]!));
    expect(farther).toEqual([]);
    expect(nextHideout(hs, 0, me, new Set([next]))).not.toBe(next);
    expect(nextHideout(hs, 0, { x: me.x + 40, y: me.y })).toBeUndefined();
    // nur eins hinter 3,5 Feldern, aber noch im Licht: dorthin
    const one: Hideout[] = [hs[0]!, { ...hs[0]!, x: me.x + 0.5 + 4 }];
    expect(nextHideout(one, 0, me)).toBe(1);
    expect(nextHideout([hs[0]!, { ...hs[0]!, x: me.x + 0.5 + 5 }], 0, me)).toBeUndefined();
  });

  it('das nächste Versteck liegt immer im Lichtkreis der Laterne (alle Felder um jedes Versteck, Seeds)', () => {
    expect(G.hop).toBeLessThan(GROTTE.circle.lantern);
    const bad: string[] = [];
    for (const seed of seedsFor(seedRange(1, 20))) {
      const world = worldOf(seed, [HOEHLE_PACK]);
      const found = hideoutsOf(world);
      found.forEach((h, i) => {
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const me = { x: Math.floor(h.x) + dx, y: Math.floor(h.y) + dy };
            if (Math.hypot(h.x - me.x - 0.5, h.y - me.y - 0.5) > G.near) continue;
            const next = nextHideout(found, i, me);
            const to = next === undefined ? undefined : found[next];
            if (!to) bad.push(`Seed ${seed}: Versteck ${i}, Figur ${me.x},${me.y}: keins frei`);
            else if (!inLight(lantern(me), to.x, to.y)) bad.push(`Seed ${seed}: Versteck ${next} außerhalb des Lichts`);
          }
      });
    }
    expect(bad).toEqual([]);
  });

  it('kommt die Figur auf 2 Felder heran, schwebt er in 1 s zum nächsten Versteck und kichert', () => {
    const h = hs[0]!;
    let gs = run(startGhosts(hs, 0), 0, 500, (t) => input(t, cellAt(h.x, h.y + 3))).gs; // sichtbar
    const me = cellAt(h.x, h.y);
    const s = stepGhosts({ ...gs, giggled: -Infinity }, hs, input(600, me));
    gs = s.ghosts;
    const g = gs.list[0]!;
    expect(g.from).toBe(0);
    expect(g.at).toBe(nextHideout(hs, 0, me, new Set([hs.length - 1])));
    expect(s.tones).toEqual(giggleScore());
    const mid = ghostAt(g, hs, 1100, false)!;
    const to = hs[g.at]!;
    expect(Math.hypot(mid.x - h.x, mid.y - h.y)).toBeGreaterThan(0);
    expect(Math.hypot(mid.x - to.x, mid.y - to.y)).toBeGreaterThan(0);
    const end = ghostAt(g, hs, 1600, true)!;
    expect([end.x, end.y]).toEqual([to.x, to.y]);
    // schwebt er, flieht er nicht noch einmal; angekommen ist er nicht weg
    gs = run(gs, 650, 900, (t) => input(t, me)).gs;
    expect(gs.list[0]!.alpha).toBe(1);
  });

  it('ohne Laterne schwebt er nicht weg, auch wenn die Figur direkt daneben steht', () => {
    const h = hs[0]!;
    const { gs } = run(startGhosts(hs, 0), 0, 2000, (t) => input(t, cellAt(h.x, h.y), { lights: [] }));
    expect(gs.list[0]!.at).toBe(0);
    expect(gs.list[0]!.from).toBeUndefined();
  });

  it('nach drei Verstecken dreht er eine Freudenrunde mit eigenem Ton, danach beginnt das Zählen neu', () => {
    let gs = startGhosts(hs, 0);
    let now = 0;
    const joys: number[] = [];
    for (let hop = 0; hop < 3; hop++) {
      const at = hs[gs.list[0]!.at]!;
      const me = cellAt(at.x, at.y);
      const r = run(gs, now, 1600, (t) => input(t, me));
      [gs, now] = [r.gs, now + 1650];
      for (const t of r.tones) if (t.length === joyScore().length) joys.push(hop);
      // weg von ihm, damit er ankommt
      const far = run(gs, now, 1200, (t) =>
        input(t, cellAt(at.x + 30, at.y), { lights: lantern(cellAt(at.x, at.y + 3)) }),
      );
      [gs, now] = [far.gs, now + 1250];
      for (const t of far.tones) if (t.length === joyScore().length) joys.push(hop);
    }
    expect(joys).toEqual([2]);
    expect(gs.list[0]!.hops).toBe(0);
  });

  it('gekichert wird höchstens alle 1,2 s', () => {
    const h = hs[0]!;
    const gs = run(startGhosts(hs, 0), 0, 450, (t) => input(t, cellAt(h.x, h.y + 3))).gs;
    const me = cellAt(h.x, h.y);
    const s = stepGhosts(gs, hs, input(500, me)); // 500 ms nach dem ersten Kichern beim Einblenden
    expect(s.ghosts.list[0]!.from).toBe(0);
    expect(s.tones).toEqual([]);
  });

  it('bei reduzierter Bewegung kein Schweben und kein Wiegen: Ausblenden, dann am neuen Versteck einblenden', () => {
    const g = { at: 1, from: 0, moved: 0, hops: 1, alpha: 1, lit: true, t: 0 };
    const a = ghostAt(g, hs, 250, true)!;
    const b = ghostAt(g, hs, 750, true)!;
    expect([a.x, a.y]).toEqual([hs[0]!.x, hs[0]!.y]);
    expect([b.x, b.y]).toEqual([hs[1]!.x, hs[1]!.y]);
    expect(a.fade).toBeCloseTo(0.5, 5);
    expect(b.fade).toBeCloseTo(0.5, 5);
    const still = { at: 0, moved: -Infinity, hops: 0, alpha: 1, lit: true, t: 0 };
    expect(ghostAt(still, hs, 100, true)!.z).toBe(ghostAt(still, hs, 900, true)!.z);
    expect(ghostAt(still, hs, 100, false)!.z).not.toBe(ghostAt(still, hs, 900, false)!.z);
    const joy = { ...still, joy: 0 };
    expect(ghostAt(joy, hs, 400, true)!.x).toBe(hs[0]!.x);
    expect(ghostAt(joy, hs, 400, false)!.x).not.toBe(hs[0]!.x);
  });
});

describe('Lichtgeister: Töne', () => {
  const PENTA = [0, 2, 4, 7, 9];
  const penta = (f: number) => PENTA.includes(((Math.round(12 * Math.log2(f / 261.63)) % 12) + 12) % 12);
  const notes = (s: Scored[]) => s.map(([f]) => Math.round(f));

  it('Kichern und Freudenrunde sind pentatonisch und leise (nicht lauter als das leiseste Tier)', () => {
    const animals = [...Object.values(SPECIES), ...Object.values(CAVE_SPECIES), ...Object.values(ICE_SPECIES)];
    const quietest = Math.min(...animals.map((s) => s.tone.gain ?? Infinity));
    const all: Scored[] = [...giggleScore(), ...joyScore()];
    expect(all.filter(([f]) => !penta(f))).toEqual([]);
    expect(Math.max(...all.map(([, , , gain]) => gain))).toBeLessThanOrEqual(quietest);
  });

  it('das Kichern unterscheidet sich von allen Tierrufen, Fahrzeugsignalen und Dreiklängen des Säulen-Glockenspiels', () => {
    const own = notes(giggleScore());
    const others: number[][] = [
      ...Object.values(SPECIES).map((s) => s.tone.notes.map(Math.round)),
      ...Object.values(CAVE_SPECIES).map((s) => s.tone.notes.map(Math.round)),
      ...Object.values(ICE_SPECIES).map((s) => s.tone.notes.map(Math.round)),
      ...RIDES.map((r) => r.signal.map(Math.round)),
    ];
    const col = COLUMN_SCALE.map(Math.round);
    for (const a of col) for (const b of col) for (const c of col) others.push([a, b, c], [a, b]);
    for (const o of others) expect(o).not.toEqual(own);
    // kein Tierruf, kein Fahrzeugsignal und kein Säulen-Dreiklang nutzt seine Tonhöhe (A6)
    expect(others.flat()).not.toContain(own[0]);
  });

  it('nie mehr als drei Töne zugleich', () => {
    for (const score of [giggleScore(), joyScore()]) {
      const at = (t: number) => score.filter(([, len, , , , d]) => d <= t && t < d + len).length;
      expect(Math.max(...score.map(([, , , , , d]) => at(d)))).toBeLessThanOrEqual(3);
    }
  });
});

describe('Lichtgeister: Bild', () => {
  const contrast = (a: Rgb, b: Rgb) => {
    const [x, y] = [brightness(a), brightness(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  it('ein runder Tropfen etwa 0,4 Felder hoch, mit drei Zipfeln, ohne offene Augen (kein Glanzpunkt, kein Weiß)', () => {
    const top = Math.max(...GHOST_MODEL.map((p) => p[2] + p[5]));
    expect(top).toBeGreaterThan(0.36);
    expect(top).toBeLessThan(0.42);
    const C = GROTTE_COLORS.ghost;
    expect(GHOST_MODEL.filter((p) => p[6] === C.body && p[2] < 0.03)).toHaveLength(3);
    expect(GHOST_MODEL.some((p) => p[6] === '#ffffff')).toBe(false);
    expect(GHOST_MODEL.filter((p) => p[6] === C.eye).length).toBe(6); // zwei Bögen aus je drei Stücken
  });

  it('der warme Rand hebt ihn vom hellen Boden ab, der Körper ist hell (kein Grau auf Grau)', () => {
    const C = GROTTE_COLORS.ghost;
    expect(contrast(rgbOf(C.rim), FLOOR)).toBeGreaterThan(1.5); // Pfirsich allein: 1,25 : 1
    expect(contrast(rgbOf(C.rim), rgbOf(C.body))).toBeGreaterThan(1.8);
    expect(brightness(rgbOf(C.body))).toBeGreaterThan(brightness(FLOOR));
  });

  it('Glimmerpünktchen: kein Gesicht (nie zwei nebeneinander mit einem dritten darunter dazwischen)', () => {
    const dots = glimmerBoxes(0, 0, 0).map((b) => ({ x: b[0] + b[3] / 2, z: b[2] + b[5] / 2 }));
    for (const a of dots)
      for (const b of dots) {
        if (a === b || Math.abs(a.z - b.z) >= 0.1) continue;
        for (const c of dots) {
          if (c === a || c === b) continue;
          const between = Math.min(a.x, b.x) < c.x && c.x < Math.max(a.x, b.x);
          expect(between && c.z < Math.min(a.z, b.z)).toBe(false);
        }
      }
    const xs = dots.map((d) => d.x).sort((p, q) => p - q);
    expect(xs[1]! - xs[0]!).toBeGreaterThanOrEqual(0.15);
    expect(xs[2]! - xs[1]!).toBeGreaterThanOrEqual(0.15);
  });

  it('Glimmerpünktchen: drei; Sternenkranz: sechs Sterne, bei reduzierter Bewegung still und nur kurz', () => {
    expect(glimmerBoxes(0, 0, 0)).toHaveLength(3);
    const g = { x: 0, y: 0, z: 0 };
    expect(wreathBoxes(g, 0, false)).toHaveLength(12);
    expect(wreathBoxes(g, 100, true)).toEqual(wreathBoxes(g, 700, true));
    expect(wreathBoxes(g, 100, false)).not.toEqual(wreathBoxes(g, 700, false));
    expect(wreathAlpha(G.joy * 0.75, true)).toBe(0);
    expect(wreathAlpha(G.joy * 0.25, true)).toBe(1);
  });

  it('unter dem Geist ein weicher Fleck (`contactShadow`), kein flacher Quader in der Schattenfarbe', () => {
    const fills: string[] = [];
    let gradients = 0;
    const ctx: CanvasRenderingContext2D = anyContext((what) => {
      if (what === 'fillRect') fills.push(ctx.fillStyle as string);
      if (what === 'fill') gradients++;
    });
    const P = projection(0, 0, 0, 0, 1);
    drawGhosts(ctx, P, [{ x: 2.5, y: 3.5, z: 1.2, alpha: 1, joy: null }], false, () => true);
    expect(gradients).toBe(1); // der runde Fleck
    expect(fills).not.toContain(GROTTE_COLORS.shadow);
    expect(GHOST_FOOT).toBeCloseTo(0.17);
    // unsichtbar (alpha 0): kein Fleck, nur Glimmerpünktchen
    gradients = 0;
    drawGhosts(ctx, P, [{ x: 2.5, y: 3.5, z: 1.2, alpha: 0, joy: null }], false, () => true);
    expect(gradients).toBe(0);
  });

  it('GhostFx: Töne warten, bis der Kern sie abholt; Altes verfällt', () => {
    const fx = new GhostFx();
    const h = hs[0]!;
    const s = { player: cellAt(h.x, h.y + 3), lamp: 'hoehle' };
    fx.frame(w, s, 0, true, false);
    fx.frame(w, s, 50, true, false);
    expect(fx.take(60)).toEqual(giggleScore());
    expect(fx.take(70)).toEqual([]);
    const late = new GhostFx();
    late.frame(w, s, 0, true, false);
    late.frame(w, s, 50, true, false);
    expect(late.take(5000)).toEqual([]);
    const shown = fx.frame(w, s, 500, true, false);
    expect(shown[0]!.alpha).toBe(1);
  });
});

describe('Klangstein „lichtgeister“', () => {
  it('steht in der Kristallhalle nah an den Säulen, auf erreichbarem Boden der Grotte (Seeds)', () => {
    const bad: string[] = [];
    for (const seed of seedsFor(seedRange(1, 20))) {
      const world = worldOf(seed, [HOEHLE_PACK]);
      const p = world.stones.get('lichtgeister');
      if (!p) {
        bad.push(`Seed ${seed}: kein Stein`);
        continue;
      }
      const c = world.cell(...p);
      if (c.deco !== 'klangstein' || c.story !== 'lichtgeister')
        bad.push(`Seed ${seed}: kein Klangstein bei ${p.join(',')}`);
      if (world.realm(...p) !== 'hoehle') bad.push(`Seed ${seed}: nicht in der Grotte`);
      const near = Math.min(...hideoutsOf(world).map((h) => Math.hypot(h.x - p[0] - 0.5, h.y - p[1] - 0.5)));
      if (near > 6) bad.push(`Seed ${seed}: ${near.toFixed(1)} Felder von den Säulen`);
      const reach = new Set(reachable(world, [], world.homes.hoehle.wake[0]!).map(([x, y]) => `${x},${y}`));
      const door = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => reach.has(`${p[0] + dx!},${p[1] + dy!}`));
      if (!door) bad.push(`Seed ${seed}: zu Fuß nicht zu erreichen`);
    }
    expect(bad).toEqual([]);
  });
});
