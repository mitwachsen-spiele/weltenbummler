// Fußspuren im Schnee der Eis-Welt in 3D, im 3D-Teil ihres Welt-Pakets: flache Plättchen knapp über dem Schnee, alle in
// einem Mesh, dessen Puffer einmal angelegt und nur neu gefüllt werden, wenn sich etwas Sichtbares ändert
// (`prints.rev`); höchstens `MAX_MARKS` Plättchen, die neuesten Abdrücke zuerst. Gezeigt wird, was gerade zu sehen ist
// (nah an der Kamera, ringsum erkundet, nicht verweht; `prints.seen` aus mitwachsen-prints.ts, je Bild auch in 3D
// nachgeführt). Ein verwehender Abdruck wird durchsichtiger, bis nur der Schnee bleibt (bei reduzierter Bewegung in
// Stufen). Jedes Plättchen hat einen weichen Rand (Maske `softMask`, Entwurf „Feine Grafik“). Nur Klassen von Three.js, die die 3D-Ansicht schon nutzt (sonst wüchse three.<hash>.js). Die 3D-Ansicht
// hängt das Mesh in ihre Szene und führt es je Bild nach (`View3D.layer`).
// Spezifikation: docs/specs/mitwachsen.md (Abschnitt „Was angezeigt wird“, Zeile „Fußspuren“)

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  LinearFilter,
  Mesh,
  MeshLambertMaterial,
  RGBAFormat,
  UnsignedByteType,
} from 'three';
import { markMask, softMark } from '../../../../lib/games/shade';
import { marks } from '../../mitwachsen-tracks';
import type { Layer } from '../../mitwachsen-view-3d';
import type { World } from '../../mitwachsen-world';
import { PRINT_RGB, prints, type Prints } from './mitwachsen-prints';

// höchstens so viele Plättchen zugleich: 300 Abdrücke mit den meisten Teilen (Tatze, Dreizack), mehr liegt selten um
// die Kamera; darüber fehlen die ältesten, schon blassen
export const MAX_MARKS = 2400;
const LIFT = 0.012; // so weit über dem Schnee (kein Flimmern)
const PRINT = new Color(`rgb(${PRINT_RGB})`); // kühles Blaugrau, wie in 2D
export const OPACITY = 0.65; // ein frischer Abdruck; verweht wird er ganz durchsichtig (kein Fleck, kein Sprung)

let mask: DataTexture | undefined;
/**
 * Maske des weichen Rands flacher Marken (`markMask`), einmal je Seite und geteilt von Fußspuren und Schneespur: Mitte
 * voll, außen läuft sie aus. Nur Klassen, die die 3D-Ansicht schon nutzt (DataTexture wie die Muster)
 */
export function softMask(): DataTexture {
  if (mask) return mask;
  const n = 32;
  mask = new DataTexture(markMask(n), n, n, RGBAFormat, UnsignedByteType);
  mask.magFilter = LinearFilter;
  mask.minFilter = LinearFilter;
  mask.needsUpdate = true;
  return mask;
}

/** Ecken (x, Höhe, y) und Masken-Koordinaten einer weichen Marke, in der Reihenfolge der Fläche (`softMark`) */
export function softCorners(x: number, y: number, w: number, d: number, h: number) {
  const s = softMark(x, y, w, d);
  const [u0, u1] = s.u;
  const [v0, v1] = s.v;
  return {
    pos: [s.x, h, s.y, s.x, h, s.y + s.d, s.x + s.w, h, s.y, s.x + s.w, h, s.y + s.d],
    uv: [u0, v0, u0, v1, u1, v0, u1, v1],
  };
}

/** Mesh der Fußspuren einer 3D-Ansicht (je Plättchen eine Fläche nach oben); liest die Spuren `from` */
export function printLayer(from: Pick<Prints, 'seen' | 'rev'>): Layer & {
  object: Mesh;
  update(world: World): void; // braucht nur die Welt
  drawn: () => number;
} {
  const pos = new BufferAttribute(new Float32Array(MAX_MARKS * 12), 3);
  const rgba = new BufferAttribute(new Float32Array(MAX_MARKS * 16), 4);
  const uv = new BufferAttribute(new Float32Array(MAX_MARKS * 8), 2);
  const up = new Float32Array(MAX_MARKS * 12);
  const idx: number[] = [];
  for (let i = 0; i < MAX_MARKS; i++) {
    for (let k = 1; k < 12; k += 3) up[i * 12 + k] = 1;
    idx.push(4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 2, 4 * i + 1, 4 * i + 3);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', pos);
  geo.setAttribute('normal', new BufferAttribute(up, 3));
  geo.setAttribute('color', rgba);
  geo.setAttribute('uv', uv);
  geo.setIndex(idx);
  geo.setDrawRange(0, 0);
  const mesh = new Mesh(
    geo,
    new MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, map: softMask() }), // weicher Rand
  );
  mesh.frustumCulled = false; // die Plättchen wandern mit der Figur
  mesh.receiveShadow = true;
  let n = 0;
  let rev = NaN;
  const update = (world: World) => {
    if (from.rev === rev) return; // nichts Sichtbares hat sich geändert
    rev = from.rev;
    n = 0;
    for (const [p, a] of from.seen) {
      const h = world.cell(p.x, p.y).h + LIFT;
      for (const [x, y, w, d] of marks(p)) {
        if (n >= MAX_MARKS) break;
        const c = softCorners(x, y, w, d, h);
        (pos.array as Float32Array).set(c.pos, n * 12);
        (uv.array as Float32Array).set(c.uv, n * 8);
        for (let k = 0; k < 4; k++) rgba.setXYZW(n * 4 + k, PRINT.r, PRINT.g, PRINT.b, OPACITY * a);
        n++;
      }
    }
    geo.setDrawRange(0, n * 6);
    if (!n) return; // ohne Bereich lüde Three.js den ganzen Puffer hoch
    for (const [b, size] of [
      [pos, 12],
      [rgba, 16],
      [uv, 8],
    ] as const) {
      b.clearUpdateRanges();
      b.addUpdateRange(0, n * size); // nur den genutzten Teil hochladen
      b.needsUpdate = true;
    }
  };
  return { object: mesh, update, drawn: () => n };
}

/** Die Fußspuren des Spiels in 3D */
export const layer = printLayer(prints);
