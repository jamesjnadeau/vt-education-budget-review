/**
 * The FY2025 Act 84 decrease for each district the model form's picker
 * offers. A district on AOE's worksheet gets its figure and the name the
 * worksheet lists it under. Any other district in the worksheet's year gets
 * the record's unlisted decrease (0). A picker slug that is not a district
 * in that year, such as a supervisory union, gets no entry, so the form
 * leaves the field alone.
 */
import type { Act84Record } from './aoe/act84/record.ts';

export interface Act84Entry {
  readonly value: number;
  readonly listed_as: string | null;
}

export function act84Prefill(
  record: Act84Record,
  districtSlugs: ReadonlyArray<string>,
  pickerSlugs: ReadonlyArray<string>,
): Record<string, Act84Entry> {
  const listed = new Map(record.districts.map((d) => [d.entity, d]));
  const districts = new Set(districtSlugs);
  const out: Record<string, Act84Entry> = {};
  for (const slug of pickerSlugs) {
    const row = listed.get(slug);
    if (row) out[slug] = { value: row.fy2025_decrease, listed_as: row.name_as_published };
    else if (districts.has(slug)) out[slug] = { value: record.unlisted_decrease, listed_as: null };
  }
  return out;
}
