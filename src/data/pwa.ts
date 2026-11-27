// Das Spiel als installierbare App (PWA): Manifest, Icons und Service Worker. Spec: docs/specs/mitwachsen.md („App“).
// Wird auch im Browser gelesen (Anmeldung des Service Workers), darum nur Daten, keine Imports aus lib.

/** Farben wie in src/styles/tokens.css (--sky-1, --sky-2); ein Test prüft, dass sie übereinstimmen */
export const SKY_1 = '#79c7ea';
export const SKY_2 = '#8dd0ee';

export const APP = {
  name: 'Mitwachsen',
  shortName: 'Mitwachsen',
  description: 'Ein ruhiges Spiel für Kinder ab 3 Jahren, gespielt zusammen mit Mama oder Papa.',
  lang: 'de',
  startUrl: '/',
  // Die ganze Seite, damit „Zum Home-Bildschirm“ auch auf der Startseite die App installiert; gespeichert und
  // offline ist nur das Spiel (Service Worker unten)
  scope: '/',
  // standalone statt fullscreen: Uhr und Akku bleiben für Eltern sichtbar, Vollbild gibt es im Menü
  display: 'standalone',
  themeColor: SKY_1,
  backgroundColor: SKY_1,
} as const;

/** Icons der App: Grasblock auf Himmel; maskable mit Rand, damit runde und eckige Masken nichts abschneiden */
export const APP_ICONS = [
  { file: 'icon-192.png', size: 192, purpose: 'any' },
  { file: 'icon-512.png', size: 512, purpose: 'any' },
  { file: 'icon-maskable-192.png', size: 192, purpose: 'maskable' },
  { file: 'icon-maskable-512.png', size: 512, purpose: 'maskable' },
] as const;

/** Anteil des Bildes, den der Würfel einnimmt: ganz für „any“, innerhalb der sicheren Zone (80 %) für „maskable“ */
export const ICON_FILL = { any: 0.86, maskable: 0.6 } as const;

export const SERVICE_WORKER = {
  url: '/sw.js',
  scope: '/', // die ganze Adresse gehört dem Spiel
  entry: '/', // von dieser Seite aus wird gesammelt, was vorab gespeichert wird
  prefix: 'mitwachsen-', // Präfix der Caches, die der Service Worker anlegt und wieder löscht
} as const;
