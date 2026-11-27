// Grasbüschel der 3D-Ansicht (mitwachsen-3d.ts): gekreuzte Halm-Flächen in die Geometrie eines Stücks (Bäume und
// Büsche kommen als Quader aus mitwachsen-tree-look.ts, gleich für 2D und 3D). Gehört zur 3D-Ansicht und wird nur mit
// ihr nachgeladen (Three.js).

import { Color } from 'three';
import { cycle, hash } from '../../lib/games/rng';
import type { Geo } from './mitwachsen-geo';

/** Grasbüschel: `n` Paare gekreuzter Halm-Flächen auf dem Feld (x, y) in Höhe `h` */
export function tufts(blades: Geo, x: number, y: number, h: number, n: number) {
  // Normale nach oben: Halme sind von beiden Seiten gleich hell und nicht schwarz von hinten
  const greens = ['#4f9a3c', '#5fae45', '#6dbd47', '#468f37'].map((c) => new Color(c));
  for (let i = 0; i < n; i++) {
    const r = hash(3, x, y, i);
    const cx = x + 0.15 + (r % 70) / 100,
      cz = y + 0.15 + ((r >>> 8) % 70) / 100;
    const bh = 0.22 + ((r >>> 16) % 8) / 40;
    const s = 0.09;
    const c = cycle(greens, r);
    // zwei gekreuzte Halm-Flächen, von beiden Seiten sichtbar
    blades.quad(
      [cx - s, h, cz - s],
      [cx + s, h, cz + s],
      [cx + s, h + bh, cz + s],
      [cx - s, h + bh, cz - s],
      [0, 1, 0],
      'white',
      c,
    );
    blades.quad(
      [cx - s, h, cz + s],
      [cx + s, h, cz - s],
      [cx + s, h + bh * 0.85, cz - s],
      [cx - s, h + bh * 0.85, cz + s],
      [0, 1, 0],
      'white',
      c,
    );
  }
}
