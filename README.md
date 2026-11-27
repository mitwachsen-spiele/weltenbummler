# mitwachsen-spiele.de

> **Umzug läuft (27.11.2026):** Dieses Repo setzt [larmic/mitwachsen-spiele](https://github.com/larmic/mitwachsen-spiele) mit voller Historie fort (Stand `1128428`). Das Spiel zieht nach https://weltenbummler.mitwachsen-spiele.de/ und heißt künftig „Weltenbummler“, die Homepage kommt nach [mitwachsen-spiele/website](https://github.com/mitwachsen-spiele/website). Bis zum Abschluss liefert weiter das alte Repo aus. Fortschritt: larmic/mitwachsen-spiele#71.

Mitwachsen: ein ruhiges Spiel für Kinder ab 3 Jahren, das man zusammen mit Mama oder Papa spielt. Ohne Werbung, ohne Punkte, kostenlos im Browser. Gebaut mit [Astro](https://astro.build), ausgeliefert als statische Seite über GitHub Pages unter https://www.mitwachsen-spiele.de.

Das Spiel stammt von [larmic.de](https://larmic.de) und hat hier eine eigene Seite bekommen.

## Schnellstart

Voraussetzung ist Node.js in der Version aus `.nvmrc` (26), zum Beispiel über Homebrew:

```bash
brew install node
npm install
npm run dev
```

Die Seite läuft dann unter http://localhost:4321 und lädt Änderungen sofort neu.

| Befehl | Wirkung |
| --- | --- |
| `npm run dev` | Entwicklungsserver mit Live-Reload |
| `npm run check` | Prüft Typen und Inhalts-Schemas. Guard-Gate |
| `npm test` | Unit-Tests (Vitest) für Spielregeln, Welt, Speichern und Würfel-Grafik, mit Mindest-Abdeckung der reinen Module (Schwellen in `vitest.config.ts`). Guard-Gate |
| `npm run lint` | ESLint für TypeScript und Astro. Guard-Gate |
| `npm run format` / `format:check` | Prettier formatiert bzw. prüft den Code. `format:check` ist Guard-Gate |
| `npm run arch` | Architekturregeln (dependency-cruiser, `.dependency-cruiser.cjs`): Schichten `lib` → `data` → Oberfläche, Browser-Code ohne Build-Code. Guard-Gate |
| `npm run build` | Erzeugt die fertige Seite in `dist/` |
| `npm run verify` | Prüft die fertige Seite in `dist/`: gültiges HTML (html-validate), keine toten internen Links und Sprungmarken (linkinator), das Bundle-Gate (Startseite ohne JavaScript, weder als Datei noch eingebettet, übrige Seiten ohne Spiel und im JavaScript-Budget), das Seiten-Gate (keine externen Ressourcen ohne Klick) und das App-Gate (Manifest und Icons gültig, der Service Worker speichert alles, was das Spiel braucht, in einer Version, die zum Inhalt passt, und bleibt zusammen im Budget `PRECACHE_BUDGET`). Guard-Gate nach dem Build |
| `npm run test:e2e` | Smoke-Test im Browser (Playwright, `e2e/`): Startseite (Weg ins Spiel, Aufbau, 320 px ohne seitliches Scrollen), Rechtliches, 404 und das Spiel, ohne Fehler in der Konsole; das Spiel als App (Manifest, installierbar laut Chromium, Service Worker, Start ohne Netz, Updates mit zwei echten Fassungen der Seite: die alte läuft weiter, die neue wartet und kommt an sicheren Stellen), dazu Barrierefreiheit jeder Seite nach WCAG 2.2 AA (axe-core). Guard-Gate nach dem Build; einmalig `npx playwright install chromium` |
| `npm run preview` | Zeigt den gebauten Stand aus `dist/` lokal an |
| `npm run gates` | Alle Guard-Gates in der Reihenfolge der Pipeline, inklusive Build |

## Projektstruktur

```
src/
  pages/              / (Seite für Eltern), /spielen/ (das Spiel, noindex), /datenschutz/, 404,
                      dazu favicon, apple-touch-icon, Icons der App, manifest.webmanifest und og.png (beim Build erzeugt)
  layouts/            BaseLayout (Kopfdaten; die Startseite baut darauf direkt auf), PlainPage (Himmel, Inhalt auf Papier, Footer)
  content/games/      Eckdaten des Spiels im Frontmatter (Alter, Steuerung …), Schema in content.config.ts;
                      alle Texte der Startseite stehen in data/landing.ts
  components/         MitwachsenGame (Spielfläche), MitwachsenParentInfo (Hinweis für Eltern), Kopf, Footer …
  scripts/games/      das Spiel im Browser: Welt, Regeln, Speichern (rein, getestet), Web Component,
                      2D- und 3D-Ansicht (Three.js, per import() nachgeladen), Töne
  lib/games/          generische Spiel-Bausteine: Zufall, Stücke, Ansicht von vorn (läuft im Browser)
  lib/voxel/          Würfel-Grafik beim Build: Texturen, Würfel, Szene, Icon
  lib/pwa/            die App: Manifest, Liste für den Service Worker, Service Worker (rein, getestet)
  integrations/       schreibt nach dem Build den Service Worker (dist/spielen/sw.js)
  data/pwa.ts         Name, Farben und Icons der App, Ort des Service Workers
  data/games/         Gegenden, Tiere, Figur, Geschichten
  data/site.ts        Titel, Adresse, strukturierte Daten für Suchmaschinen
  data/landing.ts     alle Texte der Startseite
  styles/             tokens.css (Design-Tokens), global.css, sections.css, landing.css (Startseite)
scripts/              Gates nach dem Build: Bundle-Gate, Seiten-Gate, App-Gate
e2e/                  Smoke-Test und Barrierefreiheit (Playwright)
docs/games/           Konzept des Spiels, Altersstufen, gemeinsame Regeln
docs/specs/           Spec des Spiels (Regeln, Invarianten, zugehörige Tests)
docs/design-system.md Farben, Typografie, Bausteine
docs/todo.md          Offene Punkte
```

## Installieren

**Für Eltern:** Das Spiel lässt sich wie eine App auf den Home-Bildschirm legen, von der Startseite oder vom Spiel aus. Danach startet es direkt im Spiel, ohne Adressleiste, und läuft auch ohne Internet. Wichtig: Ohne Internet geht es erst, nachdem das Spiel einmal mit Internet geöffnet war. Wer von der Startseite aus installiert, startet die App also einmal mit Internet (oder öffnet vorher das Spiel), bevor es auf die Autofahrt geht.

| Gerät | Browser | So geht's |
| --- | --- | --- |
| iPad, iPhone | Safari, ab iOS 16.4 auch Chrome, Edge, Firefox | Teilen → „Zum Home-Bildschirm“ |
| Mac | Safari (ab macOS Sonoma) | Ablage → „Zum Dock hinzufügen“ |
| Mac, Windows, Linux, ChromeOS | Chrome, Edge | Symbol „Installieren“ rechts in der Adressleiste oder Menü → „Seite als App installieren“ (Bezeichnung je nach Version) |
| Android | Chrome, Samsung Internet, Edge | Menü → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“ |
| Android | Firefox | Menü → „Zum Startbildschirm hinzufügen“ |
| Computer | Firefox | keine Installation, das Spiel läuft im Tab |

Spielstände: Mit Safari (iPad, iPhone, Mac) hat die installierte App einen eigenen Speicher, getrennt vom Browser – ein Spielstand aus dem Browser erscheint einmalig nicht in der App. Dafür räumt Safari den Speicher von Apps auf dem Home-Bildschirm nicht nach 7 Tagen ohne Besuch weg. Mit Chrome und Edge teilen sich App und Browser den Speicher, der Spielstand ist derselbe.

Das Spiel dreht sich mit dem Gerät, hoch und quer. Neue Versionen lädt die App still im Hintergrund, Eltern müssen nichts tun. Weil Tablets und Handys eine App meist nur anhalten statt sie zu schließen, übernimmt das Spiel eine neue Version selbst, aber nur in ruhigen Momenten: wenn die Figur ins Bett gegangen und das Schlaflied verklungen ist, oder wenn die App nach mindestens einer halben Stunde Pause wieder geöffnet wird und die Figur noch schläft. Dann lädt die Seite einmal kurz neu und zeigt danach genau dasselbe, die Nacht im Bett. Ein laufendes Spiel wird nie unterbrochen.

**Für Entwickler:** Das Manifest (`/manifest.webmanifest`) und die Icons erzeugt der Build aus `src/data/pwa.ts`. Den Service Worker (`/spielen/sw.js`, gilt nur für `/spielen/`) schreibt die Integration `src/integrations/service-worker.ts` nach dem Build; die Liste der vorab gespeicherten Dateien sammelt sie aus der fertigen Seite, inklusive des per `import()` nachgeladenen Three.js. Angemeldet wird er nur im fertigen Build (`npm run build && npm run preview`), nicht mit `npm run dev`. Regeln und Update-Verhalten: [docs/specs/mitwachsen.md](docs/specs/mitwachsen.md) („App“, „Updates an sicheren Stellen“); die Entscheidungen stecken rein und getestet in `src/scripts/games/pwa-update.ts`. Den Weg von einer Fassung zur nächsten prüft `e2e/pwa-update.spec.ts` mit zwei echten Fassungen: Vor dem Browser-Test leitet `e2e/versions.ts` aus `dist/` eine zweite ab (neues Three.js, Service Worker mit demselben Code wie beim Build neu geschrieben), der Test-Server liefert sie mit dem Cookie `mw-version=2`. Zum Testen in den DevTools unter Application → Service Workers „Offline“ anhaken.

## Guard-Gates

Jeder Commit läuft durch dieselben deterministischen Prüfungen, egal ob ein Mensch oder eine KI den Code geschrieben hat. Fällt eine durch, geht nichts live.

| Gate | Prüft | Werkzeug |
| --- | --- | --- |
| Formatierung | einheitlicher Code-Stil | Prettier |
| Lint | typische Fehler in TypeScript und Astro, Größe und Verschachtelung | ESLint |
| Architektur | Schichten: `lib` ist generisch, `data` kennt keine Oberfläche, Browser-Code bekommt keinen Build-Code, keine Zyklen | dependency-cruiser |
| Typen und Inhalte | TypeScript strikt, auch jeder Zugriff per Index (`noUncheckedIndexedAccess`), Markdown-Inhalte gegen ihr Schema | astro check |
| Unit-Tests | Regeln, Welt und Speichern des Spiels (Spec: [docs/specs/mitwachsen.md](docs/specs/mitwachsen.md)), Würfel-Grafik, die Gates selbst; die Abdeckung der reinen Module darf nicht sinken | Vitest, v8-Coverage |
| Fertige Seite | gültiges HTML, keine toten internen Links und Sprungmarken, Startseite ohne Spiel und im JavaScript-Budget, das Spiel lädt 3D erst bei Bedarf, keine externen Ressourcen ohne Klick, Manifest und Service Worker vollständig, vorab Gespeichertes im Budget | html-validate, linkinator, Bundle-Gate, Seiten-Gate, App-Gate |
| Im Browser | Seiten laden, das Spiel startet, auch ohne Netz, keine Fehler in der Konsole; installierbar laut Chromium; Updates von einer Fassung zur nächsten (zwei Fassungen, abgeleitet aus dem Build); Barrierefreiheit jeder Seite nach WCAG 2.2 AA | Playwright, axe-core |

Lokal laufen alle zusammen mit `npm run gates`. Zusätzlich prüft ein Git-Hook (`.githooks/pre-commit`) vor jedem Commit die schnellen Gates – Formatierung, Lint, Architektur, Unit-Tests. `npm install` aktiviert ihn automatisch; im Notfall überspringt `git commit --no-verify` ihn.

## Deployment

Die Pipeline `.github/workflows/deploy.yml` läuft bei jedem Pull Request (auch von Renovate) und bei jedem Push auf `main`. Ihre Jobs:

1. **Guard-Gates** – nur mit Leserechten und parallel: `static` (Formatierung, Lint, Architektur, Typen, Unit-Tests), `coverage` (Unit-Tests mit Mindest-Abdeckung), `build` (baut die Seite und prüft das Ergebnis mit `npm run verify`), danach die Browser-Tests auf genau diesem Build: `e2e-site` (Seiten ohne Spiel) und `e2e-game` (das Spiel, in zwei Teilen). `e2e-merge` führt deren Berichte zu einem zusammen (Artefakt `playwright-report`). Der Job `Guard-Gates` fasst alle Gates zu einem Ergebnis zusammen; er ist der einzige Pflicht-Check im Ruleset `protect main`.
2. **Deploy auf GitHub Pages** – nur auf `main`, erst wenn der Job `Guard-Gates` grün ist: veröffentlicht die fertige Seite mit `actions/deploy-pages`. Er braucht nur die Rechte `pages: write` und `id-token: write` und zum Lesen `contents: read` (ist `main` schon weiter, veröffentlicht der neuere Lauf), keine Schreibrechte aufs Repo, und installiert und baut nichts.

So laufen die Install-Skripte neuer Paketversionen nie mit einem Schreib-Token.

Für den Notfall gibt es `.github/workflows/fast-deploy.yml` (Schnell-Deploy): Er startet nur von Hand über die GitHub-Oberfläche (Actions → „Schnell-Deploy ohne Guard-Gates“ → Run workflow, Branch `main`), baut `main` und veröffentlicht sofort, ohne Guard-Gates und ohne Browser-Tests. Die Rechte sind dieselben wie oben; auch hier laufen die Install-Skripte ohne Schreib-Token.

In den GitHub-Pages-Einstellungen ist die Quelle „GitHub Actions“. Die Domain `weltenbummler.mitwachsen-spiele.de` steht dort ebenfalls (Custom domain), eine `CNAME`-Datei braucht es dafür nicht, und Jekyll läuft bei diesem Weg nicht, also auch kein `.nojekyll`. Alle Actions sind auf Commit-SHAs gepinnt.

Es gibt vorerst nur diese eine Stufe. Eine Teststufe ist für später geplant.

Renovate hält Abhängigkeiten und Actions aktuell. Neue Versionen werden erst nach drei Tagen vorgeschlagen (`minimumReleaseAge`). Minor- und Patch-Updates übernimmt Renovate automatisch, aber nur, wenn alle Guard-Gates grün sind. Major-Updates kommen als Pull Request zur Prüfung.

### Einmalig einrichten

Diese Einstellungen stehen nicht im Code und müssen einmal von Hand gesetzt werden. Der Umzug aus `larmic/mitwachsen-spiele` und sein Stand stehen in larmic/mitwachsen-spiele#71.

1. **DNS** bei OVH für `mitwachsen-spiele.de`: `weltenbummler` als `CNAME` auf `mitwachsen-spiele.github.io.`. Erst die Domain in GitHub eintragen (Schritt 3), dann den DNS-Eintrag; beim Rückbau umgekehrt, erst DNS löschen.
2. **Domain verifizieren** in der Organisation `mitwachsen-spiele` (Settings → Pages → „Add a domain“, TXT `_github-pages-challenge-mitwachsen-spiele`): Dann kann kein fremdes Repo die Domain oder eine ihrer Subdomains übernehmen.
3. **GitHub Pages** (Repo → Settings → Pages): Quelle „GitHub Actions“, Custom domain `weltenbummler.mitwachsen-spiele.de`, nach dem DNS-Check „Enforce HTTPS“ anhaken.
4. **Renovate**: Die Renovate-App (Mend) ist in der Organisation für alle Repos installiert. Die gemeinsamen Regeln stehen in [mitwachsen-spiele/renovate-config](https://github.com/mitwachsen-spiele/renovate-config), `renovate.json` hier ergänzt nur Eigenes.
5. **Ruleset `protect main`** (Settings → Rules): Löschen und Force-Push verboten, Pflicht-Check `Guard-Gates`. Ohne ihn übernimmt Renovate Updates per Automerge, ohne dass die Gates grün sein müssen.

## Datenschutz und Recht

- Impressum und Kontakt liegen auf larmic.de (`https://larmic.de/impressum/`, der Footer verlinkt dorthin); das Impressum dort gilt ausdrücklich auch für mitwachsen-spiele.de. Die Datenschutzerklärung ist eigen, unter `/datenschutz/`, weil sie nur beschreibt, was auf dieser Seite passiert.
- Beim Laden der Seite wird nichts von Dritten nachgeladen: Schriften sind lokal gebündelt, keine Cookies, kein Tracking.
- Der Spielstand bleibt im Browser (`localStorage`) und wird nicht übertragen.
- Der Service Worker speichert nur Dateien des Spiels von dieser Seite im Browser (Cache Storage), damit es ohne Netz startet; er sendet nichts.

## Design

Farben, Typografie und Bausteine stehen in [docs/design-system.md](docs/design-system.md). Die Design-Tokens liegen in `src/styles/tokens.css`.

## Lizenz

Der Quellcode steht unter der MIT-Lizenz. Texte, Bilder, Impressum und Datenschutzerklärung sind davon ausgenommen, hier sind alle Rechte vorbehalten. Details in [LICENSE](LICENSE).
