import { describe, expect, it } from 'vitest';
import { GOLD } from './mitwachsen-portals';
import { REGIONS, SPECIES, WILD_SPECIES, speciesOf } from './mitwachsen';
import {
  CAVE_FOOD,
  CAVE_SPECIES,
  JUG_PARTS,
  MOSS_EATERS,
  SHROOM_BASKET_PARTS,
  SHROOM_COLORS,
  SHROOM_EATERS,
  type CaveSpeciesId,
} from './mitwachsen-hoehle';
import { ARCH_PERCH, CAVE_ANIMALS } from './worlds/hoehle/mitwachsen-cave-animals';
import { BAT_ROOST, CAVE_MODELS } from './worlds/hoehle/mitwachsen-cave-models';
import { GROTTE, GROTTE_COLORS } from './worlds/hoehle/mitwachsen-grotte';

const IDS = Object.keys(CAVE_SPECIES) as CaveSpeciesId[];
const hoehle = REGIONS.find((r) => r.id === 'hoehle')!;

describe('Tiere der Höhlenwelt', () => {
  it('acht Arten mit je vier Tieren wohnen in der Grotte (32), in der Reihe des Konzepts; keine in der Landschaft', () => {
    expect(IDS).toEqual([
      'maulwurf',
      'dachs',
      'grottenolm',
      'eidechse',
      'siebenschlaefer',
      'fledermaus',
      'murmeltier',
      'gluehwuermchen',
    ]);
    expect(IDS.map((id) => CAVE_SPECIES[id].name)).toEqual([
      'Maulwurf',
      'Dachs',
      'Grottenolm',
      'Sonnen-Eidechse',
      'Siebenschläfer',
      'Fledermaus',
      'Murmeltier',
      'Glühwürmchen',
    ]);
    expect(hoehle.animals.map((a) => a.species)).toEqual(IDS);
    expect(hoehle.herd * hoehle.animals.length).toBe(32);
    for (const id of IDS) {
      expect(SPECIES[id], id).toBe(CAVE_SPECIES[id]);
      expect(CAVE_SPECIES[id].id, id).toBe(id);
      for (const r of REGIONS.filter((g) => g.id !== 'hoehle'))
        expect(
          r.animals.some((a) => a.species === id),
          `${r.id}:${id}`,
        ).toBe(false);
      expect(WILD_SPECIES, id).not.toContain(id);
      expect(speciesOf(`hoehle:${id}:4`)).toBe(id);
    }
  });

  it('Töne wie im Konzept (der Dachs auf A3 mit 220 Hz, nicht 110), Wellenform, Länge und Lautstärke', () => {
    const tone = (id: CaveSpeciesId) => CAVE_SPECIES[id].tone;
    expect(tone('maulwurf')).toMatchObject({ notes: [293.66, 329.63], wave: 'triangle', len: 0.12 }); // D4–E4
    expect(tone('dachs')).toMatchObject({ notes: [220], wave: 'triangle', slide: 0.9, len: 0.3 }); // A3
    expect(tone('grottenolm')).toMatchObject({ notes: [261.63], wave: 'sine', slide: 0.7 }); // C4, „blubb“
    expect(tone('eidechse')).toMatchObject({ notes: [392, 392], wave: 'triangle', len: 0.04 }); // G4 zweimal, „tik-tik“
    expect(tone('siebenschlaefer')).toMatchObject({ notes: [440, 523.25, 440], wave: 'sine', len: 0.07 }); // Triller
    expect(tone('fledermaus')).toMatchObject({ notes: [659.25, 783.99], wave: 'sine', len: 0.06, gain: 0.05 });
    expect(tone('murmeltier')).toMatchObject({ notes: [880], wave: 'sine', len: 0.18 }); // A5
    expect(tone('gluehwuermchen')).toMatchObject({ notes: [1046.5, 1318.51], wave: 'sine', gain: 0.04 }); // C6–E6
    // keiner tiefer als 220 Hz: so tief klingen Lautsprecher von Handy und Tablet nicht
    for (const id of IDS) expect(Math.min(...tone(id).notes), id).toBeGreaterThanOrEqual(220);
  });

  it('Gangarten wie im Konzept', () => {
    expect(Object.fromEntries(IDS.map((id) => [id, CAVE_SPECIES[id].gait]))).toEqual({
      maulwurf: 'huschen',
      dachs: 'watscheln',
      grottenolm: 'robben',
      eidechse: 'huschen',
      siebenschlaefer: 'huepfen',
      fledermaus: 'flattern',
      murmeltier: 'huepfen',
      gluehwuermchen: 'flattern',
    });
  });

  it('Futter wie im Konzept: Pilze oder Tropfmoos', () => {
    expect(Object.keys(CAVE_FOOD)).toEqual(IDS);
    const shrooms = IDS.filter((id) => CAVE_FOOD[id] === 'pilze');
    expect(shrooms).toEqual(['maulwurf', 'dachs', 'siebenschlaefer', 'murmeltier']);
    expect([...SHROOM_EATERS]).toEqual(shrooms);
    expect([...MOSS_EATERS]).toEqual(IDS.filter((id) => !shrooms.includes(id)));
  });

  it('Leuchtpilze in Rosa, Türkis und Gelb, gleich im Korb, im Beet und in der Schale; Korb und Kanne ohne Gold', () => {
    expect(SHROOM_COLORS).toEqual(['#ff9cd4', '#6fd6f0', '#ffe08a']);
    expect(GROTTE_COLORS.shrooms).toBe(SHROOM_COLORS);
    const colors = (parts: typeof JUG_PARTS) => parts.flatMap((p) => p.slice(6));
    for (const c of SHROOM_COLORS) expect(colors(SHROOM_BASKET_PARTS)).toContain(c);
    const gold: unknown[] = Object.values(GOLD);
    expect([...colors(SHROOM_BASKET_PARTS), ...colors(JUG_PARTS)].filter((c) => gold.includes(c))).toEqual([]);
    expect(colors(JUG_PARTS)).toContain(GROTTE_COLORS.water[0]); // Tropfwasser oben in der Kanne
  });

  it('Fundorte (im Welt-Paket) wie im Konzept, in der Reihe der Leiste und innerhalb der Grotte; der Kern kennt keinen', () => {
    expect(CAVE_ANIMALS.map((a) => a.species)).toEqual(IDS);
    expect(hoehle.animals.every((a) => a.at === undefined)).toBe(true);
    expect(Object.fromEntries(CAVE_ANIMALS.map((a) => [a.species, a.near]))).toEqual({
      maulwurf: 'floor', // vorerst gegenüber dem Platz des Bahnhofs; später auf Toks Helm
      dachs: 'clay', // Lehmhang neben dem Pilzgarten
      grottenolm: 'jetty', // am Steg im See
      eidechse: 'scree', // Geröllhang
      siebenschlaefer: 'floor', // neben dem Platz des Lokschuppens
      fledermaus: 'arch', // Kristallbogen
      murmeltier: 'scree',
      gluehwuermchen: 'shrooms', // Pilzgarten
    });
    const { rx, ry } = GROTTE.shape;
    for (const { species, at } of CAVE_ANIMALS)
      expect((at[0] / rx) ** 2 + ((at[1] - ry) / ry) ** 2, species).toBeLessThan(1);
    // die Fledermaus genau unter dem Kristallbogen (Mitte), der Grottenolm vorn am Steg
    const { hall, lake } = GROTTE;
    expect(CAVE_ANIMALS.find((a) => a.species === 'fledermaus')!.at).toEqual([hall.across, hall.out + hall.arch - 3]);
    expect(CAVE_ANIMALS.find((a) => a.species === 'grottenolm')!.at).toEqual([lake.across, lake.out - lake.ry - 1]);
    // der Dachs auf seinem Lehmhang (zwei Stufen nach außen ab `clay.across`)
    const { clay } = GROTTE;
    const dachs = CAVE_ANIMALS.find((a) => a.species === 'dachs')!.at;
    expect(dachs[0]).toBeLessThanOrEqual(clay.across);
    expect(dachs[0]).toBeGreaterThan(clay.across - 2 * clay.step);
    expect(Math.abs(dachs[1] - clay.out)).toBeLessThanOrEqual(clay.long >> 1);
  });

  it('jedes Modell (im Welt-Paket) hat Augen, die zur Kamera zeigen können, und die Farben aus dem Konzept', () => {
    expect(Object.keys(CAVE_MODELS)).toEqual(IDS);
    const colors = (parts: readonly (readonly unknown[])[]) => new Set(parts.map((p) => p[6]));
    const WANT: Record<CaveSpeciesId, string[]> = {
      maulwurf: ['#2e2b33', '#f2a7b8'],
      dachs: ['#8a8f96', '#f2f0ea', '#2e2b33'],
      grottenolm: ['#f3ead8', '#e0605a'],
      eidechse: ['#5fb8a0', '#ffe08a'],
      siebenschlaefer: ['#b9bcc6'],
      fledermaus: ['#7a6a5e', '#f2a7b8', '#8a82b0'],
      murmeltier: ['#b08850'],
      gluehwuermchen: ['#d8ff6a'],
    };
    for (const id of IDS) {
      const faces = new Set(CAVE_MODELS[id].map((p) => p[8]).filter(Boolean));
      expect([...faces].sort(), id).toEqual(['f', 'l', 'r']);
      for (const c of WANT[id]) expect(colors(CAVE_MODELS[id]).has(c), `${id}: ${c}`).toBe(true);
      // kindgerecht: keine weißen Zähne (Weiß nur als Glanzpunkt in den Augen)
      const white = CAVE_MODELS[id].filter((p) => p[6] === '#ffffff' && !p[8]);
      expect(white, id).toEqual([]);
    }
  });

  it('nur die Fledermaus hängt kopfüber: ihr Modell dazu hängt von z = 0 nach unten, Füße oben, Gesicht unten', () => {
    expect(IDS.filter((id) => CAVE_SPECIES[id].roost !== undefined)).toEqual(['fledermaus']);
    for (const p of BAT_ROOST) expect(p[2] + p[5], JSON.stringify(p)).toBeLessThanOrEqual(1e-9);
    const top = Math.max(...BAT_ROOST.map((p) => p[2] + p[5]));
    expect(top).toBeCloseTo(0);
    const feet = BAT_ROOST.filter((p) => p[2] + p[5] > -1e-9).map((p) => p[6]);
    expect(feet).toEqual(['#2e2b33', '#2e2b33']);
    const eyes = BAT_ROOST.filter((p) => p[8]);
    const body = BAT_ROOST.find((p) => p[6] === '#7a6a5e')!;
    for (const e of eyes) expect(e[2]).toBeLessThan(body[2]); // das Gesicht unter dem Körper
    // hängt unter dem Kristallbogen und reicht nicht bis zum Boden
    expect(ARCH_PERCH + Math.min(...BAT_ROOST.map((p) => p[2])) * CAVE_SPECIES.fledermaus.scale).toBeGreaterThan(1.5);
  });
});
