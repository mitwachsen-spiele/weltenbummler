// Das Spiel als App: Der Service Worker steuert nur das Spiel, und ohne Netz startet es trotzdem. Manifest: e2e/site.spec.ts,
// installierbar laut Chromium: e2e/installable.spec.ts, Updates: e2e/pwa-update.spec.ts. Spec: docs/specs/mitwachsen.md („App“).
// Mit Tag @3d: läuft im Projekt `game` in 2D und im Projekt `3d` mit WebGL, dort kommen auch Three.js und der 3D-Teil
// der Eis-Welt ohne Netz.
import { expect, test } from '@playwright/test';
import { gotoGame, reloadGame, watchErrors } from './helpers';

test(
  'Spiel: Service Worker steuert die ganze Adresse, ohne Netz startet das Spiel trotzdem, samt Eis-Welt und ihrem 3D-Teil',
  { tag: '@3d' },
  async ({ page, context }) => {
    const errors = watchErrors(page);
    // Hinweis für Eltern schon gesehen: Bis zum Neuladen ohne Netz drückt und klickt der Test nichts im Spiel, darum reicht
    // dort `ready` (Spielstand da), ohne auf das erste 3D-Bild zu warten; zwei Ladevorgänge passen so in die 30 s
    await page.addInitScript(() => localStorage.setItem('larmic.games.mitwachsen.info', '1'));
    await gotoGame(page);
    const game = page.locator('larmic-mitwachsen');
    await expect(game).toHaveClass(/ready/);
    // Bereit heißt: alles gespeichert (install) und aktiv; clients.claim() übernimmt die offene Seite
    const reg = await page.evaluate(() =>
      navigator.serviceWorker.ready.then((r) => ({ scope: r.scope, updateViaCache: r.updateViaCache })),
    );
    expect(new URL(reg.scope).pathname).toBe('/');
    // Die Frage nach einer neuen Version geht am HTTP-Cache vorbei, nie 'all'
    expect(['none', 'imports']).toContain(reg.updateViaCache);
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null))
      .toMatch(/\/sw\.js$/);
    const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
    // Spielstand mit offenem Eistor: Beim nächsten Start braucht die Welt das Paket der Eis-Welt gleich
    await game.evaluate((node) => {
      const el = node as unknown as { state: { openGates: string[] }; save(): void };
      el.state = { ...el.state, openGates: ['eis'] };
      el.save();
    });

    await context.setOffline(true);
    const fromSw: string[] = [];
    page.on('response', (r) => {
      if (r.fromServiceWorker()) fromSw.push(new URL(r.url()).pathname);
    });
    await reloadGame(page);
    // Auch das nachträglich geladene Three.js kommt ohne Netz aus dem Speicher
    if (webgl) await expect(game).toHaveClass(/three/);
    expect(fromSw).toContain('/');
    // Auch das Welt-Paket der Eis-Welt (vorab gespeichert) kommt ohne Netz aus dem Speicher: Der Kessel steht samt Eis-Portal
    expect(
      fromSw.some((p) => /\/welt-eis\.[\w-]+\.js$/.test(p)),
      fromSw.join(', '),
    ).toBe(true);
    // Mit WebGL holt die 3D-Ansicht auch Three.js (eigene Datei) und den 3D-Teil der Eis-Welt (Iglu, Tür und Eiszapfen
    // des Eistors) ohne Netz aus dem Speicher, sobald das Paket an der Welt hängt
    if (webgl) {
      for (const file of [/\/three\.[\w-]+\.js$/, /\/welt-eis-3d\.[\w-]+\.js$/])
        await expect.poll(() => fromSw.some((p) => file.test(p)), `${file} aus dem Service Worker`).toBe(true);
      // … und baut ihn ein: Das Eistor hat seinen Schmuck aus dem 3D-Teil (Tür, Eiszapfen), nicht nur geholt
      const look = () =>
        game.evaluate((el) => {
          const gl3d = (el as unknown as { gl3d: { views: { look(g: string): unknown } } | null }).gl3d;
          return !!gl3d?.views.look('eis');
        });
      await expect.poll(look, 'Schmuck des Eistors aus dem 3D-Teil').toBe(true);
    } else test.info().annotations.push({ type: 'ohne WebGL', description: '3D-Teil offline nicht geprüft' });
    const portals = () =>
      game.evaluate((el) => [...(el as unknown as { world: { portals: Map<string, unknown> } }).world.portals.keys()]);
    expect(await portals()).toContain('eiskessel');
    const sleeping = () => game.evaluate((el) => (el as unknown as { state: { sleeping: boolean } }).state.sleeping);
    await page.keyboard.press('ArrowDown');
    await expect.poll(sleeping).toBe(false);
    await context.setOffline(false);
    expect(errors).toEqual([]);
  },
);
