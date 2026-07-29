// @ts-check
import { defineConfig } from 'astro/config';

// SITE_URL is set by the Pages deploy workflow. Locally it is undefined, which
// is fine -- Astro only needs it to emit absolute URLs in sitemaps/canonicals.
const site = process.env.SITE_URL ?? 'https://example.invalid';
const base = process.env.SITE_BASE ?? undefined;

export default defineConfig({
  site,
  ...(base ? { base } : {}),
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  devToolbar: {
    enabled: false,
  },
});
