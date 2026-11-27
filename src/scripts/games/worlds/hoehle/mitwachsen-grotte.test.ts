import { describe, expect, it } from 'vitest';
import { MOOD_LIGHT, REGIONS, animalId, type Point } from '../../../../data/games/mitwachsen';
import { FIRST_MOLE } from '../../../../data/games/mitwachsen-hoehle';
import { CAVE_STONE, told } from '../../../../data/games/mitwachsen-stories';
import {
  CAVE_PLACES,
  GROTTE,
  GROTTE_COLORS,
  JETTY_EAST,
  jettyEnd,
} from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { DIRS, type Dir } from '../../../../lib/games/front';
import { platformsToWake } from '../../mitwachsen-portal';
import { initialState, step, type State } from '../../mitwachsen-state';
import { caveBoxes, patchOf } from './mitwachsen-cave-look';
import { roundCentre } from './mitwachsen-dusk-look';
import { DUSK_DAY, DUSK_SKY, dayOf, nightIn, nightMix, sunLevel, type Rgb } from '../../mitwachsen-dusk';
import { beyondRing, canStep, kesselPlace, type World } from '../../mitwachsen-world';
import { HOEHLE_PACK, PACKS, REGRESSION_SEEDS, SAMPLE_SEEDS, seedRange, seedsFor, worldOf } from '../../test-worlds';
import { GROTTE_ROOM, bedSpots, fromMouth, shedAt, shedStoneAt, stationAt } from './mitwachsen-grotte';
import { SIDES, corridorAt, crystalOf, fillZone, tipOf, veinOf, type FillZone } from './mitwachsen-fill';
import type { Site } from './mitwachsen-site';
import { webs as websOfWorld } from './mitwachsen-spider';
import { clayOf, laneSide } from './mitwachsen-lane';
import type { Cell } from '../../mitwachsen-cell';

const CAVE = [HOEHLE_PACK];
/** Seeds, deren Grotte um eine Ecke liegt (die Eis-Welt liegt gerade dahinter im Weg) */
const TURNED = [26, 30];
/** Eigenschafts-Tests, die ganze Welten bauen: wenige Seeds, im tiefen Lauf 20 */
const SEEDS = seedsFor(seedRange(1, 20), [...SAMPLE_SEEDS, ...TURNED]);

type Placed = { bed: Point; cells: readonly Point[]; site: Site };
const placeOf = (seed: number) => kesselPlace(seed, HOEHLE_PACK) as Placed;
const key = ([x, y]: readonly [number, number]) => `${x},${y}`;

/** Ein erreichbares Nachbarfeld von `p` und die Richtung von dort hinein (null: keins) */
function beside(steps: ReadonlyMap<string, number>, p: Point): { at: Point; dir: Dir } | null {
  for (const [dir, [dx, dy]] of Object.entries(DIRS) as [Dir, readonly [number, number]][]) {
    const at: Point = [p[0] - dx, p[1] - dy];
    if (steps.has(key(at))) return { at, dir };
  }
  return null;
}

/**
 * Die Figur steht neben `p` (allein, wach, mit `hands`) und läuft hinein: Ereignisse und neuer Zustand; `packs`: mit den
 * Regeln des Höhlen-Pakets (Schmuck der Grotte). Nur dieses, wie die Welt (`CAVE`): Mit der Eis-Welt und der Fahr-Engine
 * zusammen (`PACKS`) kostet der erste Schritt je Welt gut 50 ms, im tiefen Lauf über 20 Seeds spürbar
 */
function walkInto(w: World, steps: ReadonlyMap<string, number>, p: Point, hands: Partial<State> = {}, packs = false) {
  const from = beside(steps, p);
  if (!from) return null;
  const s: State = {
    ...initialState(w),
    sleeping: false,
    wokeAt: -1e9,
    animals: [],
    ...hands,
    player: { x: from.at[0], y: from.at[1], dir: from.dir },
  };
  const r = packs
    ? step(s, w, { type: 'move', dir: from.dir }, undefined, undefined, CAVE)
    : step(s, w, { type: 'move', dir: from.dir });
  return { events: r.events, state: r.state };
}

type Placed1 = { p: Point; c: Cell };

/**
 * Was an den Pilzbeeten nicht stimmt: Platz (vier im Pilzgarten, zwei etwa 12 Felder vom Bett), Boden, Licht,
 * erreichbar, Sammeln, Farben (ein Büschel aus fünf Pilzen in einer Farbe, leer nur Stümpfe), Abstand
 */
function bedProblems(w: World, site: Site, steps: ReadonlyMap<string, number>, all: readonly Placed1[]): string[] {
  const bad: string[] = [];
  const beds = all.filter(({ c }) => c.deco === 'shroombed');
  const want = [
    ...bedSpots().map(([du, dv]) => key(site.at(...fromMouth([GROTTE.garden.across + du, GROTTE.garden.out + dv])))),
    ...GROTTE.nearBeds.at.map((p) => key(site.at(...fromMouth(p)))),
  ];
  const bed = site.at(...fromMouth([0, GROTTE.bed]));
  const near = beds.filter(({ p }) => Math.hypot(p[0] - bed[0], p[1] - bed[1]) <= 13);
  if (near.length !== 2) bad.push(`${near.length} Beete etwa 12 Felder vom Bett`);
  if (
    beds
      .map(({ p }) => key(p))
      .sort()
      .join() !== [...want].sort().join()
  )
    bad.push('Beete nicht an ihren Plätzen');
  const colors = [...GROTTE_COLORS.shrooms] as string[];
  // je Beet fünf Leuchtpilze in einer der drei Farben; abgeerntet keiner mehr
  const caps = ({ p, c }: Placed1, full: boolean) =>
    caveBoxes(w, c, ...p, full)!.flatMap((b) => (colors.includes(b[6]) ? [b[6]] : []));
  for (const bed of beds) {
    const { p, c } = bed;
    if (c.ground !== 'grass' || !c.solid || c.h !== 1) bad.push(`${key(p)}: Beet nicht fest auf Moos`);
    if ((c.light ?? 0) < GROTTE.glow) bad.push(`${key(p)}: Beet leuchtet nicht`);
    const r = walkInto(w, steps, p);
    if (r?.events[0]?.type !== 'gather' || !r.state.shrooms) bad.push(`${key(p)}: nicht erreichbar oder sammelt nicht`);
    const full = caps(bed, true);
    if (full.length !== 5 || new Set(full).size !== 1) bad.push(`${key(p)}: Farben`);
    if (caps(bed, false).length) bad.push(`${key(p)}: abgeerntet noch Pilze`);
  }
  // je Beet freies Moos ringsum (einzeln wie Busch und Fischkiste)
  const cheb = (a: Point, b: Point) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
  if (beds.some((a) => beds.some((b) => a !== b && cheb(a.p, b.p) <= 2))) bad.push('Beete zu dicht');
  return bad;
}

/** Was an Tropfquelle, Tropfmoos und Wasser nicht stimmt: eine Quelle am Becken, die Kanne füllt sich, Moos begehbar */
function dripProblems(w: World, site: Site, steps: ReadonlyMap<string, number>, all: readonly Placed1[]): string[] {
  const bad: string[] = [];
  const springs = all.filter(({ c }) => c.deco === 'dripspring');
  if (springs.length !== 1) bad.push(`${springs.length} Tropfquellen`);
  for (const { p } of springs) {
    const r = walkInto(w, steps, p);
    if (r?.events[0]?.type !== 'fill' || !r.state.bucket) bad.push('an der Tropfquelle füllt sich die Kanne nicht');
    const basin = Object.values(DIRS).filter(([dx, dy]) => w.cell(p[0] + dx, p[1] + dy).ground === 'water');
    if (basin.length !== 1) bad.push('Tropfquelle nicht am Becken');
  }
  const moss = all.filter(({ c }) => c.deco === 'dripmoss');
  if (moss.length < 6) bad.push(`nur ${moss.length} Felder Tropfmoos`);
  for (const { p, c } of moss) if (c.solid || !steps.has(key(p))) bad.push(`${key(p)}: Tropfmoos nicht begehbar`);
  return [...bad, ...scoopProblems(w, site, steps, all)];
}

/** Wo man schöpft: im Felsbecken von vorn (die vordere Reihe des Rands erreichbar) und am See, beides für sich */
function scoopProblems(w: World, site: Site, steps: ReadonlyMap<string, number>, all: readonly Placed1[]): string[] {
  const bad: string[] = [];
  // im Felsbecken schöpft man von vorn: die vordere Reihe des Rands (dv = −2) ist erreichbar, das Wasser dahinter füllt
  const { drip, lake } = GROTTE;
  const inBasin = (du: number, dv: number) => site.at(...fromMouth([drip.across + drip.basin + du, drip.out + dv]));
  for (const du of [-1, 0, 1])
    if (!steps.has(key(inBasin(du, -2)))) bad.push(`Rand vorn am Becken (${du}) unerreichbar`);
  const basin = inBasin(0, -1);
  const scoop = w.cell(...basin).ground === 'water' ? walkInto(w, steps, basin) : null;
  if (scoop?.events[0]?.type !== 'fill') bad.push('im Felsbecken füllt sich die Kanne nicht');
  // und am See
  const inLake = ({ p, c }: Placed1) => {
    const [u, v] = mouthOf(site, p);
    return c.ground === 'water' && ((u - lake.across) / lake.rx) ** 2 + ((v - lake.out) / lake.ry) ** 2 < 1;
  };
  const shore = all.find((q) => inLake(q) && beside(steps, q.p));
  const fill = shore && walkInto(w, steps, shore.p);
  if (fill?.events[0]?.type !== 'fill') bad.push('am See füllt sich die Kanne nicht');
  return bad;
}

/** Ein Feld der Grotte samt (u, v) von der Mitte und Lage von der Mündung aus */
type Spot = { p: Point; c: Cell; uv: Point; m: Point };
const decoOf = (all: readonly Spot[], deco: Cell['deco']) =>
  all.filter(({ c }) => c.region === 'hoehle' && c.deco === deco);

/** Fülle: genug von allem, flach und begehbar, nie auf Wegen, Mitte, Gleisspur, Bahnhof, Lokschuppen oder am Bett */
function adornProblems(w: World, steps: ReadonlyMap<string, number>, all: readonly Spot[]): string[] {
  const bad: string[] = [];
  const [fields, veins, moss] = [decoOf(all, 'crystalfield'), decoOf(all, 'vein'), decoOf(all, 'glowmoss')];
  const centres = fields.filter(({ c }) => c.note === 1);
  if (centres.length < 15) bad.push(`nur ${centres.length} Kristallfelder`);
  if (veins.length < 50) bad.push(`nur ${veins.length} Felder Adern`);
  const onWall = moss.filter(({ c }) => c.note !== undefined);
  if (onWall.length < 20) bad.push(`nur ${onWall.length} Leuchtmoos an Wänden`);
  if (moss.length - onWall.length < 2) bad.push('kein Leuchtmoos unter den Schächten');
  for (const { p, c, uv, m } of [...fields, ...veins, ...moss]) {
    const at = `${c.deco} ${key(p)}`;
    if (c.solid || !steps.has(key(p))) bad.push(`${at}: nicht begehbar`);
    if (Math.abs(uv[0]) <= 3 || corridorAt(...uv) || c.stop || c.shed || c.stone || c.garden) bad.push(`${at}: frei`);
    if (Math.hypot(m[0], m[1] - GROTTE.bed) <= GROTTE.flat + 3) bad.push(`${at}: am Bett`);
  }
  // Kristallfelder: jedes aus 3 bis 6 Feldern um seine Mitte in einer Farbe, kein Splitter ohne Mitte daneben
  for (const { p, c } of centres) {
    const own = AROUND.filter(([dx, dy]) => {
      const n = w.cell(p[0] + dx, p[1] + dy);
      return n.deco === 'crystalfield' && n.note === 0 && n.color === c.color;
    });
    if (own.length < 2) bad.push(`Kristallfeld ${key(p)}: nur ${own.length + 1} Felder`);
  }
  for (const { p } of fields)
    if (![[0, 0] as const, ...AROUND].some(([dx, dy]) => w.cell(p[0] + dx, p[1] + dy).note === 1))
      bad.push(`Kristallfeld ${key(p)}: ohne Mitte`);
  return bad;
}

/**
 * Farben der Fülle: Kristallfelder und -büsche in der Farbe ihrer Zone, nie Türkis (Wasser), Adern nur Rosa oder Lila;
 * `side` die Seite der Schleife der Grubenbahn (der Lehmhang liegt ihr gegenüber)
 */
function colorProblems(side: 1 | -1, all: readonly Spot[]): string[] {
  const bad: string[] = [];
  const water = GROTTE_COLORS.crystals[1];
  for (const { p, c, uv } of decoOf(all, 'crystalfield')) {
    if (c.note === 1 && c.color !== crystalOf(...uv, side)) bad.push(`Kristallfeld ${key(p)}: Farbe`);
    if (c.color === water) bad.push(`Kristallfeld ${key(p)}: türkis wie Wasser`);
  }
  for (const { p, c } of decoOf(all, 'crystalbush'))
    if (c.color === water) bad.push(`Kristallbusch ${key(p)}: türkis wie Wasser`);
  for (const { p, uv, c } of decoOf(all, 'crystalbush'))
    if (c.color !== crystalOf(...uv, side)) bad.push(`Kristallbusch ${key(p)}: nicht in der Farbe seiner Zone`);
  // Adern: je Ader die Farbe der Zone, in der sie beginnt (fast immer die des Felds selbst)
  const veins = decoOf(all, 'vein');
  const tones: unknown[] = [...GROTTE_COLORS.veins];
  for (const { p, c } of veins) if (!tones.includes(c.color)) bad.push(`Ader ${key(p)}: Farbe ${c.color}`);
  const own = veins.filter(({ c, uv }) => c.color === veinOf(...uv, side)).length / veins.length;
  if (own < 0.9) bad.push(`Adern nur zu ${own.toFixed(2)} in der Farbe ihrer Zone`);
  if (new Set(veins.map(({ c }) => c.color)).size !== 2) bad.push('Adern nicht in beiden Farben');
  return bad;
}

/** Leuchtmoos an der Wand: auf seiner Seite (`note`) steht eine Felsklippe; ohne Wand nur unter den Schächten auf Moos */
function mossProblems(w: World, all: readonly Spot[]): string[] {
  const bad: string[] = [];
  const underShaft = (m: Point) =>
    GROTTE.shafts.some(([a, o]) => Math.hypot(m[0] - a, m[1] - o) <= GROTTE.fill.shade.r);
  for (const { p, c, m } of decoOf(all, 'glowmoss')) {
    const side = c.note === undefined ? undefined : SIDES[c.note];
    if (!side) {
      if (c.ground !== 'grass' || !underShaft(m)) bad.push(`Leuchtmoos ${key(p)}: nicht unter einem Schacht`);
      continue;
    }
    const n = w.cell(p[0] + side[0], p[1] + side[1]);
    if (!n.solid || n.deco !== 'rock') bad.push(`Leuchtmoos ${key(p)}: keine Wand`);
  }
  return bad;
}

/**
 * Was an den Netzen der Tupfspinnen nicht stimmt (Schritt 12 der Rückmeldung): drei bis vier, fest, im Licht und nie im
 * Randschatten, mindestens 8 Felder von Bett, Bahnhof Fledermaus und dem Weg durch die Mitte, weit auseinander, ein
 * erreichbares Nachbarfeld; hineinlaufen: Ereignis `web`, die Figur bleibt stehen, kein „boing“
 */
function webProblems(w: World, site: Site, steps: ReadonlyMap<string, number>, cells: readonly Point[]): string[] {
  const W = GROTTE.web;
  const webs = cells.filter((p) => w.cell(...p).deco === 'web');
  const bad: string[] = webs.length < W.least || webs.length > W.most ? [`${webs.length} Netze`] : [];
  // Spinne, Perlenglanz und Lichtloch hängen an webs(); es muss genau die Netze der Welt finden
  const sorted = [...webs].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (websOfWorld(w).map(key).join(' ') !== sorted.map(key).join(' ')) bad.push('webs() ≠ Netze der Welt');
  const station = cells.filter((p) => stationAt(...site.uv(...p))).map((p) => site.uv(...p));
  const bed = site.uv(...w.homes.hoehle.bed);
  for (const p of webs) {
    const c = w.cell(...p);
    const [u, v] = site.uv(...p);
    if (!c.solid || c.region !== 'hoehle' || c.ground !== 'grotto') bad.push(`${key(p)}: kein festes Ding der Grotte`);
    if (!((c.light ?? 0) > 0) || c.dim) bad.push(`${key(p)}: nicht im Licht`);
    if (Math.hypot(u - bed[0], v - bed[1]) < W.away) bad.push(`${key(p)}: nah am Bett`);
    if (station.some(([a, b]) => Math.hypot(u - a, v - b) < W.away)) bad.push(`${key(p)}: nah am Bahnhof`);
    if (Math.abs(u) - 3 < W.away) bad.push(`${key(p)}: nah am Weg durch die Mitte`);
    if (webs.some((q) => q !== p && Math.hypot(q[0] - p[0], q[1] - p[1]) < W.apart)) bad.push(`${key(p)}: zu nah`);
    const r = walkInto(w, steps, p, {}, true);
    if (!r) bad.push(`${key(p)}: kein erreichbares Nachbarfeld`);
    else if (r.events.some((e) => e.type === 'bump') || !r.events.some((e) => e.type === 'web'))
      bad.push(`${key(p)}: ${r.events.map((e) => e.type).join(',')} statt Harfe`);
    else if (key([r.state.player.x, r.state.player.y]) === key(p)) bad.push(`${key(p)}: Figur im Netz`);
  }
  return bad;
}

/**
 * Was an der Schleife der Grubenbahn nicht stimmt (Schritt 14 der Rückmeldung, vor dem Graben): ein geschlossenes Gleis in
 * Reihe (je Schritt ein Feld, nie schräg) mit dem Halt am Anfang, etwa 145 bis 170 Felder; der Gang ein Stück am Stück,
 * das `open` Felder vor dem Halt endet, samt Nachbarn fester Fels; offenes Gleis, Zaun und Bahnsteig frei, eben und
 * erreichbar; nichts davon berührt Weg, Bett, Wiese, Hauptgleis, Bahnsteig, Lokschuppen, Klangstein oder Portal; der
 * Gang liegt nie auf der Seite zur Kamera (`laneSouthProblems`); nach dem Graben (Gang und Nachbarn frei, Zaun, Tore und
 * die Pfosten neben ihnen fest) kommt man zu Fuß nicht hinein
 */
function laneProblems(w: World, site: Site, steps: ReadonlyMap<string, number>, all: readonly Spot[]): string[] {
  const lane = all.filter(({ c }) => c.lane);
  const track = lane.filter(({ c }) => c.lane!.at !== undefined).sort((a, b) => a.c.lane!.at! - b.c.lane!.at!);
  const L: LaneOf = {
    lane,
    track,
    part: (name) => lane.filter(({ c }) => c.lane!.part === name),
    platform: all.filter(({ c }) => c.stop === 'grube'),
    gang: track.flatMap(({ c }, i) => (c.lane!.part === 'gang' ? [i] : [])),
  };
  return [
    ...trackProblems(L),
    ...laneGroundProblems(L, steps),
    ...laneTouchProblems(w, site, L),
    ...laneSouthProblems(site, L),
    ...laneClosedProblems(L, steps),
  ];
}

/** Die Felder der Schleife einer Welt: alle, das Gleis in Reihe, je Teil, Bahnsteig, Plätze des Gangs im Gleis */
type LaneOf = {
  lane: Spot[];
  track: Spot[];
  part: (name: NonNullable<Cell['lane']>['part']) => Spot[];
  platform: Spot[];
  gang: number[];
};

/** Gleis geschlossen in Reihe, je Schritt ein Feld, Halt am Anfang, der Gang am Stück und `open` Felder vor dem Halt zu Ende */
function trackProblems({ lane, track, gang }: LaneOf): string[] {
  const bad: string[] = [];
  const { stop, open: before } = GROTTE.grube;
  const n = track.length;
  if (n < 140 || n > 170) bad.push(`${n} Felder Gleis`);
  if (track.some(({ c }, i) => c.lane!.at !== i)) bad.push('Plätze in der Runde nicht lückenlos');
  track.forEach(({ p }, i) => {
    const q = track[(i + 1) % n]!.p;
    if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) !== 1) bad.push(`Gleis springt bei ${i}`);
  });
  const side = Math.sign(track[0]?.uv[0] ?? 0);
  if (lane.some(({ uv }) => Math.sign(uv[0]) !== side)) bad.push('Schleife auf beiden Seiten');
  for (let i = 0; i < stop.long; i++) {
    const m = track[i]?.m;
    if (!m || m[0] !== side * stop.across || m[1] !== stop.out + i) bad.push(`Halt ${i} nicht bei quer ${stop.across}`);
  }
  const [g0, g1] = [gang[0] ?? -1, gang.at(-1) ?? -1];
  if (g1 - g0 + 1 !== gang.length || g0 <= stop.long || g1 !== n - 1 - before) bad.push(`Gang von ${g0} bis ${g1}`);
  return bad;
}

/** Vor dem Graben: Gang und Nachbarn Fels; offenes Gleis, Zaun und Bahnsteig frei, eben und erreichbar */
function laneGroundProblems({ part, platform, gang }: LaneOf, steps: ReadonlyMap<string, number>): string[] {
  const bad: string[] = [];
  const { stop } = GROTTE.grube;
  for (const { p, c } of [...part('gang'), ...part('side')])
    if (!c.solid || c.deco !== 'rock' || c.region !== 'border') bad.push(`${key(p)}: vor dem Graben kein Fels`);
  if (platform.length !== stop.long * stop.wide) bad.push(`${platform.length} Felder Bahnsteig`);
  if (part('fence').length < gang.length) bad.push(`nur ${part('fence').length} Felder Zaun`); // eine Reihe am ganzen Gang
  for (const { p, c } of [...part('open'), ...part('fence'), ...platform])
    if (c.solid || c.deco || c.h !== 1 || c.ground !== 'grotto' || !steps.has(key(p)))
      bad.push(`${key(p)}: nicht frei`);
  return bad;
}

/** Kein Feld davon und keins daneben ist Weg, Wiese, Bett, Hauptgleis, Bahnsteig, Schuppen, Klangstein oder Portal */
function laneTouchProblems(w: World, site: Site, { lane, platform }: LaneOf): string[] {
  const bad: string[] = [];
  for (const { p } of [...lane, ...platform])
    for (const [dx, dy] of [[0, 0] as const, ...AROUND]) {
      const q: Point = [p[0] + dx, p[1] + dy];
      const c = w.cell(...q);
      const uv = site.uv(...q);
      const way = Math.abs(uv[0]) <= 3 || c.garden || c.deco === 'bed' || corridorAt(...uv) || c.stop === 'hoehle';
      if (way || stationAt(...uv) || shedAt(...uv) || c.shed || c.stone || c.portal)
        bad.push(`${key(p)} berührt ${key(q)}`);
    }
  return bad;
}

/**
 * Der Gang nie auf der Seite zur Kamera, in Weltkoordinaten: Die Wand hinter ihm (quer nach außen) zeigt nie nach Süden
 * (+y), sonst verdeckten ihn die Klippen vorn. Läuft quer nord-südlich (Wand im Norden), ist eine Reihe vom Tor weg eine
 * Spalte der Welt: Dort liegt kein Feld des Gangs südlich vom offenen Gleis derselben Reihe. Läuft quer west-östlich, liegt
 * der Gang an einer Seitenwand; dann liegen das Querstück zum Halt (Reihe `near`) und, wo die Wand sich krümmt, Teile des
 * Gangs in derselben Spalte südlich vom Hinweg, ohne dass eine Klippe vor ihnen steht (Abweichung von der Seite)
 */
function laneSouthProblems(site: Site, { track }: LaneOf): string[] {
  const out = Math.sign(track[0]?.uv[0] ?? 0) * (site.at(1, 0)[1] - site.at(0, 0)[1]); // Wand des Gangs in Welt-y
  if (out > 0) return ['Wand des Gangs zur Kamera'];
  if (out === 0) return [];
  const rows = new Map<number, { gang: number[]; open: number[] }>();
  for (const { p, c, m } of track) {
    const row = rows.get(m[1]) ?? { gang: [], open: [] };
    row[c.lane!.part === 'gang' ? 'gang' : 'open'].push(p[1]);
    rows.set(m[1], row);
  }
  return [...rows].flatMap(([o, { gang, open }]) =>
    gang.length && open.length && Math.max(...gang) > Math.min(...open) ? [`Reihe ${o}: Gang südlich vom Hinweg`] : [],
  );
}

/** Nach dem Graben (Gang und Nachbarn frei; Zaun, beide Tore und die Pfosten neben ihnen fest) kommt man zu Fuß nicht hinein */
function laneClosedProblems({ part, track, gang }: LaneOf, steps: ReadonlyMap<string, number>): string[] {
  const openKeys = new Set(part('open').map(({ p }) => key(p)));
  const post = ({ p }: Spot) => Object.values(DIRS).some(([dx, dy]) => openKeys.has(key([p[0] + dx, p[1] + dy])));
  const gates = [track[gang[0] ?? -1], track[gang.at(-1) ?? -1]].flatMap((t) => (t ? [key(t.p)] : []));
  const fixed = new Set([
    ...part('fence').map(({ p }) => key(p)),
    ...gates,
    ...part('side')
      .filter(post)
      .map(({ p }) => key(p)),
  ]);
  const dug = new Set([...part('gang'), ...part('side')].map(({ p }) => key(p)).filter((k) => !fixed.has(k)));
  const seen = new Set(openKeys);
  const queue = part('open').map(({ p }) => p);
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i]!;
    for (const [dx, dy] of Object.values(DIRS)) {
      const k = key([x + dx, y + dy]);
      if (seen.has(k) || fixed.has(k) || (!steps.has(k) && !dug.has(k))) continue;
      seen.add(k);
      queue.push([x + dx, y + dy]);
    }
  }
  const inside = [...dug].filter((k) => seen.has(k));
  return inside.length ? [`nach dem Graben zu Fuß im Gang: ${inside.slice(0, 3).join(' ')}`] : [];
}

/** Schritte vom Bett zu jedem erreichbaren Feld der Welt (Breitensuche, das Höhlentor zu) */
function stepsFrom(w: World, start: Point): Map<string, number> {
  const dist = new Map<string, number>([[key(start), 0]]);
  const queue: Point[] = [start];
  for (let i = 0; i < queue.length && dist.size < 40000; i++) {
    const [x, y] = queue[i]!;
    for (const [dx, dy] of Object.values(DIRS)) {
      const n: Point = [x + dx, y + dy];
      if (dist.has(key(n)) || !canStep(w, [], x, y, n[0], n[1])) continue;
      dist.set(key(n), dist.get(key([x, y]))! + 1);
      queue.push(n);
    }
  }
  return dist;
}

/** Dinge auf dem Boden der Grotte, die zur Dichte zählen: verstreute Dinge und Füllung */
const THINGS: ReadonlySet<Cell['deco']> = new Set<Cell['deco']>([
  'crystal',
  'stalagmite',
  'glowshroom',
  'crystalbush',
  'boulder',
  'mosstop',
  'puddle',
  'fern',
]);
/** Feste Dinge, die verstreut oder als Füllung stehen */
const SOLID_FILL: ReadonlySet<Cell['deco']> = new Set<Cell['deco']>([
  'crystal',
  'stalagmite',
  'crystalbush',
  'boulder',
]);
/** die acht Nachbarn eines Felds */
const AROUND = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].flatMap((dy) => (dx || dy ? [[dx, dy] as const] : [])));
/** die Felder genau zwei Schritte (Chebyshev) um ein Feld: ein Feld dazwischen frei */
const RING2 = [-2, -1, 0, 1, 2].flatMap((dx) =>
  [-2, -1, 0, 1, 2].flatMap((dy) => (Math.max(Math.abs(dx), Math.abs(dy)) === 2 ? [[dx, dy] as const] : [])),
);

/** Lage eines Felds von der Mündung aus [quer, vom Tor weg] */
const mouthOf = (site: Site, [x, y]: Point): Point => {
  const [u, v] = site.uv(x, y);
  return [u + 0, v + GROTTE.shape.ry]; // + 0: ohne −0
};

describe('Kristallgrotte: Lage', () => {
  it('der Kern kennt ihren Platz (`Region.room`) wie das Paket; nach ihr, die um eine Ecke darf, kommt keine Welt', () => {
    const room = REGIONS.find((r) => r.id === 'hoehle')!.room!;
    expect({ rx: room.rx, ry: room.ry, gap: room.gap }).toEqual(GROTTE_ROOM);
    expect(room.bend).toBe(true);
    const withRoom = REGIONS.filter((r) => r.room);
    expect(withRoom.findIndex((r) => r.room!.bend)).toBe(withRoom.length - 1);
  });

  // nur die Lagen (schnell): viele Seeds, auch ohne den tiefen Lauf genug, um beide Arten (gerade, um die Ecke) zu sehen
  const PLACES = seedsFor(seedRange(1, 300), seedRange(1, 60));
  it('liegt ganz hinter dem Felsring, nie in der Eis-Welt; der Weg dorthin auch nicht (gerade oder um eine Ecke)', () => {
    const bad: string[] = [];
    let turned = 0;
    for (const seed of PLACES) {
      const cave = placeOf(seed);
      const ice = new Set(kesselPlace(seed, PACKS[0]).cells.map(key));
      if (cave.site.turn) turned++;
      for (const p of [...cave.cells, ...cave.site.floor, ...cave.site.walls]) {
        if (ice.has(key(p))) bad.push(`Seed ${seed}: ${key(p)} in der Eis-Welt`);
        if (!beyondRing(...p)) bad.push(`Seed ${seed}: ${key(p)} im Felsring`);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
    expect(turned).toBeGreaterThan(0);
    for (const seed of TURNED) expect(placeOf(seed).site.turn, `Seed ${seed}`).toBe(true);
  });

  it('die Seeds der Eigenschafts-Tests decken alle vier Drehungen ab; zeigt u+ zur Kamera, liegt die Schleife der Grubenbahn auf u−', () => {
    const turns = new Map<string, 1 | -1>();
    for (const seed of SEEDS) {
      const { site } = placeOf(seed);
      const [o, a, f] = [site.at(0, 0), site.at(1, 0), site.at(0, 1)];
      expect(laneSide(site), `Seed ${seed}`).toBe(a[1] > o[1] ? -1 : 1); // Kamera in Ruhe im Süden (+y)
      turns.set(`${f[0] - o[0]},${f[1] - o[1]}`, laneSide(site));
    }
    expect([...turns.keys()].sort()).toEqual(['-1,0', '0,-1', '0,1', '1,0']);
    expect(new Set(turns.values())).toEqual(new Set([1, -1]));
  });

  it('der Weg vom Felsring bis an die Klippen bleibt kurz (gerade meist ganz kurz, um die Ecke kürzer als 100 Felder)', () => {
    const lengths = PLACES.map((seed) => placeOf(seed).site.floor.length / 5);
    expect(Math.max(...lengths)).toBeLessThan(100);
    expect(lengths.filter((l) => l <= 10).length).toBeGreaterThan(lengths.length / 2);
  });
});

describe('Kristallgrotte: Gelände', () => {
  for (const seed of SEEDS) {
    const w = worldOf(seed, CAVE);
    const { site, bed } = placeOf(seed);
    const home = w.homes.hoehle;
    const steps = stepsFrom(w, home.wake[0]!);
    const floor = [...steps.keys()].filter((k) => {
      const [x, y] = k.split(',').map(Number) as [number, number];
      return w.cell(x, y).region === 'hoehle';
    });

    it(`Seed ${seed}: Abend (Schmuck mit Zug): jeder der drei Schächte hat seinen begehbaren Lichtfleck (\`Cell.shaft\`), die Fledermaus-Runde ihre Mitte über dem Bett`, () => {
      const lit = placeOf(seed).cells.map((p) => w.cell(...p));
      const open = new Set(lit.filter((c) => c.shaft !== undefined && !c.solid).map((c) => c.shaft));
      const centre = roundCentre(w);
      const near = !!centre && Math.hypot(centre.x - 0.5 - bed[0], centre.y - 0.5 - bed[1]) < 2;
      expect({ seed, open: [...open].sort(), near }).toEqual({ seed, open: [0, 1, 2], near: true });
    });

    it(`Seed ${seed}: etwa 10.000 Felder, jedes begehbare Feld vom Bett aus erreichbar, der Gang bis zum Tor auch`, () => {
      expect(bed).toEqual(home.bed);
      const cells = placeOf(seed).cells.filter(([x, y]) => w.cell(x, y).region === 'hoehle');
      expect(cells.length).toBeGreaterThan(9000);
      expect(cells.length).toBeLessThan(10500);
      const lost = cells.filter(([x, y]) => {
        const c = w.cell(x, y);
        return !c.solid && c.ground !== 'water' && !steps.has(key([x, y]));
      });
      expect(lost.map(key).slice(0, 5), `Seed ${seed}`).toEqual([]);
      // durch die Verlängerung und den Gang bis vor das Höhlentor (das zu bleibt)
      const gate = w.gates.get('hoehle')!;
      const inner: Point = [gate.mid[0] + gate.out[0], gate.mid[1] + gate.out[1]];
      expect(steps.has(key(inner)), `Seed ${seed}`).toBe(true);
      expect(w.realm(...home.bed)).toBe('hoehle');
      expect(w.climate(...home.bed)).toEqual({ id: 'hoehle', strength: 1 });
    });

    it(`Seed ${seed}: Bett 28 Felder hinter der Mündung, das fernste Feld weit weg; Portal am See schläft, bis der Maulwurf zu Hause ist`, () => {
      expect(mouthOf(site, home.bed)).toEqual([0, GROTTE.bed]);
      const far = Math.max(...floor.map((k) => steps.get(k)!));
      expect(far).toBeGreaterThan(110);
      expect(far).toBeLessThan(160);
      const portal = w.portals.get('hoehlensee')!;
      expect(portal.later).toBe(FIRST_MOLE);
      expect(portal.bed).toEqual(home.bed);
      expect(mouthOf(site, portal.gate)).toEqual(GROTTE.portal);
      expect(steps.get(key(portal.gate))).toBeGreaterThan(100); // der lange Weg ans Ende
      expect(Math.round(Math.hypot(portal.home[0] - home.bed[0], portal.home[1] - home.bed[1]))).toBe(9);
      expect(FIRST_MOLE).toBe(animalId('hoehle', 'maulwurf'));
      // auch am Bett und auf der Plattform erwacht es nicht, solange der erste Maulwurf nicht zu Hause wohnt
      const others = new Set([animalId('hoehle', 'dachs'), animalId('hoehle', 'maulwurf', 2)]);
      for (const p of [home.wake[0]!, portal.gate])
        expect(platformsToWake(w.portals, [], p[0], p[1], () => true, others)).not.toContain('hoehlensee');
      // wohnt er zu Hause, erwacht es beim Ankommen am Höhlenbett (wie das Eis-Portal), nicht an der fernen Plattform
      const mole = new Set([FIRST_MOLE]);
      expect(platformsToWake(w.portals, [], ...home.wake[0]!, () => true, mole)).toContain('hoehlensee');
      expect(platformsToWake(w.portals, [], ...portal.gate, () => true, mole)).not.toContain('hoehlensee');
    });

    it(`Seed ${seed}: Zonen: Lampengang, Plätze von Bahnhof und Lokschuppen, Unterstand, Pilzgarten, Halle, Tropfsteine, See, Hang`, () => {
      const all = placeOf(seed).cells.map((p) => ({ p, c: w.cell(...p), m: mouthOf(site, p) }));
      const count = (f: (e: (typeof all)[number]) => boolean) => all.filter(f).length;
      expect(count(({ c, m }) => c.deco === 'cavelamp' && m[1] <= GROTTE.lamps.to)).toBeGreaterThanOrEqual(4);
      // Bahnhof Fledermaus: eben und frei, noch ohne Bahnsteig
      const station = all.filter(({ p }) => stationAt(...site.uv(...p)));
      expect(station.length).toBe(GROTTE.station.long * GROTTE.station.wide);
      expect(station.every(({ c }) => c.h === 1 && !c.solid && !c.deco)).toBe(true);
      // Lokschuppen (kommt mit dem Zug): daneben eben und frei, zwei Felder fern von Bahnsteig, Trögen und Plattformen
      const lok = all.filter(({ p }) => shedAt(...site.uv(...p)));
      expect(lok.length).toBe(GROTTE.shed.long * GROTTE.shed.wide);
      const portal = w.portals.get('hoehlensee')!;
      const others: Point[] = [
        ...station.map(({ p }) => p),
        home.food,
        home.water,
        ...[portal.home, portal.gate].flatMap(([px, py]) =>
          [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy): Point => [px + dx, py + dy])),
        ),
      ];
      const tooClose = lok.filter(
        ({ p, c }) =>
          c.region !== 'hoehle' ||
          c.h !== 1 ||
          c.solid ||
          !!c.deco ||
          !!c.garden ||
          !!c.portal ||
          others.some(([ox, oy]) => Math.max(Math.abs(ox - p[0]), Math.abs(oy - p[1])) < 3),
      );
      expect(
        tooClose.map(({ p }) => p.join(',')),
        `Seed ${seed}`,
      ).toEqual([]);
      // Unterstand am Bett: Dach, dahinter die Kristallwand
      const { x0, y0, x1, y1 } = home.shelter;
      const shed: string[] = [];
      for (let x = x0; x <= x1; x++) {
        const wall = w.cell(x, y0 - 1);
        if (wall.deco !== 'shed' || !wall.solid) shed.push(`Wand ${x},${y0 - 1}`);
        for (let y = y0; y <= y1; y++) if (!w.cell(x, y).roof || !w.cell(x, y).garden) shed.push(`Dach ${x},${y}`);
      }
      expect(shed, `Seed ${seed}`).toEqual([]);
      // Säulen-Glockenspiel: fünf Säulen in einer Reihe quer im Bild (Weltrichtung, wie auch die Grotte liegt), Töne 0
      // (C5) bis 4 (A5) von links (Westen) nach rechts (Osten), je ein Feld dazwischen
      const columns = all.filter(({ c }) => c.deco === 'column').sort((a, b) => a.p[0] - b.p[0]);
      expect(columns.map(({ c }) => c.note)).toEqual([0, 1, 2, 3, 4]);
      expect(new Set(columns.map(({ p }) => p[1])).size).toBe(1);
      expect(columns.map(({ p }) => p[0] - columns[0]!.p[0])).toEqual([0, 2, 4, 6, 8]);
      // der Kristallbogen steht dahinter (Norden, von der Kamera in Ruhe aus hinter den Säulen), `hall.arch` Felder
      // entfernt, mittig zur Reihe, fünf Felder nebeneinander von West nach Ost; der Klangstein links vor den Säulen
      const arch = all.filter(({ c }) => c.deco === 'crystalarch').sort((a, b) => a.p[0] - b.p[0]);
      expect(arch.map(({ c }) => c.note)).toEqual([0, 1, 2, 3, 4]);
      expect(arch.map(({ p }) => [p[0] - columns[2]!.p[0], p[1] - columns[2]!.p[1]])).toEqual(
        [-2, -1, 0, 1, 2].map((dx) => [dx, -GROTTE.hall.arch]),
      );
      const stone = all.find(({ c }) => c.story === 'lichtgeister')!;
      expect(stone.p[0]).toBeLessThan(columns[0]!.p[0]);
      expect(stone.p[1]).toBeGreaterThan(columns[0]!.p[1]);
      expect(columns.every(({ c }) => c.solid && c.region === 'hoehle')).toBe(true);
      expect(count(({ c }) => c.deco === 'crystalarch')).toBe(5);
      expect(count(({ c }) => c.deco === 'crystalarch' && c.solid)).toBe(2); // nur die Pfeiler
      // unter dem Bogen drei Sitzplätze zum Hängen (die Fledermäuse), sonst nirgends
      expect(count(({ c }) => c.perch !== undefined)).toBe(3);
      expect(count(({ c }) => c.perch !== undefined && c.deco === 'crystalarch' && !c.solid)).toBe(3);
      expect(count(({ c }) => c.deco === 'glowshroom')).toBeGreaterThan(10);
      const notes = new Set(all.filter(({ c }) => c.deco === 'stalagmite').map(({ c }) => c.note));
      expect([...notes].sort()).toEqual([0, 1, 2]); // drei Höhen
      expect(count(({ c, m }) => c.ground === 'water' && m[1] > 100)).toBeGreaterThan(150); // der stille See
      expect(count(({ c, m }) => c.ground === 'water' && m[1] < 100)).toBe(6); // das Felsbecken 3 × 2
      expect(count(({ c }) => c.ground === 'path')).toBeGreaterThan(10); // der Steg
      // der Holzsteg: jede Planke begehbar, drei Planken an seinem Ende (`note` 1) grenzen an die Kristallinsel, und
      // neben dem Ende ist Wasser (dort taucht der Grottenolm auf)
      const jetty = all.filter(({ c }) => c.deco === 'jetty');
      expect(jetty.length).toBe(count(({ c }) => c.ground === 'path'));
      expect(jetty.every(({ c }) => !c.solid && c.ground === 'path')).toBe(true);
      const ends = jetty.filter(({ c }) => jettyEnd(c));
      // die Bretter liegen quer zur Laufrichtung: Läuft der Steg in der Welt von West nach Ost, sind sie in y lang
      const runsEast = site.at(0, 1)[1] === site.at(0, 0)[1];
      expect(jetty.every(({ c }) => (c.note ?? 0) >= JETTY_EAST === runsEast)).toBe(true);
      const boards = caveBoxes(w, jetty[0]!.c, 0, 0)!.filter((b) => b[9]?.skin === 'holz'); // ohne Nägel
      expect(boards.every(([, , , bw, bd]) => (runsEast ? bd > bw : bw > bd))).toBe(true);
      expect(ends.length).toBe(3);
      expect(ends.every(({ m }) => m[1] === Math.max(...jetty.map((j) => j.m[1])))).toBe(true);
      expect(ends.every(({ p }) => steps.has(key(p)))).toBe(true);
      const isle = w.cell(...site.at(...fromMouth([GROTTE.lake.across, GROTTE.lake.out])));
      expect(isle.ground).toBe('grotto');
      expect(steps.has(key(site.at(...fromMouth([GROTTE.lake.across, GROTTE.lake.out]))))).toBe(true); // über den Steg
      const scree = new Set(all.filter(({ c }) => c.ground === 'stone').map(({ c }) => c.h));
      expect([...scree].sort()).toEqual([2, 3, 4]);
    });

    it(`Seed ${seed}: etwa 8 Dinge je 100 Felder samt Füllung, die Mitte bleibt licht; keine Stufe höher als eins`, () => {
      const cells = floor.map((k) => k.split(',').map(Number) as [number, number]);
      const all = placeOf(seed).cells.filter(([x, y]) => w.cell(x, y).region === 'hoehle');
      const things = all.filter(([x, y]) => THINGS.has(w.cell(x, y).deco));
      const per100 = (things.length / all.length) * 100;
      expect(per100, `Seed ${seed}`).toBeGreaterThan(5);
      expect(per100, `Seed ${seed}`).toBeLessThan(11);
      // der Weg durch die Mitte: frei bis zum See (am Bett führt er um die Mooswiese herum)
      const blocked: number[] = [];
      for (let out = 1; out < GROTTE.lake.out - GROTTE.lake.ry - 1; out++) {
        if (Math.abs(out - GROTTE.bed) <= GROTTE.flat + 1) continue;
        if (w.cell(...site.at(...fromMouth([0, out]))).solid) blocked.push(out);
      }
      expect(blocked, `Seed ${seed}`).toEqual([]);
      const steep = cells.filter(([x, y]) =>
        Object.values(DIRS).some(([dx, dy]) => {
          const n = w.cell(x + dx, y + dy);
          return n.region === 'hoehle' && !n.solid && n.ground !== 'water' && Math.abs(n.h - w.cell(x, y).h) > 1;
        }),
      );
      expect(steep.map(key).slice(0, 3)).toEqual([]);
    });

    it(`Seed ${seed}: Sammeln: vier Pilzbeete im Pilzgarten und zwei nah am Bett, Tropfquelle und Tropfmoos am Felsbecken, alles erreichbar`, () => {
      const all = placeOf(seed).cells.map((p) => ({ p, c: w.cell(...p) }));
      const bad = [...bedProblems(w, site, steps, all), ...dripProblems(w, site, steps, all)];
      // Futter und Wasser am Höhlenbett: mit Pilzen in die Pilzschale, mit der Kanne in den Steintrog
      const feed = walkInto(w, steps, home.food, { shrooms: true });
      if (feed?.events[0]?.type !== 'feed' || feed.state.shrooms) bad.push('Pilzschale nimmt keine Pilze');
      const pour = walkInto(w, steps, home.water, { bucket: true });
      if (pour?.events[0]?.type !== 'pour' || pour.state.bucket) bad.push('Steintrog nimmt kein Wasser');
      // Deko-Pilze weiß-blau, im Pilzgarten nur am Rand der Wiese (zwischen den Beeten nichts, was wie ein Sammelpilz aussieht)
      const { garden, lake } = GROTTE;
      for (const { p, c } of all) {
        if (c.deco !== 'glowshroom') continue;
        if (c.color !== GROTTE_COLORS.decoShroom) bad.push(`${key(p)}: Deko-Pilz in ${c.color}`);
        const [u, v] = mouthOf(site, p);
        const d = Math.hypot(u - garden.across, v - garden.out);
        if (d <= garden.r && d < garden.edge) bad.push(`${key(p)}: Deko-Pilz zwischen den Beeten`);
      }
      // helle Steine am Ufer des Sees: begehbar, am Wasser
      const shore = all.filter(({ c }) => c.deco === 'shore');
      if (shore.length < 8) bad.push(`nur ${shore.length} Ufersteine`);
      for (const { p, c } of shore) {
        const [u, v] = mouthOf(site, p);
        const wet = [-1, 1].some(
          (d) => w.cell(p[0] + d, p[1]).ground === 'water' || w.cell(p[0], p[1] + d).ground === 'water',
        );
        if (c.solid || !wet || Math.hypot(u - lake.across, v - lake.out) > lake.rx + 2)
          bad.push(`${key(p)}: Uferstein`);
      }
      expect(bad, `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: Licht: Lichtflecken unter den drei Schächten, Kristalle machen ihre Nachbarn heller, nie grell`, () => {
      const all = placeOf(seed).cells.map((p) => w.cell(...p));
      expect(all.every((c) => (c.light ?? 0) >= 0 && (c.light ?? 0) <= 0.5)).toBe(true);
      const dim = GROTTE.shafts.filter((s) => {
        const c = w.cell(...site.at(...fromMouth(s)));
        return !c.solid && (c.light ?? 0) < GROTTE.shaft.light - 0.01;
      });
      expect(dim, `Seed ${seed}`).toEqual([]);
      const crystal = placeOf(seed).cells.find(([x, y]) => w.cell(x, y).deco === 'crystal')!;
      const n = w.cell(crystal[0] + 1, crystal[1]);
      if (n.region === 'hoehle') expect(n.light ?? 0).toBeGreaterThanOrEqual(GROTTE.glow);
      // Kristallbüsche leuchten wie Kristalle
      const bushes = placeOf(seed).cells.filter(([x, y]) => w.cell(x, y).deco === 'crystalbush');
      expect(bushes.filter(([x, y]) => (w.cell(x, y).light ?? 0) < GROTTE.glow).map(key)).toEqual([]);
    });

    it(`Seed ${seed}: Füllung: Stalagmiten-Gruppen, Kristallbüsche, Felsbrocken, Felsinseln, Pfützen, je Zone dicht genug, nichts abgeschnitten`, () => {
      const all = placeOf(seed).cells.map((p) => ({ p, c: w.cell(...p), uv: site.uv(...p) }));
      const inGrotto = all.filter(({ c }) => c.region === 'hoehle');
      const is = (deco: Cell['deco']) => inGrotto.filter(({ c }) => c.deco === deco);
      const bad: string[] = [];
      // nichts wird von der Füllung abgeschnitten: kein Feld neben einem festen Ding der Füllung wird Fels, weil man es
      // nicht erreicht (am Rand der Mündung kann zwischen Klippe und Lampe ein einzelnes Feld Fels werden, wie bisher)
      const fillAt = new Set(inGrotto.filter(({ c }) => SOLID_FILL.has(c.deco)).map(({ p }) => key(p)));
      const sealed = inGrotto.filter(
        ({ c, p: [x, y] }) => c.deco === 'rock' && AROUND.some(([dx, dy]) => fillAt.has(key([x + dx, y + dy]))),
      );
      if (sealed.length) bad.push(`${sealed.length} Felder abgeschnitten, etwa ${key(sealed[0]!.p)}`);
      // feste Dinge nie Seite an Seite oder über Eck: zwischen zweien bleibt immer ein begehbares Feld
      const solids = fillAt;
      for (const k of solids) {
        const [x, y] = k.split(',').map(Number) as [number, number];
        for (const [dx, dy] of AROUND) if (solids.has(key([x + dx, y + dy]))) bad.push(`${k}: Nachbar fest`);
        if (!Object.values(DIRS).some(([dx, dy]) => steps.has(key([x + dx, y + dy])))) bad.push(`${k}: unerreichbar`);
      }
      // Stalagmiten-Gruppen: viele Stalagmiten mit einem zweiten genau ein freies Feld daneben, in drei Höhen
      const stal = is('stalagmite');
      const stalKeys = new Set(stal.map(({ p }) => key(p)));
      const grouped = stal.filter(({ p: [x, y] }) => RING2.some(([dx, dy]) => stalKeys.has(key([x + dx, y + dy]))));
      if (grouped.length < 100) bad.push(`nur ${grouped.length} Stalagmiten in Gruppen`);
      if (new Set(grouped.map(({ c }) => c.note)).size !== 3) bad.push('Gruppen nicht in drei Höhen');
      // Kristallbüsche fest und niedrig, Felsbrocken fest, Felsinseln eine Stufe hoch und begehbar, Pfützen begehbar
      const counts = { crystalbush: 20, boulder: 5, mosstop: 30, puddle: 20 } as const;
      for (const [deco, min] of Object.entries(counts) as [keyof typeof counts, number][])
        if (is(deco).length < min) bad.push(`nur ${is(deco).length} ${deco}`);
      for (const { p, c } of [...is('mosstop'), ...is('puddle')])
        if (c.solid || !steps.has(key(p))) bad.push(`${key(p)}: ${c.deco} nicht begehbar`);
      if (is('mosstop').some(({ c }) => c.h !== 2)) bad.push('Felsinsel nicht eine Stufe hoch');
      if ([...is('crystalbush'), ...is('boulder')].some(({ c }) => !c.solid)) bad.push('Busch oder Brocken nicht fest');
      // Dichte je Zone: am Rand und in der Tropfsteingrotte mindestens so dicht wie an den Seiten, keine leer
      const density = (z: FillZone) => {
        const cellsOf = inGrotto.filter(({ uv }) => fillZone(...uv) === z);
        return (cellsOf.filter(({ c }) => SOLID_FILL.has(c.deco)).length / cellsOf.length) * 100;
      };
      for (const z of ['rim', 'drip', 'side'] as const) {
        const d = density(z);
        if (d < 3.5 || d > 14) bad.push(`Zone ${z}: ${d.toFixed(1)} feste Dinge je 100 Felder`);
      }
      expect(bad.slice(0, 5), `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: Farben je Zone: jeder Stalagmit und Felsbrocken trägt die Farbe seiner Zone an der Spitze`, () => {
      const things = placeOf(seed)
        .cells.map((p) => ({ p, c: w.cell(...p) }))
        .filter(({ c }) => c.region === 'hoehle' && (c.deco === 'stalagmite' || c.deco === 'boulder'));
      const side = laneSide(site); // der Lehmhang liegt gegenüber der Schleife der Grubenbahn
      const wrong = things.filter(({ p, c }) => c.color !== tipOf(...site.uv(...p), side)).map(({ p }) => key(p));
      const tips = new Set(things.map(({ c }) => c.color));
      expect({ seed, wrong: wrong.slice(0, 3), many: things.length > 200, zones: tips.size >= 3 }).toEqual({
        seed,
        wrong: [],
        many: true,
        zones: true,
      });
      expect([...tips].filter((t) => !Object.values(GROTTE_COLORS.tips).includes(t as never))).toEqual([]);
    });

    // ein Test für beide, die Felder der Grotte werden nur einmal gesammelt (Laufzeit von test:deep)
    it(`Seed ${seed}: Fülle: Kristallfelder je Zone in einer Farbe, Adern nur Rosa oder Lila, Leuchtmoos an Wänden und unter den Schächten, alles flach und begehbar, nie auf Wegen, Mitte oder Gleisspur; Schleife der Grubenbahn vor dem Graben: geschlossen, Gang als Fels, frei und eben, berührt weder Weg noch Bett, Hauptgleis, Bahnsteig oder Schuppen, der Gang nie auf der Seite zur Kamera`, () => {
      const all = placeOf(seed).cells.map((p) => ({ p, c: w.cell(...p), uv: site.uv(...p), m: mouthOf(site, p) }));
      const bad = [...adornProblems(w, steps, all), ...colorProblems(laneSide(site), all), ...mossProblems(w, all)];
      expect(bad.slice(0, 5), `Seed ${seed}`).toEqual([]);
      expect(laneProblems(w, site, steps, all), `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: ein kleiner Wasserfall am See: fest, selbst kein Wasser, das Wasser fällt nach Süden in den See, man kommt an ihn heran`, () => {
      const falls = placeOf(seed)
        .cells.map((p) => ({ p, c: w.cell(...p) }))
        .filter(({ c }) => c.deco === 'waterfall');
      expect(falls.length, `Seed ${seed}`).toBe(1);
      const { p, c } = falls[0]!;
      const [a, o] = mouthOf(site, p);
      const { lake } = GROTTE;
      const south = w.cell(p[0], p[1] + 1);
      expect({
        seed,
        solid: c.solid,
        ground: c.ground,
        south: south.ground,
        // am Ufer des Sees, nicht auf dem Steg und nicht auf der Spur des Gleises
        shore: ((a - lake.across) / (lake.rx + 1.5)) ** 2 + ((o - lake.out) / (lake.ry + 1.5)) ** 2 < 1,
        free: !corridorAt(...site.uv(...p)) && !c.ride && !c.rail,
        near: Object.values(DIRS).some(([dx, dy]) => steps.has(key([p[0] + dx, p[1] + dy]))),
        // schneidet nichts ab: jeder begehbare Nachbar (außer dem Wasser im Süden) bleibt vom Bett aus erreichbar
        cut: Object.values(DIRS).filter(([dx, dy]) => {
          const n = w.cell(p[0] + dx, p[1] + dy);
          return !n.solid && n.ground !== 'water' && !steps.has(key([p[0] + dx, p[1] + dy]));
        }).length,
      }).toEqual({ seed, solid: true, ground: 'grotto', south: 'water', shore: true, free: true, near: true, cut: 0 });
    });

    it(`Seed ${seed}: drei bis vier Netze der Tupfspinnen: je ein Feld statt eines Stalagmiten, im Licht, fern von Bett, Bahnhof und Wegen, man läuft hinein und hört die Harfe`, () => {
      expect(webProblems(w, site, steps, placeOf(seed).cells), `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: Flecken im Grottenboden (2D): beide Farben, auf etwa einem Fünftel des freien Bodens`, () => {
      const floor = placeOf(seed)
        .cells.map((p) => w.cell(...p))
        .filter((c) => c.region === 'hoehle' && c.ground === 'grotto' && !c.solid);
      const share = (color: string) => floor.filter((c) => patchOf(c) === color).length / floor.length;
      const [cool, warm] = GROTTE_COLORS.patches.map(share) as [number, number];
      expect({ seed, cool: cool > 0.04, warm: warm > 0.04, all: cool + warm < 0.4 }).toEqual({
        seed,
        cool: true,
        warm: true,
        all: true,
      });
    });

    it(`Seed ${seed}: Moos und Farn nur unter den Lichtschächten, Lehmhang des Dachses neben dem Pilzgarten`, () => {
      const all = placeOf(seed).cells.map((p) => ({ p, c: w.cell(...p), m: mouthOf(site, p) }));
      const bad: string[] = [];
      const underShaft = (m: Point) =>
        GROTTE.shafts.some(([a, o]) => Math.hypot(m[0] - a, m[1] - o) <= GROTTE.fill.shade.r);
      const { garden, drip, clay } = GROTTE;
      const ferns = all.filter(({ c }) => c.region === 'hoehle' && c.deco === 'fern');
      if (ferns.length < 5) bad.push(`nur ${ferns.length} Farne`);
      for (const { p, c, m } of ferns)
        if (!underShaft(m) || c.solid || c.ground !== 'grass') bad.push(`Farn ${key(p)}`);
      // Moos (ground 'grass') nur auf der Mooswiese am Bett, im Pilzgarten, um die Beete nah am Bett, am Felsbecken und
      // unter den Schächten
      const mossy = all.filter(
        ({ c, m }) =>
          c.region === 'hoehle' &&
          c.ground === 'grass' &&
          !c.garden &&
          Math.hypot(m[0] - garden.across, m[1] - garden.out) > garden.r &&
          !GROTTE.nearBeds.at.some(([a, o]) => Math.hypot(m[0] - a, m[1] - o) <= GROTTE.nearBeds.moss) &&
          Math.hypot(m[0] - drip.across - drip.basin, m[1] - drip.out) > 3 &&
          !underShaft(m),
      );
      if (mossy.length) bad.push(`Moos fern der Schächte, etwa ${key(mossy[0]!.p)}`);
      if (
        all.filter(
          ({ c, m }) => c.ground === 'grass' && Math.hypot(m[0] - GROTTE.shafts[1][0], m[1] - GROTTE.shafts[1][1]) <= 3,
        ).length < 10
      )
        bad.push('kein Moos unter dem Schacht der Kristallhalle');
      // Lehmhang: zwei Stufen Lehm (Höhe 2 und 3), begehbar und erreichbar, links neben dem Pilzgarten; liegt dort die
      // Schleife der Grubenbahn, auf derselben Seite hinter ihrer Umkehr, nie auf die Seite zur Kamera (in der Welt +y)
      const side = laneSide(site);
      const at = clayOf(side);
      const middle = site.at(0, 0)[1]; // Mitte der Grotte in der Welt (y)
      const bank = all.filter(({ c }) => c.deco === 'clay');
      if (bank.length < clay.long * 2) bad.push(`nur ${bank.length} Felder Lehm`);
      for (const { p, c, m } of bank) {
        if (c.solid || !steps.has(key(p)) || c.h < 2 || c.h > 3) bad.push(`Lehm ${key(p)}`);
        if (m[0] > at.across || Math.abs(m[1] - at.out) > clay.long) bad.push(`Lehm ${key(p)} nicht am Hang`);
        // zeigt rechts (u+) zur Kamera, bleibt er links, in der Welt in der Hälfte der Grotte fern der Kamera
        if (side === -1 && p[1] >= middle) bad.push(`Lehm ${key(p)} auf der Seite zur Kamera`);
      }
      if (new Set(bank.map(({ c }) => c.h)).size !== 2) bad.push('Lehmhang nicht in zwei Stufen');
      expect(bad.slice(0, 5), `Seed ${seed}`).toEqual([]);
    });

    it(`Seed ${seed}: die Spur des künftigen Gleises von der Mündung bis zum Platz des Bahnhofs bleibt frei und eben`, () => {
      const corridor = placeOf(seed).cells.filter((p) => corridorAt(...site.uv(...p)));
      expect(corridor.length).toBeGreaterThan(40);
      const blocked = corridor.filter((p) => {
        const c = w.cell(...p);
        return c.region !== 'hoehle' || c.solid || !!c.deco || c.h !== 1 || c.ground !== 'grotto' || !steps.has(key(p));
      });
      expect(blocked.map(key), `Seed ${seed}`).toEqual([]);
      // sie reicht von der Mündung (o 0) bis an den Bahnsteig (ein Feld davor, auf der Höhe seiner Felder)
      const mouthward = corridor.map((p) => mouthOf(site, p));
      expect(Math.min(...mouthward.map(([, o]) => o))).toBe(0);
      const { station } = GROTTE;
      expect(mouthward.some(([a, o]) => o === station.out - 1 && a === station.side)).toBe(true);
      // und hinüber bis an die Spur hinter dem Bahnsteig (dort hält der Zug, der Weg zum Bahnsteig kreuzt kein Gleis)
      expect(mouthward.some(([a, o]) => o === station.out - 1 && a === station.side + station.wide)).toBe(true);
    });

    it(`Seed ${seed}: der Platz des Bahnhofs ist für die Bahn markiert, die Spur u −2 der Bucht kommt auf seiner Seite an`, () => {
      const cells = placeOf(seed).cells.map((p) => ({ p, c: w.cell(...p) }));
      const stops = cells.filter(({ c }) => c.stop === 'hoehle');
      expect(stops.map(({ p }) => key(p)).sort()).toEqual(
        cells
          .filter(({ p }) => stationAt(...site.uv(...p)))
          .map(({ p }) => key(p))
          .sort(),
      );
      expect(stops).toHaveLength(GROTTE.station.long * GROTTE.station.wide);
      // Spur u −2 der Bucht (u wächst nach [−out.y, out.x], mitwachsen-bay.ts) durch den Gang: in der Grotte bei u +2
      const g = w.gates.get('hoehle')!;
      const lane = (t: number): Point => [
        g.mid[0] + 2 * g.out[1] + g.out[0] * t,
        g.mid[1] - 2 * g.out[0] + g.out[1] * t,
      ];
      if (!site.turn) expect(site.uv(...lane(g.deep + 1))[0]).toBe(2);
      expect(GROTTE.station.side).toBeGreaterThan(2); // der Bahnhof liegt auf der Seite u+
    });

    it(`Seed ${seed}: Klangstein am Höhlenbett links vorn (hoehle-offen), außerhalb des freien Platzes, erreichbar`, () => {
      const [sx, sy] = w.stones.get('hoehle-offen')!;
      expect([sx - home.bed[0], sy - home.bed[1]]).toEqual([...CAVE_STONE]);
      expect(Math.max(Math.abs(CAVE_STONE[0]), Math.abs(CAVE_STONE[1]))).toBeGreaterThan(home.clear);
      const c = w.cell(sx, sy);
      expect([c.deco, c.story, c.solid, c.garden, w.realm(sx, sy)]).toEqual([
        'klangstein',
        'hoehle-offen',
        true,
        true,
        'hoehle',
      ]);
      expect(home.wake.some(([x, y]) => x === sx && y === sy)).toBe(false);
      expect(Object.values(DIRS).some(([dx, dy]) => steps.has(key([sx + dx, sy + dy])))).toBe(true);
      expect(told('hoehle-offen', [])).toBe('hoehle-offen'); // der Stein am Höhlenbett erzählt immer die zweite Fassung
    });

    it(`Seed ${seed}: Platz des Klangsteins am Lokschuppen frei gehalten (Cell.stone), ohne Bahn kein Stein`, () => {
      const cells = placeOf(seed).cells.map((p) => ({ p, c: w.cell(...p) }));
      const spot = cells.filter(({ c }) => c.stone);
      expect(spot.map(({ c }) => c.stone)).toEqual(['lokschuppen']);
      const [x, y] = spot[0]!.p;
      expect(shedStoneAt(...site.uv(x, y))).toBe(true);
      const c = w.cell(x, y);
      expect([c.deco, c.solid, c.story, steps.has(key([x, y]))]).toEqual([null, false, undefined, true]);
      // ringsum frei und eben, gleich neben dem Platz des Lokschuppens, zwei Felder neben dem Platz des Bahnhofs
      const ring = AROUND.map(([dx, dy]) => w.cell(x + dx, y + dy));
      expect(ring.every((n) => !n.solid && n.ground !== 'water' && n.h === c.h)).toBe(true);
      expect(ring.some((n) => n.shed === 'hoehle')).toBe(true);
      expect(ring.some((n) => n.stop)).toBe(false);
      // dort wohnt kein Tier und kommt keins hin (mit Bau 2 steht dort ein Stein)
      expect([...w.spawns.values()].some(([sx, sy]) => sx === x && sy === y)).toBe(false);
      expect(w.spotsOf('hoehle').some(([sx, sy]) => sx === x && sy === y)).toBe(false);
      expect([...w.stones.keys()].filter((id) => id === 'lokschuppen' || id === 'bahnhof')).toEqual([]);
    });
  }
});

describe('Pilzbeete im Kreis', () => {
  it('alle Beete gleich weit von der Mitte des Pilzgartens, der Kreis spiegelgleich (quer und vom Tor weg)', () => {
    const spots = bedSpots();
    expect(spots).toHaveLength(GROTTE.garden.beds);
    expect(spots.map(([u, v]) => Math.round(Math.hypot(u, v)))).toEqual(spots.map(() => GROTTE.garden.ring));
    const all = new Set(spots.map(key));
    const mirror = (f: (p: Point) => Point) => spots.filter((p) => !all.has(key(f(p)))).map(key);
    expect([mirror(([u, v]) => [-u + 0, v]), mirror(([u, v]) => [u, -v + 0])]).toEqual([[], []]);
  });
});

describe('Kristallgrotte: nie dunkler als die Dämmerung', () => {
  /** relative Helligkeit einer Farbe (#rrggbb, 0 … 1) */
  const lum = (hex: string) => {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const [r, g, b] = v.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
      number,
      number,
      number,
    ];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  it('Höhlenhimmel und Nebel-Maske heller als der Himmel der Lichtung in der Dämmerung (Tageslicht 0,4)', () => {
    // Dämmerung: Himmel der 3D-Ansicht (#9fd6f0) zu 80 % zum Nachthimmel (#141a3a), so steht es in DUSK_SKY
    const mix = (a: number, b: number) => Math.round(a * 0.2 + b * 0.8);
    const dusk = [
      [0x9f, 0x14],
      [0xd6, 0x1a],
      [0xf0, 0x3a],
    ].map(([a, b]) => mix(a!, b!).toString(16).padStart(2, '0'));
    expect(DUSK_SKY).toBe(`#${dusk.join('')}`);
    for (const c of [GROTTE_COLORS.sky, GROTTE_COLORS.mist, ...GROTTE_COLORS.heaven])
      expect(lum(c), c).toBeGreaterThan(lum(DUSK_SKY));
  });

  it('nachts (dunkelste Nacht der Grotte) Höhlenhimmel und Nebel-Maske nicht dunkler als die Dämmerung, wie die 3D-Ansicht mischt', () => {
    // Three.js mischt Farben linear zum Nachthimmel #141a3a (mitwachsen-3d.ts)
    const lin = (hex: string): Rgb =>
      [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      }) as unknown as Rgb;
    const l = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * t) as unknown as Rgb;
    const [dark, dusk] = [lin('#141a3a'), lin(DUSK_SKY)];
    const night = nightIn('hoehle', 1);
    const low = [GROTTE_COLORS.sky, GROTTE_COLORS.mist].filter(
      (c) => l(mix(lin(c), dark, nightMix('hoehle', night, lin(c), dark, dusk))) < l(dusk) - 1e-9,
    );
    expect(low).toEqual([]);
  });

  it('Licht: die Sonne in der Grotte nie schwächer als 0,4, auch ganz nah mit gedämpfter Stimmung', () => {
    const bright = 1 + (MOOD_LIGHT.hoehle!.bright - 1) * 0.4; // so rechnet die 3D-Ansicht die Stimmung ein
    const night = nightIn('hoehle', 1);
    expect(dayOf(night)).toBeCloseTo(DUSK_DAY); // Tageslicht der 3D-Ansicht bei der dunkelsten Nacht
    expect(sunLevel('hoehle', night, bright)).toBeGreaterThanOrEqual(DUSK_DAY);
  });

  it('Lichtflecken machen nur heller (0 … 0,5), Schächte bis 35 %', () => {
    expect(GROTTE.shaft).toEqual({ r: 2.5, light: 0.35 });
    expect(GROTTE.glow).toBe(0.15);
  });
});

describe('Kristallgrotte: Regressions-Seeds bauen', () => {
  it('jede Welt der Regressions-Seeds hat eine Grotte mit Wohnplätzen', () => {
    for (const seed of REGRESSION_SEEDS) expect(worldOf(seed, CAVE).spotsOf('hoehle').length).toBeGreaterThan(5000);
  });
});

describe('Kristallgrotte: Spielorte (Issue 56)', () => {
  /** Zahlen-Kristalle: flach und begehbar, vom Bett weg in Reihenfolge */
  function stoneFaults(w: World, stones: readonly (readonly [Point, Cell])[]): string[] {
    const wrong: string[] = [];
    const bed = w.homes.hoehle.bed;
    const far = ([x, y]: Point) => Math.hypot(x - bed[0], y - bed[1]);
    const ordered = [...stones].sort((a, b) => a[1].note! - b[1].note!);
    ordered.forEach(([p, c], i) => {
      if (c.solid || c.lane || c.stop || c.garden || c.portal)
        wrong.push(`Zahlen-Kristall ${c.note} bei ${p.join(',')}`);
      if (i && far(p) <= far(ordered[i - 1]![0]))
        wrong.push(`Zahlen-Kristall ${c.note} näher am Bett als ${c.note! - 1}`);
    });
    return wrong;
  }

  /**
   * Feste Dinge stehen frei: ringsum acht begehbare Felder auf gleicher Höhe, nie an Schleife, Bahnsteig, Wiese oder
   * Plattform, und weit auseinander
   */
  function standFaults(w: World, solid: readonly (readonly [Point, Cell])[]): string[] {
    const wrong: string[] = [];
    for (const [p, c] of solid) {
      const at = `${c.deco} ${p.join(',')}`;
      if (!c.solid || c.region !== 'hoehle' || c.lane || c.stop || c.garden || c.portal)
        wrong.push(`falscher Platz ${at}`);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const n = w.cell(p[0] + dx, p[1] + dy);
          if ((dx || dy) && (n.solid || n.h !== c.h || n.lane || n.ground !== 'grotto')) wrong.push(`nicht frei ${at}`);
        }
      if (solid.some(([q]) => q !== p && Math.hypot(q[0] - p[0], q[1] - p[1]) < CAVE_PLACES.apart))
        wrong.push(`dicht beieinander ${at}`);
    }
    return wrong;
  }

  /** Was an den Spielorten einer Grotte nicht stimmt */
  function placeFaults(seed: number): string[] {
    const w = worldOf(seed, CAVE);
    const wrong: string[] = [];
    const cells = placeOf(seed).cells.map((p) => [p, w.cell(...p)] as const);
    const of = (deco: Cell['deco']) => cells.filter(([, c]) => c.deco === deco);
    const [shrooms, heaps, stones, echo] = [of('sleepshroom'), of('crystalheap'), of('numstone'), of('echostone')];
    if (shrooms.length !== CAVE_PLACES.shrooms) wrong.push(`${shrooms.length} Leuchtpilze`);
    if (heaps.length !== CAVE_PLACES.towers) wrong.push(`${heaps.length} Kristallhaufen`);
    if (echo.length !== 1) wrong.push(`${echo.length} Echo-Wände`);
    const notes = stones.map(([, c]) => c.note).sort();
    if (notes.join('') !== '123456789') wrong.push(`Zahlen-Kristalle ${notes.join(' ')}`);
    wrong.push(...standFaults(w, [...shrooms, ...heaps, ...echo]));
    wrong.push(...stoneFaults(w, stones));
    return wrong.slice(0, 5).map((m) => `Seed ${seed}: ${m}`);
  }

  it(`in jeder Grotte: zwölf Leuchtpilze, zehn Kristallhaufen, eine Echo-Wand, frei stehend und weit auseinander; neun Zahlen-Kristalle in Reihenfolge vom Bett weg (${SEEDS.length} Seeds)`, () => {
    expect(SEEDS.flatMap(placeFaults)).toEqual([]);
  });
});
