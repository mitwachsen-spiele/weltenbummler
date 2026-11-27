// 3D-Teil des Welt-Pakets der Eis-Welt: Was die 3D-Ansicht nur für die Eis-Welt baut. Iglu, Eisschale, Eistrog und
// Fischkiste (Quader aus mitwachsen-ice-look.ts, wie in 2D; die Schwanzflossen wiegen sich im Wind statt zu zucken),
// Schnee und Eis als Boden und Klippen des Kessels, die glänzende Rutschspur bei offenem Eistor, das Bett aus Schnee,
// Eiskristalle, die beim Polarlicht heller und grüntürkis leuchten (bei reduzierter Bewegung ruhig), Eisschollen auf den
// Eislöchern, der Eisfall am Talende (Klippen aus gefrorenem Wasser), die Stufen des Eisbergs, Schneehaufen und
// Schneemänner in ihrer Stufe (mitwachsen-snowman-look.ts, stehen still), die Eiszapfen des
// Glockenspiels (mitwachsen-chime-look.ts, hängen still), die Fußspuren im Schnee
// (view-3d-prints.ts), die Schneespur des Schlittens (view-3d-sled.ts) und am Eistor Tür, Eiszapfen und Eisscholle als Torplatte (view-3d-gate.ts). Braucht Three.js (wie die
// 3D-Ansicht, beide teilen es) und wird darum nicht mit dem Paket geladen, sondern erst, wenn die 3D-Ansicht es will (`pack.view3d`, index.ts):
// im Build `_astro/welt-eis-3d.<hash>.js` mit eigener Grenze (scripts/verify-bundles.ts).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import { ICE_COLORS } from '../../../../data/games/worlds/eis/mitwachsen-ice-colors';
import { crystalBoxes, crystalGlow, floeBoxes, glowTint, iceBoxes } from './mitwachsen-ice-look';
import type { Frame, Ground, View3D } from '../../mitwachsen-view-3d';
import type { DrawDeco } from '../../mitwachsen-view';
import { gateLook } from './view-3d-gate';
import { layer } from './view-3d-prints';
import { joined, marksLayer } from './view-3d-sled';
import { stageAt } from './mitwachsen-snowman';
import { snowBoxes } from './mitwachsen-snowman-look';
import { chimeBoxes } from './mitwachsen-chime-look';
import { SNOW_FILLS } from './mitwachsen-snow-fill';
import { TUBE } from './mitwachsen-hill';
import { stepBoxes } from './mitwachsen-tube-look';
import { flagBoxes } from './mitwachsen-places-look';
import { CAT } from './mitwachsen-loop';
import { CAT_COLORS } from '../../../../data/games/worlds/eis/mitwachsen-cat-model';
import { fillBoxes } from './mitwachsen-snow-fill-look';
import { DEEP_ICE, crestBoxes } from './mitwachsen-ice-rim';

/** Im Gletscherkessel (Boden und Klippen): Schnee obenauf, darunter Eis */
const KESSEL: Ground = { tiles: ['snowTop', 'ice', 'ice'] };
/**
 * Eisfall am Talende und Stufen des Eisbergs: Seiten in der Farbe des Felds (`color`, wie in 2D), glattes Eis obenauf.
 * Die Kacheln sind fast weißer Schnee, so bleibt die Tönung so hell wie in 2D (auf der blauen Eis-Kachel würde sie
 * doppelt dunkel)
 */
const fall = (color: string): Ground => ({
  tiles: ['snowTop', 'snowTop', 'snowTop'],
  top: ICE_COLORS.ice[1],
  side: color,
});
/** Die Rutschspur glänzt bei offenem Eistor aus Eis */
const SLIDE: Ground = { tiles: ['ice', 'ice', 'ice'], top: ICE_COLORS.slide[1] };
/** Innerste Reihe der Klippen: dunkles Tiefeis, kein Schnee obenauf */
const DEEP: Ground = { tiles: ['ice', 'ice', 'ice'], top: DEEP_ICE.top, side: DEEP_ICE.side };
/** Die Runde der Schneeraupe: gewalzter Schnee, eine Spur dunkler als der Schnee ringsum */
const PISTE: Ground = { tiles: ['snowTop', 'ice', 'ice'], top: CAT_COLORS.piste[0] };
/** Rahmen des Betts aus Schnee */
const SNOW_FRAME: Frame = [...ICE_COLORS.snow, 'schnee'];

/** Iglu, Eisschale, Eistrog: Quader wie in 2D */
const look: DrawDeco = (world, c, x, y) => iceBoxes(world, c, x, y);
/** Fischkiste: voll, bis die Figur Fische fängt; die Flossen zucken in 3D nicht (sie wiegen sich im Wind) */
const crate: DrawDeco = (world, c, x, y, { picked }) =>
  iceBoxes(world, c, x, y, { full: !(`${x},${y}` in picked), twitch: 0 });

/** Eiskristall der Eis-Welt: leuchtet aus sich selbst (`'glow'`); Kristalle anderer Welten baut die 3D-Ansicht wie immer */
const crystal: DrawDeco = (_world, c, x, y) => (c.biome === 'eis' ? crystalBoxes(c, x, y, 0, true) : null);

/** Schneehaufen bzw. Schneemann in seiner Stufe; wächst er, baut die 3D-Ansicht sein Stück neu (in 3D wackelt nichts) */
const heap: DrawDeco = (_world, c, x, y, { packs }) => snowBoxes(x, y, c.h, stageAt(packs, x, y));

/** Eiszapfen des Glockenspiels: hängt still (in 3D schwingt nichts, es klingt nur und glitzert) */
const icicle: DrawDeco = (world, c, x, y) => chimeBoxes(world, c, x, y);

/** Eisscholle auf einem Eisloch, liegt still */
const floe: DrawDeco = (_world, _c, x, y) => floeBoxes(x, y);

/** Fülle im Schnee und Schneewehen: liegen still (in 3D blitzt nichts) */
const fill: DrawDeco = (_world, c, x, y) => fillBoxes(c, x, y);

export const view3d: View3D = {
  gate: 'eis',
  look: gateLook,
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
  ground(c, open) {
    if (c.biome !== 'eis' || c.region === 'wild') return null;
    if (c.slide && open.includes('eis')) return SLIDE;
    if (c.ride === TUBE) return SLIDE; // Bahn am Rodelberg: glänzendes Eis
    if (c.ride === CAT) return PISTE; // Runde der Schneeraupe: gewalzter Schnee
    if (c.rim) return DEEP; // innerste Reihe der Klippen: Tiefeis statt Schnee (mitwachsen-ice-rim.ts)
    if (c.color && (c.region === 'border' || c.ground === 'ice')) return fall(c.color); // Eisfall, Stufen des Eisbergs
    return c.region === 'border' || c.ground === 'snow' ? KESSEL : null;
  },
  bedFrame: (c) => (c.biome === 'eis' ? SNOW_FRAME : null),
  // alle zugleich (ein Material): pulsieren sanft mit dem Polarlicht, bei reduzierter Bewegung ruhig
  glow: (aurora, reduced, now) => glowTint(crystalGlow(aurora, reduced, now)),
  // Fußspuren im Schnee und Schneespur des Schlittens, je Bild nachgeführt (view-3d-prints.ts, view-3d-sled.ts)
  layer: joined(layer, marksLayer()),
};
