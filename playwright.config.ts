// Smoke-Test im Browser (Guard-Gate nach dem Build): Die fertige Seite aus dist/ wird ausgeliefert und in Chromium
// geöffnet. Prüft, was statische Gates nicht sehen: dass Seiten und Spiel laufen, ohne Fehler in der Konsole.
// Einmalig lokal: npx playwright install chromium
import { defineConfig, devices } from '@playwright/test';

/** Specs, die das Spiel öffnen (Projekte `game` und `3d`) */
const GAME = /(smoke|a11y|pwa)\.spec\.ts$/;
/** Spec der App-Updates (Projekte `pwa-update` und `pwa-update-3d`) */
const UPDATE = /pwa-update\.spec\.ts$/;
/** Ohne WebGL: Das Spiel zeichnet in 2D */
const NO_WEBGL = ['--disable-3d-apis'];

export default defineConfig({
  testDir: 'e2e',
  // Zweite Fassung der Seite für den Test der App-Updates, abgeleitet aus dist/ (e2e/versions.ts)
  globalSetup: './e2e/versions.ts',
  fullyParallel: true,
  // Höchstens 2 Worker, auch lokal: Der GitHub-Runner hat 4 vCPUs, mehr Worker teilen sich dieselben Kerne. Fest statt
  // aus os.cpus(), denn Container melden alle Kerne des Wirts (18) statt ihrer Grenze, und im caige-Container stürzen
  // mehr Worker an der Prozessgrenze ab. So läuft lokal dieselbe Last wie in der Pipeline.
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // In der Pipeline braucht dieselbe Seite ein Vielfaches (Software-WebGL im Projekt `3d`, wenige Kerne). Diese Grenzen
  // gelten auch in `npm run gates:ci` (setzt CI=1), dort aber auf 2 CPUs statt der 4 des Runners – das ist der strenge
  // Lauf: Was dort knapp wird, reißt in der Pipeline als Nächstes. Der native Lauf (`npm run test:e2e`, Standard 5 s)
  // sagt über den Runner nichts, fängt aber grobe Rückschritte auf schneller Hardware.
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },
  // In der Pipeline zusätzlich JSON (wackelige Tests in die Zusammenfassung, scripts/flaky-summary.ts) und HTML
  // (als Artefakt hochgeladen, mit Traces der gescheiterten Versuche)
  reporter: process.env.CI
    ? [['github'], ['json', { outputFile: 'test-results/report.json' }], ['html', { open: 'never' }]]
    : 'list',
  use: { baseURL: 'http://localhost:4321', trace: 'retain-on-failure' },
  // Spiel-Tests (öffnen /) laufen mit Test-Uhr (e2e/helpers.ts) und standardmäßig in 2D: `--disable-3d-apis`
  // nimmt WebGL, das Spiel zeichnet wie ohne WebGL (Probe in larmic-mitwachsen.ts). Nur Tests mit Tag @3d, die das
  // Zeichnen in 3D prüfen, laufen zusätzlich im Projekt `3d` mit (Software-)WebGL, einzeln und in kleinerem Fenster
  projects: [
    // Seiten ohne Spiel: Startseite, Rechtliches, 404, Manifest, installierbar, Barrierefreiheit der Seiten
    { name: 'site', testMatch: /(site|installable)\.spec\.ts$/, use: { ...devices['Desktop Chrome'] } },
    { name: 'game', testMatch: GAME, use: { ...devices['Desktop Chrome'], launchOptions: { args: NO_WEBGL } } },
    {
      name: '3d',
      testMatch: GAME,
      grep: /@3d/,
      workers: 1,
      use: { ...devices['Desktop Chrome'], viewport: { width: 960, height: 540 } },
    },
    // App-Updates mit zwei Fassungen, teils zwei Tabs je Test: einzeln, in 2D (es geht um den Service Worker). Tests mit
    // Tag @3d zusätzlich mit (Software-)WebGL: Die neu geladene Seite holt ihre neue 3D-Datei, der alte Tab zeichnet weiter
    {
      name: 'pwa-update',
      testMatch: UPDATE,
      workers: 1,
      use: { ...devices['Desktop Chrome'], launchOptions: { args: NO_WEBGL } },
    },
    {
      name: 'pwa-update-3d',
      testMatch: UPDATE,
      grep: /@3d/,
      workers: 1,
      use: { ...devices['Desktop Chrome'], viewport: { width: 960, height: 540 } },
    },
  ],
  webServer: { command: 'node e2e/serve.ts', url: 'http://localhost:4321', reuseExistingServer: !process.env.CI },
});
