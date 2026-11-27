// Schneespur des Schlittens in 3D: Plättchen aus den Marken, neu nur bei neuer Liste oder gelichtetem Nebel
import { describe, expect, it, vi } from 'vitest';
import { Color, Group, type Mesh } from 'three';
import type { Scene } from '../../mitwachsen-render';
import { initialState } from '../../mitwachsen-state';
import type { Box } from '../../mitwachsen-view';
import type { Layer } from '../../mitwachsen-view-3d';
import { EIS_PACK, worldOf } from '../../test-worlds';
import { withRide } from '../../mitwachsen-ride-save';
import { sledMarks } from './mitwachsen-sled-look';
import { joined, marksLayer } from './view-3d-sled';
import { printLayer } from './view-3d-prints';

const world = worldOf(1, [EIS_PACK]);
const state = initialState(world, { openGates: ['eis'] });
const sc = (explored: (x: number, y: number) => boolean) => ({ now: 0, reduced: false, explored }) as Scene;
const ALL = sc(() => true);

describe('Schneespur des Schlittens in 3D (view-3d-sled.ts)', () => {
  it('je Marke eine Fläche nach oben, knapp über ihr, in ihrer Farbe oben; im Nebel keine', () => {
    const boxes: Box[] = [
      [2, 3.26, 1, 1, 0.12, 0.014, '#000000', '#ff0000'], // Kufe mitten im Feld
      [7, 3, 2, 0.12, 1, 0.014, '#000000', '#00ff00'],
    ];
    const layer = marksLayer(() => boxes);
    layer.update(world, state, ALL);
    expect(layer.drawn()).toBe(2);
    const geo = layer.object.geometry;
    const pos = geo.getAttribute('position');
    // weicher Rand nur quer zur Spur: längs (eine ganze Feldlänge) bleibt sie hart und stößt ans nächste Feld
    expect([pos.getX(0), pos.getZ(0), pos.getX(3), pos.getZ(3)].map((v) => +v.toFixed(5))).toEqual([2, 3.24, 3, 3.4]);
    const uv = geo.getAttribute('uv');
    expect([uv.getX(0), uv.getY(0), uv.getX(3), uv.getY(3)]).toEqual([0.5, 0, 0.5, 1]);
    expect(pos.getY(0)).toBeGreaterThan(1.014); // knapp über der Marke
    expect(pos.getY(4)).toBeGreaterThan(2.014);
    const rgb = geo.getAttribute('color');
    const red = new Color('#ff0000');
    expect([rgb.getX(0), rgb.getY(0), rgb.getZ(0)]).toEqual([red.r, red.g, red.b]);
    expect(geo.getAttribute('normal').getY(5)).toBe(1);
    expect(geo.getIndex()!.count).toBe(12);
    // gleiche Liste, gleicher Nebel: nichts neu; lichtet sich der Nebel: neu gebaut
    layer.update(world, state, ALL);
    expect(layer.object.geometry).toBe(geo);
    const fog = marksLayer(() => boxes);
    fog.update(
      world,
      state,
      sc((x) => x < 5),
    );
    expect(fog.drawn()).toBe(1);
    const before = fog.object.geometry;
    fog.update(world, state, ALL);
    expect(fog.drawn()).toBe(2);
    expect(fog.object.geometry).not.toBe(before);
  });

  it('liest die Marken des Schlittens: keine, bis er erschienen ist', () => {
    const layer = marksLayer();
    layer.update(world, state, ALL);
    expect(layer.drawn()).toBe(0);
    const ready = { ...state, packs: withRide(state.packs, 'schlitten', 'bereit') };
    layer.update(world, ready, ALL);
    expect(layer.drawn()).toBe(sledMarks(ready, world).length);
    expect(layer.drawn()).toBeGreaterThan(0);
  });

  it('kommt mit dem 3D-Teil, zusammen mit den Fußspuren in einer Ebene; je Bild werden beide nachgeführt', async () => {
    const [ua, ub] = [vi.fn(), vi.fn()];
    const a: Layer = { object: new Group(), update: ua };
    const b: Layer = { object: new Group(), update: ub };
    const both = joined(a, b);
    expect(both.object.children).toEqual([a.object, b.object]);
    both.update(world, state, ALL);
    expect(ua).toHaveBeenCalledWith(world, state, ALL);
    expect(ub).toHaveBeenCalledWith(world, state, ALL);
    const { layer } = await EIS_PACK.view3d!();
    expect(layer!.object.children.some((c) => (c as Mesh).isMesh)).toBe(true);
    expect(layer!.object.children).toHaveLength(2);
  });

  it('beide durchsichtig in einer Ebene: die Schneespur kommt zuerst, die Fußspuren liegen über ihr', () => {
    const prints = printLayer({ seen: [], rev: 0 });
    const marks = marksLayer(() => []);
    expect(marks.object.renderOrder).toBeLessThan(prints.object.renderOrder);
    expect(prints.object.renderOrder).toBeLessThan(1); // der Bodenfleck unter Dingen (fine-bodies-3d) danach
  });
});
