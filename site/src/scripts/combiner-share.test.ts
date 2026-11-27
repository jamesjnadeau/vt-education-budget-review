import { describe, expect, it } from 'vitest';

import {
  decodeCombiner,
  encodeCombiner,
  linkFigureNote,
  shareCombinerUrl,
  unknownDistrictNote,
  type CombinerShareState,
} from './combiner-share.ts';

const KNOWN = new Set(['town/burlington', 'town/winooski', 'town/south-burlington', 'ud/maple-run-57']);

const BLANK_EXTRAS = {
  statePlaced: '',
  poverty: '',
  el: '',
  school: '',
  enrollment: '',
  schoolIn: '',
  avg: '',
  povertyEstimate: false,
  elEstimate: false,
} as const;

const BASE: CombinerShareState = {
  year: 2026,
  districts: ['town/burlington', 'town/winooski'],
  factor: '1',
  act84: '0',
  density: '',
  ...BLANK_EXTRAS,
};

describe('combiner share link', () => {
  it('round-trips every field', () => {
    const state: CombinerShareState = {
      year: 2026,
      districts: ['town/burlington', 'town/winooski', 'ud/maple-run-57'],
      factor: '0.95',
      act84: '0.05',
      density: '42.5',
      statePlaced: '3',
      poverty: '410',
      el: '96',
      school: 'Fletcher Elementary',
      enrollment: '80',
      schoolIn: 'ud/maple-run-57',
      avg: '13500',
      povertyEstimate: false,
      elEstimate: false,
    };
    const decoded = decodeCombiner(encodeCombiner(state), KNOWN);
    expect(decoded.state).toEqual(state);
    expect(decoded.unknown).toEqual([]);
    expect(decoded.ignoredYear).toBeNull();
  });

  it('accepts the five fields the brief names, without the optional ones', () => {
    const query = encodeCombiner({ year: 2026, districts: ['town/burlington'], factor: '1', act84: '0', density: '30' });
    expect(decodeCombiner(query, KNOWN).state).toEqual({
      ...BASE,
      districts: ['town/burlington'],
      density: '30',
    });
  });

  it('leaves a blank factor (and every other blank) out of the URL', () => {
    const params = new URLSearchParams(encodeCombiner({ ...BASE, factor: '', act84: '  ' }));
    expect(params.has('factor')).toBe(false);
    expect(params.has('act84')).toBe(false);
    expect(params.has('density')).toBe(false);
    expect(params.has('poverty')).toBe(false);
    expect([...params.keys()]).toEqual(['y', 'd']);
  });

  it('puts an unknown district slug in `unknown`, not in `districts`, and does not throw', () => {
    const decoded = decodeCombiner('y=2026&d=town/burlington,ud/nope,town/winooski', KNOWN);
    expect(decoded.state.districts).toEqual(['town/burlington', 'town/winooski']);
    expect(decoded.unknown).toEqual(['ud/nope']);
  });

  it('ignores an unsupported year, and flags it instead of throwing', () => {
    const decoded = decodeCombiner('y=2027&d=town/burlington', KNOWN);
    expect(decoded.state.year).toBe(2026);
    expect(decoded.ignoredYear).toBe('2027');

    const garbled = decodeCombiner('y=next-year', KNOWN);
    expect(garbled.state.year).toBe(2026);
    expect(garbled.ignoredYear).toBe('next-year');
  });

  it('ignores unrelated params such as utm_source', () => {
    const decoded = decodeCombiner('utm_source=newsletter&d=town/burlington,town/winooski&factor=1&act84=0', KNOWN);
    expect(decoded.state).toEqual(BASE);
    expect(decoded.unknown).toEqual([]);
  });

  it('drops repeated and empty slugs and tolerates a mangled query', () => {
    const decoded = decodeCombiner('?d=town/burlington,,town/burlington, town/winooski&%%%=1', KNOWN);
    expect(decoded.state.districts).toEqual(['town/burlington', 'town/winooski']);
    expect(() => decodeCombiner('%E0%A4%A', KNOWN)).not.toThrow();
  });

  it('builds a URL that is just the base when nothing is set', () => {
    const empty: CombinerShareState = { ...BASE, districts: [], factor: '', act84: '' };
    expect(shareCombinerUrl('https://example.org/combiner/', empty)).toBe(
      'https://example.org/combiner/?y=2026',
    );
    expect(shareCombinerUrl('https://example.org/combiner/', BASE)).toMatch(/^https:\/\/example\.org\/combiner\/\?y=2026&d=/);
  });
});

describe('the note about figures a link filled in', () => {
  const PUBLISHED = 13_497;
  const note = (query: string) => linkFigureNote(decodeCombiner(query, KNOWN).state, PUBLISHED);

  it('lists each figure the link filled and says it came from whoever made the link', () => {
    const got = note('y=2026&d=town/burlington,town/winooski&factor=0.95&act84=0.05&density=60&state_placed=2&poverty=200&el=5');
    expect(got?.items).toEqual([
      'Spending factor: 0.95.',
      'Pooled Act 84 decrease: 0.05 dollars per $100.',
      'Population density: 60 people per square mile.',
      'State-placed students: 2.',
      'Students from lower-income homes: 200.',
      'English learners: 5.',
    ]);
    expect(got?.lead).toMatch(/whoever made the link/);
    expect(got?.lead).toMatch(/not from the State/);
  });

  it('flags a statewide average that differs from the published one, and skips one that matches', () => {
    expect(note('d=town/burlington&avg=14000')?.items).toEqual([
      'Statewide average spending per weighted student: $14,000. This is not the State’s published figure, which is $13,497.',
    ]);
    expect(note('d=town/burlington&avg=13497')).toBeNull();
    expect(linkFigureNote(decodeCombiner('avg=14000', KNOWN).state, null)?.items).toEqual([
      'Statewide average spending per weighted student: $14,000.',
    ]);
  });

  it('says nothing for a link that only carries districts and the page’s own starting values', () => {
    expect(note('y=2026&d=town/burlington,town/winooski&factor=1&act84=0')).toBeNull();
    expect(note('')).toBeNull();
  });

  it('names a small school and its enrollment, and cuts long text short', () => {
    const got = note(`school=${'x'.repeat(200)}&enrollment=80`);
    expect(got?.items).toContain('A small school’s average enrollment: 80.');
    const school = got?.items.find((i) => i.startsWith('A small school:')) ?? '';
    expect(school.length).toBeLessThan(60);
    expect(school).toMatch(/…\.$/);
  });
});

describe('the note about districts a link names that the page does not know', () => {
  it('is null when every district is known', () => {
    expect(unknownDistrictNote([])).toBeNull();
  });

  it('names one or a few in full', () => {
    expect(unknownDistrictNote(['ud/nope'])).toEqual({
      title: 'This link names a district this page does not know. It was left out.',
      lead: '',
      items: ['ud/nope'],
    });
    expect(unknownDistrictNote(['a', 'b', 'c'])?.items).toEqual(['a', 'b', 'c']);
  });

  it('gives a count and at most three names, each cut short', () => {
    const many = Array.from({ length: 50 }, (_, i) => `ud/${'z'.repeat(100)}-${i}`);
    const got = unknownDistrictNote(many);
    expect(got?.title).toBe('This link names 50 districts this page does not know. They were left out.');
    expect(got?.items).toHaveLength(3);
    for (const name of got?.items ?? []) expect(name.length).toBeLessThanOrEqual(40);
    expect(got?.lead).toBe('The first 3 are below, and 47 more are not shown.');
  });

  it('works on a decoded link', () => {
    const decoded = decodeCombiner('d=town/burlington,ud/one,ud/two,ud/three,ud/four', KNOWN);
    expect(unknownDistrictNote(decoded.unknown)?.lead).toBe('The first 3 are below, and 1 more is not shown.');
  });
});

describe('estimate flags', () => {
  it('round-trips both flags and leaves the filled number out of the link', () => {
    const state: CombinerShareState = { ...BASE, poverty: '410', el: '96', povertyEstimate: true, elEstimate: true };
    const query = encodeCombiner(state);
    expect(query).toContain('poverty_est=1');
    expect(query).toContain('el_est=1');
    expect(query).not.toContain('poverty=');
    expect(query).not.toContain('el=');
    const back = decodeCombiner(query, KNOWN).state;
    expect(back.povertyEstimate).toBe(true);
    expect(back.elEstimate).toBe(true);
  });

  it('leaves the params out when false, so old links are unchanged', () => {
    const query = encodeCombiner({ ...BASE, poverty: '410' });
    expect(query).not.toContain('_est');
    expect(query).toContain('poverty=410');
    const old = decodeCombiner('y=2026&d=town/burlington&poverty=5', KNOWN).state;
    expect(old.povertyEstimate).toBe(false);
    expect(old.elEstimate).toBe(false);
  });

  it('reads only exactly 1 as true', () => {
    const s = decodeCombiner('d=town/burlington&poverty_est=2&el_est=true', KNOWN).state;
    expect(s.povertyEstimate).toBe(false);
    expect(s.elEstimate).toBe(false);
  });

  it('notes estimate-filled figures only when flagged, and not as the sharer’s entries', () => {
    const flagged = linkFigureNote(decodeCombiner('d=town/burlington&poverty_est=1', KNOWN).state, 13_497);
    expect(flagged?.items.join(' ')).toMatch(/Students from lower-income homes: filled from the State’s town-level counts as an estimate/);
    expect(flagged?.items.join(' ')).not.toMatch(/English learners/);
    expect(linkFigureNote(decodeCombiner('d=town/burlington', KNOWN).state, 13_497)).toBeNull();
  });
});
