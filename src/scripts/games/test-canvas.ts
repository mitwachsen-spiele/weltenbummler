// Nur für Unit-Tests (ohne Browser): ein Canvas-Kontext als Attrappe, der jeden Aufruf annimmt, und ein `document`, das
// solche Canvases baut, damit feine Bilder (Muster, Bild-Cache `Sprites` in mitwachsen-fine-2d.ts) auch in Node
// zeichnen. Was gezählt werden soll (gemalte Flächen, gesetzte Bilder), meldet `count`.

/** Kontext, der jede Methode annimmt; `fillRect`, `fill` und `drawImage` melden sich bei `count` */
export function anyContext(count: (what: string) => void = () => {}): CanvasRenderingContext2D {
  const state: Record<string | symbol, unknown> = { globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1 };
  const calls: Record<string, (...a: number[]) => unknown> = {
    createPattern: () => ({ setTransform: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createImageData: (w = 1, h = 1) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    getTransform: () => ({ a: 1 }),
    fillRect: () => count('fillRect'),
    fill: () => count('fill'),
    drawImage: () => count('drawImage'),
  };
  return new Proxy(state, {
    get: (t, k) => (k in t ? t[k] : (calls[k as string] ?? (() => {}))),
    set: (t, k, v) => {
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

/** `document` und `DOMMatrix` als Attrappen einsetzen; liefert, was sie wieder entfernt */
export function fakeDocument(): () => void {
  const g = globalThis as Record<string, unknown>;
  const before = { document: g.document, DOMMatrix: g.DOMMatrix };
  g.document = {
    createElement: () => {
      const ctx = anyContext();
      return { width: 0, height: 0, getContext: () => ctx };
    },
  };
  g.DOMMatrix = class {
    scale() {
      return this;
    }
  };
  return () => {
    g.document = before.document;
    g.DOMMatrix = before.DOMMatrix;
  };
}
