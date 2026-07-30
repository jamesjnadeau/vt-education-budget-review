import { describe, expect, it } from 'vitest';

import {
  assertYearAgreement,
  normalizeLinkText,
  parseLinkText,
  parseTitleRow,
} from './year.ts';

/**
 * NBSP and the zero-width space are built from their numeric code points
 * rather than typed as literal characters (or as `\u` escapes) in this
 * file's source text -- either form is exactly the kind of byte that gets
 * silently dropped or re-encoded passing through an editor or transcript,
 * which would leave the test proving nothing about the codepoint it claims
 * to cover. Building them this way keeps the fixture's intent verifiable as
 * plain ASCII: 0x00A0 is NBSP, 0x200B is zero width space.
 */
const NBSP = String.fromCharCode(0x00a0);
const ZWSP = String.fromCharCode(0x200b);

describe('parsing the title row', () => {
  it('reads both year labels and derives the fiscal year', () => {
    const labels = parseTitleRow(
      'Average Daily Membership (ADM) Report for 2023-2024 (ADM-25) by Resident District',
    );
    expect(labels.count_year).toBe('2023-2024');
    expect(labels.count_year_start).toBe(2023);
    expect(labels.adm_label).toBe(25);
    expect(labels.fiscal_year).toBe(2025);
  });

  it('handles the ADM-24 title', () => {
    const labels = parseTitleRow(
      'Average Daily Membership (ADM) Report for 2022-2023 (ADM-24) by Resident District',
    );
    expect(labels.fiscal_year).toBe(2024);
    expect(labels.count_year_start).toBe(2022);
  });

  it('rejects a title whose label and count year contradict each other', () => {
    // fiscal_year would be 2025, so count_year_start must be 2023.
    expect(() =>
      parseTitleRow('Average Daily Membership (ADM) Report for 2019-2020 (ADM-25) by Resident District'),
    ).toThrow(/2019.*expected 2023|invariant/i);
  });

  it('rejects a title whose school years are not consecutive', () => {
    expect(() =>
      parseTitleRow('Average Daily Membership (ADM) Report for 2023-2025 (ADM-25) by Resident District'),
    ).toThrow(/consecutive/i);
  });

  it('rejects an unrecognizable title rather than guessing', () => {
    expect(() => parseTitleRow('Some Other AOE Report')).toThrow(/could not read/i);
  });
});

describe('normalizing link text', () => {
  it('strips the invisible characters AOE\'s CMS emits', () => {
    // ADM-17 carries NBSP; ADM-16 carries NBSP and a trailing zero-width space.
    expect(normalizeLinkText(`2015-2016${NBSP}Resident District Report`)).toBe(
      '2015-2016 Resident District Report',
    );
    expect(
      normalizeLinkText(`2014-2015${NBSP}(ADM-16)${NBSP}Resident District Report${ZWSP}`),
    ).toBe('2014-2015 (ADM-16) Resident District Report');
  });

  it('decodes the HTML entities that appear in the markup', () => {
    expect(normalizeLinkText('2015-2016&nbsp;Resident District Report')).toBe(
      '2015-2016 Resident District Report',
    );
  });
});

describe('parsing link text', () => {
  it('reads the year labels and the grain', () => {
    const parsed = parseLinkText('2022-2023 (ADM-24) Resident District Report');
    expect(parsed.fiscal_year).toBe(2024);
    expect(parsed.count_year).toBe('2022-2023');
    expect(parsed.grain).toBe('Resident District Report');
  });

  it('parses every published year, including the ones with invisible characters', () => {
    const published: ReadonlyArray<readonly [string, number]> = [
      ['2022-2023 (ADM-24) Resident District Report', 2024],
      ['2021-2022 (ADM-23) Resident District Report', 2023],
      ['2020-2021 (ADM-22) Resident District Report', 2022],
      ['2019-2020 (ADM-21) Resident District Report', 2021],
      ['2018-2019 (ADM-20) Resident District Report', 2020],
      ['2017-2018 (ADM-19) Resident District Report', 2019],
      ['2016-2017 (ADM-18) Resident District Report', 2018],
      [`2015-2016${NBSP}(ADM-17)${NBSP}Resident District Report`, 2017],
      [`2014-2015${NBSP}(ADM-16)${NBSP}Resident District Report${ZWSP}`, 2016],
    ];
    for (const [text, fy] of published) {
      expect(parseLinkText(normalizeLinkText(text)).fiscal_year, text).toBe(fy);
    }
  });

  it('normalization is idempotent, so pre-normalized text still parses', () => {
    const raw = `2014-2015${NBSP}(ADM-16)${NBSP}Resident District Report${ZWSP}`;
    const once = normalizeLinkText(raw);
    const twice = normalizeLinkText(once);
    expect(twice).toBe(once);
    expect(parseLinkText(once).fiscal_year).toBe(2016);
    expect(parseLinkText(raw).fiscal_year).toBe(2016);
  });
});

describe('agreement with the filename', () => {
  const labels = parseTitleRow(
    'Average Daily Membership (ADM) Report for 2022-2023 (ADM-24) by Resident District',
  );

  it('accepts the era-A filename', () => {
    expect(() =>
      assertYearAgreement(labels, 'edu-average-daily-membership-by-resident-district-fy24.xlsx'),
    ).not.toThrow();
  });

  it('accepts an era-C filename', () => {
    expect(() =>
      assertYearAgreement(labels, 'data-average-daily-membership-resident-district-adm24.xlsx'),
    ).not.toThrow();
  });

  it('rejects a misfiled download', () => {
    expect(() =>
      assertYearAgreement(labels, 'edu-average-daily-membership-by-resident-district-fy25.xlsx'),
    ).toThrow(/fy25|disagree/i);
  });

  it('rejects a filename carrying no year at all', () => {
    expect(() => assertYearAgreement(labels, 'download.xlsx')).toThrow(/no year/i);
  });
});
