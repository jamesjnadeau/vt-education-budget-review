import { describe, expect, it } from 'vitest';

import {
  checkPage,
  formatFinding,
  RULES_NEEDING_A_RENDERER,
  summarize,
  SECTION_508_TAGS,
  type PageReport,
} from './section508.ts';

/** Wraps a fragment in the smallest page that is itself conformant. */
function page(body: string, attrs = ' lang="en"'): string {
  return `<!doctype html><html${attrs}><head><title>Vermont School Budgets</title></head><body>${body}</body></html>`;
}

function ruleIds(report: PageReport): string[] {
  return report.violations.map((v) => v.rule).sort();
}

describe('checkPage', () => {
  it('passes a page with no machine-detectable failures', async () => {
    const report = await checkPage(
      page(`
        <main>
          <h1>What a district spends</h1>
          <img src="chart.png" alt="Spending per pupil, 2020 to 2026" />
          <label for="adm">Average daily membership</label>
          <input id="adm" type="text" name="adm" autocomplete="off" />
          <a href="/methodology/">How it works</a>
        </main>
      `),
      'clean.html',
    );

    expect(report.violations).toEqual([]);
  });

  it('catches the Section 508 failures and blocks on them', async () => {
    const report = await checkPage(
      page(`
        <img src="chart.png" />
        <input type="text" name="adm" />
        <a href="/methodology/"></a>
      `),
      'broken.html',
    );

    expect(ruleIds(report)).toEqual(['image-alt', 'label', 'link-name']);
    for (const v of report.violations) {
      expect(v.standard).toBe('section508');
      expect(v.severity).toBe('error');
      expect(v.page).toBe('broken.html');
      expect(v.helpUrl).toMatch(/^https:/);
      expect(v.nodes.length).toBeGreaterThan(0);
    }
  });

  it('catches a missing lang attribute, which a screen reader needs to pick a voice', async () => {
    const report = await checkPage(page('<h1>Budgets</h1>', ''), 'no-lang.html');
    expect(ruleIds(report)).toContain('html-has-lang');
  });

  it('reports a WCAG 2.1-only failure as a warning, not a Section 508 error', async () => {
    // `autocomplete-valid` is tagged wcag21aa and nothing older, so it is the
    // clean case for the two-tier split: real finding, not a 508 failure.
    const report = await checkPage(
      page(`
        <label for="q">Town</label>
        <input id="q" type="text" name="q" autocomplete="not-a-real-token" />
      `),
      'forward.html',
    );

    const autocomplete = report.violations.find((v) => v.rule === 'autocomplete-valid');
    expect(autocomplete).toBeDefined();
    expect(autocomplete?.standard).toBe('wcag21');
    expect(autocomplete?.severity).toBe('warning');
    expect(summarize([report]).errors).toBe(0);
  });

  it('condenses the offending markup onto one line', async () => {
    const report = await checkPage(
      page(`
        <img
          src="chart.png"
        />
      `),
      'multiline.html',
    );

    const html = report.violations[0]?.nodes[0]?.html ?? '';
    expect(html).not.toMatch(/\n/);
    expect(html).toContain('<img');
  });

  it('reports contrast as not evaluated rather than letting it read as a pass', async () => {
    // The trap this guards against: jsdom does not lay pages out or compute
    // colors, so `color-contrast` never runs. A report that listed only
    // violations would show a clean page and imply contrast had been checked.
    const report = await checkPage(
      page('<p style="color: #eee; background: #fff">Nearly invisible</p>'),
      'contrast.html',
    );

    expect(report.violations.map((v) => v.rule)).not.toContain('color-contrast');
    expect(report.notEvaluated).toContain('color-contrast');
    expect(report.needsReview).not.toContain('color-contrast');
  });

  it('separates rules a person must decide from rules that could not run', async () => {
    const report = await checkPage(page('<p>No landmarks, no skip link.</p>'), 'review.html');

    for (const rule of report.needsReview) {
      expect(RULES_NEEDING_A_RENDERER).not.toContain(rule);
    }
    for (const rule of report.notEvaluated) {
      expect(RULES_NEEDING_A_RENDERER).toContain(rule);
    }
  });

  it('does not run scripts the page shipped', async () => {
    // The checker reads build output, so it must not execute it. A page whose
    // script throws is still checkable; one whose script rewrites the DOM must
    // be checked as shipped, not as the script leaves it.
    const report = await checkPage(
      page(`
        <script>document.body.innerHTML = '<img src="x.png">'; throw new Error('boom');</script>
        <p>Static content.</p>
      `),
      'scripted.html',
    );

    expect(ruleIds(report)).not.toContain('image-alt');
  });
});

describe('summarize', () => {
  it('counts errors and warnings separately and pools the unrunnable rules', async () => {
    const [clean, broken] = await Promise.all([
      checkPage(page('<main><h1>Budgets</h1></main>'), 'a.html'),
      checkPage(page('<img src="chart.png" />'), 'b.html'),
    ]);

    const summary = summarize([clean!, broken!]);
    expect(summary.pages).toBe(2);
    expect(summary.errors).toBeGreaterThan(0);
    expect(summary.notEvaluated).toContain('color-contrast');
    // Deduplicated across pages: contrast is unrunnable once, not once a page.
    expect(new Set(summary.notEvaluated).size).toBe(summary.notEvaluated.length);
  });

  it('counts a needs-review rule as a warning, so nothing undecided is silent', async () => {
    const report: PageReport = {
      page: 'x.html',
      violations: [],
      needsReview: ['bypass'],
      notEvaluated: [],
    };

    expect(summarize([report])).toMatchObject({ errors: 0, warnings: 1 });
  });
});

describe('formatFinding', () => {
  it('names the page, the rule, the standard and the element', async () => {
    const report = await checkPage(page('<img src="chart.png" />'), 'town/winooski.html');
    const text = formatFinding(report.violations[0]!);

    expect(text).toContain('town/winooski.html');
    expect(text).toContain('image-alt');
    expect(text).toContain('Section 508');
    expect(text).toContain('<img');
  });
});

describe('the tag set', () => {
  it('covers what Section 508 incorporates: WCAG 2.0 A and AA', () => {
    // Section 508's 2017 refresh adopts WCAG 2.0 Level A and AA by reference
    // for web content. Dropping either tag from the blocking set would narrow
    // the check while leaving its name unchanged, which is the one way this
    // could quietly stop meaning anything.
    expect(SECTION_508_TAGS).toContain('wcag2a');
    expect(SECTION_508_TAGS).toContain('wcag2aa');
  });
});
