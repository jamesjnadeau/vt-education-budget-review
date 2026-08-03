import { describe, expect, it } from 'vitest';

import { buildGroupingBudgets, type BudgetInput, type GroupingInput } from './grouping-budgets.ts';
import type { RegistryEntity } from './registry/types.ts';

function entity(over: Partial<RegistryEntity> & Pick<RegistryEntity, 'slug' | 'type'>): RegistryEntity {
  return {
    name: over.slug,
    aoe_server_id: null,
    edfi_id: null,
    effective_from: null,
    effective_from_basis: 'first_observed',
    effective_to: null,
    effective_to_basis: 'first_observed',
    successor: null,
    successor_basis: null,
    supervisory_union: null,
    operated_by: null,
    reporting_only: false,
    ...over,
  } as RegistryEntity;
}

function budget(over: Partial<BudgetInput> & Pick<BudgetInput, 'entity'>): BudgetInput {
  return {
    fiscal_year: 2024,
    status: 'proposed',
    source: 'test fixture',
    expenditures: { total_stated: 1_000_000 },
    ...over,
  };
}

function registryOf(...entities: RegistryEntity[]): Map<string, RegistryEntity> {
  return new Map(entities.map((e) => [e.slug, e]));
}

const GROUP = (members: string[], names?: string[]): GroupingInput => {
  const grouping = {
    number: 1,
    slug: 'group-1',
    name: 'Group 1',
    members,
    ...(names !== undefined && { member_names_as_written: names as readonly string[] }),
  };
  return grouping as GroupingInput;
};

describe('buildGroupingBudgets', () => {
  it('resolves a member with its own budget record as direct', () => {
    const reg = registryOf(entity({ slug: 'ud/a-1', type: 'ud', supervisory_union: 'su/a' }));
    const g = buildGroupingBudgets([GROUP(['ud/a-1'])], reg, [budget({ entity: 'ud/a-1' })])[0]!;
    const member = g.members[0]!;
    expect(member.resolution).toBe('direct');
    expect(member.budget?.total_stated).toBe(1_000_000);
    expect(g.resolved_count).toBe(1);
  });

  it('resolves via the SU when the SU has exactly one district-like member', () => {
    const reg = registryOf(entity({ slug: 'ud/ac-55', type: 'ud', supervisory_union: 'su/ac' }));
    const g = buildGroupingBudgets([GROUP(['ud/ac-55'])], reg, [budget({ entity: 'su/ac' })])[0]!;
    const member = g.members[0]!;
    expect(member.resolution).toBe('via_su');
    expect(member.budget?.entity).toBe('su/ac');
  });

  it('does not attribute an SU budget when the SU has two district-like members', () => {
    const reg = registryOf(
      entity({ slug: 'ud/x-1', type: 'ud', supervisory_union: 'su/multi' }),
      entity({ slug: 'ud/y-2', type: 'ud', supervisory_union: 'su/multi' }),
    );
    const g = buildGroupingBudgets([GROUP(['ud/x-1', 'ud/y-2'])], reg, [budget({ entity: 'su/multi' })])[0]!;
    const members = g.members;
    expect(members.map((m) => m.resolution)).toEqual(['ambiguous', 'ambiguous']);
    expect(members.every((m) => m.budget === null)).toBe(true);
    expect(g.resolved_count).toBe(0);
  });

  it('marks a member with no direct and no attributable SU budget as missing', () => {
    const reg = registryOf(entity({ slug: 'town/lincoln', type: 'town', supervisory_union: 'su/lincoln' }));
    const g = buildGroupingBudgets([GROUP(['town/lincoln'])], reg, [])[0]!;
    const member = g.members[0]!;
    expect(member.resolution).toBe('missing');
    expect(member.budget).toBeNull();
  });

  it('prefers the latest fiscal year, and adopted over proposed within a year', () => {
    const reg = registryOf(entity({ slug: 'ud/a-1', type: 'ud' }));
    const g = buildGroupingBudgets(
      [GROUP(['ud/a-1'])],
      reg,
      [
        budget({ entity: 'ud/a-1', fiscal_year: 2023, status: 'adopted' }),
        budget({ entity: 'ud/a-1', fiscal_year: 2024, status: 'proposed' }),
        budget({ entity: 'ud/a-1', fiscal_year: 2024, status: 'adopted' }),
      ],
    )[0]!;
    const member = g.members[0]!;
    expect(member.fiscal_year).toBe(2024);
    expect(member.status).toBe('adopted');
  });

  it('adapts total_stated from expenditures (not revenues) and keeps an unpublished total null', () => {
    const reg = registryOf(entity({ slug: 'ud/a-1', type: 'ud' }));
    const g = buildGroupingBudgets(
      [GROUP(['ud/a-1'])],
      reg,
      [budget({ entity: 'ud/a-1', expenditures: { total_stated: null } })],
    )[0]!;
    const member = g.members[0]!;
    expect(member.resolution).toBe('direct');
    expect(member.budget?.total_stated).toBeNull();
  });

  it('reports member_count, resolved_count and distinct fiscal_years_present', () => {
    const reg = registryOf(
      entity({ slug: 'ud/a-1', type: 'ud' }),
      entity({ slug: 'ud/b-2', type: 'ud' }),
    );
    const g = buildGroupingBudgets(
      [GROUP(['ud/a-1', 'ud/b-2', 'ud/missing-3'])],
      reg,
      [
        budget({ entity: 'ud/a-1', fiscal_year: 2024 }),
        budget({ entity: 'ud/b-2', fiscal_year: 2023 }),
      ],
    )[0]!;
    expect(g.member_count).toBe(3);
    expect(g.resolved_count).toBe(2);
    expect(g.fiscal_years_present).toEqual([2023, 2024]);
  });
});
