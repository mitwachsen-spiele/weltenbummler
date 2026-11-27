// Zeichnet Mitwachsen in ein Canvas: Welt von vorn, Reihe für Reihe von hinten nach vorn, dazu Tiere, Figur,
// Herzen, Noten, Heimweg-Pfeil und Nacht. Liest nur Zustand und Welt; was sich bewegt (Kamera, gleitende Figuren,
// Hüpfer), berechnet die Web Component und reicht es als `Scene` herein.

import {
  LEVEL_H,
  TILE_D,
  TILE_W,
  box,
  drawModel,
  frontBlock,
  paintWith,
  projection,
  type Dir,
  type Part,
  type Projection,
} from '../../lib/games/front';
import {
  DIRT,
  GRASS_SIDE,
  GRASS_TOP,
  LEAVES,
  LOG_SIDE,
  PAL_GRASS,
  PAL_LEAVES,
  PAL_LOG,
  PAL_STONE,
  STONE,
  type Palette,
} from '../../lib/voxel/textures';
import {
  GAME_COLORS,
  GATES,
  MOOD_LIGHT,
  REGIONS,
  SPECIES,
  figureParts,
  BOOK_PARTS,
  SLEEPY_EYES,
  regionBehind,
  type GateId,
  type Look,
  type RegionId,
} from '../../data/games/mitwachsen';
import { carried } from './mitwachsen-carry';
import { grown } from './mitwachsen-growth';
import {
  drawBox,
  drawDeco,
  drawMark,
  placeRails,
  type Box,
  type DecoAt,
  type RailFoot,
  type View2D,
} from './mitwachsen-view';
import { decoBoxes } from './mitwachsen-deco-look';
import {
  SIGN_TOP,
  WOOD_BED,
  bedBoxes,
  bridgeBoxes,
  fenceBoxes,
  signBoxes,
  signWidth,
  sleeperBoxes,
} from './mitwachsen-yard-look';
import { clampRow, rowCache, sortBoxes } from './mitwachsen-row';
import { heardStone, noteFloat } from './mitwachsen-story';
import { STONE_FOOT, drawStone } from './mitwachsen-stone-look';
import type { WeatherLook } from './mitwachsen-weather';
import type { Pose } from './mitwachsen-tired';
import type { Climate } from './mitwachsen-world';
import type { State } from './mitwachsen-state';
import { cycle, hash } from '../../lib/games/rng';
import type { Cell, Deco, World } from './mitwachsen-world';
import { ROOF_LEFT, homeAt, openRoof } from './mitwachsen-home';
import { drawPlate, drawPlatform } from './mitwachsen-platform-2d';
import { stoneOf } from './mitwachsen-waystone';
import { waystoneBoxes } from './mitwachsen-waystone-look';
import type { PlateFx } from './mitwachsen-plate';
import type { PackId } from './mitwachsen-pack-types';
import { BED_SNOW, flatColors } from './mitwachsen-ground-2d';
import { bigGate } from './mitwachsen-gate-look';
import type { Guest } from './mitwachsen-guest-look';
import { guideGate, type Hint } from './mitwachsen-guide';
import { moodLife } from './mitwachsen-sky';
import { turnHead } from './mitwachsen-air';
import { Album } from './mitwachsen-album';
import { ASK, BIRD, BIRD_EYE, HEART, NOTE, ZZZ, sprite, type Particle } from './mitwachsen-glyphs';
import { byRow, drawRide, footOf, type RideBody } from './mitwachsen-ride-view';
import { hangAt, labelHeight } from './mitwachsen-roost';
import { isRing } from './mitwachsen-rim';
import { PAL_RING, rimBlossoms } from './mitwachsen-rim-look';
import { workOf } from './mitwachsen-herald';
import {
  Fine2D,
  FootSpots,
  Sprites,
  boxesExtent,
  contactShadow,
  edgeShade,
  glowHalo,
  modelExtent,
} from './mitwachsen-fine-2d';
import { HaloPass, type HaloLit, type HaloView } from './mitwachsen-halo';

/** Gleitende Position eines Wesens auf dem Bildschirm (in Feldern), dazu Hüpfer und Blickrichtung */
export type Body = { x: number; y: number; z: number; hop: number; puff?: number }; // puff: Haltung im Iglu (Größe)
export type Float = {
  kind: 'note' | 'heart' | 'zzz' | 'bird';
  x: number;
  y: number;
  z: number;
  age: number;
  color: string;
};
export type { Particle };

export type Scene = {
  width: number;
  height: number;
  zoom: number;
  cam: { x: number; y: number };
  bodies: Map<string, Body>; // Tiere nach Kennung, die Figur unter 'player'
  gates: Map<GateId, number>; // Öffnung 0…1 je Tor
  night: number; // 0 Tag … 1 Nacht
  evening: number; // 0 Tag … 1 goldener Abend (die Figur wird müde)
  weather: WeatherLook; // Wolken, Regen, Regenbogen, Schnee, Pustewind, Böe, Glitzerluft (je 0 … 1)
  aurora: number; // nachts im Schneebett: Polarlicht (0 … 1)
  glance: boolean; // die Figur dreht bei einer Böe kurz den Kopf zur Seite
  pose: Pose; // was die wache Figur tut, wenn niemand spielt (lesen, einnicken)
  mood: Climate; // Stimmung dort, wo die Figur steht (Richtung des nächsten Tors, Stärke)
  realm: RegionId; // Gegend, in der die Figur steht (Himmel der Grotte)
  wind: number; // 0 still … 1 windig (Gras wiegt sich, Blätter fliegen)
  lit3d: boolean; // die 3D-Ansicht liegt darunter und färbt das Licht selbst
  floats: Float[];
  particles: Particle[];
  now: number;
  look: Look;
  reduced: boolean; // prefers-reduced-motion: nichts wippt, steigt oder funkelt
  bottomInset: number; // Platz unten für die Touch-Steuerung (die Leiste rückt darüber)
  explored: (x: number, y: number) => boolean; // Nebel: nur Erkundetes wird gezeigt
  away: (x: number, y: number) => boolean; // Sitzplatz, dessen Tier gerade nur im Bild eines Pakets fliegt (`View2D.away`)
  plate: PlateFx | null; // Torplatte, die die Figur zuletzt betreten oder verlassen hat (sinkt ein, springt hoch)
  hint: Hint | null; // „noch nicht“: was dem Eistor fehlt und seit wann es das zeigt (vergeht nach HINT_MS von selbst)
  rides: readonly RideBody[]; // Fahrzeug aus einem Welt-Paket (Schlitten, Zugtier, Laternenpfahl; die Figur sitzt darin)
};

/**
 * Weicher Fleck unter Dingen in 2D (in 3D macht das die Sonne): Mitte (Felder nach vorn) und Halbbreite des Fußes (oder
 * quer und tief). Die Dinge der Welt-Pakete melden ihren selbst (`View2D.foot`)
 */
const SHADOW: Partial<Record<Deco, readonly [number, number | readonly [number, number]]>> = {
  tree: [0.55, 0.45],
  bush: [0.55, 0.36],
  boulder: [0.55, 0.32],
  bed: [0.52, [0.46, 0.44]],
  cactus: [0.5, 0.26],
  trough: [0.51, [0.46, 0.38]],
  watertrough: [0.51, [0.46, 0.38]],
  bigshroom: [0.5, 0.3],
  shelterpilz: [0.5, 0.42],
  sign: [0.5, 0.14], // Pfosten der Tafel
};
/** Anstieg des Blicks je Feld nach vorn in 2D (für die Verdeckung der Leuchten): Tiefe einer Reihe in Ebenen */
const RISE_2D = TILE_D / LEVEL_H;

/** Dunst am Rand des Erkundeten auf Feld (x, y): je mehr Nebel ringsum (5 × 5), desto dichter (0 … 0,85) */
function hazeAt(sc: Pick<Scene, 'explored'>, x: number, y: number): number {
  let fog = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!sc.explored(x + dx, y + dy)) fog++;
  return Math.min(0.85, fog / 14);
}
/** Kennungen der festen Teilelisten (Tiere, Haltungen) für den Bild-Cache; die Figur wird nach ihrem Inhalt erkannt */
const PART_IDS = new WeakMap<readonly Part[], string>();
let partCount = 0;
const partsId = (parts: readonly Part[]) => {
  let id = PART_IDS.get(parts);
  if (!id) PART_IDS.set(parts, (id = `m${partCount++}`));
  return id;
};

/**
 * Die Figur, mit Korb auf dem Rücken, Eimer (in der Grotte Kanne) und Netz in den Händen, solange sie Beeren oder Pilze,
 * Wasser und Fische trägt, und mit Buch, wenn niemand spielt
 */
const figure = (state: State, sc: Scene, world: World) => [
  ...(sc.glance ? turnHead(figureParts(sc.look)) : figureParts(sc.look)),
  ...carried(state, world.realm(state.player.x, state.player.y) === 'hoehle'),
  ...(sc.pose === 'stand' ? [] : BOOK_PARTS(sc.look, sc.pose === 'read' && !sc.reduced && sc.now % 5000 < 450)),
  ...(sc.pose === 'doze' ? SLEEPY_EYES(sc.look) : []),
];
/** Beim Lesen schaut die Figur zum Betrachter */
const facing = (state: State, sc: Scene) => (sc.pose === 'stand' ? state.player.dir : 's');

const PAL_SAND: Palette = { D: [['#e3cf95', 1]], d: [['#d4bd7d', 1]], e: [['#efdeaa', 1]] };
const PAL_PATH: Palette = { D: [['#c9a46e', 1]], d: [['#b48d58', 1]], e: [['#d8b783', 1]] };

/** Höhe der Oberseite eines Felds für den weichen Schatten am Boden; null, wo kein Boden ist (Wasser, Lava, Himmel) */
const heightOrNull = (c: Cell): number | null =>
  c.ground === 'water' || c.ground === 'lava' || c.ground === 'sky' ? null : c.h;

export class Renderer {
  /** Quader der Welt-Pakete im Bild (Iglu, Eisschale, Trog, Kristallwand): jeder kommt in der Reihe seiner Vorderkante dran */
  private later: Box[] = [];
  /** Zeichenteile je Welt aus ihrem Welt-Paket (nach ihrem Tor, ein Paket ohne eigene Welt nach seiner Kennung), sobald es geladen ist */
  views = new Map<GateId | PackId, View2D>();
  private at: DecoAt = { now: 0, reduced: false, picked: {}, packs: {} };
  private album = new Album(); // Leiste unten
  private roof = 1; // Deckkraft der Dächer am Zuhause in diesem Bild (`openRoof`)
  private things = rowCache(); // Quader der Dinge je Feld, geklemmt und sortiert (nicht jedes Bild neu)
  private fine = new Fine2D(); // Muster und Verlauf der Dinge, sammelt das Leuchten
  private sprites = new Sprites(); // Dinge und Modelle als Bild je Maßstab (mitwachsen-fine-2d.ts)
  private spots = new FootSpots(); // Flecken über mehrere Reihen (Iglu)
  private halos = new HaloPass(); // Leuchten über allem (mitwachsen-halo.ts)
  private guest: Guest | null = null; // der Pinguin am Tor, solange er führt (Umriss, goldene Torplatte; nachgeladen)
  private blocks: Record<'grass' | 'dirt' | 'stone' | 'ring' | 'sand' | 'path' | 'leaves' | 'log', HTMLCanvasElement>;

  constructor(private readonly ctx: CanvasRenderingContext2D) {
    this.blocks = {
      grass: frontBlock(GRASS_TOP, GRASS_SIDE, PAL_GRASS),
      dirt: frontBlock(DIRT, DIRT, PAL_GRASS),
      stone: frontBlock(STONE, STONE, PAL_STONE),
      ring: frontBlock(STONE, STONE, PAL_RING), // Fels am Rand der Lichtung: dunkler Schiefer (mitwachsen-rim-look.ts)
      sand: frontBlock(DIRT, DIRT, PAL_SAND),
      path: frontBlock(DIRT, DIRT, PAL_PATH),
      leaves: frontBlock(LEAVES, LEAVES, PAL_LEAVES),
      log: frontBlock(LOG_SIDE, LOG_SIDE, PAL_LOG),
    };
  }

  draw(world: World, state: State, sc: Scene) {
    const { ctx } = this;
    const z = sc.zoom;
    const P = projection(sc.cam.x + 0.5, sc.cam.y + 0.5, sc.width / 2, sc.height / 2 + 30 * z, z);
    this.sky(sc);

    const cols = Math.ceil(sc.width / 2 / (TILE_W * z)) + 1;
    const x0 = Math.floor(sc.cam.x) - cols,
      x1 = Math.ceil(sc.cam.x) + cols;
    const y0 = Math.floor(sc.cam.y - sc.height / 2 / (TILE_D * z)) - 2;
    const y1 = Math.ceil(sc.cam.y + (sc.height / 2 + 4 * LEVEL_H * z) / (TILE_D * z)) + 2;

    // Wesen nach der Reihe, in der sie gezeichnet werden: beim Gehen nach vorn schon in der Zielreihe. Im Fahrzeug
    // sitzt die Figur in seinem Modell, im Bett liegt sie im Bett
    const rows = new Map<number, string[]>();
    for (const [id, b] of sc.bodies) {
      if (id === 'player' && (state.sleeping || state.ride)) continue;
      const row = Math.ceil(b.y - 1e-6);
      rows.set(row, [...(rows.get(row) ?? []), id]);
    }
    const byId = new Map(state.animals.map((a) => [a.id, a]));
    const rides = new Map<number, RideBody[]>();
    for (const r of sc.rides) {
      const row = Math.ceil(r.y - 1e-6);
      rides.set(row, [...(rides.get(row) ?? []), r]);
    }
    const marks = byRow(this.all((v) => v.marks?.(state, world) ?? [])); // Schneespur des Fahrzeugs

    this.later = [];
    this.at = { now: sc.now, reduced: sc.reduced, picked: state.picked, packs: state.packs, work: workOf(state) };
    paintWith(ctx, this.fine); // Dinge fein; Gelände, Böden und Torhäuser zeichnen ausdrücklich flach
    this.sprites.begin(ctx, world);
    this.spots.begin();
    this.roof = 1 - (1 - ROOF_LEFT) * openRoof(world, state.player.x, state.player.y).open;
    this.guest = this.guestAt(world, state);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) this.ground(P, world, x, y, sc);
      for (const b of marks.get(y) ?? []) if (sc.explored(Math.floor(b[0]), y)) drawMark(ctx, P, b); // weicher Rand
      for (const v of this.views.values()) v.trail?.draw(ctx, world, P, y); // Fußspuren im Schnee (aus dem Welt-Paket)
      this.spots.row(ctx, P, y);
      for (let x = x0; x <= x1; x++) this.deco(P, world, state, sc, x, y);
      for (const b of this.later)
        if (Math.ceil(b[1] + b[4] - 1e-6) - 1 === y) {
          ctx.globalAlpha = b[8] === 'see' ? this.roof : 1; // Dach am Zuhause durchscheinend (`openRoof`)
          drawBox(ctx, P, b, b[8] === 'sway' || b[8] === 'glow' ? null : undefined); // Leuchtschrift, Lichtpunkte: scharf
          if (b[8] === 'glow') glowHalo(this.fine, b); // scharf, leuchtet aber weich in den Raum wie in 3D
          ctx.globalAlpha = 1;
        }
      for (const r of rides.get(y) ?? []) this.ride(P, sc, r);
      const ids = (rows.get(y) ?? []).sort((a, b) => sc.bodies.get(a)!.x - sc.bodies.get(b)!.x);
      for (const id of ids) {
        const b = sc.bodies.get(id)!;
        if (id === 'player') {
          contactShadow(ctx, P, b.x + 0.5, b.y + 0.5, b.z, 0.3, b.hop, sc.reduced);
          const me = figure(state, sc, world);
          this.model(P, me, JSON.stringify(me), b, facing(state, sc), 1);
          continue;
        }
        const a = byId.get(id);
        if (!a || !sc.explored(Math.round(b.x), Math.round(b.y))) continue; // Tiere im Nebel bleiben verborgen
        const sp = SPECIES[a.species];
        const scale = sp.scale * (b.puff ?? 1);
        const perch = hangAt(a, world.cell(a.x, a.y)); // hängt kopfüber an seinem Sitzplatz (Fledermaus im Bogen)
        if (perch !== undefined && sc.away(a.x, a.y)) continue; // gerade auf ihrer Runde (Bild des Welt-Pakets)
        contactShadow(ctx, P, b.x + 0.5, b.y + 0.5, b.z, 0.24 * scale, perch === undefined ? b.hop : 0, sc.reduced);
        const parts = perch !== undefined && sp.roost ? sp.roost : (a.solo && sp.solo) || sp.parts;
        this.model(P, parts, partsId(parts), perch !== undefined && sp.roost ? { ...b, hop: perch } : b, a.dir, scale);
      }
    }

    // Die Figur noch einmal halb durchsichtig obenauf: Steht sie hinter einem Hügel oder Baum, bleibt sie sichtbar
    const me = sc.bodies.get('player');
    if (me && !state.sleeping && !state.ride) {
      ctx.globalAlpha = 0.35;
      const parts = figure(state, sc, world);
      this.model(P, parts, JSON.stringify(parts), me, facing(state, sc), 1, false); // ihre Leuchten zählen schon
      ctx.globalAlpha = 1;
    }
    paintWith(ctx, null);

    this.atmosphere(sc);
    this.overlay(world, state, sc, P, this.fine.take());
  }

  /** Ein Modell (Figur, Tier) aus dem Bild-Cache: je Teile, Richtung und Größe einmal fein gezeichnet */
  private model(P: Projection, parts: readonly Part[], id: string, b: Body, dir: Dir, scale: number, glow = true) {
    const key = `${id}|${dir}|${scale.toFixed(3)}`;
    const at = [b.x + 0.5, b.y + 0.5, b.z + b.hop] as const;
    this.sprites.draw(
      this.ctx,
      P,
      key,
      at,
      modelExtent(parts, scale),
      (c, Q) => {
        drawModel(c, Q, parts, at[0], at[1], at[2], dir, scale);
      },
      glow ? this.fine : null,
    );
  }

  /** Etwas, das Block bleibt (Torhaus, Portal, Torplatte), ohne den Maler der Dinge zeichnen */
  private flat(draw: () => void) {
    paintWith(this.ctx, null);
    draw();
    paintWith(this.ctx, this.fine);
  }

  /** Ein Körper eines Fahrzeugs (im Nebel verborgen wie die Tiere) */
  private ride(P: Projection, sc: Scene, r: RideBody) {
    if (!sc.explored(Math.round(r.x), Math.round(r.y))) return;
    if (footOf(r) > 0) contactShadow(this.ctx, P, r.x + 0.5, r.y + 0.5, r.z, footOf(r), 0, sc.reduced);
    drawRide(this.ctx, P, r);
  }

  /**
   * Alles, was über der Welt schwebt: Zeichen über den Tieren, Herzen und Noten, Heimweg-Pfeil, Nacht, Leben in der
   * Luft und die Leiste. Gleich für beide Ansichten; die 3D-Ansicht reicht ihre eigene Projektion herein und zeichnet
   * diese Ebene auf ein durchsichtiges Canvas über der 3D-Welt.
   */
  overlay(world: World, state: State, sc: Scene, P: Projection, halos: readonly HaloLit[] = [], view?: HaloView) {
    const { ctx } = this;
    const z = sc.zoom;
    const followers = new Set(state.followers);
    for (const v of this.views.values()) v.trail?.step(world, state, sc); // Spuren merken, in beiden Ansichten (nur Bild)
    if (sc.evening > 0) this.eveningGlow(sc);
    this.weather(sc);
    const [realm, ice] = this.skyOf(world, state); // Wetter einer Welt und Bild der Weltgrenze, erst nachgeladen
    if (world.spotsOf(realm).length) ice?.weather(ctx, world, sc, P, state); // ohne Paket der Welt kein Iglu, kein Wetter
    for (const a of state.animals) {
      const b = sc.bodies.get(a.id);
      if (!b || !sc.explored(Math.round(b.x), Math.round(b.y))) continue; // im Nebel nichts verraten
      if (sc.away(a.x, a.y) && hangAt(a, world.cell(a.x, a.y)) !== undefined) continue; // fliegt gerade ihre Runde
      const [hx, hy] = P(b.x + 0.5, b.y + 0.5, b.z + labelHeight(a, world.cell(a.x, a.y), b.hop)); // hängend: am Sitzplatz
      if (followers.has(a.id)) sprite(ctx, HEART, GAME_COLORS.heart, hx, hy, 2.5 * z);
      else if (a.nap) {
        // ein schlafender Bote (Tok am Abend): leise „Zzz“, sanft auf und ab (bei reduzierter Bewegung kein Zzz)
        if (!sc.reduced) sprite(ctx, ZZZ, GAME_COLORS.note, hx + 6 * z, hy + Math.sin(sc.now / 700) * 3 * z, 2 * z);
      } else if (a.mode === 'wait')
        ice?.waitArrow(ctx, world, P, a, b, [hx, hy], 3 * z); // Pfeil zum Tor
      else if (a.mode !== 'home' && !state.met.includes(a.id)) {
        // Verloren: ein Fragezeichen schwebt über dem Kopf (nie über einem Tier, das zu Hause wohnt: der erste Maulwurf
        // zog ein, ohne dass die Figur ihn anlief)
        const bob = sc.reduced ? 0 : Math.sin(sc.now / 400 + b.x) * 2 * z;
        sprite(ctx, ASK, GAME_COLORS.lost, hx, hy + bob, 2.5 * z);
      } else if (a.mode === 'home' && !sc.reduced) {
        // Zu Hause im Garten glücklich: ab und zu steigt ein kleines Herz auf
        const phase = (sc.now / 1000 + ((a.id.length * 7.3) % 5)) % 5;
        if (phase < 1.2) {
          ctx.globalAlpha = 1 - phase / 1.2;
          sprite(ctx, HEART, GAME_COLORS.heart, hx + 6 * z, hy - phase * 18 * z, 2 * z);
          ctx.globalAlpha = 1;
        }
      }
    }
    this.effects(P, sc);
    sc.hint?.draw?.(ctx, world, P, sc.now); // „noch nicht“: Umriss dessen, was fehlt (nachgeladen, vergeht von selbst)
    moodLife(ctx, sc);
    if (sc.night > 0) this.nightSky(sc);
    if (sc.aurora > 0) ice?.aurora(ctx, sc, P);
    // Leuchten kompakter Teile: nach Maske und Nacht, nur Erkundetes, gedämpft hinter Hügeln und Kronen
    const me = sc.bodies.get('player');
    const focus = [(me?.x ?? sc.cam.x) + 0.5, (me?.y ?? sc.cam.y) + 0.5] as const;
    this.halos.draw(ctx, P, halos, {
      explored: sc.explored,
      night: sc.night,
      focus,
      cell: world.cell.bind(world),
      view: view ?? { rise: RISE_2D, to: [0, 1], seen: (x, y) => 1 - hazeAt(sc, x, y) }, // 2D: von vorn, Dunst wie `haze`
    });
    this.life(sc);
    this.album.draw(ctx, state, sc, world.realm(state.player.x, state.player.y), ice);
  }

  /** Erstes Ergebnis der Zeichenteile aller geladenen Welten (undefined: keine hat eins) */
  first<T>(f: (v: View2D) => T | null | undefined): T | undefined {
    for (const v of this.views.values()) {
      const out = f(v);
      if (out != null) return out;
    }
    return undefined;
  }

  /** Was die Zeichenteile aller geladenen Welten liefern, hintereinander */
  all<T>(f: (v: View2D) => readonly T[]): T[] {
    return [...this.views.values()].flatMap(f);
  }

  /** Gast am Tor einer Welt (der führende Pinguin, aus ihrem Paket), sonst null */
  guestAt = (world: World, state: State): Guest | null => this.first((v) => v.sky?.guestAt(world, state)) ?? null;

  /**
   * Wetter und Bild der Weltgrenze (aus dem Welt-Paket, worlds/<welt>/): das der Welt, in der die Figur ist (Eis-Welt:
   * worlds/eis/mitwachsen-ice-sky.ts), auf der Lichtung das der Eis-Welt, wenn das Eistor offen oder der verlaufene
   * Pinguin da ist (Gast-Platz mit Schneeflocke); sonst nichts. Dazu die Gegend, zu der es gehört
   */
  private skyOf(world: World, state: State): [RegionId, NonNullable<View2D['sky']> | null] {
    const realm = world.realm(state.player.x, state.player.y);
    const own = REGIONS.find((r) => r.id === realm)?.behind;
    const eis = state.openGates.includes('eis') || guideGate(state);
    const gate = own ?? (eis ? 'eis' : undefined);
    return [gate ? (regionBehind(gate)?.id ?? realm) : realm, (gate && this.views.get(gate)?.sky) || null];
  }

  private sky(sc: Scene) {
    const { ctx } = this;
    const own = REGIONS.find((r) => r.id === sc.realm)?.behind; // Himmel einer Welt (Grotte: lila Höhlenhimmel)
    ((own && this.views.get(own)?.heaven) || ['#79c7ea', '#8dd0ee', '#a6dbf2']).forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, (sc.height * i) / 3, sc.width, sc.height / 3 + 1);
    });
  }

  private img(P: Projection, image: HTMLCanvasElement, x: number, y: number, top: number) {
    const [sx, sy] = P(x, y, top);
    const w = P(x + 1, y, top)[0] - sx;
    this.ctx.drawImage(image, sx, sy, w, (w * (TILE_D + LEVEL_H)) / TILE_W);
  }

  /** Säule eines Feldes: nur die Blöcke, deren Vorderseite nicht vom Feld davor verdeckt wird */
  private ground(P: Projection, world: World, x: number, y: number, sc: Scene) {
    const c = world.cell(x, y);
    if (!sc.explored(x, y)) return; // im Nebel: nichts, der Himmel scheint durch
    if (c.ground === 'water') return this.water(P, world, x, y, sc);
    if (c.ground === 'sky') return; // zwischen den Wolken: nur Himmel
    if (c.ground === 'lava') return box(this.ctx, P, x, y, 0, 1, 1, 0.6, '#b8380a', '#ff7a1a', undefined, null);
    const flat = flatColors(c);
    if (flat) {
      // Böden der Welten hinter den Toren: einfache Blöcke in ihren Farben
      const frontH = world.cell(x, y + 1).h;
      for (let k = Math.max(0, Math.min(c.h - 1, frontH)); k < c.h; k++)
        box(this.ctx, P, x, y, k, 1, 1, 1, ...flat, undefined, null);
      // Rutschspur zum Schneebett (aus dem Welt-Paket): flach im Boden, unter Kanten und Nebelrand
      if (c.biome)
        drawBox(this.ctx, P, this.views.get(c.biome)?.ground(c, x, y, sc.gates.has(c.biome), sc.evening), null);
      this.edges(P, world, x, y, c.h);
      this.plate(P, world, c, x, y, sc);
      return this.haze(P, x, y, c.h, sc);
    }
    const front = world.cell(x, y + 1);
    const frontH = front.ground === 'water' ? 0 : front.h;
    const low = Math.max(0, Math.min(c.h - 1, frontH));
    for (let k = low; k < c.h; k++) {
      const top = k === c.h - 1;
      const image = c.rim
        ? this.blocks.leaves // Hecke an der innersten Reihe des Rands
        : c.ground === 'stone'
          ? this.blocks[isRing(c) ? 'ring' : 'stone']
          : !top
            ? this.blocks.dirt
            : c.ground === 'sand'
              ? this.blocks.sand
              : c.ground === 'path'
                ? this.blocks.path
                : this.blocks.grass;
      this.img(P, image, x, y, k + 1);
    }
    this.edges(P, world, x, y, c.h);
    if (c.rim)
      for (const [bx, by, bz, w, d, bh, color] of rimBlossoms(x, y, c.h))
        box(this.ctx, P, bx, by, bz, w, d, bh, color, color, undefined, null);
    if (c.tint && c.ground === 'grass') {
      // Stimmung der Richtung: Gras tönen (multiplizieren, damit die Körnung bleibt)
      const [ax, ay] = P(x, y, c.h);
      const [bx, by] = P(x + 1, y + 1, c.h);
      this.ctx.globalCompositeOperation = 'multiply';
      this.ctx.fillStyle = c.tint;
      this.ctx.fillRect(ax, ay, bx - ax, by - ay);
      this.ctx.globalCompositeOperation = 'source-over';
    }
    if (c.shade && c.ground !== 'stone') {
      const [ax, ay] = P(x, y, c.h);
      const [bx, by] = P(x + 1, y + 1, c.h);
      this.ctx.fillStyle =
        c.shade > 0
          ? `rgba(255,240,170,${(0.05 * c.shade).toFixed(3)})`
          : `rgba(20,60,20,${(-0.14 * c.shade).toFixed(3)})`;
      this.ctx.fillRect(ax, ay, bx - ax, by - ay);
    }
    this.plate(P, world, c, x, y, sc);
    this.haze(P, x, y, c.h, sc); // Nebelrand zuletzt: Er liegt auch über Tönung und Torplatte
  }

  /** Wegstein und Torplatte auf dem Feld (nach dem Boden, vor dem Nebelrand: Sinkt sie ein, verdeckt das Feld davor ihre Vorderkante) */
  private plate(P: Projection, world: World, c: Cell, x: number, y: number, sc: Scene) {
    const way = stoneOf(c); // Wegstein neben einem Weltpfad: wach, sobald sein Tor offen ist
    if (way) for (const b of waystoneBoxes(x, y, c.h, way, sc.gates.has(way))) drawBox(this.ctx, P, b);
    if (c.plate) {
      const look = this.views.get(c.plate)?.plate; // Schmuck aus dem Paket der Welt dahinter (Eis-Welt: Scholle)
      // goldener Rand, solange der Pinguin zu diesem Tor führt (aus dem Paket)
      const gold = this.guest?.rim(c.plate, sc.now, sc.reduced);
      this.flat(() => drawPlate(this.ctx, P, world, c.plate!, x, y, c.h, sc.plate, sc.now, sc.reduced, look, gold));
    }
  }

  /** Höhen sichtbar machen: höhere Flächen heller, Kanten an Abhängen, Schatten am Fuß höherer Nachbarn */
  private edges(P: Projection, world: World, x: number, y: number, h: number) {
    const { ctx } = this;
    const height = (nx: number, ny: number) => {
      const n = world.cell(nx, ny);
      return n.ground === 'water' ? 0 : n.h;
    };
    const [ax, ay] = P(x, y, h);
    const [bx, by] = P(x + 1, y + 1, h);
    const w = bx - ax,
      d = by - ay;
    const line = Math.max(2, w / 28);
    if (h >= 2) {
      ctx.fillStyle = `rgba(255,255,255,${0.045 * (h - 1)})`;
      ctx.fillRect(ax, ay, w, d);
    }
    const sides: [number, number, (t: number) => void][] = [
      [x - 1, y, (t) => ctx.fillRect(ax, ay, t, d)],
      [x + 1, y, (t) => ctx.fillRect(bx - t, ay, t, d)],
      [x, y - 1, (t) => ctx.fillRect(ax, ay, w, t)],
    ];
    for (const [nx, ny, rect] of sides) {
      const nh = height(nx, ny);
      if (nh > h) {
        ctx.fillStyle = GAME_COLORS.shade;
        rect(w * 0.14);
      } else if (nh < h) {
        ctx.fillStyle = GAME_COLORS.ledge;
        rect(line);
      }
    }
    // weicher Schatten neben höheren Blöcken (Entwurf „Feine Grafik“), zusätzlich zu den Kanten
    edgeShade(ctx, P, (nx, ny) => heightOrNull(world.cell(nx, ny)), x, y);
    if (height(x, y + 1) < h) {
      ctx.fillStyle = GAME_COLORS.highlight;
      ctx.fillRect(ax, by - line, w, line);
      // dunkle Unterkante der Stufe, damit sie sich vom Boden davor abhebt
      const [, fy] = P(x, y + 1, height(x, y + 1));
      ctx.fillStyle = GAME_COLORS.ledge;
      ctx.fillRect(ax, fy - line, w, line);
    }
  }

  private water(P: Projection, world: World, x: number, y: number, sc: Scene) {
    const { ctx } = this;
    const [ax, ay] = P(x, y, 0.8);
    const [bx, by] = P(x + 1, y + 1, 0.8);
    const w = bx - ax,
      d = by - ay;
    const biome = world.cell(x, y).biome;
    const [main, glint] = (biome && this.views.get(biome)?.water) || [GAME_COLORS.water, GAME_COLORS.waterLight];
    ctx.fillStyle = main;
    ctx.fillRect(ax, ay, w + 0.5, d + 0.5);
    // Tiefer in der Mitte, heller am Ufer
    const shore = ['n', 'w', 'e'].filter((k) => {
      const [dx, dy] = k === 'n' ? [0, -1] : k === 'w' ? [-1, 0] : [1, 0];
      return world.cell(x + dx, y + dy).ground !== 'water';
    });
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    if (shore.includes('n')) ctx.fillRect(ax, ay, w, Math.max(2, d * 0.08));
    if (shore.includes('w')) ctx.fillRect(ax, ay, Math.max(2, w * 0.06), d);
    if (shore.includes('e')) ctx.fillRect(bx - Math.max(2, w * 0.06), ay, Math.max(2, w * 0.06), d);
    // Glitzern, das langsam wandert
    const t = sc.reduced ? 0 : sc.now / 1600;
    ctx.fillStyle = glint;
    for (let i = 0; i < 2; i++) {
      const seed = hash(7, x, y, i);
      const fx = ((seed % 100) / 100 + t * (0.15 + i * 0.1)) % 1;
      const fy = 0.25 + i * 0.4 + ((seed >>> 8) % 20) / 100;
      ctx.fillRect(ax + fx * w * 0.7, ay + fy * d, w * 0.28, Math.max(2, d * 0.05));
    }
  }

  /** Grasbüschel: je drei schmale Halme in verschiedenen Grüntönen */
  private tufts(P: Projection, x: number, y: number, h: number, n: number) {
    const greens = ['#3a7f2c', '#4f9a3c', '#6dbd47', '#2f6f28'];
    for (let i = 0; i < n; i++) {
      const r = hash(3, x, y, i);
      const tx = x + 0.12 + (r % 70) / 100,
        ty = y + 0.15 + ((r >>> 8) % 65) / 100;
      for (let b = 0; b < 3; b++) {
        const bh = 0.2 + ((r >>> (12 + b * 3)) % 7) / 36;
        const g = cycle(greens, r + b);
        box(this.ctx, P, tx + b * 0.055, ty + (b === 1 ? -0.02 : 0), h, 0.045, 0.02, bh, g, undefined, undefined, null);
      }
    }
  }

  /** Warmes Licht von oben links, Dunst in der Ferne (oben im Bild) und dunklere Ränder */
  private atmosphere(sc: Scene) {
    const { ctx } = this;
    const sun = ctx.createRadialGradient(
      sc.width * 0.15,
      -sc.height * 0.1,
      0,
      sc.width * 0.15,
      -sc.height * 0.1,
      sc.height * 1.1,
    );
    sun.addColorStop(0, 'rgba(255,236,190,.16)');
    sun.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, sc.width, sc.height);
    const haze = ctx.createLinearGradient(0, 0, 0, sc.height * 0.25);
    haze.addColorStop(0, 'rgba(190,225,245,.2)');
    haze.addColorStop(1, 'rgba(190,225,245,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, sc.width, sc.height * 0.25);
    const edge = ctx.createRadialGradient(
      sc.width / 2,
      sc.height / 2,
      sc.height * 0.45,
      sc.width / 2,
      sc.height / 2,
      sc.width * 0.75,
    );
    edge.addColorStop(0, 'rgba(20,30,40,0)');
    edge.addColorStop(1, 'rgba(20,30,40,.22)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, sc.width, sc.height);
  }

  /** Leben in der Luft: tagsüber Schmetterlinge und Pollen, nachts Glühwürmchen (nicht bei reduzierter Bewegung) */
  private life(sc: Scene) {
    if (sc.reduced) return;
    const { ctx } = this;
    const t = sc.now / 1000;
    if (sc.night < 0.5) {
      const wings = ['#ffffff', '#f2c94c', '#e77fb3', '#8cc6f0'];
      for (let i = 0; i < 5; i++) {
        const x = (((Math.sin(t * 0.13 + i * 2.1) + 1) / 2) * 0.9 + 0.05) * sc.width;
        const y = (((Math.sin(t * 0.17 + i * 1.3) + 1) / 2) * 0.6 + 0.15) * sc.height + Math.sin(t * 3 + i) * 6;
        const flap = Math.sin(t * 14 + i) > 0 ? 1 : 0.4;
        const s = 3 * sc.zoom;
        ctx.fillStyle = cycle(wings, i);
        ctx.fillRect(x - s * 2 * flap, y - s, s * 2 * flap, s * 1.6);
        ctx.fillRect(x, y - s, s * 2 * flap, s * 1.6);
        ctx.fillStyle = '#1d2838';
        ctx.fillRect(x - s * 0.3, y - s, s * 0.6, s * 1.8);
      }
      ctx.fillStyle = 'rgba(255,250,220,.7)';
      for (let i = 0; i < 24; i++) {
        const x = ((i * 137.5 + t * (8 + (i % 5) * 3)) % (sc.width + 40)) - 20;
        const y = (((i * 89.3 + Math.sin(t * 0.5 + i) * 30) % sc.height) + sc.height) % sc.height;
        ctx.fillRect(x, y, 2, 2);
      }
    } else {
      for (let i = 0; i < 16; i++) {
        const x = ((Math.sin(t * 0.21 + i * 1.7) + 1) / 2) * sc.width;
        const y = (((Math.sin(t * 0.18 + i * 2.3) + 1) / 2) * 0.7 + 0.25) * sc.height;
        const glow = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2 + i * 1.9));
        ctx.fillStyle = `rgba(255,236,120,${(glow * sc.night).toFixed(2)})`;
        ctx.fillRect(x, y, 3 * sc.zoom, 3 * sc.zoom);
        ctx.fillStyle = `rgba(255,236,120,${(glow * 0.25 * sc.night).toFixed(2)})`;
        ctx.fillRect(x - 3 * sc.zoom, y - 3 * sc.zoom, 9 * sc.zoom, 9 * sc.zoom);
      }
    }
  }

  /** Weicher Dunst am Rand des Erkundeten: je mehr Nebel ringsum, desto heller */
  private haze(P: Projection, x: number, y: number, h: number, sc: Scene) {
    const veil = hazeAt(sc, x, y);
    if (!veil) return;
    const [ax, ay] = P(x, y, h);
    const [bx, by] = P(x + 1, y + 1, h);
    const [, cy] = P(x, y + 1, Math.max(0, h - 2));
    this.ctx.fillStyle = `rgba(214,234,246,${veil.toFixed(2)})`;
    this.ctx.fillRect(ax, ay, bx - ax, Math.max(by, cy) - ay);
  }

  private deco(P: Projection, world: World, state: State, sc: Scene, x: number, y: number) {
    if (!sc.explored(x, y)) return;
    const c = grown(world.seed, state.day, x, y, world.cell(x, y)); // mit allem, was schon nachgewachsen ist
    const { ctx } = this;
    // Gleis (Paket der Bahn) statt Büscheln, Blumen und Deko; unter der Tür des Höhlentors die Tür darüber (`placeRails`)
    const rails = () => this.first((v) => v.rails?.(c, x, y, this.at));
    const foot = ([fx, fy, fz, f]: RailFoot) => contactShadow(ctx, P, fx, fy, fz, f);
    if (!placeRails(ctx, P, c, rails, this.later, foot)) return;
    const h = c.h;
    if (c.tufts) this.tufts(P, x, y, h, c.tufts);
    // Dinge einer Welt (Iglu, Eisschale, Wassertrog, Fischkiste, Kristallwand) zeichnet ihr Welt-Paket; solange es lädt,
    // ein Block
    const ice = c.biome ? drawDeco(this.views.get(c.biome) ?? null, world, c, x, y, this.at) : null;
    // gezeichnet erst in der Reihe ihrer Vorderkante: sonst deckte der Boden der Reihen davor die Kuppel unten zu
    if (ice) {
      const spot = this.views.get(c.biome!)?.foot?.(world, c, x, y);
      if (spot) this.spots.place(ctx, P, spot, y); // weicher Fleck darunter
      return void this.later.push(...ice);
    }
    const under = c.deco ? SHADOW[c.deco] : undefined;
    // das Höhlenbett in der Grotte ohne (Kontrast, „Mit Verlauf“)
    if (under && !(c.deco === 'bed' && c.biome === 'hoehle')) contactShadow(ctx, P, x + 0.5, y + under[0], h, under[1]);
    // Hängt nur an Feld, Ding und Beeren (Nachbarn von Hecke und Zaun, Unterstand stehen mit der Welt fest)
    const key = `${c.deco},${c.tree},${c.h},${c.color},${`${x},${y}` in state.picked}`;
    const things = this.things(world, x, y, key, () => {
      const boxes = decoBoxes(world, c, x, y, state.picked, () => homeAt(world, x, y).shelter);
      // der Hut am Unterstand spannt über mehrere Reihen: nur sortiert, nicht geklemmt
      return boxes && (c.deco === 'shelterpilz' ? sortBoxes(boxes) : clampRow(boxes, y));
    });
    if (things) {
      // der Hut am Unterstand ist durchscheinend, solange die Figur zu Hause ist (`openRoof`): Quader einzeln
      if (c.deco === 'shelterpilz') {
        for (const b of things) {
          ctx.globalAlpha = b[8] === 'see' ? this.roof : 1;
          drawBox(ctx, P, b);
        }
        ctx.globalAlpha = 1;
        return;
      }
      const at = [x + 0.5, y + 0.5, h] as const; // alles andere als Bild, je Feld und Ding einmal gezeichnet
      this.sprites.draw(
        ctx,
        P,
        `${x},${y}|${key}`,
        at,
        boxesExtent(things, at),
        (cc, Q) => {
          for (const b of things) drawBox(cc, Q, b);
        },
        this.fine,
      );
      return;
    }
    switch (c.deco) {
      case 'biggate': // Torhaus: Tür (je nach Öffnung), Türme, Torbogen; führt der Pinguin hierher, sein Umriss
      case 'gatetower':
        this.flat(() => bigGate(ctx, P, world, c, x, y, h, sc.gates, this.guest, this.fine)); // Tür und Beschläge fein
        break;
      case 'portal':
      case 'portalrim':
        this.flat(() => drawPlatform(ctx, P, world, state, x, y, h, c.portal!));
        break;
      case 'klangstein':
        contactShadow(ctx, P, x + 0.5, y + 0.5, h, STONE_FOOT); // weicher Fleck wie unter dem Findling
        drawStone(ctx, P, x, y, h, noteFloat(sc.now, x + y, heardStone(state, c.story!), sc.reduced)); // fein, Note leuchtet
        break;
      case 'gate':
        for (const b of clampRow(fenceBoxes(world, x, y, h, 1 - (sc.gates.get(c.gate!) ?? 0)), y)) drawBox(ctx, P, b);
        break;
      case 'bridge':
        for (const b of bridgeBoxes(x, y, sc.gates.get(c.gate!) ?? 0)) drawBox(ctx, P, b);
        break;
      case 'bed': {
        // Bett aus Holz (in der Eis-Welt aus Schnee), schläft die Figur, liegt sie darin (mitwachsen-yard-look.ts)
        const bed = bedBoxes(x, y, h, c.biome === 'eis' ? [...BED_SNOW, 'schnee'] : WOOD_BED);
        const sleeper = state.sleeping ? sleeperBoxes(x, y, h, sc.look) : [];
        for (const b of sortBoxes([...bed, ...sleeper])) drawBox(ctx, P, b);
        break;
      }
      case 'sign':
        this.sign(P, state, x, y, h, c);
        break;
    }
  }

  /** Tafel am Tor: Holzbrett, darauf die Tiere der Gegend – getroffene in Farbe, fehlende als Umriss */
  private sign(P: Projection, state: State, x: number, y: number, h: number, c: Cell) {
    const { ctx } = this;
    const gate = GATES.find((g) => g.id === c.sign)!;
    const region = REGIONS.find((r) => r.id === gate.region)!;
    const n = region.animals.length;
    const width = signWidth(n);
    for (const b of signBoxes(x, y, h, n)) drawBox(ctx, P, b);
    region.animals.forEach((a, i) => {
      const met = state.met.includes(`${region.id}:${a.species}`);
      const sp = SPECIES[a.species];
      const cx = x + 0.5 - width / 2 + 0.275 + i * 0.55;
      if (!met) ctx.globalAlpha = 0.55;
      drawModel(ctx, P, sp.parts, cx, y + 0.48, h + SIGN_TOP, 's', sp.scale * 0.5, met ? undefined : GAME_COLORS.ink);
      ctx.globalAlpha = 1;
    });
  }

  private effects(P: Projection, sc: Scene) {
    const { ctx } = this;
    for (const f of sc.floats) {
      const t = f.age / 1300;
      if (t >= 1) continue;
      const [x, y] = P(f.x + 0.5, f.y + 0.5, f.z);
      ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
      const lift = sc.reduced ? 0 : t * 40 * sc.zoom;
      if (f.kind === 'heart') sprite(ctx, HEART, f.color, x + 14 * sc.zoom, y - lift, 4 * sc.zoom);
      else if (f.kind === 'note') sprite(ctx, NOTE, f.color, x - 14 * sc.zoom, y - lift, 4 * sc.zoom);
      else if (f.kind === 'bird') {
        // der Vogel in der Hecke steigt nicht auf: Er schüttelt den Kopf (bei reduzierter Bewegung schaut er still)
        const shake = sc.reduced ? 0 : Math.sin(t * 26) * 3 * sc.zoom * (1 - t);
        sprite(ctx, BIRD, f.color, x + shake, y, 6 * sc.zoom);
        sprite(ctx, BIRD_EYE, '#1d2838', x + shake, y - 12 * sc.zoom, 6 * sc.zoom);
      } else sprite(ctx, ZZZ, f.color, x + (10 + t * 14) * sc.zoom, y - lift, 4 * sc.zoom);
      ctx.globalAlpha = 1;
    }
    for (const p of sc.particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
  }

  /**
   * Wetter über der Welt: Wolken dämpfen das Licht grau, Regen fällt in feinen, schrägen Strichen (bei reduzierter
   * Bewegung bleibt nur das graue Licht), nach dem Regen ein Regenbogen am Himmel.
   */
  private weather(sc: Scene) {
    const { ctx } = this;
    const { cloud, rainbow } = sc.weather;
    // Licht der Richtung, nur in der 2D-Ansicht (in 3D färbt die Sonne selbst; auf der durchsichtigen Ebene darüber
    // würde Multiplizieren zu einem flächigen Schleier): ganz leicht, je näher am Tor, desto mehr
    const light = MOOD_LIGHT[sc.mood.id];
    if (light && sc.mood.strength > 0 && !sc.lit3d) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.08 * sc.mood.strength;
      ctx.fillStyle = light.color;
      ctx.fillRect(0, 0, sc.width, sc.height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    if (cloud > 0) {
      ctx.fillStyle = `rgba(70,82,104,${(0.2 * cloud).toFixed(3)})`;
      ctx.fillRect(0, 0, sc.width, sc.height);
    }
    // Richtung Eistor fällt Schnee statt Regen
    const snowy = sc.mood.id === 'eis' ? Math.max(0, sc.mood.strength - 0.6) * 2 : 0; // nur nah am Eistor
    const rain = sc.weather.rain * (1 - snowy),
      snow = sc.weather.rain * snowy;
    if (snow > 0 && !sc.reduced) {
      ctx.fillStyle = `rgba(255,255,255,${(0.85 * snow).toFixed(3)})`;
      const n = Math.round(110 * snow);
      const size = Math.max(2, Math.round(3 * sc.zoom));
      for (let i = 0; i < n; i++) {
        const speed = 0.05 + (hash(8, i) % 30) / 1000;
        const y = (((hash(9, i) % 1000) / 1000) * (sc.height + 40) + sc.now * speed) % (sc.height + 40);
        const x = ((hash(10, i) % 1000) / 1000) * sc.width + Math.sin(sc.now / 900 + i) * 14 * sc.zoom;
        ctx.fillRect(Math.round(x), Math.round(y - 20), size, size);
      }
    }
    if (rain > 0 && !sc.reduced) {
      ctx.fillStyle = `rgba(214,230,255,${(0.6 * rain).toFixed(3)})`;
      const n = Math.round(140 * rain);
      const len = 14 * sc.zoom,
        w = Math.max(1.5, 1.6 * sc.zoom);
      for (let i = 0; i < n; i++) {
        const speed = 0.7 + (hash(5, i) % 40) / 100;
        const y = ((hash(6, i) % 1000) / 1000) * (sc.height + 60) + sc.now * speed;
        const yy = (y % (sc.height + 60)) - 30;
        const x = ((hash(7, i) % 1000) / 1000) * (sc.width + 80) - yy * 0.2;
        for (let k = 0; k < len; k += w) ctx.fillRect(Math.round(x + k * 0.2), Math.round(yy + k), w, w);
      }
    }
    if (rainbow > 0) {
      // Regenbogen aus Pixelbögen oben rechts, halb durchsichtig
      const bands = ['#e8504a', '#f39a3d', '#f2d14b', '#6dbd47', '#5aa6e8', '#8a6bd6'];
      const cx = sc.width * 0.8,
        cy = sc.height * 0.38,
        r0 = Math.min(sc.width, sc.height) * 0.3;
      const step = 6 * sc.zoom;
      ctx.globalAlpha = 0.36 * rainbow;
      bands.forEach((c, i) => {
        ctx.fillStyle = c;
        const r = r0 - i * step;
        for (let a = Math.PI; a <= Math.PI * 2; a += 0.012) {
          const px = Math.round((cx + Math.cos(a) * r) / step) * step,
            py = Math.round((cy + Math.sin(a) * r) / step) * step;
          ctx.fillRect(px, py, step, step);
        }
      });
      ctx.globalAlpha = 1;
    }
  }

  /** Goldener Abend: warmes Licht von oben, unten schwächer; Zeichen und Leiste liegen darüber und bleiben hell */
  private eveningGlow(sc: Scene) {
    const { ctx } = this;
    const [r, g, b] = GAME_COLORS.evening;
    const glow = ctx.createLinearGradient(0, 0, 0, sc.height);
    glow.addColorStop(0, `rgba(${r},${g},${b},${(0.46 * sc.evening).toFixed(3)})`);
    glow.addColorStop(1, `rgba(${r},${g},${b},${(0.2 * sc.evening).toFixed(3)})`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, sc.width, sc.height);
  }

  private nightSky(sc: Scene) {
    const { ctx } = this;
    ctx.globalAlpha = sc.night;
    ctx.fillStyle = GAME_COLORS.night;
    ctx.fillRect(0, 0, sc.width, sc.height);
    ctx.fillStyle = GAME_COLORS.star;
    for (let i = 0; i < 46; i++) {
      const x = ((i * 7919) % 1000) / 1000,
        y = ((i * 104729) % 1000) / 1000;
      const twinkle = sc.reduced ? 1 : 0.5 + 0.5 * Math.sin(sc.now / 600 + i);
      const s = (i % 3 === 0 ? 4 : 2) * sc.zoom;
      ctx.globalAlpha = sc.night * (0.4 + 0.6 * twinkle);
      ctx.fillRect(Math.round(x * sc.width), Math.round(y * sc.height * 0.7), s, s);
    }
    // Mondsichel aus zwei Rechtecken
    ctx.globalAlpha = sc.night;
    ctx.fillStyle = GAME_COLORS.star;
    const mx = sc.width * 0.82,
      my = sc.height * 0.16,
      r = 22 * sc.zoom;
    ctx.fillRect(mx - r, my - r, 0.8 * r, 2 * r);
    ctx.fillRect(mx - 0.2 * r, my + 0.4 * r, 1.2 * r, 0.6 * r);
    ctx.globalAlpha = 1;
  }
}
