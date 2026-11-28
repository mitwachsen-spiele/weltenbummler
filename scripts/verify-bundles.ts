// Guard-Gate nach dem Build (Teil von npm run verify): Das Spiel lädt schnell und ohne Ballast.
// Das Spiel liegt an der Wurzel (index.html). Andere Seiten (404) laden kein Spiel und kein Three.js und bleiben unter
// einem festen Budget. Die Spielseite lädt beim Start nur ihren eigenen Code (den Kern); Three.js (im Build _astro/three.<hash>.js) kommt
// nur nachträglich per import() und hat eine eigene Grenze, an seine Version gebunden. Die 3D-Ansicht ohne Three.js
// (samt der nachgeladenen Drehung zur Torfront) enthält nichts, was nur eine Welt hinter einem Tor braucht. Jedes
// Welt-Paket (src/scripts/games/worlds/, im Build _astro/welt-<welt>.<hash>.js) misst samt seinem 3D-Teil
// (_astro/welt-<welt>-3d.<hash>.js) eine eigene Grenze, ebenso alles, was der Kern selbst nachlädt.
// Grenzen mit Luft statt Tretmühle: Jede Grenze liegt bei gemessen + gut 10 % (Three.js + 5 %). Angehoben wird erst,
// wenn weniger als 3 % Luft bleiben, und dann wieder auf gemessen + 10 %, mit einem Satz Begründung in der
// Commit-Nachricht. Kein Tagebuch neben den Zahlen: Die Geschichte steht in git. Die wahren/falschen Regeln (kein
// Spiel und kein Three.js außerhalb der Spielseite, Three.js nur per import(), Proben) bleiben fest.
// Logik und Tests: scripts/bundles.ts, scripts/bundles.test.ts

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { check, type Rule, type Usage } from './bundles.ts';

const DIST = 'dist';
// Spielcode, Three.js und die Anmeldung des Service Workers (die gibt es nur auf der Spielseite)
const GAME_CODE = /larmic-mitwachsen|Mitwachsen|WebGLRenderer|three\.module|serviceWorker/;

export const RULES: Rule[] = [
  // Alle Seiten außer dem Spiel (404) bleiben ohne Spielcode und im festen Budget
  { name: 'Seiten ohne Spiel', pages: /^(?!index\.html$)/, budget: 32 * 1024, forbidden: GAME_CODE },
  {
    name: 'Spiel lädt 3D erst bei Bedarf',
    pages: /^index\.html$/,
    // Kern: Regeln, Welt, 2D-Ansicht und Daten des Spiels; 3D (Three.js) und die Welt-Pakete kommen erst per import().
    // Gemessen 194,5 KB (27.11.2026, nach Issue 13; mit feinen Flächen: Muster, Maler, Bild-Cache und Leuchten laufen im
    // Kern), Grenze zuletzt angehoben bei 184,9 KB
    budget: 203.4 * 1024,
    // Probe: Der Höhlenhimmel der Grotte steht nur in ihrem Welt-Paket (GROTTE_COLORS.sky)
    forbidden: /WebGLRenderer|three\.module|#4a4370/,
  },
  {
    name: 'Three.js',
    pages: /^index\.html$/,
    // nur per import() erreichbar (kommt es beim Laden, meldet das Gate es), in eigener Datei three.<hash>.js
    chunks: /\/three\.[\w-]+\.js$/,
    // An die Version von Three.js gebunden (0.187): gemessen 530 152 Bytes (517,7 KB), dazu 5 % Luft.
    // Wächst es mit einem Update von Three.js, hier neu messen und wieder auf gemessen + 5 % setzen
    budget: 544 * 1024,
    forbidden: /larmic-mitwachsen|Mitwachsen/,
  },
  {
    name: '3D-Ansicht',
    pages: /^index\.html$/,
    parts: [
      // 3D-Ansicht samt Zugängen, ohne Three.js (eigene Regel oben)
      { chunks: /\/mitwachsen-3d\.[\w-]+\.js$/, after: /\/three\.[\w-]+\.js$/ },
      // Drehung zur Torfront: kommt erst nach der 3D-Ansicht, wenn die Figur einem Tor nah ist (`NEAR_GATE`)
      { chunks: /\/mitwachsen-turn-3d\.[\w-]+\.js$/, after: /\/mitwachsen-3d\.[\w-]+\.js$/ },
    ],
    // Gemessen 95,5 KB (mit feinen Flächen: Muster und Leuchten im Shader, feine Kronen, Pflanzen der Torhäuser;
    // vorher 92,5 KB): unter 3 % Luft, darum Grenze nach gemessen + 10 %
    budget: 105.1 * 1024,
    // Three.js liegt nur in seiner eigenen Datei. Proben: Das Leuchten der Eiszapfen gibt es nur im 3D-Teil der
    // Eis-Welt (ICE_GLOW in worlds/eis/view-3d-gate.ts), den Höhlenhimmel nur im Paket der Grotte
    forbidden: /WebGLRenderer|three\.module|#7fd6ff|#4a4370/,
  },
  {
    name: 'Welt-Paket Eis',
    pages: /^index\.html$/, // nur die Spielseite lädt Welt-Pakete
    parts: [
      // Gletscherkessel, Regeln des Pinguins, der Schlitten (Strecke, Bild; seine Fahrregeln im Paket der Fahrzeuge),
      // Zeichenteile der 2D-Ansicht und Modelle der Eis-Tiere
      { chunks: /\/welt-eis\.[\w-]+\.js$/ },
      // 3D-Teil: kommt erst nach der 3D-Ansicht (Three.js, Baukasten der Zugänge) und dem Paket der Welt
      { chunks: /\/welt-eis-3d\.[\w-]+\.js$/, after: /\/(mitwachsen-3d|welt-eis)\.[\w-]+\.js$/ },
    ],
    // Gemessen 91,7 KB nach der Feinen Grafik (Issue 13; vorher 85,6 KB mit Fülle im Schnee, Issue 16, Rodelberg samt
    // Rodelreifen, Issue 50, Spielorten, Issue 52, und der Schneeraupe, Issue 54): unter 3 % Luft, darum Grenze nach
    // gemessen + 10 % (Issue 17)
    budget: 100.9 * 1024,
    forbidden: /WebGLRenderer|three\.module/,
  },
  {
    name: 'Welt-Paket Höhle',
    pages: /^index\.html$/,
    parts: [
      // Kristallgrotte (Lage, Gelände, Zuhause, Licht, Portal am See, Fundorte der Höhlen-Tiere, Pilzbeete, Tropfquelle,
      // Tropfmoos), ihr Schmuck (Säulen-Glockenspiel mit Fledermaus-Runde, Grottenolm am Steg, Tropfsteine), ihre Füllung
      // (Stalagmiten-Gruppen, Kristallbüsche, Felsbrocken, Felsinseln, Pfützen, Moos und Farn, Lehmhang) und Fülle
      // (Kristallfelder, Adern, Leuchtmoos, Wasserfall am See, Ufersteine), Sammelstellen (Funke über vollen Beeten, Glitzern
      // der fernen Tropfquelle), die kleinen Lichtgeister (Verstecken an den Säulen, Kichern, Klangstein), die Tupfspinnen
      // (Netze als Harfe, Gruß der Spinne, Leuchten der Perlen), ihr Licht
      // (Ränder im Dunkel, Lichtkreis, Kristall-Laterne, Dunkelmaske), Zeichenteile der 2D-Ansicht und Modelle der Höhlen-Tiere; geholt
      // nah am Höhlentor, mit offenem Tor oder vor einem Halt des Zugs; dazu das Hau-ruck am
      // Höhlentor (Regeln, Hände auf dem Stein, Fledermaus, Glühwürmchen, Töne)
      { chunks: /\/welt-hoehle\.[\w-]+\.js$/ },
      // 3D-Teil: kommt erst nach der 3D-Ansicht und dem Paket der Welt
      { chunks: /\/welt-hoehle-3d\.[\w-]+\.js$/, after: /\/(mitwachsen-3d|welt-hoehle)\.[\w-]+\.js$/ },
    ],
    // Gemessen 80,4 KB (mit den vier Spielorten, Issue 56: Leuchtpilze, Kristalltürmchen, Zahlen-Kristalle, Echo-Wand;
    // vorher 73,3 KB): unter 3 % Luft, darum Grenze nach gemessen + 10 %
    budget: 88.4 * 1024,
    forbidden: /WebGLRenderer|three\.module/,
  },
  {
    name: 'Welt-Paket Bahn',
    pages: /^index\.html$/,
    parts: [
      // Gleis der Höhlenbahn auf Lichtung und Grotte: Trassen-Suche, Bahnhof Bär, Zeichenteile der 2D-Ansicht; Tok, der
      // Bote der Höhlenwelt (Regeln, Modell, Bild und Ton); Bau 1 mit Bahnhof Bär und Zug (Modelle, Körper, Töne); der Zug
      // als Fahrzeug (Strecke, Bild beim Fahren, Ton, Licht im Tunnel); Bau 2 mit Bahnhof Fledermaus;
      // Schmuck mit Zug (Pfeif-Gruß, Laternenfahrt mit Glühwürmchen und Kristall-Wimpel, warmes Licht, Gute Nacht);
      // geholt, sobald das Eistor offen ist
      { chunks: /\/welt-bahn\.[\w-]+\.js$/ },
      // 3D-Teil: kommt erst nach der 3D-Ansicht und dem Paket der Bahn
      { chunks: /\/welt-bahn-3d\.[\w-]+\.js$/, after: /\/(mitwachsen-3d|welt-bahn)\.[\w-]+\.js$/ },
    ],
    // Gemessen 55,2 KB (mit feinen Flächen an Zug, Gleis, Bahnhöfen und Tok; vorher 53,5 KB): unter 3 % Luft, darum
    // Grenze nach gemessen + 10 %
    budget: 60.8 * 1024,
    forbidden: /WebGLRenderer|three\.module/,
  },
  {
    name: 'Welt-Paket Fahrzeuge',
    pages: /^index\.html$/,
    // Die Fahr-Engine aller Fahrzeuge (einsteigen, fahren, Hindernis, Tunnel, ankommen), samt dem, was sie mit den Paketen
    // der Fahrzeuge teilt (Halte, Spielstand packs.fahrt); keine eigene Welt, kein 3D-Teil. Kommt, sobald es ein Fahrzeug
    // geben kann (Eistor offen); dazu das Schlafen am Halt, solange ein Paket fehlt (Vorladen), das Fest je Fahrzeug
    // (`Vehicle.feast`), das Aufwachen am neuen Spieltag (`schlaeft`) und die Schleife (`RideRoute.loop`, Grubenbahn)
    chunks: /\/welt-fahrt\.[\w-]+\.js$/,
    // Gemessen 10,6 KB (mit der Schleife, ihrer Formprüfung `loopOk` und ihren Runden, Issue 48)
    budget: 11.0 * 1024,
    forbidden: /WebGLRenderer|three\.module/,
  },
  {
    name: 'Welt-Paket Grubenbahn',
    pages: /^index\.html$/,
    // Das Grubenbähnchen Funkel in der Grotte: sein schmales Gleis (legen und zeichnen, für 2D und 3D dieselben Quader,
    // darum kein eigener 3D-Teil), seine Strecke als Schleife, Modell, Körper und Töne; samt dem, was es mit den anderen
    // Fahrzeugen teilt (Spielstand packs.fahrt); dazu der Glitzergang mit den zwei Klingeltoren (Tore, Scheibe,
    // Wandkristalle, Wasserfall, Töne beim Durchfahren und zu Fuß, Licht im Gang) und der Maulwurf, der den Gang gräbt
    // (Regel, Erdwelle, Töne, Klangstein am Halt), samt seinen Sehenswürdigkeiten (Grubenhalt vor dem Graben, Funkels
    // Halt, Zahlensteine), dazu die vier Zahlensteine am Halt und die Lichter auf dem Dach des zweiten Wagens (Issue 48).
    // Kommt mit der Grotte
    chunks: /\/welt-grube\.[\w-]+\.js$/,
    // Gemessen 23,0 KB (vorher 20,6): Grenze nach gemessen + 10 %
    budget: 25.3 * 1024,
    forbidden: /WebGLRenderer|three\.module/,
  },
  {
    name: 'Nachgeladen vom Kern',
    pages: /^index\.html$/,
    // Seltenes, das der Kern erst bei Bedarf holt: „noch nicht“ an den Toren (Bild, Ton, Live-Region), Inhalt des
    // Menüs, Postkarte der Torfront, Anmeldung des Service Workers
    parts: [{ chunks: /\/(mitwachsen-(hint-look|menu|card)|pwa-register)\.[\w-]+\.js$/ }],
    // Gemessen 7697 Bytes (7,5 KB)
    budget: 8.2 * 1024,
    forbidden: /WebGLRenderer|three\.module/,
  },
];

const pagesIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? pagesIn(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : [],
  );

const read = (path: string) => {
  try {
    return readFileSync(join(DIST, path), 'utf8');
  } catch {
    return null;
  }
};

const pages = pagesIn(DIST);
const usage: Usage[] = [];
const problems = pages.flatMap((file) => check(relative(DIST, file), readFileSync(file, 'utf8'), read, RULES, usage));
const kib = (n: number) => `${(n / 1024).toFixed(1)} KB`;
const budgetOf = (name: string) => RULES.find((r) => r.name === name)?.budget ?? 0;
for (const u of usage.filter((x) => x.page === 'index.html'))
  console.log(`  ${u.rule}: ${u.file ?? u.page} ${kib(u.bytes)} von ${kib(budgetOf(u.rule))}`);
if (problems.length) {
  console.error(`Bundle-Gate: ${problems.length} Verstoß/Verstöße\n` + problems.map((p) => `  ✖ ${p}`).join('\n'));
  process.exit(1);
}
console.log(
  `✓ Bundle-Gate: ${pages.length} Seiten geprüft, übrige Seiten ohne Spiel, Kern, 3D-Ansicht und Welt-Pakete im Budget`,
);
