// Leuchten kompakter Teile (Entwurf „Feine Grafik“, `drawGlows`): Lampen, Kristalle, Pilze mit `halo` bekommen einen
// weichen Schein. Ein Durchgang auf der Ebene über dem Bild, gleich für 2D und 3D (dort mit der Projektion der
// 3D-Ansicht): nach Dunkelmaske und Nacht, so liegt das Leuchten nie unter der Maske der Grotte. Nur auf erkundeten
// Feldern, höchstens `HALO_LIMIT` nahe der Figur (mit Hysterese, nichts springt beim Laufen), gedämpft hinter Hügeln
// und Baumkronen, nicht doppelt auf Lichtinseln der Grotte (`Cell.light`), in der Grotte leiser (`HALO_CAVE`: dort
// leuchtet fast alles, die Dunkelmaske soll Dunkel bleiben). Hat nichts mit der Art `'glow'` zu tun.
// Spezifikation: docs/specs/mitwachsen.md (Feinheit)

import type { HaloAt, Projection } from '../../lib/games/front';
import { haloPick, haloRadius } from '../../lib/games/shade';
import { TILT_DEG } from './mitwachsen-camera';
import type { Cell } from './mitwachsen-cell';

export type HaloLit = HaloAt & { readonly id: string };

/** Deckkraft in der Mitte: tagsüber leise, nachts kräftiger (wie der Entwurf: .3, nachts bis .55) */
export const haloAlpha = (night: number): number => 0.3 + 0.25 * Math.max(0, Math.min(1, night));
/** Anstieg des Blicks je Feld zur Kamera bei einer Neigung (Grad) über dem Boden */
export const riseOf = (tiltDeg: number): number => Math.tan((tiltDeg * Math.PI) / 180);
/** Anstieg des Blicks der 3D-Kamera in Ruhe (tan 55°, `TILT_DEG` in mitwachsen-camera.ts) */
export const RISE_3D = riseOf(TILT_DEG[0]);
/** So viel bleibt von einem Leuchten hinter einem Hügel oder einer Baumkrone */
export const HALO_HIDDEN = 0.25;
/** So viel bleibt von einem Leuchten in der Kristallgrotte (Felder der Gegend `hoehle`) */
export const HALO_CAVE = 0.6;
/** Kleinster Radius in Pixeln (winzige Teile leuchten noch sichtbar) */
const MIN_PX = 6;

/** Wie hoch etwas auf einem Feld aufragt (Ebenen): Gelände, dazu Bäume, Riesenpilze und Torhäuser */
export function standing(c: Pick<Cell, 'h' | 'ground' | 'deco'>): number {
  if (c.ground === 'water' || c.ground === 'lava' || c.ground === 'sky') return 0;
  const tall =
    c.deco === 'tree' ? 2.4 : c.deco === 'bigshroom' ? 2 : c.deco === 'gatetower' || c.deco === 'biggate' ? 3 : 0;
  return c.h + tall;
}

/**
 * Woher die Kamera schaut: `to` die Richtung zur Kamera auf dem Boden (x, y, Länge 1; 2D und 3D in Ruhe (0, 1), also
 * aus Süden; auf einer Torplatte dreht die 3D-Kamera), `rise` der Anstieg des Blicks je Feld zur Kamera (2D von vorn:
 * 44/40, 3D: tan der Neigung), `seen` wie deutlich ein Feld durch den Nebelrand zu sehen ist (1 klar … 0 verhüllt)
 */
export type HaloView = {
  readonly rise: number;
  readonly to: readonly [number, number];
  readonly seen?: (x: number, y: number) => number;
};

/**
 * Verdeckt etwas auf den Feldern zur Kamera hin das Leuchten an (x, y, z)? Entlang `to` werden die Felder geprüft, durch
 * die der Blick in den nächsten vier Feldern Abstand geht (je Feld ab der Stelle, an der er es betritt)
 */
export function hidden(heightAt: (x: number, y: number) => number, x: number, y: number, z: number, view: HaloView) {
  const [dx, dy] = view.to;
  let cx = Math.floor(x),
    cy = Math.floor(y);
  const sx = Math.sign(dx),
    sy = Math.sign(dy);
  const step = (d: number) => (d ? 1 / Math.abs(d) : Infinity);
  let tx = dx > 0 ? (cx + 1 - x) / dx : dx < 0 ? (x - cx) / -dx : Infinity;
  let ty = dy > 0 ? (cy + 1 - y) / dy : dy < 0 ? (y - cy) / -dy : Infinity;
  for (;;) {
    const t = Math.min(tx, ty);
    if (t > 4) return false;
    if (tx < ty) {
      cx += sx;
      tx += step(dx);
    } else {
      cy += sy;
      ty += step(dy);
    }
    if (heightAt(cx, cy) > z + t * view.rise) return true;
  }
}

/** Was der Durchgang vom Bild weiß */
export type HaloScene = {
  readonly explored: (x: number, y: number) => boolean;
  readonly night: number;
  readonly focus: readonly [number, number];
  readonly cell: (x: number, y: number) => Pick<Cell, 'h' | 'ground' | 'deco' | 'light' | 'region'>;
  /** Woher die Kamera schaut, und der Nebelrand (siehe `HaloView`) */
  readonly view: HaloView;
};

/** Welche Leuchten in diesem Bild zu sehen sind und wie stark (Auswahl mit Hysterese über die Bilder hinweg) */
export class HaloPass {
  private shown = new Set<string>();

  pick(list: readonly HaloLit[], sc: HaloScene): { h: HaloLit; alpha: number }[] {
    const seen = list.filter((h) => {
      const cx = Math.floor(h.x),
        cy = Math.floor(h.y);
      return sc.explored(cx, cy) && !sc.cell(cx, cy).light;
    });
    const picked = haloPick(seen, sc.focus, this.shown);
    this.shown = new Set(picked.map((h) => h.id));
    const base = haloAlpha(sc.night);
    const height = (x: number, y: number) => standing(sc.cell(x, y));
    return picked.map((h) => {
      const [cx, cy] = [Math.floor(h.x), Math.floor(h.y)];
      const veil = sc.view.seen?.(cx, cy) ?? 1; // am Nebelrand so verhüllt wie das Ding
      const cave = sc.cell(cx, cy).region === 'hoehle' ? HALO_CAVE : 1;
      return { h, alpha: base * veil * cave * (hidden(height, h.x, h.y, h.z, sc.view) ? HALO_HIDDEN : 1) };
    });
  }

  /** Alle gewählten Leuchten als weiche Kreise aufhellend (`screen`) auf `ctx` */
  draw(ctx: CanvasRenderingContext2D, P: Projection, list: readonly HaloLit[], sc: HaloScene) {
    const lit = this.pick(list, sc);
    if (!lit.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const { h, alpha } of lit) {
      if (alpha < 0.005) continue; // ganz im Nebel
      const [x, y] = P(h.x, h.y, h.z);
      // Radius auf dem Bildschirm, gleich wie die Kamera dreht: die längere der beiden Bodenachsen
      const R = haloRadius(h.size, 0, 0);
      const [ax, ay] = P(h.x + R, h.y, h.z);
      const [bx, by] = P(h.x, h.y + R, h.z);
      const r = Math.max(MIN_PX, Math.hypot(ax - x, ay - y), Math.hypot(bx - x, by - y));
      const rgb = rgbOf(h.color);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${rgb},${alpha.toFixed(3)})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    ctx.restore();
  }
}

/** "r,g,b" aus einer Farbe '#rrggbb', '#rgb' oder 'rgb(a)(…)'; Unbekanntes leuchtet weiß */
export function rgbOf(color: string): string {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
    const n = parseInt(full, 16);
    return `${n >> 16},${(n >> 8) & 255},${n & 255}`;
  }
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color);
  return m ? `${m[1]},${m[2]},${m[3]}` : '255,255,255';
}
