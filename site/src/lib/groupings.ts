/**
 * Reading the grouping file's `reassignment` block.
 *
 * Act 170 printed twenty groups of districts. It also let the merger-study
 * facilitators change them, and on 2026-09-18 they did: 119 districts into 18
 * committees, after 13 districts asked to be moved. `registry/groupings.yaml`
 * still holds the act's text -- that is what makes it checkable -- and records
 * the change beside it.
 *
 * The facilitators' own list is now in, under `reassignment.committees`: it is
 * their preliminary list of 2026-09-18, and the committees are not yet checked
 * line by line by a person. The helpers here read moves off it by comparing
 * the committees with the act's groups -- moves are not recorded twice -- so
 * no page has to work that out for itself.
 *
 * `known_changes` predates the list (the moves pieced together from news
 * reports before it was obtained). Once `roster_published` is true, pages use
 * the committees, not `known_changes`, to say what moved.
 */

export interface KnownChange {
  district: string;
  district_name_as_written: string | null;
  from_grouping: number | null;
  to_grouping: number | null;
  to_grouping_as_reported: string | null;
  to_grouping_basis: 'published' | 'inferred' | 'unknown';
  verified: boolean;
  note?: string | null;
}

export interface ReassignmentSource {
  publisher: string;
  title: string;
  url: string;
  published_date: string;
  retrieved_date: string;
  retrieved_by: string;
  quote?: string | null;
  note?: string | null;
}

export interface Reassignment {
  by: string;
  status: 'announced_provisional' | 'final';
  as_of: string;
  committee_count: number | null;
  district_count: number | null;
  requests_granted: number | null;
  comment_deadline: string | null;
  finalize_target: string | null;
  first_meeting_deadline: string | null;
  roster_published: boolean;
  additional_adjustments?: boolean | null;
  sources: ReassignmentSource[];
  known_changes: KnownChange[];
  committees?: Committee[];
  note?: string | null;
}

export interface CommitteeMember {
  name_as_written: string;
  maps_to: string[];
  kind: 'district' | 'career_technical_center';
  adm_as_published?: number | null;
  note?: string | null;
}

export interface Committee {
  number: number;
  slug: string;
  name: string;
  name_as_written: string;
  region?: string | null;
  adm_total_as_published?: number | null;
  roster: CommitteeMember[];
  verified: boolean;
  note?: string | null;
}

/** The act's groups as the pages need them. */
export interface ActGrouping {
  number: number;
  members: string[];
  member_names_as_written?: string[];
}

/** A district (one written name) that sits in a different group than the act put it in. */
export interface CommitteeMove {
  /** Registry slugs. More than one when a single written name maps to A/B records. */
  districts: string[];
  name: string;
  from_grouping: number;
  /** The committee it is now in. */
  to_grouping: number;
}

/** The committees, only once the facilitators' roster is in. Otherwise empty. */
export function publishedCommittees(reassignment: Reassignment | null | undefined): Committee[] {
  if (!reassignment?.roster_published) return [];
  return [...(reassignment.committees ?? [])].sort((a, b) => a.number - b.number);
}

/** Which committee each district slug is on. Tech centers are left out. */
function committeeBySlug(committees: Committee[]): Map<string, { number: number; name: string }> {
  const out = new Map<string, { number: number; name: string }>();
  for (const c of committees)
    for (const line of c.roster)
      if (line.kind === 'district') for (const slug of line.maps_to) out.set(slug, { number: c.number, name: line.name_as_written });
  return out;
}

/**
 * Every district on a committee other than its act group's. A written name
 * that maps to several records (West River A and B) is one move, not two.
 * Supervisory unions the act listed but the committees name by district are
 * not moves -- see `unlistedActMembers`.
 */
export function committeeMoves(acts: ActGrouping[], committees: Committee[]): CommitteeMove[] {
  if (committees.length === 0) return [];
  const where = committeeBySlug(committees);
  const moves = new Map<string, CommitteeMove>();
  for (const g of acts) {
    for (const slug of g.members) {
      const now = where.get(slug);
      if (!now || now.number === g.number) continue;
      const key = `${now.name}|${g.number}|${now.number}`;
      const m = moves.get(key);
      if (m) m.districts.push(slug);
      else moves.set(key, { districts: [slug], name: now.name, from_grouping: g.number, to_grouping: now.number });
    }
  }
  return [...moves.values()].sort((a, b) => a.from_grouping - b.from_grouping || a.name.localeCompare(b.name));
}

/** Act members on no committee at all, with the name the act used. */
export function unlistedActMembers(acts: ActGrouping[], committees: Committee[]): { slug: string; name: string; from_grouping: number }[] {
  if (committees.length === 0) return [];
  const where = committeeBySlug(committees);
  const out: { slug: string; name: string; from_grouping: number }[] = [];
  for (const g of acts) {
    // Act names are paired with members by index only when the lists line up.
    const aligned = g.member_names_as_written?.length === g.members.length;
    g.members.forEach((slug, i) => {
      if (!where.has(slug))
        out.push({ slug, name: aligned ? g.member_names_as_written![i]! : slug, from_grouping: g.number });
    });
  }
  return out;
}

/** Act group numbers with no committee: the groups the facilitators dissolved. */
export function dissolvedGroups(acts: ActGrouping[], committees: Committee[]): number[] {
  if (committees.length === 0) return [];
  const kept = new Set(committees.map((c) => c.number));
  return acts.map((g) => g.number).filter((n) => !kept.has(n));
}

/** The sum of a committee's printed district ADM figures, or null if any is missing. */
export function committeeAdmSum(c: Committee): number | null {
  let sum = 0;
  for (const line of c.roster) {
    if (line.kind !== 'district') continue;
    if (line.adm_as_published == null) return null;
    sum += line.adm_as_published;
  }
  return sum;
}

/** Every recorded move that touches a given act group, in or out. */
export function changesTouching(
  reassignment: Reassignment | null | undefined,
  groupNumber: number,
): KnownChange[] {
  if (!reassignment) return [];
  return reassignment.known_changes.filter(
    (c) => c.from_grouping === groupNumber || c.to_grouping === groupNumber,
  );
}

/**
 * How many moves happened that we cannot see. `requests_granted` counts the
 * districts the facilitators moved; `known_changes` is the handful reported by
 * name. The difference is what a reader is not being told, and pages say the
 * number out loud rather than implying the list is complete.
 */
export function unseenChangeCount(reassignment: Reassignment | null | undefined): number | null {
  if (!reassignment || reassignment.requests_granted === null) return null;
  return Math.max(0, reassignment.requests_granted - reassignment.known_changes.length);
}

/**
 * Whether `unseenChangeCount` is a floor rather than a count. The thirteen
 * granted requests are not every move: the facilitators also moved districts
 * on their own to balance the groups, and did not say how many. When a source
 * says so, pages say "at least N" -- an exact-looking number there would be a
 * confident undercount.
 */
export function unseenIsFloor(reassignment: Reassignment | null | undefined): boolean {
  return reassignment?.additional_adjustments === true;
}

/**
 * Whether the day the facilitators meant to settle the groups is behind us
 * while we still hold them as provisional. A page built after that day must
 * not leave "they aimed to settle them on ..." standing alone, or it reads as
 * though they did. `today` is a plain ISO date, passed in so builds and tests
 * agree on what "now" is.
 */
export function settleDatePassedUnconfirmed(
  reassignment: Reassignment | null | undefined,
  today: string,
): boolean {
  if (!reassignment || reassignment.status !== 'announced_provisional') return false;
  if (!reassignment.finalize_target) return false;
  return reassignment.finalize_target < today;
}

/** "September 18, 2026" from "2026-09-18". Dates here are plain ISO dates. */
export function longDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** The committee a district slug is on, if any. */
export function committeeOf(committees: Committee[], slug: string): Committee | null {
  return committees.find((c) => c.roster.some((l) => l.kind === 'district' && l.maps_to.includes(slug))) ?? null;
}

/**
 * Where each of an act group's districts sits now, one entry per written name
 * on the committee list (so West River A and B are one line). Names come from
 * the committee roster, not the act: the act's name list is not always the
 * same length as its member list, so pairing by index can drift.
 */
export function whereMembersWent(
  act: ActGrouping,
  committees: Committee[],
): { name: string; committee: Committee | null }[] {
  const namesAlign = act.member_names_as_written?.length === act.members.length;
  const out: { name: string; committee: Committee | null }[] = [];
  const seen = new Set<string>();
  act.members.forEach((slug, i) => {
    const c = committeeOf(committees, slug);
    const line = c?.roster.find((l) => l.kind === 'district' && l.maps_to.includes(slug));
    const name = line?.name_as_written ?? (namesAlign ? act.member_names_as_written![i]! : slug);
    if (seen.has(name)) return;
    seen.add(name);
    out.push({ name, committee: c });
  });
  return out;
}
