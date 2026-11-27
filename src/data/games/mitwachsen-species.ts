// Tiere von Mitwachsen als Bauplan: Ton, Gangart und Modell einer Art. Die Arten selbst stehen in mitwachsen.ts
// (Lichtung), mitwachsen-eis.ts (Eis-Welt) und mitwachsen-hoehle.ts (Höhlenwelt); hier nur ihre Form, damit alle sie
// ohne Kreis nutzen.
// Konzept: docs/games/mitwachsen.md · Spec: docs/specs/mitwachsen.md

import type { Part } from '../../lib/games/front';

/** Ton eines Tiers: Folge von Tönen (Hz) mit Wellenform; alle aus der Pentatonik C–D–E–G–A, klingen also zusammen */
export type Tone = {
  notes: readonly number[];
  wave: OscillatorType;
  len: number;
  gap: number;
  slide?: number;
  gain?: number;
};

/** Gangart beim Gleiten (nur Zierde, nicht bei reduzierter Bewegung); ohne Angabe ein kleiner Hüpfer je Schritt */
export type Gait = 'watscheln' | 'robben' | 'huepfen' | 'huschen' | 'flattern';

/** Eine Art: Name, Größe, Modell aus Quadern (`front.ts`), Ton und Gangart */
export type SpeciesOf<Id extends string> = {
  id: Id;
  name: string;
  scale: number;
  parts: readonly Part[];
  tone: Tone;
  gait?: Gait;
  /**
   * Ruhehaltung: Diese Art hängt kopfüber an einem Sitzplatz (`Cell.perch`, in der Grotte der Kristallbogen). Steht
   * ein frei umherlaufendes Tier dieser Art dort, bleibt es hängen, bis man es findet, und zeigt dieses Modell (es hängt
   * von z = 0 nach unten, die Ansicht hängt es an die Höhe des Sitzplatzes). Schon die Angabe macht die Art zum Hänger;
   * das Modell bringt das Welt-Paket mit (`addModels`), bis dahin ist es leer (Fledermaus)
   */
  roost?: readonly Part[];
  /**
   * Modell ohne den, der auf ihr sitzt (Tok ohne den Maulwurf auf dem Helm, nachdem der eingezogen ist): Ein Tier mit
   * `solo` zeigt es; das Modell bringt das Welt-Paket mit (`WorldPack.solos`)
   */
  solo?: readonly Part[];
  /**
   * Grundform ohne die Feinteile (Schnurrhaare, Nasenlöcher, Krallen …, `fineSpecies` in mitwachsen-fine.ts): Aus ihr
   * rastert „Noch nicht“ den Umriss (`silhouette`), damit Feinteile ihn nicht verdicken oder ein Auge verdecken
   */
  outline?: readonly Part[];
};
