// Haken der 3D-Ansicht für die Welten hinter den Toren: Was nur eine Welt in 3D zeigt (Eis-Welt: Iglu,
// Eisschale, Eistrog, Fischkiste, Rutschspur, Schnee und Eis im Kessel, Bett aus Schnee, Tür und Eiszapfen des Eistors,
// Schmuck der Torplatte), baut der 3D-Teil ihres Welt-Pakets (worlds/<welt>/view-3d.ts). Das Paket lädt ihn per import() erst,
// wenn es an der Welt hängt und die 3D-Ansicht da ist (`WorldPack.view3d`); bis dahin baut die 3D-Ansicht schlicht:
// ein Block in Kartenfarbe je Ding der Welt (`drawDeco`), Böden und Bett wie auf der Lichtung, schlichte Türbretter.
// `Views3D` hält die geladenen 3D-Teile für die 3D-Ansicht (rein, ohne Three.js; läuft mit ihr nachgeladen).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Welt-Pakete“)

import type { Object3D } from 'three';
import type { GateId, RegionId } from '../../data/games/mitwachsen';
import type { Cell } from './mitwachsen-cell';
import type { GateLook } from './mitwachsen-gate-kit';
import type { Tile } from './mitwachsen-geo';
import type { BedFrame } from './mitwachsen-yard-look';
import type { Box, DecoAt, DrawRails, View2D } from './mitwachsen-view';
import type { WorldPack } from './mitwachsen-pack-types';
import type { Scene } from './mitwachsen-render';
import type { State } from './mitwachsen-state';
import type { World } from './mitwachsen-world';

/** Nach so vielen ms wird ein gescheiterter 3D-Teil neu versucht (wie die Pakete, `RETRY_MS` in mitwachsen-packs.ts) */
export const RETRY_3D_MS = 30_000;
const WHITE = [1, 1, 1] as const;

/**
 * Boden eines Felds: Kacheln oben, oberste Seitenkachel, Seiten darunter; `top` färbt die Oberseite (Rutschspur),
 * `side` die Seiten (Eisfall); `light` macht die Oberseite so viel heller (0,35: um 35 %, Lichtfleck in der Grotte), negativ
 * dunkler (−0,25: Rand im Dunkel)
 */
export type Ground = { tiles: readonly [Tile, Tile, Tile]; top?: string; side?: string; light?: number };

/**
 * Luft einer Welt, solange die Figur in ihr ist (Grotte: lila Höhlenhimmel ohne Decke): Farbe des Himmels und der
 * Nebel-Maske über dem Unerkundeten; nachts dunkeln beide wie der Himmel der Lichtung
 */
export type Air = { realm: RegionId; sky: string; mist: string };

/** Rahmen des Betts: Farbe der Seiten, oben (null: wie die Seiten), Muster (mitwachsen-yard-look.ts) */
export type Frame = BedFrame;

/**
 * Was ein 3D-Teil je Bild nachführt (Eis-Welt: Fußspuren im Schnee, Schneespur des Schlittens): ein Objekt in der Szene
 * und sein Nachführen aus Welt, Zustand und Bild
 */
export type Layer = { object: Object3D; update(world: World, state: State, sc: Scene): void };

/**
 * Der 3D-Teil eines Welt-Pakets (ein Paket ohne eigene Welt, die Bahn, hat kein Tor, keinen Zugang und kein Bett, dafür
 * das Gleis `rails`)
 */
export type View3D = {
  /** das Tor dieser Welt: Nur an ihm baut `look` mit */
  gate?: GateId;
  /** Tür, Eiszapfen und Torplatte seines Zugangs */
  look?: GateLook;
  /** je Deko-Art, die nur diese Welt hat, ihre Quader (wie in 2D, `DrawDeco`; in 3D zuckt nichts) */
  decos: View2D['decos'];
  /** Boden eines Felds dieser Welt (`open`: die offenen Tore), sonst null: wie auf der Lichtung */
  ground(c: Cell, open: readonly GateId[]): Ground | null;
  /** Rahmen des Betts dieser Welt, sonst null: Holz */
  bedFrame?(c: Cell): Frame | null;
  /** Gleis auf Feldern mit Strecke (wie in 2D, `DrawRails`) */
  rails?: DrawRails;
  /**
   * Was am Zustand der Pakete die Stücke dieses Pakets ändert (die Bahn: ihr Ausbau und, solange gebaut wird, die Stufe
   * der Gleiswelle aus `work`, wie weit der Bote mit seiner Arbeit ist); ändert es sich, baut die 3D-Ansicht alle Stücke neu
   */
  stamp?(packs: Readonly<Record<string, unknown>>, work?: number): string;
  /**
   * Farbe, mit der die Quader `'glow'` dieser Welt leuchten (multipliziert, 1 = wie gebaut), je nach Polarlicht (0 … 1),
   * reduzierter Bewegung und Zeit; fehlt sie, leuchten sie wie gebaut. Es gibt ein Leuchtmaterial für alle Welten, darum
   * darf nur ein Paket `glow` haben (bisher die Eis-Welt); leuchtet eine zweite Welt, das Material je Tor schlüsseln
   */
  glow?(aurora: number, reduced: boolean, now: number): readonly [number, number, number];
  /** was sich je Bild ändert (Eis-Welt: Fußspuren und Schneespur); die 3D-Ansicht hängt es in ihre Szene */
  layer?: Layer;
  /** Himmel und Nebel-Maske in ihrer Gegend (Grotte), sonst wie auf der Lichtung */
  air?: Air;
  /** Farbe des Wassers dieser Welt (Grotte: türkis), sonst blau wie überall */
  water?: string;
};

/** Die 3D-Teile der Welt-Pakete, die die 3D-Ansicht schon hat, und ihr Nachladen */
export class Views3D {
  constructor(private readonly retryMs = RETRY_3D_MS) {}

  private views: View3D[] = [];
  private asked = new Set<string>(); // Welt-Pakete, deren 3D-Teil schon lädt oder da ist
  private retries: ReturnType<typeof setTimeout>[] = []; // nächste Versuche nach gescheitertem Laden
  /** Dinge aller geladenen Welten je Deko-Art (für `drawDeco`) */
  decos: Pick<View2D, 'decos'> = { decos: {} };

  /**
   * 3D-Teil eines Welt-Pakets nachladen, einmal je Paket; `ready`, sobald er da ist. Scheitert es, bleibt alles
   * schlicht (ohne Fehler), und nach `retryMs` (`RETRY_3D_MS`, 30 s wie bei den Paketen) oder beim nächsten Aufruf wird es
   * wieder versucht, bis er da ist oder die 3D-Ansicht geht (`stop`).
   */
  use(pack: Pick<WorldPack<unknown, unknown, View3D>, 'id' | 'view3d'>, ready: () => void): Promise<void> {
    if (!pack.view3d || this.asked.has(pack.id)) return Promise.resolve();
    this.asked.add(pack.id);
    return pack.view3d().then(
      (view) => {
        this.views = [...this.views, view];
        this.decos = { decos: Object.assign({}, ...this.views.map((v) => v.decos)) as View2D['decos'] };
        ready();
      },
      () => {
        this.asked.delete(pack.id);
        this.retries.push(setTimeout(() => void this.use(pack, ready), this.retryMs));
      },
    );
  }

  /** Keine weiteren Versuche (die 3D-Ansicht geht) */
  stop() {
    for (const t of this.retries) clearTimeout(t);
    this.retries = [];
  }

  /** Tür, Eiszapfen und Torplatte am Tor `gate` aus dem Paket seiner Welt, solange es fehlt nichts */
  look(gate: GateId): GateLook | undefined {
    return this.views.find((v) => v.gate === gate)?.look;
  }

  /** Boden eines Felds aus dem 3D-Teil eines Pakets (`open`: die offenen Tore), sonst null */
  ground(c: Cell, open: readonly GateId[]): Ground | null {
    for (const v of this.views) {
      const own = v.ground(c, open);
      if (own) return own;
    }
    return null;
  }

  /** Farbe des Wassers auf einem Feld aus dem 3D-Teil der Welt des Felds (`biome`), sonst undefined: blau */
  water(c: Cell): string | undefined {
    return c.biome && this.views.find((v) => v.gate === c.biome)?.water;
  }

  /** Leuchten der Quader `'glow'` aus dem 3D-Teil des (einzigen) Pakets mit `glow` (multipliziert), sonst wie gebaut */
  glow(aurora: number, reduced: boolean, now: number): readonly [number, number, number] {
    for (const v of this.views) if (v.glow) return v.glow(aurora, reduced, now);
    return WHITE;
  }

  /**
   * Je Bild: was die 3D-Teile der Pakete nachführen (`View3D.layer`, Eis-Welt: Fußspuren, Schneespur), in die Szene
   * `into` hängen (einmal; nach einem neuen WebGL-Kontext in die neue) und nachführen
   */
  layers(into: Object3D, world: World, state: State, sc: Scene) {
    for (const { layer } of this.views) {
      if (!layer) continue;
      if (layer.object.parent !== into) into.add(layer.object);
      layer.update(world, state, sc);
    }
  }

  /** Himmel und Nebel-Maske der Gegend `realm` aus dem 3D-Teil ihres Pakets, sonst undefined (wie auf der Lichtung) */
  air(realm: RegionId): Air | undefined {
    return this.views.find((v) => v.air?.realm === realm)?.air;
  }

  /** Rahmen des Betts aus dem 3D-Teil eines Pakets, sonst `wood` */
  bedFrame(c: Cell, wood: Frame): Frame {
    for (const v of this.views) {
      const own = v.bedFrame?.(c);
      if (own) return own;
    }
    return wood;
  }

  /** Gleis auf einem Feld mit Strecke aus dem 3D-Teil eines Pakets (der Bahn), sonst null: wie sonst bauen */
  rails(c: Cell, x: number, y: number, at: Pick<DecoAt, 'packs' | 'reduced' | 'work'>): readonly Box[] | null {
    for (const v of this.views) {
      const own = v.rails?.(c, x, y, at);
      if (own) return own;
    }
    return null;
  }

  /** Was am Zustand der Pakete die Stücke ändert (`View3D.stamp` aller 3D-Teile, hintereinander) */
  stamp(packs: Readonly<Record<string, unknown>>, work?: number): string {
    return this.views.map((v) => v.stamp?.(packs, work) ?? '').join('|');
  }
}
