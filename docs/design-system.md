# Designsystem

Die Seite ist eine kleine Voxel-Welt: Himmel oben, darunter Gras, Erde und Stein. Gold ist die einzige Farbe für Aktionen. Alle Werte stehen als CSS-Variablen in `src/styles/tokens.css`. Übernommen aus der „Inselwelt“ von larmic.de, ohne Insel und Figur.

Vorbild ist die Optik von Hytale und Minecraft. Alle Grafiken sind eigene Voxel-Zeichnungen, ohne Logos, Figuren oder Texturen aus den Spielen.

## Grundfarben

| Rolle | Token | Wert | Einsatz |
| --- | --- | --- | --- |
| Tinte | `--ink` | #1d2838 | Text, Überschriften, alle Pixel-Rahmen |
| Himmel | `--sky-1/2/3` | #79c7ea, #8dd0ee, #a6dbf2 | Kopf als gestufter Verlauf mit harten Kanten |
| Gold | `--gold`, `--gold-light`, `--gold-dark` | #f0a531, #ffd47e, #b46a0c | Buttons, Fokus im Spiel |
| Papier | `--paper` | #fffdf7 | Inhaltspanel |
| Grau | `--muted` | #4b5563 | Unterzeilen |
| Fehlerrot | `--error` | #a3221b | Welt löschen im Spielmenü |
| Holz | `--wood-bg`, `--wood-frame` | #f3ead6, #b3a385 | Welten im Spielmenü |
| Erde | `--tex-dirt` + `--dirt-shade` | Textur, 40 % #2b1a0f darüber | Hintergrund hinter dem Inhalt |
| Stein | `--tex-stone` + `--stone-shade` | Textur, 62 % #14161c darüber | Footer |

Die Farben im Spiel selbst (Gegenden, Tiere, Figur) stehen in `src/data/games/mitwachsen.ts`.

## Typografie

| Schrift | Schnitte | Einsatz |
| --- | --- | --- |
| Pixelify Sans | 500, 700 | Logo, Überschriften, Buttons, Namen im Spiel |
| Nunito | 400, 600, 800 | Fließtext, 18–19 px, Zeilenhöhe 1,6–1,7 |

Beide Schriften sind über `@fontsource` lokal gebündelt.

## Bausteine

- **Pixel-Rahmen:** vier Box-Schatten in Tinte statt `border` (`--px-4`, `--px-3`). Dadurch fehlen die Eckpixel wie in einem Spiel-Interface. Große Flächen bekommen zusätzlich 12 px versetzten Schatten.
- **Goldener Button (`.pxbtn`):** innen oben helles, unten dunkles Kantenlicht, sinkt beim Klick 3 px ein.
- **Sprechblase:** weiß, 3 px Pixel-Rahmen, eckiger Zipfel (im Spiel, wenn die Figur müde wird).

## Bewegung

Animationen nutzen meist `steps()` für den Pixel-Look. Auf den Seiten außerhalb des Spiels bewegen sich nur die Wolken. Bei `prefers-reduced-motion` sind alle Animationen aus, auch im Spiel.

## Icons

Seiten-Icon und App-Icon ist ein Grasblock aus der eigenen Würfel-Grafik (`src/lib/voxel/icon.ts`), beim Build gerendert: `favicon.svg` und `favicon.ico` transparent, `apple-touch-icon.png` (180 px) und die Icons der App (192 und 512 px) auf `--sky-2`. Die maskierbaren Icons (`icon-maskable-*.png`) tragen den Würfel auf 60 % der Kante, damit runde Masken nichts abschneiden. `theme-color` und Hintergrund der App sind `--sky-1`. Die Werte stehen in `src/data/pwa.ts`, ein Test hält sie gleich mit `tokens.css`.

## Voxel-Technik

Die Blöcke der Seiten entstehen beim Build als SVG (`src/lib/voxel/`).

- **Projektion:** dimetrisch 2:1. Block (i, j, k) liegt bei X = (i − j)·40, Y = (i + j)·20 − k·44,8. Ein Würfel ist ein `<symbol>` mit `viewBox="0 0 80 84.8"` (`blocks.ts`, `cube.ts`).
- **Texturen:** 8×8 Pixel pro Fläche, definiert als Textraster in `textures.ts`. Schattierung: oben 5 % weiß, links 8 % schwarz, rechts 26 % schwarz. Das Spiel nutzt dieselben Texturen in seiner Ansicht von vorn und in 3D.
- **Szenen:** `ISLAND` in `blocks.ts` ist die schwebende Insel mit Baum, Pilz und Brett: im Vorschaubild (`og.png`); groß im Kopf der Homepage (Repo `website`). `tower(n)` stapelt n Blöcke (Erde, oben Gras) für die Altersstufen auf der Startseite. `sceneSvg` sortiert die Blöcke von hinten nach vorn und berechnet die viewBox.

### Im Spiel: Blöcke 8 × 8, Dinge fein

Das Spiel zeichnet sein Gelände mit denselben Texturen (8 × 8, `textures.ts`, in 3D mit `NearestFilter`), daran ändert sich nichts. Alles, was kein Gelände ist, wird fein (Entwurf „Feine Grafik“, Issue 13, ohne Schalter, in 2D und 3D gleich). Werte in `src/lib/games/shade.ts`, Muster in `src/lib/games/skins.ts`, Regeln in der Spec (`docs/specs/mitwachsen.md`, Zeile „Feinheit“).

- **Muster (Skin):** zwölf leise Muster je Material: `fell`, `haar`, `stoff`, `quilt` (Steppdecke), `holz`, `metall`, `schnee`, `lack`, `nadel`, `blatt`, `rinde`, `eisblock`. Jedes ist Grau mit Deckkraft, nahtlos gekachelt, und nimmt die Farbe des Teils an; es kommen also keine neuen Farben dazu. Entstehen zur Laufzeit (keine Bilddateien), Größe einer Kachel je Muster in Feldern (`SKIN_PERIOD`). Stein, Wolken und kleine Teile bleiben ohne Muster.
- **Seitenverlauf:** Seiten oben wie ihre Farbe, unten 14 % dunkler (3D ×0,86, 2D Schwarz 0,14 → 0,30); Oberseite hinten heller als vorn (×1,08 hinten, ×1,02 vorn). 2D und 3D verlaufen in dieselbe Richtung.
- **Helle Oberkante:** eine helle Linie an der Oberseite jedes Quaders ab 0,12 × 0,08 × 0,05 Feldern (Deckkraft 0,38, leuchtende Teile 0,6).
- **Leuchten (`halo`):** ein weicher Schein um kompakte leuchtende Teile (größte Kante höchstens 0,6 Feld), höchstens 64 zugleich, die nächsten zur Figur, auf der Ebene über dem Bild (nach Nacht und Dunkelmaske), Deckkraft 0,3 am Tag bis 0,55 in der Nacht, in der Grotte leiser. Leuchtende Teile werden an den Seiten nur halb so stark schattiert. **Nicht verwechseln mit der Art `'glow'`:** Das ist das Leuchten der Eiskristalle im Polarlicht (3D eigenes Material) und das scharfe Leuchten von Lichtpunkten und Lichtkanten; ein Teil kann beides sein.
- **Weiche Schatten:** unter Figur, Tieren, Fahrzeugen, Bäumen, Büschen und Findlingen ein runder Fleck, der beim Hüpfen kleiner und blasser wird (in 3D wirft die Sonne die Schatten der Dinge selbst). Am Boden neben höheren Blöcken (ab einer halben Ebene) dunkelt es weich ab: in 3D nur die Ecken der Oberseite (höchstens 30 %), in 2D ein Streifen 0,35 Felder von der Kante. Textur, Kachel und Form des Bodens bleiben.
- **Was Block bleibt:** Gelände samt Rand-Hecke, Böden der Welten (Rutschspur, Piste), Lava, Wasser, Torhäuser, Portale und Torplatten (ein Voxel-Baukasten zu 1/8 Feld; nur die Pflanzen darin sind fein).
