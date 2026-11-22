/**
 * Which list of district groups the build runs its scenarios over.
 *
 * `registry/groupings.yaml` holds two: the act's twenty groupings, transcribed
 * from the law, and -- once the facilitators' list is in -- the merger study
 * committees under `reassignment.committees`. The committees are the groups
 * districts are actually meeting in, so when the roster is published they are
 * what the grouping pages and the combiner run. The act's list is the fallback
 * for a file with no published roster.
 *
 * Career and technical centers sit on some committees but are not districts:
 * they have no budget record or ADM here, and are left out of the members.
 */
import type { GroupingInput } from './grouping-budgets.ts';

export interface CommitteeMemberInput {
  readonly name_as_written: string;
  readonly maps_to: readonly string[];
  readonly kind: 'district' | 'career_technical_center';
}

export interface CommitteeInput {
  readonly number: number;
  readonly slug: string;
  readonly name: string;
  readonly roster: readonly CommitteeMemberInput[];
}

export interface GroupingsDoc {
  readonly groupings?: readonly GroupingInput[];
  readonly reassignment?: {
    readonly roster_published: boolean;
    readonly committees?: readonly CommitteeInput[];
  } | null;
}

/** A committee as a grouping: district slugs, each with the name it is written under. */
export function committeeAsGrouping(c: CommitteeInput): GroupingInput {
  const members: string[] = [];
  const names: string[] = [];
  for (const line of c.roster) {
    if (line.kind !== 'district') continue;
    for (const slug of line.maps_to) {
      members.push(slug);
      names.push(line.name_as_written);
    }
  }
  return { number: c.number, slug: c.slug, name: c.name, members, member_names_as_written: names };
}

/** The committees when their roster is published, otherwise the act's groupings. */
export function operativeGroupings(doc: GroupingsDoc): GroupingInput[] {
  const r = doc.reassignment;
  if (r?.roster_published && r.committees && r.committees.length > 0) {
    return [...r.committees].sort((a, b) => a.number - b.number).map(committeeAsGrouping);
  }
  return [...(doc.groupings ?? [])];
}
