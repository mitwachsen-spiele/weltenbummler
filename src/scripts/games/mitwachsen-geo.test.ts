import { describe, expect, it } from 'vitest';
import { Color, Matrix4, Vector3 } from 'three';
import { edgeAlpha, vertexShade } from '../../lib/games/shade';
import { SKINS, SKIN_PERIOD } from '../../lib/games/skins';
import { Geo, snapToShadowTexel, topCorners } from './mitwachsen-geo';

describe('Schatten rasten ein', () => {
  const offset = new Vector3(-9, 22, 7);
  const texel = 36 / 2048;
  const basis = new Matrix4().lookAt(offset, new Vector3(), new Vector3(0, 1, 0));
  const axis = (i: number) => new Vector3().setFromMatrixColumn(basis, i);

  it('legt das Ziel quer zum Licht auf ganze Pixel der Schattenkarte, entlang des Lichts bleibt es', () => {
    for (const t of [new Vector3(0.3, 1, 0.7), new Vector3(-41.23, 2, 17.9), new Vector3(5.004, 1.5, -3.33)]) {
      const s = snapToShadowTexel(t, offset, texel);
      for (const i of [0, 1]) {
        const k = s.dot(axis(i)) / texel;
        expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-6);
      }
      expect(s.dot(axis(2))).toBeCloseTo(t.dot(axis(2)), 9);
      expect(s.distanceTo(t)).toBeLessThan(texel); // höchstens ein Pixel daneben
    }
  });

  it('bleibt bei kleinen Bewegungen der Figur quer zum Licht stehen und springt dann um ein Pixel', () => {
    // quer zum Licht zählt (entlang des Lichts verschiebt sich das Raster nicht)
    const across = (v: Vector3) => new Vector3(v.dot(axis(0)), v.dot(axis(1)), 0);
    const steps = Array.from({ length: 200 }, (_, i) =>
      across(snapToShadowTexel(new Vector3(i * 0.0005, 1, 0), offset, texel)),
    );
    const jumps = steps.slice(1).filter((s, i) => s.distanceTo(steps[i]!) > 1e-9);
    expect(jumps.length).toBeLessThan(10);
    expect(jumps.length).toBeGreaterThan(0);
  });

  it('mit der Kamera gedrehte Sonne: eingerastet im Lichtraum der gedrehten Sonne, gleiche Pixel bei kleinem Schritt', () => {
    for (const deg of [25, -65, 65, -155]) {
      const turned = offset.clone().applyAxisAngle(new Vector3(0, 1, 0), (deg * Math.PI) / 180);
      const b = new Matrix4().lookAt(turned, new Vector3(), new Vector3(0, 1, 0)); // so schaut die Schattenkamera
      const ax = (i: number) => new Vector3().setFromMatrixColumn(b, i);
      const s = snapToShadowTexel(new Vector3(12.34, 1, -7.89), turned, texel);
      for (const i of [0, 1]) {
        const k = s.dot(ax(i)) / texel;
        expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-6);
      }
      // ein kleiner Schritt der Kamera (ein Zehntel Pixel quer zum Licht, von der Mitte eines Pixels aus): dieselben
      // Pixel, das Raster steht
      const near = snapToShadowTexel(s.clone().addScaledVector(ax(0), texel / 10), turned, texel);
      const across = (v: Vector3) => [v.dot(ax(0)), v.dot(ax(1))].map((c) => Math.round(c / texel));
      expect(across(near)).toEqual(across(s));
    }
  });
});

describe('Baukasten: feine Dinge', () => {
  /** Werte eines Merkmals je Ecke */
  const rows = (g: Geo, name: string) => {
    const a = g.build().getAttribute(name);
    return Array.from({ length: a.count }, (_, i) =>
      Array.from({ length: a.itemSize }, (_, k) => +a.getComponent(i, k).toFixed(4)),
    );
  };

  it('Gelände bleibt, wie es ist: ohne Feinheit keine zusätzlichen Merkmale, eine Farbe je Fläche', () => {
    const g = new Geo();
    g.quad([0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0], [0, 1, 0], 'grassTop', new Color('#808080'));
    g.box(0, 0, 0, 1, 1, 1, '#808080');
    const built = g.build();
    expect(built.getAttribute('aFine')).toBeUndefined();
    expect(built.getAttribute('aSkin')).toBeUndefined();
    expect(new Set(rows(g, 'color').map((c) => c.join())).size).toBe(1);
  });

  it('dunkelt Ecken einer Fläche einzeln ab (weicher Schatten am Boden), die Kachel bleibt', () => {
    const plain = new Geo(),
      shaded = new Geo();
    const quad = (g: Geo, k?: readonly [number, number, number, number]) =>
      g.quad([0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0], [0, 1, 0], 'grassTop', new Color(1, 1, 1), k);
    quad(plain);
    quad(shaded, [1, 0.7, 1, 0.865]);
    expect(rows(shaded, 'uv')).toEqual(rows(plain, 'uv'));
    expect(rows(shaded, 'color').map((c) => c[0])).toEqual([1, 0.7, 1, 0.865]);
    expect(topCorners({ x0y0: 1, x1y0: 2, x1y1: 3, x0y1: 4 })).toEqual([4, 3, 2, 1]);
  });

  it('gibt einem feinen Quader Seitenverlauf, Oberseite hinten heller, Muster und Kante nur oben', () => {
    const g = new Geo();
    g.box(0, 0, 0, 0.5, 0.75, 0.25, '#ffffff', null, 'white', undefined, { skin: 'holz' });
    const color = rows(g, 'color').map((c) => c[0]!);
    const v = vertexShade();
    // Oberseite: vorn, vorn, hinten, hinten; dann vier Seiten: unten, unten, oben, oben
    expect(color.slice(0, 4)).toEqual([v.topFront, v.topFront, v.topBack, v.topBack].map((x) => +x.toFixed(4)));
    expect(color.slice(4, 8)).toEqual([v.sideBottom, v.sideBottom, v.sideTop, v.sideTop].map((x) => +x.toFixed(4)));
    const skin = rows(g, 'aSkin');
    const holz = SKINS.indexOf('holz') + 1;
    expect(skin[0]).toEqual([holz, edgeAlpha(), +(1 / SKIN_PERIOD.holz).toFixed(4)]); // oben mit Kante
    expect(skin[4]).toEqual([holz, 0, +(1 / SKIN_PERIOD.holz).toFixed(4)]); // Seite ohne Kante
    // Lage in der Fläche (Felder) und ihre Größe: oben 0,5 × 0,25, vorn 0,5 × 0,75
    const fine = rows(g, 'aFine');
    expect(fine.slice(0, 4)).toEqual([
      [0, 0, 0.5, 0.25],
      [0.5, 0, 0.5, 0.25],
      [0.5, 0.25, 0.5, 0.25],
      [0, 0.25, 0.5, 0.25],
    ]);
    expect(fine[6]).toEqual([0.5, 0.75, 0.5, 0.75]);
  });

  it('leuchtende Teile: halbe Schattierung, hellere Kante, Leuchten an der Mitte (nur kompakte)', () => {
    const g = new Geo();
    g.box(2, 1, 3, 0.2, 0.4, 0.2, '#ffe08a', null, 'white', undefined, { halo: true });
    g.box(0, 0, 0, 2, 0.2, 0.2, '#ffe08a', null, 'white', undefined, { halo: true }); // langer Streifen
    expect(g.halos).toEqual([{ x: 2.1, y: 3.1, z: 1.2, size: 0.4, color: '#ffe08a' }]);
    const color = rows(g, 'color').map((c) => c[0]!);
    expect(color[4]).toBeCloseTo(vertexShade(true).sideBottom, 3);
    expect(rows(g, 'aSkin')[0]![1]).toBeCloseTo(edgeAlpha(true));
  });

  it('kleine Teile ohne Kante; Modelle in ihrer Größe (Kante und Muster wie bei voller Größe)', () => {
    const g = new Geo();
    g.box(0, 0, 0, 0.1, 0.1, 0.1, '#ffffff', null, 'white', undefined, {});
    expect(rows(g, 'aSkin')[0]).toEqual([0, 0, 0]);
    const small = new Geo();
    small.box(0, 0, 0, 0.2, 0.2, 0.2, '#ffffff', null, 'white', undefined, { skin: 'fell' }, 0.5);
    expect(rows(small, 'aSkin')[0]![1]).toBe(0); // 0,1 groß gezeigt: keine Kante
    expect(rows(small, 'aFine')[1]).toEqual([0.1, 0, 0.1, 0.1]); // Fläche in gezeigter Größe
  });

  it('füllt Flächen vor dem ersten feinen Quader mit 0 auf (Gelände und Dinge in einer Geometrie)', () => {
    const g = new Geo();
    g.box(0, 0, 0, 1, 1, 1, '#808080');
    g.box(0, 1, 0, 0.5, 0.5, 0.5, '#808080', null, 'white', undefined, { skin: 'fell' });
    g.box(0, 2, 0, 1, 1, 1, '#808080');
    const skin = rows(g, 'aSkin');
    expect(skin).toHaveLength(60);
    expect(skin[0]).toEqual([0, 0, 0]);
    expect(skin[20]![0]).toBe(SKINS.indexOf('fell') + 1);
    expect(skin[59]).toEqual([0, 0, 0]);
    expect(rows(g, 'aFine')).toHaveLength(60);
  });
});
