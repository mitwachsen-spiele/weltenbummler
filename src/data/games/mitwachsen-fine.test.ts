// Feine Teile der Figur, der Tiere der Lichtung und des Getragenen: Muster über die Farbe, Zusatzteile in der Hülle
// ihres Modells, Leuchten nur an kompakten Teilen, Sitzende ohne Beine.
import { describe, expect, it } from 'vitest';
import type { Part } from '../../lib/games/front';
import { haloCompact } from '../../lib/games/shade';
import { SKINS } from '../../lib/games/skins';
import { BASKET_PARTS, BOOK_PARTS, BUCKET_PARTS, LOOK, REGIONS, SPECIES, figureParts } from './mitwachsen';
import { FISH_PARTS } from './mitwachsen-eis';
import { ANIMAL_FINE, CARRY_DRESS, FIGURE_LEGS, darker, dress, fine, fineFigure, fineSpecies } from './mitwachsen-fine';
import { JUG_PARTS, LANTERN_PARTS, SHROOM_BASKET_PARTS, SHROOM_COLORS } from './mitwachsen-hoehle';

const LICHTUNG = REGIONS[0].animals.map((a) => a.species);
/** Hülle eines Modells: [vorn min, max, rechts min, max, unten min, max] */
function hull(parts: readonly Part[]) {
  const h = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];
  for (const [f, r, z, fl, rw, ht] of parts) {
    h[0] = Math.min(h[0]!, f);
    h[1] = Math.max(h[1]!, f + fl);
    h[2] = Math.min(h[2]!, r);
    h[3] = Math.max(h[3]!, r + rw);
    h[4] = Math.min(h[4]!, z);
    h[5] = Math.max(h[5]!, z + ht);
  }
  return h;
}
/** Teile, die mehr als `tol` aus der Hülle ragen */
const outside = (parts: readonly Part[], h: number[], tol = 0.05) =>
  parts.filter(
    ([f, r, z, fl, rw, ht]) =>
      f < h[0]! - tol ||
      f + fl > h[1]! + tol ||
      r < h[2]! - tol ||
      r + rw > h[3]! + tol ||
      z < h[4]! - tol ||
      z + ht > h[5]! + tol,
  );
/** Gleiche Lage, Größe und Farbe (die Feinheit zählt nicht) */
const same = (a: Part, b: Part) => JSON.stringify(a.slice(0, 7)) === JSON.stringify(b.slice(0, 7));

describe('Feine Teile: Muster über die Farbe', () => {
  it('dress gibt Teilen dieser Farbe ihre Feinheit; Augen und Teile mit eigener Feinheit bleiben', () => {
    const eye: Part = [0, 0, 0, 0.1, 0.1, 0.1, '#111111', null, 'f'];
    const own: Part = [0, 0, 0, 0.1, 0.1, 0.1, '#111111', null, undefined, { halo: true }];
    const plain: Part = [0, 0, 0, 0.1, 0.1, 0.1, '#111111', '#222222'];
    const other: Part = [0, 0, 0, 0.1, 0.1, 0.1, '#333333'];
    const out = dress([eye, own, plain, other], { '#111111': { skin: 'fell' } });
    expect(out[0]).toBe(eye);
    expect(out[1]).toBe(own);
    expect(out[2]).toEqual([0, 0, 0, 0.1, 0.1, 0.1, '#111111', '#222222', undefined, { skin: 'fell' }]);
    expect(out[3]).toBe(other);
  });

  it('fine behält die Fläche mit Gesicht (Feld 8) und setzt nur die Feinheit', () => {
    const face: Part = [0, 0, 0, 0.1, 0.1, 0.1, '#111111', '#222222', 'f'];
    expect(fine(face, { halo: true })).toEqual([0, 0, 0, 0.1, 0.1, 0.1, '#111111', '#222222', 'f', { halo: true }]);
    expect(fine([0, 0, 0, 0.1, 0.1, 0.1, '#111111'], { skin: 'lack' })[7]).toBeNull();
  });

  it('darker macht jeden Kanal etwas dunkler', () => {
    expect(darker('#ffffff')).toBe('#f0f0f0');
    expect(darker('#e9b48e', 0.5)).toBe('#755a47');
  });
});

describe('Feine Figur', () => {
  const parts = figureParts(LOOK);
  const base = parts.filter((_, i) => i < 4 || (i >= FIGURE_LEGS && i < parts.length - 5));

  it('Sohlen gleich nach den Beinen: die ersten FIGURE_LEGS Teile sind die Beine, wer sitzt, zeigt keins davon', () => {
    expect(parts.slice(0, FIGURE_LEGS).every((p) => p[2] + p[5] <= 0.34)).toBe(true);
    expect(parts.slice(4, FIGURE_LEGS).every((p) => p[2] === 0 && p[5] < 0.03)).toBe(true); // Sohlen
    expect(parts.slice(FIGURE_LEGS).every((p) => p[2] >= 0.34)).toBe(true); // ab dem Hemd
  });

  it('Zusatzteile (Sohlen, Bündchen, Nase, Strähnen) liegen in der Hülle der Figur', () => {
    const extra = parts.filter((p) => !base.some((b) => same(b, p)));
    expect(extra).toHaveLength(7);
    expect(outside(extra, hull(base))).toEqual([]);
  });

  it('Stoff auf Hemd und Hose, Haar auf dem Haar, Lack auf den Schuhen; Haut und Augen ohne Muster', () => {
    const skinOf = (color: string) => new Set(parts.filter((p) => p[6] === color).map((p) => p[9]?.skin));
    expect(skinOf(LOOK.shirt)).toEqual(new Set(['stoff']));
    expect(skinOf(LOOK.pants)).toEqual(new Set(['stoff']));
    expect(skinOf(LOOK.hair)).toEqual(new Set(['haar']));
    expect(skinOf('#6b4a36')).toEqual(new Set(['lack']));
    expect(skinOf(LOOK.skin)).toEqual(new Set([undefined]));
    expect(parts.filter((p) => p[8] && p[9])).toEqual([]);
  });

  it('fineFigure baut aus dem Modell; ein anderes Aussehen färbt Nase und Bündchen mit', () => {
    const look = { ...LOOK, skin: '#c08060', shirt: '#aa3333' };
    const fig = fineFigure(look, figureParts(look).slice(0, 4));
    expect(fig.some((p) => p[6] === darker('#c08060'))).toBe(true);
    expect(fig.filter((p) => p[6] === '#aa3333')).toHaveLength(2);
  });

  it('Buch auf dem Schoß: Einband und Ärmel aus Stoff, Seiten ohne Muster', () => {
    const book = BOOK_PARTS(LOOK, true);
    expect(book.filter((p) => p[6] === '#c0453a').every((p) => p[9]?.skin === 'stoff')).toBe(true);
    expect(book.filter((p) => p[6] === '#e9e4d8').every((p) => !p[9])).toBe(true);
  });
});

describe('Feine Tiere der Lichtung', () => {
  it('jede der zwölf Arten hat einen Eintrag, und ihr größtes Teil trägt ein Muster', () => {
    expect(Object.keys(ANIMAL_FINE).sort()).toEqual([...LICHTUNG].sort());
    for (const id of LICHTUNG) {
      const big = [...SPECIES[id].parts].sort((a, b) => b[3] * b[4] * b[5] - a[3] * a[4] * a[5])[0]!;
      expect(big[9]?.skin, id).toBeDefined();
    }
  });

  it('Feinteile in der Hülle: kein Zusatzteil ragt mehr als 0,05 aus seinem Modell', () => {
    const errors: string[] = [];
    for (const id of LICHTUNG) {
      const { extra } = ANIMAL_FINE[id]!;
      const base = SPECIES[id].parts.slice(0, SPECIES[id].parts.length - extra.length);
      for (const p of outside(extra, hull(base))) errors.push(`${id}: ${JSON.stringify(p)}`);
    }
    expect(errors).toEqual([]);
  });

  it('Augen und Gesichtsteile bekommen nie ein Muster; Muster nur aus der Liste', () => {
    const all = LICHTUNG.flatMap((id) => SPECIES[id].parts);
    expect(all.filter((p) => p[8] && p[9])).toEqual([]);
    for (const p of all) if (p[9]?.skin) expect(SKINS).toContain(p[9].skin);
  });

  it('Arten ohne Eintrag bleiben, wie sie sind (ihre Modelle bringen die Welt-Pakete)', () => {
    const other = { id: 'x', parts: [[0, 0, 0, 1, 1, 1, '#cbbfae']] as Part[] };
    const out = fineSpecies({ x: other, hase: { id: 'hase', parts: [] as Part[] } });
    expect(out.x).toBe(other);
    expect(out.hase.parts).toHaveLength(ANIMAL_FINE.hase!.extra.length);
    expect(SPECIES.pinguin).toBeDefined();
  });
});

describe('Was die Figur trägt, fein', () => {
  it('Korb geflochten, Beeren und Fische glänzen, Eimer aus Metall, Netz mit Maschen', () => {
    const skinOf = (parts: readonly Part[], color: string) => parts.find((p) => p[6] === color)?.[9]?.skin;
    expect(skinOf(BASKET_PARTS, '#b0803c')).toBe('stoff');
    expect(skinOf(SHROOM_BASKET_PARTS, '#b0803c')).toBe('stoff');
    expect(skinOf(BASKET_PARTS, '#c8323a')).toBe('lack');
    expect(skinOf(BUCKET_PARTS, '#98a3ae')).toBe('metall');
    expect(skinOf(FISH_PARTS, '#d8cfb4')).toBe('quilt');
    expect(skinOf(FISH_PARTS, '#9fb4c8')).toBe('lack');
  });

  it('Eimer: der Rand liegt ringsum, das Wasser oben bleibt zu sehen', () => {
    const [bucket, ...rest] = BUCKET_PARTS;
    const top = bucket![2] + bucket![5];
    const [f0, f1, r0, r1] = [
      bucket![0] + 0.02,
      bucket![0] + bucket![3] - 0.02,
      bucket![1] + 0.02,
      bucket![1] + bucket![4] - 0.02,
    ];
    // kein Teil deckt die Mitte der Wasserfläche zu
    const covers = rest.filter(([f, r, z, fl, rw]) => z <= top && f < f1 && f + fl > f0 && r < r1 && r + rw > r0);
    expect(covers).toEqual([]);
  });

  it('Leuchten nur an kompakten Teilen: Kristall der Laterne und Hüte der Leuchtpilze; Kanne ohne', () => {
    const lit = [...LANTERN_PARTS, ...SHROOM_BASKET_PARTS].filter((p) => p[9]?.halo);
    expect(lit.map((p) => p[6]).sort()).toEqual(['#8fe0ea', ...SHROOM_COLORS].sort());
    for (const p of lit) expect(haloCompact(p[3], p[4], p[5])).toBe(true);
    expect(JUG_PARTS.some((p) => p[9])).toBe(false);
    for (const c of Object.keys(CARRY_DRESS)) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });
});
