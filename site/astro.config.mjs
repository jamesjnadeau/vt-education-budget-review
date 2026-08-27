// @ts-check
import { defineConfig } from 'astro/config';

// SITE_URL is set by the Pages deploy workflow. Locally it is undefined, which
// is fine -- Astro only needs it to emit absolute URLs in sitemaps/canonicals.
const site = process.env.SITE_URL ?? 'https://example.invalid';
// SITE_BASE comes from actions/configure-pages. On the project-page URL it is
// '/vt-education-budget-review'; on a custom domain the site lives at the root
// and the action reports '' or '/'. `||` rather than `??` so an empty string
// falls through to undefined and Astro applies its own '/' default -- an
// explicit base of '' leaves import.meta.env.BASE_URL without the trailing
// slash that rss.xml.ts and the nav link builders assume.
const base = process.env.SITE_BASE || undefined;

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
