// Zeichenteile der Eis-Welt für die 2D-Ansicht und die Ebene über 3D, im Welt-Paket der Eis-Welt: Iglu, Eisschale,
// Eistrog, Fischkiste, Eisscholle und Eiskristall (Quader aus mitwachsen-ice-look.ts, je Deko-Art an den Haken
// `drawDeco` des Kerns gehängt), die Schneehaufen und Schneemänner (mitwachsen-snowman-look.ts, mit ihrem Ploppen), die
// Eiszapfen des Glockenspiels (mitwachsen-chime-look.ts, mit ihrem Glockenton), die Rutschspur zum Schneebett, das
// Wetter der Eis-Welt mit Polarlicht, das Bild der Weltgrenze (mitwachsen-ice-sky.ts) und die Fußspuren im Schnee
// (mitwachsen-prints.ts), dazu die Eisscholle vor dem Eistor (Torplatte) mit Schneeflocke und Klirren und „noch
// nicht“, wenn die Figur dort ohne Pinguin steht (mitwachsen-plate-hint.ts), und der Schlitten (mitwachsen-sled-look.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import { ICE_COLORS, ICE_CRYSTALS, ICE_FLOE } from '../../../../data/games/worlds/eis/mitwachsen-ice-colors';
import { crystalBoxes, crystalGlint, finTwitch, floeBoxes, floeDrift, iceBoxes, iceFoot } from './mitwachsen-ice-look';
import type { DrawDeco, View2D } from '../../mitwachsen-view';
import { gateScore, guestAt } from '../../mitwachsen-guest-look';
import { realmSign, turnAlbum, waitArrow } from './mitwachsen-border-view';
import { aurora, iceWeather, shine } from './mitwachsen-ice-sky';
import { trail } from './mitwachsen-prints';
import { stageAt } from './mitwachsen-snowman';
import { snowBoxes, snowScore, wobble } from './mitwachsen-snowman-look';
import { chimeBoxes, chimeScore, ring, since, swing } from './mitwachsen-chime-look';
import { DEEP_ICE, crestBoxes } from './mitwachsen-ice-rim';
import { SNOW_FILLS } from './mitwachsen-snow-fill';
import { fillBoxes } from './mitwachsen-snow-fill-look';
import { plateHint } from './mitwachsen-plate-hint';
import { SLED_ID, rideFx, sledBodies, sledGoodNight, sledMarks } from './mitwachsen-sled-look';
import { TUBE } from './mitwachsen-hill';
import { runBox, stepBoxes, tubeBodies, tubeFx } from './mitwachsen-tube-look';
import { LAMP_SCORE, flagBoxes, flagScore, lampBodies } from './mitwachsen-places-look';
import { CAT } from './mitwachsen-loop';
import { catBodies, catFx, pisteBox } from './mitwachsen-cat-look';

/** Iglu, Eisschale, Eistrog: Quader wie in 3D */
const look: DrawDeco = (world, c, x, y) => iceBoxes(world, c, x, y);

/** Fischkiste: voll, bis die Figur Fische fängt; ab und zu zuckt eine Flosse (nicht bei reduzierter Bewegung) */
const crate: DrawDeco = (world, c, x, y, { now, reduced, picked }) =>
  iceBoxes(world, c, x, y, { full: !(`${x},${y}` in picked), twitch: reduced ? 0 : finTwitch(now, x, y) });

/**
 * Eiskristall: ab und zu blitzt oben ein Funke (nicht bei reduzierter Bewegung); beim Polarlicht bekommt er einen Hof
 * (dafür merkt sich mitwachsen-ice-sky.ts, dass er in diesem Bild zu sehen ist)
 */
const crystal: DrawDeco = (_world, c, x, y, { now, reduced }) => {
  shine(x, y, c.h, c.color ?? ICE_CRYSTALS[0], now);
  return crystalBoxes(c, x, y, reduced ? 0 : crystalGlint(now, x, y));
};

/** Eisscholle auf einem Eisloch (`'floe'`): treibt sanft hin und her (nicht bei reduzierter Bewegung) */
const floe: DrawDeco = (_world, _c, x, y, { now, reduced }) => floeBoxes(x, y, reduced ? 0 : floeDrift(now, x, y));

/**
 * Zuletzt gezeichnete Stufe je Schneehaufen ("x,y"), seit wann und wann zuletzt gezeichnet, je Welt (eine andere Welt
 * fängt neu an): Eine frisch gewachsene Kugel wackelt kurz. Wer länger als `FORGET_MS` nicht gezeichnet wurde (außer
 * Sicht, oder es zeichnete 3D), wackelt beim nächsten Blick nicht.
 */
type Seen = Map<string, { stage: number; at: number; drawn: number }>;
const grown = new WeakMap<object, Seen>();
const FORGET_MS = 1000;

/**
 * Schneehaufen bzw. Schneemann in seiner Stufe (aus dem Zustand des Pakets). Ist er seit dem letzten Bild gewachsen,
 * wackelt er kurz (nicht bei reduzierter Bewegung, nicht beim ersten Blick auf ihn und nicht nach einer Pause)
 */
const heap: DrawDeco = (world, c, x, y, { now, reduced, packs }) => {
  const stage = stageAt(packs, x, y);
  let seen = grown.get(world);
  if (!seen) grown.set(world, (seen = new Map() as Seen));
  const k = `${x},${y}`;
  const last = seen.get(k);
  const fresh = last !== undefined && now - last.drawn < FORGET_MS;
  const at = last?.stage === stage ? last.at : fresh ? now : -Infinity;
  seen.set(k, { stage, at, drawn: now });
  return snowBoxes(x, y, c.h, stage, reduced ? 0 : wobble(now - at));
};

/** Eiszapfen des Glockenspiels: schwingt kurz, wenn die Figur ihn angeschlagen hat (nicht bei reduzierter Bewegung) */
const icicle: DrawDeco = (world, c, x, y, { now, reduced }) =>
  chimeBoxes(world, c, x, y, reduced ? 0 : swing(since(x, y, now)));

/**
 * Fülle im Schnee und Schneewehen: liegen still; nur der Funke auf einem Eisfleck blitzt ab und zu (nicht bei
 * reduzierter Bewegung)
 */
const fill: DrawDeco = (_world, c, x, y, { now, reduced }) =>
  fillBoxes(c, x, y, reduced || c.deco !== 'iceglint' ? 0 : crystalGlint(now, x + 31, y));

export const view: View2D = {
  decos: {
    igloo: look,
    icebowl: look,
    watertrough: look,
    fishcrate: crate,
    crystal,
    floe,
    snowheap: heap,
    icicle,
    rock: (_, c, x, y) => crestBoxes(c, x, y),
    snowdrift: fill,
    hillstep: (_, c, x, y) => stepBoxes(c, x, y), // Treppe am Rodelberg
    numflag: (_, c, x, y) => flagBoxes(c, x, y), // Zahlen-Fähnchen am Hauptweg
    ...Object.fromEntries(SNOW_FILLS.map((d) => [d, fill])),
  },
  foot: iceFoot, // weicher Fleck unter Iglu, Fischkiste, Schale, Trog, Schneehaufen
  // Rutschspur zum Schneebett: glänzt, sobald das Eistor offen ist
  ground: (c, x, y, open) =>
    c.rim
      ? [x, y, 0, 1, 1, c.h, DEEP_ICE.side, DEEP_ICE.top] // innerste Reihe der Klippen: Tiefeis (mitwachsen-ice-rim.ts)
      : c.slide && open
        ? [x + 0.12, y, c.h, 0.76, 1, 0.02, ...ICE_COLORS.slide]
        : c.ride === TUBE
          ? runBox(c, x, y) // Bahn am Rodelberg
          : c.ride === CAT
            ? pisteBox(c, x, y) // Runde der Schneeraupe
            : null,
  // Wetter und Bild der Weltgrenze der Eis-Welt in der Form, die der Kern kennt (`Sky` in mitwachsen-view.ts)
  sky: { weather: iceWeather, aurora, waitArrow, realmSign, turnAlbum, guestAt, gateScore },
  // Fußspuren im Schnee, die langsam verwehen (mitwachsen-prints.ts)
  trail,
  // fröhliches Ploppen, wenn ein Schneemann wächst; heller Glockenton eines Eiszapfens (er schwingt ab jetzt)
  score: (e) =>
    e.type === 'icicle'
      ? (ring(e.x, e.y, performance.now()), chimeScore(e))
      : e.type === 'snowman'
        ? snowScore(e)
        : e.type === 'numflag'
          ? flagScore(e.n) // ein Fähnchen bimmelt
          : e.type === 'treelamp'
            ? [...LAMP_SCORE] // eine Laterne geht an
            : undefined, // Säule, Grottenolm: Grotte
  // Torplatte vor dem Eistor: Eisscholle mit Schneeflocke, Klirren statt Klonk (E7 und G7, Pentatonik)
  plate: ICE_FLOE,
  clink: [
    [2637.02, 0.09, 'sine', 0.05, 1, 0],
    [3135.96, 0.14, 'sine', 0.035, 1, 0.03],
  ],
  // „noch nicht“: Steht die Figur auf der Scholle, ohne dass der Pinguin führt, zeigt das Tor, was fehlt
  hint: plateHint(),
  // Schlitten mit Schlittenrentier und Laternenpfahl, Schneespur und Fleck am Halt, Ton und Freude (mitwachsen-sled-look.ts)
  // dazu Rodelreifen und Fahne am Rodelberg (mitwachsen-tube-look.ts)
  // und die Laternen der Laternen-Tannen (mitwachsen-places-look.ts)
  bodies: (state, world, at) => [
    ...sledBodies(state, world, at),
    ...tubeBodies(state, world, at),
    ...catBodies(state, world, at), // die Schneeraupe an ihrem Halt oder auf ihrer Runde
    ...lampBodies(state, world),
  ],
  marks: sledMarks,
  goodNight: sledGoodNight, // „Gute Nacht, Fahrzeuge“
  rideFx: (e, state) => (e.id === SLED_ID.slice(5) ? rideFx(e, state) : (tubeFx(e) ?? catFx(e))), // je Fahrzeug nur seine Ereignisse
};
