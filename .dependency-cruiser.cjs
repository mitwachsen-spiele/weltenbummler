// Architekturregeln (Guard-Gate, `npm run arch`): die Schichten der Seite, maschinell geprüft.
//   src/lib       generische Bausteine (Würfel-Grafik beim Build, Spiel-Bausteine) – kennt keine Seiteninhalte
//   src/data      Inhalte und Konfiguration der Seite – nutzt lib, kennt keine Oberfläche
//   src/scripts   Code im Browser – nur so viel lib wie nötig, nichts aus Node
//   src/lib/games, src/data/games – Bausteine und Inhalte des Spiels, laufen im Browser
//   components, layouts, pages – Oberfläche, darf alles darunter nutzen
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Zyklen machen Module untrennbar und die Ladereihenfolge zufällig.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'lib-is-generic',
      severity: 'error',
      comment: 'src/lib ist der generische Unterbau. Inhalte kommen als Parameter, nicht per Import.',
      from: { path: '^src/lib/' },
      to: { path: '^src/(data|components|layouts|pages|scripts)/' },
    },
    {
      name: 'data-knows-no-ui',
      severity: 'error',
      comment: 'Daten und Konfiguration hängen nicht von Komponenten, Layouts oder Seiten ab.',
      from: { path: '^src/data/' },
      to: { path: '^src/(components|layouts|pages|scripts)/' },
    },
    {
      name: 'client-gets-only-browser-lib',
      severity: 'error',
      comment:
        'Browser-Code nutzt aus lib nur die Texturen (textures.ts, reine Daten) und die Spiel-Bausteine (lib/games). Alles andere ist Build-Code und gehört nicht ins Bundle.',
      from: { path: '^src/scripts/', pathNot: '\\.test\\.ts$' },
      // Reine Typ-Importe verschwinden beim Kompilieren und sind erlaubt
      to: {
        path: '^src/lib/',
        pathNot: '^src/lib/(voxel/textures\\.ts|games/)',
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'games-lib-is-browser-safe',
      severity: 'error',
      comment: 'lib/games läuft im Browser: keine Node-Module und aus lib nur die Texturen.',
      from: { path: '^src/lib/games/', pathNot: '\\.test\\.ts$' },
      to: { path: '^src/lib/', pathNot: '^src/lib/(games/|voxel/textures\\.ts)', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'games-data-is-browser-safe',
      severity: 'error',
      comment:
        'Spieldaten werden vom Browser-Code geladen: Sie dürfen aus lib nur lib/games und die Texturen nutzen, sonst rutscht Build-Code ins Bundle.',
      from: { path: '^src/data/games/', pathNot: '\\.test\\.ts$' },
      to: {
        path: '^src/(lib/(?!games/|voxel/textures\\.ts)|data/(?!games/))',
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'no-node-in-games',
      severity: 'error',
      comment: 'Spiel-Bausteine und Spieldaten laufen im Browser und können keine Node-Module laden.',
      from: { path: '^src/(lib|data)/games/', pathNot: '\\.test\\.ts$' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'no-node-in-client',
      severity: 'error',
      comment: 'Browser-Code kann weder Node-Module noch sharp laden.',
      from: { path: '^src/scripts/', pathNot: '\\.test\\.ts$' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'no-sharp-in-client',
      severity: 'error',
      comment: 'sharp läuft nur beim Build.',
      from: { path: '^src/scripts/', pathNot: '\\.test\\.ts$' },
      to: { path: 'sharp' },
    },
    {
      name: 'world-packs-load-lazily',
      severity: 'error',
      comment:
        'Welt-Pakete (src/scripts/games/worlds/<welt>/, dazu ihre Daten in src/data/games/worlds/<welt>/) kommen nur per import(): Nichts außerhalb der Pakete importiert statisch daraus, sonst rutscht es in die Spielseite. Tests und ihr Helfer test-worlds.ts ausgenommen.',
      from: {
        pathNot: ['^src/(scripts|data)/games/worlds/', '\\.test\\.ts$', '^src/scripts/games/test-worlds\\.ts$'],
      },
      to: {
        path: '^src/(scripts|data)/games/worlds/',
        dependencyTypesNot: ['dynamic-import', 'type-only'],
      },
    },
    {
      name: 'world-packs-stay-apart',
      severity: 'error',
      comment: 'Ein Welt-Paket importiert kein anderes, auch nicht dessen Daten: Jede Welt lädt für sich.',
      from: { path: '^src/(?:scripts|data)/games/worlds/([^/]+)/' },
      to: { path: '^src/(scripts|data)/games/worlds/', pathNot: '^src/(scripts|data)/games/worlds/$1/' },
    },
    {
      name: 'bay-is-for-packs',
      severity: 'error',
      comment:
        'Die Bucht vor einem Tor (mitwachsen-bay.ts: Felder vor der Tür, Reihe der Torplatte, Platz eines Boten) gilt für jedes Tor gleich, braucht aber nur ein Welt-Paket (Bote, Fahrzeug-Halt): Nur Pakete und Tests importieren sie, so landet sie nie im Kern der Spielseite.',
      from: { pathNot: ['^src/scripts/games/worlds/', '\\.test\\.ts$'] },
      to: { path: '^src/scripts/games/mitwachsen-bay\\.ts$' },
    },
    {
      name: 'ride-kit-is-for-packs',
      severity: 'error',
      comment:
        'Was alle Fahrzeuge teilen (mitwachsen-ride-kit.ts: Zeiten, Halte, wo ein Fahrzeug steht; mitwachsen-ride-save.ts: Spielstand packs.fahrt) brauchen nur Pakete: die Fahr-Engine (worlds/fahrt/) und das Bild jedes Fahrzeugs (Schlitten in worlds/eis/, Zug in worlds/bahn/). Nur Pakete und Tests importieren es, so landet es nie im Kern der Spielseite; die Fahr-Engine selbst kennt kein Fahrzeug (world-packs-stay-apart).',
      from: {
        pathNot: ['^src/scripts/games/worlds/', '\\.test\\.ts$', '^src/scripts/games/mitwachsen-ride-kit\\.ts$'],
      },
      to: { path: '^src/scripts/games/mitwachsen-ride-(kit|save)\\.ts$' },
    },
    {
      name: 'turn-lives-in-3d',
      severity: 'error',
      comment:
        'Die Drehung zur Torfront (mitwachsen-turn.ts: Feder, Pendeln, Heranrücken, Blinzeln; eingebaut in mitwachsen-turn-3d.ts) braucht nur die 3D-Ansicht und liegt in einem eigenen Chunk, den sie nachlädt (mitwachsen-turn-3d.<hash>.js), nie im Kern. Kern und Welt-Pakete nutzen nur den winzigen Takt mitwachsen-turn-pace.ts; was sie von der Drehung wissen müssen (Blinzeln, angekommen), fragen sie die 3D-Ansicht.',
      from: { pathNot: ['^src/scripts/games/mitwachsen-(3d|turn-3d)\\.ts$', '\\.test\\.ts$'] },
      to: { path: '^src/scripts/games/mitwachsen-turn(-3d)?\\.ts$' },
    },
    {
      name: 'no-test-in-production',
      severity: 'error',
      comment:
        'Tests und ihre Helfer (test-worlds.ts, test-plates.ts, test-canvas.ts) werden nur von Tests importiert (und vom Setup des tiefen Laufs, test-deep-setup.ts).',
      from: { pathNot: '(\\.test\\.ts|/test-deep-setup\\.ts)$' },
      to: { path: '(\\.test\\.ts|/test-(worlds|plates|canvas|deep-setup)\\.ts)$' },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      comment: 'Jeder Import muss auflösbar sein (Astro-Module wie astro:content ausgenommen).',
      from: {},
      to: { couldNotResolve: true, pathNot: '^astro:' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^(dist|\\.astro)/' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    // Paket-Unterpfade wie astro/zod über das exports-Feld auflösen
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'types', 'default'] },
  },
};
