// Gelände bleibt Block (Entwurf „Feine Grafik“): Dinge werden fein, die Blöcke des Geländes nicht. Ein Fingerabdruck
// hält fest, was die 3D-Ansicht vom Gelände baut: die Pixel des Textur-Atlas und je Fläche Lage, Richtung und Kachel
// (also auch die UV) eines festen Stücks Welt. Die Farben der Ecken gehören nicht dazu: Der weiche Schatten am Boden
// neben Höherem dunkelt sie ab, Textur und Form bleiben. Ändert sich ein Fingerabdruck, hat sich das Gelände geändert.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHUNK } from '../../lib/games/chunks';
import { World3D } from './mitwachsen-3d';
import { Geo, atlas } from './mitwachsen-geo';
import { grown } from './mitwachsen-growth';
import { Views3D } from './mitwachsen-view-3d';
import { stoneOf } from './mitwachsen-waystone';
import type { GateId } from '../../data/games/mitwachsen';
import type { World } from './mitwachsen-world';
import { EIS_PACK, HOEHLE_PACK, worldOf } from './test-worlds';

/** FNV-1a über einen Text, als Hex */
function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Gelände bleibt Block', () => {
  it('der Textur-Atlas des Geländes malt dieselben Pixel', () => {
    const log: string[] = [];
    const ctx = {
      fillStyle: '',
      globalAlpha: 1,
      fillRect(x: number, y: number, w: number, h: number) {
        log.push(`${ctx.fillStyle}@${ctx.globalAlpha}:${x},${y},${w},${h}`);
      },
    };
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
    atlas();
    expect(log.length).toBeGreaterThan(5000);
    expect(fnv(log.join('|'))).toBe('ac9b536d');
  });

  /**
   * Flächen des Geländes eines Stücks: Lage, Richtung und UV (also die Kachel) je Ecke, ohne Farbe. Was `terrain()`
   * als Quader baut (Seerosen, Randblüten), sind Dinge und zählt nicht.
   */
  function terrainOf(world: World, cx: number, cy: number, views: Views3D, opened: readonly GateId[]): string[] {
    const geos = [new Geo(), new Geo(), new Geo()];
    const only = (g: Geo) =>
      ({ quad: (...a: Parameters<Geo['quad']>) => g.quad(...a), box: () => {} }) as unknown as Geo;
    const view = Object.assign(Object.create(World3D.prototype) as object, { views, opened });
    const terrain = (World3D.prototype as unknown as Record<string, (...a: unknown[]) => void>).terrain!;
    for (let y = cy * CHUNK; y < (cy + 1) * CHUNK; y++)
      for (let x = cx * CHUNK; x < (cx + 1) * CHUNK; x++)
        terrain.call(view, ...geos.map(only), world, grown(world.seed, 0, x, y, world.cell(x, y)), x, y);
    return geos.map((g) => {
      if (g.empty) return '-';
      const b = g.build();
      const attr = (name: string) => Array.from(b.getAttribute(name).array, (v) => +v.toFixed(4)).join(',');
      return [attr('position'), attr('normal'), attr('uv'), Array.from(b.getIndex()!.array).join(',')].join('/');
    });
  }

  /** Fingerabdrücke der Stücke `pieces` (Anzahl der Flächen und FNV), nachdem sichergestellt ist, dass kein Wegstein darin liegt */
  function prints(world: World, pieces: readonly (readonly [number, number])[], views: Views3D, opened: GateId[]) {
    const ways = pieces.flatMap(([cx, cy]) =>
      Array.from({ length: CHUNK * CHUNK }, (_, i) =>
        stoneOf(world.cell(cx * CHUNK + (i % CHUNK), cy * CHUNK + Math.floor(i / CHUNK))),
      ).filter(Boolean),
    );
    expect(ways).toEqual([]); // ohne Wegsteine: Sie sind Dinge und werden fein
    return pieces.map(([cx, cy]) => {
      const layers = terrainOf(world, cx, cy, views, opened);
      return `${layers[0]!.split('/')[0]!.split(',').length / 12}:${fnv(layers.join('|'))}`;
    });
  }

  it('die Flächen fester Stücke der Lichtung liegen gleich, mit denselben Kacheln', () => {
    // Stück mit Gras, Sand, Stein, Wasser und getönten Feldern; Stück am Rand mit Hecke und Schiefer
    const pieces = [
      [0, 2],
      [-3, 3],
    ] as const;
    expect(prints(worldOf(1, []), pieces, new Views3D(), [])).toEqual(['347:be30b893', '385:531202cb']);
  });

  it('die Böden der Welten hinter den Toren (mit dem 3D-Teil ihres Pakets) liegen gleich, mit denselben Kacheln', async () => {
    const views = new Views3D();
    await views.use(EIS_PACK, () => {});
    await views.use(HOEHLE_PACK, () => {});
    // Eis-Welt: Schnee und Eis, Böden des Pakets
    expect(prints(worldOf(1, [EIS_PACK]), [[-6, -12]], views, ['eis'])).toEqual(['440:b473bd5e']);
    // Höhle: Wolken, Himmel, Basalt und Lava; Grotte mit Höhlenboden und Gras
    expect(
      prints(
        worldOf(1, [HOEHLE_PACK]),
        [
          [2, 6],
          [10, -3],
        ],
        views,
        ['hoehle'],
      ),
    ).toEqual(['389:e3ec6570', '436:bd38e0ff']);
  });
});
