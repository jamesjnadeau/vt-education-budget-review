/**
 * Reading the grouping file's `reassignment` block.
 *
 * Act 170 printed twenty groups of districts. It also let the merger-study
 * facilitators change them, and on 2026-09-18 they did: 119 districts into 18
 * committees, after 13 districts asked to be moved. `registry/groupings.yaml`
 * still holds the act's text -- that is what makes it checkable -- and records
 * the change beside it.
 *
 * The helpers here exist so no page has to decide for itself how much of that
 * to say. Two rules, and they are the whole point of this module:
 *
 *   1. While `roster_published` is false we do not have the new committee
 *      lists, so a page may never present an act group as the answer to "who
 *      am I studying a merger with?" without saying the groups were redrawn.
 *   2. We hold one of the thirteen moves. A group with no known change is not
 *      a group that did not change -- it is a group we cannot see. Pages say
 *      that, rather than staying quiet and letting the silence read as "yours
 *      is fine".
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
  sources: ReassignmentSource[];
  known_changes: KnownChange[];
  note?: string | null;
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
