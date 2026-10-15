/**
 * Turns the committed town-grain subgroup records into the JSON the site reads.
 *
 * Two things happen here and nowhere else:
 *
 *   - A registry town that has no row in a year is published as
 *     `not_applicable`. The suppression query emits a row for every town-year
 *     with at least one resident student, so absence means zero -- unless the
 *     registry says the entity had already closed, in which case the absence is
 *     the registry's fact, not the extract's. The warehouse stays a
 *     transcription of what was delivered; the derivation lives at build time
 *     where it is re-run against the current registry on every build.
 *
 *   - Withheld cells are reduced to their bounds. The disclosure codes and
 *     suppression kinds stay in the warehouse; the site gets "between 1 and 10"
 *     or "at least 1" and nothing that would let a reader play the query back.
 */

import type { RegistryEntity } from '../../registry/types.ts';
import { BANDS, type Band, type Cell } from './cells.ts';
import type { SchoolYear } from './parse.ts';
import type { YearRecord } from './record.ts';

export type PublishedCell =
  | { readonly value: number }
  | {
      readonly status: 'suppressed';
      readonly low?: number;
      readonly high?: number | null;
      readonly exclusive_low?: boolean;
    }
  | { readonly status: 'not_published' };

export type PublishedTownYear =
  | {
      readonly row: 'published' | 'below_reporting_floor';
      readonly bands: Readonly<Record<Band, PublishedCell>>;
      readonly ell: PublishedCell;
      readonly nslelg: PublishedCell;
    }
  | {
      readonly row: 'not_applicable';
      readonly reason: 'no_resident_students' | 'entity_closed';
    };

export interface SubgroupPublication {
  readonly generated: string;
  readonly years: ReadonlyArray<{
    readonly school_year: SchoolYear;
    readonly count_year: string;
    readonly fiscal_year: number;
    readonly preliminary: boolean;
    readonly preliminary_note: string | null;
    readonly not_published: ReadonlyArray<{ path: string; note: string }>;
  }>;
  readonly towns: Readonly<Record<string, Readonly<Record<string, PublishedTownYear>>>>;
}

function publishCell(cell: Cell | null): PublishedCell {
  if (cell === null) return { status: 'not_published' };
  if (typeof cell === 'number') return { value: cell };
  const s = cell.suppressed;
  if (s.kind === 'complement') return { status: 'suppressed' };
  return {
    status: 'suppressed',
    low: s.low,
    high: s.high,
    exclusive_low: s.exclusive_low,
  };
}

/** True when the registry says the entity had closed before the count year began. */
function closedBefore(entity: RegistryEntity, countYear: string): boolean {
  if (!entity.effective_to) return false;
  const start = `${countYear.slice(0, 4)}-07-01`;
  return entity.effective_to <= start;
}

export function buildSubgroupPublication(
  records: ReadonlyArray<YearRecord>,
  registry: ReadonlyMap<string, RegistryEntity>,
  generated: string,
): SubgroupPublication {
  const sorted = [...records].sort((a, b) => a.school_year.localeCompare(b.school_year));
  const seen = new Set<string>();
  for (const r of sorted) {
    if (seen.has(r.school_year)) throw new Error(`two subgroup records for ${r.school_year}`);
    seen.add(r.school_year);
  }

  const towns: Record<string, Record<string, PublishedTownYear>> = {};
  const put = (slug: string, sy: string, value: PublishedTownYear): void => {
    (towns[slug] ??= {})[sy] = value;
  };

  for (const record of sorted) {
    const present = new Set<string>();
    for (const t of record.towns) {
      if (!registry.has(t.entity)) {
        throw new Error(
          `${record.school_year}: ${t.entity} is in the warehouse but not the registry`,
        );
      }
      present.add(t.entity);
      const bands = {} as Record<Band, PublishedCell>;
      for (const b of BANDS) bands[b] = publishCell(t.bands[b]);
      put(t.entity, record.school_year, {
        row: t.row_status,
        bands,
        ell: publishCell(t.ell),
        nslelg: publishCell(t.nslelg),
      });
    }
    for (const entity of registry.values()) {
      if (entity.type !== 'town' || entity.reporting_only || present.has(entity.slug)) continue;
      put(entity.slug, record.school_year, {
        row: 'not_applicable',
        reason: closedBefore(entity, record.count_year) ? 'entity_closed' : 'no_resident_students',
      });
    }
  }

  return {
    generated,
    years: sorted.map((r) => ({
      school_year: r.school_year,
      count_year: r.count_year,
      fiscal_year: r.fiscal_year,
      preliminary: r.preliminary,
      preliminary_note: r.preliminary_note,
      not_published: r.not_published.map((n) => ({
        path: n.path,
        note: n.note,
      })),
    })),
    towns: Object.fromEntries(Object.entries(towns).sort(([a], [b]) => a.localeCompare(b))),
  };
}
