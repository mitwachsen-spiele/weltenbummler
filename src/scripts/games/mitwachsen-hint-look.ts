// „Noch nicht“ an einem großen Tor in Bild und Ton: Steht die Figur auf seiner Torplatte und fehlt noch etwas (`hint`
// in mitwachsen-guide.ts), leuchtet im Torzeichen zweimal ein leerer goldener Umriss dessen, was fehlt (aus dem Modell
// der Art gerastert, 2D und Ebene über 3D), es klingt „hm-hm?“, der Riegel
// klappert, der Klangstein summt das Motiv (`notYet`), und die Live-Region sagt es. Nie ein Fehlerton, nie Rot. In 3D
// wackeln dazu die Flügel (`hintShake` in mitwachsen-gate-motion-3d.ts). Nachgeladen, sobald die Figur zum ersten Mal
// auf die Platte des Eistors tritt (`import()` aus dem Welt-Paket der Eis-Welt, worlds/eis/mitwachsen-plate-hint.ts),
// nie mit der Spielseite: eigene Grenze im Bundle-Gate (scripts/verify-bundles.ts).
// An den Toren, die nie aufgehen (`opens: 'never'`), pulsiert statt eines Tiers das Zeichen ihrer Welt als goldener
// Umriss (`never`, nachgeladen von der Spielseite, sobald die Figur zum ersten Mal auf eine Torplatte tritt).
// Spezifikation: docs/specs/mitwachsen.md (Regel 8 und 8a „Noch nicht“, „Was angezeigt wird“: Große Tore)

import type { Part, Projection } from '../../lib/games/front';
import { SPECIES, type GateId, type SpeciesId } from '../../data/games/mitwachsen';
import { GOLD, LOOKS } from '../../data/games/mitwachsen-portals';
import { PLATE_TUNE, plateHz, plateNote, type Scored, type Sfx } from './sfx';
import type { World } from './mitwachsen-world';
import { GUIDE_GATE, nope, type Guided, type Hint, type HintDraw } from './mitwachsen-guide';

/** So lange (ms) zeigt das Tor, was fehlt; der Umriss pulsiert zweimal je 0,8 s */
export const HINT_MS = 1600;
const PULSE = HINT_MS / 2;
/** So viele Pixel misst der Umriss in der Länge oder Höhe, je `HINT_PX` Felder: knapp 3 Felder, gut zu erkennen */
export const SIL = 16;
export const HINT_PX = 0.18;
/** Unterkante des Umrisses über dem Boden (wie der Umriss des Pinguins, zwischen den Eisenbändern der Tür) */
export const HINT_Y = 1;

/**
 * „Hm-hm?“ am Tor `id`: ein weicher, fragender Doppelton (eine Quarte hinauf), mit jedem Wackeln der Tür (0 und 0,8 s)
 * klappert leise der Riegel (ganz kurz und hoch; bei reduzierter Bewegung wackelt nichts, also klappert auch nichts),
 * dann summt der Klangstein davor einmal das Motiv der Torplatte, eine Oktave tiefer. Alles in der Pentatonik der
 * Welt, nichts fällt wie das Anstoßen, höchstens zwei Stimmen zugleich, nach gut 2 s vorbei
 */
export const notYet = (id: GateId, reduced?: boolean): Scored[] => [
  [plateHz(id, -5), 0.18, 'sine', 0.1, 1, 0],
  [plateHz(id, 0), 0.26, 'sine', 0.1, 1, 0.22],
  ...(reduced ? [] : [0, 0.8]).map((at): Scored => [plateHz(id, 24), 0.03, 'triangle', 0.03, 1, at]),
  ...PLATE_TUNE.map((_, i): Scored => [plateHz(id, plateNote(id, i) - 12), 0.2, 'sine', 0.05, 1, 1 + i * 0.24]),
];

/**
 * Leerer Umriss einer Art von der Seite (Kopf nach rechts), aus den Quadern ihres Modells gerastert, je Zeile von oben:
 * 'o' golden (der Rand und die Augen der Seite als Merkmal, sonst läse man nur einen Ring), '.' leer. Höchstens `SIL`
 * Pixel lang oder hoch. Ein Quader füllt die Pixel, deren Mitte er deckt; ist er dünner als ein Pixel (Ohren, Augen),
 * jedes, das er berührt, so geht nichts verloren.
 */
export function silhouette(parts: readonly Part[]): string[] {
  const [f0, f1, u0, u1] = parts.reduce(
    ([a, b, c, d], p) => [Math.min(a, p[0]), Math.max(b, p[0] + p[3]), Math.min(c, p[2]), Math.max(d, p[2] + p[5])],
    [9, -9, 9, -9],
  );
  const px = Math.max(f1 - f0, u1 - u0) / SIL;
  const [cols, rows] = [f1 - f0, u1 - u0].map((len) => Math.round(len / px)) as [number, number];
  // deckt [a, a + len] das Pixel ab `lo`?
  const covers = (a: number, len: number, lo: number) =>
    len < px ? a < lo + px && a + len > lo : a <= lo + px / 2 && a + len > lo + px / 2;
  const hit = (c: number, r: number, eye?: boolean) =>
    c >= 0 &&
    r >= 0 &&
    c < cols &&
    r < rows &&
    parts.some(
      (p) => (!eye || p[8] === 'r') && covers(p[0], p[3], f0 + c * px) && covers(p[2], p[5], u1 - (r + 1) * px),
    );
  return rim(cols, rows, hit, (c, r) => hit(c, r, true));
}

/** Quader, aus denen der Umriss einer Art entsteht: ihre Grundform ohne Feinteile (`outline`), sonst ihr Modell */
export const shapeOf = (id: SpeciesId): readonly Part[] => SPECIES[id].outline ?? SPECIES[id].parts;

/** Zeilen von oben ('o' golden, '.' leer): die Pixel von `on` am Rand (ein Nachbar fehlt), dazu die aus `keep` */
const rim = (
  cols: number,
  rows: number,
  on: (c: number, r: number) => boolean,
  keep: (c: number, r: number) => boolean = () => false,
) =>
  Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) =>
      on(c, r) && (!(on(c - 1, r) && on(c + 1, r) && on(c, r - 1) && on(c, r + 1)) || keep(c, r)) ? 'o' : '.',
    ).join(''),
  );

/**
 * Wie hell der Umriss ist (0 … 1), `t` ms nachdem das Tor ihn zu zeigen begann: Er leuchtet zweimal auf und vergeht
 * wieder, nur über die Deckkraft (darum auch bei reduzierter Bewegung); nach `HINT_MS` 0
 */
export const hintGlow = (t: number) => (t >= 0 && t < HINT_MS ? Math.sin((Math.PI * (t % PULSE)) / PULSE) : 0);

/**
 * Leerer goldener Umriss der Art `species` im Zeichen des Tors `id` (2D und Ebene über 3D, Projektion `P`): zur Kamera
 * gewandt (in 3D, zur Front gedreht, entlang der Tür), unten auf der Höhe `HINT_Y` vor der Tür, `t` ms nach Beginn
 * (pulsierend, `hintGlow`); je Pixel Gold mit einem dunkleren Schatten, so hebt es sich vom Holz ab. Gold aus den
 * Tokens, die einzige Aktionsfarbe
 */
export function hintOutline(
  ctx: CanvasRenderingContext2D,
  world: World,
  P: Projection,
  id: GateId,
  rows: readonly string[],
  t: number,
) {
  const g = world.gates.get(id);
  const glow = hintGlow(t);
  if (!g || !glow) return;
  const [x, y] = [g.mid[0] + 0.5 - g.out[0] / 4, g.mid[1] + 0.5 - g.out[1] / 4];
  const z = world.cell(...g.mid).h + HINT_Y;
  // Entlang der Tür, von vorn richtig herum gelesen (rechts vom Blick nach außen), solange die Kamera zur Front gedreht
  // ist; sonst (2D, Postkarte, ungedreht) entlang x. Es gilt die Richtung, die im Bild am breitesten nach rechts läuft
  const right = (a: number, b: number) => P(x + a, y + b, z)[0] - P(x, y, z)[0];
  const [ux, uy] = right(-g.out[1], g.out[0]) > right(1, 0) ? [-g.out[1], g.out[0]] : [1, 0];
  ctx.globalAlpha = glow;
  rows.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch === '.') return;
      const at = (dc: number, dr: number) => {
        const k = (c + dc - row.length / 2) * HINT_PX;
        return P(x + k * ux, y + k * uy, z + (rows.length - r - dr) * HINT_PX);
      };
      const [[ax, ay], [bx, by]] = [at(0, 0), at(1, 1)];
      ctx.fillStyle = GOLD.side;
      ctx.fillRect(ax + 1, ay + 1, bx - ax, by - ay);
      ctx.fillStyle = GOLD.light;
      ctx.fillRect(ax, ay, bx - ax, by - ay);
    }),
  );
  ctx.globalAlpha = 1;
}

/** In der Live-Region des Spiels sagen (`.mw-say`), jedes Mal, auch denselben Text: erst leeren, dann setzen, sonst schweigt der Screenreader */
function say(text: string) {
  const el = document.querySelector('.mw-say');
  if (el) {
    el.textContent = '';
    setTimeout(() => (el.textContent = text), 99);
  }
}

/**
 * Das Tor `id` zeigt ab `since` (ms), dass `species` fehlt: spielt „hm-hm?“ (`notYet`, bei reduzierter Bewegung ohne
 * Riegel), sagt es in der Live-Region und liefert die Zeichnung des Umrisses
 */
export function showHint(
  sfx: Pick<Sfx, 'score'>,
  species: SpeciesId,
  since: number,
  reduced?: boolean,
  id: GateId = GUIDE_GATE,
): HintDraw {
  sfx.score(notYet(id, reduced));
  say(`Noch nicht. Es fehlt noch: ${SPECIES[species].name}`);
  const rows = silhouette(shapeOf(species));
  return (ctx, world, P, now) => hintOutline(ctx, world, P, id, rows, now - since);
}

/**
 * Umriss des Zeichens der Welt `id`: das Bild ihrer Portal-Plattform (`LOOKS`, 8 × 8, keine eigene Grafik) doppelt so
 * groß, ohne seinen Grund (die Farbe der Ecke oben links), davon nur der Rand ('o'), Zeilen von oben wie `silhouette`
 */
export function signOutline(id: GateId): string[] {
  const pic = LOOKS[id].picture;
  const bg = pic[0]![0];
  const on = (c: number, r: number) => (pic[r >> 1]?.[c >> 1] ?? bg) !== bg; // außerhalb (auch −1 >> 1) ist Grund
  return rim(SIL, SIL, on);
}

/**
 * „Noch nicht“ an den Toren, die nie aufgehen: liefert die Funktion, die die Spielseite je Bild fragt (sie merkt sich
 * flüchtig, nie gespeichert, wann ein Tor das zuletzt tat; `nope` in mitwachsen-guide.ts entscheidet, rein). Dreht die
 * 3D-Ansicht zur Front (`r3d`), zeigt es erst, wenn sie angekommen ist (p = 1); in 2D, bei reduzierter Bewegung und mit
 * dem Elternschalter aus nach 1 s Stehen. Dann pulsiert das Zeichen der Welt zweimal als goldener Umriss am Tor
 * (`HINT_MS`), es klingt „hm-hm?“ (`notYet` in der Pentatonik der Welt, ohne Riegel) und die Live-Region sagt „Noch nicht.“ Kein Tier,
 * keine Bedingung, nie ein Fehlerton. Liefert das, solange es zu sehen ist, sonst null. Läuft der Takt zurück (eine
 * andere Welt), zählt das letzte Mal nicht mehr. Fehlt dem Tor ein nächster Schritt (`lack`, aus dem Haken
 * `View2D.lacks` eines Pakets: am Höhlentor Tok), pulsiert statt des Zeichens dessen Umriss, und die Live-Region nennt ihn.
 */
export function never() {
  let shown: Hint & { t: number } = { t: -1e9 };
  return (
    state: Guided,
    world: World,
    now: number,
    _reduced: boolean, // gleich: ohne Flügel wackelt nichts, der Riegel klappert nie
    sfx: Pick<Sfx, 'score'>,
    _lift?: unknown,
    r3d?: { arrived(): boolean } | null,
    lack?: SpeciesId,
  ): Hint | null => {
    const id = r3d?.arrived() === false ? undefined : nope(state, world, state.tick < shown.t ? -1e9 : shown.t);
    if (id) {
      sfx.score(notYet(id, true)); // ohne Riegel: Diese Tore haben keine Flügel, nichts wackelt
      say(lack ? `Noch nicht. Es fehlt noch: ${SPECIES[lack].name}` : 'Noch nicht.');
      const rows = lack ? silhouette(shapeOf(lack)) : signOutline(id);
      shown = { t: state.tick, id, at: now, draw: (ctx, w, P, t) => hintOutline(ctx, w, P, id, rows, t - now) };
    }
    return now - (shown.at ?? -1e9) < HINT_MS ? shown : null;
  };
}
