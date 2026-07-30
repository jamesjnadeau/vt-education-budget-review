/**
 * Finds the ADM reports a saved page snapshot offers.
 *
 * This is the automation that pays for itself, in the terms
 * tools/src/cli/collect.ts already sets out: detection, not retrieval. Nobody
 * has to remember to check the page next August -- the diff between what the
 * snapshot lists and what intake/ holds is the answer.
 *
 * It matches on LINK TEXT. The hrefs come in three incompatible slug eras across
 * the ten published years:
 *
 *   A  average-daily-membership-by-resident-district-fyNN     ADM-20..25
 *   B  YYYY-YYYY-adm-NN-resident-district-report              ADM-18, 19
 *   C  data-average-daily-membership-resident-district-admNN  ADM-16, 17
 *
 * so a URL pattern finds five and silently misses the rest. The link text is
 * uniform across all ten.
 *
 * Regex over HTML rather than a DOM parser, following the precedent in
 * tools/src/statute/fetch.ts, so no dependency is added for one link list.
 */

import { normalizeLinkText, parseLinkText } from './year.ts';

export interface DiscoveredReport {
  readonly url: string;
  readonly text: string;
  readonly adm_label: number;
  readonly fiscal_year: number;
  readonly count_year: string;
  readonly grain: string;
}

const LINK = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

export function discoverFromHtml(html: string): ReadonlyArray<DiscoveredReport> {
  const found: DiscoveredReport[] = [];

  for (const m of html.matchAll(LINK)) {
    const url = m[1] as string;
    // Strip any nested markup before normalizing, so <em> inside a label does
    // not become part of the text.
    const text = normalizeLinkText((m[2] as string).replace(/<[^>]+>/g, ''));
    let parsed;
    try {
      parsed = parseLinkText(text);
    } catch {
      // Not an ADM report link, or one whose own year labels contradict each
      // other. The page carries plenty of links that are neither, and a
      // contradictory one is malformed rather than merely unfamiliar -- either
      // way there is nothing here to guess at. Discovery is a report of what a
      // page offers, so it lists what it can read and stays silent about the
      // rest; the year invariants are enforced again, fatally, when a file is
      // actually imported.
      continue;
    }
    found.push({
      url,
      text,
      adm_label: parsed.adm_label,
      fiscal_year: parsed.fiscal_year,
      count_year: parsed.count_year,
      grain: parsed.grain,
    });
  }

  return found;
}
