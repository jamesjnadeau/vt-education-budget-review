/**
 * The built journey for one fiscal year, from the generated JSON. Every /my/
 * page reads its year through here, so they all see the same model and each
 * year is built once per build.
 *
 * The generated files are read with import.meta.glob rather than plain
 * imports: they are build output, not source, so the typecheck (which runs
 * before they exist) must not depend on them.
 */
import { buildJourney, type Journey, type JourneyInputs } from './journey.ts';

const files = import.meta.glob<{ default: unknown }>('../generated/*.json', { eager: true });

function generated<T>(name: string): T {
  const found = files[`../generated/${name}.json`];
  if (!found) throw new Error(`site/src/generated/${name}.json is missing. Run npm run build:data first.`);
  return found.default as T;
}

const built = new Map<number, Journey>();

export function journeyFor(year: number): Journey {
  let j = built.get(year);
  if (!j) {
    j = buildJourney(
      {
        registry: generated<{ entities: JourneyInputs['registry'] }>('registry').entities,
        combiner: generated<JourneyInputs['combiner']>('combiner'),
        subgroups: generated<JourneyInputs['subgroups']>('adm-subgroups'),
        groupings: generated<JourneyInputs['groupings']>('groupings'),
        years: generated<NonNullable<JourneyInputs['years']>>('journey-years'),
      },
      year,
    );
    built.set(year, j);
  }
  return j;
}
