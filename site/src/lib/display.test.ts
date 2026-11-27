import { describe, expect, it } from 'vitest';
import { entityLabel, isOutOfState, operatorHref, titleCase } from './display.ts';

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

describe('operatorHref', () => {
  const built = new Set(['barre-97', 'rivendell-interstate']);
  it('links a union district whose page is built', () => {
    expect(operatorHref('ud/barre-97', built, '/b')).toBe('/b/my/district/barre-97/');
  });
  it('links a town that runs a built district', () => {
    expect(operatorHref('town/rivendell-interstate', built, '')).toBe('/my/district/rivendell-interstate/');
  });
  it('is null for a district with no page', () => {
    expect(operatorHref('ud/nope-1', built, '')).toBeNull();
  });
  it('falls back to the town and union pages', () => {
    expect(operatorHref('town/milton', built, '')).toBe('/town/milton/');
    expect(operatorHref('su/milton', built, '')).toBe('/su/milton/');
  });
  it('is null for no operator', () => {
    expect(operatorHref(null, built, '')).toBeNull();
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
