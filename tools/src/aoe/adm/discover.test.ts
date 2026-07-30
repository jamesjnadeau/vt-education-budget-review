import { describe, expect, it } from 'vitest';

import { discoverFromHtml } from './discover.ts';

// The real markup from the page's accordion, including the entity and
// invisible-character quirks in the two oldest links.
const HTML = `<ul>
<li><a href="https://education.vermont.gov/documents/average-daily-membership-by-resident-district-fy24" target="_blank">2022-2023 (ADM-24) Resident District Report</a></li>
<li><a href="https://education.vermont.gov/documents/2017-2018-adm-19-resident-district-report" target="_blank">2017-2018 (ADM-19) Resident District Report</a></li>
<li><a href="https://education.vermont.gov/documents/data-average-daily-membership-resident-district-adm16" target="_blank">2014-2015&nbsp;(ADM-16)&nbsp;Resident District Report​</a></li>
<li><a href="/about/news">Unrelated link</a></li>
</ul>`;

describe('discovering ADM reports from a saved page snapshot', () => {
  it('finds every ADM link and ignores unrelated ones', () => {
    const found = discoverFromHtml(HTML);
    expect(found).toHaveLength(3);
    expect(found.map((f) => f.adm_label)).toEqual([24, 19, 16]);
  });

  it('reads the years from the link text, not the URL', () => {
    // The three URL slug eras are mutually incompatible, so the href cannot be
    // the matcher: it would find era A and miss B and C.
    const found = discoverFromHtml(HTML);
    expect(found[1]?.fiscal_year).toBe(2019);
    expect(found[1]?.count_year).toBe('2017-2018');
    expect(found[2]?.fiscal_year).toBe(2016);
    expect(found[2]?.count_year).toBe('2014-2015');
  });

  it('normalizes the invisible characters in the oldest link', () => {
    const found = discoverFromHtml(HTML);
    expect(found[2]?.text).toBe('2014-2015 (ADM-16) Resident District Report');
    expect(found[2]?.grain).toBe('Resident District Report');
  });

  it('returns nothing rather than throwing when the markup has no ADM links', () => {
    expect(discoverFromHtml('<ul><li><a href="/x">Something else</a></li></ul>')).toEqual([]);
  });

  it('keeps the href verbatim, including a relative one', () => {
    // The URL is what a human will paste into a browser to fetch the file by
    // hand, so it must not be rewritten or resolved into something else.
    const found = discoverFromHtml(
      '<a href="/documents/adm-25.xlsx">2023-2024 (ADM-25) Resident District Report</a>',
    );
    expect(found[0]?.url).toBe('/documents/adm-25.xlsx');
  });

  it('strips nested markup out of the link label before parsing it', () => {
    const found = discoverFromHtml(
      '<a href="/x"><strong>2023-2024</strong> (ADM-25) Resident District <em>Report</em></a>',
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.text).toBe('2023-2024 (ADM-25) Resident District Report');
  });

  it('distinguishes grains published for the same year', () => {
    // AOE publishes more than one grain per year. The register keys off the
    // grain, so a supervisory-union report must not be mistaken for the
    // resident-district one it sits beside.
    const found = discoverFromHtml(
      '<a href="/a">2023-2024 (ADM-25) Resident District Report</a>' +
        '<a href="/b">2023-2024 (ADM-25) Supervisory Union Report</a>',
    );
    expect(found.map((f) => f.grain)).toEqual([
      'Resident District Report',
      'Supervisory Union Report',
    ]);
  });

  it('skips a link whose year labels contradict each other rather than trusting it', () => {
    // parseLinkText enforces count_year_start == fiscal_year - 2. A link
    // violating it is malformed, and guessing which half is right would misdate
    // the series.
    expect(
      discoverFromHtml('<a href="/x">2019-2020 (ADM-25) Resident District Report</a>'),
    ).toEqual([]);
  });
});
