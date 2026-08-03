import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PATHS } from '../paths.ts';

// Regression guard: three schemas each carry an identical `source` path pattern.
// It once forbade whitespace ([^\s]+), which rejected real intake filenames
// containing spaces (e.g. "Annual Report FY23 Budget Book.pdf"). The TypeScript
// SOURCE_PATTERN in normalize/record.ts was relaxed to [^/]+ but the schema
// copies drifted and kept rejecting them, so accepted issues still failed at the
// [schema:*] validation layer. These copies must stay in sync.
describe('schema source-path patterns accept filenames with spaces', () => {
  const SPACED = 'intake/su-addison-central/fy2023/Annual Report FY23 Budget Book.pdf';
  const WITH_SLASH = 'intake/su-addison-central/fy2023/sub/dir/file.pdf';

  for (const file of ['budget-1.0.schema.json', 'adm-1.0.schema.json', 'census-town-1.0.schema.json']) {
    it(`${file} source pattern allows spaces, still rejects a nested slash`, () => {
      const schema = JSON.parse(readFileSync(join(PATHS.schemas, file), 'utf8'));
      const raw = schema.properties.source.pattern as string;
      const pattern = new RegExp(raw);
      expect(pattern.test(SPACED)).toBe(true);
      expect(pattern.test(WITH_SLASH)).toBe(false);
    });
  }
});

describe('budget schema requires a stated expenditure total', () => {
  it('lists expenditures.total_stated as required', () => {
    const schema = JSON.parse(
      readFileSync(join(PATHS.schemas, 'budget-1.0.schema.json'), 'utf8'),
    );
    const required = schema.properties.expenditures.required as string[];
    expect(required).toContain('total_stated');
  });
});

describe('budget schema is slimmed to the essentials', () => {
  const schema = JSON.parse(
    readFileSync(join(PATHS.schemas, 'budget-1.0.schema.json'), 'utf8'),
  );

  it('requires exactly the essential top-level blocks', () => {
    expect(new Set(schema.required)).toEqual(
      new Set([
        'schema_version', 'entity', 'fiscal_year', 'status', 'source',
        'revenues', 'expenditures', 'tax', 'not_published', 'lines_flagged',
      ]),
    );
  });

  it('has dropped the personnel, enrollment and per_pupil blocks', () => {
    expect(schema.properties.personnel).toBeUndefined();
    expect(schema.properties.enrollment).toBeUndefined();
    expect(schema.properties.per_pupil).toBeUndefined();
  });

  it('requires the previous-year actuals nested under revenues and expenditures', () => {
    expect(new Set(schema.properties.revenues.required)).toEqual(
      new Set(['education_fund', 'education_fund_previous_year_actual', 'total_stated']),
    );
    expect(new Set(schema.properties.expenditures.required)).toEqual(
      new Set(['total_stated', 'previous_year_actual']),
    );
  });
});
