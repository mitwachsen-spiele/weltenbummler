// @ts-check
import { defineConfig } from 'astro/config';
import serviceWorker from './src/integrations/service-worker.ts';

// Welt-Pakete (src/scripts/games/worlds/<welt>/index.ts, per import() nachgeladen) heißen im Build
// _astro/welt-<welt>.<hash>.js, ihr 3D-Teil (worlds/<welt>/view-3d.ts, erst mit der 3D-Ansicht nachgeladen)
// _astro/welt-<welt>-3d.<hash>.js: So erkennt das Bundle-Gate sie (scripts/verify-bundles.ts). Three.js liegt in einer
// eigenen Datei _astro/three.<hash>.js, die die 3D-Ansicht und die 3D-Teile der Welten teilen. Alle anderen Dateien wie
// bei Astro (Name ohne unsichere Zeichen, dazu der Hash).
const WORLD_PACK = /\/scripts\/games\/worlds\/([a-z]+)\/(index|view-3d)\.ts$/;
const chunkFileNames = (/** @type {{ name: string; facadeModuleId: string | null }} */ chunk) => {
  const world = WORLD_PACK.exec(chunk.facadeModuleId ?? '');
  const name = world ? `welt-${world[1]}${world[2] === 'view-3d' ? '-3d' : ''}` : chunk.name.replace(/[^\w.\-/]/g, '_');
  return `_astro/${name}.[hash].js`;
};
const codeSplitting = { groups: [{ name: 'three', test: /[\\/]node_modules[\\/]three[\\/]/ }] };

export default defineConfig({
  site: 'https://weltenbummler.mitwachsen-spiele.de',
  trailingSlash: 'ignore',
  // Bilder (auch in Markdown) mit Breite/Höhe, lazy und in passenden Größen (srcset), höchstens so breit wie der Text
  image: { layout: 'constrained' },
  vite: { environments: { client: { build: { rolldownOptions: { output: { chunkFileNames, codeSplitting } } } } } },
  integrations: [
    // Service Worker des Spiels (dist/sw.js), nach dem Build aus der fertigen Seite erzeugt
    serviceWorker(),
  ],
});
