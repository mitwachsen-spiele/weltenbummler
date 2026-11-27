// Gemeinsame Helfer der Browser-Tests: Spiel öffnen und neu laden, bis es steht (`settled`), Fehler der Seite sammeln,
// Test-Uhr (Takte und Bilder auf Zuruf). Nie auf Uhrzeit oder eine Zahl von Bildern warten, sondern auf einen Zustand:
// Die Pipeline zeichnet ohne Grafikkarte, dort dauert alles ein Vielfaches.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * So lange darf das Spiel zum Stehen brauchen: Laden samt Three.js und erstem 3D-Bild, in der Pipeline und in
 * `gates:ci` (CI=1) per Software-WebGL auf wenigen Kernen und parallel zu einem zweiten Test. Nativ reichen 10 s:
 * Braucht das Laden dort länger, ist es selbst langsamer geworden und soll auffallen, statt in 30 s unterzugehen
 */
const SETTLE_MS = process.env.CI ? 30_000 : 10_000;
/** Ein Takt der Regeln (`TICK_MS` in larmic-mitwachsen.ts) */
const TICK_MS = 100;
/** Ein Bild der Test-Uhr: so lang wie der längste Schritt, den Gleiten und Drehung je Bild machen (höchstens 0,05 s) */
export const FRAME_MS = 50;

/** Sammelt Fehler der Seite; am Ende des Tests muss die Liste leer sein */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** Verstöße gegen WCAG 2.2 A/AA laut axe-core: je Verstoß Regel, Wirkung und betroffene Elemente */
export async function violations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return result.violations.map(
    (v) => `${v.impact}: ${v.id} – ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`,
  );
}

/**
 * Warten, bis das Spiel steht (`settled` an der Komponente): Welt offen, Tasten und Klicks kommen an, die endgültige
 * Ansicht (3D, ohne WebGL 2D) ist da. Davor kann ein Druck verloren gehen
 */
export const settled = (page: Page) =>
  expect(page.locator('larmic-mitwachsen')).toHaveClass(/\bsettled\b/, { timeout: SETTLE_MS });

/** Hat der Browser WebGL (Projekte `3d` und `pwa-update-3d`)? Geht auf jeder Seite, auch vor dem ersten Aufruf */
export const hasWebGL = (page: Page) => page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));

/**
 * Die Ansicht passt zum Projekt: mit WebGL (Projekt `3d`) zeichnet die 3D-Ansicht (Klasse `three`), ohne WebGL (Projekt
 * `game`) die 2D-Ansicht. Liefert, ob WebGL da ist. Für Tests mit Tag @3d, damit ihr Lauf im Projekt `3d` sicher in 3D
 * zeichnet und nicht still in 2D
 */
export async function expectView(page: Page) {
  const webgl = await hasWebGL(page);
  const game = page.locator('larmic-mitwachsen');
  if (webgl) await expect(game).toHaveClass(/\bthree\b/);
  else await expect(game).not.toHaveClass(/\bthree\b/);
  return webgl;
}

/**
 * 3D: Bilder der Test-Uhr, bis der 3D-Teil des Welt-Pakets `id` geladen und eingebaut ist (`look` der 3D-Ansicht kennt
 * sein Tor). Ohne 3D-Ansicht (2D) gibt es nichts zu warten
 */
export const view3d = (page: Page, id: string) =>
  expect
    .poll(async () => {
      await render(page);
      return page
        .locator('larmic-mitwachsen')
        .evaluate(
          (node, gate) =>
            !(node as unknown as { r3d: unknown }).r3d ||
            !!(node as unknown as { gl3d: { views: { look(gate: string): unknown } } }).gl3d.views.look(gate),
          id,
        );
    })
    .toBe(true);

/**
 * Die Spielseite aufrufen, ohne zu warten. Nur für Tests, die das Laden selbst prüfen (ohne JavaScript, ohne Netz, der
 * Hinweis für Eltern beim ersten Mal); sonst `openGame`
 */
export const gotoGame = (page: Page, dev?: string) => page.goto(dev ? `/?entwickler=${dev}` : '/');

/**
 * Test-Uhr der Seite, vor ihrem ersten Skript: `performance.now()` – die eine Uhr des Spiels für Takt, Tasten und Bild –
 * steht, bis `ticks` oder `render` sie vorstellen; mit `__MW_TEST` ruhen Takt und Bildschleife des Spiels
 * (larmic-mitwachsen.ts). So läuft im Test genau das, was er abspielt, egal wie schnell der Rechner zeichnet
 */
function installClock() {
  const clock = { ms: 0 };
  const t0 = performance.now();
  (window as unknown as { __MW_TEST: typeof clock }).__MW_TEST = clock;
  performance.now = () => t0 + clock.ms;
}

/**
 * Spiel öffnen, bis es steht, und den Hinweis für Eltern schließen. `info: false`: Er kommt nicht (schon gesehen,
 * etwa im zweiten Tab desselben Kontexts). `clock: true`: mit Test-Uhr (`ticks`, `render`), ein Bild ist gezeichnet.
 * `dev`: mit dem Entwickler-Schalter in diese Welt blicken (`?entwickler=<welt>`, mitwachsen-dev.ts)
 */
export async function openGame(page: Page, { info = true, clock = false, dev = '' } = {}) {
  if (clock) await page.addInitScript(installClock);
  await gotoGame(page, dev);
  await settled(page);
  if (info) await page.getByRole('button', { name: /Verstanden/ }).click();
  if (clock) await render(page);
  return page.locator('larmic-mitwachsen');
}

/** Seite neu laden und warten, bis das Spiel wieder steht (der Hinweis kommt nicht wieder); mit Test-Uhr ein Bild */
export async function reloadGame(page: Page) {
  await page.reload();
  await settled(page);
  if (await page.evaluate(() => '__MW_TEST' in window)) await render(page);
}

/** Was die Test-Uhr an der Komponente nutzt: ihre eigenen Wege für Takt und Bild */
type Clocked = {
  apply(cmd: { type: 'tick'; held: unknown }): void;
  frame(t: number): void;
  pace: { held(): unknown };
  state: { player: { x: number; y: number } };
  bodies: Map<string, { x: number; y: number }>;
};

/** Test-Uhr: `n` Takte der Regeln, wie der Takt der Seite sie gäbe (die Uhr geht je Takt 0,1 s vor), ohne Bild */
export const ticks = (page: Page, n: number) =>
  page.locator('larmic-mitwachsen').evaluate(
    (node, [count, ms]) => {
      const el = node as unknown as Clocked;
      const clock = (window as unknown as { __MW_TEST: { ms: number } }).__MW_TEST;
      for (let i = 0; i < count; i++) {
        clock.ms += ms;
        el.apply({ type: 'tick', held: el.pace.held() });
      }
    },
    [n, TICK_MS] as const,
  );

/**
 * Test-Uhr: `n` Bilder, je `ms` später (sonst `FRAME_MS`), ohne Takt der Regeln (wie bei offenem Menü); was nur im Bild
 * läuft (Gleiten, Drehung, Postkarte, Nachladen von Bild und Ton), läuft mit. Größere Abstände für das, was nur nach der
 * Uhr fragt (etwa wie lange die Figur auf einer Torplatte steht): Gleiten und Drehung gehen je Bild höchstens 0,05 s
 */
export const render = (page: Page, n = 1, ms = FRAME_MS) =>
  page.locator('larmic-mitwachsen').evaluate(
    (node, [count, gap]) => {
      const el = node as unknown as Clocked;
      const clock = (window as unknown as { __MW_TEST: { ms: number } }).__MW_TEST;
      for (let i = 0; i < count; i++) {
        clock.ms += gap;
        el.frame(performance.now());
      }
    },
    [n, ms] as const,
  );

/**
 * Test-Uhr: Bilder, je `FRAME_MS` später, bis der Körper der Figur auf ihrem Feld steht (kurze Wege gleitet er, je Bild
 * höchstens 0,05 s weit; weite springen), höchstens 3 s. Liefert, ob er angekommen ist
 */
export const arrive = (page: Page) =>
  page.locator('larmic-mitwachsen').evaluate((node, ms) => {
    const el = node as unknown as Clocked;
    const clock = (window as unknown as { __MW_TEST: { ms: number } }).__MW_TEST;
    const there = () => {
      const body = el.bodies.get('player');
      return !!body && body.x === el.state.player.x && body.y === el.state.player.y;
    };
    for (let i = 0; i < 3000 / ms && !there(); i++) {
      clock.ms += ms;
      el.frame(performance.now());
    }
    return there();
  }, FRAME_MS);

/**
 * Test-Uhr: `ms` lang wie die Seite selbst, Takt und Bild verzahnt: je `FRAME_MS` ein Bild, je Takt (0,1 s) davor ein
 * Takt der Regeln. Für das, was beides braucht (die Drehung zur Torfront zählt die Stehzeit der Regeln und dreht im Bild)
 */
export const play = (page: Page, ms: number) =>
  page.locator('larmic-mitwachsen').evaluate(
    (node, [total, frame, tick]) => {
      const el = node as unknown as Clocked;
      const clock = (window as unknown as { __MW_TEST: { ms: number } }).__MW_TEST;
      for (let t = frame; t <= total; t += frame) {
        clock.ms += frame;
        if (t % tick === 0) el.apply({ type: 'tick', held: el.pace.held() });
        el.frame(performance.now());
      }
    },
    [ms, FRAME_MS, TICK_MS] as const,
  );

/**
 * 3D: Nur jedes `n`-te Bild auf dem Schirm wirklich an WebGL geben (`n = 1`: wieder jedes). Software-WebGL braucht in
 * der Pipeline je Bild 80–150 ms, auch in kleinem Fenster (die Ecken der Welt und die Schattenkarte kosten), und die
 * Seite holt das beim nächsten Aufruf nach. Kamera, Drehung, Sonne, Schattenziel und Regeln laufen in jedem Bild weiter,
 * es fällt nur der letzte Aufruf weg (`renderer.render` am Ende von `render` in mitwachsen-3d.ts); Bilder in ein Ziel
 * (Postkarte) bleiben. Für Tests, die viele Bilder abspielen und den Zustand prüfen, nicht die Pixel
 */
export const drawEvery = (page: Page, n: number) =>
  page.locator('larmic-mitwachsen').evaluate((node, every) => {
    type Draw = (...args: unknown[]) => void;
    type Renderer = { render: Draw; getRenderTarget(): unknown; mwDraw?: Draw };
    const r = (node as unknown as { gl3d: { renderer: Renderer } }).gl3d.renderer;
    const draw = (r.mwDraw ??= r.render.bind(r));
    let i = 0;
    r.render =
      every === 1
        ? draw
        : (...args) => {
            if (r.getRenderTarget() !== null || i++ % every === 0) draw(...args);
          };
  }, n);

/**
 * Menü für Eltern über das Zahnrad öffnen. Offen heißt gefüllt: Das Spiel füllt das nachgeladene Menü erst und zeigt es
 * dann (`openMenu` in larmic-mitwachsen.ts)
 */
export async function openMenu(page: Page) {
  await page.getByRole('button', { name: 'Menü für Eltern' }).click();
  const menu = page.locator('dialog.mw-settings');
  await expect(menu).toHaveJSProperty('open', true);
  return menu;
}
