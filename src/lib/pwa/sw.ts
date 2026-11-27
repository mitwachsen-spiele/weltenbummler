// Der Service Worker, beim Build als Text erzeugt (kein Workbox). Die Entscheidungen stecken in reinen Funktionen,
// die hier getestet werden und wörtlich in den Service Worker kommen (`toString()`): Sie dürfen daher nichts
// importieren und nur auf ihre Parameter zugreifen.
//
// Strategie:
// – install: alle Dateien der Liste in einen Cache dieser Version laden (am HTTP-Cache vorbei). Von sich aus kein
//   skipWaiting: Eine neue Version wartet, bis keine Seite der alten mehr offen ist.
// – message „skip-waiting“: Nur das Spiel selbst bittet darum, und nur an einer sicheren Stelle (Gute Nacht, Rückkehr
//   nach langer Pause, src/scripts/games/pwa-update.ts). Dann wird die neue Version sofort aktiv, die bittende Seite
//   lädt neu – oder, hat das Kind die Figur inzwischen geweckt, erst beim nächsten sicheren Moment.
// – activate: Alte eigene Caches (Präfix) werden nur gelöscht, wenn keine Spielseite mehr offen ist – auch die
//   bittende zählt, denn sie lädt vielleicht erst später neu. Eine noch offene alte Seite (die bittende oder ein
//   zweiter Tab) holt ihre Dateien mit Hash im Namen – etwa ein spät per import() geladenes Three.js – sonst aus einem
//   Cache, den es nicht mehr gibt; auf dem Server sind sie dann schon weg. Was so stehen bleibt, räumt „tidy“ weg:
//   Jede Spielseite meldet sich nach dem Laden (auch die neu geladene bittende), und ist sie die einzige offene Seite
//   und dieser Service Worker der neueste, gehen die alten Caches. clients.claim() übernimmt Seiten
//   ohne Service Worker, etwa beim allerersten Besuch.
// – fetch: nur GET auf der eigenen Seite. Dateien der Liste kommen aus dem Cache (sonst aus dem Netz), ein Aufruf der
//   Spielseite selbst bekommt ihr gespeichertes HTML – so startet das Spiel auch ohne Netz. Andere Pfade der eigenen
//   Seite sucht er in älteren eigenen Caches (für alte, noch offene Seiten), sonst gehen sie unverändert ins Netz und
//   werden nicht gespeichert. Fremde Adressen gehen immer unverändert ins Netz.

/** Schlüssel im Cache für eine Anfrage, oder `null`: dann kümmert sich der Service Worker nicht darum */
export function cacheKey(url: string, method: string, origin: string, files: string[], scope: string): string | null {
  if (method !== 'GET') return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.origin !== origin) return null;
  const path = u.pathname === scope + 'index.html' ? scope : u.pathname;
  return files.indexOf(path) >= 0 ? path : null;
}

/** Pfad einer Anfrage, die vielleicht in einem älteren eigenen Cache liegt: GET auf der eigenen Seite, sonst `null` */
export function olderKey(url: string, method: string, origin: string): string | null {
  if (method !== 'GET') return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  return u.origin === origin ? u.pathname : null;
}

/** Eigene Caches (Präfix) außer dem aktuellen, älteste zuerst. Fremde Caches derselben Seite bleiben unberührt */
export function olderCaches(keys: string[], prefix: string, current: string): string[] {
  return keys.filter((k) => k.indexOf(prefix) === 0 && k !== current);
}

/**
 * Caches, die weg können: alle älteren eigenen – aber nur, wenn außer `leaving` keine Seite mehr offen ist (`windows`:
 * Kennungen der offenen Seiten, `leaving`: die Seite, die sich gerade meldet, beim Aktivieren keine). Sonst keiner.
 */
export function staleCaches(
  keys: string[],
  prefix: string,
  current: string,
  windows: string[],
  leaving: string | null,
): string[] {
  for (const id of windows) if (id !== leaving) return [];
  return olderCaches(keys, prefix, current);
}

export type ServiceWorkerOptions = {
  version: string; // ändert sich mit jedem Inhalt (cacheVersion)
  files: string[]; // was vorab gespeichert wird
  scope: string; // z. B. "/"
  prefix: string; // Präfix der eigenen Caches, z. B. "mitwachsen-"
};

/** Quelltext des Service Workers */
export function serviceWorkerSource({ version, files, scope, prefix }: ServiceWorkerOptions): string {
  return `// Service Worker des Spiels – beim Build erzeugt (src/lib/pwa/sw.ts), nicht von Hand ändern.
'use strict';
const PREFIX = ${JSON.stringify(prefix)};
const CACHE = PREFIX + ${JSON.stringify(version)};
const SCOPE = ${JSON.stringify(scope)};
const FILES = ${JSON.stringify(files, null, 2)};
const cacheKey = ${cacheKey.toString()};
const olderKey = ${olderKey.toString()};
const olderCaches = ${olderCaches.toString()};
const staleCaches = ${staleCaches.toString()};

// Alte eigene Caches löschen, wenn außer „except“ keine Spielseite offen ist. Auch Seiten ohne Service Worker zählen:
// Eine Seite, die gerade erst aufgerufen wird, ist noch nicht dabei, eine alte, noch offene immer.
const tidy = (except) =>
  Promise.all([caches.keys(), self.clients.matchAll({ type: 'window', includeUncontrolled: true })]).then(
    ([keys, all]) => {
      const windows = all.filter((w) => new URL(w.url).pathname.indexOf(SCOPE) === 0).map((w) => w.id);
      return Promise.all(staleCaches(keys, PREFIX, CACHE, windows, except).map((k) => caches.delete(k)));
    },
  );

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))),
  );
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  const from = event.source && event.source.id ? event.source.id : null;
  if (type === 'skip-waiting') {
    event.waitUntil(self.skipWaiting());
  } else if (type === 'tidy' && from && !self.registration.waiting && !self.registration.installing) {
    event.waitUntil(tidy(from));
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(tidy(null).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const key = cacheKey(event.request.url, event.request.method, self.location.origin, FILES, SCOPE);
  if (key !== null) {
    event.respondWith(
      caches
        .open(CACHE)
        .then((cache) => cache.match(key))
        .then((hit) => hit || fetch(event.request)),
    );
    return;
  }
  const old = olderKey(event.request.url, event.request.method, self.location.origin);
  if (old === null) return;
  // Eine alte, noch offene Seite holt eine Datei, die es nur in ihrer Version gab: aus ihrem Cache, sonst aus dem Netz
  event.respondWith(
    caches
      .keys()
      .then((keys) =>
        olderCaches(keys, PREFIX, CACHE).reduce(
          (found, name) => found.then((hit) => hit || caches.open(name).then((c) => c.match(old))),
          Promise.resolve(undefined),
        ),
      )
      .then((hit) => hit || fetch(event.request)),
  );
});
`;
}
