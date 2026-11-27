import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The site allows four kinds of blank: not published, cannot be told,
// not checked yet, not decided yet. Copy outside those has no meaning to a reader.
const pagesDir = new URL('../pages', import.meta.url).pathname;

function astroFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return astroFiles(p);
    return p.endsWith('.astro') ? [p] : [];
  });
}

const files = astroFiles(pagesDir).map((p) => ({ p, text: readFileSync(p, 'utf8') }));

describe('blank copy stays inside the four kinds', () => {
  for (const banned of ['not usable', 'No group yet', '>send in<', "'send in'"]) {
    it(`no page says ${JSON.stringify(banned)}`, () => {
      const hits = files.filter((f) => f.text.includes(banned)).map((f) => f.p);
      expect(hits).toEqual([]);
    });
  }
});
