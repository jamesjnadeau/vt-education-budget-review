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
 * Deep link to GitHub's web upload UI, pre-targeted at the right intake path.
 *
 * Committing through the GitHub web interface IS a git commit, so this
 * satisfies the everything-through-git constraint while being an ordinary
 * file-picker experience for whoever has the PDF.
 */
export function uploadUrl(entitySlug: string, fiscalYear: number): string | null {
  if (!CONFIG.repositoryUrl) return null;
  const dir = `intake/${entitySlug.replace('/', '-')}/fy${fiscalYear}`;
  return `${CONFIG.repositoryUrl}/upload/${CONFIG.defaultBranch}/${dir}`;
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
