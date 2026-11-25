import { describe, expect, it } from 'vitest';
import { EXAMPLE_HOUSE, rateRangeText, rateUnitLine, rateUnitFor, rateUnitParts } from './rate-format.ts';

describe('rateUnitLine', () => {
  it('prints the exact sentence for 1.2462', () => {
    expect(rateUnitLine(1.2462)).toBe(
      '$1.2462 per $100 of value ($12.46 per $1,000). About $3,116 a year on a $250,000 house (an example). School tax only, before the property tax credit.',
    );
  });
  it('rounds the half dollar up (3115.5 gives 3,116)', () => {
    expect(rateUnitLine(1.2462)).toContain('About $3,116');
  });
  it('handles 1.8777', () => {
    const t = rateUnitLine(1.8777);
    expect(t).toContain('$18.78 per $1,000');
    expect(t).toContain('About $4,694');
  });
  it('has no semicolon', () => {
    expect(rateUnitLine(1.2462)).not.toContain(';');
  });
  it('splits into parts that join back to the line', () => {
    const p = rateUnitParts(1.2462);
    expect(p.linkText).toBe('before the property tax credit');
    expect(p.before + p.linkText + p.after).toBe(rateUnitLine(1.2462));
  });
  it('uses a $250,000 example house', () => {
    expect(EXAMPLE_HOUSE).toBe(250_000);
  });
});

describe('rateRangeText', () => {
  it('shows both per-$100 figures and both example dollars', () => {
    const t = rateRangeText(1.0207, 1.8777);
    expect(t).toContain('$1.0207');
    expect(t).toContain('$1.8777');
    expect(t).toContain('per $100 of value');
    expect(t).toContain('$2,552');
    expect(t).toContain('$4,694');
    expect(t).toContain('(an example)');
  });
});

describe('rateUnitFor (the guard JourneyStats renders through)', () => {
  it('returns null for a blank, so no $ and no "per $100" can render', () => {
    const p = rateUnitFor({ kind: 'blank', why: 'not_computable', reason: 'x' } as never);
    expect(p).toBeNull();
    const text = p ? p.before + p.linkText + p.after : '';
    expect(text).not.toContain('$');
    expect(text).not.toContain('per $100');
  });
  it('returns the parts for a value', () => {
    const p = rateUnitFor({ kind: 'value', value: 1.2462 } as never);
    expect(p).toEqual(rateUnitParts(1.2462));
  });
});
