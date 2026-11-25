import { describe, expect, it } from 'vitest';
import { entityLabel, isOutOfState, titleCase } from './display';

describe('titleCase', () => {
  it('keeps state codes upper-case', () => {
    expect(titleCase('ORFORD NH')).toBe('Orford NH');
    expect(titleCase('BARTON ID')).toBe('Barton ID');
  });
  it('leaves a name that is not shouting alone', () => {
    expect(titleCase('Barton Id')).toBe('Barton Id');
  });
});

describe('isOutOfState', () => {
  it('flags names that end in NH, NY or MA', () => {
    expect(isOutOfState({ name: 'ORFORD NH' })).toBe(true);
    expect(isOutOfState({ name: 'SOMEWHERE NY' })).toBe(true);
    expect(isOutOfState({ name: 'SOMEWHERE MA' })).toBe(true);
  });
  it('does not flag a Vermont town', () => {
    expect(isOutOfState({ name: 'NORWICH' })).toBe(false);
  });
});

describe('entityLabel', () => {
  it('returns the title-cased name', () => {
    expect(entityLabel('town/milton', [{ slug: 'town/milton', name: 'MILTON' }])).toBe('Milton');
  });
  it('says not checked yet for a null or unknown slug, never the raw id', () => {
    expect(entityLabel(null, [])).toBe('not checked yet');
    expect(entityLabel('ud/nope', [])).toBe('not checked yet');
  });
});
