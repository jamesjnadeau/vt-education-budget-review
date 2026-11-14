/**
 * The model form's education-spending prefill and its list of pickable
 * districts, read from AOE's EdSpend records (Data Request #853,
 * `warehouse/aoe-edspend/fy*.yaml`).
 *
 * Each record lists every school district AOE counts that year: a town that
 * runs its own district (`town/*`) or a union district (`ud/*`), with its
 * education spending and pupils. That makes every one of them a district the
 * form can load, not only the ones with a budget record in the warehouse.
 *
 * Spending is the figure as AOE states it. A stated $0 is not offered as a
 * prefill: AOE lists those rows as pupils without spending (see the record's
 * `discrepancies`), so the field is left as it is and marked not available.
 * The pupils figure is carried for the note only. It is equalized pupils
 * before FY2025 and long-term weighted ADM from FY2025, so it is never put in
 * a form field.
 */

export interface EdspendDistrict {
  readonly entity: string | null;
  readonly pupils: number;
  readonly education_spending: number;
}

export interface EdspendRecord {
  readonly fiscal_year: number;
  readonly pupil_measure: string;
  readonly districts: ReadonlyArray<EdspendDistrict>;
}

export interface PrefillSpending {
  readonly value: number;
  readonly pupils: number;
  readonly pupil_measure: string;
}

/** Education spending per district and fiscal year. Rows stated as $0 are left out. */
export function prefillSpending(
  records: ReadonlyArray<EdspendRecord>,
): Record<string, Record<string, PrefillSpending>> {
  const out: Record<string, Record<string, PrefillSpending>> = {};
  for (const record of [...records].sort((a, b) => a.fiscal_year - b.fiscal_year)) {
    for (const d of record.districts) {
      if (!d.entity || d.education_spending <= 0) continue;
      (out[d.entity] ??= {})[String(record.fiscal_year)] = {
        value: d.education_spending,
        pupils: d.pupils,
        pupil_measure: record.pupil_measure,
      };
    }
  }
  return out;
}

/**
 * The districts AOE lists in any of `years`, sorted. A district that last
 * appears before them (merged or closed) is left out, so the picker offers
 * only districts the grade-count years can describe.
 */
export function edspendEntities(records: ReadonlyArray<EdspendRecord>, years: ReadonlyArray<number>): string[] {
  const wanted = new Set(years);
  const out = new Set<string>();
  for (const record of records) {
    if (!wanted.has(record.fiscal_year)) continue;
    for (const d of record.districts) if (d.entity) out.add(d.entity);
  }
  return [...out].sort();
}
