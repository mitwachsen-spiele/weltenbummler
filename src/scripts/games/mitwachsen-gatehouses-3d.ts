// Die großen Tore der 3D-Ansicht: je Tor ein Torhaus samt Türflügeln, Torplatte und bewegten Teilen (mitwachsen-3d.ts
// stellt die Gruppe in die Szene). Ein Torhaus wird nur neu gebaut, wenn sich bei ihm etwas ändert: die Öffnung, ob der
// Pinguin dorthin führt, das Leuchten im Ritual. Steht die Figur in der Bucht eines Tors, das die Kamera nicht von vorn
// sieht, liegen zwei Fassungen zur Front daneben bereit, im Leerlauf gebaut, und es wird nur umgeschaltet. Gehört zur
// 3D-Ansicht und wird nur mit ihr nachgeladen (Three.js).
// Spezifikation: docs/specs/mitwachsen.md („Was angezeigt wird“: Große Tore, Torplatte: Drehung)

import { Group, Mesh, type BufferGeometry } from 'three';
import type { GateId } from '../../data/games/mitwachsen';
import type { HaloAt } from '../../lib/games/front';
import { partHalos, parts, type GateLook, type Parts } from './mitwachsen-gate-kit';
import { placeHalos } from './mitwachsen-fine-bodies-3d';
import { MovingGates } from './mitwachsen-gate-motion-3d';
import { TURN_STEPS, gate, moves, openStep, plate } from './mitwachsen-gates-3d';
import { ritualGlow } from './mitwachsen-guest-look';
import { GUIDE_GATE, guideGate } from './mitwachsen-guide';
import type { Plates3D } from './mitwachsen-plate-3d';
import type { State } from './mitwachsen-state';
import type { GatePlace, World } from './mitwachsen-world';

/** Was die Torhäuser je Bild aus der Szene brauchen (wie `Scene` in mitwachsen-render.ts) */
type Frame = Parameters<MovingGates['sync']>[0] & { gates: ReadonlyMap<string, number> };
/** Was sie von der Drehung zur Torfront wissen (`PlateTurn`): Bucht, Winkel, mehr als halb gedreht, Anteil am Zielwinkel */
type Turn = { front: GateId | null; far: boolean; amount: number; view: { yaw: number } } | null;
/**
 * Fassung eines Torhauses: 0 für die Kamera im Süden; zur Front gebaut (alle Flächen, `all`) 1 mit Schild wie im Süden
 * (sieht genauso aus, solange nichts gedreht ist) und als letzte mit dem Schild zur Front (`cam` [0, 1]), sobald die
 * Kamera mehr als halb gedreht ist. Der Körper bleibt in allen gleich (`home`): Beim Betreten der Bucht und beim Drehen
 * ändert sich nur das Schild. Ein Zugang, der sich mitdreht (`TURN_STEPS`, die Wolke), hat dazwischen eine Fassung je
 * Stufe: Fassung 1 + n ist n Stufen weit gedreht
 */
type Mode = number;
/** Stufen eines Zugangs zwischen Fassung 1 und der Fassung zur Front */
const stepsOf = (id: GateId) => TURN_STEPS[id] ?? 1;
type House = { key: string; group: Group; beats?: Group; halos: (HaloAt & { id: string })[] };

/**
 * Fassung zur Front für den Stand der Drehung (1 … `steps` + 1). Ohne Stufen (`steps` 1) wechselt das Schild bei halber
 * Drehung; mit Stufen gilt die nächste Stufe zum Anteil am Zielwinkel (das Pendeln am Ziel, ±4°, bleibt unter einer
 * halben Stufe, Zielwinkel in Ost, West und Süd mindestens 65°, Test)
 */
export function frontMode(steps: number, turn: Pick<NonNullable<Turn>, 'far' | 'amount'> | null): Mode {
  if (steps === 1) return turn?.far ? 2 : 1;
  return 1 + Math.round(Math.min(1, Math.max(0, turn?.amount ?? 0)) * steps);
}

/** Später, wenn der Browser Luft hat (Safari kennt `requestIdleCallback` nicht: dann gleich nach diesem Bild) */
const idle = (f: () => void) =>
  'requestIdleCallback' in window ? requestIdleCallback(f, { timeout: 300 }) : setTimeout(f);

export class GateHouses {
  readonly group = new Group();
  /** bewegte Teile der Zugänge (fließende Wand, wiegende Ranken), je Takt gebaut; wackelnde Flügel bei „noch nicht“ */
  readonly moving = new MovingGates();
  private houses = new Map<string, House>(); // je Tor und Fassung (`eis0`), mit dem Schlüssel, wie es gebaut ist
  private gen = 0; // zählt `reset`: Was davor im Leerlauf vorgemerkt wurde, gilt nicht mehr
  private bay: GateId | null = null; // Tor, in dessen Bucht die Figur steht (Fassungen zur Front)

  /**
   * `meshes` macht aus Teilen Meshes mit den Materialien der Torhäuser, `plates` baut die Torplatten,
   * `look` liefert, was das Welt-Paket hinter einem Tor beiträgt (Eis-Welt: Tür, Eiszapfen, Schmuck der Platte)
   */
  constructor(
    private meshes: (p: Parts) => Mesh[],
    private plates: Pick<Plates3D, 'of'>,
    private look: (id: GateId) => GateLook | undefined,
  ) {}

  /** Weiches Leuchten der gezeigten Torhäuser in der Welt (Glutkrone und Funken am Lavator), für den HaloPass */
  halos(): (HaloAt & { id: string })[] {
    return [...this.houses.values()].filter((h) => h.group.visible).flatMap((h) => h.halos);
  }

  /** Alle Torhäuser im nächsten Bild neu (neue Welt, ein Welt-Paket oder sein 3D-Teil kam an) */
  reset() {
    for (const h of this.houses.values()) h.key = '';
    this.gen++;
  }

  /**
   * Je Bild: Torhäuser neu bauen, wo sich etwas ändert, und die bewegten Teile im Takt zeigen. `turn.front`: Die Figur
   * steht in der Bucht dieses Tors; seine Fassungen zur Front (Takte der bewegten Teile samt) entstehen im Leerlauf,
   * zurück zur Fassung für den Süden geht es, wenn die Kamera zurück ist und die Figur die Bucht verlassen hat
   */
  sync(world: World, state: State, sc: Frame, turn: Turn) {
    const guest = guideGate(state);
    const lit = ritualGlow(state); // das Eistor geht auf: Eiszapfen und Umriss leuchten
    const shut = !!guest && !state.openGates.includes(guest); // Goldrand der Platte, bis das Tor aufgeht (wie in 2D)
    this.bay = turn?.front ?? null;
    for (const g of world.gates.values()) {
      // Öffnung in Schritten (Zehntel, Höhlentor feiner): Beim Aufgehen wird ein Torhaus nur so oft neu gebaut, nicht in
      // jedem Bild
      const open = openStep(g.id, sc.gates.get(g.id) ?? 0);
      const glow = g.id === GUIDE_GATE ? lit : 0;
      const key = `${open}|${g.id === guest}|${shut}|${glow}`;
      this.place(g, key, (m) => this.build(world, g, m, key, open, g.id === guest, glow, shut), turn);
    }
    this.moving.sync(sc, this.meshes);
  }

  /** Welche Fassung eines Tors gezeigt wird, was fehlt, gleich oder im Leerlauf bauen, und was weg kann */
  private place(g: GatePlace, key: string, make: (m: Mode) => House, turn: Turn) {
    const fresh = (m: Mode) => {
      const h = this.houses.get(g.id + m);
      return h?.key === key ? h : undefined;
    };
    // zur Front nur Tore, die die Kamera im Süden nicht von vorn sieht (im Norden, `out` nach −y wie `lageOf` in
    // mitwachsen-turn-pace.ts, reichen die Flächen wie immer)
    const bay = this.bay === g.id && g.out[1] >= 0;
    const steps = stepsOf(g.id);
    const mode: Mode = bay ? frontMode(steps, turn) : 0;
    const front = Array.from({ length: steps + 1 }, (_, n) => n + 1); // alle Fassungen zur Front
    // was fehlt, gleich bauen; außer 0 und 1, die gleich aussehen (1 hat nur mehr Flächen, die man ungedreht nicht
    // sieht): dann die andere zeigen und die fehlende im Leerlauf bauen
    const stand = mode === 0 ? fresh(1) : mode === 1 && !turn?.view.yaw ? fresh(0) : undefined;
    let shown = fresh(mode);
    if (!shown && stand) {
      shown = stand;
      this.later(g.id, mode, key, make);
    }
    shown ??= make(mode);
    if (bay) for (const m of front) if (!fresh(m)) this.later(g.id, m, key, make);
    for (const m of [0, ...front]) {
      const h = this.houses.get(g.id + m);
      if (!h || h === shown) continue;
      h.group.visible = false;
      if (!bay && m) this.drop(g.id + m); // die Figur ist weg: Fassungen zur Front weg
    }
    shown.group.visible = true;
  }

  /**
   * Fassung `m` im Leerlauf bauen, samt allen Takten der bewegten Teile. Wird in jedem Bild vorgemerkt, bis sie da ist;
   * gebaut wird nur einmal (die übrigen Rückrufe finden sie fertig), nicht nach `reset` und zur Front nur, solange die
   * Figur in der Bucht ist
   */
  private later(id: GateId, m: Mode, key: string, make: (m: Mode) => House) {
    const gen = this.gen;
    idle(() => {
      if (this.houses.get(id + m)?.key === key || gen !== this.gen || (m && this.bay !== id)) return;
      const h = make(m);
      h.group.visible = false;
      if (h.beats) this.moving.fill(h.beats, this.meshes);
    });
  }

  /** Torhaus einer Fassung wegräumen */
  private drop(slot: string) {
    const old = this.houses.get(slot);
    if (!old) return;
    old.group.traverse((o) => {
      if (o instanceof Mesh) (o.geometry as BufferGeometry).dispose();
    });
    this.moving.drop(old.group);
    this.group.remove(old.group);
    this.houses.delete(slot);
  }

  /**
   * Ein großes Tor: mächtiges Torhaus im Felsring, je Welt geschmückt, zur Lichtung schauend. `open` sagt, wie weit die
   * Tür offen ist (die Flügel stehen an ihrer Angel und sind gedreht); führt der verlaufene Pinguin dorthin (`guest`),
   * steht sein Umriss auf der Tür, und der Rand der Torplatte davor pulsiert golden, solange es zu ist (`shut`). Geht
   * das Eistor mit ihm auf, leuchten bis `lit` seine Eiszapfen, und der Umriss füllt sich mit den Farben des Pinguins.
   * Fassung `mode` (`Mode`): Schild und Seiten für die Kamera im Süden oder zur Front, alle Flächen oder nicht
   */
  private build(
    world: World,
    g: GatePlace,
    mode: Mode,
    key: string,
    open: number,
    guest: boolean,
    lit: number,
    shut: boolean,
  ): House {
    this.drop(g.id + mode);
    const p = parts();
    const [[mx, my], [fx, fy]] = [g.mid, [-g.out[0], -g.out[1]]];
    const look = this.look(g.id); // aus dem Welt-Paket hinter dem Tor
    // Richtung zur Kamera in Ruhe in Torhaus-Koordinaten (im Süden): Sie legt den Körper fest. Das Schild richtet sich
    // nach `cam`: wie im Süden, mehr als halb gedreht zur Front
    const home = [-fx || 0, fy || 0] as const;
    const turned = mode > 0 ? (mode - 1) / stepsOf(g.id) : 0;
    const cam = turned > 0.5 ? ([0, 1] as const) : home;
    const all = mode > 0; // zur Front: alle Flächen
    const wings = gate(p, g.id, open, guest, lit, cam, look, all, home, turned);
    const house = new Group(); // an der Mitte des Tors, sein +z schaut zur Lichtung
    house.position.set(mx + 0.5, world.cell(mx, my).h, my + 0.5);
    house.rotation.y = Math.atan2(fx, fy);
    house.add(...this.meshes(p), this.plates.of(g.id, look?.plate ?? plate(g.id), guest && shut)); // Torhaus und Torplatte davor
    const beats = moves(g.id) ? this.moving.add(g.id, [mx + 0.5, my + 0.5], open, cam, all, home) : undefined;
    if (beats) house.add(beats);
    for (const w of wings) {
      const wing = new Group();
      wing.position.set(w.hinge[0], 0, w.hinge[1]);
      wing.rotation.y = w.angle;
      wing.add(...this.meshes(w.parts));
      this.moving.wing(g.id, wing, w); // wackelt, wenn sein Tor „noch nicht“ zeigt
      house.add(wing);
    }
    const at = { x: mx + 0.5, y: my + 0.5, z: world.cell(mx, my).h };
    const halos = placeHalos(partHalos(p), at, house.rotation.y, 1, `gate:${g.id}`); // Fassungen gleich: gleiche Kennung
    const h = { key, group: house, beats, halos };
    this.houses.set(g.id + mode, h);
    this.group.add(house);
    return h;
  }
}
