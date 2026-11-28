/**
 * The "My journey" per-place model.
 *
 * Turn the generated JSON (registry, combiner, adm-subgroups, groupings) into
 * one model object describing every tour step: a town page, its district page
 * (only where the district covers more than one town), its union page, and
 * its grouping page. Everything here is pure: the model takes plain JSON
 * shapes in and produces plain objects out, so it is unit-testable with
 * hand-made fixtures and the pages just render the result.
 *
 * Two rules govern every figure:
 *   - Never rank or recommend: scale figures are neutral ("higher than N of
 *     M towns"), never "better"/"worse".
 *   - Never invent a number: an input that is null, missing, hidden, or
 *     unverified renders as a `blank` with a plain reason, never as 0 or an
 *     estimate.
 */

import { sumCells, type Cell, type Sum, type TownYear } from './residents.ts';
import {
  committeeMoves,
  committeeOf,
  publishedCommittees,
  type ActGrouping,
  type Committee,
  type Reassignment,
} from './groupings.ts';
import { percentileOf, shareOf, median, mean, type Percentile } from './journey-scale.ts';
import { isOutOfState, slugTail, titleCase } from './display.ts';
import { DEFAULT_YEAR, myHref } from './years.ts';

export type BlankKind = 'missing_input' | 'unverified' | 'undetermined' | 'not_computable';

/** A number, or a blank with the reason it cannot be shown. */
export type Figure<T> =
  | { kind: 'value'; value: T }
  | { kind: 'blank'; why: BlankKind; reason: string };

/** Students for a place: a sum of the year's counts, or a not-computable blank. */
export type Students =
  | { kind: 'sum'; sum: Sum }
  | { kind: 'blank'; why: 'not_computable'; reason: string };

/** This town's fraction (0–1) of that level's student and people totals. */
export interface Share {
  students: Figure<number>;
  people: Figure<number>;
}

export interface Step {
  id: 'town' | 'district' | 'union' | 'grouping';
  href: string;
  label: string;
}

/** A comparator figure for one statistic: median for a rate, mean for counts.
 *  `over` is how many towns the figure covers; null when there is nothing to compare. */
export interface Comparator {
  value: number;
  over: number;
}

/** State and county comparators for the three headline statistics a town page shows. */
export interface Comparators {
  /** The year's homestead rate: the MEDIAN of published rates (a mean of rates is a figure nobody publishes). */
  rate: { state: Comparator | null; county: Comparator | null };
  /** Town-of-residence students (the year's count): the MEAN per town, over towns with an exact count. */
  students: { state: Comparator | null; county: Comparator | null };
  /** People (2020 Census): the MEAN per town, over towns with a published population. */
  people: { state: Comparator | null; county: Comparator | null };
}

export interface TownPage {
  slug: string;
  name: string;
  /** Vermont county derived from the census geoid; null when the town has no geoid. */
  county: string | null;
  rate: Figure<number>;
  rateScale: Figure<Percentile>;
  students: Students;
  studentsScale: Figure<Percentile>;
  people: Figure<number>;
  peopleScale: Figure<Percentile>;
  comparators: Comparators;
  shares: { district?: Share; union?: Share; grouping?: Share };
  steps: Step[];
  next: Step | null;
  unionSlug: string | null;
  districtSlug: string | null;
  committeeNumber: number | null;
}

export interface GroupPage {
  kind: 'district' | 'union' | 'grouping';
  slug: string;
  name: string;
  members: { town: string; name: string }[];
  rateRange: Figure<{ low: number; high: number; covers: number; of: number }>;
  students: Students;
  people: Figure<number>;
  split?: { number: number; towns: string[] }[];
  /** Union only: member towns whose district sits on no committee. */
  unassignedTowns?: { town: string; name: string }[];
  actGroup?: { number: number; moved: boolean };
  steps: Step[];
  next: Step | null;
}

export interface JourneyInputs {
  registry: Entity[];
  combiner: CombinerJson;
  subgroups: SubgroupsJson;
  groupings: GroupingsJson;
  /**
   * journey-years.json: each fiscal year's rates and student source. When it is
   * left out (hand-made test worlds), the one year asked for is read the old
   * way: rates from the combiner record, students from the town file.
   */
  years?: JourneyYearsJson;
}

/** The slice of journey-years.json the model reads. */
export interface JourneyYearsJson {
  years: JourneyYearRecord[];
}
export interface JourneyYearRecord {
  fiscal_year: number;
  rate_source: { publisher: string; title: string; published_date: string; document_page: string } | null;
  students_source: {
    kind: 'resident_district_report' | 'town_file';
    count_year: string;
    title: string | null;
    preliminary: boolean;
  } | null;
  towns: Record<string, { homestead_rate: number | null; cla?: number | null; students?: number }>;
}

/** Narrow shapes of the generated JSON, with only the fields used. */
export interface Entity {
  slug: string;
  name: string;
  type: string;
  effective_to: string | null;
  reporting_only?: boolean;
  supervisory_union: string | null;
  operated_by: string | null;
}
export interface CombinerJson {
  towns: Record<
    string,
    {
      published_homestead_rate: number | null;
      population_2020: number | null;
      county?: string | null;
    }
  >;
}
export interface SubgroupsJson {
  /** Which fiscal year each school year's count belongs to. Optional in test worlds. */
  years?: { school_year: string; count_year: string; fiscal_year: number; preliminary: boolean }[];
  towns: Record<string, Record<string, TownYear>>;
}
export interface GroupingsJson {
  reassignment: Reassignment;
  groupings: ActGrouping[];
}

export interface Journey {
  /** The fiscal year every figure here belongs to. */
  year: number;
  /** Where the year's rates come from; null when no table is on file. */
  rateSource: JourneyYearRecord['rate_source'];
  /** Which state count the year's student figures use; null when none is on file. */
  studentsSource: JourneyYearRecord['students_source'];
  towns: Record<string, TownPage>;
  districts: Record<string, GroupPage>;
  unions: Record<string, GroupPage>;
  groupings: Record<number, GroupPage>;
  townList: { slug: string; name: string }[];
  /** Every town with a published rate, lowest rate first (ties by name): one entry per dot in the rate comparison. */
  rateOrder: { slug: string; name: string; rate: number }[];
}

const SY25 = 'SY25';

type Delivered = Exclude<TownYear, { row: 'not_applicable' }>;

const NO_STUDENT_SOURCE = "the state's student count for this year is not on file here.";

/** The year's record, or one made from the combiner and the town file when no years file is given. */
function yearRecord(inputs: JourneyInputs, year: number): JourneyYearRecord {
  if (inputs.years) {
    const found = inputs.years.years.find((y) => y.fiscal_year === year);
    if (!found) throw new Error(`journey-years has no record for fiscal year ${year}`);
    return found;
  }
  const fileYear = inputs.subgroups.years?.find((y) => y.fiscal_year === year);
  return {
    fiscal_year: year,
    rate_source: null,
    students_source: {
      kind: 'town_file',
      count_year: fileYear?.count_year ?? '2024-2025',
      title: null,
      preliminary: fileYear?.preliminary ?? false,
    },
    towns: Object.fromEntries(
      Object.entries(inputs.combiner.towns).map(([slug, t]) => [slug, { homestead_rate: t.published_homestead_rate }]),
    ),
  };
}

export function buildJourney(inputs: JourneyInputs, year: number = DEFAULT_YEAR): Journey {
  const registry = inputs.registry;
  const bySlug = new Map(registry.map((e) => [e.slug, e]));
  const activeTowns = registry.filter((e) => e.type === 'town' && !e.effective_to && !e.reporting_only && !isOutOfState(e));

  const record = yearRecord(inputs, year);
  const source = record.students_source;
  // The town file's key for this fiscal year ("SY25" for FY2026).
  const schoolYear =
    source?.kind === 'town_file'
      ? (inputs.subgroups.years?.find((y) => y.fiscal_year === year)?.school_year ?? SY25)
      : null;

  /** The year's student cells for a town, or null when the year has none for it. */
  const cellsOf = (slug: string): Cell[] | null => {
    if (source?.kind === 'resident_district_report') {
      const total = record.towns[slug]?.students;
      return total === undefined ? null : [{ value: total }];
    }
    if (schoolYear === null) return null;
    const town = inputs.subgroups.towns[slug]?.[schoolYear] as Delivered | { row: 'not_applicable' } | undefined;
    if (town === undefined || town.row === 'not_applicable') return null;
    const b = town.bands;
    return [b.prekindergarten, b.kindergarten_through_5, b.grades_6_through_8, b.grades_9_through_12];
  };

  const rateOf = (slug: string): number | null => record.towns[slug]?.homestead_rate ?? null;
  const peopleOf = (slug: string): number | null => inputs.combiner.towns[slug]?.population_2020 ?? null;

  const studentsOf = (towns: string[]): Students => {
    if (source === null) return { kind: 'blank', why: 'not_computable', reason: NO_STUDENT_SOURCE } as const;
    const all = towns.flatMap((s) => cellsOf(s) ?? []);
    if (all.length === 0) {
      return { kind: 'blank', why: 'not_computable', reason: 'no students are counted as living here.' } as const;
    }
    return { kind: 'sum', sum: sumCells(all) };
  };

  const peopleTotal = (towns: string[]): Figure<number> => {
    const values = towns.map((s) => peopleOf(s));
    if (values.some((v) => v === null)) {
      return {
        kind: 'blank',
        why: 'missing_input',
        reason: 'people are not published for every town here, so the total is not shown.',
      };
    }
    return { kind: 'value', value: (values as number[]).reduce((a, b) => a + b, 0) };
  };

  const exactStudentValue = (slug: string): number | null => {
    const cells = cellsOf(slug);
    if (cells === null) return null;
    const sum = sumCells(cells);
    return sum.kind === 'exact' ? sum.value : null;
  };

  const ratePool = activeTowns.map((t) => rateOf(t.slug)).filter((v): v is number => v !== null);
  const peoplePool = activeTowns.map((t) => peopleOf(t.slug)).filter((v): v is number => v !== null);
  const studentPool = activeTowns
    .map((t) => exactStudentValue(t.slug))
    .filter((v): v is number => v !== null);

  // --- state & county comparators --------------------------------------
  // A town page shows, under each headline figure, where it sits against the
  // state and its county. Median for a RATE (a mean of rates over towns of
  // different size is a figure nobody publishes); mean per town for counts.
  const byCounty = new Map<string, string[]>();
  for (const t of activeTowns) {
    const county = inputs.combiner.towns[t.slug]?.county ?? null;
    if (county) byCounty.set(county, [...(byCounty.get(county) ?? []), t.slug]);
  }
  const stateComparator = (pick: (slug: string) => number | null, aggregate: (v: number[]) => number | null) => {
    const values = activeTowns.map((t) => pick(t.slug)).filter((v): v is number => v !== null);
    const value = aggregate(values);
    return value === null ? null : { value, over: values.length };
  };
  const countyComparator = (countySlugs: string[], pick: (slug: string) => number | null, aggregate: (v: number[]) => number | null) => {
    const values = countySlugs.map((s) => pick(s)).filter((v): v is number => v !== null);
    const value = aggregate(values);
    return value === null ? null : { value, over: values.length };
  };

  const stateRate = stateComparator((s) => rateOf(s), median);
  const stateStudents = stateComparator((s) => exactStudentValue(s), mean);
  const statePeople = stateComparator((s) => peopleOf(s), mean);
  interface CountyComparators {
    rate: Comparator | null;
    students: Comparator | null;
    people: Comparator | null;
  }
  const countyComparators = new Map<string, CountyComparators>();
  for (const [county, slugs] of byCounty) {
    countyComparators.set(county, {
      rate: countyComparator(slugs, (s) => rateOf(s), median),
      students: countyComparator(slugs, (s) => exactStudentValue(s), mean),
      people: countyComparator(slugs, (s) => peopleOf(s), mean),
    });
  }
  const comparatorsFor = (slug: string): Comparators => {
    const county = inputs.combiner.towns[slug]?.county ?? null;
    const cc = county ? countyComparators.get(county) : undefined;
    return {
      rate: { state: stateRate, county: cc?.rate ?? null },
      students: { state: stateStudents, county: cc?.students ?? null },
      people: { state: statePeople, county: cc?.people ?? null },
    };
  };

  const districtSlugOf = (t: Entity): string | null => t.operated_by;
  const districtMembers = (ds: string): string[] => activeTowns.filter((t) => t.operated_by === ds).map((t) => t.slug);
  const unionMembers = (us: string): string[] =>
    activeTowns.filter((t) => t.supervisory_union === us).map((t) => t.slug);

  const committees = publishedCommittees(inputs.groupings.reassignment);
  const committeeFor = (e: Entity): Committee | null => committeeOf(committees, e.operated_by ?? e.slug);
  const committeeTowns = (c: Committee): string[] => {
    const on = new Set<string>();
    for (const line of c.roster) {
      if (line.kind !== 'district') continue;
      for (const s of line.maps_to) {
        const e = bySlug.get(s);
        if (e?.type === 'town') on.add(s);
        if (e?.type === 'ud' || e?.type === 'sd') districtMembers(s).forEach((m) => on.add(m));
      }
    }
    return [...on];
  };

  const townStep = (slug: string): Step => ({ id: 'town', href: myHref(year, 'town', slug), label: 'Your town' });
  const districtStep = (slug: string): Step => ({
    id: 'district',
    href: myHref(year, 'district', slug),
    label: 'Your school district',
  });
  const unionStep = (slug: string): Step => ({
    id: 'union',
    href: myHref(year, 'union', slug),
    label: 'Your supervisory union',
  });
  const groupingStep = (number: number): Step => ({
    id: 'grouping',
    href: myHref(year, 'grouping', number),
    label: 'Your group',
  });

  const scale = (mine: number | null, pool: number[]): Figure<Percentile> =>
    mine === null
      ? { kind: 'blank', why: 'missing_input', reason: 'this figure is not published, so there is nothing to compare.' }
      : { kind: 'value', value: percentileOf(mine, pool) };

  const towns: Record<string, TownPage> = {};
  const districts: Record<string, GroupPage> = {};
  const unions: Record<string, GroupPage> = {};
  const groupings: Record<number, GroupPage> = {};

  for (const town of activeTowns) {
    const slug = slugTail(town.slug);
    const rate = rateOf(town.slug);
    const people = peopleOf(town.slug);
    const townStudents = studentsOf([town.slug]);
    const districtSlug = districtSlugOf(town);
    const dTowns = districtSlug ? districtMembers(districtSlug) : [town.slug];
    const hasDistrictStep = districtSlug !== null && dTowns.length > 1;
    const unionSlug = town.supervisory_union;
    const committee = committeeFor(town);

    const steps: Step[] = [townStep(slug)];
    if (hasDistrictStep && districtSlug) steps.push(districtStep(slugTail(districtSlug)));
    if (unionSlug) steps.push(unionStep(slugTail(unionSlug)));
    if (committee) steps.push(groupingStep(committee.number));
    const next = steps[1] ?? null;

    const townShare = (members: string[]): Share => {
      const tExact = townStudents.kind === 'sum' && townStudents.sum.kind === 'exact';
      const level = studentsOf(members);
      const lExact = level.kind === 'sum' && level.sum.kind === 'exact';
      const studentsShare: Figure<number> =
        tExact && lExact
          ? (() => {
              const t = (townStudents as { kind: 'sum'; sum: Extract<Sum, { kind: 'exact' }> }).sum.value;
              const l = (level as { kind: 'sum'; sum: Extract<Sum, { kind: 'exact' }> }).sum.value;
              const f = shareOf(t, l);
              return f === null
                ? { kind: 'blank', why: 'not_computable', reason: "can't tell yet." }
                : { kind: 'value', value: f };
            })()
          : {
              kind: 'blank',
              why: 'undetermined',
              reason: 'a student count here is not an exact number, so the share cannot be given.',
            };
      const totals = members.map((s) => peopleOf(s));
      const peopleShare: Figure<number> =
        people !== null && totals.every((v) => v !== null)
          ? (() => {
              const f = shareOf(people, (totals as number[]).reduce((a, b) => a + b, 0));
              return f === null
                ? { kind: 'blank', why: 'not_computable', reason: "can't tell yet." }
                : { kind: 'value', value: f };
            })()
          : {
              kind: 'blank',
              why: 'missing_input',
              reason: 'people are not published for every town here.',
            };
      return { students: studentsShare, people: peopleShare };
    };

    const shares: TownPage['shares'] = {};
    if (hasDistrictStep && districtSlug) shares.district = townShare(dTowns);
    if (unionSlug) shares.union = townShare(unionMembers(unionSlug));
    if (committee) shares.grouping = townShare(committeeTowns(committee));

    towns[slug] = {
      slug,
      name: titleCase(town.name),
      county: inputs.combiner.towns[town.slug]?.county ?? null,
      rate:
        rate === null
          ? { kind: 'blank', why: 'missing_input', reason: 'the state did not publish a homestead rate for this town.' }
          : { kind: 'value', value: rate },
      rateScale: scale(rate, ratePool),
      students: townStudents,
      studentsScale: scale(exactStudentValue(town.slug), studentPool),
      people:
        people === null
          ? { kind: 'blank', why: 'missing_input', reason: 'people are not published for this town.' }
          : { kind: 'value', value: people },
      peopleScale: scale(people, peoplePool),
      comparators: comparatorsFor(town.slug),
      shares,
      steps,
      next,
      unionSlug,
      districtSlug,
      committeeNumber: committee?.number ?? null,
    };
  }

  const rateRange = (members: string[]): Figure<{ low: number; high: number; covers: number; of: number }> => {
    const rates = members.map((s) => rateOf(s)).filter((v): v is number => v !== null);
    if (rates.length === 0) {
      return {
        kind: 'blank',
        why: 'missing_input',
        reason: 'no town here has a published homestead rate to compare.',
      };
    }
    return {
      kind: 'value',
      value: { low: Math.min(...rates), high: Math.max(...rates), covers: rates.length, of: members.length },
    };
  };

  // districts: only multi-town districts get a page
  for (const t of activeTowns) {
    const ds = t.operated_by;
    if (!ds) continue;
    const members = districtMembers(ds);
    if (members.length <= 1) continue;
    if (districts[slugTail(ds)]) continue;
    const dEntity = bySlug.get(ds);
    const slug = slugTail(ds);
    const step = districtStep(slug);
    districts[slug] = {
      kind: 'district',
      slug,
      name: titleCase(dEntity?.name ?? slug),
      members: members.map((s) => ({ town: slugTail(s), name: titleCase(bySlug.get(s)?.name ?? s) })),
      rateRange: rateRange(members),
      students: studentsOf(members),
      people: peopleTotal(members),
      steps: [step],
      next: null,
    };
  }
  // point each district's next at its union (all member towns share it)
  for (const [slug, page] of Object.entries(districts)) {
    const members = activeTowns.filter((t) => t.operated_by?.split('/')[1] === slug);
    const union = members.map((m) => m.supervisory_union).find((u) => u) ?? null;
    if (union) page.steps.push(unionStep(slugTail(union)));
    page.next = page.steps[1] ?? null;
  }

  // unions
  const unionSet = new Set(activeTowns.map((t) => t.supervisory_union).filter((s): s is string => s !== null));
  for (const us of unionSet) {
    const members = unionMembers(us);
    const uEntity = bySlug.get(us);
    const slug = slugTail(us);
    const byCommittee = new Map<number, string[]>();
    let assigned = 0;
    for (const m of members) {
      const t = bySlug.get(m);
      if (!t) continue;
      const c = committeeOf(committees, t.operated_by ?? t.slug);
      if (c) {
        byCommittee.set(c.number, [...(byCommittee.get(c.number) ?? []), m]);
        assigned += 1;
      }
    }
    const split = byCommittee.size > 1 ? [...byCommittee.entries()].map(([n, towns]) => ({ number: n, towns })) : undefined;
    // A single "next grouping" only when every member town is on that one
    // committee. If any member's district is unassigned, presenting the group
    // as "your group" would send that resident somewhere their district is not.
    const single =
      byCommittee.size === 1 && assigned === members.length ? [...byCommittee.keys()][0] : undefined;
    const unassignedTowns = members.filter((m) => {
      const t = bySlug.get(m);
      return t !== undefined && committeeOf(committees, t.operated_by ?? t.slug) === null;
    });
    const steps: Step[] = [unionStep(slug)];
    if (single !== undefined) steps.push(groupingStep(single));
    const unionPage: GroupPage = {
      kind: 'union',
      slug,
      name: titleCase(uEntity?.name ?? slug),
      members: members.map((s) => ({ town: slugTail(s), name: titleCase(bySlug.get(s)?.name ?? s) })),
      rateRange: rateRange(members),
      students: studentsOf(members),
      people: peopleTotal(members),
      steps,
      next: single !== undefined ? groupingStep(single) : null,
    };
    if (split) unionPage.split = split;
    if (unassignedTowns.length > 0) {
      unionPage.unassignedTowns = unassignedTowns.map((s) => ({
        town: slugTail(s),
        name: titleCase(bySlug.get(s)?.name ?? s),
      }));
    }
    unions[slug] = unionPage;
  }

  // groupings (the facilitators' committees)
  for (const c of committees) {
    const members = committeeTowns(c);
    const actGroup = inputs.groupings.groupings.find((g) => g.number === c.number);
    const moves = committeeMoves(inputs.groupings.groupings, committees).filter(
      (m) => m.from_grouping === c.number || m.to_grouping === c.number,
    );
    const so: GroupPage = {
      kind: 'grouping',
      slug: String(c.number),
      name: c.name,
      members: members.map((s) => ({ town: slugTail(s), name: titleCase(bySlug.get(s)?.name ?? s) })),
      rateRange: rateRange(members),
      students: studentsOf(members),
      people: peopleTotal(members),
      steps: [groupingStep(c.number)],
      next: null,
    };
    if (actGroup) so.actGroup = { number: actGroup.number, moved: moves.length > 0 };
    groupings[c.number] = so;
  }

  return {
    year,
    rateSource: record.rate_source,
    studentsSource: source,
    towns,
    districts,
    unions,
    groupings,
    townList: activeTowns.map((t) => ({ slug: slugTail(t.slug), name: titleCase(t.name) })),
    rateOrder: activeTowns
      .map((t) => ({ slug: slugTail(t.slug), name: titleCase(t.name), rate: rateOf(t.slug) }))
      .filter((t): t is { slug: string; name: string; rate: number } => t.rate !== null)
      .sort((a, b) => a.rate - b.rate || a.name.localeCompare(b.name)),
  };
}
