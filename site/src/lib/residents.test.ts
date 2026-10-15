import { describe, it, expect } from 'vitest';
import { bound, sumCells, type Cell } from './residents.ts';

const primary: Cell = { status: 'suppressed', low: 0, high: 10, exclusive_low: true };
const floor: Cell = { status: 'suppressed', low: 0, high: 10, exclusive_low: false };
const pair: Cell = { status: 'suppressed', low: 0, high: null, exclusive_low: true };
const complement: Cell = { status: 'suppressed' };

describe('bound', () => {
  it('reads an exclusive low as the next whole student', () => {
    expect(bound({ status: 'suppressed', low: 0, high: 10, exclusive_low: true })).toBe(
      '1 to 10 students',
    );
  });
  it('keeps an inclusive low as it is', () => {
    expect(bound({ status: 'suppressed', low: 0, high: 10, exclusive_low: false })).toBe(
      '0 to 10 students',
    );
  });
  it('says "at least" when there is no high', () => {
    expect(bound({ status: 'suppressed', low: 0, high: null, exclusive_low: true })).toBe(
      'at least 1 student',
    );
  });
  it('gives nothing for a cell the source does not bound', () => {
    expect(bound({ status: 'suppressed' })).toBeNull();
  });
});

describe('sumCells', () => {
  it('adds published values to one exact number', () => {
    expect(sumCells([{ value: 12.5 }, { value: 30 }, { value: 0 }])).toEqual({
      kind: 'exact',
      value: 42.5,
    });
  });

  it('is nothing when there are no cells', () => {
    expect(sumCells([])).toEqual({ kind: 'none' });
  });

  it('turns one hidden cell into a range around the published ones', () => {
    const s = sumCells([{ value: 100 }, primary]);
    expect(s).toEqual({ kind: 'range', low: 101, high: 110, hidden: 1 });
  });

  it('counts a below-floor cell from zero', () => {
    expect(sumCells([{ value: 100 }, floor])).toEqual({ kind: 'range', low: 100, high: 110, hidden: 1 });
  });

  it('loses the top of the range when any hidden cell has no high', () => {
    expect(sumCells([{ value: 100 }, primary, pair])).toEqual({
      kind: 'range',
      low: 102,
      high: null,
      hidden: 2,
    });
  });

  it('adds nothing for a cell with no bound at all', () => {
    expect(sumCells([{ value: 100 }, complement])).toEqual({
      kind: 'range',
      low: 100,
      high: null,
      hidden: 1,
    });
  });

  it('is not usable when the year did not publish the measure', () => {
    expect(sumCells([{ value: 100 }, { status: 'not_published' }])).toEqual({ kind: 'not_usable' });
  });

  it('keeps decimals through the sum', () => {
    const s = sumCells([{ value: 0.1 }, { value: 0.2 }, primary]);
    expect(s.kind).toBe('range');
    if (s.kind !== 'range') return;
    expect(s.low).toBeCloseTo(1.3, 10);
    expect(s.high).toBeCloseTo(10.3, 10);
  });
});
