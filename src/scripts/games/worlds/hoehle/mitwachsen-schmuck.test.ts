import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Point } from '../../../../data/games/mitwachsen';
import { CAVE_SPECIES } from '../../../../data/games/mitwachsen-hoehle';
import { DIRS, type Dir, type Projection } from '../../../../lib/games/front';
import { jettyEnd } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { ENCOUNTERS, stops } from '../../input-pace';
import { reshapes } from '../../mitwachsen-chores';
import { initialState, progressOf, step, type GameEvent, type State } from '../../mitwachsen-state';
import type { SkyScene } from '../../mitwachsen-sky';
import { awayIn, packScore } from '../../mitwachsen-view';
import { kesselPlace, type World } from '../../mitwachsen-world';
import { EIS_PACK, HOEHLE_PACK, PACKS, worldOf } from '../../test-worlds';
import { anyContext, fakeDocument } from '../../test-canvas';
import { roostAt } from '../../mitwachsen-roost';
import { columnBoxes } from './mitwachsen-cave-look';
import { PERCH_REACH, sleeperNear } from './mitwachsen-cave-rules';
import { caveWeather, type CaveFx } from './mitwachsen-cave-sky';
import { COLUMN_SCALE, Chime, GLOW_MS, ROUND, TONE, batAt, chirp, columnScore, glowOf } from './mitwachsen-chime-look';
import { DRIP, Drips, dropOf, dropZ, plinkScore } from './mitwachsen-drips';
import { OLM_MS, Olm, blubbScore, olmRise, olmWater } from './mitwachsen-olm-look';
import { fx, view } from './view-2d';
import { view3d } from './view-3d';

/** Grotte um eine Ecke (26) und gerade dahinter (1) */
const SEEDS = [1, 26];
const PENTA = new Set([0, 2, 4, 7, 9]); // C-Dur-Pentatonik in Halbtönen über C
const semis = (f: number) => ((Math.round(12 * Math.log2(f / 261.63)) % 12) + 12) % 12;

/** Felder der Grotte eines Seeds mit Inhalt */
const cellsOf = (seed: number) => {
  const w = worldOf(seed, [HOEHLE_PACK]);
  return kesselPlace(seed, HOEHLE_PACK).cells.map((p) => ({ p, c: w.cell(...p) }));
};

/** Ein Sitzplatz im Kristallbogen eines Seeds */
const perchOf = (seed: number): Point => cellsOf(seed).find(({ c }) => c.perch !== undefined)!.p;

/** Wach, allein, die Figur steht auf (x, y) mit Blick `dir` */
function at(w: World, x: number, y: number, dir: Dir): State {
  return { ...initialState(w), sleeping: false, wokeAt: -1e9, animals: [], player: { x, y, dir } };
}

/** Ein begehbares Nachbarfeld von `p` (gleiche Höhe) und die Richtung von dort hinein */
function besideOf(w: World, p: Point): { at: Point; dir: Dir } {
  for (const [dir, [dx, dy]] of Object.entries(DIRS) as [Dir, readonly [number, number]][]) {
    const c = w.cell(p[0] - dx, p[1] - dy);
    if (c.region === 'hoehle' && !c.solid && c.ground !== 'water' && !c.deco && c.h === w.cell(...p).h)
      return { at: [p[0] - dx, p[1] - dy], dir };
  }
  throw new Error(`kein Nachbarfeld bei ${p.join(',')}`);
}

const walk = (w: World, s: State, dir: Dir, packs = PACKS) =>
  step(s, w, { type: 'move', dir }, undefined, undefined, packs);
const of = <T extends GameEvent['type']>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

describe('Säulen-Glockenspiel (Kristallgrotte): Regel', () => {
  for (const seed of SEEDS) {
    const w = worldOf(seed, [HOEHLE_PACK]);
    const columns = cellsOf(seed).filter(({ c }) => c.deco === 'column');

    it(`Seed ${seed}: jede Säule klingt mit ihrem Ton, die Figur bleibt stehen, ohne anzustoßen und ohne Halt`, () => {
      const heard: string[] = [];
      for (const { p, c } of columns) {
        const from = besideOf(w, p);
        let s = at(w, ...from.at, from.dir);
        for (let i = 0; i < 2; i++) {
          // gehalten klingt sie im Takt der Schritte wieder
          const r = walk(w, s, from.dir);
          s = r.state;
          const rung = of(r.events, 'column');
          if (rung.length !== 1 || rung[0]!.note !== c.note || rung[0]!.x !== p[0] || rung[0]!.y !== p[1])
            heard.push(`${p.join(',')}: ${JSON.stringify(rung)}`);
          if (r.events.some((e) => e.type === 'bump' || e.type === 'step')) heard.push(`${p.join(',')}: Anstoßen`);
          if (stops(r.events) !== null) heard.push(`${p.join(',')}: Halt`);
          if (s.player.x !== from.at[0] || s.player.y !== from.at[1]) heard.push(`${p.join(',')}: gelaufen`);
        }
      }
      expect(heard, `Seed ${seed}`).toEqual([]);
      expect(columns.map(({ c }) => c.note).sort()).toEqual([0, 1, 2, 3, 4]);
    });

    it(`Seed ${seed}: kein Spielstand außer „gefunden“ (Hinführen, Issue 28); ohne die Regeln des Pakets ist eine Säule nur fest`, () => {
      const { p } = columns[0]!;
      const from = besideOf(w, p);
      const s = at(w, ...from.at, from.dir);
      const r = walk(w, s, from.dir);
      expect(r.state.packs).toBe(s.packs);
      expect({ ...progressOf(r.state), position: null }).toEqual({
        ...progressOf(s),
        position: null,
        found: ['hoehle:saeulen'],
      });
      const bare = step(s, w, { type: 'move', dir: from.dir });
      expect(bare.events.map((e) => e.type)).toEqual(['bump']);
    });
  }

  for (const seed of SEEDS)
    it(`Seed ${seed}: die Säule nennt den Sitzplatz einer hängenden Fledermaus in der Nähe; hängt keine, keinen`, () => {
      const w = worldOf(seed, [HOEHLE_PACK]);
      const { p } = cellsOf(seed).find(({ c }) => c.deco === 'column')!;
      const from = besideOf(w, p);
      const alone = at(w, ...from.at, from.dir);
      const fresh = initialState(w);
      const bats = fresh.animals.filter((a) => roostAt(a, w.cell(a.x, a.y)) !== undefined);
      expect(bats.length, `Seed ${seed}`).toBeGreaterThan(0);
      const s = { ...alone, animals: fresh.animals };
      const [rung] = of(walk(w, s, from.dir).events, 'column');
      expect(
        bats.some((a) => a.x === rung?.perch?.[0] && a.y === rung.perch[1]),
        `Seed ${seed}`,
      ).toBe(true);
      expect(Math.max(Math.abs(rung!.perch![0] - p[0]), Math.abs(rung!.perch![1] - p[1]))).toBeLessThanOrEqual(
        PERCH_REACH,
      );
      // gefunden (sie folgt) oder fort: kein Sitzplatz
      const found = { ...alone, animals: fresh.animals.map((a) => ({ ...a, mode: 'follow' as const })) };
      expect(of(walk(w, found, from.dir).events, 'column')[0]!.perch).toBeUndefined();
      expect(of(walk(w, alone, from.dir).events, 'column')[0]!.perch).toBeUndefined();
      expect(sleeperNear({ animals: fresh.animals }, (x, y) => w.cell(x, y), p[0] + 500, p[1])).toBeUndefined();
    });

  it('`column` und `olm` sind keine Begegnung und ändern kein Feld (kein Neubau in 3D)', () => {
    for (const type of ['column', 'olm'] as const) expect(ENCOUNTERS.has(type)).toBe(false);
    expect(reshapes({ type: 'column' })).toBe(false);
    expect(reshapes({ type: 'olm' })).toBe(false);
  });
});

describe('Grottenolm am Steg (Kristallgrotte): Regel', () => {
  for (const seed of SEEDS) {
    const w = worldOf(seed, [HOEHLE_PACK]);
    const jetty = cellsOf(seed).filter(({ c }) => c.deco === 'jetty');

    it(`Seed ${seed}: wer das Ende des Stegs betritt, sieht den Grottenolm auftauchen und läuft weiter; sonst nicht`, () => {
      const bad: string[] = [];
      for (const { p, c } of jetty)
        for (const [dir, [dx, dy]] of Object.entries(DIRS) as [Dir, readonly [number, number]][]) {
          const from = w.cell(p[0] - dx, p[1] - dy);
          if (from.solid || from.ground === 'water' || from.region !== 'hoehle' || from.h !== c.h) continue;
          const r = walk(w, at(w, p[0] - dx, p[1] - dy, dir), dir);
          const olm = of(r.events, 'olm');
          if (r.state.player.x !== p[0] || r.state.player.y !== p[1]) bad.push(`${p.join(',')}: nicht betreten`);
          if (stops(r.events) !== null) bad.push(`${p.join(',')}: Halt`);
          if (jettyEnd(c) && (olm.length !== 1 || olm[0]!.x !== p[0] || olm[0]!.y !== p[1]))
            bad.push(`${p.join(',')}: am Ende kein Grottenolm`);
          if (!jettyEnd(c) && olm.length) bad.push(`${p.join(',')}: Grottenolm mitten auf dem Steg`);
        }
      expect(bad, `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: neben jedem Ende des Stegs ist Wasser, in dem er auftaucht`, () => {
      const ends = jetty.filter(({ c }) => jettyEnd(c));
      for (const { p } of ends) {
        const water = olmWater(w, ...p);
        expect(water, `Seed ${seed} ${p.join(',')}`).not.toBeNull();
        expect(w.cell(...water!).ground).toBe('water');
        expect(Math.max(Math.abs(water![0] - p[0]), Math.abs(water![1] - p[1]))).toBeLessThanOrEqual(2);
      }
    });
  }

  it('geht der Schritt aufs Ende des Stegs nicht, taucht er nicht auf: die Figur stößt nur an', () => {
    const w = worldOf(1, [HOEHLE_PACK]);
    const { p } = cellsOf(1).find(({ c }) => c.deco === 'jetty' && jettyEnd(c))!;
    const [x, y] = p;
    const high = {
      ...w,
      cell: (cx: number, cy: number) => (cx === x && cy === y ? { ...w.cell(cx, cy), h: 4 } : w.cell(cx, cy)),
    };
    const from = besideOf(w, p);
    const r = step(at(w, ...from.at, from.dir), high, { type: 'move', dir: from.dir }, undefined, undefined, PACKS);
    expect(r.events.map((e) => e.type)).toEqual(['bump']);
  });
});

describe('Säulen-Glockenspiel (Kristallgrotte): Bild und Klang', () => {
  it('C5, D5, E5, G5, A5 in der Pentatonik, Sinus 0,4 s, leises Echo nach 0,25 s', () => {
    expect(COLUMN_SCALE.map((f) => Math.round(f))).toEqual([523, 587, 659, 784, 880]);
    for (const f of COLUMN_SCALE) expect(PENTA.has(semis(f))).toBe(true);
    COLUMN_SCALE.forEach((f, note) => {
      const [tone, echo] = columnScore(note);
      expect(tone).toEqual([f, 0.4, 'sine', TONE.gain, 1, 0]);
      expect(echo![0]).toBe(f);
      expect(echo![5]).toBe(0.25);
      expect(echo![3]).toBeLessThan(tone![3]);
    });
    expect(columnScore(99)[0]![0]).toBe(COLUMN_SCALE[4]); // nie außerhalb der Tonleiter
  });

  it('leuchtet 0,5 s heller, dann wieder wie gebaut; in 2D die Säule selbst, der Sockel bleibt Stein', () => {
    expect(glowOf(0)).toBe(1);
    expect(glowOf(GLOW_MS / 2)).toBeCloseTo(0.5);
    expect(glowOf(GLOW_MS)).toBe(0);
    expect(glowOf(-1)).toBe(0);
    const w = worldOf(1, [HOEHLE_PACK]);
    const { p, c } = cellsOf(1).find((e) => e.c.deco === 'column')!;
    const still = columnBoxes(c, ...p);
    const lit = columnBoxes(c, ...p, 1);
    expect(lit.slice(0, 2)).toEqual(still.slice(0, 2)); // Sockel und Platte
    const body = (boxes: ReturnType<typeof columnBoxes>) => boxes.find((b) => b[9]?.halo)!; // die Säule: das erste Teil, das leuchtet
    expect(body(lit)[6]).not.toBe(body(still)[6]);
    const bright = (hex: string) => [1, 3, 5].reduce((a, i) => a + parseInt(hex.slice(i, i + 2), 16), 0);
    expect(bright(body(lit)[6])).toBeGreaterThan(bright(body(still)[6]));
    // über das Paket: sein Ton, ab dann leuchtet die Säule in 2D; in 3D steht sie still (dort leuchtet die Ebene darüber)
    const notes = view.score!({ type: 'column', x: p[0], y: p[1], note: c.note! })!;
    expect(notes[0]![0]).toBe(COLUMN_SCALE[c.note!]);
    const now = performance.now();
    const at = { now, reduced: false, picked: {}, packs: {} };
    expect(view.decos.column!(w, c, ...p, at)).not.toEqual(still);
    expect(view.decos.column!(w, c, ...p, { ...at, now: now + GLOW_MS + 10 })).toEqual(still);
    expect(view3d.decos.column!(w, c, ...p, at)).toEqual(still);
    // die Eis-Welt hat damit nichts zu tun, die Grotte nichts mit Eiszapfen
    expect(EIS_PACK.view!.score!({ type: 'column', x: 0, y: 0, note: 0 })).toBeUndefined();
    expect(view.score!({ type: 'icicle', x: 0, y: 0, note: 0 })).toBeUndefined();
  });

  it('sind beide Welt-Pakete geladen, klingt jedes Ereignis aus dem Paket seiner Welt, in jeder Reihenfolge', () => {
    const ice = EIS_PACK.view!;
    for (const views of [
      [ice, view],
      [view, ice],
    ]) {
      const order = views[0] === ice ? 'Eis zuerst' : 'Grotte zuerst';
      expect(packScore(views, { type: 'column', x: 0, y: 0, note: 2 }), order).toEqual(columnScore(2));
      expect(packScore(views, { type: 'olm', x: 0, y: 0 }), order).toEqual(blubbScore());
      expect(packScore(views, { type: 'icicle', x: 0, y: 0, note: 2 }), order).toEqual(
        ice.score!({ type: 'icicle', x: 0, y: 0, note: 2 }),
      );
      expect(packScore(views, { type: 'icicle', x: 0, y: 0, note: 2 }).length, order).toBeGreaterThan(0);
    }
  });

  it('nach je vier Tönen beliebiger Säulen dreht die hängende Fledermaus eine Runde und zirpt; keine falsche Melodie', () => {
    const w = worldOf(1, [HOEHLE_PACK]);
    const { p } = cellsOf(1).find((e) => e.c.deco === 'column')!;
    const perch = perchOf(1);
    const chime = new Chime();
    const ring = (i: number) => chime.ring(...p, i % 2 ? 4 : 0, i * 300, perch).length > 2;
    expect([0, 1, 2].map(ring)).toEqual([false, false, false]);
    expect(chime.bat(w, 800)).toBeNull(); // noch keine Runde
    expect(chime.away(...perch, 800)).toBe(false);
    expect(ring(3)).toBe(true); // der vierte Ton
    expect(chirp(0.3).map(([f]) => f)).toEqual(CAVE_SPECIES.fledermaus.tone.notes);
    const first = chime.bat(w, 900)!;
    expect(first.x).toBeCloseTo(perch[0] + 0.5);
    expect(first.y).toBeCloseTo(perch[1] + 0.5);
    expect(chime.bat(w, 900 + ROUND.ms - 1)).not.toBeNull();
    expect(chime.bat(w, 900 + ROUND.ms)).toBeNull();
    expect([4, 5, 6, 7].map(ring)).toEqual([false, false, false, true]); // der achte Ton: die nächste Runde
  });

  it('solange sie fliegt, ist ihr Sitzplatz leer, danach hängt sie wieder dort; nur dieser Platz', () => {
    const perch = perchOf(1);
    const chime = new Chime();
    for (let i = 0; i < ROUND.every; i++) chime.ring(0, 0, 0, 1000, perch);
    expect(chime.away(...perch, 1000)).toBe(true);
    expect(chime.away(...perch, 1000 + ROUND.ms - 1)).toBe(true);
    expect(chime.away(perch[0] + 1, perch[1], 1000)).toBe(false); // die anderen hängen weiter
    expect(chime.away(...perch, 1000 + ROUND.ms)).toBe(false); // wieder an ihrem Platz
    expect(chime.away(...perch, 999)).toBe(false);
    // über das Paket: die Ansichten fragen alle geladenen Pakete (`awayIn`), die Eis-Welt kennt keine Runde
    const now = performance.now();
    for (let i = 0; i < ROUND.every; i++) view.score!({ type: 'column', x: 0, y: 0, note: 0, perch });
    expect(awayIn([EIS_PACK.view!, view], ...perch, now + 10)).toBe(true);
    expect(awayIn([EIS_PACK.view!, view], ...perch, now + ROUND.ms + 1000)).toBe(false);
    expect(awayIn([EIS_PACK.view!], ...perch, now + 10)).toBe(false);
  });

  it('hängt keine Fledermaus, fliegt und zirpt nach dem vierten Ton keine', () => {
    const w = worldOf(1, [HOEHLE_PACK]);
    const chime = new Chime();
    const heard = Array.from({ length: ROUND.every }, (_, i) => chime.ring(0, 0, 0, i * 300).length);
    expect(heard).toEqual([2, 2, 2, 2]); // nur Ton und Echo
    expect(chime.bat(w, 1000)).toBeNull();
  });

  it('die Runde beginnt und endet an ihrem Sitzplatz unter dem Bogen, bleibt nah und darüber', () => {
    const w = worldOf(1, [HOEHLE_PACK]);
    const perch = perchOf(1);
    const c = w.cell(...perch);
    expect(c.deco).toBe('crystalarch');
    const from = { x: perch[0] + 0.5, y: perch[1] + 0.5, z: c.h + c.perch! };
    const path = Array.from({ length: 49 }, (_, i) => batAt((i / 48) * (ROUND.ms - 1), from)!);
    expect(Math.hypot(path[0]!.x - from.x, path[0]!.y - from.y)).toBeLessThan(0.01);
    expect(Math.hypot(path[48]!.x - from.x, path[48]!.y - from.y)).toBeLessThan(0.02);
    expect(path.every((b) => b.z >= from.z && Math.hypot(b.x - from.x, b.y - from.y) <= 2 * ROUND.r + 1e-9)).toBe(true);
    // die Runde geht nach Süden, zu den Säulen hin: Sie stehen vor dem Bogen (Bühne der Halle, in jeder Lage der Grotte)
    expect(path[24]!.y).toBeGreaterThan(from.y + ROUND.r);
    for (const seed of SEEDS) {
      const cells = cellsOf(seed);
      const column = cells.find((e) => e.c.deco === 'column')!;
      expect(column.p[1], `Seed ${seed}`).toBeGreaterThan(perchOf(seed)[1]);
    }
    expect(batAt(-1, from)).toBeNull();
    expect(batAt(ROUND.ms, from)).toBeNull();
  });
});

describe('Grottenolm am Steg (Kristallgrotte): Bild und Klang', () => {
  it('„blubb“: sein Ton aus der Art (C4, gleitet nach unten), dazu ein Bläschen', () => {
    const [blubb, bubble] = blubbScore();
    const tone = CAVE_SPECIES.grottenolm.tone;
    expect(blubb!.slice(0, 5)).toEqual([tone.notes[0], tone.len, tone.wave, tone.gain, tone.slide]);
    expect(bubble![3]).toBeLessThan(blubb![3]);
    expect(view.score!({ type: 'olm', x: 0, y: 0 })).toEqual(blubbScore());
  });

  it('hebt sich aus dem Wasser und taucht wieder ab; bei reduzierter Bewegung still an der Oberfläche', () => {
    const rise = [0, OLM_MS / 2, OLM_MS - 1].map((ms) => olmRise(ms, false)!);
    expect(rise[1]).toBeGreaterThan(rise[0]!);
    expect(rise[1]).toBeGreaterThan(rise[2]!);
    expect(Math.max(...rise)).toBeLessThan(0.05); // der Bauch bleibt im Wasser
    expect(olmRise(0, true)).toBe(olmRise(OLM_MS / 2, true));
    expect(olmRise(OLM_MS, false)).toBeNull();
    expect(olmRise(-1, true)).toBeNull();
    const w = worldOf(1, [HOEHLE_PACK]);
    const { p } = cellsOf(1).find(({ c }) => c.deco === 'jetty' && jettyEnd(c))!;
    const olm = new Olm();
    expect(olm.now(w, 0, false)).toBeNull();
    olm.surface(...p, 1000);
    const seen = olm.now(w, 1100, false)!;
    expect([seen.x, seen.y]).toEqual(olmWater(w, ...p));
    expect(olm.now(w, 1000 + OLM_MS, false)).toBeNull();
  });
});

describe('Tropfsteine (Kristallgrotte)', () => {
  const all_ = () => true; // alles erkundet
  const w = worldOf(1, [HOEHLE_PACK]);
  const all = cellsOf(1);
  const spring = all.find(({ c }) => c.deco === 'dripspring')!.p;
  const far = all.find(
    ({ p, c }) =>
      c.deco === 'stalagmite' &&
      Math.max(Math.abs(p[0] - spring[0]), Math.abs(p[1] - spring[1])) > DRIP.far + 2 &&
      all.some((e) => e.c.deco === 'stalagmite' && e.p !== p),
  )!.p;

  it('an der Tropfquelle fällt alle 2 s ein Tropfen ins Becken, mit leisem „plink“', () => {
    const [sx, sy] = spring;
    for (const slot of [0, 1, 2]) {
      const drop = dropOf(w, sx + 2, sy + 1, slot)!;
      expect(drop).toMatchObject({ x: sx, y: sy, spring: true });
      expect(drop.to).toBeLessThan(w.cell(sx, sy).h);
    }
    const [plink] = plinkScore(true);
    expect(plink![2]).toBe('sine');
    expect(plink![3]).toBeLessThanOrEqual(0.04);
    expect(plink![5]).toBe(DRIP.fall / 1000); // wenn er ankommt
    expect(plinkScore(false)[0]![3]).toBeLessThan(plink![3]);
  });

  it('fern der Quelle fällt er auf einen Stalagmiten in der Nähe; draußen nirgends', () => {
    const drop = dropOf(w, ...far, 3)!;
    expect(drop.spring).toBe(false);
    expect(w.cell(drop.x, drop.y).deco).toBe('stalagmite');
    expect(Math.max(Math.abs(drop.x - far[0]), Math.abs(drop.y - far[1]))).toBeLessThanOrEqual(DRIP.near);
    expect(drop.from).toBeGreaterThan(drop.to);
    const [bx, by] = w.homes.lichtung.bed;
    expect(dropOf(w, bx, by, 3)).toBeNull();
  });

  it('weiter weg (bis 16 Felder) glitzert der Tropfen der Quelle in jedem zweiten Fenster, ohne „plink“; ohne Stalagmit in jedem', () => {
    const [sx, sy] = spring;
    const at: [number, number] = [sx + DRIP.near + 3, sy];
    const odd = dropOf(w, ...at, 1)!;
    expect(odd).toMatchObject({ x: sx, y: sy, spring: true, far: true });
    // gerades Fenster: mit Stalagmit in der Nähe fällt der Tropfen dort, ohne wieder an der Quelle
    let tipNear = false;
    for (let dy = -DRIP.near; dy <= DRIP.near; dy++)
      for (let dx = -DRIP.near; dx <= DRIP.near; dx++)
        if (w.cell(at[0] + dx, at[1] + dy).deco === 'stalagmite' && w.cell(at[0] + dx, at[1] + dy).region === 'hoehle')
          tipNear = true;
    const even = dropOf(w, ...at, 2)!;
    if (tipNear) expect(w.cell(even.x, even.y).deco).toBe('stalagmite');
    else expect(even).toMatchObject({ x: sx, y: sy, far: true });
    // beide Fälle sicher in einer kleinen Grotte: Quelle 10 Felder weit, mit und ohne Stalagmit 3 Felder weit
    const tiny = (stalagmite: boolean) =>
      ({
        cell: (x: number, y: number) => ({
          h: 1,
          ground: 'grotto',
          region: 'hoehle',
          note: 0,
          deco: y !== 0 ? undefined : x === 10 ? 'dripspring' : x === 3 && stalagmite ? 'stalagmite' : undefined,
        }),
      }) as unknown as World;
    for (let slot = 0; slot < 8; slot++) {
      expect(dropOf(tiny(false), 0, 0, slot), `ohne Stalagmit, Fenster ${slot}`).toMatchObject({ x: 10, far: true });
      expect(dropOf(tiny(true), 0, 0, slot), `mit Stalagmit, Fenster ${slot}`).toMatchObject(
        slot % 2 ? { x: 10, far: true } : { x: 3, spring: false },
      );
    }
    // nur Stalagmiten-Tropfen erkundet: kein Glitzern
    expect(dropOf(w, ...at, 1, (x, y) => !(x === sx && y === sy))?.spring).not.toBe(true);
    // jenseits von 16 Feldern nichts von der Quelle
    expect(dropOf(w, sx + DRIP.far + 1, sy, 1)?.spring).not.toBe(true);
    // ohne Ton: das Fenster mit dem Glitzern ist still, der Tropfen fällt (und wird gezeichnet)
    const drips = new Drips();
    const state = { player: { x: at[0], y: at[1] } };
    expect(drips.tick(w, state, DRIP.every + 1, all_)).toEqual([]);
    expect(drips.falling(DRIP.every + 10)).toMatchObject({ far: true, spring: true });
  });

  it('höchstens ein Tropfen je 2 s im Bild: je Zeitfenster einmal „plink“, außerhalb der Grotte keins', () => {
    const drips = new Drips();
    const state = { player: { x: spring[0] + 1, y: spring[1] + 2 } };
    const heard = Array.from({ length: 60 }, (_, i) => drips.tick(w, state, i * 100, all_).length);
    expect(heard.reduce((a, b) => a + b, 0)).toBe(3); // 6 s, drei Fenster
    expect(heard.filter((n, i) => n && i % (DRIP.every / 100) !== 0)).toEqual([]);
    const out = new Drips();
    const [bx, by] = w.homes.lichtung.bed;
    expect(out.tick(w, { player: { x: bx, y: by } }, 0, all_)).toEqual([]);
    expect(out.falling(10)).toBeNull();
  });

  it('im Nebel tropft nichts: weder Tropfen noch „plink“ an unerkundeten Feldern', () => {
    const [sx, sy] = spring;
    const hidden = (x: number, y: number) => !(x === sx && y === sy);
    expect(dropOf(w, sx + 2, sy + 1, 0, hidden)?.spring).not.toBe(true);
    expect(dropOf(w, ...far, 3, () => false)).toBeNull();
    const drop = dropOf(w, ...far, 3)!;
    const without = (x: number, y: number) => !(x === drop.x && y === drop.y);
    for (let slot = 0; slot < 20; slot++) {
      const d = dropOf(w, ...far, slot, without);
      if (d && d.x === drop.x && d.y === drop.y) throw new Error(`Slot ${slot}: Tropfen im Nebel`);
    }
    const drips = new Drips();
    expect(drips.tick(w, { player: { x: sx + 1, y: sy + 2 } }, 0, () => false)).toEqual([]);
    expect(drips.falling(10)).toBeNull();
  });

  it('der Tropfen fällt schneller werdend und ist nach 0,45 s angekommen', () => {
    const drop = dropOf(w, ...spring, 0)!;
    const zs = [0, 100, 200, 300, 400].map((ms) => dropZ(drop, ms)!);
    expect(zs[0]).toBe(drop.from);
    expect(zs.every((z, i) => i === 0 || z < zs[i - 1]!)).toBe(true);
    expect(zs[1]! - zs[2]!).toBeGreaterThan(zs[0]! - zs[1]!);
    expect(dropZ(drop, DRIP.fall)).toBeNull();
    // das Paket fragt je Bild (`ambient`)
    const near = { player: { x: spring[0] + 1, y: spring[1] + 2 } } as State;
    const first = view.ambient!(w, near, 1e9 + 1, all_); // ein neues Fenster: „plink“
    expect(first).toEqual(plinkScore(true));
    expect(view.ambient!(w, near, 1e9 + 2, all_)).toEqual([]); // dasselbe Fenster: nichts
    expect(fx.drips).toBeInstanceOf(Drips);
  });
});

describe('Luft der Grotte (2D und Ebene über 3D)', () => {
  /** Zeichenfläche, die nur zählt, wie oft gemalt wird (Flächen und Bilder: Modelle kommen fein aus dem Bild-Cache) */
  const canvas = () => {
    let n = 0;
    const ctx = anyContext(() => void n++);
    return { ctx, painted: () => n };
  };
  let restore = () => {};
  beforeAll(() => void (restore = fakeDocument()));
  afterAll(() => restore());
  const P: Projection = (x, y, z) => [x * 10, (y - z) * 10];
  const scene = (now: number, reduced: boolean, lit3d = false) =>
    ({ now, reduced, lit3d, explored: () => true, zoom: 1 }) as unknown as SkyScene;
  const w = worldOf(1, [HOEHLE_PACK]);
  const all = cellsOf(1);
  const spring = all.find(({ c }) => c.deco === 'dripspring')!.p;
  const column = all.find(({ c }) => c.deco === 'column')!;
  const end = all.find(({ c }) => c.deco === 'jetty' && jettyEnd(c))!.p;

  it('bei reduzierter Bewegung kein Tropfen und keine Flugrunde, der Grottenolm zeigt sich still', () => {
    const fresh = (): CaveFx => ({ chime: new Chime(), drips: new Drips(), olm: new Olm(), light: {} });
    const drip = fresh();
    drip.drips.tick(w, { player: { x: spring[0], y: spring[1] + 2 } }, 0, () => true);
    const bat = fresh();
    for (let i = 0; i < ROUND.every; i++) bat.chime.ring(...column.p, 0, 0, perchOf(1));
    const olm = fresh();
    olm.olm.surface(...end, 0);
    for (const [name, f, still] of [
      ['Tropfen', drip, 0],
      ['Fledermaus', bat, 0],
      ['Grottenolm', olm, 1],
    ] as const) {
      const moving = canvas();
      caveWeather(f)(moving.ctx, w, scene(100, false), P);
      const calm = canvas();
      caveWeather(f)(calm.ctx, w, scene(100, true), P);
      expect(moving.painted(), name).toBeGreaterThan(0);
      expect(calm.painted() > 0, name).toBe(still === 1);
    }
  });

  it('in 3D leuchtet eine klingende Säule auf der Ebene darüber, in 2D nicht (dort die Säule selbst)', () => {
    const f: CaveFx = { chime: new Chime(), drips: new Drips(), olm: new Olm(), light: {} };
    f.chime.ring(...column.p, column.c.note!, 0);
    const flat = canvas();
    caveWeather(f)(flat.ctx, w, scene(100, false), P);
    const deep = canvas();
    caveWeather(f)(deep.ctx, w, scene(100, false, true), P);
    expect(flat.painted()).toBe(0);
    expect(deep.painted()).toBeGreaterThan(0);
    const later = canvas();
    caveWeather(f)(later.ctx, w, scene(GLOW_MS, false, true), P);
    expect(later.painted()).toBe(0);
  });

  it('im Nebel zeigt sich nichts', () => {
    const f: CaveFx = { chime: new Chime(), drips: new Drips(), olm: new Olm(), light: {} };
    f.olm.surface(...end, 0);
    const c = canvas();
    caveWeather(f)(c.ctx, w, { ...scene(100, false), explored: () => false }, P);
    expect(c.painted()).toBe(0);
  });
});
