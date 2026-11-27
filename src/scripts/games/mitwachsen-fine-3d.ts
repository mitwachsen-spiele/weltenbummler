// Feine Dinge in der 3D-Ansicht (Entwurf „Feine Grafik“): Muster der Oberflächen als eine Textur (`skinTexture`) und
// ein Shader-Zusatz für alle Materialien der Welt (`composeShader`): Nebel, Durchblick vor der Figur, Wind und – für
// feine Dinge – Muster und helle Oberkante. Seitenverlauf und Leuchten-Lage schreibt `Geo.box` (mitwachsen-geo.ts).
// Gelände bleibt Block: Seine Flächen tragen keine Feinheit, der Zusatz lässt sie unberührt. Gehört zur 3D-Ansicht und
// wird nur mit ihr nachgeladen (Three.js).
// Spezifikation: docs/specs/mitwachsen.md (Feinheit)

import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  type IUniform,
  type MeshBasicMaterial,
  type MeshLambertMaterial,
} from 'three';
import { SKINS, skinPixels } from '../../lib/games/skins';

/** Pixel einer Kachel im Atlas */
export const SKIN_PX = 64;
/** Rand um jede Kachel (mit dem Muster weitergeführt), damit beim Verkleinern (Mipmaps) keine Nachbarkachel blutet */
export const SKIN_GUTTER = 8;
const CELL = SKIN_PX + 2 * SKIN_GUTTER;
const COLS = 4;
const ROWS = Math.ceil(SKINS.length / COLS);

/**
 * Alle Muster als RGBA in einem Atlas mit Rand: Kachel `i` (Stelle in `SKINS`) liegt in Spalte i % 4, Zeile i / 4
 * (Zeile 0 zuerst), jede `SKIN_GUTTER` Pixel weit über ihren Rand hinaus gekachelt
 */
export function skinAtlasPixels(): { data: Uint8Array; width: number; height: number } {
  const width = COLS * CELL,
    height = ROWS * CELL;
  const data = new Uint8Array(width * height * 4);
  SKINS.forEach((skin, i) => {
    const tile = skinPixels(skin, SKIN_PX);
    const ox = (i % COLS) * CELL,
      oy = Math.floor(i / COLS) * CELL;
    for (let y = 0; y < CELL; y++)
      for (let x = 0; x < CELL; x++) {
        const sx = (x - SKIN_GUTTER + SKIN_PX) % SKIN_PX,
          sy = (y - SKIN_GUTTER + SKIN_PX) % SKIN_PX;
        const from = (sy * SKIN_PX + sx) * 4,
          to = ((oy + y) * width + ox + x) * 4;
        data.set(tile.subarray(from, from + 4), to);
      }
  });
  return { data, width, height };
}

/** Die Muster als Textur: weich gefiltert, mit Mipmaps (in der Ferne kein Flimmern), Farben in sRGB wie in 2D */
export function skinTexture(): DataTexture {
  const { data, width, height } = skinAtlasPixels();
  const tex = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Was ein Material zusammensetzt: Nebel-Maske, Durchblick vor der Figur (Laub), Wind (Grasbüschel), feine Dinge */
export type Compose = { fog?: boolean; see?: boolean; sway?: boolean; fine?: boolean };

/** Schlüssel des Shader-Programms: jede Zusammensetzung ihr eigenes, sonst teilten sich zwei Materialien ein falsches */
export const shaderKey = (c: Compose): string =>
  ['mw', c.fog && 'fog', c.see && 'see', c.sway && 'sway', c.fine && 'fine'].filter(Boolean).join('-');

const f = (v: number) => v.toFixed(1);

/** Muster und Kante im Fragment-Shader, nach den Vertex-Farben (die Farbe des Teils), vor dem Licht */
const FINE_FRAGMENT = `
  if (vMwSkin.x > 0.5) {
    float mwI = vMwSkin.x - 1.0;
    vec2 mwCell = vec2(mod(mwI, ${f(COLS)}), floor(mwI / ${f(COLS)}));
    vec2 mwT = vMwFine.xy * vMwSkin.z;
    vec2 mwSz = vec2(${f(COLS * CELL)}, ${f(ROWS * CELL)});
    vec2 mwUv = (mwCell * ${f(CELL)} + ${f(SKIN_GUTTER)} + fract(mwT) * ${f(SKIN_PX)}) / mwSz;
    vec2 mwDx = dFdx(mwT) * ${f(SKIN_PX)} / mwSz, mwDy = dFdy(mwT) * ${f(SKIN_PX)} / mwSz;
    float mwG = max(length(mwDx), length(mwDy)), mwLim = ${f(SKIN_GUTTER)} / mwSz.x;
    if (mwG > mwLim) { mwDx *= mwLim / mwG; mwDy *= mwLim / mwG; }
    vec4 mwS = textureGrad(mwSkin, mwUv, mwDx, mwDy);
    diffuseColor.rgb = mix(diffuseColor.rgb, mwS.rgb, mwS.a);
  }
  if (vMwSkin.y > 0.0) {
    vec2 mwQ = vMwFine.xy, mwW = vMwFine.zw;
    float mwE = min(min(mwQ.x, mwW.x - mwQ.x), min(mwQ.y, mwW.y - mwQ.y));
    float mwPx = max(fwidth(mwQ.x), fwidth(mwQ.y));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), vMwSkin.y * (1.0 - smoothstep(0.0, mwPx * 1.2, mwE)));
  }`;

/** Durchblick: nah an der Sichtlinie Kamera → Figur Pixel im 2 × 2-Muster weglassen, dazu das offene Dach */
const SEE_FRAGMENT = `
  vec3 mwDir = normalize(mwTarget - mwEye);
  float mwLen = distance(mwTarget, mwEye);
  float mwT = dot(vMwWorld - mwEye, mwDir);
  float mwD = distance(vMwWorld, mwEye + mwDir * mwT);
  float mwBayer = (mod(floor(gl_FragCoord.x), 2.0) * 2.0 + mod(floor(gl_FragCoord.y), 2.0)) / 4.0;
  if (mwT < mwLen - 0.8 && vMwWorld.y > mwTarget.y - 0.7) {
    float mwCut = 0.75 * smoothstep(1.7, 0.9, mwD);
    if (mwBayer < mwCut) discard;
  }
  if (distance(vMwWorld.xz, mwRoof.xy) < mwRoof.z && vMwWorld.y > mwTarget.y + 0.3) {
    float mwChk = mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0);
    if (mwRoof.w > 0.5 ? mwChk < 0.5 : (mwRoof.w > 0.0 && mwBayer < 0.25)) discard;
  }`;

/** Wind (nur Grasbüschel): Spitzen schwingen seitlich, der Fuß bleibt stehen (Höhe über dem Boden = fract(y)) */
const SWAY_VERTEX = `
  float mwUp = fract(transformed.y);
  transformed.x += sin(mwTime * 2.3 + transformed.x * 1.7 + transformed.z * 1.3) * mwWind * mwUp * 0.6;
  transformed.z += cos(mwTime * 1.9 + transformed.x * 1.1) * mwWind * mwUp * 0.25;`;

/** Nebel: Farbe nach der Beleuchtung je nach Nebel-Maske in die Himmelsfarbe mischen */
const FOG_FRAGMENT = `float mwSeen = texture2D(mwFogMap, (vMwWorld.xz - mwFogOrigin) / mwFogSize).r;
  gl_FragColor.rgb = mix(mwFogTint, gl_FragColor.rgb, smoothstep(0.08, 0.92, mwSeen));
`;

/**
 * Ein Shader-Zusatz je Material, aus Teilen zusammengesetzt (nie zwei `onBeforeCompile` hintereinander): `uniforms`
 * sind die gemeinsamen der Ansicht (Nebel-Maske, Kamera, Figur, Dach, Zeit, Wind), `skin` die Textur der Muster.
 * Ohne `fine` sieht ein Material aus wie bisher; mit `fine` tragen nur Flächen mit Feinheit (`aSkin`) Muster und Kante,
 * die übrigen (Gelände, Torhäuser) bekommen vom Browser 0 für das fehlende Merkmal und bleiben, wie sie sind.
 */
export function composeShader(
  material: MeshLambertMaterial | MeshBasicMaterial,
  uniforms: Record<string, IUniform>,
  skin: DataTexture | null,
  c: Compose,
) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    if (c.fine && skin) shader.uniforms.mwSkin = { value: skin };
    const fine = !!(c.fine && skin);
    shader.vertexShader =
      'varying vec3 vMwWorld;\nuniform float mwTime;\nuniform float mwWind;\n' +
      (fine ? 'attribute vec4 aFine;\nattribute vec3 aSkin;\nvarying vec4 vMwFine;\nvarying vec3 vMwSkin;\n' : '') +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>' +
          (c.sway ? SWAY_VERTEX : '') +
          (fine ? '\n  vMwFine = aFine;\n  vMwSkin = aSkin;' : '') +
          '\n  vMwWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    let frag = shader.fragmentShader;
    if (c.see)
      frag = frag.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>' + SEE_FRAGMENT);
    if (fine) frag = frag.replace('#include <color_fragment>', '#include <color_fragment>' + FINE_FRAGMENT);
    if (c.fog) frag = frag.replace('#include <tonemapping_fragment>', FOG_FRAGMENT + '#include <tonemapping_fragment>');
    shader.fragmentShader =
      'uniform sampler2D mwFogMap;\nuniform vec2 mwFogOrigin;\nuniform float mwFogSize;\nuniform vec3 mwFogTint;\n' +
      'uniform vec3 mwEye;\nuniform vec3 mwTarget;\nuniform vec4 mwRoof;\nvarying vec3 vMwWorld;\n' +
      (fine ? 'uniform sampler2D mwSkin;\nvarying vec4 vMwFine;\nvarying vec3 vMwSkin;\n' : '') +
      frag;
  };
  material.customProgramCacheKey = () => shaderKey({ ...c, fine: !!(c.fine && skin) });
}
