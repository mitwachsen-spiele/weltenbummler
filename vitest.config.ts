// Unit-Tests für die reine Logik (Würfel-Grafik, Spielregeln, Bundle- und Seiten-Gate). Kein DOM, kein Astro nötig.
import { availableParallelism, totalmem } from 'node:os';
import { getHeapStatistics } from 'node:v8';
import { defineConfig } from 'vitest/config';
import { BaseSequencer, type TestSpecification } from 'vitest/node';
import { budgetMs, calibrate } from './scripts/test-budget.ts';

// Fristen: 60 s je Test und 120 s je Hook, lokal wie in der Pipeline. Sie fangen nur Hänger ab und sind kein Maß für
// Geschwindigkeit: Eine an den Rechner kalibrierte Grenze als Fehler riss bei jeder neuen Welt einen anderen Test, je
// nach Last des Rechners. Langsam wird darum nur gemeldet: Tests über dem Budget (scripts/test-budget.ts: 4 s auf dem
// Bezugsrechner mit Abdeckung, relativ zur Geschwindigkeit dieses Rechners) markiert der Bericht. Damit die Laufzeit
// nicht mit jeder Welt wächst, laufen Eigenschafts-Tests über SAMPLE_SEEDS und REGRESSION_SEEDS (`seedsFor` in
// test-worlds.ts), die vollen Seed-Bereiche im tiefen Lauf (`npm run test:deep`, MITWACHSEN_DEEP=1, Job deep der
// Pipeline und gates:ci).
// Welten kommen über `worldOf`/`bareOf` (test-worlds.ts), kein `expect` in Schleifen je Takt oder Feld.
const CI = !!process.env.CI;
const DEEP = process.env.MITWACHSEN_DEEP === '1';
const coverage = process.argv.includes('--coverage');
const calib = calibrate();
const budget = budgetMs(calib, coverage);
// in der Pipeline sichtbar: Stimmt der Faktor zum Bezugsrechner (REF in scripts/test-budget.ts)?
if (CI) console.log(`::notice title=Zeitbudget::Kalibrierung ${calib.toFixed(0)} ms, langsam ab ${budget} ms`);

/**
 * Tiefer Lauf: Dateien nach Pfad sortiert statt nach Größe, so laufen die Dateien eines Ordners (einer Welt)
 * nacheinander im selben Worker und teilen sich die zuletzt gebauten Welten (test-deep-setup.ts)
 */
class ByFolder extends BaseSequencer {
  override sort(files: TestSpecification[]) {
    return Promise.resolve([...files].sort((a, b) => a.moduleId.localeCompare(b.moduleId)));
  }
}
/**
 * Tiefer Lauf: Welten über das Ende einer Datei behalten (test-deep-setup.ts) nur, wo der Speicher reicht: ab 2 GB je
 * Kern (Speicher des Rechners, im Container seine Grenze, durch die Kerne; gates:ci 3,5 GB mit einem Worker, Job deep
 * 4 GB), und nur, solange der Worker unter 65 % seines Heaps liegt. Gemessen mit einem Worker auf 2 Kernen: höchstens
 * 1,4 GB Heap nach einer Datei, 1,6 GB RSS (Heap-Grenze 2,2 GB). Lokal mit vielen Kernen: alles vergessen wie bisher
 */
const memPerCore = Math.min(process.constrainedMemory() || Infinity, totalmem()) / availableParallelism();
const keepHeap = memPerCore >= 2e9 ? Math.round(getHeapStatistics().heap_size_limit * 0.65) : 0;

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Tests über dem Budget markiert der Bericht (nur Warnung); kalibriert, also auch auf dem langsameren Runner passend
    slowTestThreshold: budget,
    // Lokal die Hälfte der Kerne: weniger Rauschen durch viele Worker (und Effizienzkerne)
    maxWorkers: CI ? undefined : '50%',
    // Tiefer Lauf ohne Isolation je Datei: Jeder Worker lädt die Module (Pakete, Modelle) einmal für alle seine Dateien
    // statt je Datei neu; gebaute Welten vergisst er nach jeder Datei bis auf die zuletzt gebrauchten (test-deep-setup.ts,
    // alle behalten reicht der Speicher nicht), die Dateien nach Ordnern sortiert (`ByFolder`), damit die nächste Datei
    // derselben Welt sie nicht noch einmal baut. test:deep lag in gates:ci am 24.11.2026 bei 139 bis 154 s von 150 s, am
    // 25.11.2026 mit Funkel bei 152 s (dort läuft nur ein Worker: 2 CPUs); mit dem Behalten CI-nah gemessen (ein Worker auf
    // 2 Kernen) 161 s → 135 s. `npm test` bleibt isoliert und findet so
    // Tests, die von einer anderen Datei abhängen
    isolate: !DEEP,
    setupFiles: DEEP ? ['src/scripts/games/test-deep-setup.ts'] : [],
    env: { MITWACHSEN_KEEP_HEAP: String(keepHeap) },
    ...(DEEP ? { sequence: { sequencer: ByFolder } } : {}),
    // Abdeckung nur für die reinen Module – Web Components, Canvas und Three.js prüft der Browser-Test (e2e/)
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/**/*.ts',
        'src/data/games/**/*.ts',
        'src/scripts/games/{input-pace,pwa-update}.ts',
        'src/scripts/games/mitwachsen-{air,bedtime,behind,border,camera,chores,deco-look,dev,dusk,fine-2d,fine-3d,fine-bodies-3d,fine-chunk-3d,fog,free,gait,growth,guide,halo,herald,hint-look,home,meadow,pack,packs,plate,plate-toy,portal,postcard,preload,ride-kit,ride-save,ride-view,row,save,scatter,spawns,state,tired,travel,tree-look,turn,turn-pace,view,view-3d,weather,wild,world,yard-look}.ts',
        'src/scripts/games/worlds/*/*.ts',
        'scripts/{bundles,dist,flaky,pwa,test-budget}.ts',
      ],
      // Zeichnen auf dem Canvas in den Welt-Paketen (Wetter, Bild der Weltgrenze) prüft der Browser-Test
      exclude: ['src/scripts/games/worlds/*/mitwachsen-{ice-sky,border-view}.ts'],
      reporter: [['text', { skipFull: true }], 'text-summary'],
      // Knapp unter dem gemessenen Stand: Sinkt die Abdeckung, fällt das Gate. Steigt sie, die Schwellen mitziehen.
      thresholds: {
        statements: 92,
        branches: 89,
        functions: 91,
        lines: 92,
        // Die Spielregeln enger
        'src/scripts/**/*.ts': { statements: 95, branches: 86, functions: 95, lines: 95 },
      },
    },
  },
});
