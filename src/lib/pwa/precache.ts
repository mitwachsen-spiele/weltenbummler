// Was der Service Worker vorab speichert (rein, ohne Dateisystem, damit testbar; das Einlesen macht der Aufrufer).
// Ausgangspunkt ist eine fertige Seite. Von ihr aus werden alle Verweise verfolgt, die der Browser für diese Seite
// lädt – Skripte, Stylesheets, Icons, Manifest, Bilder, url() in CSS, Importe in JavaScript, auch nachträgliche
// (`import("…")`) – bis nichts Neues mehr dazukommt. So fehlt nie eine Datei mit Hash im Namen, die es nach dem Build gibt.
// Läuft nur beim Build (Node).

import { createHash } from 'node:crypto';

/** Liest eine Datei der fertigen Seite (Pfad relativ zum Ausgabeordner), `null`, wenn es sie nicht gibt */
export type ReadFile = (path: string) => Uint8Array | null;

type Ref = { url: string; strict: boolean }; // strict: muss es geben (sonst ist der Build kaputt)

/** <link rel="…">, deren Ziel der Browser für die Seite lädt */
const LOADING_REL = new Set(['stylesheet', 'icon', 'apple-touch-icon', 'manifest', 'modulepreload', 'preload']);
const ASSET = /\.(?:js|mjs|css|png|webp|avif|jpe?g|gif|svg|ico|woff2?|m4a|mp3|ogg|wav|webmanifest|json)$/;

const attr = (attrs: string, name: string): string | null => {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
};
const srcset = (v: string | null) => (v ?? '').split(',').flatMap((c) => c.trim().split(/\s+/)[0] || []);

/** Adressen in CSS: url(…) und @import */
export const cssRefs = (css: string): string[] =>
  [...css.matchAll(/(?:url\(\s*['"]?|@import\s+['"])([^'")\s]+)/gi)].map((m) => m[1]!);

/** Verweise einer HTML-Seite, die der Browser beim Laden holt (keine Links, kein canonical, keine og:-Bilder) */
export function htmlRefs(html: string): string[] {
  const out: string[] = [];
  for (const [, tag = '', attrs = ''] of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const name = tag.toLowerCase();
    if (name === 'link') {
      const rels = (attr(attrs, 'rel') ?? '').toLowerCase().split(/\s+/);
      const href = attr(attrs, 'href');
      if (href && rels.some((r) => LOADING_REL.has(r))) out.push(href);
    } else if (['script', 'img', 'source', 'audio', 'video'].includes(name)) {
      const src = attr(attrs, 'src');
      if (src) out.push(src);
      out.push(...srcset(attr(attrs, 'srcset')));
    }
    const style = attr(attrs, 'style');
    if (style) out.push(...cssRefs(style));
  }
  for (const [, css = ''] of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) out.push(...cssRefs(css));
  return out;
}

/**
 * Verweise in (auch minifiziertem) JavaScript: statische und nachträgliche Importe (müssen existieren) und
 * Zeichenketten, die wie eine Datei der Seite aussehen, z. B. eine Aufnahme (werden nur genommen, wenn es sie gibt).
 */
export function jsRefs(code: string): Ref[] {
  const out: Ref[] = [];
  const q = `["'\`]`;
  const imports = [
    new RegExp(`\\bimport\\s*(?:[\\w$*{}\\s,]+?\\s*from\\s*)?${q}(\\.{1,2}/[^"'\`]+)${q}`, 'g'),
    new RegExp(`\\bexport\\s*(?:\\*|\\{[^}]*\\})\\s*from\\s*${q}(\\.{1,2}/[^"'\`]+)${q}`, 'g'),
    new RegExp(`\\bimport\\s*\\(\\s*${q}(\\.{1,2}/[^"'\`]+)${q}\\s*\\)`, 'g'),
  ];
  for (const re of imports) for (const m of code.matchAll(re)) out.push({ url: m[1]!, strict: true });
  for (const m of code.matchAll(/["'`]((?:\.{1,2})?\/[\w./-]+)["'`]/g))
    if (ASSET.test(m[1]!)) out.push({ url: m[1]!, strict: false });
  return out;
}

/** Icons aus einem Web-App-Manifest */
export function manifestRefs(json: string): string[] {
  try {
    const m = JSON.parse(json) as { icons?: { src?: unknown }[] };
    return (m.icons ?? []).flatMap((i) => (typeof i.src === 'string' ? [i.src] : []));
  } catch {
    return [];
  }
}

/** Pfad auf der eigenen Seite (z. B. "/_astro/a.js") oder `null`, wenn die Adresse woanders hinführt */
export function sameOriginPath(ref: string, base: string, origin: string): string | null {
  if (/^(?:data|blob|mailto|tel|javascript):/i.test(ref) || ref.startsWith('#')) return null;
  try {
    const u = new URL(ref, new URL(base, origin));
    return u.origin === new URL(origin).origin ? decodeURI(u.pathname) : null;
  } catch {
    return null;
  }
}

/** Datei im Ausgabeordner zu einem Pfad: Ordner liefern ihre index.html */
export const distFile = (path: string) => (path.endsWith('/') ? `${path}index.html` : path).replace(/^\//, '');

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

function refsOf(path: string, bytes: Uint8Array): Ref[] {
  const file = distFile(path);
  const strict = (urls: string[]) => urls.map((url) => ({ url, strict: true }));
  if (file.endsWith('.html')) return strict(htmlRefs(text(bytes)));
  if (file.endsWith('.css')) return strict(cssRefs(text(bytes)));
  if (/\.m?js$/.test(file)) return jsRefs(text(bytes));
  if (/\.(webmanifest|json)$/.test(file)) return strict(manifestRefs(text(bytes)));
  return [];
}

export type Precache = {
  files: string[]; // Pfade auf der eigenen Seite, sortiert, beginnend mit "/"
  missing: string[]; // Verweise auf Dateien, die es nicht gibt (Build kaputt)
  foreign: string[]; // Verweise auf andere Seiten (werden nie gespeichert)
};

/**
 * Alles, was die Seite `entry` (z. B. "/") braucht, ausgehend von ihrem HTML. `skip` bleibt draußen, etwa der
 * Service Worker selbst (den holt der Browser immer aus dem Netz).
 */
export function precacheList(entry: string, read: ReadFile, origin: string, skip: string[] = []): Precache {
  const files = new Set<string>();
  const missing = new Set<string>();
  const foreign = new Set<string>();
  const queue: Ref[] = [{ url: entry, strict: true }];
  const bases = new Map<Ref, string>([[queue[0]!, entry]]);
  while (queue.length) {
    const ref = queue.shift()!;
    const path = sameOriginPath(ref.url, bases.get(ref) ?? '/', origin);
    if (path === null) {
      if (/^(https?:)?\/\//i.test(ref.url)) foreign.add(ref.url);
      continue;
    }
    if (files.has(path) || skip.includes(path)) continue;
    const bytes = read(distFile(path));
    if (!bytes) {
      if (ref.strict) missing.add(path);
      continue;
    }
    files.add(path);
    for (const next of refsOf(path, bytes)) {
      bases.set(next, path);
      queue.push(next);
    }
  }
  return { files: [...files].sort(), missing: [...missing].sort(), foreign: [...foreign].sort() };
}

/** Version aus Pfaden und Inhalten (SHA-256, gekürzt): Ändert sich eine Datei, ändert sich die Version */
export function cacheVersion(files: string[], read: ReadFile): string {
  const hash = createHash('sha256');
  for (const f of [...files].sort()) {
    hash.update(`${f}\0`);
    hash.update(read(distFile(f)) ?? new Uint8Array());
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}
