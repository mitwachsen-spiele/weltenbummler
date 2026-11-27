// Tupfspinne und ihr Netz in Bild und Ton (Konzept „Höhle nach dem ersten Spielen“, Punkt 9, Schritt 12), gleich für 2D
// und 3D. Das Netz ist ein Ding auf einem Feld (`webBoxes`, Quader wie jede Deko der Grotte): zwei Felsnasen links und
// rechts, dazwischen wenige dicke, gestufte Fäden in Creme mit dunklem Rand, darauf fünf Perlen aus Tau in Rosa, Türkis,
// Lila, Hellgrün und Weiß-Blau. Kein weißes Gitter, kein Block. Die Spinne ist ein Körper je Bild (`View2D.bodies`, wie
// die Laterne; so baut 3D nichts neu): sie hängt vor ihrem Netz, ihre Haltung kommt aus `spiderPose`
// (mitwachsen-spider.ts), dazu ihr Faden nach oben. `SpiderFx` merkt sich, wann welches Netz gezupft wurde, spielt die
// Harfe (höchstens alle `GROTTE.web.gap` ms, „tipp-tipp“ nur, wenn sie wach ist und gerade nicht schon winkt) und
// zeichnet über der Maske das Leuchten der Perlen (`drawBeads`): beim Zupfen jede mit ihrem Ton, mit der Laterne in der
// Nähe reihum glitzernd (bei reduzierter Bewegung alle ruhig heller). Nur an Erkundetem. Nur Bild, kein Spielstand. Teil
// des Welt-Pakets der Höhlenwelt.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Höhle nach dem ersten Spielen“, Tupfspinne)

import type { Part, Projection } from '../../../../lib/games/front';
import type { Point } from '../../../../data/games/mitwachsen';
import { SPIDER_MODELS } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-models';
import { GROTTE, GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { Cell } from '../../mitwachsen-cell';
import type { RideBody } from '../../mitwachsen-ride-view';
import type { Box } from '../../mitwachsen-view';
import { drawBox } from '../../mitwachsen-view';
import type { World } from '../../mitwachsen-world';
import type { Scored } from '../../sfx';
import { beadFlash, beadTwinkle, greetMs, harpScore, spiderPose, tippScore, type Hang } from './mitwachsen-spider';

const W = GROTTE.web;
const C = GROTTE_COLORS.web;
const [FOOT, MID] = GROTTE_COLORS.stal;
/** Ebene der Fäden (vom Feld aus nach vorn): hinter der Spinne, die davor hängt */
const PLANE = 0.4;
/** Oberkante des Netzes über dem Boden: dort hängt der Faden der Spinne (hoch genug, dass man sie über der Figur sieht) */
export const WEB_TOP = 1.5;
/** So viel größer als ihr Modell hängt die Spinne am Netz (etwa ein halbes Feld hoch) */
export const SPIDER_SCALE = 1.3;

/** Perlen [quer im Feld, Höhe über dem Boden] von unten nach oben, je ein Ton der Harfe; seitlich, wo die Spinne sie nicht verdeckt */
export const BEADS: readonly Point[] = [
  [0.25, 0.45],
  [0.75, 0.45],
  [0.15, 1.12],
  [0.85, 1.12],
  [0.64, 1.42],
];

/** Stücke der Fäden [quer, Höhe, Breite, Höhe des Stücks]: Querfäden unten und oben, kurze Stücke in der Mitte an den Seiten, vier gestufte Speichen von der Mitte zu den Ecken */
const THREADS: readonly (readonly [number, number, number, number])[] = [
  [0.19, 0.4, 0.62, 0.05],
  [0.19, 1.4, 0.62, 0.06],
  [0.19, 0.9, 0.14, 0.05],
  [0.67, 0.9, 0.14, 0.05],
  ...[-1, 1].flatMap((side) =>
    [-1, 1].flatMap((up) =>
      [0, 1, 2, 3, 4].map((i): readonly [number, number, number, number] => [
        0.465 + side * (0.035 + 0.06 * i),
        0.875 + up * (0.05 + 0.1 * i),
        0.07,
        0.11,
      ]),
    ),
  ),
];

/**
 * Das Netz auf (x, y): zwei Felsnasen in den Farben der Stalagmiten, gestufte Fäden mit dunklem Rand (der Rand liegt
 * etwas größer dahinter), davor die Perlen. Nur in der Grotte
 */
export function webBoxes(c: Cell, x: number, y: number): Box[] | null {
  if (c.region !== 'hoehle') return null;
  const h = c.h;
  const nose = (dx: number): Box[] => [
    [x + dx, y + 0.3, h, 0.16, 0.24, WEB_TOP, FOOT, MID],
    [x + dx + 0.03, y + 0.34, h + WEB_TOP, 0.1, 0.16, 0.12, MID, MID],
  ];
  const r = 0.018; // Rand ringsum
  const threads = THREADS.flatMap(([dx, z, w, t]): Box[] => [
    [x + dx - r, y + PLANE, h + z - r, w + 2 * r, 0.03, t + 2 * r, C.rim, C.rim],
    [x + dx, y + PLANE + 0.03, h + z, w, 0.02, t, C.thread, C.thread],
  ]);
  const beads = BEADS.map(([dx, z], i): Box => [
    x + dx - 0.05,
    y + PLANE + 0.05,
    h + z - 0.045,
    0.1,
    0.04,
    0.1,
    C.beads[i]!,
    C.beads[i]!,
  ]);
  return [...nose(0.03), ...nose(0.81), ...threads, ...beads];
}

/** Teile der Spinne in ihrer Haltung, `lift` über dem Boden, mit dem Faden bis zur Oberkante des Netzes */
const partsOf = new Map<string, readonly Part[]>();
export function spiderParts({ pose, lift }: Hang): readonly Part[] {
  const k = `${pose}@${lift}`;
  const known = partsOf.get(k);
  if (known) return known;
  const S = SPIDER_SCALE;
  const body = SPIDER_MODELS[pose].map((p): Part => [
    p[0] * S,
    p[1] * S,
    p[2] * S + lift,
    p[3] * S,
    p[4] * S,
    p[5] * S,
    p[6],
    p[7],
    p[8],
    p[9], // Feinheit (Muster, Leuchten) bleibt
  ]);
  const top = lift + 0.3 * S;
  const thread: Part = [0.14, -0.015, top, 0.03, 0.03, Math.max(0.02, WEB_TOP - top), C.thread, C.thread];
  const parts = [...body, thread];
  partsOf.set(k, parts);
  return parts;
}

/** Netze, wie das Bild sie liest: ihre Felder (`webs` aus mitwachsen-spider.ts, je Welt einmal gesucht) */
type Webs = (world: World) => readonly Point[];

/** Was die Netze sich fürs Bild merken: wann welches gezupft wurde, wann die Spinne zu grüßen begann, ob sie schläft */
export class SpiderFx {
  private plucked = new Map<string, number>();
  private greeted = new Map<string, number>();
  /** schläft die Spinne gerade (abends, nachts, im Schlaf der Figur; je Bild aus `bodies`) */
  asleep = false;
  /** reduzierte Bewegung (je Bild aus `bodies`): dann dauert ihr Gruß nur so lange wie das Winken */
  private reduced = false;

  /**
   * Die Figur läuft gegen das Netz auf (x, y), um `now`: die Harfe (höchstens alle `gap` ms); ist die Spinne wach und
   * grüßt nicht schon, beginnt ihr Gruß mit „tipp-tipp“
   */
  pluck(x: number, y: number, now: number): Scored[] {
    const k = `${x},${y}`;
    if (now - (this.plucked.get(k) ?? -Infinity) < W.gap) return [];
    this.plucked.set(k, now);
    const since = now - (this.greeted.get(k) ?? -Infinity);
    if (this.asleep || since < greetMs(this.reduced)) return harpScore();
    this.greeted.set(k, now);
    return [...harpScore(), ...tippScore()];
  }

  /** Wie die Spinne am Netz (x, y) um `now` hängt */
  hang(x: number, y: number, now: number, reduced: boolean): Hang {
    return spiderPose(now - (this.greeted.get(`${x},${y}`) ?? -Infinity), reduced, this.asleep);
  }

  /**
   * Die Spinnen als Körper dieses Bilds (gleich für 2D und 3D): je Netz eine, vor ihm hängend. `asleep`: Abend, Nacht oder
   * die Figur schläft
   */
  bodies(world: World, webs: Webs, now: number, reduced: boolean, asleep: boolean): RideBody[] {
    [this.asleep, this.reduced] = [asleep, reduced];
    return webs(world).map(([x, y]) => {
      const hang = this.hang(x, y, now, reduced);
      return {
        id: `spider:${x},${y}`,
        key: `spider-${hang.pose}-${hang.lift}`,
        x,
        y,
        z: world.cell(x, y).h,
        dir: 's',
        parts: spiderParts(hang),
      };
    });
  }

  /** Wie hell Perle `i` am Netz (x, y) gerade leuchtet: mit ihrem Ton nach dem Zupfen, dazu mit der Laterne (`lamp`) */
  bead(x: number, y: number, i: number, now: number, lamp: boolean, reduced: boolean): number {
    const flash = beadFlash(now - (this.plucked.get(`${x},${y}`) ?? -Infinity), i);
    return Math.max(flash, lamp ? beadTwinkle(now, i, reduced) : 0);
  }
}

/** Zustand, wie die Perlen ihn lesen: die Figur und ihre Laterne */
type Lamp = { player: { x: number; y: number }; lamp?: unknown; sleeping?: boolean; ride?: unknown };

/**
 * Über der Maske: das Leuchten der Perlen jedes Netzes an Erkundetem (`seen`), etwas größer und heller als die Perle;
 * mit der Laterne glitzern sie nur, wenn die Figur höchstens `GROTTE.web.lamp` Felder entfernt ist
 */
export function drawBeads(
  ctx: CanvasRenderingContext2D,
  P: Projection,
  world: World,
  webs: readonly Point[],
  fx: SpiderFx,
  s: Lamp | undefined,
  now: number,
  reduced: boolean,
  seen: (x: number, y: number) => boolean,
) {
  for (const [x, y] of webs) {
    if (!seen(x, y)) continue;
    const near = !!s?.lamp && !s.sleeping && !s.ride && Math.hypot(s.player.x - x, s.player.y - y) <= W.lamp;
    const h = world.cell(x, y).h;
    BEADS.forEach(([dx, z], i) => {
      const a = fx.bead(x, y, i, now, near, reduced);
      if (a <= 0) return;
      ctx.globalAlpha = 0.85 * a;
      drawBox(ctx, P, [x + dx - 0.065, y + PLANE + 0.09, h + z - 0.065, 0.13, 0.02, 0.13, '#ffffff', '#ffffff']);
    });
  }
  ctx.globalAlpha = 1;
}
