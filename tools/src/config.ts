/**
 * Repository and site identity, used to build the deep links on the coverage
 * dashboard.
 *
 * Read from the environment so the same build works on a fork, in CI, and
 * locally. GITHUB_REPOSITORY is set automatically by GitHub Actions.
 */

const repository = process.env['GITHUB_REPOSITORY'] ?? null;

export const CONFIG = {
  /** "owner/name", or null when it cannot be determined. */
  repository,
  repositoryUrl: repository ? `https://github.com/${repository}` : null,
  defaultBranch: process.env['GITHUB_DEFAULT_BRANCH'] ?? 'main',
  siteUrl: process.env['SITE_URL'] ?? null,
  /** Earliest fiscal year the coverage matrix expects a budget for. */
  firstFiscalYear: Number(process.env['FIRST_FISCAL_YEAR'] ?? 2023),
} as const;

/**
 * Deep link to the budget-intake issue form, prefilled with the cell's entity
 * and fiscal year.
 *
 * The everything-through-git constraint is still satisfied -- the document
 * reaches the repository as a reviewed pull request -- but by a bot opening that
 * PR from the issue, not by a direct web commit. Web commits cannot write the
 * Git LFS pointers the raw artifacts require, so the file picker GitHub offers
 * refuses the exact file types this project collects. The issue form's textarea
 * accepts the drag-and-drop attachment a dedicated upload field still does not,
 * and the intake workflow does the rest.
 */
export function intakeIssueUrl(entitySlug: string, fiscalYear: number): string | null {
  if (!CONFIG.repositoryUrl) return null;
  const params = new URLSearchParams({
    template: 'budget-intake.yml',
    entity: entitySlug,
    fiscal_year: String(fiscalYear),
  });
  return `${CONFIG.repositoryUrl}/issues/new?${params.toString()}`;
}

/**
 * Deep link to the budget-normalize issue form, prefilled with a cell's entity,
 * fiscal year, and the intake artifact to extract from.
 *
 * The counterpart to `intakeIssueUrl`: intake lands the raw document, this turns
 * it into a warehouse record. Offered from `intake_only` cells -- the ones that
 * have an artifact and no record yet -- so the extractor starts from a form that
 * already knows which document they are reading.
 */
export function normalizeIssueUrl(
  entitySlug: string,
  fiscalYear: number,
  sourcePath: string,
): string | null {
  if (!CONFIG.repositoryUrl) return null;
  const params = new URLSearchParams({
    template: 'budget-normalize.yml',
    entity: entitySlug,
    fiscal_year: String(fiscalYear),
    source: sourcePath,
  });
  return `${CONFIG.repositoryUrl}/issues/new?${params.toString()}`;
}

/** Pre-filled issue for tracking a gap without an upload. */
export function flagIssueUrl(
  entitySlug: string,
  entityName: string,
  fiscalYear: number,
  lastKnownSource: string | null,
): string | null {
  if (!CONFIG.repositoryUrl) return null;
  const title = `FY${fiscalYear} budget missing for ${entityName}`;
  const body = [
    `**Entity:** \`${entitySlug}\` — ${entityName}`,
    `**Fiscal year:** FY${fiscalYear}`,
    `**Last known source:** ${lastKnownSource ?? '(none recorded in the collector config)'}`,
    `**Checked on:** `,
    '',
    'What was checked and what was found:',
    '',
  ].join('\n');
  return `${CONFIG.repositoryUrl}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}
