// 3D-Ansicht von Mitwachsen mit Three.js (WebGL). Wird erst beim Spielstart per import() nachgeladen; die Startseite
// lädt sie nie (geprüft vom Bundle-Gate). Liest nur Welt, Zustand und die gleitenden Positionen der Wesen – Regeln
// und Speichern bleiben unverändert. Kann der Browser kein WebGL, bleibt die 2D-Ansicht (mitwachsen-render.ts).
//
// Koordinaten: Welt-x → x, Welt-y (nach vorn/unten) → z, Höhe → y. Ein Feld ist eine Einheit.
// Die Kamera schaut schräg von oben (55°, `TILT_DEG` in mitwachsen-camera.ts) aus Süden auf die Figur; ↑ läuft also vom Betrachter weg. Bleibt die Figur
// auf einer Torplatte stehen, dreht sie weich zur Front des Tors und die Sonne mit (mitwachsen-turn-3d.ts); die Pfeile
// bleiben dabei, wie sie sind (weltbezogen).
// Die Welt wird in Stücken zu einem Mesh gebaut: Boden, Zierde und Wasser, alles mit einer Textur-Kachel.
// Was nur eine Welt hinter einem Tor zeigt (Eis-Welt: Iglu, Fischkisten, Kessel, Tür und Eiszapfen des Eistors), baut
// der 3D-Teil ihres Welt-Pakets (`View3D`, mitwachsen-view-3d.ts), nachgeladen, sobald das Paket an der Welt hängt
// (`use`); bis dahin steht dort Schlichtes. Three.js liegt im Build in einer eigenen Datei, die beide teilen.

import {
  BufferGeometry,
  DataTexture,
  LinearFilter,
  MeshBasicMaterial,
  RedFormat,
  UnsignedByteType,
  Vector2,
  Color,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Scene as ThreeScene,
  Vector3,
  Vector4,
  WebGLRenderer,
} from 'three';
import { CHUNK, chunkOf, fromKey, withNeighbours } from '../../lib/games/chunks';
import type { Dir, HaloAt, Part, Projection } from '../../lib/games/front';
import {
  GAME_COLORS,
  GATES,
  MOOD_LIGHT,
  REGIONS,
  SPECIES,
  THEME_COLORS,
  figureParts,
  BOOK_PARTS,
  SLEEPY_EYES,
  type GateId,
  type Look,
} from '../../data/games/mitwachsen';
import { carried, carryKey } from './mitwachsen-carry';
import { Geo, atlas, snapToShadowTexel, type Tile, type V3 } from './mitwachsen-geo';
import { grown } from './mitwachsen-growth';
import { isRing } from './mitwachsen-rim';
import { RIM_COLORS, rimBlossoms } from './mitwachsen-rim-look';
import type { Parts } from './mitwachsen-gatehouse';
import { GateHouses } from './mitwachsen-gatehouses-3d';
import { Platforms3D } from './mitwachsen-platform-3d';
import { frontShot } from './mitwachsen-card-3d';
import { fogMask, fogSeen } from './mitwachsen-fog-3d';
import { riseOf, type HaloView } from './mitwachsen-halo';
import { StoneNotes } from './mitwachsen-story-3d';
import { stoneBoxes } from './mitwachsen-stone-look';
import type { LoadedPack } from './mitwachsen-packs';
import type { Scene } from './mitwachsen-render';
import { footOf, SHEER } from './mitwachsen-ride-view';
import type { State } from './mitwachsen-state';
import type { Cell, World } from './mitwachsen-world';
import { homeAt, openRoof } from './mitwachsen-home';
import { turnHead } from './mitwachsen-air';
import { drawDeco, type DecoAt } from './mitwachsen-view';
import { Views3D, type Air } from './mitwachsen-view-3d';
import { DUSK_SKY, nightMix, sunLevel, type Rgb } from './mitwachsen-dusk';
import { tufts } from './mitwachsen-trees-3d';
import { decoBoxes } from './mitwachsen-deco-look';
import { SIGN_TOP, WOOD_BED, bedBoxes, signBoxes, sleeperBoxes } from './mitwachsen-yard-look';
import { stoneOf } from './mitwachsen-waystone';
import { waystoneBoxes } from './mitwachsen-waystone-look';
import type { PlateTurn } from './mitwachsen-turn-3d';
import { CAM_REST, camPose, type CamView } from './mitwachsen-camera';
import { hangAt } from './mitwachsen-roost';
import { workOf } from './mitwachsen-herald';
import { composeShader, skinTexture, type Compose } from './mitwachsen-fine-3d';
import { Contacts, placeHalos, type Contact } from './mitwachsen-fine-bodies-3d';
import {
  chunkHalos,
  fineBox,
  fineBoxes,
  fineSinks,
  groundCorners,
  groundHeight,
  heightGrid,
  sinkOf,
  type FineSinks,
} from './mitwachsen-fine-chunk-3d';

const SUN_OFFSET = new Vector3(-9, 22, 7); // Sonne von links oben vorn, vom Ziel aus (dreht mit der Kamera)
const UP = new Vector3(0, 1, 0);
const NEAR_GATE = 14; // so nah (Felder, waagrecht und senkrecht) an einem Tor lädt die Drehung zur Torfront nach
const SHADOW_TEXEL = 36 / 2048; // Schattenkamera ±18 Felder auf 2048 Pixeln
const RADIUS = 2; // Stücke um die Figur, die als Mesh vorliegen (5 × 5 = 80 × 80 Felder)
const BUILD_PER_FRAME = 2; // neue Stücke je Bild, damit nichts ruckelt
const FOG_N = 128; // Nebel-Maske: 128 × 128 Felder um die Figur (8 × 8 Stücke)

type Model = { geo: BufferGeometry; halos: readonly HaloAt[] };
/**
 * Modell aus Teilen (wie in der 2D-Ansicht), mit Blick nach Osten (+x): vorn → x, rechts → z, oben → y; jedes Teil fein
 * (Verlauf, Kante, Muster), gezeigt in Größe `scale`
 */
function modelGeometry(parts: readonly Part[], scale = 1): Model {
  const g = new Geo();
  for (const [f, r, z, fl, rw, h, color, top, , fine] of parts)
    g.box(f, z, r, fl, h, rw, color, top ?? null, 'fur', undefined, fine ?? {}, scale);
  return { geo: g.build(), halos: g.halos };
}
const YAW: Record<Dir, number> = { e: 0, s: -Math.PI / 2, w: Math.PI, n: Math.PI / 2 };

// ---------- Die 3D-Welt ----------

/** Kacheln der Böden: Oberseite, oberste Seitenkachel, Seiten darunter */
const GROUND_TILES: Record<Exclude<Cell['ground'], 'water' | 'lava' | 'sky'>, [Tile, Tile, Tile]> = {
  grass: ['grassTop', 'grassSide', 'dirt'],
  stone: ['stone', 'stone', 'stone'],
  sand: ['sand', 'sand', 'sand'],
  path: ['path', 'dirt', 'dirt'],
  snow: ['snowTop', 'snowSide', 'dirt'],
  ice: ['ice', 'ice', 'ice'],
  basalt: ['basalt', 'basalt', 'basalt'],
  cave: ['cave', 'cave', 'cave'],
  cloud: ['cloud', 'cloud', 'cloud'],
  moss: ['mossTop', 'mossSide', 'dirt'],
  grotto: ['stone', 'stone', 'stone'], // Kristallgrotte: färbt der 3D-Teil ihres Pakets
};
/** Kacheln der Hecke am Rand der Lichtung (`Cell.rim`) */
const HEDGE_TILES: [Tile, Tile, Tile] = ['leaves', 'leaves', 'leaves'];
/** Rahmen des Betts: aus Holz (Seite, oben, Kachel); in einer Welt hinter einem Tor sagt es ihr Paket */
const SKY = new Color('#9fd6f0');
const NIGHT_SKY = new Color('#141a3a');
const CLOUD_SKY = new Color('#a9b4bf'); // Himmel bei Wolken und Regen
const DUSK = new Color(DUSK_SKY); // Himmel der Lichtung in der Dämmerung (Tageslicht 0,4): so dunkel höchstens die Grotte
const HEMI_SKY = '#cfe9ff'; // Himmelslicht von oben

type Chunk = { meshes: Mesh[]; halos: (HaloAt & { id: string })[] };
export class World3D {
  private renderer: WebGLRenderer;
  private scene = new ThreeScene();
  private camera = new PerspectiveCamera(34, 1, 0.5, 140);
  private sun = new DirectionalLight('#fff0d4', 2.4);
  private hemi = new HemisphereLight(HEMI_SKY, '#5e7f3c', 1.35);
  private solid: MeshLambertMaterial;
  private foliage: MeshLambertMaterial;
  // Farbe je Feld (Grotte: türkis, `View3D.water`), sonst blau
  private water = new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.8 });
  private explored: (x: number, y: number) => boolean = () => true;
  // Nebel: weiche Maske der erkundeten Felder um die Figur; ein Zusatz im Shader mischt die Welt dort in die
  // Himmelsfarbe. Keine Blöcke: Die Welt verschwindet einfach im Dunst.
  private fogData = new Uint8Array(FOG_N * FOG_N);
  private fogTex = new DataTexture(this.fogData, FOG_N, FOG_N, RedFormat, UnsignedByteType);
  private fogUniforms = {
    mwFogMap: { value: this.fogTex },
    mwFogOrigin: { value: new Vector2(0, 0) },
    mwFogSize: { value: FOG_N },
    mwFogTint: { value: SKY.clone() },
    // Durchblick: Was zwischen Kamera und Figur steht, wird dort halb durchsichtig
    mwEye: { value: new Vector3() },
    mwTarget: { value: new Vector3() },
    // Unterstand am Zuhause: Mitte (x, z), Radius, wie weit offen (`openRoof`); Dach darüber wird zum Gitter
    mwRoof: { value: new Vector4() },
    // Wind: Grasbüschel wiegen sich
    mwTime: { value: 0 },
    mwWind: { value: 0 },
  };
  private fogDirty = true;
  private fogKey = '';
  private fogAt: readonly [number, number] = [0, 0]; // Ursprung der Nebel-Maske (Feld des Texels 0)
  private cam: CamView = CAM_REST; // Blick der Kamera in diesem Bild (dreht auf einer Torplatte)
  private entity = new MeshLambertMaterial({ vertexColors: true }); // Wesen: fein (Muster, Verlauf, Kante)
  private skins = skinTexture(); // Muster der feinen Dinge (mitwachsen-fine-3d.ts)
  private fineSolid!: MeshLambertMaterial; // feine Dinge der Stücke (Deko, Bäume, Gleis, Dinge der Pakete)
  private fineCanopy!: MeshLambertMaterial; // ihr Laub: vor der Figur durchsichtig
  private contacts = new Contacts(); // weicher Fleck unter den Körpern
  private bodyHalos: (HaloAt & { id: string })[] = []; // Leuchten an Modellen (Laterne in der Hand) in diesem Bild
  private heights: ((x: number, y: number) => number | null) | null = null; // Höhen des Stücks im Bau (Boden-Schatten)
  private sheer = new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: SHEER, depthWrite: false }); // Dachplatte über der Figur (`RideBody.sheer`)
  private dark = new MeshLambertMaterial({ color: GAME_COLORS.silhouette }); // verlorene Tiere auf den Tafeln
  private lava!: MeshLambertMaterial; // leuchtet auch nachts
  private canopy!: MeshLambertMaterial;
  private gateSolid!: MeshLambertMaterial; // Mauerwerk der Torhäuser und Portale: vor der Figur durchsichtig
  private bright!: MeshBasicMaterial; // leuchtet aus sich selbst: Kristalle, Zeichen, Wasserfälle
  private glow!: MeshBasicMaterial; // leuchtet, so hell das Welt-Paket sagt: Eiskristalle beim Polarlicht (`View3D.glow`)
  private platforms!: Platforms3D; // Portal-Plattformen
  private chunks = new Map<string, Chunk>();
  /**
   * Messung (nur gezählt, ändert nichts; scripts/measure-ride.ts liest sie): Bilder, Zeit je Bild in `render` (ohne
   * GPU), davon Bauen der Stücke, gebaute Stücke, Bilder mit Loch (ein Stück um das Ziel fehlt noch)
   */
  readonly stats = { frames: 0, ms: 0, maxMs: 0, built: 0, buildMs: 0, maxBuildMs: 0, holes: 0 };
  private stale = new Set<string>(); // Stücke, die neu gebaut werden müssen; bis dahin bleibt das alte stehen
  private stamp = ''; // was am Zustand der Pakete ihre Stücke ändert (`Views3D.stamp`): ändert es sich, alles neu
  private at: DecoAt = { now: 0, reduced: true, picked: {}, packs: {} }; // für drawDeco: leere Büsche, Schneemänner
  private day = 0; // Tag der Welt: bestimmt, was nachgewachsen ist
  private air: Air | undefined; // Luft der Welt, in der die Figur zuletzt war (Grotte), solange sie ausblendet
  private airMix = 0; // wie weit sie zu sehen ist (0 … 1)
  private opened: readonly GateId[] = []; // offene Tore: danach glänzt z. B. die Rutschspur zum Schneebett
  private views = new Views3D(); // 3D-Teile der Welt-Pakete, sobald geladen
  private houses!: GateHouses; // Torhäuser samt bewegten Teilen, je Tor neu gebaut, wenn sich dort etwas ändert
  private models = new Map<string, Model>();
  private bodies = new Map<string, Mesh>();
  private signs = new Group();
  private signKey = '';
  private sleeper = new Group();
  private sleeperAt = ''; // Bett, in dem der Schläfer gebaut ist
  private notes = new StoneNotes(); // Noten über den Klangsteinen
  private size = { w: 1, h: 1 };
  private world: World | null = null;
  private turn: PlateTurn | null = null; // Drehung zur Torfront (nachgeladen, sobald die Figur einem Tor nah ist)
  private turnAsked = false;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly look: Look,
  ) {
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    const tex = atlas();
    this.solid = new MeshLambertMaterial({ map: tex, vertexColors: true });
    this.canopy = new MeshLambertMaterial({ map: tex, vertexColors: true }); // Laub: wird vor der Figur durchsichtig
    this.lava = new MeshLambertMaterial({
      map: tex,
      vertexColors: true,
      emissive: THEME_COLORS.lava.glow,
      emissiveMap: tex,
      emissiveIntensity: 0.7,
    });
    this.foliage = new MeshLambertMaterial({ vertexColors: true, side: DoubleSide });
    this.gateSolid = new MeshLambertMaterial({ map: tex, vertexColors: true });
    this.bright = new MeshBasicMaterial({ map: tex, vertexColors: true });
    this.glow = new MeshBasicMaterial({ map: tex, vertexColors: true });
    this.fineSolid = new MeshLambertMaterial({ map: tex, vertexColors: true });
    this.fineCanopy = new MeshLambertMaterial({ map: tex, vertexColors: true });
    this.fogTex.magFilter = LinearFilter;
    this.fogTex.minFilter = LinearFilter;
    for (const m of [this.solid, this.water, this.lava, this.glow]) this.withFog(m, {});
    this.withFog(this.foliage, { sway: true });
    this.withFog(this.canopy, { see: true });
    this.withFog(this.gateSolid, { see: true });
    this.withFog(this.bright, { fine: true }); // Kristalle sind fein, Zeichen und Wasserfälle der Tore nicht
    this.withFog(this.fineSolid, { fine: true });
    this.withFog(this.fineCanopy, { see: true, fine: true });
    for (const m of [this.entity, this.sheer, this.notes.material])
      composeShader(m, this.fogUniforms, this.skins, { fine: true });
    this.platforms = new Platforms3D(this.gateSolid, this.bright, () => {
      const m = new MeshBasicMaterial({ map: tex, vertexColors: true });
      this.withFog(m, {});
      return m;
    });
    this.scene.add(this.platforms.group, this.contacts.mesh);
    this.houses = new GateHouses(
      (p) => this.meshes(p),
      this.platforms.plates,
      (id) => this.views.look(id),
    );
    this.scene.background = SKY.clone();
    this.scene.fog = new Fog(SKY.clone(), 26, 58);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    Object.assign(sc, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 60 });
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.03; // gegen Streifen auf Wänden, die die Sonne schräg trifft (Shadow Acne)
    this.scene.add(this.sun, this.sun.target, this.hemi, this.signs, this.sleeper, this.houses.group, this.notes.group);
  }

  /**
   * Shader-Zusatz für die Welt (mitwachsen-fine-3d.ts): Nebel-Maske immer; Durchblick (`see`: Laub, Mauerwerk der Tore)
   * vor der Figur und unter dem offenen Dach; Wind (`sway`: Grasbüschel); Muster und Kante feiner Dinge (`fine`)
   */
  private withFog(material: MeshLambertMaterial | MeshBasicMaterial, c: Compose) {
    composeShader(material, this.fogUniforms, this.skins, { fog: true, ...c });
  }

  /** Nebel-Maske neu berechnen: erkundet = 1, dann zweimal weich verwischt (sanfter Übergang über 2–3 Felder) */
  private updateFog(cx: number, cy: number) {
    const [pcx, pcy] = chunkOf(Math.round(cx), Math.round(cy));
    const ox = (pcx - FOG_N / CHUNK / 2) * CHUNK,
      oy = (pcy - FOG_N / CHUNK / 2) * CHUNK;
    const key = `${ox},${oy}`;
    if (!this.fogDirty && key === this.fogKey) return;
    this.fogDirty = false;
    this.fogKey = key;
    this.fogData.set(fogMask(this.explored, ox, oy, FOG_N));
    this.fogAt = [ox, oy];
    this.fogTex.needsUpdate = true;
    // Texel i liegt mittig auf Feld ox + i: Ursprung so, dass (x + 0,5 − ox) / N die Texelmitte trifft
    this.fogUniforms.mwFogOrigin.value.set(ox, oy);
  }

  resize(w: number, h: number, dpr: number) {
    this.size = { w, h };
    this.renderer.setPixelRatio(Math.min(dpr, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Alles freigeben, auch den WebGL-Kontext sofort (ältere iPads erlauben nur wenige gleichzeitig) */
  dispose() {
    this.views.stop(); // kein Nachladen eines gescheiterten 3D-Teils mehr
    this.scene.traverse((o) => {
      if (o instanceof Mesh) (o.geometry as BufferGeometry).dispose(); // Stücke, Tore, Schläfer, Tafeln, Wesen; doppeltes dispose schadet nicht
    });
    for (const m of this.models.values()) m.geo.dispose();
    this.models.clear();
    this.solid.map?.dispose();
    this.skins.dispose();
    this.contacts.dispose();
    for (const m of [this.solid, this.foliage, this.water, this.lava, this.canopy, this.entity, this.sheer, this.dark])
      m.dispose();
    this.fineSolid.dispose();
    this.fineCanopy.dispose();
    this.fogTex.dispose();
    this.sun.shadow.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  /** Bildschirmpunkt eines Weltpunkts (x, y in Feldern, z = Höhe) – für die 2D-Ebene darüber */
  readonly project: Projection = (x, y, z) => {
    const v = new Vector3(x, z, y).applyMatrix4(this.camera.matrixWorldInverse);
    // Die Kamera schaut entlang −z: Punkte hinter ihr (Bett weit hinter der Figur) auf die Nahebene legen,
    // sonst kippt die Projektion und der Heimweg-Pfeil zeigt in die falsche Richtung
    if (v.z > -this.camera.near) v.z = -this.camera.near;
    v.applyMatrix4(this.camera.projectionMatrix);
    return [((v.x + 1) / 2) * this.size.w, ((1 - v.y) / 2) * this.size.h];
  };

  /** Leuchten kompakter Teile in diesem Bild (Stücke um die Figur, Modelle), für den Durchgang auf der Ebene darüber */
  halos(): (HaloAt & { id: string })[] {
    const chunks = [...this.chunks.values()].flatMap((c) => c.halos);
    return [...chunks, ...this.bodyHalos, ...this.notes.halos, ...this.houses.halos()]; // samt Glutkrone am Lavator
  }

  /** Blick der Kamera und Nebelrand für das Leuchten auf der Ebene darüber (mitwachsen-halo.ts) */
  haloView(): HaloView {
    const yaw = (this.cam.yaw * Math.PI) / 180; // Kamera in Richtung (sin ψ, cos ψ) vom Blickpunkt (camPose)
    const [ox, oy] = this.fogAt;
    const seen = (x: number, y: number) => fogSeen(this.fogData, ox, oy, FOG_N, x, y);
    return { rise: riseOf(this.cam.tilt), to: [Math.sin(yaw), Math.cos(yaw)], seen };
  }

  render(world: World, state: State, sc: Scene) {
    const t0 = performance.now();
    if (this.world !== world) this.reset(world);
    this.explored = sc.explored;
    const work = workOf(state); // ein Bote baut (Tok): Die Gleiswelle kommt in 3D in Stufen (`reduced`, in 3D zuckt nichts)
    this.at = { ...this.at, picked: state.picked, packs: state.packs, work };
    const stamp = this.views.stamp(state.packs, work); // Zustand der Pakete, der ihre Stücke ändert (Ausbau der Bahn)
    if (state.day !== this.day || state.openGates.join() !== this.opened.join() || stamp !== this.stamp) {
      this.stamp = stamp;
      // ein neuer Tag: Stücke neu bauen, denn es sind Blumen und Pilze nachgewachsen (oder ein Tor ging auf, dann
      // glänzt etwa die Rutschspur)
      this.day = state.day;
      this.opened = [...state.openGates];
      for (const k of this.chunks.keys()) this.stale.add(k);
    }
    const cam = sc.cam;
    const tx = cam.x + 0.5,
      tz = cam.y + 0.5;
    const ty = sc.bodies.get('player')?.z ?? 1;
    // Im Hochformat (Handy) weiter weg, damit links und rechts genug Welt zu sehen ist; der Nebel rückt mit. Auf einer
    // Torplatte dreht die Kamera zur Front, neigt sich, rückt heran und schaut etwas höher (bei p = 0 wie immer)
    const k = Math.min(1.8, Math.max(1, 0.95 / this.camera.aspect));
    this.wantTurn(world, cam, sc.reduced);
    const view = (this.cam = this.turn?.frame(world, state, sc) ?? CAM_REST);
    const { eye, look, dist } = camPose([tx, ty, tz], view, k, this.turn?.to ?? [0, 0]);
    const fog = this.scene.fog as Fog;
    fog.near = dist + 8;
    fog.far = dist + 40;
    this.camera.position.set(...eye);
    this.camera.lookAt(...look);
    this.fogUniforms.mwEye.value.copy(this.camera.position);
    this.fogUniforms.mwTarget.value.set(tx, ty + 0.9, tz);
    const roof = openRoof(this.world!, Math.round(tx - 0.5), Math.round(tz - 0.5));
    this.fogUniforms.mwRoof.value.set(roof.x, roof.y, roof.r, roof.open);
    this.fogUniforms.mwTime.value = sc.now / 1000;
    this.fogUniforms.mwWind.value = sc.wind;
    // Sonne von links oben vorn, dreht mit der Kamera (ohne Pendeln); Schatten folgen dem Blick, im Lichtraum auf
    // ganze Pixel der Schattenkarte gerastet
    const sunAt = SUN_OFFSET.clone().applyAxisAngle(UP, this.turn?.sun ?? 0);
    const target = snapToShadowTexel(new Vector3(...look), sunAt, SHADOW_TEXEL);
    this.sun.position.copy(target).add(sunAt);
    this.sun.target.position.copy(target);
    const cloud = sc.weather.cloud;
    // Licht der Richtung: Farbe und Helligkeit der Sonne, je näher am Tor, desto mehr
    const light = MOOD_LIGHT[sc.mood.id];
    const m = light ? sc.mood.strength : 0;
    this.sun.color.set('#ffffff').lerp(new Color(light?.color ?? '#ffffff'), m * 0.2);
    this.hemi.color.set(HEMI_SKY).lerp(new Color(light?.color ?? HEMI_SKY), m * 0.1);
    const bright = 1 + ((light?.bright ?? 1) - 1) * m * 0.4;
    // Wolken dämpfen die Sonne; in der Grotte nie dunkler als die Dämmerung der Lichtung (mitwachsen-dusk.ts)
    this.sun.intensity = 2.4 * sunLevel(sc.realm, sc.night, bright) * (1 - 0.5 * cloud);
    this.hemi.intensity = 1.35 * (1 - sc.night * 0.6) * (1 - 0.15 * cloud);
    // Luft einer Welt aus dem 3D-Teil ihres Pakets (Grotte: lila Höhlenhimmel, Nebel-Maske), weich ein- und ausgeblendet
    const air = this.views.air(sc.realm);
    if (air) this.air = air;
    this.airMix = sc.reduced ? +!!air : this.airMix + (+!!air - this.airMix) * 0.08;
    const sky = SKY.clone().lerp(CLOUD_SKY, cloud * 0.75);
    const mist = sky.clone();
    if (this.air && this.airMix > 0.001) {
      sky.lerp(new Color(this.air.sky), this.airMix);
      mist.lerp(new Color(this.air.mist), this.airMix);
    }
    // zur Nacht gemischt, in der Grotte nur bis zum Himmel der Lichtung in der Dämmerung
    const rgb = (c: Color): Rgb => [c.r, c.g, c.b];
    const [n, d] = [rgb(NIGHT_SKY), rgb(DUSK)];
    sky.lerp(NIGHT_SKY, nightMix(sc.realm, sc.night, rgb(sky), n, d));
    mist.lerp(NIGHT_SKY, nightMix(sc.realm, sc.night, rgb(mist), n, d));
    (this.scene.background as Color).copy(sky);
    this.fogUniforms.mwFogTint.value.copy(mist);
    fog.color.copy(sky);

    this.updateFog(cam.x, cam.y);
    this.houses.sync(world, state, sc, this.turn); // auch: Die Flügel eines Tors wackeln bei „noch nicht“
    this.syncChunks(world, cam.x, cam.y);
    const facing = YAW.s + (view.yaw * Math.PI) / 180; // zur Kamera, auch wenn sie dreht
    this.syncBodies(state, sc, facing);
    this.syncSigns(state, facing);
    this.syncSleeper(state);
    this.platforms.sync(state, sc);
    this.notes.update(state, sc.now, sc.reduced);
    this.glow.color.setRGB(...this.views.glow(sc.aurora, sc.reduced, sc.now));
    this.views.layers(this.scene, world, state, sc); // was die Welt-Pakete je Bild nachführen (Fuß- und Schneespur)
    this.renderer.render(this.scene, this.camera);
    const st = this.stats;
    const ms = performance.now() - t0;
    st.frames++;
    st.ms += ms;
    st.maxMs = Math.max(st.maxMs, ms);
  }

  /** Postkarte: die Front des Tors `id` als Standbild in `out` (mitwachsen-card-3d.ts); vor `render` rufen */
  postcard(world: World, id: GateId, out: HTMLCanvasElement) {
    frontShot(this.renderer, this.scene, this.fogUniforms, world, id, out, this.size);
  }

  /**
   * Ein Pfeil kommt (Kern, vor dem Schritt): Ist die Ansicht über 45° zur Torfront gedreht, blinzelt sie zurück und
   * liefert true; der Schritt `go` kommt dann nach 300 ms (`Blink` in mitwachsen-turn.ts). Die Pfeile bleiben weltbezogen
   */
  blink(go: () => void): boolean {
    return !!this.turn?.blink(go);
  }

  /** Dreht die Kamera auf der Torplatte (nicht bei reduzierter Bewegung, nicht mit „Kamera bewegen: aus“)? */
  turns(): boolean {
    return !!this.turn?.turns();
  }

  /** Ist die Kamera an der Torfront angekommen (oder dreht gar nicht)? Erst dann zeigt ein Tor „noch nicht“ */
  arrived(): boolean {
    return this.turn?.arrived() ?? true;
  }

  /**
   * Drehung zur Torfront nachladen, sobald die Figur einem Tor nah ist (nicht bei reduzierter Bewegung, dort dreht
   * nichts); einmal je Seite. Scheitert es (ohne Netz und nicht gespeichert), bleibt die Kamera im Süden, die Postkarte
   * kommt
   */
  private wantTurn(world: World, at: { x: number; y: number }, reduced: boolean) {
    if (this.turnAsked || reduced) return;
    const near = (g: { mid: readonly [number, number] }) =>
      Math.max(Math.abs(g.mid[0] - at.x), Math.abs(g.mid[1] - at.y)) <= NEAR_GATE;
    if (![...world.gates.values()].some(near)) return;
    this.turnAsked = true;
    const host = this.renderer.domElement.parentElement;
    void import('./mitwachsen-turn-3d').then(
      (m) => (this.turn = new m.PlateTurn(host)),
      () => undefined,
    );
  }

  /** Der Nebel hat sich gelichtet: Maske im nächsten Bild neu berechnen (die Stücke selbst bleiben) */
  invalidate(keys: readonly string[]) {
    if (keys.length) this.fogDirty = true;
  }

  /**
   * Stücke neu bauen (z. B. Beeren gepflückt oder nachgewachsen, ein neuer Tag). Das alte Stück bleibt sichtbar, bis
   * das neue fertig ist, so flackert nichts; gebaut wird im Takt von syncChunks.
   */
  rebuild(keys: readonly string[]) {
    for (const k of keys) if (this.chunks.has(k)) this.stale.add(k);
  }

  /**
   * Ein Welt-Paket kam im Spiel an (`World.attach`): dieselbe Welt mit seinen Feldern. Plattformen und Klangsteine neu,
   * nur die geänderten Stücke und ihre Nachbarn (deren Seitenflächen an der Grenze hängen an den geänderten Feldern)
   * werden ausgetauscht (das alte bleibt sichtbar, bis das neue fertig ist), nichts flackert
   */
  adopt(world: World, chunks: readonly string[]) {
    if (!this.world) return; // noch nichts gebaut: Das erste Bild baut alles mit der neuen Welt
    this.world = world;
    this.platforms.build(world);
    this.notes.build(world);
    this.houses.reset();
    this.fogDirty = true;
    this.rebuild(withNeighbours(chunks));
  }

  /**
   * Ein Welt-Paket hängt an der Welt: seinen 3D-Teil nachladen (einmal; scheitert es, nach `RETRY_3D_MS` wieder). Ist er
   * da, entstehen alle Stücke und Tore neu (das alte bleibt sichtbar, bis das neue fertig ist); bis dahin steht dort
   * Schlichtes, ohne Fehler.
   */
  use(pack: Pick<LoadedPack, 'id' | 'view3d'>) {
    void this.views.use(pack, () => {
      this.houses.reset();
      for (const k of this.chunks.keys()) this.stale.add(k);
    });
  }

  private reset(world: World) {
    this.world = world;
    this.fogDirty = true;
    this.houses.reset();
    this.platforms.build(world);
    this.notes.build(world);
    for (const c of this.chunks.values())
      for (const m of c.meshes) {
        this.scene.remove(m);
        m.geometry.dispose();
      }
    this.chunks.clear();
    this.stale.clear();
    this.signKey = '';
  }

  /** Meshes aus den Teilen eines Torhauses oder Portals, mit dem passenden Material je Teil */
  private meshes(p: Parts): Mesh[] {
    const out: Mesh[] = [];
    for (const [g, mat] of [
      [p.solid, this.gateSolid],
      [p.lava, this.lava],
      [p.bright, this.bright],
      [p.leaves, this.canopy],
      [p.plant, this.fineCanopy], // Pflanzen im Torhaus fein (Palmen, Glutbaum, Tannen, Riesenpilze)
      [p.plantTiny, this.fineCanopy], // … ihre winzigen Teile, ohne Schattenwurf
    ] as const) {
      if (g.empty) continue;
      const m = new Mesh(g.build(), mat);
      m.castShadow = mat !== this.bright && g !== p.plantTiny;
      m.receiveShadow = true;
      out.push(m);
    }
    return out;
  }

  // ---------- Stücke der Welt ----------

  private syncChunks(world: World, x: number, y: number) {
    const [pcx, pcy] = chunkOf(Math.round(x), Math.round(y));
    const want = new Set<string>();
    const missing: [number, number][] = [];
    for (let cy = pcy - RADIUS; cy <= pcy + RADIUS; cy++)
      for (let cx = pcx - RADIUS; cx <= pcx + RADIUS; cx++) {
        const k = `${cx},${cy}`;
        want.add(k);
        if (!this.chunks.has(k)) missing.push([cx, cy]);
      }
    // nächste Stücke zuerst
    missing.sort((a, b) => Math.hypot(a[0] - pcx, a[1] - pcy) - Math.hypot(b[0] - pcx, b[1] - pcy));
    const t0 = performance.now();
    for (const [cx, cy] of missing.slice(0, BUILD_PER_FRAME))
      this.chunks.set(`${cx},${cy}`, this.buildChunk(world, cx, cy));
    const st = this.stats; // Messung: Bauzeit, und ob ein Stück gleich um das Ziel noch fehlt (ein Loch im Bild)
    const ms = performance.now() - t0;
    st.built += Math.min(missing.length, BUILD_PER_FRAME);
    st.buildMs += ms;
    st.maxBuildMs = Math.max(st.maxBuildMs, ms);
    if (missing.slice(BUILD_PER_FRAME).some(([cx, cy]) => Math.max(Math.abs(cx - pcx), Math.abs(cy - pcy)) <= 1))
      st.holes++;
    // veraltete Stücke ersetzen: erst das neue bauen, dann das alte wegräumen (nahe zuerst, eins mehr je Bild)
    const stale = [...this.stale]
      .filter((k) => want.has(k))
      .sort((a, b) => {
        const d = (k: string) => {
          const [cx, cy] = fromKey(k);
          return Math.hypot(cx - pcx, cy - pcy);
        };
        return d(a) - d(b);
      });
    for (const k of stale.slice(0, BUILD_PER_FRAME + 1)) {
      const [cx, cy] = fromKey(k);
      const fresh = this.buildChunk(world, cx, cy);
      for (const m of this.chunks.get(k)?.meshes ?? []) {
        this.scene.remove(m);
        m.geometry.dispose();
      }
      this.chunks.set(k, fresh);
      this.stale.delete(k);
    }
    for (const [k, c] of this.chunks)
      if (!want.has(k)) {
        for (const m of c.meshes) {
          this.scene.remove(m);
          m.geometry.dispose();
        }
        this.chunks.delete(k);
        this.stale.delete(k);
      }
  }

  private buildChunk(world: World, cx: number, cy: number): Chunk {
    const geo = () => new Geo();
    const [solid, leaves, water, lava, bright, glow] = [geo(), geo(), geo(), geo(), geo(), geo()];
    const fine = fineSinks(); // Dinge: fein, getrennt vom Gelände (mitwachsen-fine-chunk-3d.ts)
    this.heights = heightGrid((x, y) => world.cell(x, y), cx * CHUNK, cy * CHUNK, CHUNK); // für den Schatten am Boden
    for (let y = cy * CHUNK; y < (cy + 1) * CHUNK; y++)
      for (let x = cx * CHUNK; x < (cx + 1) * CHUNK; x++) {
        const c = grown(world.seed, this.day, x, y, world.cell(x, y)); // mit allem, was schon nachgewachsen ist
        this.terrain(solid, water, lava, world, c, x, y, fine);
        // Gleis (3D-Teil der Bahn): Schwellen, Schienen, Prellbock, Portal; dort keine Büschel und Blumen
        const rails = c.ride ? this.views.rails(c, x, y, this.at) : null;
        if (rails) fineBoxes(fine, rails);
        if (!rails && !this.packed({ fine, blades: leaves, glow }, c, x, y))
          this.decoration(leaves, bright, fine, c, x, y);
      }
    const meshes: Mesh[] = [];
    const add = (g: Geo, mat: MeshLambertMaterial | MeshBasicMaterial, shadows: boolean) => {
      if (g.empty) return;
      const m = new Mesh(g.build(), mat);
      m.castShadow = shadows;
      m.receiveShadow = true;
      this.scene.add(m);
      meshes.push(m);
    };
    add(solid, this.solid, true);
    add(fine.solid, this.fineSolid, true);
    add(fine.see, this.fineCanopy, true);
    add(fine.tiny, this.fineSolid, false); // winzige Teile ohne Schattenwurf
    add(leaves, this.foliage, false);
    add(water, this.water, false);
    add(lava, this.lava, false);
    add(bright, this.bright, false);
    add(glow, this.glow, false);
    return { meshes, halos: chunkHalos(`${cx},${cy}`, [fine.solid, fine.see, fine.tiny, bright, glow]) };
  }

  private terrain(g: Geo, water: Geo, lava: Geo, world: World, c: Cell, x: number, y: number, fine?: FineSinks) {
    // Unter Wolken ist nichts: Ihre Seiten reichen weit hinunter, damit sie über dem Himmel schweben
    const heightOf = (n: Cell) => (n.ground === 'sky' ? -4 : n.ground === 'water' || n.ground === 'lava' ? 0 : n.h);
    if (c.ground === 'sky') return;
    if (c.ground === 'lava') {
      g.quad([x, 0, y + 1], [x + 1, 0, y + 1], [x + 1, 0, y], [x, 0, y], [0, 1, 0], 'basalt', new Color('#ffffff'));
      lava.quad(
        [x, 0.6, y + 1],
        [x + 1, 0.6, y + 1],
        [x + 1, 0.6, y],
        [x, 0.6, y],
        [0, 1, 0],
        'lava',
        new Color('#ffffff'),
      );
      return;
    }
    if (c.ground === 'water') {
      g.quad([x, 0, y + 1], [x + 1, 0, y + 1], [x + 1, 0, y], [x, 0, y], [0, 1, 0], 'sand', new Color('#9db0a0'));
      water.quad(
        [x, 0.82, y + 1],
        [x + 1, 0.82, y + 1],
        [x + 1, 0.82, y],
        [x, 0.82, y],
        [0, 1, 0],
        'white',
        new Color(this.views.water(c) ?? GAME_COLORS.water),
      );
      return;
    }
    const h = c.h;
    const stone = c.ground === 'stone';
    const own = this.views.ground(c, this.opened); // Boden einer Welt hinter einem Tor (Eis-Welt: Schnee und Eis, Rutschspur)
    const ring = isRing(c); // Rand der Lichtung: dunkler Schiefer, innen Hecke (mitwachsen-rim-look.ts)
    const [topTile, sideTop, below] = own?.tiles ?? (c.rim ? HEDGE_TILES : GROUND_TILES[c.ground]);
    const shade = stone ? 0 : (c.shade ?? 0);
    // Seiten eines Bodens einer Welt getönt (`side`, Eisfall), sonst Farbflecken im Boden
    const tint = own?.side
      ? new Color(own.side)
      : ring
        ? new Color(c.rim ? RIM_COLORS.hedge : RIM_COLORS.rock)
        : new Color(1, 1, 1).multiplyScalar(0.93 + shade * 0.07);
    if (c.tint && c.ground === 'grass') tint.multiply(new Color(c.tint)); // Stimmung der Richtung
    const top = own?.top ? new Color(own.top) : tint.clone();
    if (own?.light) top.multiplyScalar(1 + own.light); // Lichtfleck (Grotte): Licht in den Farben der Ecken
    // weicher Schatten neben höheren Blöcken: nur die Farbe der Ecken, Kachel und Form bleiben
    const corners = groundCorners(this.heights ?? ((nx, ny) => groundHeight(world.cell(nx, ny))), x, y);
    g.quad([x, h, y + 1], [x + 1, h, y + 1], [x + 1, h, y], [x, h, y], [0, 1, 0], topTile, top, corners);
    const sides: [number, number, V3][] = [
      [0, 1, [0, 0, 1]],
      [0, -1, [0, 0, -1]],
      [1, 0, [1, 0, 0]],
      [-1, 0, [-1, 0, 0]],
    ];
    for (const [dx, dy, n] of sides) {
      const nh = heightOf(world.cell(x + dx, y + dy));
      for (let k = Math.max(-4, nh); k < h; k++) {
        const tile: Tile = k === h - 1 ? sideTop : below;
        const [y0, y1] = [k, k + 1];
        if (dy === 1) g.quad([x, y0, y + 1], [x + 1, y0, y + 1], [x + 1, y1, y + 1], [x, y1, y + 1], n, tile, tint);
        else if (dy === -1) g.quad([x + 1, y0, y], [x, y0, y], [x, y1, y], [x + 1, y1, y], n, tile, tint);
        else if (dx === 1)
          g.quad([x + 1, y0, y + 1], [x + 1, y0, y], [x + 1, y1, y], [x + 1, y1, y + 1], n, tile, tint);
        else g.quad([x, y0, y], [x, y0, y + 1], [x, y1, y + 1], [x, y1, y], n, tile, tint);
      }
    }
    if (c.rim) for (const [bx, by, bz, w, d, bh, color] of rimBlossoms(x, y, h)) g.box(bx, bz, by, w, bh, d, color);
    const way = stoneOf(c); // Wegstein neben einem Weltpfad: wach, sobald sein Tor offen ist
    if (way)
      for (const b of waystoneBoxes(x, y, h, way, this.opened.includes(way)))
        if (fine) fineBox(sinkOf(fine, b), b);
        else g.box(b[0], b[2], b[1], b[3], b[5], b[4], b[6], b[7]);
  }

  /**
   * Dinge einer Welt hinter einem Tor aus dem 3D-Teil ihres Pakets (Eis-Welt: Iglu, vor der Figur durchsichtig wie
   * Laub, Eisschale, Wassertrog aus Eis, Fischkiste voll oder leer aus den Regeln, ihre Schwanzflossen wiegen sich im
   * Wind wie die Grasbüschel, Eiskristalle leuchten beim Polarlicht); solange er lädt, ein einfacher Block. false: kein
   * solches Ding, wie sonst bauen.
   */
  private packed(geo: { fine: FineSinks; blades: Geo; glow: Geo }, c: Cell, x: number, y: number): boolean {
    const boxes = drawDeco(this.views.decos, this.world!, c, x, y, this.at);
    for (const b of boxes ?? []) {
      const [bx, by, bz, w, d, bh, side, top, kind, how] = b;
      if (kind === 'sway') geo.blades.box(bx, bz, by, w, bh, d, side, top);
      else if (kind === 'glow')
        geo.glow.box(bx, bz, by, w, bh, d, side, top, 'white', undefined, how); // Eiskristall: leuchtet, dazu `halo`
      else fineBox(sinkOf(geo.fine, b), b); // Dinge der Welt fein, Laub vor der Figur durchsichtig
    }
    return !!boxes;
  }

  /**
   * Dinge auf einem Feld aus derselben Quelle wie 2D (mitwachsen-deco-look.ts): Laub (`see`) vor der Figur durchsichtig,
   * Kristalle leuchten aus sich selbst; Bett, Tafel und Klangstein (mitwachsen-stone-look.ts) aus ihren eigenen Quadern
   */
  private decoration(blades: Geo, bright: Geo, fine: FineSinks, c: Cell, x: number, y: number) {
    const h = c.h;
    if (c.tufts) tufts(blades, x, y, h, c.tufts);
    switch (c.deco) {
      case 'klangstein':
        return fineBoxes(fine, stoneBoxes(x, y, h));
      case 'bed':
        return fineBoxes(fine, bedBoxes(x, y, h, this.views.bedFrame(c, WOOD_BED)));
      case 'sign': {
        const region = REGIONS.find((r) => r.id === GATES.find((g) => g.id === c.sign)?.region);
        return fineBoxes(fine, signBoxes(x, y, h, region?.animals.length ?? 0));
      }
    }
    const world = this.world!;
    const boxes = decoBoxes(world, c, x, y, this.at.picked, () => homeAt(world, x, y).shelter);
    // Laub vor der Figur durchsichtig, Kristalle leuchten aus sich selbst
    fineBoxes(fine, boxes ?? [], c.deco === 'crystal' ? bright : undefined);
  }

  // ---------- Bewegliches: Wesen, Tore, Tafeln, Schläfer ----------

  private model(key: string, parts: readonly Part[], scale = 1): Model {
    let m = this.models.get(key);
    if (!m) {
      m = modelGeometry(parts, scale);
      this.models.set(key, m);
    }
    return m;
  }

  /**
   * Wesen an ihren Platz; `facing`: zur Kamera (die lesende Figur schaut zum Betrachter). Dazu die Körper eines
   * Fahrzeugs (`Scene.rides`, aus dem Welt-Paket, wie in 2D); im Fahrzeug sitzt die Figur in seinem Modell
   */
  private syncBodies(state: State, sc: Scene, facing: number) {
    const seen = new Set<string>();
    const contacts: Contact[] = []; // weicher Fleck unter jedem Körper (mitwachsen-fine-bodies-3d.ts)
    this.bodyHalos = [];
    type At = { x: number; y: number; z: number; hop?: number; puff?: number };
    // `foot`: Halbbreite des Flecks (0: keiner); `ground`: Boden unter einem hängenden Tier (sonst der Boden des Körpers)
    const place = (
      id: string,
      model: Model,
      scale: number,
      dir: Dir,
      b = sc.bodies.get(id) as At | undefined,
      foot = 0.24,
      ground?: number,
    ) => {
      if (!b) return;
      seen.add(id);
      let m = this.bodies.get(id);
      if (!m) {
        m = new Mesh(model.geo, this.entity);
        m.castShadow = true;
        this.scene.add(m);
        this.bodies.set(id, m);
      }
      m.geometry = model.geo;
      const size = scale * (b.puff ?? 1); // Haltung im Iglu: aufgeplustert oder eingerollt
      m.scale.setScalar(size);
      m.position.set(b.x + 0.5, b.z + (b.hop ?? 0), b.y + 0.5);
      m.rotation.y = id === 'player' && sc.pose !== 'stand' ? facing : YAW[dir];
      const at = { x: b.x + 0.5, y: b.y + 0.5, z: b.z + (b.hop ?? 0) };
      if (foot > 0)
        contacts.push({ ...at, z: ground ?? b.z, hop: ground === undefined ? (b.hop ?? 0) : 0, foot: foot * size });
      if (model.halos.length) this.bodyHalos.push(...placeHalos(model.halos, at, m.rotation.y, size, id));
    };
    if (!state.sleeping && !state.ride) {
      // Korb auf dem Rücken, Eimer (Kanne) und Netz in den Händen, Buch beim Lesen; beim Lesen schaut die Figur zum Betrachter
      const book = sc.pose !== 'stand';
      const doze = sc.pose === 'doze';
      const turning = sc.pose === 'read' && !sc.reduced && sc.now % 5000 < 450; // alle paar Sekunden umblättern
      const cave = this.world?.realm(state.player.x, state.player.y) === 'hoehle'; // in der Grotte trägt sie eine Kanne
      const key = `player${carryKey(state, cave)}${book ? '-book' : ''}${turning ? '-turn' : ''}${doze ? '-doze' : ''}${sc.glance ? '-glance' : ''}`;
      const parts = [
        ...(sc.glance ? turnHead(figureParts(this.look)) : figureParts(this.look)), // Kopf kurz in die Böe gedreht
        ...carried(state, cave),
        ...(book ? BOOK_PARTS(this.look, turning) : []),
        ...(doze ? SLEEPY_EYES(this.look) : []),
      ];
      place('player', this.model(key, parts), 1, book ? 's' : state.player.dir, undefined, 0.3);
    }
    for (const a of state.animals) {
      const b = sc.bodies.get(a.id);
      if (b && !this.explored(Math.round(b.x), Math.round(b.y))) continue; // Tiere im Nebel bleiben verborgen
      const sp = SPECIES[a.species];
      const perch = this.world ? hangAt(a, this.world.cell(a.x, a.y)) : undefined; // kopfüber am Sitzplatz (Fledermaus im Bogen)
      if (perch !== undefined && sc.away(a.x, a.y)) continue; // gerade auf ihrer Runde (Bild des Welt-Pakets)
      if (b && perch !== undefined && sp.roost) {
        const roost = this.model(`${a.species}-roost`, sp.roost, sp.scale);
        place(a.id, roost, sp.scale, a.dir, { ...b, z: b.z + perch, hop: 0 }, 0.24, b.z);
      } else if (a.solo && sp.solo) place(a.id, this.model(`${a.species}-solo`, sp.solo, sp.scale), sp.scale, a.dir);
      else place(a.id, this.model(a.species, sp.parts, sp.scale), sp.scale, a.dir);
    }
    for (const r of sc.rides)
      if (this.explored(Math.round(r.x), Math.round(r.y))) {
        place(r.id, this.model(r.key, r.parts), 1, r.dir, r, footOf(r));
        this.bodies.get(r.id)!.material = r.sheer ? this.sheer : this.entity;
      }
    this.contacts.update(contacts, sc.reduced);
    for (const [id, m] of this.bodies)
      if (!seen.has(id)) {
        this.scene.remove(m);
        this.bodies.delete(id);
      }
  }

  /** Tiere auf den Tafeln: gefundene in Farbe, verlorene als dunkle Umrisse (neu gebaut, wenn sich etwas ändert) */
  private syncSigns(state: State, facing: number) {
    for (const m of this.signs.children) m.rotation.y = facing; // schauen zur Kamera, auch wenn sie dreht
    const key = state.met.join(',');
    if (key === this.signKey) return;
    this.signKey = key;
    for (const child of [...this.signs.children]) this.signs.remove(child);
    for (const g of GATES) {
      if (!g.sign) continue;
      const sign = g.sign;
      const region = REGIONS.find((r) => r.id === g.region)!;
      const n = region.animals.length;
      const top = (this.world?.cell(sign[0], sign[1]).h ?? 1) + SIGN_TOP; // auf dem Rahmen der Tafel
      region.animals.forEach((a, i) => {
        const met = state.met.includes(`${region.id}:${a.species}`);
        const sp = SPECIES[a.species];
        const m = new Mesh(this.model(a.species, sp.parts, sp.scale).geo, met ? this.entity : this.dark);
        m.scale.setScalar(sp.scale * 0.45);
        m.rotation.y = facing;
        m.position.set(sign[0] + 0.5 + (i - (n - 1) / 2) * 0.55, top, sign[1] + 0.5);
        this.signs.add(m);
      });
    }
  }

  /** Die schlafende Figur im Bett der Gegend, in der sie liegt (neu gebaut, wenn das Bett ein anderes ist) */
  private syncSleeper(state: State) {
    const [x, y] = homeAt(this.world!, state.player.x, state.player.y).bed;
    if (state.sleeping && this.sleeperAt !== `${x},${y}`) {
      for (const o of [...this.sleeper.children]) {
        if (o instanceof Mesh) (o.geometry as BufferGeometry).dispose();
        this.sleeper.remove(o);
      }
      this.sleeperAt = `${x},${y}`;
      const g = new Geo();
      for (const b of sleeperBoxes(x, y, this.world!.cell(x, y).h, this.look)) fineBox(g, b);
      this.sleeper.add(new Mesh(g.build(), this.entity));
    }
    this.sleeper.visible = state.sleeping;
  }
}
