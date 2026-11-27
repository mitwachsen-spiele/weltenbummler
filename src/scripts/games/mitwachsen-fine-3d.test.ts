import { describe, expect, it } from 'vitest';
import { LinearMipmapLinearFilter, MeshBasicMaterial, MeshLambertMaterial, SRGBColorSpace } from 'three';
import { SKINS, skinPixels } from '../../lib/games/skins';
import { SKIN_GUTTER, SKIN_PX, composeShader, shaderKey, skinAtlasPixels, skinTexture } from './mitwachsen-fine-3d';

describe('Muster der feinen Dinge in 3D', () => {
  it('legt jede Kachel mit Rand in den Atlas: innen das Muster, im Rand gekachelt weiter', () => {
    const { data, width, height } = skinAtlasPixels();
    const cell = SKIN_PX + 2 * SKIN_GUTTER;
    expect(width).toBe(4 * cell);
    expect(height).toBe(Math.ceil(SKINS.length / 4) * cell);
    const px = (x: number, y: number) => [...data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)];
    for (const [i, skin] of SKINS.entries()) {
      const tile = skinPixels(skin, SKIN_PX);
      const at = (x: number, y: number) => [...tile.subarray((y * SKIN_PX + x) * 4, (y * SKIN_PX + x) * 4 + 4)];
      const ox = (i % 4) * cell,
        oy = Math.floor(i / 4) * cell;
      expect(px(ox + SKIN_GUTTER, oy + SKIN_GUTTER)).toEqual(at(0, 0)); // Ecke der Kachel
      expect(px(ox + SKIN_GUTTER + 17, oy + SKIN_GUTTER + 40)).toEqual(at(17, 40));
      expect(px(ox, oy)).toEqual(at(SKIN_PX - SKIN_GUTTER, SKIN_PX - SKIN_GUTTER)); // Rand: von der anderen Seite
      expect(px(ox + cell - 1, oy + cell - 1)).toEqual(at(SKIN_GUTTER - 1, SKIN_GUTTER - 1));
    }
  });

  it('wird zur Textur mit Mipmaps (in der Ferne kein Flimmern), weich gefiltert, in sRGB', () => {
    const tex = skinTexture();
    expect(tex.generateMipmaps).toBe(true);
    expect(tex.minFilter).toBe(LinearMipmapLinearFilter);
    expect(tex.colorSpace).toBe(SRGBColorSpace);
    expect(tex.image.width).toBe(4 * (SKIN_PX + 2 * SKIN_GUTTER));
    tex.dispose();
  });
});

describe('Shader-Zusatz der 3D-Ansicht', () => {
  /** Shader mit den Stellen, an denen der Zusatz ansetzt (wie MeshLambertMaterial) */
  const shader = () => ({
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: 'void main() {\n#include <begin_vertex>\n}',
    fragmentShader:
      'void main() {\n#include <clipping_planes_fragment>\n#include <color_fragment>\n#include <tonemapping_fragment>\n}',
  });
  const compile = (c: Parameters<typeof composeShader>[3], skin = true) => {
    const m = new MeshLambertMaterial();
    const tex = skin ? skinTexture() : null;
    composeShader(m, { mwTime: { value: 0 } }, tex, c);
    const s = shader();
    m.onBeforeCompile(s as never, undefined as never);
    return { s, key: m.customProgramCacheKey(), tex };
  };

  it('hat je Zusammensetzung einen eigenen Schlüssel, sonst teilten sich Materialien ein falsches Programm', () => {
    const keys = [
      { fog: true },
      { fog: true, see: true },
      { fog: true, sway: true },
      { fog: true, fine: true },
      { fine: true },
      { fog: true, see: true, fine: true },
    ].map(shaderKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(shaderKey({ fog: true })).toBe('mw-fog'); // die alten Schlüssel bleiben
    expect(shaderKey({ fog: true, see: true })).toBe('mw-fog-see');
    expect(shaderKey({ fog: true, sway: true })).toBe('mw-fog-sway');
  });

  it('setzt Nebel, Durchblick und Feinheit in einen Zusatz zusammen', () => {
    const { s, key, tex } = compile({ fog: true, see: true, fine: true });
    expect(key).toBe('mw-fog-see-fine');
    expect(s.uniforms.mwSkin?.value).toBe(tex);
    expect(s.uniforms.mwTime).toBeDefined();
    expect(s.vertexShader).toContain('attribute vec4 aFine');
    expect(s.vertexShader).toContain('vMwSkin = aSkin');
    expect(s.fragmentShader).toContain('textureGrad(mwSkin'); // Muster
    expect(s.fragmentShader).toContain('fwidth'); // helle Kante, etwa ein Pixel breit
    expect(s.fragmentShader).toContain('discard'); // Durchblick
    expect(s.fragmentShader).toContain('mwSeen'); // Nebel
    // Muster nach den Vertex-Farben (die Farbe des Teils), vor dem Licht
    expect(s.fragmentShader.indexOf('textureGrad')).toBeGreaterThan(s.fragmentShader.indexOf('<color_fragment>'));
  });

  it('lässt weg, was ein Material nicht braucht', () => {
    const fog = compile({ fog: true }).s;
    expect(fog.fragmentShader).not.toContain('mwSkin');
    expect(fog.fragmentShader).not.toContain('discard');
    expect(fog.vertexShader).not.toContain('aFine');
    const sway = compile({ fog: true, sway: true }).s;
    expect(sway.vertexShader).toContain('mwWind');
    const entity = compile({ fine: true });
    expect(entity.key).toBe('mw-fine');
    expect(entity.s.fragmentShader).not.toContain('mwSeen'); // Wesen ohne Nebel-Maske (wie bisher)
    const noSkin = compile({ fog: true, fine: true }, false);
    expect(noSkin.key).toBe('mw-fog'); // ohne Textur kein feiner Zweig
    expect(noSkin.s.fragmentShader).not.toContain('mwSkin');
  });

  it('gilt für Lambert und Basic gleich', () => {
    const m = new MeshBasicMaterial();
    composeShader(m, {}, skinTexture(), { fog: true, fine: true });
    expect(m.customProgramCacheKey()).toBe('mw-fog-fine');
  });
});
