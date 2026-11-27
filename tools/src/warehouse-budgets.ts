/**
 * Which warehouse files are budget records. The warehouse also holds the AOE
 * and Census series, none of which carry an `entity` or budget fields; reading
 * one as a budget puts an entity-less object into every consumer of the budget
 * list (and crashed `buildPrefillAdm`, which keys on `entity`).
 *
 * A new non-budget directory under warehouse/ must be added here, and to the
 * dispatch in cli/validate.ts. The test walks the real warehouse to catch a
 * miss.
 */
const NON_BUDGET_DIRS = [
  'aoe-act84',
  'aoe-adm',
  'aoe-adm-subgroups',
  'aoe-adm-subgroups-su',
  'aoe-edspend',
  'census',
  'small-sparse',
  'tax-rates',
] as const;

/** `path` is repo-relative with forward slashes, as `rel()` returns it. */
export function isBudgetRecordPath(path: string): boolean {
  return !NON_BUDGET_DIRS.some((dir) => path.startsWith(`warehouse/${dir}/`));
}
