// Kleine Lichtgeister in Bild und Ton (Konzept „Höhle nach dem ersten Spielen“, Punkt 9, Schritt 11), gleich für 2D und
// die Ebene über 3D: Je Bild bedenkt `GhostFx` die Geister nach ihrer Regel (mitwachsen-ghost.ts) und zeichnet sie über
// der Dunkelmaske, denn sie leuchten als Ganzes: ein pfirsichfarbener Tropfen mit warmem Rand, Wangen und
// geschlossenen lachenden Augen (sein Modell `GHOST_MODEL`), darunter ein weicher Schatten; in der Freudenrunde ein
// kleiner Sternenkranz in Weiß, Rosa und Lila, der sich dreht (bei reduzierter Bewegung steht er kurz still). Wo ein
// Geist nicht zu sehen ist, glimmen an seinem Platz drei ruhige Pünktchen (ausgeblendet, wie er eingeblendet wird).
// Nur an Erkundetem, nur in der Grotte. Die Töne (Kichern, Freudenrunde) merkt es sich, bis der Kern sie über
// `View2D.ambient` abholt (nur, solange gespielt wird; Altes verfällt). Nur Bild, kein Spielstand. Teil des Welt-Pakets
// der Höhlenwelt.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Höhle nach dem ersten Spielen“, Lichtgeister)

import { drawModel, type Projection } from '../../../../lib/games/front';
import { GHOST_MODEL } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-models';
import { GROTTE, GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import { contactShadow } from '../../mitwachsen-fine-2d';
import type { Box } from '../../mitwachsen-view';
import { drawBox } from '../../mitwachsen-view';
import type { World } from '../../mitwachsen-world';
import type { Scored } from '../../sfx';
import {
  ghostAt,
  hideoutsOf,
  joyful,
  lightsOf,
  startGhosts,
  stepGhosts,
  type Ghosts,
  type Hideout,
} from './mitwachsen-ghost';

const C = GROTTE_COLORS.ghost;
/** Halbbreite des weichen Flecks unter einem Geist (Felder), so breit wie der Tropfen */
export const GHOST_FOOT = 0.17;
/** So lange (ms) warten Töne der Geister auf den Kern, danach verfallen sie */
const STALE = 500;

/** Zustand, wie die Geister ihn lesen */
export type GhostState = {
  player: { x: number; y: number };
  lamp?: unknown;
  sleeping?: boolean;
  ride?: unknown;
};

/** Ein Geist im Bild: wo, wie sichtbar, seit wann seine Freudenrunde läuft (null: keine) */
export type ShownGhost = { x: number; y: number; z: number; alpha: number; joy: number | null };

/** Was die Geister sich fürs Bild merken: ihren Zustand je Welt und die Töne, bis der Kern sie abholt */
export class GhostFx {
  private world: object | null = null;
  ghosts: Ghosts = startGhosts([]);
  /** die Verstecke der Welt, zuletzt bedacht (für die Browser-Tests) */
  places: readonly Hideout[] = [];
  private tones: { at: number; tones: Scored[] }[] = [];

  /**
   * Ein Bild um `now`: bedenkt die Geister (`awake`: nicht Abend, nicht Nacht, die Figur wach) und liefert, was zu
   * zeichnen ist; außerhalb der Grotte schlafen sie (keine Lichter)
   */
  frame(world: World, s: GhostState | undefined, now: number, awake: boolean, reduced: boolean): ShownGhost[] {
    const hs = (this.places = hideoutsOf(world));
    if (this.world !== world) [this.world, this.ghosts] = [world, startGhosts(hs, now)];
    if (!s) return [];
    const step = stepGhosts(this.ghosts, hs, {
      now,
      player: s.player,
      lights: lightsOf(world, s),
      awake: awake && !s.sleeping,
    });
    this.ghosts = step.ghosts;
    if (step.tones.length) this.tones.push({ at: now, tones: step.tones });
    return this.ghosts.list.flatMap((g, i) => {
      const p = ghostAt(g, hs, now, reduced, i * 2.1);
      return p
        ? [
            {
              x: p.x,
              y: p.y,
              z: p.z,
              alpha: g.alpha * p.fade,
              joy: g.joy !== undefined && joyful(g, now) ? now - g.joy : null,
            },
          ]
        : [];
    });
  }

  /** Die Töne der Geister, die seit dem letzten Abholen dazukamen (ältere als `STALE` ms verfallen) */
  take(now: number): Scored[] {
    const fresh = this.tones.filter((t) => now - t.at <= STALE).flatMap((t) => t.tones);
    this.tones = [];
    return fresh;
  }
}

/** Drei ruhige Glimmerpünktchen am Platz eines Geists, den man nicht sieht: locker in einer Reihe, nie zwei nebeneinander über einem dritten (kein Gesicht im Dunkeln) */
export function glimmerBoxes(x: number, y: number, z: number): Box[] {
  return [
    [x - 0.2, y, z + 0.12, 0.05, 0.03, 0.05, C.glimmer, C.glimmer],
    [x, y, z + 0.28, 0.04, 0.03, 0.04, C.glimmer, C.glimmer],
    [x + 0.2, y, z + 0.18, 0.04, 0.03, 0.04, C.glimmer, C.glimmer],
  ];
}

/** Sternenkranz der Freudenrunde: sechs kleine Sterne im Kreis um den Geist, `ms` nach ihrem Beginn (still bei reduzierter Bewegung) */
export function wreathBoxes(g: { x: number; y: number; z: number }, ms: number, reduced: boolean): Box[] {
  const turn = reduced ? 0 : (ms / GROTTE.ghost.joy) * Math.PI;
  return Array.from({ length: 6 }, (_, i): Box[] => {
    const a = turn + (i * Math.PI) / 3;
    const [x, z] = [g.x + 0.42 * Math.cos(a), g.z + 0.22 + 0.32 * Math.sin(a)];
    const c = C.stars[i % C.stars.length]!;
    return [
      [x - 0.06, g.y - 0.05, z, 0.12, 0.02, 0.025, c, c],
      [x - 0.0125, g.y - 0.05, z - 0.05, 0.025, 0.02, 0.12, c, c],
    ];
  }).flat();
}

/** Wie sichtbar der Sternenkranz ist: bei reduzierter Bewegung nur kurz am Anfang, sonst bis zum Ende der Runde */
export const wreathAlpha = (ms: number, reduced: boolean) =>
  reduced ? (ms < GROTTE.ghost.joy / 2 ? 1 : 0) : Math.sin((Math.PI * ms) / GROTTE.ghost.joy);

/**
 * Die Geister zeichnen (über der Maske): wo einer zu sehen ist, Schatten, Tropfen und in der Freudenrunde der Kranz; wo
 * er (noch) nicht zu sehen ist, die Glimmerpünktchen. Nur an Erkundetem (`seen`)
 */
export function drawGhosts(
  ctx: CanvasRenderingContext2D,
  P: Projection,
  shown: readonly ShownGhost[],
  reduced: boolean,
  seen: (x: number, y: number) => boolean,
) {
  for (const g of shown) {
    if (!seen(g.x, g.y)) continue;
    const ground = g.z - 0.12;
    if (g.alpha < 1) {
      ctx.globalAlpha = 0.75 * (1 - g.alpha);
      for (const b of glimmerBoxes(g.x, g.y, ground)) drawBox(ctx, P, b);
    }
    if (g.alpha > 0) {
      ctx.globalAlpha = g.alpha; // weicher Fleck am Boden wie unter allen Körpern, eingeblendet mit dem Geist
      contactShadow(ctx, P, g.x, g.y, ground, GHOST_FOOT);
      drawModel(ctx, P, GHOST_MODEL, g.x, g.y, g.z, 's');
      if (g.joy !== null) {
        ctx.globalAlpha = g.alpha * wreathAlpha(g.joy, reduced);
        for (const b of wreathBoxes(g, g.joy, reduced)) drawBox(ctx, P, b);
      }
    }
    ctx.globalAlpha = 1;
  }
}
