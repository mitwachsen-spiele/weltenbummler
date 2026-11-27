// Nur für Tests: alle Welt-Pakete und Welten mit ihnen, je Seed einmal gebaut (eine Welt ändert sich nie, die Tests
// teilen sie sich, so steigt die Laufzeit nicht). Das Spiel lädt die Pakete per import() (larmic-mitwachsen.ts).
// Dazu die Seeds der Eigenschafts-Tests: im normalen Lauf (npm test, pre-commit, Job coverage) nur wenige, die vollen
// Bereiche im tiefen Lauf (`npm run test:deep`, im Job static der Pipeline und in gates:ci). So bleibt der Hook vor
// jedem Commit schnell, und doch prüft jeder Pull Request und jeder Deploy alle Seeds.
// Achtung, Seiteneffekt beim Import: Er trägt die Modelle der Eis- und Höhlen-Tiere und von Tok in `SPECIES` ein (`addModels`, wie im
// Spiel beim Ankommen des Pakets). Ein Test, der diese Tiere zeichnet oder vermisst, importiert diesen Helfer, sonst sind ihre
// Modelle leer (geprüft in mitwachsen-packs.test.ts).

import { pack as eis } from './worlds/eis';
import { pack as hoehle } from './worlds/hoehle';
import { pack as bahn } from './worlds/bahn';
import { pack as fahrt } from './worlds/fahrt';
import { pack as grube } from './worlds/grube';
import { DIRS } from '../../lib/games/front';
import type { GateId } from '../../data/games/mitwachsen';
import { canStep, createWorld, type World } from './mitwachsen-world';
import { addModels } from './mitwachsen-packs';
import type { WorldPack } from './mitwachsen-pack-types';

addModels(eis.models, {}, {}, eis.outlines); // wie im Spiel, wenn das Paket ankommt: Modelle der Eis-Tiere samt Grundform
addModels(hoehle.models, hoehle.roosts, {}, hoehle.outlines); // und der Höhlen-Tiere samt der Fledermaus kopfüber und Grundform
addModels(bahn.models, {}, bahn.solos); // und Tok, der Gleisbauer (nach Bau 2 ohne den Maulwurf)
/** Die Pakete mit eigener Welt und die Fahr-Engine (die Bahn nicht, unten): Eis-Welt, Grotte und die Fahr-Engine */
export const PACKS = [eis, hoehle, fahrt] as const;
export const EIS_PACK = eis;
export const HOEHLE_PACK = hoehle;
/**
 * Das Paket der Fahrzeuge (die Fahr-Engine, `rules.ride`): ohne eigene Welt, es baut nichts; Tests der Fahrzeuge reichen
 * es mit dem Paket ihres Fahrzeugs an `step` (`[EIS_PACK, FAHRT_PACK]`), für `worldOf` brauchen sie es nicht
 */
export const FAHRT_PACK = fahrt;
/**
 * Das Paket der Bahn (Tok, Gleis auf Lichtung und Grotte, Zug): nicht in `PACKS`, damit Tests ohne Bahn ihre Welten und
 * Regeln ohne Tok bauen (im Spiel kommt es, sobald das Eistor offen ist); Tests der Bahn reichen es herein, mit einem
 * Ausbau (`worldOf(seed, [HOEHLE_PACK, BAHN_PACK], BUILT)`; ohne Ausbau legt es nichts)
 */
export const BAHN_PACK = bahn;
/**
 * Das Paket der Grubenbahn (Gleis und Bähnchen Funkel in der Grotte): nicht in `PACKS`; Tests der Grubenbahn reichen es
 * mit der Grotte herein, mit gegrabenem Gang (`worldOf(seed, [HOEHLE_PACK, GRUBE_PACK], DUG)`; ohne legt es nichts)
 */
export const GRUBE_PACK = grube;
/** Spielstand der Pakete mit gegrabenem Gang der Grubenbahn (`packs.fahrt.grube`, Stufe `bereit`), für `worldOf` */
export const DUG: Readonly<Record<string, unknown>> = { fahrt: { grube: { stage: 'bereit' } } };
/** Spielstand der Pakete mit ganz gebautem Gleis (`packs.bahn.built` 2), für `worldOf` */
export const BUILT: Readonly<Record<string, unknown>> = { bahn: { built: 2 } };

const worlds = new Map<string, World>();

/**
 * Die Welt unter `key` aus `cache`, sonst gebaut; zuletzt gebraucht ans Ende gestellt (die Reihenfolge der Map), damit
 * `forgetWorlds` die am längsten nicht gebrauchten zuerst vergisst
 */
function recent<K>(cache: Map<K, World>, key: K, make: () => World): World {
  const w = cache.get(key) ?? make();
  cache.delete(key);
  cache.set(key, w);
  return w;
}
/**
 * Die Welt eines Seeds mit den Paketen `packs`, je Seed und Paketen einmal gebaut. Ohne `packs` mit allen, wie im
 * Spiel (für Tests, die das Zusammenspiel prüfen); Tests einer Welt reichen nur ihr Paket herein, dann baut ein neues
 * Paket ihre Welten nicht mit; `saved`: Spielstand der Pakete, nach dem ein Paket ohne eigene Welt legt (`BUILT`)
 */
export function worldOf(
  seed: number,
  packs: readonly WorldPack[] = PACKS,
  saved: Readonly<Record<string, unknown>> = {},
): World {
  const key = `${seed}:${packs.map((p) => p.id).join(',')}:${JSON.stringify(saved)}`;
  return recent(worlds, key, () => createWorld(seed, packs, saved));
}

/** Tiefer Lauf (`MITWACHSEN_DEEP=1`, `npm run test:deep`): Eigenschafts-Tests über ihre vollen Seed-Bereiche */
export const DEEP = process.env.MITWACHSEN_DEEP === '1';
/** Wenige Seeds, die zeigen, wie die Welten meist sind: Über sie (und REGRESSION_SEEDS) laufen Eigenschafts-Tests sonst */
export const SAMPLE_SEEDS: readonly number[] = [1, 7, 42, 2026, 123456];
/**
 * Seeds, an denen ein Eigenschafts-Test im tiefen Lauf einmal scheiterte (die Meldung nennt den Seed): Nur anhängen, nie
 * streichen, auch wenn der Fehler behoben ist. Sie laufen in jedem Lauf mit, in jedem Eigenschafts-Test
 */
export const REGRESSION_SEEDS: readonly number[] = [11];

/** Die Seeds `from` bis `to` (beide eingeschlossen) */
export const seedRange = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/**
 * Seeds eines Eigenschafts-Tests: im tiefen Lauf alle aus `full`, sonst nur `quick` (sonst SAMPLE_SEEDS); immer dazu
 * REGRESSION_SEEDS, jeder Seed einmal
 */
export function seedsFor(full: readonly number[], quick: readonly number[] = SAMPLE_SEEDS): number[] {
  return [...new Set([...(DEEP ? full : quick), ...REGRESSION_SEEDS])];
}

/**
 * Seeds in Abschnitten zu je `size` (für `it.each`): Jeder Abschnitt ist ein eigener Test, so bleibt auch der tiefe Lauf
 * über tausende Seeds weit unter der Frist (vitest.config.ts). `label` für den Namen des Tests
 */
export function seedChunks(seeds: readonly number[], size: number) {
  return Array.from({ length: Math.ceil(seeds.length / size) }, (_, i) => {
    const part = seeds.slice(i * size, (i + 1) * size);
    const label = part.length > 6 ? `${part[0]} … ${part.at(-1)}` : part.join(', ');
    return { seeds: part, label };
  });
}

/** Alle Felder, die von `start` aus zu Fuß erreichbar sind (bis `limit` Felder) */
export function reachable(world: World, open: GateId[], start: readonly [number, number], limit = 30000) {
  const seen = new Set<string>([`${start[0]},${start[1]}`]);
  const queue: [number, number][] = [[start[0], start[1]]];
  for (let i = 0; i < queue.length && seen.size < limit; i++) {
    const [x, y] = queue[i]!; // Index statt shift(): shift kopiert die ganze Schlange, bei 30000 Feldern spürbar
    for (const [dx, dy] of Object.values(DIRS)) {
      const k = `${x + dx},${y + dy}`;
      if (seen.has(k) || !canStep(world, open, x, y, x + dx, y + dy)) continue;
      seen.add(k);
      queue.push([x + dx, y + dy]);
    }
  }
  return [...seen].map((k) => k.split(',').map(Number) as [number, number]);
}

const bare = new Map<number, World>();
/**
 * Die Welt eines Seeds ohne Pakete, wie im Spiel, solange kein Paket geladen ist; je Seed einmal gebaut. Nur für Tests,
 * die sie lesen (auch `attach` lässt sie, wie sie ist); wer sie für einen Vergleich frisch braucht, baut selbst
 */
export function bareOf(seed: number): World {
  return recent(bare, seed, () => createWorld(seed, []));
}

/**
 * Gebaute Welten vergessen (`worldOf`, `bareOf`) bis auf die `keep` zuletzt gebrauchten je Sorte: Der tiefe Lauf teilt
 * die Module eines Workers über alle seine Dateien (`isolate` in vitest.config.ts) und ruft dies nach jeder Datei
 * (test-deep-setup.ts). Ganz ohne Vergessen wüchse der Speicher; was bleibt, baut die nächste Datei derselben Welt nicht
 * noch einmal (die Dateien laufen nach Ordnern sortiert, also die einer Welt nacheinander)
 */
export function forgetWorlds(keep = 0): void {
  for (const cache of [worlds, bare] as Map<unknown, World>[])
    for (const key of [...cache.keys()].slice(0, Math.max(0, cache.size - keep))) cache.delete(key);
}
