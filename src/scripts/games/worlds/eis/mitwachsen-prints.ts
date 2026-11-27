// Fußspuren im Schnee der Eis-Welt – nur Bild, nie gespeichert, ohne Einfluss auf die Regeln: Geht die Figur oder ein
// Tier von einem Schneefeld ein Feld weiter, bleibt dort ein Abdruck (Stiefel der Figur, Pinguin-Dreizack, Tatzen,
// Hufe, Hoppelspur, Trippeln, Robbenspur, Krallen; `printOf` je Gangart), der langsam verweht, beim Pustewind und bei
// Schneefall schneller. Ringpuffer und Formen: mitwachsen-tracks.ts (generisch). Hier: wer läuft, welcher Boden
// Abdrücke nimmt, die 2D-Zeichnung (Haken `View2D.trail`) und was davon gerade zu sehen ist (`seen`, auch für den
// 3D-Teil, view-3d-prints.ts). Teil des Welt-Pakets der Eis-Welt.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Was angezeigt wird“, Zeile „Fußspuren“)

import type { Projection } from '../../../../lib/games/front';
import { fringeAlpha, softMark } from '../../../../lib/games/shade';
import { SPECIES, type SpeciesId } from '../../../../data/games/mitwachsen';
import { Tracks, marks, printOf, type Print, type PrintKind } from '../../mitwachsen-tracks';
import type { SkyScene } from '../../mitwachsen-sky';
import type { State } from '../../mitwachsen-state';
import type { Cell, World } from '../../mitwachsen-world';
import type { Trail } from '../../mitwachsen-view';

const NEAR = 22; // Abdrücke nur so nah an der Kamera (Manhattan) aufnehmen und zeichnen
const HOOVES: ReadonlySet<SpeciesId> = new Set<SpeciesId>(['rentier', 'moschusochse', 'kuh', 'schaf', 'ziege']);
/** Farbe eines Abdrucks: kühles Blaugrau, wie Schatten im Schnee (kein Gold, kein Weg) */
export const PRINT_RGB = '84,112,140';
const ALPHA = 0.42; // ein frischer Abdruck in 2D
const CLEAR = 2; // nur zeigen, wo ringsum so weit alles erkundet ist: am Nebelrand liegt Dunst (2D) und Nebel (3D)
const LEVELS = 16; // Deutlichkeit in so vielen Stufen: Ändert sich nichts Sichtbares, bleibt `rev` gleich

/** Nimmt dieses Feld Abdrücke? Schnee der Eis-Welt, nicht die Rutschspur, keine Klippe */
export const soft = (c: Cell) => c.biome === 'eis' && c.ground === 'snow' && c.region !== 'border' && !c.slide;

/** Abdruck eines Wesens: die Figur mit Stiefeln, ein Tier je Gangart seiner Art */
const kindOf = (species: SpeciesId): PrintKind => printOf(SPECIES[species].gait, HOOVES.has(species));

/** Spuren einer Welt: Puffer, letzte Felder der Läufer und was im letzten Bild zu sehen war */
export class Prints {
  readonly tracks = new Tracks();
  private last = new Map<string, readonly [number, number]>();
  private seed = NaN;
  private then = 0;
  private rows = new Map<number, [Print, number][]>();
  /** Abdrücke, die im letzten Bild zu sehen waren (nah, erkundet, nicht verweht), je mit Deutlichkeit, neueste zuerst */
  seen: [Print, number][] = [];
  /** Zählt hoch, sobald sich `seen` ändert (der 3D-Teil füllt seine Puffer nur dann neu) */
  rev = 0;

  /** Je Bild: Zeit vergeht, wer ein Feld weiter ging, hinterlässt auf Schnee einen Abdruck */
  step(world: World, state: State, sc: SkyScene) {
    if (world.seed !== this.seed) {
      this.tracks.clear();
      this.last.clear();
      this.seed = world.seed;
      this.then = sc.now;
    }
    this.tracks.pass(Math.min(1, (sc.now - this.then) / 1000), sc.weather.wind, sc.weather.snow);
    this.then = sc.now;
    const near = (x: number, y: number) => Math.abs(x - sc.cam.x) + Math.abs(y - sc.cam.y) < NEAR;
    this.walk(world, 'player', state.player.x, state.player.y, 'stiefel', near);
    for (const a of state.animals) this.walk(world, a.id, a.x, a.y, kindOf(a.species), near);
    const clear = (x: number, y: number) => {
      for (let dy = -CLEAR; dy <= CLEAR; dy++)
        for (let dx = -CLEAR; dx <= CLEAR; dx++) if (!sc.explored(x + dx, y + dy)) return false;
      return true;
    };
    const seen: [Print, number][] = [];
    for (const [p, a] of this.tracks.live(sc.reduced)) {
      const q = sc.reduced ? a : Math.ceil(a * LEVELS) / LEVELS; // in Stufen sind es schon wenige
      if (near(p.x, p.y) && clear(p.x, p.y)) seen.push([p, q]);
    }
    const same =
      seen.length === this.seen.length &&
      seen.every(([p, a], i) => {
        const o = this.seen[i];
        return o?.[0] === p && o[1] === a;
      });
    if (same) return;
    this.seen = seen;
    this.rev++;
    this.rows = new Map();
    for (const e of this.seen) {
      const row = this.rows.get(e[0].y);
      if (row) row.push(e);
      else this.rows.set(e[0].y, [e]);
    }
  }

  /** Ein Läufer steht auf (x, y): Kam er eben von einem Nachbarfeld aus Schnee, bleibt dort ein Abdruck */
  private walk(
    world: World,
    id: string,
    x: number,
    y: number,
    kind: PrintKind,
    near: (x: number, y: number) => boolean,
  ) {
    const from = this.last.get(id);
    this.last.set(id, [x, y]);
    if (!from) return;
    const [dx, dy] = [x - from[0], y - from[1]];
    if (Math.abs(dx) + Math.abs(dy) !== 1 || !near(x, y) || !soft(world.cell(from[0], from[1]))) return; // stand still oder sprang
    this.tracks.add(from[0], from[1], dx ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n', kind);
  }

  /**
   * 2D: die Abdrücke der Reihe `y`, flach auf ihrem Schnee (nach dem Boden der Reihe, vor Dingen und Wesen), mit weichem
   * Rand (Entwurf „Feine Grafik“): erst je Teil der um den Saum gewachsene Fleck blass, dann das Teil selbst, so dass die
   * Mitte so deutlich ist wie vorher (`fringeAlpha`)
   */
  draw(ctx: CanvasRenderingContext2D, world: World, P: Projection, y: number) {
    for (const [p, a] of this.rows.get(y) ?? []) {
      const h = world.cell(p.x, p.y).h;
      const parts = marks(p);
      const [outer, inner] = fringeAlpha(ALPHA * a);
      ctx.fillStyle = `rgba(${PRINT_RGB},${outer.toFixed(3)})`;
      for (const [mx, my, w, d] of parts) {
        const s = softMark(mx, my, w, d);
        rect(ctx, P, s.x, s.y, s.w, s.d, h);
      }
      ctx.fillStyle = `rgba(${PRINT_RGB},${inner.toFixed(3)})`;
      for (const [mx, my, w, d] of parts) rect(ctx, P, mx, my, w, d, h);
    }
  }
}

/** Ein flaches Rechteck auf der Höhe `h`, auf ganze Pixel gerundet, mindestens ein Pixel groß */
function rect(ctx: CanvasRenderingContext2D, P: Projection, x: number, y: number, w: number, d: number, h: number) {
  const [ax, ay] = P(x, y, h);
  const [bx, by] = P(x + w, y + d, h);
  ctx.fillRect(Math.round(ax), Math.round(ay), Math.max(1, Math.round(bx - ax)), Math.max(1, Math.round(by - ay)));
}

/** Die Spuren der Eis-Welt (eine für das Spiel; 2D zeichnet sie, der 3D-Teil liest `seen`) */
export const prints = new Prints();
export const trail: Trail = prints;
