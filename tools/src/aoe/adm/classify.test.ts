import { describe, expect, it } from 'vitest';

import type { RegistryEntity } from '../../registry/types.ts';
import { classifyTown, earnsVermontAdm } from './classify.ts';

function town(over: Partial<RegistryEntity>): RegistryEntity {
  return {
    slug: 'town/example',
    name: 'EXAMPLE',
    type: 'town',
    aoe_org_id: 'T001',
    aoe_server_id: null,
    edfi_id: null,
    effective_from: '2026-07-29',
    effective_from_basis: 'first_observed',
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
  } as RegistryEntity;
}

describe('classifying towns for ADM purposes', () => {
  it('a town with a union district is a member of it', () => {
    const cls = classifyTown(
      town({ aoe_org_id: 'T001', operated_by: 'ud/addison-northwest-54', supervisory_union: 'su/addison-northwest' }),
    );
    expect(cls).toBe('union_district_member');
    expect(earnsVermontAdm(cls)).toBe(true);
  });

  it('a town that is its own supervisory district is its own district', () => {
    // Burlington is SU015 Burlington Supervisory District, and Burlington High
    // School carries op: town/burlington. operated_by: null here means "no
    // separate operating district", not "no district".
    const cls = classifyTown(
      town({ aoe_org_id: 'T037', name: 'BURLINGTON', supervisory_union: 'su/burlington' }),
    );
    expect(cls).toBe('own_district');
    expect(earnsVermontAdm(cls)).toBe(true);
  });

  it('Orford NH is a real out-of-state member town earning no Vermont ADM', () => {
    const cls = classifyTown(
      town({ aoe_org_id: 'T999', name: 'ORFORD NH', supervisory_union: 'su/rivendell-interstate' }),
    );
    expect(cls).toBe('out_of_state_member');
    expect(earnsVermontAdm(cls)).toBe(false);
  });

  it('a 900-range record is a residency bucket', () => {
    const cls = classifyTown(town({ aoe_org_id: '902', name: 'Other State -New Hampshire' }));
    expect(cls).toBe('residency_bucket');
    expect(earnsVermontAdm(cls)).toBe(false);
  });

  it('UNKNOWN is a residency bucket', () => {
    const cls = classifyTown(town({ aoe_org_id: 'T000', name: 'UNKNOWN', reporting_only: true }));
    expect(cls).toBe('residency_bucket');
    expect(earnsVermontAdm(cls)).toBe(false);
  });

  it('a town with neither SU nor operating district has no operating district', () => {
    // Underhill ID is in this position in the current registry.
    const cls = classifyTown(town({ aoe_org_id: 'T211', name: 'UNDERHILL ID' }));
    expect(cls).toBe('no_operating_district');
    expect(earnsVermontAdm(cls)).toBe(false);
  });
});
