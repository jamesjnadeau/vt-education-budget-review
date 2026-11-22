// @ts-check
import { defineConfig } from 'astro/config';

// SITE_URL is set by netlify.toml for production builds. Locally it is undefined, which
// is fine -- Astro only needs it to emit absolute URLs in sitemaps/canonicals.
const site = process.env.SITE_URL ?? 'https://example.invalid';

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  devToolbar: {
    enabled: false,
  },
});
