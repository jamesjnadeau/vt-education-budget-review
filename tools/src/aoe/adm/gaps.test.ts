import { describe, expect, it } from 'vitest';

import { buildGapRegister } from './gaps.ts';

describe('the § 4010 gap register', () => {
  const register = buildGapRegister([
    { fiscal_year: 2024, maps_to_statutory_bands: false },
    { fiscal_year: 2025, maps_to_statutory_bands: true },
  ]);

  it('reports only band-compatible years as engine eligible', () => {
    expect(register.engine_eligible_years).toEqual([2025]);
  });

  it('records ADM as supplied and everything else as absent', () => {
    const supplied = register.entries.filter((e) => e.supplied).map((e) => e.input);
    const absent = register.entries.filter((e) => !e.supplied).map((e) => e.input);
    expect(supplied).toContain('adm.kindergarten_through_5');
    expect(absent).toContain('adm.prekindergarten');
    expect(absent).toContain('poverty_185_fpl');
    expect(absent).toContain('english_learners');
    expect(absent).toContain('state_placed_fte');
    expect(absent).toContain('persons_per_square_mile');
  });

  it('cites a statute section for every entry', () => {
    for (const e of register.entries) expect(e.statute).toMatch(/4001|4010/);
  });

  it('states every independent reason a total is blocked', () => {
    expect(register.weighted_membership_blocked_because.length).toBeGreaterThanOrEqual(3);
    expect(register.weighted_membership_blocked_because.join(' ')).toMatch(/two-year average/i);
    expect(register.weighted_membership_blocked_because.join(' ')).toMatch(/prekindergarten/i);
  });

  it('reports every year it was generated from, eligible or not', () => {
    expect(register.generated_from).toEqual([2024, 2025]);
  });

  // Read off model/statute/2026-07-29/16-vsa-4010.txt. Section 4010 states each
  // input twice -- (b)(1) lists the count the Secretary must have, (d) weights it
  // -- and citing only the weight leaves a reader unable to find the requirement
  // that the number exist at all.
  it('cites where each input is listed, not only where it is weighted', () => {
    const byInput = new Map(register.entries.map((e) => [e.input, e.statute]));
    expect(byInput.get('adm.prekindergarten')).toContain('4010(b)(1)(A)');
    expect(byInput.get('adm.kindergarten_through_5')).toContain('4010(b)(1)(B)');
    expect(byInput.get('adm.grades_6_through_8')).toContain('4010(b)(1)(C)');
    expect(byInput.get('adm.grades_9_through_12')).toContain('4010(b)(1)(D)');
    expect(byInput.get('poverty_185_fpl')).toContain('4010(b)(1)(E)');
    expect(byInput.get('english_learners')).toContain('4010(b)(1)(F)');
    expect(byInput.get('persons_per_square_mile')).toContain('4010(b)(2)');
    expect(byInput.get('small_school.average_two_year_enrollment')).toContain('4010(b)(3)');
    expect(byInput.get('state_placed_fte')).toContain('4001(7)(B)');
  });

  it('does not claim a grade weight for kindergarten through five', () => {
    // (d)(1) multiplies prekindergarten, grades 6-8 and grades 9-12 only. K-5 is
    // the unweighted baseline every other weight is measured against, so a
    // citation implying it carries a (d)(1) weight would be wrong on the statute.
    const k5 = register.entries.find((e) => e.input === 'adm.kindergarten_through_5');
    expect(k5?.statute).not.toMatch(/\(d\)\(1\)/);
    for (const weighted of ['adm.grades_6_through_8', 'adm.grades_9_through_12']) {
      expect(register.entries.find((e) => e.input === weighted)?.statute).toMatch(/\(d\)\(1\)/);
    }
  });

  it('reports no eligible year when every report predates Act 127', () => {
    // The real state of the warehouse today: ADM-24 is the only year held, and
    // its bands do not map. A register that quietly reported it eligible would
    // license the engine to compute on bands the statute does not use.
    const preAct127 = buildGapRegister([{ fiscal_year: 2024, maps_to_statutory_bands: false }]);
    expect(preAct127.engine_eligible_years).toEqual([]);
    expect(preAct127.generated_from).toEqual([2024]);
  });
});
