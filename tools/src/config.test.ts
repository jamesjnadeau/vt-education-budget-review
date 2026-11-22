import { describe, expect, it } from 'vitest';
import { intakeFormUrl } from './config.ts';

describe('intakeFormUrl', () => {
  it('builds a site-relative, encoded link to the web form', () => {
    expect(intakeFormUrl('su/x', 2027)).toBe('/contribute/?entity=su%2Fx&fiscal_year=2027');
  });
});
