// Das Spiel als App: installierbar laut Chromium selbst (DevTools-Protokoll). Eigene Datei, weil `channel` für die
// ganze Datei gilt (eigener Worker). Spec: docs/specs/mitwachsen.md („App“).
import { expect, test, type Page } from '@playwright/test';
import { gotoGame } from './helpers';

type Manifest = { display: string; icons: { src: string }[] };

// Keine Einwände, Manifest ohne Fehler. Nur das volle Chromium prüft wirklich (die schlanke Headless-Shell meldet immer eine leere Liste), darum
// `channel: 'chromium'`. Playwright-Kontexte sind privat: Den Einwand 'in-incognito' gibt es dort immer.
test.use({ channel: 'chromium' });

type Installability = { installabilityErrors: { errorId: string }[] };
const objections = async (page: Page) => {
  await page.waitForLoadState('load');
  const cdp = await page.context().newCDPSession(page);
  const manifest = (await cdp.send('Page.getAppManifest')) as { url: string; errors: { message: string }[] };
  const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as Installability;
  const ids = installabilityErrors.map((e) => e.errorId).filter((id) => id !== 'in-incognito');
  return { manifest, ids };
};

test('Das Spiel ist für Chromium installierbar', async ({ page }) => {
  await gotoGame(page);
  const { manifest, ids } = await objections(page);
  expect(new URL(manifest.url).pathname).toBe('/manifest.webmanifest');
  expect(manifest.errors).toEqual([]);
  expect(ids).toEqual([]);
});

// Gegenproben: Die Prüfung sieht wirklich etwas
test('Gegenprobe: ohne Manifest und mit einem untauglichen Manifest meldet Chromium Einwände', async ({ page }) => {
  await page.route('**/ohne-manifest/', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>x</title><p>x</p>' }),
  );
  await page.goto('/ohne-manifest/');
  expect((await objections(page)).ids).toContain('no-manifest');
  await page.route('**/manifest.webmanifest', async (r) => {
    const res = await r.fetch();
    const json = (await res.json()) as Manifest;
    await r.fulfill({ response: res, json: { ...json, display: 'browser', icons: [] } });
  });
  await gotoGame(page);
  const { ids } = await objections(page);
  expect(ids).toEqual(expect.arrayContaining(['manifest-display-not-supported', 'manifest-missing-suitable-icon']));
});
