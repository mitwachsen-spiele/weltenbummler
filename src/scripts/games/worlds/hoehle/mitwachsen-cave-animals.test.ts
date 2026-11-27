import { describe, expect, it } from 'vitest';
import { SPECIES, animalId, regionAnimalList, REGIONS } from '../../../../data/games/mitwachsen';
import { CAVE_SPECIES } from '../../../../data/games/mitwachsen-hoehle';
import { CAVE_ANIMALS, ARCH_PERCH } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-animals';
import { BAT_ROOST, CAVE_MODELS } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-models';
import { CAVE_FINE_MODELS, CAVE_FINE_ROOST } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-fine';
import { GROTTE } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { initialState, step, type State } from '../../mitwachsen-state';
import { meadowSpots } from '../../mitwachsen-meadow';
import { HANG_LABEL, hangAt, labelHeight, perchesOf, roostAt } from '../../mitwachsen-roost';
import { slots } from '../../mitwachsen-album';
import { full } from '../../mitwachsen-guide';
import { DIRS, type Dir } from '../../../../lib/games/front';
import { CAVE_FOOD } from '../../../../data/games/mitwachsen-hoehle';
import { snaps } from '../../mitwachsen-gait';
import { attachPack } from '../../mitwachsen-state';
import type { KesselPlace } from '../../mitwachsen-pack-types';
import { kesselPlace } from '../../mitwachsen-world';
import { bareOf, HOEHLE_PACK, SAMPLE_SEEDS, seedRange, seedsFor, worldOf } from '../../test-worlds';
import { HAUNTS } from './mitwachsen-cave-haunts';
import { fromMouth } from './mitwachsen-grotte';
import { HALL_STAGE, hallStage } from './mitwachsen-hall';
import { laneSide, onClay } from './mitwachsen-lane';
import type { Site } from './mitwachsen-site';

const CAVE = [HOEHLE_PACK];
/** Eigenschafts-Tests, die ganze Welten bauen: wenige Seeds, im tiefen Lauf 20 (dazu die um eine Ecke: 26, 30) */
const SEEDS = seedsFor(seedRange(1, 20), [...SAMPLE_SEEDS, 26, 30]);
const hoehle = REGIONS.find((r) => r.id === 'hoehle')!;
const ALL = regionAnimalList(hoehle);
const key = ([x, y]: readonly [number, number]) => `${x},${y}`;
const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

describe('Höhlen-Tiere: Wohnorte in der Grotte', () => {
  it('alle 32 Tiere wohnen auf eigenen erreichbaren Feldern der Grotte, das erste je Art an seinem Fundort', () => {
    const bad: string[] = [];
    for (const seed of SEEDS) {
      const w = worldOf(seed, CAVE);
      const spots = new Set(w.spotsOf('hoehle').map(key));
      const seen = new Set<string>();
      for (const { id } of ALL) {
        const at = w.spawns.get(id);
        if (!at) bad.push(`${seed} ${id}: kein Wohnort`);
        else if (!spots.has(key(at)) || w.realm(...at) !== 'hoehle') bad.push(`${seed} ${id}: ${key(at)} kein Platz`);
        else if (seen.has(key(at))) bad.push(`${seed} ${id}: ${key(at)} doppelt`);
        else seen.add(key(at));
      }
      for (const { species, near } of CAVE_ANIMALS) {
        const at = w.spawns.get(animalId('hoehle', species));
        if (at && !HAUNTS[near](w.cell(...at))) bad.push(`${seed} ${species}: ${key(at)} nicht ${near}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('die Fundorte liegen dort, wo das Konzept sie will (von der Mündung aus gemessen), die Fledermaus unter dem Bogen', () => {
    const bad: string[] = [];
    for (const seed of SEEDS) {
      const w = worldOf(seed, CAVE);
      const { site } = kesselPlace(seed, HOEHLE_PACK) as KesselPlace & { site: Site };
      for (const { species, near, at } of CAVE_ANIMALS) {
        const spawn = w.spawns.get(animalId('hoehle', species))!;
        // Lehmhang rückt mit; der Bogen steht auf der Bühne der Halle in Weltrichtung, die Fledermaus hängt in seiner Mitte
        const want =
          near === 'arch'
            ? hallStage(site)(0, HALL_STAGE.arch)
            : site.at(...fromMouth(near === 'clay' ? onClay(at, laneSide(site)) : at));
        if (near === 'arch' && (spawn[0] !== want[0] || spawn[1] !== want[1]))
          bad.push(`${seed}: Fledermaus nicht in der Mitte`);
        const d = cheb(spawn[0], spawn[1], want[0], want[1]);
        if (d > 6) bad.push(`${seed} ${species}: ${d} Felder vom Wunschort`);
      }
      const bat = w.spawns.get(animalId('hoehle', 'fledermaus'))!;
      if (w.cell(...bat).perch !== ARCH_PERCH) bad.push(`${seed}: Fledermaus nicht am Bogen`);
      if (perchesOf(w, 'hoehle').length !== 3) bad.push(`${seed}: ${perchesOf(w, 'hoehle').length} Sitzplätze`);
    }
    expect(bad).toEqual([]);
  });

  it('ohne das Paket der Höhlenwelt fehlen ihre Tiere ganz (etwa solange es nicht geladen ist), bleiben aber im Spielstand', () => {
    const bare = bareOf(1);
    const garden = [{ id: 'hoehle:dachs:2', species: 'dachs' as const }];
    const s = initialState(bare, { garden });
    expect(s.animals.filter((a) => a.realm === 'hoehle')).toEqual([]);
    expect(s.garden).toEqual(garden);
    expect(ALL.some(({ id }) => bare.spawns.has(id))).toBe(false);
  });

  it('mit dem Paket: die Tiere laufen frei in der Grotte, das erste je Art nah an seinem Fundort, drei Fledermäuse hängen', () => {
    const bad: string[] = [];
    for (const seed of SEEDS) {
      const w = worldOf(seed, CAVE);
      const s = initialState(w, {});
      const cave = s.animals.filter((a) => a.realm === 'hoehle');
      if (cave.length !== 32) bad.push(`${seed}: ${cave.length} Tiere`);
      for (const { species } of CAVE_ANIMALS) {
        const a = cave.find((t) => t.id === animalId('hoehle', species));
        const home = w.spawns.get(animalId('hoehle', species))!;
        if (!a || a.mode !== 'wander') bad.push(`${seed} ${species}: läuft nicht frei`);
        else if (cheb(a.x, a.y, home[0], home[1]) > 4) bad.push(`${seed} ${species}: zu weit vom Fundort`);
      }
      // auch so, wie der Entwickler-Schalter die Tiere bringt: das Paket kommt erst nach dem Start
      const late = SAMPLE_SEEDS.includes(seed)
        ? [['Start', s] as const, ['Schalter', attachPack(initialState(bareOf(seed), {}), w)] as const]
        : [['Start', s] as const];
      for (const [how, st] of late) {
        const hanging = st.animals.filter((a) => roostAt(a, w.cell(a.x, a.y)) !== undefined);
        if (hanging.length !== 3) bad.push(`${seed} ${how}: ${hanging.length} hängen`);
        if (hanging.some((a) => a.species !== 'fledermaus')) bad.push(`${seed} ${how}: eine andere Art am Sitzplatz`);
        const onPerch = st.animals.filter((a) => a.species !== 'fledermaus' && w.cell(a.x, a.y).perch !== undefined);
        if (onPerch.length) bad.push(`${seed} ${how}: ${onPerch.map((a) => a.id).join(', ')} am Sitzplatz`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('gefundene Höhlen-Tiere wohnen auf der Mooswiese am Höhlenbett', () => {
    const w = worldOf(1, CAVE);
    const garden = Object.keys(CAVE_SPECIES).map((species) => ({
      id: animalId('hoehle', species as 'dachs'),
      species: species as 'dachs',
    }));
    const s = initialState(w, { garden });
    const meadow = new Set(meadowSpots(w, 'hoehle').map(key));
    const home = s.animals.filter((a) => a.mode === 'home');
    expect(home).toHaveLength(8);
    for (const a of home) {
      expect(meadow.has(key([a.x, a.y])), a.id).toBe(true);
      expect(w.realm(a.x, a.y), a.id).toBe('hoehle');
    }
    const [bx, by] = w.homes.hoehle.bed;
    for (const a of home) expect(cheb(a.x, a.y, bx, by), a.id).toBeLessThanOrEqual(GROTTE.flat + 1);
  });
});

describe('Sammeln in der Grotte: Futter und „fertig“', () => {
  const species = Object.keys(CAVE_SPECIES) as (keyof typeof CAVE_SPECIES)[];
  const garden = species.map((sp) => ({ id: animalId('hoehle', sp), species: sp }));

  it('„fertig“ heißt wie überall: von jeder der acht Arten wohnt eines zu Hause', () => {
    expect(full({ garden }, hoehle)).toBe(true);
    for (const sp of species) expect(full({ garden: garden.filter((g) => g.species !== sp) }, hoehle), sp).toBe(false);
    // ein zweites Tier derselben Art ersetzt keine fehlende
    const twice = [...garden.slice(1), { id: animalId('hoehle', 'dachs', 1), species: 'dachs' as const }];
    expect(full({ garden: twice }, hoehle)).toBe(false);
  });

  it('Pilze in die Pilzschale am Höhlenbett: alle acht Tiere der Mooswiese freuen sich, die Pilzfresser naschen; am Steintrog die Moosfresser', () => {
    const w = worldOf(1, CAVE);
    const s0 = initialState(w, { garden });
    const into = (target: readonly [number, number], hands: Partial<State>) => {
      for (const [dir, [dx, dy]] of Object.entries(DIRS) as [Dir, readonly [number, number]][]) {
        const at = [target[0] - dx, target[1] - dy] as const;
        const c = w.cell(...at);
        if (c.solid || c.ground === 'water' || s0.animals.some((a) => a.x === at[0] && a.y === at[1])) continue;
        const s: State = { ...s0, ...hands, sleeping: false, wokeAt: -1e9, player: { x: at[0], y: at[1], dir } };
        return step(s, w, { type: 'move', dir }).events;
      }
      throw new Error('kein Platz neben dem Trog');
    };
    const home = w.homes.hoehle;
    const fed = into(home.food, { shrooms: true }).find((e) => e.type === 'feed');
    expect(fed && fed.type === 'feed' && fed.food).toBe('pilze');
    const ids = fed?.type === 'feed' ? [...fed.ids].sort() : [];
    expect(ids).toEqual(garden.map((g) => g.id).sort());
    expect(ids.filter((id) => snaps(id, 'pilze')).length).toBe(4);
    const poured = into(home.water, { bucket: true }).find((e) => e.type === 'pour');
    const drink = poured?.type === 'pour' ? poured.ids : [];
    expect(drink.filter((id) => snaps(id, 'water')).map((id) => CAVE_FOOD[id.split(':')[1] as 'dachs'])).toEqual(
      Array(4).fill('tropfmoos'),
    );
  });
});

describe('Fledermäuse hängen kopfüber im Kristallbogen', () => {
  const w = worldOf(1, CAVE);
  const s0 = initialState(w, {});
  const bats = (s: State) => s.animals.filter((a) => a.species === 'fledermaus');

  it('drei der vier Fledermäuse hängen an den drei Sitzplätzen unter dem Bogen, die vierte fliegt frei', () => {
    const perches = new Set(perchesOf(w, 'hoehle').map(key));
    const hanging = bats(s0).filter((a) => roostAt(a, w.cell(a.x, a.y)) !== undefined);
    expect(hanging).toHaveLength(3);
    for (const a of hanging) expect(perches.has(key([a.x, a.y])), a.id).toBe(true);
    expect(hanging.map((a) => a.id)).toContain(animalId('hoehle', 'fledermaus'));
    // sonst steht kein Tier an einem Sitzplatz
    for (const a of s0.animals.filter((t) => t.species !== 'fledermaus'))
      expect(perches.has(key([a.x, a.y])), a.id).toBe(false);
  });

  it('wer hängt, bleibt hängen (Takte vergehen), bis die Figur hineinläuft: dann folgt sie und fliegt', () => {
    let s: State = { ...s0, sleeping: false };
    const before = bats(s).map((a) => [a.id, a.x, a.y]);
    for (let i = 0; i < 300; i++) s = step(s, w, { type: 'tick' }).state;
    const hangingBefore = before.filter(([, x, y]) => w.cell(x as number, y as number).perch !== undefined);
    for (const [id, x, y] of hangingBefore) {
      const a = s.animals.find((t) => t.id === id)!;
      expect([a.x, a.y], String(id)).toEqual([x, y]);
    }
    // die Figur läuft von unten in die erste Fledermaus hinein
    const bat = s.animals.find((t) => t.id === animalId('hoehle', 'fledermaus'))!;
    s = { ...s, player: { x: bat.x, y: bat.y + 1, dir: 'n' } };
    s = step(s, w, { type: 'move', dir: 'n' }).state;
    const met = s.animals.find((t) => t.id === bat.id)!;
    expect(met.mode).toBe('follow');
    expect(roostAt(met, w.cell(met.x, met.y))).toBeUndefined();
  });

  it('andere Arten hängen nie, auch nicht auf einem Sitzplatz; die Fledermaus nur, solange sie frei umherläuft', () => {
    const perch = w.cell(...perchesOf(w, 'hoehle')[0]!);
    expect(roostAt({ species: 'dachs', mode: 'wander' }, perch)).toBeUndefined();
    expect(roostAt({ species: 'fledermaus', mode: 'wander' }, perch)).toBe(ARCH_PERCH);
    expect(roostAt({ species: 'fledermaus', mode: 'home' }, perch)).toBeUndefined();
    expect(roostAt({ species: 'fledermaus', mode: 'follow' }, perch)).toBeUndefined();
    expect(roostAt({ species: 'fledermaus', mode: 'wander' }, w.cell(...w.homes.hoehle.bed))).toBeUndefined();
  });

  it('das Paket trägt die Modelle der Höhlen-Tiere ein (fein, die Grundform als Umriss), die Fledermaus auch kopfüber', () => {
    for (const id of Object.keys(CAVE_MODELS) as (keyof typeof CAVE_MODELS)[]) {
      expect(SPECIES[id].parts, id).toBe(CAVE_FINE_MODELS[id]);
      expect(SPECIES[id].outline, id).toBe(CAVE_MODELS[id]);
    }
    expect(SPECIES.fledermaus.roost).toBe(CAVE_FINE_ROOST);
    expect(HOEHLE_PACK.roosts).toEqual({ fledermaus: CAVE_FINE_ROOST });
  });
});

describe('Höhlen-Tiere in der Anzeige', () => {
  const w = worldOf(1, CAVE);

  it('die Leiste zeigt in der Höhlenwelt genau ihre acht Arten in der Reihenfolge des Konzepts, gefunden und zu Hause', () => {
    const garden = [{ id: animalId('hoehle', 'dachs'), species: 'dachs' as const }];
    const s = { ...initialState(w, { garden }), met: [animalId('hoehle', 'grottenolm')] };
    const groups = slots(s, 'hoehle');
    expect(groups).toHaveLength(1);
    const bar = groups[0]!;
    expect(bar.map((x) => x.species)).toEqual(Object.keys(CAVE_SPECIES));
    const flags = Object.fromEntries(bar.map((x) => [x.species, [x.met, x.home]]));
    expect(flags.dachs).toEqual([true, true]);
    expect(flags.grottenolm).toEqual([true, false]);
    expect(flags.maulwurf).toEqual([false, false]);
    expect(bar.filter((x) => x.met)).toHaveLength(2);
  });

  it('das Fragezeichen über einer hängenden Fledermaus steht an ihrem Sitzplatz, nicht am leeren Boden darunter', () => {
    const perch = w.cell(...perchesOf(w, 'hoehle')[0]!);
    const bat = { species: 'fledermaus' as const, mode: 'wander' };
    const z = labelHeight(bat, perch, 0);
    const bottom = Math.min(...BAT_ROOST.map((p) => p[2])) * SPECIES.fledermaus.scale; // Unterkante des hängenden Modells
    expect(z).toBe(ARCH_PERCH + HANG_LABEL);
    expect(z).toBeGreaterThanOrEqual(ARCH_PERCH + bottom);
    // fliegt sie (gefunden) oder fehlt das Modell der Ruhehaltung, steht es wie bei jedem Tier über dem Kopf
    expect(labelHeight({ ...bat, mode: 'follow' }, perch, 0)).toBeCloseTo(1.05 * SPECIES.fledermaus.scale * 0.75);
    const roost = SPECIES.fledermaus.roost;
    SPECIES.fledermaus.roost = [];
    try {
      expect(hangAt(bat, perch)).toBeUndefined(); // ohne Modell zeigen die Ansichten sie am Boden statt unsichtbar
      expect(labelHeight(bat, perch, 0)).toBeCloseTo(1.05 * SPECIES.fledermaus.scale * 0.75);
      expect(roostAt(bat, perch)).toBe(ARCH_PERCH); // hängen bleibt sie trotzdem (der Spielstand hängt nicht an Modellen)
    } finally {
      SPECIES.fledermaus.roost = roost;
    }
  });
});
