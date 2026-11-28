/**
 * The built journey for one fiscal year, from the generated JSON. Every /my/
 * page reads its year through here, so they all see the same model and each
 * year is built once per build.
 */
import registry from '../generated/registry.json';
import combiner from '../generated/combiner.json';
import subgroups from '../generated/adm-subgroups.json';
import groupings from '../generated/groupings.json';
import years from '../generated/journey-years.json';
import { buildJourney, type Journey } from './journey.ts';

const built = new Map<number, Journey>();

export function journeyFor(year: number): Journey {
  let j = built.get(year);
  if (!j) {
    j = buildJourney(
      {
        registry: registry.entities,
        combiner: combiner as never,
        subgroups: subgroups as never,
        groupings: groupings as never,
        years: years as never,
      },
      year,
    );
    built.set(year, j);
  }
  return j;
}
