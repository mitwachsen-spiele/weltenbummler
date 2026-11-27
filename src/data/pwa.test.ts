import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CUBE_H, CUBE_W, STEP_Y } from '../lib/voxel/cube';
import { APP, APP_ICONS, ICON_FILL, SERVICE_WORKER, SKY_1, SKY_2 } from './pwa';

const token = (name: string) =>
  readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8').match(
    new RegExp(`--${name}:\\s*(#[0-9a-f]+)`, 'i'),
  )?.[1];

describe('Das Spiel als App', () => {
  it('nimmt die Himmelsfarben aus tokens.css', () => {
    expect(SKY_1).toBe(token('sky-1'));
    expect(SKY_2).toBe(token('sky-2'));
  });

  it('startet im Spiel; der Service Worker steuert nur das Spiel', () => {
    expect(APP.startUrl).toBe(SERVICE_WORKER.entry);
    expect(APP.startUrl.startsWith(APP.scope)).toBe(true);
    expect(SERVICE_WORKER.url.startsWith(SERVICE_WORKER.scope)).toBe(true);
    expect(SERVICE_WORKER.scope).toBe('/');
  });

  it('hat Icons in 192 und 512, auch mit Maske; deren Würfel bleibt in der sicheren Zone', () => {
    for (const purpose of ['any', 'maskable'] as const)
      expect(APP_ICONS.filter((i) => i.purpose === purpose).map((i) => i.size)).toEqual([192, 512]);
    // Der Würfel (CUBE_W × CUBE_H) füllt die Höhe; am weitesten vom Mittelpunkt liegen die Seitenecken der Raute.
    // Sicher ist ein Kreis mit 40 % der Kantenlänge als Radius.
    const corner = Math.hypot(CUBE_W / 2, CUBE_H / 2 - STEP_Y) / CUBE_H;
    expect(ICON_FILL.maskable * corner).toBeLessThanOrEqual(0.4);
  });
});
