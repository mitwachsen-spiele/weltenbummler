import { describe, expect, it } from 'vitest';
import { contactAlpha, contactFall, contactRadius } from '../../lib/games/shade';
import { CONTACT_LIFT, Contacts, contactQuads, placeHalos, softDisc } from './mitwachsen-fine-bodies-3d';

describe('Weicher Fleck unter Körpern in 3D', () => {
  it('ist ein weicher Kreis: Mitte voll, außen 0, über den Radius wie in 2D', () => {
    const n = 32;
    const d = softDisc(n);
    const alpha = (x: number, y: number) => d[(y * n + x) * 4 + 3]!;
    expect(alpha(15, 15)).toBeGreaterThan(240);
    expect(alpha(0, 0)).toBe(0);
    expect(alpha(0, 15)).toBeLessThan(20);
    expect(d[0]).toBe(255); // Farbe weiß, sie kommt je Ecke
    expect(alpha(23, 15) / 255).toBeCloseTo(contactFall(Math.hypot(23.5 / n - 0.5, 15.5 / n - 0.5) * 2), 2);
  });

  it('liegt knapp über dem Boden unter jedem Körper, kleiner und blasser beim Hüpfen', () => {
    const { pos, rgba, uv } = contactQuads(
      [
        { x: 2.5, y: 3.5, z: 1, hop: 0, foot: 0.3 },
        { x: 0.5, y: 0.5, z: 2, hop: 0.6, foot: 0.3 },
      ],
      false,
    );
    expect(pos).toHaveLength(2 * 6 * 3);
    expect(uv).toHaveLength(2 * 6 * 2);
    const r = contactRadius(0.3);
    const xs = pos.filter((_, i) => i % 3 === 0).slice(0, 6);
    expect(Math.min(...xs)).toBeCloseTo(2.5 - r);
    expect(Math.max(...xs)).toBeCloseTo(2.5 + r);
    expect(pos[1]).toBeCloseTo(1 + CONTACT_LIFT);
    expect(rgba[3]).toBeCloseTo(contactAlpha(0));
    const hopX = pos.filter((_, i) => i % 3 === 0).slice(6);
    expect(Math.max(...hopX) - 0.5).toBeCloseTo(contactRadius(0.3, 0.6));
    expect(rgba[6 * 4 + 3]).toBeCloseTo(contactAlpha(0.6));
  });

  it('füllt ein Netz je Bild, ohne neue Puffer, und zeigt nichts ohne Körper', () => {
    const c = new Contacts();
    const geo = c.mesh.geometry;
    const before = geo.attributes.position;
    c.update([{ x: 0, y: 0, z: 1, hop: 0, foot: 0.3 }], false);
    expect(geo.drawRange.count).toBe(6);
    expect(c.mesh.visible).toBe(true);
    expect(geo.attributes.position).toBe(before);
    expect(c.mesh.castShadow).toBe(false);
    c.update([], false);
    expect(c.mesh.visible).toBe(false);
    c.update(
      Array.from({ length: 200 }, () => ({ x: 0, y: 0, z: 1, hop: 0, foot: 0.3 })),
      true,
    );
    expect(geo.drawRange.count).toBe(96 * 6); // höchstens 96 Körper
    c.dispose();
  });
});

describe('Leuchten an Modellen', () => {
  it('dreht und vergrößert mit dem Körper (Blick nach Osten = ohne Drehung)', () => {
    const halos = [{ x: 0.3, y: 0.1, z: 0.5, size: 0.2, color: '#ffe08a' }];
    const [east] = placeHalos(halos, { x: 5, y: 7, z: 1 }, 0, 1, 'player');
    expect(east).toMatchObject({ id: 'player#0', x: 5.3, y: 7.1, z: 1.5, size: 0.2, color: '#ffe08a' });
    const [south] = placeHalos(halos, { x: 5, y: 7, z: 1 }, -Math.PI / 2, 2, 'a');
    // Blick nach Süden (+y, zur Kamera): vorn liegt dann bei +y, rechts bei −x
    expect(south!.x).toBeCloseTo(5 - 0.2);
    expect(south!.y).toBeCloseTo(7 + 0.6);
    expect(south!.z).toBeCloseTo(2);
    expect(south!.size).toBeCloseTo(0.4);
  });
});
