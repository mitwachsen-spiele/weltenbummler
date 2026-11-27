// App-Updates mit zwei echten Fassungen der Seite: Fassung 1 ist der Build (dist/), Fassung 2 leitet e2e/versions.ts
// daraus ab (neues Three.js unter neuem Namen, neuer Service Worker). Mit dem Cookie `mw-version=2` geht für einen
// Browser-Kontext Fassung 2 „live“ (e2e/serve.ts). Spec: docs/specs/mitwachsen.md („App“, „Updates an sicheren Stellen“).
// Im Projekt `pwa-update` in 2D (es geht um den Service Worker); Tests mit Tag @3d laufen dazu im Projekt
// `pwa-update-3d` mit WebGL: Dort holt die neu geladene Seite ihre neue 3D-Datei über den Service Worker und zeichnet
// mit ihr, und der alte Tab zeichnet mit seinem alten Three.js weiter.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseServiceWorker } from '../scripts/pwa.ts';
import { SLEEP_LOCK } from '../src/scripts/games/mitwachsen-state.ts';
import { RITUAL_MS } from '../src/scripts/games/pwa-update.ts';
import { expectView, hasWebGL, openGame, reloadGame, render, settled, watchErrors } from './helpers.ts';
import { CHUNK, VERSIONS } from './versions-dirs.ts';

// Diese Tests warten echte Abläufe ab (Laden zweier Fassungen, Installation, Schlaflied nach echter Uhr, Neuladen, teils
// zwei Tabs): In `gates:ci` (2 CPUs, in 2D, einzeln im Projekt `pwa-update`) brauchte der längste 20 s, zwei Drittel der
// üblichen 30 s – zu knapp für die Pipeline, wo parallel ein zweiter Test läuft. Die Grenze gilt nur gegen Hänger
test.describe.configure({ timeout: 60_000 });

/** Cache-Name und 3D-Datei (Pfad, Größe) einer Fassung, aus ihrem Service Worker gelesen */
function version(n: '1' | '2') {
  const dir = VERSIONS[n]!;
  const sw = parseServiceWorker(readFileSync(join(dir, 'sw.js'), 'utf8'));
  const chunk = sw?.files.find((f) => CHUNK.test(f));
  if (!sw || !chunk) throw new Error(`Fassung ${n}: Service Worker ohne 3D-Datei`);
  return { cache: sw.cache, chunk, chunkBytes: statSync(join(dir, chunk)).size };
}

type GameEl = { state: { sleeping: boolean }; apply(cmd: { type: string }): void };

/** Was `probe` in der Seite mitschreibt */
type Probe = { mwAsked: number; mwChanged: boolean; mwLeaving: boolean };

/**
 * Vor dem ersten Skript der Seite: zählt beendete Fragen nach einer neuen Version (`update()`, jeder Auslöser in
 * pwa-register.ts fragt), merkt einen Wechsel des Service Workers (vor dem Spiel angemeldet, also vor dessen Entscheidung)
 * und ob die Seite geht (`beforeunload` kommt noch im Aufruf von `location.reload()`). So prüfen die Tests „lädt nicht neu“
 * an dem Punkt, an dem die Seite entschieden hat, statt eine Weile zu warten
 */
function probe() {
  const w = window as unknown as Probe;
  Object.assign(w, { mwAsked: 0, mwChanged: false, mwLeaving: false });
  const proto = ServiceWorkerRegistration.prototype;
  const update = Object.getOwnPropertyDescriptor(proto, 'update')!.value as (
    this: ServiceWorkerRegistration,
  ) => Promise<unknown>;
  proto.update = function (this: ServiceWorkerRegistration) {
    const asked = update.call(this);
    const done = () => void w.mwAsked++;
    asked.then(done, done);
    return asked;
  } as ServiceWorkerRegistration['update'];
  navigator.serviceWorker.addEventListener('controllerchange', () => (w.mwChanged = true));
  addEventListener('beforeunload', () => (w.mwLeaving = true));
}
const asked = (page: Page) => page.evaluate(() => (window as unknown as Probe).mwAsked);
/** Dieselbe Seite wie beim Öffnen, und sie ist nicht im Gehen */
const stays = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as Probe & { mwSame?: boolean };
    return w.mwSame === true && !w.mwLeaving;
  });

/**
 * Spiel öffnen, bis es steht (Tasten kommen an), Hinweis schließen, warten, bis der Service Worker die Seite steuert.
 * `firstTime: false`: zweiter Tab, der Hinweis ist schon gesehen. `clock: true`: mit Test-Uhr (`openGame`), für einen
 * Tab, dessen Entscheidungen nicht an der Uhr hängen: Takt und Bildschleife ruhen, Bilder zeichnet der Test
 */
async function openApp(page: Page, firstTime = true, clock = false) {
  await page.addInitScript(probe);
  const game = await openGame(page, { info: firstTime, clock });
  await page.evaluate(() => ((window as unknown as { mwSame: boolean }).mwSame = true));
  // Angemeldet wird erst nach dem Laden (samt 3D); auf langsamen Runnern dauert das
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null), { timeout: 30_000 })
    .toMatch(/\/sw\.js$/);
  const sleeping = () => game.evaluate((el) => (el as unknown as GameEl).state.sleeping);
  let loads = 0;
  page.on('load', () => loads++);
  return { game, sleeping, loads: () => loads };
}

/** Fassung 2 geht für diesen Browser-Kontext live */
const goLive = (context: BrowserContext) =>
  context.addCookies([{ name: 'mw-version', value: '2', url: 'http://localhost:4321' }]);
const cacheNames = (page: Page) => page.evaluate(() => caches.keys());
const registration = (page: Page) =>
  page.evaluate(() =>
    navigator.serviceWorker.getRegistration('/').then((r) => ({
      waiting: r?.waiting?.state ?? null,
      active: r?.active?.state ?? null,
    })),
  );
/** Wie der Browser von sich aus: nach einer neuen Version fragen */
const askForUpdate = (page: Page) =>
  page.evaluate(() => navigator.serviceWorker.getRegistration('/').then((r) => r?.update().then(() => undefined)));
/** Größe einer Datei, wie die Seite sie bekommt (über den Service Worker), sonst minus Status */
const fetchBytes = (page: Page, url: string) =>
  page.evaluate(
    (u) => fetch(u, { cache: 'no-store' }).then((r) => (r.ok ? r.arrayBuffer().then((b) => b.byteLength) : -r.status)),
    url,
  );
/**
 * Die Ansicht passt zum Projekt (`expectView`); mit WebGL hat die Seite die 3D-Datei `chunk` geladen (bei einem Update:
 * die ihrer Fassung, über den Service Worker) und zeichnet mit ihr (Three.js zählt die Bilder; mit Test-Uhr zeichnet der
 * Test zwei, sonst die Bildschleife der Seite)
 */
async function drawsWith(page: Page, chunk: string) {
  if (!(await expectView(page))) return;
  const loaded = () =>
    page.evaluate(() => performance.getEntriesByType('resource').map((e) => new URL(e.name).pathname));
  await expect.poll(loaded).toContain(`/${chunk.replace(/^\//, '')}`);
  const frame = () =>
    page
      .locator('larmic-mitwachsen')
      .evaluate(
        (el) =>
          (el as unknown as { gl3d: { renderer: { info: { render: { frame: number } } } } }).gl3d.renderer.info.render
            .frame,
      );
  const before = await frame();
  if (await page.evaluate(() => '__MW_TEST' in window)) await render(page, 2);
  await expect.poll(frame).toBeGreaterThan(before);
}

/** Seite lange verborgen, dann wieder sichtbar (Uhr eine halbe Stunde vor) */
const longPause = (page: Page) =>
  page.evaluate(() => {
    let state = 'hidden';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    document.dispatchEvent(new Event('visibilitychange'));
    const real = Date.now.bind(Date);
    Date.now = () => real() + 31 * 60_000;
    state = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
  });

test('Zwei Fassungen: die offene alte Seite läuft weiter, die neue wartet und gilt ab dem nächsten Start', async ({
  page,
  context,
}) => {
  const [v1, v2] = [version('1'), version('2')];
  expect(v2.cache).not.toBe(v1.cache);
  expect(v2.chunk).not.toBe(v1.chunk);
  const errors = watchErrors(page);
  // (a) Fassung 1 steuert die Seite
  const a = await openApp(page);
  await expect.poll(() => cacheNames(page)).toEqual([v1.cache]);
  await page.evaluate(() => {
    (window as unknown as { first: unknown }).first = navigator.serviceWorker.controller;
  });
  // (b) Fassung 2 geht live: Die alte 3D-Datei gibt es auf dem Server nicht mehr
  await goLive(context);
  expect((await page.request.get(v1.chunk)).status()).toBe(404);
  await askForUpdate(page);
  // (c) Fassung 2 ist geladen und wartet, Fassung 1 bleibt aktiv und steuert die Seite
  await expect.poll(() => registration(page)).toEqual({ waiting: 'installed', active: 'activated' });
  expect(
    await page.evaluate(() => navigator.serviceWorker.controller === (window as unknown as { first: unknown }).first),
  ).toBe(true);
  expect((await cacheNames(page)).sort()).toEqual([v1.cache, v2.cache].sort());
  // Die alte Seite spielt weiter, und auch ohne Netz bekommt sie ihr altes Three.js
  await page.keyboard.press('ArrowDown');
  await expect.poll(a.sleeping).toBe(false);
  await context.setOffline(true);
  expect(await fetchBytes(page, v1.chunk)).toBe(v1.chunkBytes);
  await context.setOffline(false);
  expect(a.loads()).toBe(0);
  expect(errors).toEqual([]);
  // (d) Alle Spielseiten zu, neu öffnen: Fassung 2 ist aktiv, der alte Cache ist weg
  await page.close();
  const next = await context.newPage();
  const nextErrors = watchErrors(next);
  await openApp(next, false);
  await expect.poll(() => registration(next)).toEqual({ waiting: null, active: 'activated' });
  await expect.poll(() => cacheNames(next)).toEqual([v2.cache]);
  expect(await fetchBytes(next, v2.chunk)).toBe(v2.chunkBytes);
  expect(nextErrors).toEqual([]);
});

test(
  'App-Update: nach dem Gute-Nacht-Ritual kommt die wartende Fassung, einmal neu geladen, das Spiel schläft weiter',
  { tag: '@3d' },
  async ({ page, context }) => {
    const [v1, v2] = [version('1'), version('2')];
    const errors = watchErrors(page);
    const { game, sleeping, loads } = await openApp(page);
    await drawsWith(page, v1.chunk);
    await page.keyboard.press('ArrowDown');
    await expect.poll(sleeping).toBe(false);
    await goLive(context);
    await askForUpdate(page);
    await expect.poll(() => registration(page)).toEqual({ waiting: 'installed', active: 'activated' });
    expect(loads()).toBe(0); // eine wartende Fassung allein lädt nichts neu
    // Ins Bett (wie Hineinlaufen): Schlaflied, Nacht, gespeichert – danach übernimmt das Spiel die wartende Fassung
    await game.evaluate((el) => (el as unknown as GameEl).apply({ type: 'action' }));
    await expect.poll(sleeping).toBe(true);
    await expect.poll(loads, { timeout: 30_000 }).toBe(1);
    await settled(page); // die neu geladene Seite
    await drawsWith(page, v2.chunk); // mit WebGL: mit der neuen 3D-Datei
    expect(await sleeping()).toBe(true);
    await expect(page.locator('dialog.mw-info')).not.toHaveAttribute('open');
    // Fassung 2 aktiv, alter Cache weg (keine andere Spielseite offen)
    await expect.poll(() => registration(page)).toEqual({ waiting: null, active: 'activated' });
    await expect.poll(() => cacheNames(page)).toEqual([v2.cache]);
    // Kein zweites Neuladen: Die neu geladene Seite hat gefragt (Auslöser „neu geladen“), keine Fassung wartet mehr
    await page.evaluate(() => ((window as unknown as { mwSame: boolean }).mwSame = true));
    await expect.poll(() => asked(page)).toBeGreaterThan(0);
    expect(await registration(page)).toEqual({ waiting: null, active: 'activated' });
    expect(await stays(page)).toBe(true);
    expect(loads()).toBe(1);
    expect(await sleeping()).toBe(true);
    expect(errors).toEqual([]);
  },
);

test('App-Update: weckt das Kind die Figur zwischen Bitte und Übernahme, wird erst beim nächsten Schlafen neu geladen', async ({
  page,
  context,
}) => {
  // Die Bitte um skipWaiting wird angehalten, bis der Test sie freigibt: So weckt das Kind die Figur sicher genau
  // zwischen Bitte und Übernahme, auch wenn der Rechner langsam ist
  await page.addInitScript(() => {
    const post = Object.getOwnPropertyDescriptor(ServiceWorker.prototype, 'postMessage')!.value as (
      this: ServiceWorker,
      ...args: unknown[]
    ) => void;
    const w = window as unknown as { skipAsked?: boolean; releaseSkip?: () => void };
    ServiceWorker.prototype.postMessage = function (this: ServiceWorker, ...args: unknown[]) {
      if ((args[0] as { type?: string } | null)?.type !== 'skip-waiting') return post.apply(this, args);
      w.skipAsked = true;
      w.releaseSkip = () => post.apply(this, args);
    } as ServiceWorker['postMessage'];
  });
  const [v1, v2] = [version('1'), version('2')];
  const errors = watchErrors(page);
  const { game, sleeping, loads } = await openApp(page);
  await page.keyboard.press('ArrowDown');
  await expect.poll(sleeping).toBe(false);
  await goLive(context);
  await askForUpdate(page);
  await expect.poll(() => registration(page)).toEqual({ waiting: 'installed', active: 'activated' });
  await game.evaluate((el) => (el as unknown as GameEl).apply({ type: 'action' }));
  await expect.poll(sleeping).toBe(true);
  // Nach dem Ritual: Bitte, das Kind weckt die Figur, dann übernimmt Fassung 2 – aber die Seite lädt nicht neu
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { skipAsked?: boolean }).skipAsked === true), {
      timeout: 30_000,
    })
    .toBe(true);
  // Kurz nach dem Einschlafen weckt Drücken noch nicht (SLEEP_LOCK zählt Spiel-Takte, die auf langsamen Rechnern
  // weit länger dauern als 100 ms): die Takte der Sperre gleich hier abspielen, dann weckt ein Druck sicher
  await game.evaluate((el, lock) => {
    const g = el as unknown as GameEl & { state: { tick: number; sleptAt: number } };
    while (g.state.tick - g.state.sleptAt < lock) g.apply({ type: 'tick' });
  }, SLEEP_LOCK);
  await page.keyboard.press('ArrowDown');
  await expect.poll(sleeping).toBe(false);
  await page.evaluate(() => (window as unknown as { releaseSkip: () => void }).releaseSkip());
  await expect.poll(() => registration(page)).toEqual({ waiting: null, active: 'activated' });
  // Die Seite hat den Wechsel gesehen und entschieden: nicht neu laden, die Figur ist wach
  await expect.poll(() => page.evaluate(() => (window as unknown as Probe).mwChanged)).toBe(true);
  expect(await stays(page)).toBe(true);
  expect(loads()).toBe(0);
  expect(await sleeping()).toBe(false);
  // Die Seite läuft noch mit Fassung 1: Ihr alter Cache bleibt, ihr altes Three.js kommt auch ohne Netz
  expect((await cacheNames(page)).sort()).toEqual([v1.cache, v2.cache].sort());
  await context.setOffline(true);
  expect(await fetchBytes(page, v1.chunk)).toBe(v1.chunkBytes);
  await context.setOffline(false);
  // Wieder ins Bett: nach dem Ritual einmal neu geladen, in die Nacht
  await game.evaluate((el) => (el as unknown as GameEl).apply({ type: 'action' }));
  await expect.poll(sleeping).toBe(true);
  await expect.poll(loads, { timeout: 30_000 }).toBe(1);
  await settled(page); // die neu geladene Seite
  expect(await sleeping()).toBe(true);
  await expect.poll(() => cacheNames(page)).toEqual([v2.cache]);
  // Kein zweites Neuladen: Die neu geladene Seite hat gefragt, keine Fassung wartet mehr
  await page.evaluate(() => ((window as unknown as { mwSame: boolean }).mwSame = true));
  await expect.poll(() => asked(page)).toBeGreaterThan(0);
  expect(await registration(page)).toEqual({ waiting: null, active: 'activated' });
  expect(await stays(page)).toBe(true);
  expect(loads()).toBe(1);
  expect(errors).toEqual([]);
});

test('App-Update: zurück nach langer Pause, das Spiel schläft noch – die neue Fassung kommt', async ({
  page,
  context,
}) => {
  const v2 = version('2');
  const errors = watchErrors(page);
  const { sleeping, loads } = await openApp(page);
  await goLive(context);
  // Die Figur schläft seit dem Öffnen der Welt: für das Spiel schon unendlich lange (`updateMoment` in larmic-mitwachsen.ts)
  await longPause(page);
  await expect.poll(loads, { timeout: 30_000 }).toBe(1);
  expect(await sleeping()).toBe(true);
  await expect.poll(() => cacheNames(page)).toEqual([v2.cache]);
  expect(errors).toEqual([]);
});

test('App-Update: neu laden von Hand (Cmd+R, Strg+R, F5) bringt die wartende Fassung, das Spiel schläft', async ({
  page,
  context,
}) => {
  const v2 = version('2');
  const errors = watchErrors(page);
  const { sleeping, loads } = await openApp(page);
  await page.keyboard.press('ArrowDown'); // gespielt …
  await expect.poll(sleeping).toBe(false);
  await goLive(context);
  await askForUpdate(page);
  await expect.poll(() => registration(page)).toEqual({ waiting: 'installed', active: 'activated' });
  await page.reload(); // … dann von Hand neu geladen: Die Seite übernimmt die wartende Fassung und lädt einmal neu
  await expect.poll(loads, { timeout: 30_000 }).toBe(2);
  await expect.poll(() => registration(page), { timeout: 30_000 }).toEqual({ waiting: null, active: 'activated' });
  await expect.poll(() => cacheNames(page)).toEqual([v2.cache]);
  await settled(page);
  expect(await sleeping()).toBe(true);
  expect(errors).toEqual([]);
});

test('App-Update: mitten im Spiel wird nie neu geladen, die neue Fassung wartet', async ({ page, context }) => {
  const errors = watchErrors(page);
  const { sleeping, loads } = await openApp(page);
  await page.keyboard.press('ArrowDown');
  await expect.poll(sleeping).toBe(false);
  await goLive(context);
  await askForUpdate(page);
  await expect.poll(() => registration(page)).toEqual({ waiting: 'installed', active: 'activated' });
  // Auslöser wie beim Einschlafen und nach langer Pause – aber die Figur ist wach. Beide fragen nach einer neuen Fassung
  // und entscheiden dann; der Auslöser „Einschlafen“ erst nach dem Schlaflied (RITUAL_MS, echte Uhr in pwa-register.ts)
  const before = await asked(page);
  await page.evaluate(() => document.dispatchEvent(new Event('mitwachsen-sleep')));
  await longPause(page);
  await expect.poll(() => asked(page), { timeout: RITUAL_MS + 5_000 }).toBeGreaterThanOrEqual(before + 2);
  expect(await stays(page)).toBe(true);
  expect(loads()).toBe(0);
  expect(await sleeping()).toBe(false);
  expect(await registration(page)).toEqual({ waiting: 'installed', active: 'activated' });
  expect(errors).toEqual([]);
});

test(
  'App-Update: ein zweiter, alter Tab spielt ungestört weiter und bekommt sein altes Three.js bis zuletzt',
  { tag: '@3d' },
  async ({ page, context }) => {
    const [v1, v2] = [version('1'), version('2')];
    const errors = watchErrors(page);
    const a = await openApp(page);
    // Mit WebGL der zweite Tab mit Test-Uhr: Zwei Bildschleifen mit Software-WebGL teilten sich die Kerne, und das
    // Schlaflied im ersten Tab läuft nach echter Uhr. Ob er neu lädt, entscheidet er nach seinem Zustand (wach), nicht
    // nach der Uhr; in 2D läuft er live
    const other = await context.newPage();
    const otherErrors = watchErrors(other);
    const b = await openApp(other, false, await hasWebGL(other));
    await drawsWith(other, v1.chunk);
    await other.keyboard.press('ArrowDown');
    await expect.poll(b.sleeping).toBe(false);
    await page.keyboard.press('ArrowDown');
    await expect.poll(a.sleeping).toBe(false);
    await goLive(context);
    await a.game.evaluate((el) => (el as unknown as GameEl).apply({ type: 'action' }));
    await expect.poll(a.loads, { timeout: 30_000 }).toBe(1);
    // Der Tab, der schlafen ging, hat die neue Fassung (mit WebGL samt neuer 3D-Datei); der andere spielt weiter und lädt
    // nicht neu, mit WebGL zeichnet er mit seinem alten Three.js weiter (Fehler sammelt der Test)
    await settled(page);
    await drawsWith(page, v2.chunk);
    expect(b.loads()).toBe(0);
    expect(await b.sleeping()).toBe(false);
    await drawsWith(other, v1.chunk);
    // Der alte Cache bleibt, solange der andere Tab offen ist: Er holt sein altes Three.js auch ohne Netz,
    // obwohl Fassung 2 ihn jetzt steuert und der Server die Datei nicht mehr hat
    expect((await cacheNames(page)).sort()).toEqual([v1.cache, v2.cache].sort());
    await context.setOffline(true);
    expect(await fetchBytes(other, v1.chunk)).toBe(v1.chunkBytes);
    await context.setOffline(false);
    // … und geht, sobald eine Spielseite allein offen ist und sich meldet
    await other.close();
    await reloadGame(page);
    await expect.poll(() => cacheNames(page)).toEqual([v2.cache]);
    expect([...errors, ...otherErrors]).toEqual([]);
  },
);
