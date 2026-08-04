/**
 * District-first ADM resolution.
 *
 * The record now carries the district's own stated ADM by statutory band, and
 * the AOE dataset carries the state's count rolled up to the same entity. This
 * chooses between them PER BAND -- the district's figure wherever it published
 * one, the state's only to fill a gap -- and tags each band with its source so
 * a total that blends the two is never presented as if it came from one place.
 * It never reconciles a disagreement; that is the cross-check's job, and it
 * only warns.
 */

export const STATUTORY_BANDS = [
  'prekindergarten',
  'kindergarten_through_5',
  'grades_6_through_8',
  'grades_9_through_12',
] as const;

export type StatutoryBand = (typeof STATUTORY_BANDS)[number];
export type BandValues = Record<StatutoryBand, number | null>;
export type AdmSource = 'district' | 'aoe' | 'unknown';
export interface ResolvedBand {
  readonly value: number | null;
  readonly source: AdmSource;
}
export type ResolvedAdm = Record<StatutoryBand, ResolvedBand>;

export function resolveAdm(
  district: BandValues | null | undefined,
  aoe: BandValues | null | undefined,
): ResolvedAdm {
  const out = {} as Record<StatutoryBand, ResolvedBand>;
  for (const band of STATUTORY_BANDS) {
    const d = district?.[band];
    if (d !== null && d !== undefined) {
      out[band] = { value: d, source: 'district' };
      continue;
    }
    const a = aoe?.[band];
    if (a !== null && a !== undefined) {
      out[band] = { value: a, source: 'aoe' };
      continue;
    }
    out[band] = { value: null, source: 'unknown' };
  }
  return out;
}
