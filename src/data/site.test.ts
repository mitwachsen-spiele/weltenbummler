import { describe, expect, it } from 'vitest';
import { HOME_TITLE, HOME_URL, SITE } from './site';

describe('Seitendaten', () => {
  it('Titel nennt Name und Alter und passt ins Suchergebnis', () => {
    expect(HOME_TITLE).toContain(SITE.title);
    expect(HOME_TITLE).toContain('ab 3');
    expect(HOME_TITLE.length).toBeLessThanOrEqual(60);
  });

  it('Spiel und Homepage liegen unter mitwachsen-spiele.de', () => {
    expect(new URL(SITE.url).hostname).toBe('weltenbummler.mitwachsen-spiele.de');
    expect(new URL(HOME_URL).hostname).toBe('www.mitwachsen-spiele.de');
  });
});
