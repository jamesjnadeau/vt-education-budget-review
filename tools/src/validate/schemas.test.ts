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

describe('budget schema is reshaped around education spending', () => {
  const schema = JSON.parse(
    readFileSync(join(PATHS.schemas, 'budget-1.0.schema.json'), 'utf8'),
  );

  it('requires exactly the reshaped top-level blocks', () => {
    expect(new Set(schema.required)).toEqual(
      new Set([
        'schema_version', 'entity', 'fiscal_year', 'status', 'source',
        'education_spending', 'adm', 'tax', 'not_published', 'lines_flagged',
      ]),
    );
  });

  it('has dropped the revenues and expenditures blocks', () => {
    expect(schema.properties.revenues).toBeUndefined();
    expect(schema.properties.expenditures).toBeUndefined();
  });

  it('carries education_spending and the four statutory ADM bands', () => {
    expect(schema.properties.education_spending).toBeDefined();
    expect(new Set(schema.properties.adm.required)).toEqual(
      new Set([
        'prekindergarten', 'kindergarten_through_5',
        'grades_6_through_8', 'grades_9_through_12',
      ]),
    );
  });

  it('has an optional, non-required notes field', () => {
    expect(schema.properties.notes).toBeDefined();
    expect((schema.required as string[])).not.toContain('notes');
  });
});
