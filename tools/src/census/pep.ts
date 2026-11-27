/**
 * Parses the Census Population Estimates Program county-subdivision file
 * (sub-est2025_50.csv): July 1 estimates for Vermont's towns.
 *
 * 16 V.S.A. § 4019(a)(4) measures density "as of July 1 of the year of
 * determination", which is the PEP's reference date. SUMLEV 061 rows are county
 * subdivisions; the other summary levels (places) are ignored so a village is
 * never taken for its town.
 */

export interface PepEstimates {
  /** geoid (state+county+cousub) -> population on July 1 of `year`. */
  readonly byGeoid: ReadonlyMap<string, number>;
  readonly year: number;
}

export function parsePep(text: string, year: number): PepEstimates {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.length > 0);
  const header = (lines[0] ?? '').split(',');
  const col = (name: string): number => {
    const at = header.indexOf(name);
    if (at < 0) throw new Error(`PEP file has no ${name} column.`);
    return at;
  };
  const sumlev = col('SUMLEV');
  const state = col('STATE');
  const county = col('COUNTY');
  const cousub = col('COUSUB');
  const value = col(`POPESTIMATE${year}`);

  const byGeoid = new Map<string, number>();
  for (const line of lines.slice(1)) {
    // Names contain no commas in Vermont rows, but split defensively on the
    // leading numeric columns only.
    const f = line.split(',');
    if (f[sumlev] !== '061') continue;
    const n = Number(f[value]);
    if (!Number.isFinite(n)) continue;
    byGeoid.set(`${f[state]}${f[county]}${f[cousub]}`, n);
  }
  return { byGeoid, year };
}
