// Bahnhof Fledermaus im Bild – rein, ohne DOM, gleich für 2D und 3D (Körper über den Haken
// `View2D.bodies`, wie Bahnhof Bär): die Reihen des Bahnsteigs aus lila geschichtetem Stein, das kleine, hohe Steindach (Platte als eigener Körper, zwei Pfosten hinten) mit
// Kristall-Lampen und dem Schild „Fledermaus auf Lila“ über den letzten beiden Reihen am fernen Ende (weg von der
// Sitzreihe, dort steigt die Figur aus, `batRoof` in mitwachsen-platform.ts). Kein Bau daneben (der Lokschuppen ist seit Issue 25 weg). Er steht, sobald die Welt mit Ausbau 2 gebaut ist (Bau 2: zum Augenblick `pop` wird sie neu gebaut, der
// Bahnsteig liegt dann eine Stufe über dem Gleis); vorher nichts. Wo alles steht,
// rechnet `batOf` je Welt einmal aus den Feldern. Keiner der Körper wirft einen weichen Fleck (`foot` 0): Reihen liegen
// flach, Dach und Schild schweben bzw. stehen auf dem Dach, die Pfosten stehen hinten. Teil des Pakets der Bahn (mitwachsen-station-look.ts).
// Spezifikation: docs/specs/mitwachsen.md („Tok und die Bahn“, Bau 2)

import { dirTo } from '../../mitwachsen-free';
import { BAT_POSTS, BAT_ROOF, BAT_SIGN, batRowParts } from '../../../../data/games/worlds/bahn/mitwachsen-bat-model';
import { ROOF_TOP, signAt } from '../../../../data/games/worlds/bahn/mitwachsen-train-model';
import type { Part } from '../../../../lib/games/front';
import type { RideBody } from '../../mitwachsen-ride-view';
import type { World } from '../../mitwachsen-world';
import { batPlatform, underRoof, type Platform, type Standing } from './mitwachsen-platform';

/** Bahnhof Fledermaus in einer Welt: Reihen des Bahnsteigs (Kante am Gleis, hinten), vom Gleis weg, Reihen unter dem Dach */
export type BatStation = Platform;

const memo = new Map<string, Part[]>();
const model = (k: string, make: () => Part[]) => memo.get(k) ?? (memo.set(k, make()), memo.get(k)!);

/**
 * Bahnhof Fledermaus aus den Feldern der Welt (je Welt einmal, `batPlatform`): null ohne Grotte oder solange der
 * Bahnsteig nicht über dem Gleis liegt (vor Ausbau 2)
 */
export const batOf = (world: World): BatStation | null => batPlatform(world);

/** Körper von Bahnhof Fledermaus (ab Ausbau 2 in der Welt; sonst leer) */
export function batBodies(world: World, state: Standing): RideBody[] {
  const st = batOf(world);
  if (!st) return [];
  const dir = dirTo(...st.side);
  const out: RideBody[] = st.rows.map(({ edge, back }, i) => {
    const k = `bahn:fels:${i % 2}`;
    const [x, y, z] = [(edge[0] + back[0]) / 2, (edge[1] + back[1]) / 2, world.cell(...edge).h];
    return { id: `bahn:fels:${i}`, key: k, x, y, z, dir, parts: model(k, () => batRowParts(i % 2 === 1)), foot: 0 };
  });
  const under = st.roof.flatMap((i) => (st.rows[i] ? [st.rows[i].edge, st.rows[i].back] : []));
  if (under.length === 4) {
    const x = under.reduce((s, p) => s + p[0], 0) / 4,
      y = under.reduce((s, p) => s + p[1], 0) / 4;
    const z = world.cell(...under[0]!).h;
    out.push(
      {
        id: 'bahn:felsdach',
        key: 'bahn:felsdach',
        x,
        y,
        z,
        dir,
        parts: BAT_ROOF,
        foot: 0,
        ...(underRoof(st, state) ? { sheer: true } : {}),
      },
      { id: 'bahn:felspfosten', key: 'bahn:felspfosten', x, y, z, dir, parts: BAT_POSTS, foot: 0 },
      {
        id: 'bahn:felsschild',
        key: 'bahn:felsschild',
        ...signAt(x, y, st.side),
        z: z + ROOF_TOP,
        dir: 's',
        parts: BAT_SIGN,
        foot: 0,
      },
    );
  }
  return out;
}
