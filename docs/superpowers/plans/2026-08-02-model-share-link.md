# Shareable Scenario Link for the What-if Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user of the `/model` what-if tool copy a link that encodes every value they entered, so anyone who opens that link sees the same scenario.

**Architecture:** A new pure module `site/src/scripts/share-link.ts` owns the mapping between the form's fields and readable URL query parameters, and the encode/decode/URL-build logic — fully unit-tested under the repo's `node` vitest environment, exactly like the existing `statewide-average.ts`. The island (`model-tool.ts`) stays thin glue: on load it decodes `window.location.search` and writes the values into the form before the first compute; a new "Copy shareable link" button reads the current form into a scenario, builds the URL, and copies it to the clipboard. A small block of markup in `index.astro` adds the button and a live-region status line.

**Tech Stack:** TypeScript, Astro (static site), Vitest (`environment: 'node'`), the browser's native `URLSearchParams` and `navigator.clipboard`. No new dependencies.

## Global Constraints

- **No new dependencies.** `URLSearchParams` and `navigator.clipboard` are browser/Node built-ins; do not add a query-string or clipboard library.
- **Vitest environment is `node`** (see `vitest.config.ts`) — there is no DOM in tests. All *logic* lives in pure functions tested without a DOM; DOM reads/writes stay in the island and are verified in the browser preview. This mirrors the `statewide-average.ts` / `statewide-average.test.ts` precedent.
- **Readable query parameters.** The URL uses named, human-readable, hand-editable params (e.g. `?mode=2027&spending=3370000&cla=0.8`), not an opaque encoded blob.
- **Explicit copy button**, not live address-bar syncing. The address bar stays clean while the user edits; the link is produced only when the button is clicked.
- **Only non-empty values are encoded.** A blank field is omitted from the URL so a shared link never asserts a value the sharer did not enter. Decoding likewise ignores absent and empty params, leaving the form's HTML defaults in place.
- **Unknown query params are ignored** on decode, so the tool is robust to junk, tracking params, or params from a future version.
- **Test files** use `.test.ts` next to the module and are picked up by the existing `site/**/*.test.ts` include glob. Run tests with `npm test` from the repo root; typecheck with `npm run typecheck`.

---

## File Structure

- **Create** `site/src/scripts/share-link.ts` — the shareable-field registry (`SHARE_FIELDS`), plus pure `encodeScenario`, `decodeScenario`, and `shareUrl`. One responsibility: translate between the form's field values and a URL.
- **Create** `site/src/scripts/share-link.test.ts` — unit tests for the three pure functions and the registry.
- **Modify** `site/src/scripts/model-tool.ts` — import from `share-link.ts`; add thin `readScenario`/`applyScenario` DOM helpers; restore from the URL on load; wire the copy button.
- **Modify** `site/src/pages/model/index.astro` — add the "Copy shareable link" button and status line markup after the form.
- **Modify** `site/src/styles/global.css` — add layout styling for the share toolbar and status line.

The form fields already exist in `index.astro` with stable `id`s; this feature only reads and writes their values. The `parameter-mode` `<select>` is treated as just another field (its `.value` reads and writes like an input), so no field needs special-casing.

---

### Task 1: Pure share-link module (encode / decode / URL)

This task delivers the entire URL-translation logic as pure functions with no DOM, so it is fully unit-tested and independently reviewable.

**Files:**
- Create: `site/src/scripts/share-link.ts`
- Test: `site/src/scripts/share-link.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module; uses only the built-in `URLSearchParams`).
- Produces:
  - `type Scenario = Record<string, string>` — a map keyed by **DOM element id** (e.g. `'spending'`, `'parameter-mode'`) to the field's string value.
  - `interface ShareField { readonly id: string; readonly param: string }`
  - `const SHARE_FIELDS: readonly ShareField[]` — the ordered registry, `parameter-mode` first.
  - `function encodeScenario(scenario: Scenario): string` — a query string **without** a leading `?`, containing one `param=value` pair per non-empty field, in `SHARE_FIELDS` order.
  - `function decodeScenario(query: string): Scenario` — parses a query string (with or without a leading `?`; `URLSearchParams` accepts both) into a `Scenario` keyed by DOM id, including only recognized, non-empty params.
  - `function shareUrl(base: string, scenario: Scenario): string` — `base` when the scenario encodes to nothing, otherwise `` `${base}?${encodeScenario(scenario)}` ``.

- [ ] **Step 1: Write the failing test**

Create `site/src/scripts/share-link.test.ts`:

```ts
/**
 * The scenario <-> URL translation for the what-if tool's shareable links.
 *
 * The what-if form is entirely made of values a reader is supposing about a
 * district, so a link that reproduces those values must round-trip exactly and
 * must never assert a value the sharer left blank. This logic is pure so it can
 * be tested without a DOM; the island is thin glue over it (cf. statewide-average).
 */

import { describe, expect, it } from 'vitest';

import {
  SHARE_FIELDS,
  decodeScenario,
  encodeScenario,
  shareUrl,
  type Scenario,
} from './share-link.ts';

describe('SHARE_FIELDS', () => {
  it('leads with the parameter-mode selector', () => {
    expect(SHARE_FIELDS[0]).toEqual({ id: 'parameter-mode', param: 'mode' });
  });

  it('has unique ids and unique params', () => {
    const ids = SHARE_FIELDS.map((f) => f.id);
    const params = SHARE_FIELDS.map((f) => f.param);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(params).size).toBe(params.length);
  });
});

describe('encodeScenario', () => {
  it('emits one param per non-empty field, in registry order, using param names', () => {
    const scenario: Scenario = { spending: '3370000', 'parameter-mode': '2027', cla: '0.8' };
    // parameter-mode is first in SHARE_FIELDS, so mode leads regardless of insertion order.
    expect(encodeScenario(scenario)).toBe('mode=2027&spending=3370000&cla=0.8');
  });

  it('omits empty and whitespace-only values', () => {
    const scenario: Scenario = { spending: '3370000', cla: '', density: '   ' };
    expect(encodeScenario(scenario)).toBe('spending=3370000');
  });

  it('url-encodes text field values', () => {
    expect(encodeScenario({ 'small-school-name': 'Maple & Oak' })).toBe('school=Maple+%26+Oak');
  });

  it('returns an empty string for an empty scenario', () => {
    expect(encodeScenario({})).toBe('');
  });
});

describe('decodeScenario', () => {
  it('maps recognized params back to their DOM ids', () => {
    expect(decodeScenario('mode=2027&spending=3370000&cla=0.8')).toEqual({
      'parameter-mode': '2027',
      spending: '3370000',
      cla: '0.8',
    });
  });

  it('accepts a leading question mark', () => {
    expect(decodeScenario('?spending=3370000')).toEqual({ spending: '3370000' });
  });

  it('ignores unknown params', () => {
    expect(decodeScenario('spending=3370000&utm_source=twitter&junk=1')).toEqual({
      spending: '3370000',
    });
  });

  it('ignores empty param values', () => {
    expect(decodeScenario('spending=&cla=0.8')).toEqual({ cla: '0.8' });
  });

  it('decodes url-encoded text back to its original value', () => {
    expect(decodeScenario('school=Maple+%26+Oak')).toEqual({ 'small-school-name': 'Maple & Oak' });
  });

  it('returns an empty scenario for an empty query', () => {
    expect(decodeScenario('')).toEqual({});
  });
});

describe('round trip', () => {
  it('encode then decode yields the original non-empty values', () => {
    const scenario: Scenario = {
      'parameter-mode': 'example',
      'prek-1': '10',
      'small-school-name': 'A & B School',
      spending: '3370000',
      cla: '0.8',
    };
    expect(decodeScenario(encodeScenario(scenario))).toEqual(scenario);
  });
});

describe('shareUrl', () => {
  it('appends the query to the base url', () => {
    expect(shareUrl('https://example.org/model', { spending: '3370000' })).toBe(
      'https://example.org/model?spending=3370000',
    );
  });

  it('returns the bare base url when the scenario is empty', () => {
    expect(shareUrl('https://example.org/model', {})).toBe('https://example.org/model');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- share-link`
Expected: FAIL — the module `./share-link.ts` does not exist yet (import/resolve error).

- [ ] **Step 3: Write the minimal implementation**

Create `site/src/scripts/share-link.ts`:

```ts
/**
 * Scenario <-> URL translation for the what-if tool's shareable links.
 *
 * Every field on the what-if form is a value the reader is supposing about a
 * district, so a shareable link is just those values written into the URL. This
 * module owns two things and nothing else: the map from each form field's DOM id
 * to a short, readable query-parameter name, and the pure encode/decode/build
 * functions over that map. It touches no DOM, so it is unit-tested directly; the
 * island (model-tool.ts) is thin glue that reads the form into a Scenario and
 * writes a decoded Scenario back into the form -- the same shape as the
 * statewide-average helper.
 *
 * Design rules, all enforced by tests:
 *   - Only non-empty values are encoded. A blank field is left out of the URL,
 *     so a shared link never asserts a value the sharer did not enter, and a
 *     decoded link never overwrites a field the link did not carry.
 *   - Unknown params are ignored on decode, so the tool tolerates tracking
 *     params, hand edits, or params from a later version.
 *   - Param names are readable and hand-editable, and decoupled from the DOM ids
 *     so a future id rename need not break existing links (update the registry).
 */

/** A form field's value, keyed by its DOM element id. */
export type Scenario = Record<string, string>;

/** One shareable field: its DOM element id and the URL query key it maps to. */
export interface ShareField {
  readonly id: string;
  readonly param: string;
}

// The order here is the order params appear in the URL. parameter-mode leads so
// the fiscal year / example choice is the first thing a reader sees in the link.
// Every id below is an existing element id in site/src/pages/model/index.astro.
export const SHARE_FIELDS: readonly ShareField[] = [
  { id: 'parameter-mode', param: 'mode' },
  { id: 'prek-1', param: 'prek1' },
  { id: 'k5-1', param: 'k5_1' },
  { id: 'g68-1', param: 'g68_1' },
  { id: 'g912-1', param: 'g912_1' },
  { id: 'prek-2', param: 'prek2' },
  { id: 'k5-2', param: 'k5_2' },
  { id: 'g68-2', param: 'g68_2' },
  { id: 'g912-2', param: 'g912_2' },
  { id: 'state-placed', param: 'state_placed' },
  { id: 'econ', param: 'econ' },
  { id: 'el', param: 'el' },
  { id: 'density', param: 'density' },
  { id: 'small-school-name', param: 'school' },
  { id: 'small-school-enrollment', param: 'enrollment' },
  { id: 'spending', param: 'spending' },
  { id: 'cla', param: 'cla' },
  { id: 'statewide-avg', param: 'statewide_avg' },
];

/**
 * Encode a scenario into a query string (no leading '?'), one param per
 * non-empty field, in SHARE_FIELDS order. URLSearchParams handles escaping.
 */
export function encodeScenario(scenario: Scenario): string {
  const params = new URLSearchParams();
  for (const { id, param } of SHARE_FIELDS) {
    const value = scenario[id];
    if (value !== undefined && value.trim() !== '') params.set(param, value);
  }
  return params.toString();
}

/**
 * Decode a query string (with or without a leading '?') into a scenario keyed by
 * DOM id, including only recognized, non-empty params. Unknown params are dropped.
 */
export function decodeScenario(query: string): Scenario {
  const params = new URLSearchParams(query);
  const scenario: Scenario = {};
  for (const { id, param } of SHARE_FIELDS) {
    const value = params.get(param);
    if (value !== null && value.trim() !== '') scenario[id] = value;
  }
  return scenario;
}

/** Build a full shareable URL from a base (origin + pathname) and a scenario. */
export function shareUrl(base: string, scenario: Scenario): string {
  const query = encodeScenario(scenario);
  return query === '' ? base : `${base}?${query}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- share-link`
Expected: PASS — all tests in `share-link.test.ts` green.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add site/src/scripts/share-link.ts site/src/scripts/share-link.test.ts
git commit -m "feat(model): pure encode/decode for shareable scenario links"
```

---

### Task 2: Wire the copy button and URL restore into the what-if tool

This task adds the button markup, its styling, and the island glue that restores a shared scenario on load and copies a link on click. Because the vitest environment is `node` (no DOM), the glue is verified in the browser preview rather than by unit tests — the testable logic already lives in Task 1's pure functions.

**Files:**
- Modify: `site/src/pages/model/index.astro` (add markup after the `</form>`, around line 176)
- Modify: `site/src/scripts/model-tool.ts` (imports at top ~line 44; add helpers; extend `initModelTool` ~lines 440–583)
- Modify: `site/src/styles/global.css` (append share-toolbar styles)

**Interfaces:**
- Consumes from Task 1: `SHARE_FIELDS`, `decodeScenario`, `shareUrl`, and `type Scenario` from `./share-link.ts`.
- Produces: no exported API; only DOM behavior. Two module-local helpers are added to `model-tool.ts`: `readScenario(): Scenario` and `applyScenario(scenario: Scenario): void`.

- [ ] **Step 1: Add the button and status markup to the page**

In `site/src/pages/model/index.astro`, immediately after the closing `</form>` tag (currently line 176) and before `<h2>Result</h2>`, insert:

```astro
  <div class="share-tools">
    <button type="button" id="share-link">Copy shareable link</button>
    <span id="share-status" class="share-status" role="status" aria-live="polite"></span>
  </div>
```

The `role="status"` / `aria-live="polite"` span announces the "copied" confirmation to screen readers without stealing focus. The `<button>` inherits the site's existing `button {}` styling (global.css:658), so no class is needed on it.

- [ ] **Step 2: Style the share toolbar**

Append to `site/src/styles/global.css`:

```css
/* The "Copy shareable link" control sits below the what-if form. The status
   span is a polite live region that reports the copy result (or, when the
   clipboard API is unavailable, shows the URL so it can be copied by hand). */
.share-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.85rem;
  margin: 1.5rem 0;
}
.share-status {
  font-size: 0.9rem;
  color: var(--muted, var(--text));
  word-break: break-all;
}
```

Note: `--muted` is used with a fallback to `--text` in case the variable is not defined; verify the variable's name against the `:root` block in global.css and use whatever muted/secondary text color exists (or drop the fallback and use `var(--text)` directly if there is no muted token).

- [ ] **Step 3: Import the share-link module in the island**

In `site/src/scripts/model-tool.ts`, below the existing `import { nextStatewideAverage } from './statewide-average.ts';` line (currently line 44), add:

```ts
import { SHARE_FIELDS, decodeScenario, shareUrl, type Scenario } from './share-link.ts';
```

- [ ] **Step 4: Add the DOM glue helpers**

In `site/src/scripts/model-tool.ts`, add these two helpers next to the existing `numberField`/`textField` helpers (just above `export function initModelTool`, around line 422):

```ts
// Read every shareable field's current value into a Scenario keyed by DOM id.
// Reads `.value`, which works for both the <input> fields and the <select>
// mode picker. Blank fields are omitted, so the link carries only what the
// user actually entered.
function readScenario(): Scenario {
  const scenario: Scenario = {};
  for (const { id } of SHARE_FIELDS) {
    const element = document.getElementById(id) as
      | HTMLInputElement
      | HTMLSelectElement
      | null;
    if (element && element.value.trim() !== '') scenario[id] = element.value;
  }
  return scenario;
}

// Write a decoded Scenario back into the form. Only fields the scenario carries
// are touched, so a partial link leaves the untouched fields at their HTML
// defaults. Setting a <select> to a value with no matching option is a no-op in
// the browser, so a link naming a fiscal year that is no longer built simply
// leaves the picker on its default -- recompute() then reports honestly that no
// parameter file is available rather than inventing one.
function applyScenario(scenario: Scenario): void {
  for (const { id } of SHARE_FIELDS) {
    const value = scenario[id];
    if (value === undefined) continue;
    const element = document.getElementById(id) as
      | HTMLInputElement
      | HTMLSelectElement
      | null;
    if (element) element.value = value;
  }
}
```

- [ ] **Step 5: Restore a shared scenario on load**

In `initModelTool`, the picker `<option>`s are built around lines 440–453, and the existing startup sequence ends (lines 582–583) with:

```ts
  applyStatewidePrefill();
  recompute();
```

Restore the shared scenario **after** the picker options exist (so setting the `parameter-mode` value can match an option) and **before** `applyStatewidePrefill()` (so a statewide-average value carried in the link is treated as the user's own and is not overwritten by the prefill). Change the tail of `initModelTool` to:

```ts
  // A shared link carries a scenario in the query string. Apply it after the
  // picker options exist (so the mode <select> can adopt the shared year) and
  // before applyStatewidePrefill (so a statewide-average carried in the link
  // counts as user-entered and the prefill leaves it alone). Fields the link
  // omits keep their HTML defaults.
  applyScenario(decodeScenario(window.location.search));

  applyStatewidePrefill();
  recompute();
```

Leave the `applyStatewidePrefill` and `recompute` calls in place — the new line goes immediately above them.

- [ ] **Step 6: Wire the copy button**

Still in `initModelTool`, after the existing event wiring (the `document.getElementById('scenario-form')?.addEventListener('input', recompute);` block and the `modeSelect?.addEventListener('change', …)` block, around lines 577–581) and before the final startup calls, add:

```ts
  // Build a link that reproduces the current form and copy it to the clipboard.
  // The address bar is left untouched while editing; the link is produced only
  // on click. When the clipboard API is unavailable (insecure context, denied
  // permission) the URL is shown in the status line so it can be copied by hand.
  const shareButton = document.getElementById('share-link');
  const shareStatus = document.getElementById('share-status');
  shareButton?.addEventListener('click', () => {
    const base = window.location.origin + window.location.pathname;
    const url = shareUrl(base, readScenario());
    const clipboard = navigator.clipboard;
    if (clipboard) {
      clipboard.writeText(url).then(
        () => {
          if (shareStatus) shareStatus.textContent = 'Link copied to clipboard';
        },
        () => {
          if (shareStatus) shareStatus.textContent = url;
        },
      );
    } else if (shareStatus) {
      shareStatus.textContent = url;
    }
  });
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Run the full test suite**

Run: `npm test`
Expected: PASS — Task 1's tests still green; no existing test regressed. (There are no new unit tests in this task; the glue is verified in the browser next.)

- [ ] **Step 9: Verify in the browser preview**

Start the dev server and open the what-if tool:

1. `preview_start` with `{ name: "site" }` (add a `site` entry to `.claude/launch.json` if none exists: `runtimeExecutable` `npm`, `runtimeArgs` `["run","dev"]`, and the port Astro prints — Astro's default is 4321). The root `dev` script runs `build:data` then `astro dev`.
2. `navigate` to the `/model` page (respect `BASE_URL` — the path may be prefixed; read the address the dev server serves).
3. `read_console_messages` — expect no errors on load.
4. Change several fields (e.g. set `spending` to `4200000`, `cla` to `0.75`, pick a fiscal year in the mode picker), then `computer` click the "Copy shareable link" button.
5. `read_page` and confirm the status line reads "Link copied to clipboard" (or, if the preview blocks clipboard, shows the full URL — either is a pass for this step).
6. Read the produced URL. In the preview, evaluate the built link with `javascript_tool`: compute `location.origin + location.pathname + '?' + new URLSearchParams({...}).toString()` is not necessary — instead read it from the status fallback, or call `navigator.clipboard.readText()` if permitted. Simplest: temporarily `navigate` to a hand-built link, e.g. `…/model?mode=2027&spending=4200000&cla=0.75`.
7. After navigating to that link, `read_page` and confirm `spending` shows `4200000`, `cla` shows `0.75`, and the mode picker shows the shared year — proving restore works. Confirm the walkthrough/summary recomputed to match (the "Show the work" section reflects the shared numbers).
8. `read_console_messages` again — no errors.

- [ ] **Step 10: Verify the statewide-average interaction**

This is the one subtle case. In the preview:

1. Navigate to a link that includes a statewide-average, e.g. `…/model?mode=2027&statewide_avg=13958`.
2. `read_page` — confirm the `statewide-avg` field holds `13958` and was **not** overwritten by the year's own prefill.
3. Navigate to a link with a year but **no** `statewide_avg` param, e.g. `…/model?mode=2027`.
4. Confirm the `statewide-avg` field shows that year's published figure (the normal autofill still runs when the link omits the value), or is blank if the year has none on file.

- [ ] **Step 11: Screenshot the working feature**

`computer` `{action: "screenshot"}` of the `/model` page showing the "Copy shareable link" button and a restored scenario, to share as proof.

- [ ] **Step 12: Commit**

```bash
git add site/src/pages/model/index.astro site/src/scripts/model-tool.ts site/src/styles/global.css
git commit -m "feat(model): copy a shareable link and restore scenarios from the URL"
```

---

## Self-Review

**1. Spec coverage** — "save the parameters entered as a link someone can navigate to and see the same parameters":
- *Save parameters as a link*: Task 2, Step 6 (button builds `shareUrl(base, readScenario())` and copies it). Encoding logic: Task 1 (`encodeScenario`, `shareUrl`).
- *Navigate to the link and see the same parameters*: Task 2, Step 5 (`applyScenario(decodeScenario(window.location.search))` on load). Decoding logic: Task 1 (`decodeScenario`).
- *All fields covered*: `SHARE_FIELDS` enumerates all 18 form fields including the mode picker; verified against `index.astro`'s ids (`parameter-mode`, `prek-1`, `k5-1`, `g68-1`, `g912-1`, `prek-2`, `k5-2`, `g68-2`, `g912-2`, `state-placed`, `econ`, `el`, `density`, `small-school-name`, `small-school-enrollment`, `spending`, `cla`, `statewide-avg`).
- No gaps found.

**2. Placeholder scan** — every code step contains complete, runnable code; no TBD/TODO/"handle edge cases". The clipboard-unavailable fallback, the empty-scenario case, and the missing-option case are all handled explicitly. The one deliberate verification-time check (the `--muted` CSS variable name in Task 2 Step 2) is called out with a concrete resolution, not left vague.

**3. Type consistency** — `Scenario` (keyed by DOM id) is produced by `decodeScenario`/`readScenario` and consumed by `encodeScenario`/`applyScenario`/`shareUrl` — consistent across both tasks. `SHARE_FIELDS` entries are `{ id, param }` everywhere. Function names match between Task 1's Produces block, the test file, the implementation, and Task 2's imports (`encodeScenario`, `decodeScenario`, `shareUrl`, `SHARE_FIELDS`). The island helpers `readScenario`/`applyScenario` are named identically where defined (Step 4) and used (Steps 5–6).
