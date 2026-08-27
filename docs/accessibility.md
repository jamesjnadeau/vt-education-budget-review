# Accessibility and Section 508

This site publishes public information about public money. Anyone in Vermont has to
be able to read it, including people who use a screen reader, navigate by keyboard,
or need large text. That is the whole reason the project exists, applied to the page
itself rather than to the numbers on it.

CI enforces the machine-checkable part of that. The rest is on people, and this
document says which is which.

## The standard

**Section 508** of the Rehabilitation Act (29 U.S.C. § 794d), as implemented by the
[2017 refresh of 36 CFR Part 1194][refresh], does not write its own rules for web
content. It **adopts WCAG 2.0 Level A and Level AA by reference** (E205.4). So
"Section 508 conformance" for a web page means, concretely, WCAG 2.0 AA.

Two things sit just outside that line and are worth naming, because they are coming:

- **WCAG 2.1 Level AA** is what the Department of Justice's [ADA Title II rule][doj]
  requires of state and local government web content. This site is not a government
  site — the header says so on every page — so that rule does not bind it. Meeting it
  anyway is the obvious thing to do for a site whose readers are the same Vermonters
  the rule is meant to protect.
- **WCAG 2.2** is the current W3C recommendation and the likely basis of the next
  update to both.

The check treats WCAG 2.0 AA as the line that blocks, and reports WCAG 2.1 findings
without blocking. Both are real; only one of them is currently a legal standard, and
collapsing that distinction would be the same mistake as calling an unverified number
a verified one.

[refresh]: https://www.access-board.gov/ict/
[doj]: https://www.ada.gov/resources/2024-03-08-web-rule/

## Running the check

```bash
npm run build:data && npm run build:site   # the check reads built HTML
npm run a11y                               # every page in site/dist
npm run a11y -- site/dist/index.html       # one page, while fixing something
```

It runs [axe-core][axe] against every page in `site/dist` under a headless DOM. About
75 seconds for the full site. `npm run validate` does not include it, because it needs
a built site and `validate` runs before the build; CI runs it as its own step, after
`build:site`.

Two tiers of result, the same errors-block / warnings-loud split `npm run validate`
uses:

| | |
|---|---|
| **error** | A rule Section 508 incorporates — WCAG 2.0 A/AA, plus axe's mapping of the older 1194.22 provisions. Exits non-zero. CI fails. |
| **warning** | A WCAG 2.1 A/AA rule that WCAG 2.0 does not carry. Printed in full. Does not block. |

Implementation: `tools/src/a11y/section508.ts`, driven by `tools/src/cli/a11y.ts`,
tested in `tools/src/a11y/section508.test.ts`.

[axe]: https://github.com/dequelabs/axe-core

## What the check cannot tell you

**Automated testing catches roughly a third to a half of real accessibility
barriers.** A clean run means no *machine-detectable* failures. It does not mean the
page works for someone using a screen reader, and it must never be reported as if it
did.

Specifically:

- **Contrast is not checked at all.** The checker runs in jsdom, which parses HTML but
  does not lay pages out or compute colors, so the `color-contrast` rule never runs.
  The report says so on every run rather than letting the silence read as a pass. Check
  contrast in a browser — the axe or WAVE extension, or DevTools' own contrast readout
  on any color pair in `site/src/styles/global.css`.
- **Alt text quality.** `image-alt` checks that the attribute exists. Whether
  `alt="chart"` describes the chart is a judgement no rule makes.
- **Reading order and keyboard order.** Whether tabbing through a page reaches things
  in an order that makes sense, and whether focus is visible when it lands.
- **Whether a label says the right thing.** A form control can be perfectly labelled
  and still be labelled wrongly.
- **Whether the page is understandable**, which for this site is most of the work. See
  the 5th-grade reading level rule in `AGENT.md` — that rule and this document are
  aimed at the same thing from opposite ends.

## Checking by hand

Worth doing when a page's structure changes, not on every copy edit:

1. **Tab through it.** Every interactive thing reachable, in a sensible order, with a
   focus ring you can see. The "Skip to content" link should be the first stop and
   should actually work.
2. **Read it with a screen reader.** VoiceOver (⌘F5 on macOS), NVDA on Windows, Orca on
   Linux. Headings should describe the page; tables should announce their headers; the
   nav should not be re-read on every page.
3. **Zoom to 200%,** and set the browser's minimum font size up. Nothing should be cut
   off or overlap. WCAG 2.1 wants 400% at 320px wide to reflow without a horizontal
   scrollbar.
4. **Turn off CSS.** The page should still read top to bottom in a sensible order.
5. **Check contrast** on anything new in `global.css`, since CI structurally cannot.

Found a barrier? Open an issue. An accessibility bug is a correctness bug here — a
number nobody can read is not published.
