/**
 * The auto-fill/override decision for the statewide-average field.
 *
 * The statewide average is a published determination, so when a fiscal year has
 * one on file the field should offer it -- but it must never overwrite a figure
 * the user typed themselves. This pure function holds that judgement so it can
 * be tested without a DOM; the island is thin glue over it.
 */

import { describe, expect, it } from 'vitest';

import { nextStatewideAverage } from './statewide-average.ts';

describe('nextStatewideAverage', () => {
  it('fills an empty field with the selected year figure', () => {
    expect(nextStatewideAverage(15000, '', null)).toEqual({ field: '15000', autofilled: 15000 });
  });

  it('replaces a prior auto-filled figure when the year changes', () => {
    expect(nextStatewideAverage(16000, '15000', 15000)).toEqual({ field: '16000', autofilled: 16000 });
  });

  it('leaves a figure the user typed untouched', () => {
    expect(nextStatewideAverage(16000, '12345', null)).toBeNull();
  });

  it('does not clobber a figure the user edited after an auto-fill', () => {
    expect(nextStatewideAverage(16000, '15500', 15000)).toBeNull();
  });

  it('clears a stale auto-fill when the new year has no published figure', () => {
    expect(nextStatewideAverage(null, '15000', 15000)).toEqual({ field: '', autofilled: null });
  });

  it('leaves an empty field empty when the year has no published figure', () => {
    expect(nextStatewideAverage(null, '', null)).toEqual({ field: '', autofilled: null });
  });
});
