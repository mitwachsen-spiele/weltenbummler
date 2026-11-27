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
