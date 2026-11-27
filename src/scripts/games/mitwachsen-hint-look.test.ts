// „Noch nicht“ am Eistor im Bild: leerer goldener Umriss dessen, was fehlt (aus dem Modell der Art gerastert), wie er
// pulsiert und wie die Flügel in 3D wackeln. Gezeichnet wird gegen ein aufzeichnendes Canvas (ohne DOM).
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { REGIONS, SPECIES, type SpeciesId } from '../../data/games/mitwachsen';
import { TILE_W, projection, type Projection } from '../../lib/games/front';
import { hintShake } from './mitwachsen-gate-motion-3d';
import {
  HINT_MS,
  HINT_PX,
  HINT_Y,
  SIL,
  hintGlow,
  hintOutline,
  never,
  notYet,
  showHint,
  shapeOf,
  signOutline,
  silhouette,
} from './mitwachsen-hint-look';
import { GATES } from '../../data/games/mitwachsen';
import { GOLD } from '../../data/games/mitwachsen-portals';
import { HINT_AFTER, HINT_EVERY } from './mitwachsen-guide';
import { plateMid } from './mitwachsen-plate';
import { initialState, type State } from './mitwachsen-state';
import { worldOf } from './test-worlds'; // trägt auch die Modelle der Eis-Tiere ein (den Pinguin)

const LICHTUNG = REGIONS[0].animals.map((a) => a.species);
const ALL: SpeciesId[] = [...LICHTUNG, 'pinguin'];
/** Farben der Aktionsfarbe Gold aus tokens.css (die einzige, die „noch nicht“ zeigen darf) */
const TOKENS = readFileSync(new URL('../../styles/tokens.css', import.meta.url), 'utf8');
const token = (name: string) => TOKENS.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`))?.[1];

/** Canvas, das jedes Rechteck mit Farbe und Deckkraft aufzeichnet */
function recorder() {
  const rects: { x: number; y: number; w: number; h: number; color: string; alpha: number }[] = [];
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ x, y, w, h, color: this.fillStyle, alpha: this.globalAlpha });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rects, state: ctx };
}

describe('„Noch nicht“: Umriss dessen, was fehlt', () => {
  it('jede Art der Lichtung und der Pinguin: groß genug (16 Pixel lang oder hoch), mit Rand und Auge, alle verschieden', () => {
    const seen = new Set<string>();
    let eyed = 0;
    for (const sp of ALL) {
      const rows = silhouette(shapeOf(sp));
      const cols = rows[0]!.length;
      expect(
        rows.every((r) => r.length === cols),
        sp,
      ).toBe(true);
      expect(Math.max(rows.length, cols), sp).toBe(SIL);
      expect(Math.min(rows.length, cols), sp).toBeGreaterThanOrEqual(5); // kein Strich
      // ein leerer Umriss: innen bleibt das meiste frei, aber nicht alles (die Augen sind golden, sonst läse man ein „O“)
      const gold = rows
        .join('')
        .split('')
        .filter((c) => c === 'o').length;
      expect(gold, sp).toBeGreaterThan(SIL);
      const plain = silhouette(shapeOf(sp).filter((p) => p[8] !== 'r')); // ohne Augen der Seite
      const count = (rs: string[]) => rs.join('').split('o').length - 1;
      expect(count(rows), `${sp}: Auge`).toBeGreaterThanOrEqual(count(plain));
      if (count(rows) > count(plain)) eyed++; // das Auge sitzt innen (sonst liegt es auf dem Rand, wie beim Frosch)
      // Rand und Bild reichen bis an alle vier Seiten des Rasters (nichts abgeschnitten, nichts verschoben)
      expect(
        [rows[0], rows.at(-1)].every((r) => r!.includes('o')),
        sp,
      ).toBe(true);
      expect(
        [0, cols - 1].every((x) => rows.some((r) => r[x] === 'o')),
        sp,
      ).toBe(true);
      seen.add(rows.join('\n'));
    }
    expect(seen.size).toBe(ALL.length);
    expect(eyed).toBeGreaterThanOrEqual(ALL.length - 2);
  });

  it('Feinteile (Schnurrhaare, Nasenlöcher, Beine …) ändern den Umriss nie: er kommt aus der Grundform jeder Art', () => {
    for (const sp of LICHTUNG) {
      const base = shapeOf(sp);
      expect(base.length, sp).toBeLessThan(SPECIES[sp].parts.length); // jede Art der Lichtung hat Feinteile
      // die Grundform ist der Anfang des Modells (gleiche Quader, ohne Muster), die Feinteile kommen dahinter
      expect(
        SPECIES[sp].parts.slice(0, base.length).map((p) => p.slice(0, 7)),
        sp,
      ).toEqual(base.map((p) => p.slice(0, 7)));
    }
    // gezeichnet wird der Umriss der Grundform: bei der Biene ohne ihre feinen Beine unter dem Leib
    const P = projection(0, 0, 400, 300, 1);
    const gold = (rows: string[]) => rows.join('').split('o').length - 1;
    const r = recorder();
    vi.stubGlobal('document', { querySelector: () => null });
    showHint({ score: () => {} }, 'biene', 0)(r.ctx, worldOf(1), P, 400);
    vi.unstubAllGlobals();
    expect(r.rects).toHaveLength(2 * gold(silhouette(shapeOf('biene'))));
    expect(gold(silhouette(shapeOf('biene')))).not.toBe(gold(silhouette(SPECIES.biene.parts)));
  });

  it('der Hase hat Ohren: oben ragen zwei schmale Spitzen über den Kopf', () => {
    const rows = silhouette(shapeOf('hase'));
    const top = rows[0]!;
    expect(top.replace(/\./g, '').length).toBeLessThanOrEqual(4);
    expect(rows.at(-1)!.replace(/\./g, '').length).toBeGreaterThan(top.replace(/\./g, '').length);
  });

  it('pulsiert zweimal je 0,8 s über die Deckkraft, auch bei reduzierter Bewegung; die Flügel wackeln nur ohne', () => {
    expect([0, 400, 800, 1200, HINT_MS, -1].map((t) => +hintGlow(t).toFixed(3))).toEqual([0, 1, 0, 1, 0, 0]);
    expect(hintShake(150, false)).toBeCloseTo(1);
    expect(hintShake(950, false)).toBeCloseTo(1); // zweimal
    expect([0, 300, 500, 1100, HINT_MS].map((t) => +hintShake(t, false).toFixed(3))).toEqual([0, 0, 0, 0, 0]);
    expect([150, 950].map((t) => hintShake(t, true))).toEqual([0, 0]);
  });

  it('2D: im Zeichen der Tür, gold aus den Tokens (kein Rot), pixelgenau aus dem Umriss, nach 1,6 s nichts mehr', () => {
    const world = worldOf(1);
    const door = world.gates.get('eis')!;
    const [mx, my] = door.mid;
    const P = projection(mx + 0.5, my + 0.5, 400, 300, 1);
    const rows = silhouette(shapeOf('igel'));
    const gold = rows
      .join('')
      .split('')
      .filter((c) => c === 'o').length;
    const { ctx, rects, state } = recorder();
    hintOutline(ctx, world, P, 'eis', rows, 400);
    expect(state.globalAlpha).toBe(1); // danach wieder deckend
    expect(rects).toHaveLength(2 * gold); // je Pixel Schatten und Gold
    expect(new Set(rects.map((r) => r.color))).toEqual(new Set([token('gold-light'), token('gold-dark')]));
    expect(rects.map((r) => r.color)).not.toContain(token('error'));
    expect(rects.every((r) => r.alpha === 1)).toBe(true);
    const px = HINT_PX * TILE_W;
    for (const r of rects)
      expect([r.w, r.h].map((v) => +v.toFixed(6))).toEqual([+px.toFixed(6), +(HINT_PX * 40).toFixed(6)]);
    // Lage: mittig über der Tür, unten auf HINT_Y über dem Boden, so groß wie das Raster
    const golds = rects.filter((r) => r.color === token('gold-light'));
    const [left, right] = [Math.min(...golds.map((r) => r.x)), Math.max(...golds.map((r) => r.x + r.w))];
    expect(right - left).toBeCloseTo(rows[0]!.length * px);
    expect((left + right) / 2).toBeCloseTo(P(mx + 0.5, 0, 0)[0]);
    const bottom = Math.max(...golds.map((r) => r.y + r.h));
    const [, ground] = P(mx + 0.5, my + 0.5 - door.out[1] / 4, world.cell(mx, my).h + HINT_Y);
    expect(bottom).toBeCloseTo(ground);
    // jedes gezeichnete Pixel ist eins des Umrisses (Spalte, Zeile vom Rand aus)
    const top = Math.min(...golds.map((r) => r.y));
    const drawn = new Set(golds.map((r) => `${Math.round((r.x - left) / px)},${Math.round((r.y - top) / r.h)}`));
    const want = new Set(rows.flatMap((r, y) => [...r].flatMap((c, x) => (c === 'o' ? [`${x},${y}`] : []))));
    expect(drawn).toEqual(want);
    // halb ausgeblendet, dann vorbei
    const half = recorder();
    hintOutline(half.ctx, world, P, 'eis', rows, 200);
    expect(half.rects[0]!.alpha).toBeCloseTo(Math.SQRT1_2);
    for (const t of [0, HINT_MS, 1e9]) {
      const none = recorder();
      hintOutline(none.ctx, world, P, 'eis', rows, t);
      expect(none.rects, `${t} ms`).toEqual([]);
    }
  });

  it('zeigen: einmal „hm-hm?“, die Live-Region sagt es (auch denselben Text wieder), dann zeichnet es den Umriss', () => {
    vi.useFakeTimers();
    const world = worldOf(1);
    const played: unknown[] = [];
    const say = { textContent: 'alt' };
    vi.stubGlobal('document', { querySelector: (q: string) => (q === '.mw-say' ? say : null) });
    const draw = showHint({ score: (n) => void played.push(n) }, 'igel', 1000);
    expect(played).toEqual([notYet('eis')]);
    expect(say.textContent).toBe(''); // erst leeren …
    vi.advanceTimersByTime(150);
    expect(say.textContent).toBe('Noch nicht. Es fehlt noch: Igel'); // … dann setzen
    showHint({ score: () => {} }, 'igel', 7000);
    expect(say.textContent).toBe(''); // derselbe Text: wieder erst leer, sonst schwiege der Screenreader
    vi.advanceTimersByTime(150);
    expect(say.textContent).toBe('Noch nicht. Es fehlt noch: Igel');
    vi.useRealTimers();
    vi.stubGlobal('document', { querySelector: () => null });
    showHint({ score: () => {} }, 'igel', 7000); // ohne Live-Region: nur Ton und Bild, kein Fehler
    vi.unstubAllGlobals();
    const P = projection(0, 0, 400, 300, 1);
    const at = (now: number) => {
      const r = recorder();
      draw(r.ctx, world, P, now);
      return r.rects.length;
    };
    expect([at(1000), at(1400) > 0, at(2600)]).toEqual([0, true, 0]);
  });
});

describe('„Noch nicht“ an den Toren, die nie aufgehen: das Zeichen ihrer Welt', () => {
  // alle außer dem Eistor: auch das Höhlentor zeigt sein Zeichen, solange es zu ist und kein Hau-ruck läuft (`nope`)
  const NEVER = GATES.filter((g) => g.id !== 'eis').map((g) => g.id);

  it('Umriss des Bilds ihrer Portal-Plattform: 16 × 16, nur der Rand, je Welt verschieden, kein Tier', () => {
    const rows = NEVER.map(signOutline);
    expect(new Set(rows.map((r) => r.join())).size).toBe(NEVER.length);
    for (const [i, r] of rows.entries()) {
      expect(r, NEVER[i]).toHaveLength(SIL);
      for (const row of r) expect(row).toMatch(/^[o.]{16}$/);
      const on = (c: number, k: number) => r[k]?.[c] === 'o';
      const n = r.join('').split('o').length - 1;
      expect(n, NEVER[i]).toBeGreaterThan(12); // gut zu sehen
      expect(n, NEVER[i]).toBeLessThan(SIL * SIL * 0.6); // ein Umriss, keine Fläche
      // kein Pixel ganz innen: Jedes hat einen leeren Nachbarn (oder liegt am Rand des Bilds)
      for (let k = 1; k < SIL - 1; k++)
        for (let c = 1; c < SIL - 1; c++)
          if (on(c, k)) expect([on(c - 1, k), on(c + 1, k), on(c, k - 1), on(c, k + 1)].every(Boolean)).toBe(false);
    }
  });

  it('in 3D zur Front gedreht: entlang der Tür, volle Breite und von vorn richtig herum, an jeder Torlage', () => {
    const world = worldOf(1);
    const K = 40;
    for (const id of ['eis', 'hoehle', 'sand', 'lava'] as const) {
      const g = world.gates.get(id)!;
      // Kamera auf der Platte, Blick nach außen (`out`): rechts im Bild liegt (−out.y, out.x)
      const P: Projection = (x, y, z) => [
        200 + (x * -g.out[1] + y * g.out[0]) * K,
        300 - z * K - (x * g.out[0] + y * g.out[1]) * 4,
      ];
      const rows = signOutline(id);
      const { ctx, rects } = recorder();
      hintOutline(ctx, world, P, id, rows, 400);
      const golds = rects.filter((r) => r.color === GOLD.light);
      const left = Math.min(...golds.map((r) => r.x));
      const right = Math.max(...golds.map((r) => r.x + r.w));
      const used = rows.flatMap((r) => [...r].flatMap((c, x) => (c === 'o' ? [x] : [])));
      expect(right - left, id).toBeCloseTo((Math.max(...used) - Math.min(...used) + 1) * HINT_PX * K); // nicht gestaucht
      expect(
        golds.every((r) => r.w > 0),
        id,
      ).toBe(true); // nicht gespiegelt
      const top = Math.min(...golds.map((r) => r.y));
      const px = HINT_PX * K;
      const drawn = new Set(
        golds.map((r) => `${Math.round((r.x - left) / px) + Math.min(...used)},${Math.round((r.y - top) / px)}`),
      );
      const first = rows.findIndex((r) => r.includes('o'));
      const want = new Set(rows.flatMap((r, y) => [...r].flatMap((c, x) => (c === 'o' ? [`${x},${y - first}`] : []))));
      expect(drawn, id).toEqual(want); // jedes Pixel an seinem Platz, wie von vorn gelesen
    }
  });

  it('auf der Platte nach 1 s: „hm-hm?“, „Noch nicht.“, goldener Umriss am Tor zweimal, dann nichts; höchstens alle 5 s', () => {
    vi.useFakeTimers();
    const world = worldOf(1);
    const say = { textContent: '' };
    vi.stubGlobal('document', { querySelector: (q: string) => (q === '.mw-say' ? say : null) });
    const at = plateMid(world.gates.get('sand')!);
    const base = initialState(world, {});
    const on = (tick: number, still: number): State => ({
      ...base,
      sleeping: false,
      player: { x: at[0], y: at[1], dir: 'n' },
      tick,
      still,
    });
    const played: unknown[] = [];
    const sfx = { score: (n: unknown) => void played.push(n) };
    const ask = never();
    expect(ask(on(50, HINT_AFTER - 1), world, 1000, false, sfx)).toBeNull(); // noch keine Sekunde
    expect(ask(on(51, HINT_AFTER), world, 1000, false, sfx, undefined, { arrived: () => false })).toBeNull(); // Kamera dreht noch
    const h = ask(on(52, HINT_AFTER + 1), world, 1100, false, sfx, undefined, { arrived: () => true });
    expect(h?.id).toBe('sand');
    expect(played).toEqual([notYet('sand', true)]); // ohne Riegel: Das Tor hat keine Flügel
    vi.advanceTimersByTime(150);
    expect(say.textContent).toBe('Noch nicht.');
    const P = projection(0, 0, 400, 300, 1);
    const draw = (now: number) => {
      const r = recorder();
      h!.draw!(r.ctx, world, P, now);
      return r.rects;
    };
    expect(draw(1100)).toEqual([]);
    const lit = draw(1500);
    expect(lit.length).toBeGreaterThan(0);
    expect(new Set(lit.map((r) => r.color))).toEqual(new Set([GOLD.side, GOLD.light])); // nur Gold, nie Rot
    expect(draw(1100 + HINT_MS)).toEqual([]);
    // dasselbe Stehen: nichts Neues, nach 1,6 s ist es vorbei
    expect(ask(on(60, HINT_AFTER + 9), world, 1200, false, sfx)).toBe(h);
    expect(ask(on(60 + HINT_EVERY, HINT_AFTER + 9 + HINT_EVERY), world, 1100 + HINT_MS, false, sfx)).toBeNull();
    expect(played).toHaveLength(1);
    // neues Stehen nach mehr als 5 s: wieder, auch bei reduzierter Bewegung gleich
    expect(ask(on(52 + HINT_EVERY, HINT_AFTER), world, 9000, true, sfx)?.id).toBe('sand');
    expect(played.at(-1)).toEqual(notYet('sand', true));
    // neue Welt (der Takt läuft zurück): Das letzte Mal zählt nicht mehr
    expect(ask(on(HINT_AFTER, HINT_AFTER), world, 20000, false, sfx)?.id).toBe('sand');
    // am Eistor nichts (dort zeigt es, was fehlt)
    const eis = plateMid(world.gates.get('eis')!);
    const ice = { ...on(900, 300), player: { x: eis[0], y: eis[1], dir: 'n' as const } };
    expect(never()(ice, world, 30000, false, sfx)).toBeNull();
    // fehlt einem solchen Tor ein nächster Schritt aus einem Paket (am Höhlentor Tok): dessen Umriss, die Live-Region nennt ihn
    const cave = plateMid(world.gates.get('hoehle')!);
    const tok = { ...on(2000, HINT_AFTER), player: { x: cave[0], y: cave[1], dir: 'n' as const } };
    const shown = never()(tok, world, 40000, false, sfx, undefined, null, 'tok');
    expect(shown?.id).toBe('hoehle');
    vi.advanceTimersByTime(150);
    expect(say.textContent).toBe('Noch nicht. Es fehlt noch: Tok');
    const r = recorder();
    shown!.draw!(r.ctx, world, P, 40400);
    const signRects = recorder();
    never()(tok, world, 40000, false, sfx)!.draw!(signRects.ctx, world, P, 40400);
    expect(r.rects.length).toBeGreaterThan(0);
    expect(r.rects).not.toEqual(signRects.rects); // nicht das Zeichen der Welt
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
