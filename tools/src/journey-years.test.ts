import { describe, expect, it } from 'vitest';

import { buildJourneyYears, type JourneyYearsInputs } from './journey-years.ts';

const SOURCE = {
  publisher: 'Vermont Department of Taxes',
  title: 'FY2024 Education Property Tax Rates',
  published_date: '2023-08-25',
  document_page: 'https://tax.vermont.gov/document/fy2024-education-property-tax-rates',
};

const base: JourneyYearsInputs = {
  registry: [
    { slug: 'town/mount-holly', name: 'MT. HOLLY', type: 'town' },
    { slug: 'town/barton-id', name: 'Barton ID', type: 'town' },
    { slug: 'town/addison', name: 'Addison', type: 'town' },
    { slug: 'ud/somewhere', name: 'Addison', type: 'ud' },
  ],
  taxRates: [
    {
      fiscal_year: 2024,
      towns: [
        { town: 'Mount Holly', homestead_rate: 1.5, cla: 0.91 },
        { town: 'Barton', homestead_rate: 1.2 },
        { town: 'Addison', homestead_rate: null },
        { town: 'Atlantis', homestead_rate: 9 },
      ],
    },
  ],
  rateSources: { 2024: SOURCE },
  admReports: [
    {
      fiscal_year: 2024,
      count_year: '2022-2023',
      source_title: 'ADM-24',
      towns: [{ entity: 'town/addison', values: [88.56, 57.97] }],
    },
  ],
  townFileYears: [],
  generated: 'now',
};

describe('buildJourneyYears', () => {
  it('matches tax rows to registry towns by normalised name and alias', () => {
    const y = buildJourneyYears(base).years[0]!;
    expect(y.towns['town/mount-holly']).toEqual({ homestead_rate: 1.5, cla: 0.91 });
    expect(y.towns['town/barton-id']).toEqual({ homestead_rate: 1.2, cla: null });
    expect(y.towns['ud/somewhere']).toBeUndefined();
  });

  it('lists a tax row no registry town matches, and never guesses', () => {
    expect(buildJourneyYears(base).years[0]!.unmatched).toEqual(['Atlantis']);
  });

  it('keeps a null rate null and sums the report bands for students', () => {
    const y = buildJourneyYears(base).years[0]!;
    expect(y.towns['town/addison']).toEqual({ homestead_rate: null, cla: null, students: 146.53 });
    expect(y.students_source).toEqual({
      kind: 'resident_district_report', count_year: '2022-2023', title: 'ADM-24', preliminary: false,
    });
    expect(y.rate_source).toEqual(SOURCE);
  });

  it('uses the town file when a year has one, and drops report totals', () => {
    const y = buildJourneyYears({
      ...base,
      townFileYears: [{ fiscal_year: 2024, count_year: '2022-2023', preliminary: true }],
    }).years[0]!;
    expect(y.students_source).toEqual({ kind: 'town_file', count_year: '2022-2023', title: null, preliminary: true });
    expect(y.towns['town/addison']).toEqual({ homestead_rate: null, cla: null });
  });

  it('has no student source when neither is on file', () => {
    const y = buildJourneyYears({ ...base, admReports: [] }).years[0]!;
    expect(y.students_source).toBeNull();
    expect(y.rate_source).toEqual(SOURCE);
  });

  it('matches a name printed with an apostrophe, and the one Underhill row', () => {
    const y = buildJourneyYears({
      ...base,
      registry: [
        { slug: 'town/averys-gore', name: 'AVERYS GORE', type: 'town' },
        { slug: 'town/warrens-grant', name: 'WARRENS GRANT', type: 'town' },
        { slug: 'town/underhill-town', name: 'UNDERHILL TOWN', type: 'town' },
      ],
      taxRates: [
        {
          fiscal_year: 2023,
          towns: [
            { town: "Avery's Gore", homestead_rate: 1.0298 },
            { town: "Warren's Gore", homestead_rate: 1.03 },
            { town: 'Underhill', homestead_rate: 1.1423 },
          ],
        },
      ],
      admReports: [],
    }).years[0]!;
    expect(y.towns['town/averys-gore']?.homestead_rate).toBe(1.0298);
    expect(y.towns['town/warrens-grant']?.homestead_rate).toBe(1.03);
    expect(y.towns['town/underhill-town']?.homestead_rate).toBe(1.1423);
    expect(y.unmatched).toEqual([]);
  });

  it('orders years oldest first', () => {
    const two = buildJourneyYears({
      ...base,
      taxRates: [{ fiscal_year: 2025, towns: [] }, ...base.taxRates],
    });
    expect(two.years.map((y) => y.fiscal_year)).toEqual([2024, 2025]);
    expect(two.years[1]!.rate_source).toBeNull();
  });
});
