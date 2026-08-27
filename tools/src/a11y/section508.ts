/**
 * Section 508 conformance checking for the built site.
 *
 * Section 508 (36 CFR Part 1194, as revised in the 2017 refresh) does not
 * write its own web rules. For web content it adopts WCAG 2.0 Level A and
 * Level AA by reference, so "does this page meet Section 508" is, in
 * practice, "does this page meet WCAG 2.0 AA". That is what the blocking
 * check here tests.
 *
 * Two tiers, because they are two different claims and the site should never
 * blur them:
 *
 *   error    A failure of a rule Section 508 legally incorporates -- WCAG 2.0
 *            A/AA, plus axe's mapping of the older 1194.22 provisions. This
 *            is a page a federal accessibility standard says is not
 *            accessible, so it blocks.
 *
 *   warning  A failure of a WCAG 2.1 A/AA rule that WCAG 2.0 does not carry.
 *            Section 508 does not require these today. The Department of
 *            Justice's ADA Title II rule does require WCAG 2.1 AA of state
 *            and local government sites, and the next 508 update is widely
 *            expected to follow, so these are reported loudly and do not
 *            block.
 *
 * What a machine cannot decide is reported as its own category rather than
 * folded into "passed". Two ways a rule can come back undecided:
 *
 *   notEvaluated  The rule needs a rendering engine -- real layout, computed
 *                 colors, actual pixels. jsdom has none, so `color-contrast`
 *                 and friends never run at all here. A contrast failure will
 *                 not be caught by this check, and saying so is the point:
 *                 a check that silently tests nothing and reports success is
 *                 worse than no check.
 *
 *   needsReview   axe ran the rule and could not reach a verdict. A person
 *                 has to look. These are warnings, never silent.
 *
 * And the standing caveat on the whole exercise: automated testing catches
 * something like a third to a half of real accessibility barriers. A page
 * that is clean here is a page with no *machine-detectable* failures. It is
 * not a page that has been shown to work for someone using a screen reader.
 * See `docs/accessibility.md` for what still has to be checked by hand.
 */

import axe from 'axe-core';
import { JSDOM, VirtualConsole } from 'jsdom';

/**
 * Rule tags Section 508 incorporates. `wcag2a`/`wcag2aa` are the standard
 * itself; `section508` is axe's mapping of the pre-2017 1194.22 provisions,
 * kept because a rule tagged only that way is still a 508 rule.
 */
export const SECTION_508_TAGS = ['wcag2a', 'wcag2aa', 'section508'] as const;

/** WCAG 2.1 A/AA: not required by Section 508 today. Reported, not enforced. */
export const FORWARD_LOOKING_TAGS = ['wcag21a', 'wcag21aa'] as const;

/** Everything the checker asks axe to run. */
export const CHECKED_TAGS: readonly string[] = [...SECTION_508_TAGS, ...FORWARD_LOOKING_TAGS];

/**
 * Rules that need a real rendering engine and therefore cannot run under
 * jsdom at all. Named here so the report can say "not checked" instead of
 * letting the absence of a failure read as a pass.
 */
export const RULES_NEEDING_A_RENDERER: readonly string[] = [
  'color-contrast',
  'color-contrast-enhanced',
];

export type Severity = 'error' | 'warning';

/** Which standard the failed rule belongs to. Decides the severity. */
export type Standard = 'section508' | 'wcag21';

export interface A11yFinding {
  severity: Severity;
  standard: Standard;
  /** Page the finding is on, as it was handed to the checker. */
  page: string;
  /** axe rule id, e.g. `image-alt`. */
  rule: string;
  /** axe's own severity for the rule; absent on a few rules. */
  impact: string | null;
  /** One-line description of what is wrong. */
  help: string;
  helpUrl: string;
  /** The elements that failed, as CSS selectors with their markup. */
  nodes: { target: string; html: string }[];
}

export interface PageReport {
  page: string;
  /** Rules that definitively failed. */
  violations: A11yFinding[];
  /** Rules axe ran but could not decide. A person has to look at these. */
  needsReview: string[];
  /** Rules that could not run here at all, because jsdom does not render. */
  notEvaluated: string[];
}

/** Truncated so a report of many failures stays readable. */
const MAX_MARKUP = 120;

/**
 * One line of markup for the report. axe hands back the element's real source,
 * newlines and indentation included, which turns a list of findings into a
 * wall of re-indented HTML.
 */
function condense(html: string): string {
  const oneLine = html.replace(/\s+/g, ' ').trim();
  return oneLine.length > MAX_MARKUP ? `${oneLine.slice(0, MAX_MARKUP)}...` : oneLine;
}

function standardFor(tags: readonly string[]): Standard {
  return tags.some((t) => (SECTION_508_TAGS as readonly string[]).includes(t))
    ? 'section508'
    : 'wcag21';
}

/**
 * Runs axe against one page of HTML.
 *
 * `page` is only a label -- it is what shows up in the report -- so a caller
 * can check a string fixture as easily as a file.
 *
 * axe is a browser library, so rather than shimming globals it is evaluated
 * inside the jsdom window and run from there. Page scripts are deliberately
 * NOT executed (`runScripts: 'outside-only'` lets us call `window.eval`
 * ourselves without running anything the page shipped): this check reads
 * static build output, and running the site's own JavaScript would only add
 * a way for the checker to break on something unrelated to accessibility.
 */
export async function checkPage(html: string, page: string): Promise<PageReport> {
  // jsdom logs an unimplemented-canvas notice when axe reaches for a 2D
  // context, and nothing else. Dropping its console keeps that one known
  // notice out of CI output; every finding still travels back in the results
  // object, so nothing is being hidden here.
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(),
  });

  try {
    dom.window.eval(axe.source);
    const results: axe.AxeResults = await (
      dom.window as unknown as { axe: typeof axe }
    ).axe.run(dom.window.document, {
      runOnly: { type: 'tag', values: [...CHECKED_TAGS] },
    });

    const violations = results.violations.map((v): A11yFinding => {
      const standard = standardFor(v.tags);
      return {
        severity: standard === 'section508' ? 'error' : 'warning',
        standard,
        page,
        rule: v.id,
        impact: v.impact ?? null,
        help: v.help,
        helpUrl: v.helpUrl,
        nodes: v.nodes.map((n) => ({
          target: n.target.join(' '),
          html: condense(n.html),
        })),
      };
    });

    const incomplete = results.incomplete.map((r) => r.id);
    return {
      page,
      violations,
      needsReview: incomplete.filter((id) => !RULES_NEEDING_A_RENDERER.includes(id)).sort(),
      notEvaluated: incomplete.filter((id) => RULES_NEEDING_A_RENDERER.includes(id)).sort(),
    };
  } finally {
    dom.window.close();
  }
}

export function formatFinding(f: A11yFinding): string {
  const tier = f.standard === 'section508' ? 'Section 508' : 'WCAG 2.1';
  const head = `  ${f.page}: [${f.rule}] ${f.help} (${tier}, impact: ${f.impact ?? 'n/a'})`;
  const nodes = f.nodes.map((n) => `      ${n.target}\n        ${n.html}`);
  return [head, `    ${f.helpUrl}`, ...nodes].join('\n');
}

export function summarize(reports: readonly PageReport[]): {
  pages: number;
  errors: number;
  warnings: number;
  /** Every rule that could not run, deduplicated across pages. */
  notEvaluated: string[];
} {
  let errors = 0;
  let warnings = 0;
  const notEvaluated = new Set<string>();

  for (const r of reports) {
    for (const v of r.violations) {
      if (v.severity === 'error') errors += 1;
      else warnings += 1;
    }
    warnings += r.needsReview.length;
    for (const rule of r.notEvaluated) notEvaluated.add(rule);
  }

  return { pages: reports.length, errors, warnings, notEvaluated: [...notEvaluated].sort() };
}
