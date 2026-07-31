import { describe, expect, it } from 'vitest';

import {
  GazetteerParseError,
  joinToRegistry,
  parseGazetteer,
  slugCandidates,
} from './gazetteer.ts';
import type { RegistryEntity } from '../registry/types.ts';

const HEADER = 'USPS\tGEOID\tANSICODE\tNAME\tFUNCSTAT\tALAND\tAWATER\tALAND_SQMI\tAWATER_SQMI\tINTPTLAT\tINTPTLONG';

const row = (geoid: string, name: string, land: string, water: string) =>
  `VT\t${geoid}\t01462023\t${name}\tA\t107710362\t19168382\t${land}\t${water}\t44.058539\t-73.332315   `;

const town = (slug: string, over: Partial<RegistryEntity> = {}): RegistryEntity =>
  ({
    slug,
    name: slug,
    type: 'town',
    aoe_server_id: null,
    edfi_id: null,
    effective_from: null,
    effective_from_basis: 'unknown',
    effective_to: null,
    effective_to_basis: 'unknown',
    successor: null,
    successor_basis: null,
    supervisory_union: null,
    operated_by: null,
    reporting_only: false,
    member_towns: [],
    grades: [],
    website: null,
    latitude: null,
    longitude: null,
    manual_overrides: [],
    notes: null,
    ...over,
  }) as RegistryEntity;

const registryOf = (...entities: RegistryEntity[]) =>
  new Map(entities.map((e) => [e.slug, e]));

describe('parsing the gazetteer', () => {
  it('reads land and water separately and never adds them', () => {
    const rows = parseGazetteer(`${HEADER}\n${row('5000100325', 'Addison town', '41.587', '7.401')}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.landAreaSqMi).toBe(41.587);
    expect(rows[0]?.waterAreaSqMi).toBe(7.401);
  });

  it('trims the trailing padding the Bureau ships', () => {
    const rows = parseGazetteer(`${HEADER}\n${row('5000100325', 'Addison town', '41.587', '7.401')}`);
    expect(rows[0]?.name).toBe('Addison town');
  });

  it('refuses a file whose columns it cannot find, rather than reading positionally', () => {
    // A column inserted upstream would otherwise shift water area into the land
    // area field, and every density in Vermont would be wrong in the same
    // direction with nothing failing.
    expect(() => parseGazetteer('USPS\tGEOID\tNAME\n')).toThrow(GazetteerParseError);
    expect(() => parseGazetteer('USPS\tGEOID\tNAME\n')).toThrow(/positional/);
  });

  it('refuses a malformed GEOID', () => {
    expect(() => parseGazetteer(`${HEADER}\n${row('50001', 'Addison town', '1', '1')}`)).toThrow(
      /county subdivision GEOID/,
    );
  });
});

describe('joining Census names to registry slugs', () => {
  it('keeps a city and a town of the same name apart', () => {
    // Barre city and Barre town are separate municipalities with separate land
    // areas. A join that dropped the suffix first would give one of them the
    // other's denominator.
    const registry = registryOf(town('town/barre-city'), town('town/barre-town'));
    const rows = parseGazetteer(
      `${HEADER}\n${row('5001703175', 'Barre city', '4.0', '0.0')}\n${row('5001703200', 'Barre town', '38.0', '0.3')}`,
    );
    const joined = joinToRegistry(rows, registry);

    expect(joined.towns.find((t) => t.nameAsPublished === 'Barre city')?.entity).toBe('town/barre-city');
    expect(joined.towns.find((t) => t.nameAsPublished === 'Barre town')?.entity).toBe('town/barre-town');
    expect(joined.unmatched).toHaveLength(0);
  });

  it('normalizes the cosmetic spelling differences', () => {
    expect(slugCandidates('Isle La Motte town')).toContain('town/isle-lamotte');
    expect(slugCandidates('Mount Holly town')).toContain('town/mt-holly');
    expect(slugCandidates('Saint Albans city')).toContain('town/st-albans-city');
    expect(slugCandidates("Avery's gore")).toContain('town/averys-gore');
  });

  it('refuses to match Warren’s gore to Warners Grant', () => {
    // The substantive case. Vermont has both a Warren's Gore and a Warner's
    // Grant; a fuzzy match here would attach one unorganized place's area to the
    // other's name, and nobody would notice.
    const registry = registryOf(town('town/warners-grant'), town('town/warrens-grant'));
    const joined = joinToRegistry(
      parseGazetteer(`${HEADER}\n${row('5000900175', "Warren's gore", '9.0', '0.1')}`),
      registry,
    );

    expect(joined.towns[0]?.entity).toBeNull();
    expect(joined.unmatched).toHaveLength(1);
    expect(joined.unmatched[0]?.reason).toMatch(/by hand/);
  });

  it('reports a town AOE tracks only as an incorporated school district', () => {
    const registry = registryOf(town('town/bennington-id'));
    const joined = joinToRegistry(
      parseGazetteer(`${HEADER}\n${row('5000303175', 'Bennington town', '42.0', '0.2')}`),
      registry,
    );

    expect(joined.towns[0]?.entity).toBeNull();
    expect(joined.unmatched[0]?.reason).toMatch(/incorporated school district/);
  });

  it('never joins a reporting bucket, which is not a place', () => {
    const registry = registryOf(town('town/unknown', { reporting_only: true }));
    const joined = joinToRegistry(
      parseGazetteer(`${HEADER}\n${row('5000300001', 'Unknown town', '1.0', '0.0')}`),
      registry,
    );
    expect(joined.towns[0]?.entity).toBeNull();
  });

  it('lists registry towns no subdivision matched rather than inventing an area', () => {
    const registry = registryOf(town('town/addison'), town('town/orford-nh'));
    const joined = joinToRegistry(
      parseGazetteer(`${HEADER}\n${row('5000100325', 'Addison town', '41.587', '7.401')}`),
      registry,
    );
    expect(joined.registryTownsWithoutArea).toEqual(['town/orford-nh']);
  });
});
