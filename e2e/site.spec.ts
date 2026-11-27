// Was außer dem Spiel auf dieser Adresse liegt (Projekt `site` in playwright.config.ts): das Manifest der App, die
// 404-Seite und die Wege zur Homepage auf www.mitwachsen-spiele.de. Das Spiel selbst: e2e/smoke.spec.ts.
// Spec: docs/specs/mitwachsen.md („App“).
import { expect, test } from '@playwright/test';
import { gotoGame, violations, watchErrors } from './helpers';

type Manifest = { start_url: string; scope: string; display: string; orientation?: string; icons: { src: string }[] };

const HOME = 'https://www.mitwachsen-spiele.de/';

test('Das Spiel verweist auf ein gültiges Manifest, die App startet im Spiel an der Wurzel', async ({
  page,
  request,
}) => {
  await gotoGame(page);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/manifest.webmanifest');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /^#[0-9a-f]{6}$/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png');
  const res = await request.get(href!);
  expect(res.ok()).toBe(true);
  const manifest = (await res.json()) as Manifest;
  expect(manifest).toMatchObject({ start_url: '/', scope: '/', display: 'standalone' });
  expect(manifest.orientation).toBeUndefined();
  for (const icon of manifest.icons) {
    const img = await request.get(icon.src);
    expect(img.ok(), icon.src).toBe(true);
    expect(img.headers()['content-type']).toBe('image/png');
  }
});

test('Wege zur Homepage: Menü des Spiels und Datenschutz im Hinweis für Eltern zeigen auf www', async ({ page }) => {
  await gotoGame(page);
  await expect(page.locator('a.mw-link')).toHaveAttribute('href', HOME);
  await expect(page.locator('.mw-store a').first()).toHaveAttribute('href', `${HOME}datenschutz/`);
});

test('Unbekannte Adresse zeigt die 404-Seite, ohne Fehler, mit Weg zurück zum Spiel', async ({ page }) => {
  const errors = watchErrors(page);
  const res = await page.goto('/gibt-es-nicht/');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: /404/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Zurück zum Spiel?' })).toHaveAttribute('href', '/');
  const footer = page.locator('footer.site-footer');
  await expect(footer.getByRole('link', { name: 'Impressum und Kontakt' })).toHaveAttribute(
    'href',
    'https://larmic.de/impressum/',
  );
  await expect(footer.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', `${HOME}datenschutz/`);
  expect(errors).toEqual([]);
});

test.describe('ruhende Seiten', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('Barrierefrei: 404-Seite', async ({ page }) => {
    await page.goto('/gibt-es-nicht/');
    expect(await violations(page)).toEqual([]);
  });
});
