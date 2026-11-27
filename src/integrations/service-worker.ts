// Astro-Integration: schreibt nach dem Build den Service Worker des Spiels (dist/sw.js). Was er vorab
// speichert, wird aus der fertigen Seite gesammelt (src/lib/pwa/precache.ts), damit keine Datei mit Hash im Namen
// fehlt – auch nicht das nachträglich geladene Three.js. Fehlt eine Datei, auf die die Seite verweist, bricht der
// Build ab. Geprüft wird das Ergebnis zusätzlich von npm run verify:pwa.
import type { AstroIntegration } from 'astro';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { cacheVersion, distFile, precacheList, type ReadFile } from '../lib/pwa/precache';
import { serviceWorkerSource } from '../lib/pwa/sw';
import { SERVICE_WORKER } from '../data/pwa';
import { SITE } from '../data/site';

/**
 * Sammelt in einer fertigen Seite (Ordner `root`), was das Spiel braucht, und schreibt den Service Worker dazu.
 * Auch vom Browser-Test genutzt (e2e/versions.ts), um aus dem Build eine zweite Fassung abzuleiten.
 */
export function writeServiceWorker(root: string): { files: string[]; version: string } {
  const read: ReadFile = (path) => {
    try {
      return readFileSync(join(root, path));
    } catch {
      return null;
    }
  };
  const { files, missing } = precacheList(SERVICE_WORKER.entry, read, SITE.url, [SERVICE_WORKER.url]);
  if (missing.length) throw new Error(`Service Worker: Dateien fehlen in ${root}: ${missing.join(', ')}`);
  const version = cacheVersion(files, read);
  const source = serviceWorkerSource({
    version,
    files,
    scope: SERVICE_WORKER.scope,
    prefix: SERVICE_WORKER.prefix,
  });
  writeFileSync(join(root, distFile(SERVICE_WORKER.url)), source);
  return { files, version };
}

export default function serviceWorker(): AstroIntegration {
  return {
    name: 'mitwachsen-service-worker',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const { files, version } = writeServiceWorker(fileURLToPath(dir));
        logger.info(`${SERVICE_WORKER.url}: ${files.length} Dateien vorab gespeichert, Version ${version}`);
      },
    },
  };
}
