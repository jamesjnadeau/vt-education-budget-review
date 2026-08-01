# Explanations Section, Modeling Nav Dropdown & RSS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the current flat primary navigation into a "Modeling" dropdown, add a top-level "Explanations" section that publishes the four Markdown articles as pages with a landing index, and expose those articles as an RSS feed.

**Architecture:** The four articles move into an Astro **content collection** (`explanations`) under `site/src/content/explanations/`, each gaining YAML frontmatter (title, subtitle, description, pubDate, order). A pure helper sorts entries by series order. Two new Astro pages render the collection — an index landing page and a per-article dynamic route — and an `rss.xml` endpoint (via `@astrojs/rss`) emits the feed. The shared `Base.astro` layout gains a `<details>`-based "Modeling" dropdown (no-JS, keyboard-accessible), a top-level "Explanations" link, and an optional RSS autodiscovery `<link>`.

**Tech Stack:** Astro 7.1.6 (static output, Content Layer API with `glob` loader from `astro/loaders`, `astro:content` `getCollection`/`render`), `@astrojs/rss`, Zod (bundled with Astro via `astro:content`), vitest for the pure helper, plain CSS with existing design tokens.

## Global Constraints

- **Astro version:** 7.1.6, `output: 'static'`, `trailingSlash: 'always'`, `build.format: 'directory'`. Every emitted route is a directory with a trailing slash (`/explanations/`, `/explanations/<slug>/`).
- **Base path awareness:** URLs must be prefixed with `import.meta.env.BASE_URL` (config `base`, set from `SITE_BASE` in deploy). Never hardcode a leading `/` for internal links. The existing pattern is `const base = import.meta.env.BASE_URL.replace(/\/$/, '')` then `` `${base}/path/` ``.
- **Site origin:** `Astro.site` / `context.site` comes from config `site` (`SITE_URL` in deploy, `https://example.invalid` locally). RSS depends on it; do not hardcode an origin.
- **Content Layer API only:** Use `defineCollection({ loader: glob(...), schema })` in `site/src/content.config.ts`. Do NOT use the legacy `src/content/config.ts` + `type: 'content'` API. Render bodies with `import { render } from 'astro:content'` → `const { Content } = await render(entry)`. Entry ids come from the filename without extension (e.g. `vt-1-funding-history`).
- **Design tokens (already in `site/src/styles/global.css`):** `--bg`, `--surface`, `--text`, `--text-muted`, `--border`, `--accent` (`#2b5d4a`), `--link`, `--radius`. Dark mode is handled globally via `prefers-color-scheme`; new CSS must use these tokens, never literal colors.
- **Accessibility:** The dropdown must work without JavaScript and be keyboard-operable. Preserve the existing `<nav aria-label="Primary">` landmark and the `.skip-link`.
- **No new runtime JS frameworks.** The dropdown is native `<details>/<summary>`.
- **Article dates:** Assigned explicitly in frontmatter (sequential, matching series order). They are editorial data, not derived from git.

---

## File Structure

**Create:**
- `site/src/content.config.ts` — content collection config for `explanations` (glob loader + Zod schema).
- `site/src/content/explanations/vt-1-funding-history.md` — moved article + frontmatter.
- `site/src/content/explanations/vt-2-how-your-rate-is-set.md` — moved article + frontmatter.
- `site/src/content/explanations/vt-3-what-happens-by-2028.md` — moved article + frontmatter.
- `site/src/content/explanations/vt-4-glossary.md` — moved article + frontmatter.
- `site/src/lib/explanations.ts` — pure helper `sortExplanations()` (order, then pubDate). Single source of ordering for the index page and the RSS feed (DRY).
- `site/src/lib/explanations.test.ts` — vitest unit test for `sortExplanations()`.
- `site/src/pages/explanations/index.astro` — landing page listing articles.
- `site/src/pages/explanations/[slug].astro` — per-article page.
- `site/src/pages/explanations/rss.xml.ts` — RSS endpoint.

**Modify:**
- `site/src/layouts/Base.astro` — nav restructure (Modeling dropdown + Explanations link), optional `feedHref` prop → head autodiscovery `<link>`.
- `site/src/styles/global.css` — dropdown styles (append a scoped block).
- `site/package.json` — add `@astrojs/rss` dependency.
- `package.json` (root) — no change expected; RSS installs into the `site` workspace.
- `vitest.config.ts` (root) — extend `include` to cover `site/**/*.test.ts`.

**Delete (via `git mv`, so this is really a move):**
- `docs/explination-articles/vt-1-funding-history.md` … `vt-4-glossary.md` — relocated into the content collection. The now-empty `docs/explination-articles/` directory is removed.

---

## Task 1: Move articles into a content collection with frontmatter

Relocate the four Markdown files into the site's content directory and add the frontmatter the collection schema and RSS feed require. This task produces the raw content; the schema that validates it lands in Task 2, but the files must exist first so the schema has something to load.

**Files:**
- Create: `site/src/content/explanations/vt-1-funding-history.md` (from `docs/explination-articles/vt-1-funding-history.md`)
- Create: `site/src/content/explanations/vt-2-how-your-rate-is-set.md`
- Create: `site/src/content/explanations/vt-3-what-happens-by-2028.md`
- Create: `site/src/content/explanations/vt-4-glossary.md`
- Delete: the four originals under `docs/explination-articles/` (moved, not copied)

**Interfaces:**
- Produces: four Markdown entries whose glob-loader ids are `vt-1-funding-history`, `vt-2-how-your-rate-is-set`, `vt-3-what-happens-by-2028`, `vt-4-glossary`. Each frontmatter block exposes `title: string`, `subtitle: string`, `description: string`, `pubDate: Date`, `order: number`. Task 2's schema consumes exactly these keys; Tasks 4–6 read them off `entry.data`.

- [ ] **Step 1: Create the content directory and move the files with git**

```bash
cd /home/jamesn/Code/vt-budget-pipeline
mkdir -p site/src/content/explanations
git mv docs/explination-articles/vt-1-funding-history.md   site/src/content/explanations/vt-1-funding-history.md
git mv docs/explination-articles/vt-2-how-your-rate-is-set.md site/src/content/explanations/vt-2-how-your-rate-is-set.md
git mv docs/explination-articles/vt-3-what-happens-by-2028.md  site/src/content/explanations/vt-3-what-happens-by-2028.md
git mv docs/explination-articles/vt-4-glossary.md          site/src/content/explanations/vt-4-glossary.md
rmdir docs/explination-articles 2>/dev/null || true
```

- [ ] **Step 2: Add frontmatter to `vt-1-funding-history.md` and strip the now-duplicated title block**

The article currently begins:
```markdown
# How Vermont Pays For Schools

## The last 30 years, told in plain words

*Piece 1 of 3. Piece 2 explains how your own tax rate gets set. Piece 3 covers what happens between now and March 2028. A separate glossary defines every term used here.*

---

Vermont has changed the way it pays for schools many times.
```

Replace everything from the top of the file **through the first `---` divider line (inclusive)** with the frontmatter block below. The body now starts at `Vermont has changed the way it pays for schools many times.` The title/subtitle/dek move into frontmatter so the page header renders from data, not from prose, and there is exactly one `<h1>` per page.

```markdown
---
title: How Vermont Pays For Schools
subtitle: The last 30 years, told in plain words
description: Piece 1 of 3. Piece 2 explains how your own tax rate gets set. Piece 3 covers what happens between now and March 2028. A separate glossary defines every term used here.
pubDate: 2026-07-28
order: 1
---

Vermont has changed the way it pays for schools many times.
```

- [ ] **Step 3: Add frontmatter to `vt-2-how-your-rate-is-set.md`**

Replace from the top of the file through the first `---` divider (inclusive) with:

```markdown
---
title: Where Your School Tax Rate Comes From
subtitle: The math behind the number on your bill
description: Piece 2 of 3. Piece 1 tells the 30 year history. Piece 3 covers what happens between now and March 2028. A separate glossary defines every term used here.
pubDate: 2026-07-29
order: 2
---
```
Keep the original body (everything after the first `---`) unchanged.

- [ ] **Step 4: Add frontmatter to `vt-3-what-happens-by-2028.md`**

Replace from the top through the first `---` divider (inclusive) with:

```markdown
---
title: What Happens Between Now And March 2028
subtitle: Your town has a decision coming
description: Piece 3 of 3. Piece 1 tells the 30 year history. Piece 2 explains how your tax rate gets set. A separate glossary defines every term used here.
pubDate: 2026-07-30
order: 3
---
```
Keep the original body unchanged.

- [ ] **Step 5: Add frontmatter to `vt-4-glossary.md`**

Replace from the top through the first `---` divider (inclusive) with:

```markdown
---
title: "Vermont School Funding: Words To Know"
subtitle: A plain-language glossary
description: A plain-language glossary companion to the three-part series, defining every term in ABC order with the laws listed as a story at the end.
pubDate: 2026-07-31
order: 4
---
```
Keep the original body unchanged. (The title is quoted because it contains a colon, which is significant in YAML.)

- [ ] **Step 6: Verify the four files parse as YAML frontmatter + body**

Run:
```bash
cd /home/jamesn/Code/vt-budget-pipeline
for f in site/src/content/explanations/*.md; do
  echo "== $f =="
  head -8 "$f"
done
```
Expected: each file starts with `---`, shows the five frontmatter keys, a closing `---`, then prose. No stray `# ` heading remains inside the first eight lines.

- [ ] **Step 7: Commit**

```bash
cd /home/jamesn/Code/vt-budget-pipeline
git add -A
git commit -m "content: move explanation articles into site content collection with frontmatter"
```

---

## Task 2: Define the `explanations` content collection

Add the Content Layer config that loads the four Markdown files and validates their frontmatter. Without it, `getCollection('explanations')` returns nothing and later pages fail to build.

**Files:**
- Create: `site/src/content.config.ts`

**Interfaces:**
- Consumes: the four Markdown files from Task 1 (keys `title`, `subtitle`, `description`, `pubDate`, `order`).
- Produces: a collection named `explanations`. Each entry has `entry.id: string`, `entry.body`, and `entry.data: { title: string; subtitle: string; description: string; pubDate: Date; order: number }`. Tasks 4, 5, 6 all call `getCollection('explanations')` and read these.

- [ ] **Step 1: Write the collection config**

Create `site/src/content.config.ts`:

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const explanations = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/explanations' }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    order: z.number().int().positive(),
  }),
});

export const collections = { explanations };
```

- [ ] **Step 2: Verify Astro sees the collection and the schema validates**

Run:
```bash
cd /home/jamesn/Code/vt-budget-pipeline/site
npx astro sync
```
Expected: completes without a Zod validation error. Any frontmatter typo (missing key, bad date) surfaces here as `[InvalidContentEntryDataError]` naming the offending file — fix the file, not the schema. Success means `.astro/` types regenerate silently.

- [ ] **Step 3: Commit**

```bash
cd /home/jamesn/Code/vt-budget-pipeline
git add site/src/content.config.ts
git commit -m "feat: define explanations content collection with frontmatter schema"
```

---

## Task 3: Add the `sortExplanations` helper (TDD)

A single ordering function consumed by both the index page and the RSS feed, so the two never disagree on article order. This is the one piece of pure logic in the feature, so it gets a real unit test.

**Files:**
- Create: `site/src/lib/explanations.ts`
- Create: `site/src/lib/explanations.test.ts`
- Modify: `vitest.config.ts` (root) — add `site/**/*.test.ts` to `include`

**Interfaces:**
- Produces: `export function sortExplanations<T extends { data: { order: number; pubDate: Date } }>(entries: T[]): T[]` — returns a new array sorted ascending by `data.order`, breaking ties by earlier `data.pubDate`. Does not mutate its input. Tasks 4 and 6 call it.

- [ ] **Step 1: Extend vitest include so `site` tests run**

Edit `vitest.config.ts`. Change:
```ts
    include: ['model/**/*.test.ts', 'tools/**/*.test.ts'],
```
to:
```ts
    include: ['model/**/*.test.ts', 'tools/**/*.test.ts', 'site/**/*.test.ts'],
```

- [ ] **Step 2: Write the failing test**

Create `site/src/lib/explanations.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sortExplanations } from './explanations';

type Entry = { id: string; data: { order: number; pubDate: Date } };

const entry = (id: string, order: number, iso: string): Entry => ({
  id,
  data: { order, pubDate: new Date(iso) },
});

describe('sortExplanations', () => {
  it('orders by ascending order field', () => {
    const input = [
      entry('c', 3, '2026-07-30'),
      entry('a', 1, '2026-07-28'),
      entry('b', 2, '2026-07-29'),
    ];
    expect(sortExplanations(input).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('breaks ties on order by earlier pubDate', () => {
    const input = [
      entry('later', 1, '2026-07-31'),
      entry('earlier', 1, '2026-07-01'),
    ];
    expect(sortExplanations(input).map((e) => e.id)).toEqual(['earlier', 'later']);
  });

  it('does not mutate the input array', () => {
    const input = [entry('b', 2, '2026-07-29'), entry('a', 1, '2026-07-28')];
    const snapshot = input.map((e) => e.id);
    sortExplanations(input);
    expect(input.map((e) => e.id)).toEqual(snapshot);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run:
```bash
cd /home/jamesn/Code/vt-budget-pipeline
npx vitest run site/src/lib/explanations.test.ts
```
Expected: FAIL — `Failed to resolve import "./explanations"` (the module does not exist yet).

- [ ] **Step 4: Write the minimal implementation**

Create `site/src/lib/explanations.ts`:

```ts
export function sortExplanations<T extends { data: { order: number; pubDate: Date } }>(
  entries: T[],
): T[] {
  return [...entries].sort((a, b) => {
    if (a.data.order !== b.data.order) return a.data.order - b.data.order;
    return a.data.pubDate.getTime() - b.data.pubDate.getTime();
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run:
```bash
cd /home/jamesn/Code/vt-budget-pipeline
npx vitest run site/src/lib/explanations.test.ts
```
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
cd /home/jamesn/Code/vt-budget-pipeline
git add vitest.config.ts site/src/lib/explanations.ts site/src/lib/explanations.test.ts
git commit -m "feat: add sortExplanations helper with unit tests"
```

---

## Task 4: Build the Explanations index (landing) page

The single top-level "Explanations" destination: a page listing every article in series order, each linking to its own page. Uses the existing `Base` layout and card/lede styling.

**Files:**
- Create: `site/src/pages/explanations/index.astro`

**Interfaces:**
- Consumes: `getCollection('explanations')` (Task 2), `sortExplanations` (Task 3), `Base` layout at `../../layouts/Base.astro`.
- Produces: a page at `/explanations/`. It sets `<Base title="Explanations — Vermont School Budgets" feedHref={`${base}/explanations/rss.xml`}>` — the `feedHref` prop is added to `Base` in Task 7; passing it now is harmless because Astro ignores unknown props until the prop is declared, and Task 7 wires it. (If executing strictly in order, the autodiscovery link simply won't render until Task 7 lands.)

- [ ] **Step 1: Write the index page**

Create `site/src/pages/explanations/index.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import { getCollection } from 'astro:content';
import { sortExplanations } from '../../lib/explanations';

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const articles = sortExplanations(await getCollection('explanations'));

const dateFmt = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});
---

<Base
  title="Explanations — Vermont School Budgets"
  description="Plain-language explanations of how Vermont pays for schools, how your tax rate is set, what changes by 2028, and the words to know."
  feedHref={`${base}/explanations/rss.xml`}
>
  <h1>Explanations</h1>
  <p class="lede">
    Plain-language pieces on how Vermont funds its schools — the history, how your own
    rate is set, what a town decides before March 2028, and a glossary. Follow along by
    <a href={`${base}/explanations/rss.xml`}>RSS</a>.
  </p>

  <div class="grid">
    {
      articles.map((a) => (
        <article class="card">
          <h2 style="margin-top:0">
            <a href={`${base}/explanations/${a.id}/`}>{a.data.title}</a>
          </h2>
          <p style="color:var(--text-muted);margin:.25rem 0">{a.data.subtitle}</p>
          <p>{a.data.description}</p>
          <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:0">
            <time datetime={a.data.pubDate.toISOString()}>{dateFmt.format(a.data.pubDate)}</time>
          </p>
        </article>
      ))
    }
  </div>
</Base>
```

- [ ] **Step 2: Build the site and verify the index page renders all four articles**

Run:
```bash
cd /home/jamesn/Code/vt-budget-pipeline
npm run build:site
```
Then:
```bash
cat site/dist/explanations/index.html | grep -c 'class="card"'
grep -o 'How Vermont Pays For Schools\|Where Your School Tax Rate Comes From\|What Happens Between Now And March 2028\|Words To Know' site/dist/explanations/index.html | sort -u
```
Expected: the first command prints `4`; the second lists all four titles. (Article page links 404 until Task 5, which is fine — the index HTML is what this task verifies.)

- [ ] **Step 3: Commit**

```bash
cd /home/jamesn/Code/vt-budget-pipeline
git add site/src/pages/explanations/index.astro
git commit -m "feat: add explanations landing page listing articles in series order"
```

---

## Task 5: Build the per-article page

A dynamic route that renders each article's Markdown body under a header built from its frontmatter.

**Files:**
- Create: `site/src/pages/explanations/[slug].astro`

**Interfaces:**
- Consumes: `getCollection('explanations')` (Task 2), `render` from `astro:content`, `Base` layout.
- Produces: one page per entry at `/explanations/<id>/` (e.g. `/explanations/vt-1-funding-history/`). `getStaticPaths` maps `params.slug = entry.id` and passes the entry through `props`.

- [ ] **Step 1: Write the dynamic article page**

Create `site/src/pages/explanations/[slug].astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import { getCollection, render } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

export async function getStaticPaths() {
  const articles = await getCollection('explanations');
  return articles.map((entry) => ({
    params: { slug: entry.id },
    props: { entry },
  }));
}

type Props = { entry: CollectionEntry<'explanations'> };
const { entry } = Astro.props as Props;
const { Content } = await render(entry);

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const dateFmt = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});
---

<Base
  title={`${entry.data.title} — Vermont School Budgets`}
  description={entry.data.description}
  feedHref={`${base}/explanations/rss.xml`}
>
  <p style="margin-bottom:.5rem">
    <a href={`${base}/explanations/`}>← All explanations</a>
  </p>
  <article>
    <h1 style="margin-bottom:.25rem">{entry.data.title}</h1>
    <p class="lede" style="margin-top:0">{entry.data.subtitle}</p>
    <p style="color:var(--text-muted);font-size:.88rem">
      <time datetime={entry.data.pubDate.toISOString()}>{dateFmt.format(entry.data.pubDate)}</time>
    </p>
    <Content />
  </article>
</Base>
```

- [ ] **Step 2: Build and verify each article page exists and renders body prose**

Run:
```bash
cd /home/jamesn/Code/vt-budget-pipeline
npm run build:site
ls site/dist/explanations/*/index.html
```
Expected: four article directories —
`vt-1-funding-history/`, `vt-2-how-your-rate-is-set/`, `vt-3-what-happens-by-2028/`, `vt-4-glossary/` — each with `index.html`.

Then confirm the body Markdown actually rendered (not just the header):
```bash
grep -c 'Before 1997' site/dist/explanations/vt-1-funding-history/index.html
```
Expected: `≥ 1` (the "Before 1997: every town on its own" section heading from the body prose).

- [ ] **Step 3: Commit**

```bash
cd /home/jamesn/Code/vt-budget-pipeline
git add site/src/pages/explanations/[slug].astro
git commit -m "feat: render individual explanation article pages"
```

---

## Task 6: Add the RSS feed

Install `@astrojs/rss` and expose the collection at `/explanations/rss.xml`, ordered by the same helper the index uses.

**Files:**
- Modify: `site/package.json` (add dependency)
- Create: `site/src/pages/explanations/rss.xml.ts`

**Interfaces:**
- Consumes: `getCollection('explanations')` (Task 2), `sortExplanations` (Task 3), `context.site` (config `site`).
- Produces: an XML endpoint at `/explanations/rss.xml`. Each `<item>` has `title`, `description`, `pubDate`, and `link` = `${BASE_URL}explanations/<id>/`.

- [ ] **Step 1: Install `@astrojs/rss` into the site workspace**

Run:
```bash
cd /home/jamesn/Code/vt-budget-pipeline
npm install @astrojs/rss --workspace site
```
Expected: `@astrojs/rss` appears under `dependencies` in `site/package.json` and resolves in `node_modules`.

- [ ] **Step 2: Write the RSS endpoint**

Create `site/src/pages/explanations/rss.xml.ts`:

```ts
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { sortExplanations } from '../../lib/explanations';

export async function GET(context: APIContext) {
  const base = import.meta.env.BASE_URL; // has a trailing slash
  const articles = sortExplanations(await getCollection('explanations'));

  return rss({
    title: 'Vermont School Budgets — Explanations',
    description:
      'Plain-language explanations of how Vermont pays for schools, how your tax rate is set, and what changes by 2028.',
    site: context.site ?? 'https://example.invalid',
    items: articles.map((a) => ({
      title: a.data.title,
      description: a.data.description,
      pubDate: a.data.pubDate,
      link: `${base}explanations/${a.id}/`,
    })),
  });
}
```

- [ ] **Step 3: Build and verify the feed is well-formed and complete**

Run:
```bash
cd /home/jamesn/Code/vt-budget-pipeline
npm run build:site
test -f site/dist/explanations/rss.xml && echo "feed exists"
grep -c '<item>' site/dist/explanations/rss.xml
grep -o '<title>[^<]*</title>' site/dist/explanations/rss.xml | head
```
Expected: `feed exists`; item count is `4`; titles include the channel title plus the four article titles.

- [ ] **Step 4: Verify the XML parses (well-formedness)**

Run:
```bash
cd /home/jamesn/Code/vt-budget-pipeline
node -e "const fs=require('fs');const s=fs.readFileSync('site/dist/explanations/rss.xml','utf8');if(!s.includes('<rss'))throw new Error('no rss root');if((s.match(/<item>/g)||[]).length!==(s.match(/<\/item>/g)||[]).length)throw new Error('unbalanced items');console.log('rss ok')"
```
Expected: prints `rss ok`.

- [ ] **Step 5: Commit**

```bash
cd /home/jamesn/Code/vt-budget-pipeline
git add site/package.json package-lock.json site/src/pages/explanations/rss.xml.ts
git commit -m "feat: publish explanations RSS feed"
```

---

## Task 7: Restructure the navigation — Modeling dropdown + Explanations link + RSS autodiscovery

Fold the seven existing links into an expandable "Modeling" dropdown, add the top-level "Explanations" link, and render the optional RSS autodiscovery `<link>` from a new `feedHref` prop.

**Files:**
- Modify: `site/src/layouts/Base.astro`

**Interfaces:**
- Consumes: nothing new at build time; renders whatever `nav` array it holds.
- Produces: a `Base` component accepting an added optional prop `feedHref?: string`. When set, a `<link rel="alternate" type="application/rss+xml">` is emitted in `<head>`. The primary nav now contains a `<details class="nav-group">` labeled "Modeling" wrapping the seven prior links, followed by a top-level `<a>` to `/explanations/`.

- [ ] **Step 1: Update the `Base.astro` frontmatter — props and the nav model**

In `site/src/layouts/Base.astro`, change the `Props` interface and the `nav` constant. Replace:

```ts
interface Props {
  title: string;
  description?: string;
}

const { title, description } = Astro.props;
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const nav = [
  ['/model/', 'Modeling tool'],
  ['/su/', 'Supervisory unions'],
  ['/groupings/', 'Act 170 groupings'],
  ['/small-sparse/', 'Small & sparse schools'],
  ['/methodology/', 'Methodology'],
  ['/admin/coverage/', 'Coverage'],
  ['/changelog/', 'Changelog'],
];
```

with:

```ts
interface Props {
  title: string;
  description?: string;
  feedHref?: string;
}

const { title, description, feedHref } = Astro.props;
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const modelingNav = [
  ['/model/', 'Modeling tool'],
  ['/su/', 'Supervisory unions'],
  ['/groupings/', 'Act 170 groupings'],
  ['/small-sparse/', 'Small & sparse schools'],
  ['/methodology/', 'Methodology'],
  ['/admin/coverage/', 'Coverage'],
  ['/changelog/', 'Changelog'],
];
```

- [ ] **Step 2: Emit the RSS autodiscovery link in `<head>`**

In `site/src/layouts/Base.astro`, immediately after the existing description line inside `<head>`:

```astro
    {description && <meta name="description" content={description} />}
```
add:
```astro
    {feedHref && (
      <link
        rel="alternate"
        type="application/rss+xml"
        title="Vermont School Budgets — Explanations"
        href={feedHref}
      />
    )}
```

- [ ] **Step 3: Replace the nav markup with the dropdown + Explanations link**

In `site/src/layouts/Base.astro`, replace:

```astro
        <nav aria-label="Primary">
          {nav.map(([href, label]) => <a href={`${base}${href}`}>{label}</a>)}
        </nav>
```

with:

```astro
        <nav aria-label="Primary">
          <details class="nav-group">
            <summary>Modeling</summary>
            <div class="nav-group-menu">
              {modelingNav.map(([href, label]) => <a href={`${base}${href}`}>{label}</a>)}
            </div>
          </details>
          <a href={`${base}/explanations/`}>Explanations</a>
        </nav>
```

- [ ] **Step 4: Build and verify the nav markup changed as intended**

Run:
```bash
cd /home/jamesn/Code/vt-budget-pipeline
npm run build:site
grep -o '<summary>Modeling</summary>' site/dist/index.html
grep -o 'href="[^"]*explanations/"' site/dist/index.html | head -1
grep -c 'Modeling tool\|Supervisory unions\|Act 170 groupings\|Small &amp; sparse schools\|Methodology\|Coverage\|Changelog' site/dist/index.html
```
Expected: the `<summary>Modeling</summary>` line prints; an `explanations/` href prints; the seven-label count is `≥ 7` (they now live inside the details menu).

- [ ] **Step 5: Commit**

```bash
cd /home/jamesn/Code/vt-budget-pipeline
git add site/src/layouts/Base.astro
git commit -m "feat: group primary nav under a Modeling dropdown and add Explanations link"
```

---

## Task 8: Style the dropdown

Give the `<details>` dropdown a menu panel, hover/focus affordances, and dark-mode-correct colors using existing tokens. Native `<details>` already provides click-to-toggle and keyboard operation; this task is presentation only.

**Files:**
- Modify: `site/src/styles/global.css` (append a nav-group block)

**Interfaces:**
- Consumes: the `.nav-group` / `.nav-group-menu` / `summary` markup from Task 7 and the existing `--surface`, `--border`, `--radius`, `--text`, `--link` tokens.
- Produces: no API; visual styling only.

- [ ] **Step 1: Append dropdown styles**

Add to the end of `site/src/styles/global.css`:

```css
/* Primary-nav "Modeling" dropdown (native <details>, no JS). */
.nav-group {
  position: relative;
}
.nav-group > summary {
  cursor: pointer;
  list-style: none;
  color: var(--link);
  user-select: none;
}
.nav-group > summary::-webkit-details-marker {
  display: none;
}
.nav-group > summary::after {
  content: '▾';
  font-size: 0.7em;
  margin-left: 0.3em;
}
.nav-group[open] > summary::after {
  content: '▴';
}
.nav-group-menu {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.5rem;
  padding: 0.75rem 1rem;
  min-width: 12rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
  z-index: 20;
}
/* On narrow screens the absolute panel would overflow; let it flow inline. */
@media (max-width: 640px) {
  .nav-group-menu {
    position: static;
    box-shadow: none;
    margin-top: 0.4rem;
    min-width: 0;
  }
}
```

- [ ] **Step 2: Build and verify the styles ship**

Run:
```bash
cd /home/jamesn/Code/vt-budget-pipeline
npm run build:site
grep -ro 'nav-group-menu' site/dist/_astro/*.css | head -1
```
Expected: `nav-group-menu` appears in a built CSS bundle (styles were bundled, not dropped).

- [ ] **Step 3: Visually verify the dropdown in a browser (optional but recommended)**

Run:
```bash
cd /home/jamesn/Code/vt-budget-pipeline
npm run dev
```
Open the site, confirm: "Modeling" shows a ▾ marker; clicking it reveals the seven links in a bordered panel; "Explanations" sits beside it as a plain link and leads to the index; keyboard `Tab` to the summary + `Enter` toggles it. Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
cd /home/jamesn/Code/vt-budget-pipeline
git add site/src/styles/global.css
git commit -m "style: dropdown menu for the Modeling nav group"
```

---

## Task 9: Full build & link-check verification

Confirm the whole pipeline — data build plus site build — is green end to end and the new internal links resolve, matching what the deploy workflow runs.

**Files:** none (verification only)

- [ ] **Step 1: Run the full build the way deploy does**

Run:
```bash
cd /home/jamesn/Code/vt-budget-pipeline
npm run build:data && npm run build:site
```
Expected: both complete with exit code 0. The Astro build reports the `/explanations/` index, four `/explanations/<slug>/` pages, and `/explanations/rss.xml` among generated routes.

- [ ] **Step 2: Run the full test suite (helper test included)**

Run:
```bash
cd /home/jamesn/Code/vt-budget-pipeline
npm test
```
Expected: all tests pass, including `site/src/lib/explanations.test.ts` (now picked up by the widened vitest `include`).

- [ ] **Step 3: Type-check the site**

Run:
```bash
cd /home/jamesn/Code/vt-budget-pipeline/site
npx astro check
```
Expected: 0 errors. (Warnings about unrelated pre-existing files, if any, are acceptable — note them but do not fix out of scope.)

- [ ] **Step 4: Sanity-check the deploy artifact tree**

Run:
```bash
cd /home/jamesn/Code/vt-budget-pipeline
find site/dist/explanations -maxdepth 2 -name index.html -o -name rss.xml | sort
```
Expected: `site/dist/explanations/index.html`, one `index.html` per article directory, and `site/dist/explanations/rss.xml`.

- [ ] **Step 5: Final commit (only if the build produced tracked changes)**

The build writes to `site/dist/`, which is git-ignored, so there is normally nothing to commit here. If `git status` is clean, this task closes with no commit. If it is not, inspect why before committing:
```bash
cd /home/jamesn/Code/vt-budget-pipeline
git status
```

---

## Self-Review

**1. Spec coverage:**
- "Move all current navigation items under an expandable dropdown called Modeling" → Task 7 (`modelingNav` inside `<details><summary>Modeling</summary>`), Task 8 (styling). ✓
- "Add a new page link to an Explanations section" → Task 7 (top-level `/explanations/` link), Task 4 (index page). ✓
- "Use the content in docs/explination-articles to create a system where I can publish markdown-based articles" → Task 1 (move + frontmatter), Task 2 (collection), Task 5 (article pages). Publishing a new article later = drop a `.md` with frontmatter into `site/src/content/explanations/`. ✓
- "This group of pages should have an RSS feed" → Task 6 (`rss.xml`), Task 7 (autodiscovery `<link>`). ✓

**2. Placeholder scan:** No `TBD`/`TODO`/"add error handling"/"similar to Task N". All code blocks are complete and copy-pasteable; article frontmatter carries real titles/subtitles/descriptions pulled from the source files. ✓

**3. Type consistency:**
- Frontmatter keys `title/subtitle/description/pubDate/order` are identical across Task 1 (files), Task 2 (schema), Task 4/5/6 (`entry.data.*`). ✓
- `sortExplanations` signature (Task 3) matches its call sites: index page (Task 4) and RSS (Task 6) both pass `getCollection('explanations')` results, which satisfy the `{ data: { order; pubDate } }` constraint. ✓
- `feedHref` prop is added to `Base` in Task 7 and passed by Task 4/5 pages — noted in Task 4's interface that the prop is inert until Task 7. ✓
- Entry id (`entry.id`) is used consistently for both the article route param (Task 5) and the RSS link (Task 6). ✓

**Note on task ordering vs. build-green:** Tasks 4 and 5 each run `npm run build:site` in isolation. Because `feedHref` is passed before Task 7 declares the prop, Astro treats it as an ignored extra prop (no error) — the build stays green. If a strict executor prefers every intermediate build to also render the autodiscovery link, Task 7 may be reordered before Tasks 4–6 without any code change, since the nav restructure does not depend on the pages existing.
