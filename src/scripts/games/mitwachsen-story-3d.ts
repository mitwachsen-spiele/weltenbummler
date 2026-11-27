// Klangsteine in der 3D-Ansicht: die goldenen Noten, die über den Steinen schweben (der Stein selbst gehört zum Stück).
// Fein wie in 2D (mitwachsen-stone-look.ts): Lack mit Glanzpunkt, der Kopf leuchtet weich (`halos`, für den
// Leuchten-Durchgang an ihrem Platz). Wird nur mit der 3D-Ansicht nachgeladen.

import { Group, Mesh, MeshBasicMaterial } from 'three';
import type { HaloAt } from '../../lib/games/front';
import { Geo } from './mitwachsen-geo';
import { fineBox } from './mitwachsen-fine-chunk-3d';
import { placeHalos } from './mitwachsen-fine-bodies-3d';
import { heardStone, noteFloat } from './mitwachsen-story';
import { noteBoxes } from './mitwachsen-stone-look';
import { growOf } from './mitwachsen-gate-flora';
import type { Box } from './mitwachsen-view';
import type { GateId } from '../../data/games/mitwachsen';
import type { StoryId } from '../../data/games/mitwachsen-stories';
import type { World } from './mitwachsen-world';

/**
 * Die Note für 3D (um ihre Mitte unten, Größe 1): jeder Quader um seinen eigenen kleinen Betrag größer (`growOf`), so
 * liegen die Flächen von Kopf und Hals und die der zwei Fähnchen-Stücke nicht in einer Ebene (sonst flackerte die Note,
 * wenn sie sich dreht: Jeder Quader hat seinen eigenen Verlauf). Nur hier, damit `growOf` nicht in den Kern kommt
 */
export function noteSolid(): Box[] {
  return noteBoxes(0, 0, 0, 1).map(([x, y, z, w, d, h, ...rest], n) => {
    const e = growOf(n);
    return [x - e, y - e, z - e, w + 2 * e, d + 2 * e, h + 2 * e, ...rest];
  });
}

/**
 * Je Klangstein eine Note in vollem Gold, unabhängig von Sonne und Schatten; `update` lässt sie in jedem Bild schweben.
 * `material` bekommt von der 3D-Ansicht den Shader der feinen Dinge (Muster, Verlauf)
 */
export class StoneNotes {
  readonly group = new Group();
  readonly material = new MeshBasicMaterial({ vertexColors: true });
  /** Leuchten der Notenköpfe an ihrem Platz im letzten Bild */
  halos: (HaloAt & { id: string })[] = [];
  private glow: readonly HaloAt[] = [];
  private notes: { id: StoryId; mesh: Mesh; x: number; y: number; h: number }[] = [];

  build(world: World) {
    for (const { mesh } of this.notes) mesh.geometry.dispose();
    this.group.clear();
    const g = new Geo();
    for (const b of noteSolid()) fineBox(g, b); // jeder Quader ein wenig anders groß: kein Flackern
    const geometry = g.build();
    this.glow = g.halos;
    this.halos = [];
    this.notes = [...world.stones].map(([id, [x, y]]) => {
      const mesh = new Mesh(geometry, this.material);
      mesh.castShadow = true;
      this.group.add(mesh);
      return { id, mesh, x, y, h: world.cell(x, y).h };
    });
  }

  update(state: { heard: readonly StoryId[]; openGates: readonly GateId[] }, now: number, reduced: boolean) {
    this.halos = [];
    for (const n of this.notes) {
      const { z, scale } = noteFloat(now, n.x + n.y, heardStone(state, n.id), reduced);
      n.mesh.position.set(n.x + 0.5, n.h + z, n.y + 0.5);
      n.mesh.scale.setScalar(scale);
      n.mesh.rotation.y = reduced ? 0 : Math.sin(now / 900 + n.x) * 0.35; // dreht sich ein wenig hin und her
      const at = { x: n.x + 0.5, y: n.y + 0.5, z: n.h + z };
      this.halos.push(...placeHalos(this.glow, at, n.mesh.rotation.y, scale, `note:${n.id}`));
    }
  }
}
