// Haken der Ansicht für Fahrzeuge aus einem Welt-Paket (Eis-Welt: Schlitten mit Schlittenrentier und Laternenpfahl,
// worlds/eis/mitwachsen-sled-look.ts) – rein, ohne DOM und Three.js. Das Paket liefert Körper (Modelle mit Lage), flache
// Marken am Boden (Spur, Fleck am Halt) und zu jedem Ereignis Ton, Hüpfer, Herz und Funken; der Kern zeichnet sie in 2D
// und 3D gleich, lässt die Figur dem Sitz folgen und trifft sie beim Antippen. Die Figur sitzt im Modell des Fahrzeugs
// (der Körper mit `seat`); solange sie fährt, zeichnen beide Ansichten sie nicht selbst.
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Der Schlitten“)

import { drawModel, type Dir, type Part, type Projection } from '../../lib/games/front';
import type { RideId } from '../../data/games/mitwachsen-rides';
import { dirTo } from './mitwachsen-free';
import type { MoveCmd } from './mitwachsen-rider';
import type { Scored } from './sfx';

/**
 * Ein Körper eines Fahrzeugs: `id` fest je Teil (beginnt mit `ride:`, so trifft ihn das Antippen), `key` je Variante
 * seines Modells (wenige, feste: die 3D-Ansicht hält jede Form, einmal gebaut), Lage in Feldern (Mitte bei x + 0,5),
 * Blickrichtung, Teile wie bei den Tieren; `seat`: Hier sitzt die Figur (die Kamera folgt ihm)
 */
export type RideBody = {
  id: string;
  key: string;
  x: number;
  y: number;
  z: number;
  dir: Dir;
  parts: readonly Part[];
  seat?: true;
  glow?: true; // eine Lampe vorn leuchtet, ohne dass die Figur darin sitzt (die Dunkelmaske der Grotte öffnet dort ein kleines Loch)
  sheer?: true; // durchscheinend gezeichnet (Dachplatte eines Bahnhofs, solange die Figur darunter steht)
  beacon?: true; // der Körper selbst glimmt, wie weit die Figur auch weg ist (kleines Loch der Dunkelmaske mitten auf ihm: der Erdhügel)
  foot?: number; // Halbbreite des weichen Flecks am Boden (sonst `RIDE_FOOT`); 0: kein Fleck (schwebt, liegt flach, steht nicht in der Mitte)
};

/** Halbbreite des weichen Flecks unter einem Körper, gleich in 2D und 3D */
export const RIDE_FOOT = 0.3;
export const footOf = (r: Pick<RideBody, 'foot'>) => r.foot ?? RIDE_FOOT;

/**
 * Was die Körper je Bild brauchen: Zeit, Bruchteil des laufenden Takts (0 … 1), reduzierte Bewegung, Abendlicht (`lit`:
 * Laterne und Lampen), warmes Licht (`warm`: ab 20 min Spielzeit und nachts, Fensterband des Zugs), welche Fahrzeuge
 * nach „Gute Nacht“ ihr Licht aus haben (`asleep`, nur im Schlaf)
 */
export type RideAt = {
  now: number;
  frac: number;
  reduced: boolean;
  lit: boolean;
  warm?: boolean;
  asleep?: readonly RideId[];
};

/**
 * Antwort der Ansicht auf ein Ereignis eines Fahrzeugs: Töne, wer hüpft (`who`: Tier, `player`, sonst niemand), ob er
 * ein Herz bekommt, Funken an der Stelle des Ereignisses (`burst`, nicht bei reduzierter Bewegung), ein Zzz steigt dort
 * auf (`zzz`: ein schlafendes Fahrzeug, nicht bei reduzierter Bewegung); `chorus`: Tiere, die kurz danach antworten und
 * hüpfen (`CHORUS_MS`; ihr Ton steht in `score`)
 */
export type RideFx = {
  score: readonly Scored[];
  who?: string;
  heart?: true;
  burst?: readonly string[];
  zzz?: true;
  chorus?: readonly string[];
};

/** Deckkraft eines durchscheinenden Körpers (`RideBody.sheer`), gleich in 2D und 3D */
export const SHEER = 0.35;

/** Einen Körper in 2D zeichnen, durchscheinend mit `sheer` */
export function drawRide(ctx: CanvasRenderingContext2D, P: Projection, r: RideBody) {
  ctx.globalAlpha = r.sheer ? SHEER : 1;
  drawModel(ctx, P, r.parts, r.x + 0.5, r.y + 0.5, r.z, r.dir);
  ctx.globalAlpha = 1;
}

/** So viel später (ms) hüpfen die Tiere, die antworten (`RideFx.chorus`: Murmeltiere pfeifen zurück, wenn der Zug tutet) */
export const CHORUS_MS = 400;

/**
 * „Gute Nacht“ eines Fahrzeugs (`View2D.goodNight`): seine Töne ab 0 s; die Spielseite reiht die Fahrzeuge in Sichtweite
 * nacheinander (mitwachsen-bedtime.ts), danach ist sein Licht aus (`RideAt.asleep`)
 */
export type GoodNight = { id: RideId; score: readonly Scored[] };

/** Der Körper, in dem die Figur sitzt (nur während der Fahrt) */
export const seatOf = (rides: readonly RideBody[]) => rides.find((r) => r.seat);

/** Das Fahrzeug, dem ein Körper gehört, aus seiner Kennung `ride:<Fahrzeug>…`; undefined, wenn er keinem gehört */
export const rideOfBody = (id: string): RideId | undefined =>
  id.startsWith('ride:') ? (id.split(':')[1] as RideId | undefined) : undefined;

/**
 * Nur das Fahrzeug, in dem die Figur sitzt (`ride`, die Kennung von `State.ride`), trägt ihren Sitz: Meldet ein anderes
 * (ein Paket, das jede Fahrt für seine hielte) einen Sitz, fällt er weg; ohne Fahrt sitzt sie nirgends. Ohne solchen
 * Körper dieselbe Liste
 */
export function ownSeat(rides: readonly RideBody[], ride: RideId | undefined): readonly RideBody[] {
  const stray = (r: RideBody) => !!r.seat && (!ride || rideOfBody(r.id) !== ride);
  if (!rides.some(stray)) return rides;
  return rides.map((r) =>
    stray(r) ? { id: r.id, key: r.key, x: r.x, y: r.y, z: r.z, dir: r.dir, parts: r.parts } : r,
  );
}

/** Die Figur hüpft im Sitz (winkt): Der Körper mit ihr hüpft um `hop` Felder mit */
export const withHop = (rides: readonly RideBody[], hop: number): readonly RideBody[] =>
  hop ? rides.map((r) => (r.seat ? { ...r, z: r.z + hop } : r)) : rides;

/** Quader nach der Reihe, in der die 2D-Ansicht sie zeichnet (ihre Vorderkante, wie die Eis-Dinge) */
export function byRow<B extends readonly [number, number, number, number, number, ...unknown[]]>(
  boxes: readonly B[],
): Map<number, B[]> {
  const out = new Map<number, B[]>();
  for (const b of boxes) {
    const row = Math.ceil(b[1] + b[4] - 1e-6) - 1;
    out.set(row, [...(out.get(row) ?? []), b]);
  }
  return out;
}

/** So weit um seine Mitte (in Feldbreiten auf dem Bildschirm) trifft ein Finger einen Körper */
export const TAP_RADIUS = 0.8;
/** Ein Zentimeter in CSS-Pixeln (96 px je Zoll) */
export const CM = 96 / 2.54;
/** So weit trifft ein Finger höchstens, wie groß die Ansicht auch ist (Konzept: Treffer ≤ max(38 px, 1 cm)) */
export const TAP_MAX = Math.max(38, CM);

/**
 * Was sich antippen lässt: ein Körper eines Fahrzeugs (Kennung `ride:<Fahrzeug>…`) oder ein Bote unter den Wesen
 * (`being`, Tok; Kennung wie in `State.animals`), Lage in Feldern wie bei `RideBody`
 */
export type Tap = Pick<RideBody, 'id' | 'x' | 'y' | 'z'> & { being?: true };

/**
 * Antippen: das Antippbare unter dem Bildschirmpunkt (px, py), das nächste zuerst; `project` ist die Projektion der
 * Ansicht (2D von vorn oder die 3D-Kamera), so trifft es in beiden gleich. Getroffen ist, was höchstens `TAP_RADIUS`
 * Feldbreiten um seine Mitte liegt, höchstens aber `TAP_MAX` Pixel (nah oder groß gezoomt); andere Körper (Laterne,
 * Bahnhof, Figur) trifft es nie
 */
export function tapRide<T extends Tap>(
  rides: readonly T[],
  project: Projection,
  px: number,
  py: number,
): T | undefined {
  let best: T | undefined;
  let near = Infinity;
  for (const r of rides) {
    if (!r.being && !r.id.startsWith('ride:')) continue;
    const [cx, cy] = project(r.x + 0.5, r.y + 0.5, r.z + 0.4);
    const [ex, ey] = project(r.x + 1.5, r.y + 0.5, r.z + 0.4);
    const d = Math.hypot(px - cx, py - cy);
    if (d <= Math.min(Math.hypot(ex - cx, ey - cy) * TAP_RADIUS, TAP_MAX) && d < near) [best, near] = [r, d];
  }
  return best;
}

/**
 * Befehl zum Angetippten: ein neuer Druck in seine Richtung (`tap`: wirkt wie Hineinlaufen, nie laufen); `ride` das
 * Fahrzeug, dem der Körper gehört (aus seiner Kennung `ride:<Fahrzeug>…`), `who` der angetippte Bote
 */
export const tapCmd = (r: Pick<Tap, 'id' | 'x' | 'y' | 'being'>, player: { x: number; y: number }): MoveCmd => {
  const ride = r.being ? undefined : rideOfBody(r.id);
  return {
    type: 'move',
    dir: dirTo(Math.round(r.x) - player.x, Math.round(r.y) - player.y),
    fresh: true,
    tap: true,
    ...(ride ? { ride } : {}),
    ...(r.being ? { who: r.id } : {}),
  };
};
