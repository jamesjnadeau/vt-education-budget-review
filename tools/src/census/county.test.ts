import { describe, expect, it } from 'vitest';
import { countyFromGeoid, VT_COUNTIES } from './county.ts';

describe('VT_COUNTIES', () => {
  it('has all 14 Vermont counties', () => {
    expect(Object.entries(VT_COUNTIES)).toHaveLength(14);
    // covers the letters most people would search by
    expect(VT_COUNTIES['001']).toBe('Addison');
    expect(VT_COUNTIES['027']).toBe('Windsor');
  });
});

describe('countyFromGeoid', () => {
  it('reads the county FIPS from the middle of a county-subdivision GEOID', () => {
    // 50 = Vermont, 001 = Addison County, rest = the town's subdivision.
    expect(countyFromGeoid('5000100325')).toBe('Addison');
  });
  it('returns null for a geoid outside Vermont or with no known county', () => {
    expect(countyFromGeoid('0100100325')).toBeNull();
    expect(countyFromGeoid('5009900325')).toBeNull();
  });
  it('returns null for a malformed geoid', () => {
    expect(countyFromGeoid('10')).toBeNull();
    expect(countyFromGeoid('not-a-geoid')).toBeNull();
  });
});
