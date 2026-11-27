// Weicher Fleck unter den Körpern in der 3D-Ansicht (Entwurf „Feine Grafik“): Figur, Tiere und Fahrzeuge stehen auf
// einem runden, weichen Schatten, der beim Hüpfen kleiner und blasser wird (bei reduzierter Bewegung in Stufen). Ein
// Netz für alle, je Bild neu befüllt, ohne Schattenwurf; statische Dinge bekommen keinen (die Sonne wirft ihre
// Schatten). Dazu die Lage der Leuchten an Modellen (Laterne in der Hand) je Bild. Gehört zur 3D-Ansicht (Three.js).
// Spezifikation: docs/specs/mitwachsen.md (Feinheit)

import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  RGBAFormat,
  UnsignedByteType,
} from 'three';
import type { HaloAt } from '../../lib/games/front';
import { contactAlpha, contactFall, contactRadius } from '../../lib/games/shade';

/** Farbe des Flecks (wie im Entwurf) */
const SHADE = [29 / 255, 40 / 255, 56 / 255] as const;
/** Höchstens so viele Körper je Bild */
const MAX = 96;
/** So hoch über dem Boden liegt der Fleck (gegen Flimmern mit der Oberseite) */
export const CONTACT_LIFT = 0.012;

/** Ein Körper: Mitte (x rechts, y nach vorn), Boden `z`, Hüpfer `hop` (Ebenen), Halbbreite `foot` (Felder) */
export type Contact = { x: number; y: number; z: number; hop: number; foot: number };

/** Weicher runder Verlauf: Mitte voll, am Rand 0 (Deckkraft im Alphakanal, Farbe weiß; die Farbe kommt je Ecke) */
export function softDisc(n = 32): Uint8Array {
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const r = Math.hypot((x + 0.5) / n - 0.5, (y + 0.5) / n - 0.5) * 2;
      data.set([255, 255, 255, Math.round(255 * contactFall(r))], (y * n + x) * 4);
    }
  return data;
}

/** Ecken (x, Höhe, y) und Farben (RGBA) der Flecken, je Körper ein Viereck aus zwei Dreiecken */
export function contactQuads(list: readonly Contact[], reduced: boolean) {
  const pos: number[] = [],
    rgba: number[] = [],
    uv: number[] = [];
  for (const c of list.slice(0, MAX)) {
    const r = contactRadius(c.foot, c.hop, reduced);
    const a = contactAlpha(c.hop, reduced);
    const h = c.z + CONTACT_LIFT;
    const corners = [
      [-1, 1, 0, 0],
      [1, 1, 1, 0],
      [1, -1, 1, 1],
      [-1, 1, 0, 0],
      [1, -1, 1, 1],
      [-1, -1, 0, 1],
    ] as const;
    for (const [dx, dy, u, v] of corners) {
      pos.push(c.x + dx * r, h, c.y + dy * r);
      rgba.push(...SHADE, a);
      uv.push(u, v);
    }
  }
  return { pos, rgba, uv };
}

/** Die Flecken unter den Körpern: ein Netz, je Bild neu befüllt */
export class Contacts {
  readonly mesh: Mesh;
  private readonly tex: DataTexture;
  private readonly geo = new BufferGeometry();
  // Puffer für höchstens `MAX` Körper, einmal angelegt und je Bild nur befüllt
  private readonly pos = new BufferAttribute(new Float32Array(MAX * 18), 3);
  private readonly rgba = new BufferAttribute(new Float32Array(MAX * 24), 4);
  private readonly uv = new BufferAttribute(new Float32Array(MAX * 12), 2);

  constructor() {
    const n = 32;
    this.tex = new DataTexture(softDisc(n), n, n, RGBAFormat, UnsignedByteType);
    this.tex.magFilter = LinearFilter;
    this.tex.minFilter = LinearFilter;
    this.tex.needsUpdate = true;
    const material = new MeshBasicMaterial({
      map: this.tex,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.geo.setAttribute('position', this.pos);
    this.geo.setAttribute('color', this.rgba);
    this.geo.setAttribute('uv', this.uv);
    this.geo.setDrawRange(0, 0);
    this.mesh = new Mesh(this.geo, material);
    this.mesh.frustumCulled = false; // ändert sich je Bild; die Hülle nachzurechnen lohnt nicht
    this.mesh.renderOrder = 1; // nach dem Boden
  }

  update(list: readonly Contact[], reduced: boolean) {
    const { pos, rgba, uv } = contactQuads(list, reduced);
    (this.pos.array as Float32Array).set(pos);
    (this.rgba.array as Float32Array).set(rgba);
    (this.uv.array as Float32Array).set(uv);
    for (const a of [this.pos, this.rgba, this.uv]) a.needsUpdate = true;
    this.geo.setDrawRange(0, pos.length / 3);
    this.mesh.visible = pos.length > 0;
  }

  dispose() {
    this.geo.dispose();
    this.tex.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
  }
}

/**
 * Leuchten eines Modells in der Welt: `halos` liegen im Modell (x vorn, y rechts, z Höhe, Blick nach Osten), das
 * Modell steht an (x, y) auf Höhe z, gedreht um `yaw` (wie `mesh.rotation.y`) und um `scale` vergrößert
 */
export function placeHalos(
  halos: readonly HaloAt[],
  at: { x: number; y: number; z: number },
  yaw: number,
  scale: number,
  id: string,
): (HaloAt & { id: string })[] {
  const [c, s] = [Math.cos(yaw), Math.sin(yaw)];
  return halos.map((h, i) => ({
    id: `${id}#${i}`,
    // Drehung um die Hochachse (Three.js: x' = x cos + z sin, z' = −x sin + z cos; Modell-z ist Welt-y)
    x: at.x + (h.x * c + h.y * s) * scale,
    y: at.y + (-h.x * s + h.y * c) * scale,
    z: at.z + h.z * scale,
    size: h.size * scale,
    color: h.color,
  }));
}
