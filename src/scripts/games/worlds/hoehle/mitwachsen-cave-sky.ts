// Leben in der Luft der Kristallgrotte, gleich für 2D und die Ebene über 3D (der Kern ruft es als `Sky.weather`, solange
// die Figur in der Grotte ist; die 3D-Ansicht reicht ihre eigene Projektion herein): der fallende Tropfen
// (mitwachsen-drips.ts), der Grottenolm am Steg (mitwachsen-olm-look.ts), die Fledermaus auf ihrer Runde und in 3D der
// helle Schein einer Säule, die gerade klingt (mitwachsen-chime-look.ts; in 2D leuchtet die Säule selbst), der Tropfen
// der fernen Tropfquelle als Glitzern und der eine Funke über einem vollen Pilzbeet (mitwachsen-spark.ts), die kleinen
// Lichtgeister in der Kristallhalle, nur im Licht der Laterne, sonst ihre Glimmerpünktchen (mitwachsen-ghost-look.ts), dazu der
// Lichtkreis um die Figur (mitwachsen-glow.ts; auch im Nebel, er gehört zur Figur), am Abend in 3D das golden-orange
// Licht der Schächte und die Fledermaus-Runden um den Schacht über dem Bett (mitwachsen-dusk-look.ts). Im Nebel zeigt
// sich sonst nichts. Über der Maske leuchten auch die Perlen der Netze der Tupfspinnen (mitwachsen-spider-look.ts). Bei reduzierter Bewegung kein Tropfen und keine Flugrunde. Wetter gibt es in der Grotte keins.
// Reihenfolge: erst was zur Welt gehört (Abend, Tropfen, Grottenolm, Fledermaus), dann die Dunkelmaske
// (mitwachsen-mask.ts), dann das Leuchten obendrauf (Lichtkreis, in 3D die klingende Säule, Glitzern, Funke, Lichtgeister); Zeichen, Herzen,
// Sprechblasen und Leiste zeichnet der Kern danach.
// Teil des Welt-Pakets der Höhlenwelt.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Schmuck der Grotte“)

import { drawModel, paintWith, painterOf, type Dir, type Part, type Projection } from '../../../../lib/games/front';
import { CAVE_FINE_MODELS } from '../../../../data/games/worlds/hoehle/mitwachsen-cave-fine';
import { CAVE_SPECIES } from '../../../../data/games/mitwachsen-hoehle';
import { GROTTE_COLORS } from '../../../../data/games/worlds/hoehle/mitwachsen-grotte';
import type { Sky } from '../../mitwachsen-view';
import { drawBox } from '../../mitwachsen-view';
import type { SkyScene } from '../../mitwachsen-sky';
import type { World } from '../../mitwachsen-world';
import { Fine2D, Sprites, modelExtent } from '../../mitwachsen-fine-2d';
import { columnBoxes } from './mitwachsen-cave-look';
import type { Chime } from './mitwachsen-chime-look';
import type { Drips } from './mitwachsen-drips';
import { OLM_MS, type Olm } from './mitwachsen-olm-look';
import { circleOf, drawCircle, type Circle } from './mitwachsen-glow';
import { drawDusk, type Dusk } from './mitwachsen-dusk-look';
import { caveMask, type MaskFx } from './mitwachsen-mask';
import { webs } from './mitwachsen-spider';
import { Spark, drawSpark, oneGlitter } from './mitwachsen-spark';
import { GhostFx, drawGhosts } from './mitwachsen-ghost-look';
import { SpiderFx, drawBeads } from './mitwachsen-spider-look';

/**
 * Was die Grotte sich fürs Bild merkt: Glockenspiel, Tropfen, Grottenolm, Tupfspinnen (`spider`, mitwachsen-spider-look.ts, in der Ansicht angelegt); Licht: seit wann die Figur die Laterne trägt
 * (`since`, ms; für das Wachsen des Lichtkreises) und der zuletzt gezeichnete Lichtkreis (`drawn`, für die Tests); am
 * Abend, welche Fledermäuse gerade Runden fliegen (`dusk`, mitwachsen-dusk-look.ts); die Dunkelmaske (`mask`,
 * mitwachsen-mask.ts, beim ersten Bild angelegt); der Funke über den Sammelstellen (`spark`, mitwachsen-spark.ts, beim ersten Bild angelegt);
 * die kleinen Lichtgeister (`ghost`, mitwachsen-ghost-look.ts, beim ersten Bild angelegt)
 */
export type CaveFx = {
  chime: Chime;
  drips: Drips;
  olm: Olm;
  spider?: SpiderFx;
  light: { since?: number; drawn?: Circle | null };
  dusk?: Dusk;
  mask?: MaskFx;
  spark?: Spark;
  ghost?: GhostFx;
  /** Bild-Cache der feinen Modelle in der Luft (Grottenolm, Fledermaus) in 2D, beim ersten Bild angelegt */
  sprites?: Sprites;
};

const [WATER, WATER_TOP] = GROTTE_COLORS.water;

/**
 * Szene, wie die Grotte sie liest: dazu, ob die 3D-Ansicht darunter liegt (dann leuchtet die Säule hier), und die Körper
 * (die Figur unter 'player': dort liegt der Lichtkreis)
 */
type CaveScene = SkyScene & {
  lit3d?: boolean;
  evening?: number;
  night?: number;
  bodies?: ReadonlyMap<string, { x: number; y: number; z: number; hop: number }>;
  rides?: Parameters<typeof caveMask>[2]['rides'];
};

/** Zustand, wie der Lichtkreis ihn liest */
type Lit = { sleeping: boolean; ride?: unknown; lamp?: unknown; player: { x: number; y: number } };

/**
 * Lichtkreis um die Figur, solange sie wach und zu Fuß in der Grotte ist (sonst null): mit der Laterne größer
 * (mitwachsen-glow.ts)
 */
export function circleNow(
  world: Pick<World, 'realm'>,
  state: Lit | undefined,
  fx: CaveFx,
  now: number,
  reduced: boolean,
) {
  if (!state || state.sleeping || state.ride || world.realm(state.player.x, state.player.y) !== 'hoehle') return null;
  return circleOf(!!state.lamp, fx.light.since, now, reduced);
}

/**
 * `Sky.weather` der Grotte: alles, was sich in ihrer Luft bewegt, darüber die Dunkelmaske, darüber das Leuchten
 * (Lichtkreis um die Figur, in 3D die klingende Säule)
 */
export function caveWeather(fx: CaveFx): Sky['weather'] {
  return (ctx, world, sc: CaveScene, P, state) => {
    // Abend (und Schlaf im Höhlenbett): Fledermäuse fliegen Runden um den Schacht über dem Bett; in 3D Abendlicht
    const model = fineModels(ctx, world, fx, sc, P);
    const fly = (x: number, y: number, z: number, dir: Dir) =>
      model(CAVE_FINE_MODELS.fledermaus, 'fledermaus', x, y, z, dir, CAVE_SPECIES.fledermaus.scale);
    fx.dusk = drawDusk(ctx, world, P, sc, state, fly);
    const seen = (x: number, y: number) => sc.explored(Math.round(x), Math.round(y));
    air(ctx, world, fx, sc, P, seen, model);
    caveMask(ctx, world, sc, P, state, (fx.mask ??= { fade: {} }), fx.light.since);
    const me = sc.bodies?.get('player');
    const circle = me ? circleNow(world, state, fx, sc.now, sc.reduced) : null;
    fx.light.drawn = circle;
    if (me && circle) drawCircle(ctx, P, { x: me.x, y: me.y, z: me.z + me.hop }, circle);
    if (sc.lit3d) glows(ctx, world, fx, sc, P, seen);
    // Licht über der Maske: ein Funke über einem vollen Pilzbeet oder der Tropfen der fernen Tropfquelle glitzert, nie beides
    const drop = sc.reduced ? null : fx.drips.falling(sc.now);
    const lit = oneGlitter(
      (fx.spark ??= new Spark()).now(world, state, sc.now, sc.reduced, seen),
      drop?.far && seen(drop.x, drop.y) ? drop : null,
    );
    if (lit.far) glint(ctx, P, lit.far);
    drawSpark(ctx, P, lit.spark);
    // die Perlen der Netze leuchten mit ihrem Ton und glitzern mit der Laterne (mitwachsen-spider-look.ts)
    drawBeads(ctx, P, world, webs(world), (fx.spider ??= new SpiderFx()), state, sc.now, sc.reduced, seen);
    // die kleinen Lichtgeister leuchten als Ganzes: über der Maske; abends schlafen sie (mitwachsen-ghost-look.ts)
    const ghosts = (fx.ghost ??= new GhostFx()).frame(world, state, sc.now, !((sc.evening ?? 0) > 0), sc.reduced);
    drawGhosts(ctx, P, ghosts, sc.reduced, seen);
  };
}

/** Zeichnet ein Modell in der Luft fein: Teile, Kennung (für den Bild-Cache), Mitte, Höhe, Richtung, Größe */
type ModelPen = (parts: readonly Part[], id: string, x: number, y: number, z: number, dir: Dir, scale: number) => void;
/** Maler der Modelle in der Luft (ihre Leuchten zählen nicht: keins von ihnen leuchtet) */
const PEN = new Fine2D();

/**
 * Modelle in der Luft der Grotte fein zeichnen (Entwurf „Feine Grafik“): in 2D aus dem Bild-Cache (`Sprites`, je Modell,
 * Richtung und Größe einmal gezeichnet, wie die Tiere), in 3D auf der Ebene direkt mit dem Maler (der Cache zeichnet von
 * vorn, die 3D-Projektion ist geneigt; es sind höchstens drei Modelle je Bild)
 */
function fineModels(ctx: CanvasRenderingContext2D, world: World, fx: CaveFx, sc: CaveScene, P: Projection): ModelPen {
  if (sc.lit3d)
    return (parts, _id, x, y, z, dir, scale) => {
      const before = painterOf(ctx);
      paintWith(ctx, PEN);
      drawModel(ctx, P, parts, x, y, z, dir, scale);
      paintWith(ctx, before ?? null);
      PEN.take(); // nichts davon leuchtet
    };
  const sprites = (fx.sprites ??= new Sprites(24));
  sprites.begin(ctx, world);
  return (parts, id, x, y, z, dir, scale) =>
    sprites.draw(
      ctx,
      P,
      `${id}|${dir}|${scale.toFixed(3)}`,
      [x, y, z],
      modelExtent(parts, scale),
      (c, Q) => drawModel(c, Q, parts, x, y, z, dir, scale),
      null,
    );
}

/** Was zur Welt gehört und unter der Maske liegt: der fallende Tropfen, der Grottenolm, die Fledermaus auf ihrer Runde */
function air(
  ctx: CanvasRenderingContext2D,
  world: World,
  fx: CaveFx,
  sc: CaveScene,
  P: Projection,
  seen: (x: number, y: number) => boolean,
  model: ModelPen,
) {
  const drop = sc.reduced ? null : fx.drips.falling(sc.now);
  if (drop && !drop.far && seen(drop.x, drop.y))
    drawBox(ctx, P, [drop.x + 0.46, drop.y + 0.1, drop.z, 0.08, 0.08, 0.14, WATER, WATER_TOP]);
  const olm = fx.olm.now(world, sc.now, sc.reduced);
  if (olm && seen(olm.x, olm.y)) {
    const { x, y, z } = olm;
    model(CAVE_FINE_MODELS.grottenolm, 'grottenolm', x + 0.5, y + 0.5, z, 's', CAVE_SPECIES.grottenolm.scale);
    // die Oberfläche des Wassers über seinem Bauch, dazu ein Ring, der sich weitet (nicht bei reduzierter Bewegung)
    ctx.globalAlpha = 0.6;
    drawBox(ctx, P, [x + 0.1, y + 0.55, -0.01, 0.8, 0.4, 0.02, WATER, WATER_TOP]);
    const r = sc.reduced ? 0 : 0.3 + 0.4 * (olm.ms / OLM_MS);
    ctx.globalAlpha = sc.reduced ? 0 : 0.5 * (1 - olm.ms / OLM_MS);
    if (r) drawBox(ctx, P, [x + 0.5 - r, y + 0.5 - r * 0.5, 0.005, 2 * r, r, 0.01, '#ffffff', '#ffffff']);
    ctx.globalAlpha = 1;
  }
  const bat = sc.reduced ? null : fx.chime.bat(world, sc.now);
  if (bat && seen(bat.x, bat.y))
    model(CAVE_FINE_MODELS.fledermaus, 'fledermaus', bat.x, bat.y, bat.z, bat.dir, CAVE_SPECIES.fledermaus.scale);
}

/** Der Tropfen der fernen Tropfquelle als Glitzern: hell, etwas größer als ein Tropfen, mit einem Schimmer quer */
function glint(ctx: CanvasRenderingContext2D, P: Projection, drop: { x: number; y: number; z: number }) {
  drawBox(ctx, P, [drop.x + 0.44, drop.y + 0.1, drop.z, 0.12, 0.08, 0.16, WATER_TOP, '#ffffff']);
  ctx.globalAlpha = 0.7;
  drawBox(ctx, P, [drop.x + 0.36, drop.y + 0.12, drop.z + 0.07, 0.28, 0.03, 0.03, '#ffffff', '#ffffff']);
  ctx.globalAlpha = 1;
}

/** In 3D: Säulen, die gerade klingen, leuchten auf der Ebene darüber heller (halb durchsichtig, verblasst in 0,5 s) */
function glows(
  ctx: CanvasRenderingContext2D,
  world: World,
  fx: CaveFx,
  sc: CaveScene,
  P: Projection,
  seen: (x: number, y: number) => boolean,
) {
  for (const [x, y, g] of fx.chime.glowing(sc.now)) {
    const c = world.cell(x, y);
    if (c.deco !== 'column' || !seen(x, y)) continue;
    ctx.globalAlpha = 0.55 * g;
    for (const b of columnBoxes(c, x, y, 1)) if (b[9]?.halo) drawBox(ctx, P, b); // Säule und Spitze
    ctx.globalAlpha = 1;
  }
}
