import { describe, it, expect } from 'vitest';
import { sortExplanations } from './explanations';

type Entry = { id: string; data: { order: number; pubDate: Date } };

const entry = (id: string, order: number, iso: string): Entry => ({
  id,
  data: { order, pubDate: new Date(iso) },
});

describe('sortExplanations', () => {
  it('orders by ascending order field', () => {
    const input = [
      entry('c', 3, '2026-07-30'),
      entry('a', 1, '2026-07-28'),
      entry('b', 2, '2026-07-29'),
    ];
    expect(sortExplanations(input).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('breaks ties on order by earlier pubDate', () => {
    const input = [
      entry('later', 1, '2026-07-31'),
      entry('earlier', 1, '2026-07-01'),
    ];
    expect(sortExplanations(input).map((e) => e.id)).toEqual(['earlier', 'later']);
  });

  it('does not mutate the input array', () => {
    const input = [entry('b', 2, '2026-07-29'), entry('a', 1, '2026-07-28')];
    const snapshot = input.map((e) => e.id);
    sortExplanations(input);
    expect(input.map((e) => e.id)).toEqual(snapshot);
  });
});
