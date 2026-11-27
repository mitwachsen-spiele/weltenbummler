// Messung (kein Gate): Hält die 3D-Ansicht mit, wenn der Zug fährt? Konzept „Gleisbauer und Höhlen-Welt“, Schritt 6:
// 3D bei 8 Feldern je Sekunde, sonst 6. Öffnet die fertige Seite (dist/, vorher `npm run build`) in Chromium mit WebGL
// (ohne Grafikkarte: Software-WebGL wie in der Pipeline), lässt den Zug per Entwickler-Schalter (`?entwickler=bahn&bau=1`,
// Seed 1) live vom Bahnhof Bär bis zum Prellbock fahren, je Lauf mit festem Tempo (`ride.speed`, Felder je Takt), und
// misst dabei: Abstand der Bilder (requestAnimationFrame, mit GPU), Zeit in `render` und beim Bauen der Stücke
// (`World3D.stats` in mitwachsen-3d.ts) und Bilder mit Loch (ein Stück um das Ziel fehlt noch). Dazu ein Lauf im Stand.
// Aufruf: `node scripts/measure-ride.ts` (mit `taskset -c 0,1` auf 2 CPUs wie gates:ci). Ergebnis als Tabelle;
// die Zahlen stehen in der Spec (Abschnitt „Tok und die Bahn“, Messen).
import { spawn } from 'node:child_process';
import { chromium, type Page } from '@playwright/test';

const PORT = 4339;
const BASE = `http://localhost:${PORT}`;
/** Tempo je Lauf in Feldern je Sekunde (0: im Stand, so lange wie die Fahrt bei 6) */
const SPEEDS = (process.env.SPEEDS ?? '0,6,8,10').split(',').map(Number);

type Stats = {
  frames: number;
  ms: number;
  maxMs: number;
  built: number;
  buildMs: number;
  maxBuildMs: number;
  holes: number;
};
type El = {
  state: {
    player: { x: number; y: number; dir: string };
    animals: unknown[];
    ride?: { speed: number; pos: number; phase: string };
  };
  world: { cell(x: number, y: number): { stop?: string } };
  rides: { id: string; x: number; y: number }[];
  gl3d: { stats: Stats } | null;
  r3d: unknown;
  apply(cmd: { type: 'move'; dir: string; fresh?: boolean }): void;
};

/** Eigene Bildschleife der Messung im Fenster */
type Probe = { __gaps: number[]; __stop: boolean; __until: number };

async function waitServer() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      /* noch nicht da */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Server kommt nicht');
}

/** Ein Lauf: einsteigen, Tempo setzen, bis zur Ankunft fahren (bzw. im Stand warten), Messwerte */
async function run(page: Page, speed: number, stillMs: number) {
  await page.goto(`${BASE}/?entwickler=bahn&bau=1`);
  await page.waitForSelector('larmic-mitwachsen.settled.three', { timeout: 60_000 });
  const ok = page.getByRole('button', { name: /Verstanden/ });
  if (await ok.isVisible()) await ok.click();
  const game = page.locator('larmic-mitwachsen');
  await game.evaluate((node) => (node as unknown as El).apply({ type: 'move', dir: 's' })); // aufwachen
  await page.waitForFunction(() => {
    const el = document.querySelector('larmic-mitwachsen') as unknown as El;
    return el.rides.some((r) => r.id === 'ride:hoehle:mid');
  });
  await game.evaluate(
    (node, [v, ms]) => {
      const el = node as unknown as El;
      const mid = el.rides.find((r) => r.id === 'ride:hoehle:mid')!;
      const [mx, my] = [Math.round(mid.x), Math.round(mid.y)];
      const dirs: [string, number, number][] = [
        ['e', 1, 0],
        ['w', -1, 0],
        ['s', 0, 1],
        ['n', 0, -1],
      ];
      const [dir, dx, dy] = dirs.find(([, dx, dy]) => el.world.cell(mx - dx, my - dy).stop === 'hoehle')!;
      el.state = { ...el.state, animals: [], player: { x: mx - dx, y: my - dy, dir: 's' } };
      if (v) el.apply({ type: 'move', dir, fresh: true });
      const ride = el.state.ride;
      if (ride) el.state = { ...el.state, ride: { ...ride, speed: v / 10 } }; // Felder je Takt (0,1 s)
      Object.assign(el.gl3d!.stats, { frames: 0, ms: 0, maxMs: 0, built: 0, buildMs: 0, maxBuildMs: 0, holes: 0 });
      // Abstand der Bilder samt GPU: eigene Bildschleife neben der des Spiels
      const w = window as unknown as Probe;
      w.__gaps = [];
      w.__stop = false;
      w.__until = v ? Infinity : performance.now() + ms;
      let last = performance.now();
      const loop = (t: number) => {
        w.__gaps.push(t - last);
        last = t;
        if (!w.__stop) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },
    [speed, stillMs] as const,
  );
  const t0 = Date.now();
  // warten auf einen Zustand: die Figur ist ausgestiegen (im Stand: die Zeit ist um)
  await page.waitForFunction(
    () => {
      const el = document.querySelector('larmic-mitwachsen') as unknown as El;
      const w = window as unknown as Probe;
      return w.__until === Infinity ? !el.state.ride : performance.now() >= w.__until;
    },
    undefined,
    { timeout: 120_000, polling: 200 },
  );
  const secs = (Date.now() - t0) / 1000;
  return game.evaluate((node, s) => {
    const el = node as unknown as El;
    const w = window as unknown as Probe;
    w.__stop = true;
    const gaps = w.__gaps.slice(2).sort((a, b) => a - b);
    const q = (p: number) => gaps[Math.min(gaps.length - 1, Math.floor(p * gaps.length))] ?? 0;
    const st = el.gl3d!.stats;
    return {
      s: +s.toFixed(1),
      fps: +(gaps.length / s).toFixed(1),
      p50: +q(0.5).toFixed(1),
      p95: +q(0.95).toFixed(1),
      max: +(gaps.at(-1) ?? 0).toFixed(1),
      over50: gaps.filter((g) => g > 50).length,
      renderMs: +(st.ms / Math.max(1, st.frames)).toFixed(2),
      maxRenderMs: +st.maxMs.toFixed(1),
      built: st.built,
      buildMsPerChunk: +(st.buildMs / Math.max(1, st.built)).toFixed(1),
      maxBuildMs: +st.maxBuildMs.toFixed(1),
      holes: st.holes,
    };
  }, secs);
}

const server = spawn(process.execPath, ['e2e/serve.ts'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});
try {
  await waitServer();
  const browser = await chromium.launch();
  const rows: Record<string, unknown>[] = [];
  for (const v of SPEEDS) {
    const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    // Seed 1 (wie der Browser-Test des Zugs): die erste neue Welt bekommt den Seed aus crypto.getRandomValues
    await ctx.addInitScript(() => {
      const real = crypto.getRandomValues.bind(crypto);
      const fixed = (a: ArrayBufferView<ArrayBuffer>) =>
        a instanceof Uint32Array && a.length === 1 ? a.fill(1) : real(a);
      Object.defineProperty(crypto, 'getRandomValues', { value: fixed });
    });
    const page = await ctx.newPage();
    rows.push({ tempo: v ? `${v} Felder/s` : 'Stand', ...(await run(page, v, 12_000)) });
    await ctx.close();
  }
  await browser.close();
  console.table(rows);
} finally {
  server.kill();
}
