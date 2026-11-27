// Feinheit der Bahn (Entwurf „Feine Grafik“, Issue 13): Zug aus Metall und Lack mit Radnaben, Nieten, Fensterrahmen,
// Puffern und Schlot mit Kranz, Stirnlampen und Nachtlicht leuchten nur an; Gleis mit Holz-Schwellen, Metall-Schienen,
// Prellbock aus Lack, weichem Fleck in 2D unter stehenden Teilen; Bahnhof Bär mit Holz, Grasdach und Lack-Schild, die
// Reihen bleiben Boden; Bahnhof Fledermaus mit leuchtenden Lampen; Tok mit Stoff, Lack, Holz, Metall, Fell, Tasche
// und Knöpfen, die Helmlampe leuchtet, sein Umriss bleibt; Glühwürmchen leuchten. Flache und schwebende Körper
// werfen keinen Fleck. Zusatzteile stecken in nichts und bleiben am Modell.
import { describe, expect, it, vi } from 'vitest';
import type { Part, Projection } from '../../../../lib/games/front';
import { BUILD2, RAIL_COLORS } from '../../../../data/games/worlds/bahn/mitwachsen-bahn';
import { BAT_COLORS, BAT_ROOF, BAT_SIGN, batRowParts } from '../../../../data/games/worlds/bahn/mitwachsen-bat-model';
import { TOK_COLORS, TOK_MODEL, TOK_SOLO } from '../../../../data/games/worlds/bahn/mitwachsen-tok-model';
import {
  ROOF,
  ROOF_POSTS,
  SIGN,
  STATION_COLORS,
  TRAIN_COLORS,
  carParts,
  rowParts,
  steamParts,
  type CarLook,
} from '../../../../data/games/worlds/bahn/mitwachsen-train-model';
import type { Cell, Rail } from '../../mitwachsen-cell';
import { silhouette } from '../../mitwachsen-hint-look';
import { withTok } from '../../mitwachsen-ride-save';
import type { RideAt } from '../../mitwachsen-ride-view';
import { initialState } from '../../mitwachsen-state';
import { placeRails, railFeet, type Box, type RailFoot } from '../../mitwachsen-view';
import { BAHN_PACK, HOEHLE_PACK, worldOf } from '../../test-worlds';
import { batBodies } from './mitwachsen-bat-look';
import { withBuilt } from './mitwachsen-built';
import { fireflies } from './mitwachsen-feast-look';
import { RAIL_FINE, railBoxes } from './mitwachsen-rail-look';
import { CAR_FOOT, stationBodies } from './mitwachsen-station-look';

const halos = (parts: readonly Part[]) => parts.filter((p) => p[9]?.halo);
const skinOf = (p: Part) => p[9]?.skin;
const lo = (p: Part): readonly number[] => [p[0], p[1], p[2]];
const size = (p: Part): readonly number[] => [p[3], p[4], p[5]];
const overlap = (a: Part, b: Part) =>
  [0, 1, 2].map((i) => Math.min(lo(a)[i]! + size(a)[i]!, lo(b)[i]! + size(b)[i]!) - Math.max(lo(a)[i]!, lo(b)[i]!));
const shared = (a: Part, b: Part) => overlap(a, b).reduce((v, o) => v * Math.max(0, o), 1);
const touching = (a: Part, b: Part) => overlap(a, b).every((o) => o >= -1e-6);
/** Zusatzteile, die in einem anderen Teil stecken (je Treffer beide Teile) */
const inside = (parts: readonly Part[], extra: (p: Part) => boolean) =>
  parts.flatMap((p, i) =>
    extra(p)
      ? parts
          .filter((q, j) => j !== i && shared(p, q) > 1e-6)
          .map((q) => `${JSON.stringify(p)} in ${JSON.stringify(q)}`)
      : [],
  );
const hull = (parts: readonly Part[]) =>
  [0, 1, 2].map((i) => [
    Math.min(...parts.map((p) => lo(p)[i]!)),
    Math.max(...parts.map((p) => lo(p)[i]! + size(p)[i]!)),
  ]);

const T = TRAIN_COLORS;
const LOOKS: readonly CarLook[] = [
  { kind: 'loco', tok: false, door: 0 },
  { kind: 'loco', tok: false, door: 0, lit: true, pennant: true },
  { kind: 'loco', tok: false, door: 0, night: true },
  { kind: 'mid', tok: false, door: 0 },
  { kind: 'mid', tok: false, door: 1, rider: true },
  { kind: 'mid', tok: false, door: 0, frame: -1 },
  { kind: 'rear', tok: true, door: -1 },
  { kind: 'rear', tok: false, door: 0, warm: true },
];
const DETAIL = new Set<string>([T.hub, T.rivet, T.rim, T.collar]);
/** Zusatzteile des Zugs: Naben, Nieten, Rahmen, Kranz und die Puffer (Radfarbe vorn vor der Lok) */
const isDetail = (p: Part) => DETAIL.has(p[6]) || (p[6] === T.wheel && p[0] >= 0.8 - 1e-9);

describe('Zug fein', () => {
  it('Kasten, Räder, Puffer und Schlot aus Metall, Fensterband, Zielfenster und offene Tür aus Lack, Wimpel aus Stoff', () => {
    for (const look of LOOKS) {
      const parts = carParts(look);
      const by = (colors: readonly string[]) => parts.filter((p) => colors.includes(p[6]));
      expect(by([...T.silver, T.wheel]).every((p) => skinOf(p) === 'metall')).toBe(true);
      expect(by([T.lila, T.front]).every((p) => skinOf(p) === (p[2] > 1 ? 'stoff' : 'lack'))).toBe(true); // Wimpel: Stoff
      expect(by([T.wheel]).filter((p) => p[2] < 0.1)).toHaveLength(4); // vier Räder
    }
  });

  it('Stirnlampen leuchten nur an, das Nachtlicht nach „Gute Nacht“; Wagen leuchten sonst nicht', () => {
    expect(halos(carParts(LOOKS[0]!))).toEqual([]);
    expect(halos(carParts(LOOKS[1]!)).map((p) => p[6])).toEqual([T.glow, T.glow]);
    expect(halos(carParts(LOOKS[2]!)).map((p) => p[6])).toEqual([T.night, T.night]);
    for (const look of LOOKS.slice(3, 6)) expect(halos(carParts(look))).toEqual([]);
    // im hinteren Wagen sitzt Tok: nur seine Helmlampe
    expect(halos(carParts(LOOKS[6]!)).map((p) => p[6])).toEqual([TOK_COLORS.lamp]);
  });

  it('Naben, Nieten, Rahmen, Puffer und Kranz sitzen auf dem Wagen, stecken in nichts und bleiben in der Hülle', () => {
    for (const look of LOOKS) {
      const parts = carParts(look);
      const details = parts.filter(isDetail);
      expect(details.filter((p) => p[6] === T.hub)).toHaveLength(4);
      expect(details.filter((p) => p[6] === T.rivet)).toHaveLength(12);
      expect(details.filter((p) => p[6] === T.collar)).toHaveLength(look.kind === 'loco' ? 1 : 0);
      expect(inside(parts, isDetail), look.kind).toEqual([]);
      const touches = (p: Part) => parts.some((q) => q !== p && !isDetail(q) && touching(p, q));
      expect(details.filter((p) => !touches(p) && p[6] !== T.collar)).toEqual([]);
      // nur Schlot und Kranz der Lok ragen über das Dach hinaus (dort steigt der Dampf auf)
      const base = hull(parts.filter((p) => !isDetail(p) && !(p[2] >= 0.96 && p[6] === T.silver[0])));
      const all = hull(parts.filter((p) => p[6] !== T.collar && !(p[2] >= 0.96 && p[6] === T.silver[0])));
      all.forEach(([a, b], i) => {
        expect(a).toBeGreaterThanOrEqual(base[i]![0]! - 0.05);
        expect(b).toBeLessThanOrEqual(base[i]![1]! + 0.05);
      });
    }
  });

  it('der Kranz liegt auf dem Schlot, der Dampf steigt darüber auf', () => {
    const loco = carParts(LOOKS[0]!);
    const collar = loco.find((p) => p[6] === T.collar)!;
    const stack = loco.find((p) => p[2] >= 0.96 && p[6] === T.silver[0])!;
    expect(collar[2]).toBeCloseTo(stack[2] + stack[5]);
    expect(touching(collar, stack)).toBe(true);
    for (const phase of [0, 1, 2, 3])
      expect(Math.min(...steamParts(phase).map((p) => p[2]))).toBeGreaterThanOrEqual(collar[2] + collar[5]);
  });

  it('auf der Seite der offenen Tür und des goldenen Rahmens fehlt das Stück Fensterrahmen davor', () => {
    const across = (look: CarLook, side: 1 | -1) =>
      carParts(look).filter((p) => p[6] === T.rim && Math.sign(p[1]) === side && p[0] > -0.33 && p[0] < 0.3);
    expect(across(LOOKS[3]!, 1)).toHaveLength(2);
    expect(across(LOOKS[4]!, 1)).toEqual([]);
    expect(across(LOOKS[4]!, -1)).toHaveLength(2);
    expect(across(LOOKS[5]!, -1)).toEqual([]);
  });
});

describe('Bahnhöfe fein', () => {
  it('Bahnhof Bär: Grasdach als Laub, Pfosten und Bank aus Holz, Schild aus Lack; die Reihen bleiben Boden', () => {
    expect(ROOF.map(skinOf)).toEqual(['blatt']);
    expect(ROOF_POSTS.every((p) => skinOf(p) === 'holz')).toBe(true);
    expect(SIGN.filter((p) => p[6] === STATION_COLORS.sign).map(skinOf)).toEqual(['lack']);
    expect(skinOf(SIGN[0]!)).toBe('holz'); // Pfosten
    expect([...rowParts(false), ...rowParts(true)].every((p) => p[9] === undefined)).toBe(true);
  });

  it('Bahnhof Fledermaus: der Schein der drei Kristall-Lampen leuchtet, Schild aus Lack, Stein ohne Muster', () => {
    const lit = halos(BAT_ROOF);
    expect(lit).toHaveLength(3);
    expect(lit.every((p) => p[6] === BAT_COLORS.glow && Math.max(p[3], p[4], p[5]) <= 0.6)).toBe(true);
    expect(BAT_SIGN.filter((p) => p[6] === BAT_COLORS.sign).map(skinOf)).toEqual(['lack']);
    expect(BAT_ROOF.filter((p) => BAT_COLORS.roof.includes(p[6] as never)).every((p) => !p[9])).toBe(true);
    expect(batRowParts(true).every((p) => p[9] === undefined)).toBe(true);
  });

  it('flache und schwebende Körper werfen keinen Fleck, die Wagen einen so breit wie sie', () => {
    const w = worldOf(1, [HOEHLE_PACK, BAHN_PACK], { bahn: { built: 2 } });
    const packs = withBuilt(withTok({}, { stage: 'offen', gefahren: true }), 2);
    const s = { ...initialState(w, { packs }), sleeping: false, wokeAt: -100 };
    const at: RideAt = { now: 0, frac: 1, reduced: false, lit: false };
    const all = [...stationBodies(s, w, at), ...batBodies(w, s)];
    const flat = all.filter((b) => !b.id.startsWith('ride:hoehle:') || b.id.endsWith(':dampf'));
    expect(flat.length).toBeGreaterThan(10);
    expect(flat.filter((b) => b.foot !== 0).map((b) => b.id)).toEqual([]);
    const cars = all.filter((b) => /^ride:hoehle:(loco|mid|rear)$/.test(b.id));
    expect(cars.map((b) => b.foot)).toEqual([CAR_FOOT, CAR_FOOT, CAR_FOOT]);
  });

  it('Glühwürmchen: das Hinterteil leuchtet, wenn es an ist; sie schweben ohne Fleck', () => {
    const trail = [0, 1, 2, 3].map((i) => [i, 0, 1] as const);
    const flies = fireflies(trail, { realm: () => 'hoehle' }, 0, false);
    expect(flies.length).toBe(4);
    expect(flies.every((b) => b.foot === 0)).toBe(true);
    for (const f of flies) expect(halos(f.parts).length).toBe(f.key.endsWith(':1') ? 1 : 0);
    expect(flies.some((f) => f.key.endsWith(':1'))).toBe(true);
  });
});

describe('Tok fein', () => {
  const DETAILS = new Set<string>([TOK_COLORS.pocket, TOK_COLORS.button]);
  it('Stoff, Lack, Holz, Metall und Fell je Farbe; die Helmlampe leuchtet, auch ohne Maulwurf', () => {
    const want: Record<string, string> = {
      [TOK_COLORS.shirt]: 'stoff',
      [TOK_COLORS.overall]: 'stoff',
      [TOK_COLORS.helm]: 'lack',
      [TOK_COLORS.brim]: 'lack',
      [TOK_COLORS.boot]: 'lack',
      [TOK_COLORS.wood]: 'holz',
      [TOK_COLORS.pick]: 'metall',
      [TOK_COLORS.stache]: 'fell',
      [TOK_COLORS.mole]: 'fell',
    };
    const wrong = TOK_MODEL.filter((p) => want[p[6]] && skinOf(p) !== want[p[6]]);
    expect(wrong).toEqual([]);
    for (const m of [TOK_MODEL, TOK_SOLO]) expect(halos(m).map((p) => p[6])).toEqual([TOK_COLORS.lamp]);
    expect(TOK_SOLO.some((p) => p[6] === TOK_COLORS.mole)).toBe(false);
  });

  it('Tasche und Knöpfe sitzen auf Latz und Trägern, stecken in nichts, der Umriss bleibt', () => {
    const extra = TOK_MODEL.filter((p) => DETAILS.has(p[6]));
    expect(extra).toHaveLength(3);
    expect(inside(TOK_MODEL, (p) => DETAILS.has(p[6]))).toEqual([]);
    const base = TOK_MODEL.filter((p) => !DETAILS.has(p[6]));
    expect(extra.every((p) => base.some((q) => touching(p, q)))).toBe(true);
    expect(silhouette(TOK_MODEL)).toEqual(silhouette(base));
    expect(extra.some((p) => p[6] === '#e6c35c')).toBe(false); // kein Gold an Tok
  });
});

describe('Gleis fein', () => {
  const at = (built: number) => ({ packs: { bahn: { built } }, reduced: false, work: undefined });
  const cell = (rail: Partial<Rail>): Cell =>
    ({ h: 1, ride: 'hoehle', rail: { stage: 1, ...rail } }) as unknown as Cell;
  const skins = (boxes: readonly Box[]) => boxes.map((b) => [b[6], b[9]?.skin]);

  it('Schwellen mit Holz, Schienen und Puffer mit Metall, Prellbock aus Lack, Grasdach des Portals als Laub', () => {
    const forms: Partial<Rail>[] = [
      { to: 'ns' },
      { to: 'ew' },
      { to: 'en' },
      { to: 'sw' },
      { to: 's', part: 'end' },
      { to: 'ns', part: 'portal' },
      { to: 'ew', part: 'cut' },
    ];
    const want: Record<string, string | undefined> = {
      [RAIL_COLORS.sleeper[0]]: RAIL_FINE.sleeper.skin,
      [RAIL_COLORS.rail[0]]: RAIL_FINE.rail.skin,
      [RAIL_COLORS.buffer[0]]: RAIL_FINE.buffer.skin,
      [RAIL_COLORS.pads]: RAIL_FINE.rail.skin,
      [RAIL_COLORS.grass[0]]: RAIL_FINE.grass.skin,
      [RAIL_COLORS.stone[0]]: undefined,
    };
    const seen = new Set<string>();
    for (const f of forms) {
      const boxes = railBoxes(cell(f), 2, 3, at(1))!;
      for (const [c, s] of skins(boxes)) {
        seen.add(c!);
        expect([c, s]).toEqual([c, want[c!]]);
      }
      expect(boxes.every((b) => b[8] === undefined)).toBe(true);
    }
    expect(seen).toEqual(new Set(Object.keys(want)));
  });

  it('weicher Fleck in 2D nur unter Prellbock und Pfeilern des Portals, nicht unter Schienen, Sturz und Einschnitt', () => {
    const feet = (f: Partial<Rail>) => railFeet({ h: 1 }, railBoxes(cell(f), 2, 3, at(1))!);
    expect(feet({ to: 'ns' })).toEqual([]);
    expect(feet({ to: 'ew', part: 'cut' })).toEqual([]);
    expect(feet({ to: 'ns', part: 'portal' })).toHaveLength(2);
    const [buffer] = feet({ to: 's', part: 'end' });
    expect(buffer).toBeDefined();
    const [x, y, z, foot] = buffer!;
    expect([Math.floor(x), Math.floor(y), z]).toEqual([2, 3, 1]);
    expect(foot).toBeGreaterThan(0.2);
    expect(foot).toBeLessThan(0.4);
    // Bau 2: der versinkende Prellbock wirft einen Fleck, der mit seiner Höhe stetig kleiner wird, bis er weg ist
    const [s0, s1] = BUILD2.sink;
    const sinking = (work: number) =>
      railFeet({ h: 1 }, railBoxes(cell({ to: 'sn', part: 'buffer' }), 2, 3, { ...at(2), work })!).map((f) => f[3]);
    const sizes = [0, 0.25, 0.5, 0.75].map((k) => sinking(s0 + k * (s1 - s0)));
    expect(sizes[0]).toEqual([foot]);
    expect(sizes.every((v) => v.length === 1)).toBe(true);
    const flat = sizes.map((v) => v[0]!);
    expect(flat.every((v, i) => i === 0 || (v < flat[i - 1]! && v > 0))).toBe(true);
    expect(flat[2]).toBeCloseTo(foot / 2, 6);
    expect(sinking(s1)).toEqual([]);
    // placeRails zeichnet sie vor dem Gleis, nur wenn ein Maler dafür da ist
    const shadow = vi.fn<(f: RailFoot) => void>();
    const c = cell({ to: 's', part: 'end' });
    const boxes = railBoxes(c, 2, 3, at(1))!;
    const ctx = {} as CanvasRenderingContext2D;
    const P: Projection = (px, py, pz) => [px, py - pz];
    const later: Box[] = [];
    expect(placeRails(ctx, P, c, () => boxes, later, shadow)).toBe(false);
    expect(shadow.mock.calls.map(([f]) => f)).toEqual(railFeet(c, boxes));
    expect(later).toEqual(boxes);
    expect(placeRails(ctx, P, c, () => boxes, [])).toBe(false);
  });
});
