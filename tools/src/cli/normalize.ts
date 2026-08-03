#!/usr/bin/env node
/**
 * The normalize workflow's engine.
 *
 * Runs on `issues: [opened, edited, labeled]` filtered to the `budget-normalize`
 * label or title. Reads the form, builds a budget record, validates it against
 * the schema and the cross-file rules in-process -- so a problem is a comment on
 * the issue, not a red check on a bot's PR -- writes it to warehouse/, and opens
 * a PR that closes the issue.
 *
 * The parsing, sentinel enforcement and record building are pure functions in
 * tools/src/normalize/, tested against fixtures. This is the thin IO shell:
 * validate against disk, write, git, gh. SECURITY: the issue body is
 * attacker-controllable; it is read from an environment variable and never
 * interpolated into a shell, and every git/gh call uses an argument array.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { stringify as stringifyYaml } from 'yaml';

import { PATHS, REPO_ROOT, rel } from '../paths.ts';
import { readRegistry } from '../registry/store.ts';
import { writeScratchFile } from '../intake/scratch.ts';
import { buildRecord } from '../normalize/record.ts';
import { validateAgainst } from '../validate/schemas.ts';
import {
  checkNullAccounting,
  checkProvenance,
  type BudgetRecord,
  type Finding,
} from '../validate/rules.ts';

interface Env {
  readonly body: string;
  readonly issueNumber: string;
  readonly authorLogin: string;
  readonly authorId: string;
}

function readEnv(): Env {
  const need = (name: string): string => {
    const v = process.env[name];
    if (!v) throw new Error(`${name} is not set. This CLI runs inside the normalize workflow.`);
    return v;
  };
  return {
    body: process.env['ISSUE_BODY'] ?? '',
    issueNumber: need('ISSUE_NUMBER'),
    authorLogin: need('ISSUE_AUTHOR_LOGIN'),
    authorId: need('ISSUE_AUTHOR_ID'),
  };
}

const git = (...args: string[]): string => execFileSync('git', args, { encoding: 'utf8', cwd: REPO_ROOT });

function comment(env: Env, lines: readonly string[]): void {
  const file = writeScratchFile(PATHS.build, 'normalize-comment.md', lines.join('\n\n') + '\n');
  execFileSync('gh', ['issue', 'comment', env.issueNumber, '--body-file', file], { stdio: 'inherit' });
}

function rejection(env: Env, problems: readonly string[]): void {
  comment(env, [
    'Thanks for extracting this. It cannot be accepted yet, for the reason(s) below. ' +
      'Edit the issue to fix them and this will re-run automatically.',
    ...problems.map((p) => `- ${p}`),
  ]);
}

function main(): number {
  const env = readEnv();
  const today = new Date().toISOString().slice(0, 10);
  const registry = readRegistry();
  const knownSlugs = new Set(registry.keys());

  const built = buildRecord({
    body: env.body,
    authorLogin: env.authorLogin,
    today,
    knownSlugs,
    sourceExists: (p) => existsSync(join(REPO_ROOT, p)),
  });
  if (!built.ok) {
    rejection(env, built.errors);
    return 0;
  }

  const record = built.record as BudgetRecord;
  const label = `warehouse/${record.entity.replace('/', '-')}/fy${record.fiscal_year}-${record.status}.yaml`;

  // In-process validation: the same schema and cross-file rules CI runs, so the
  // extractor hears about a problem here rather than from a red PR check.
  const schemaErrors: Finding[] = validateAgainst('budget', record).map((e) => ({
    severity: 'error',
    file: label,
    rule: 'schema:budget',
    message: `${e.path} ${e.message}`,
  }));
  const findings: Finding[] = [
    ...schemaErrors,
    ...checkNullAccounting(record, label),
    ...checkProvenance(record, label, { verifyHashes: false }),
  ];
  const errors = findings.filter((f) => f.severity === 'error');
  const warnings = findings.filter((f) => f.severity === 'warning');
  if (errors.length > 0) {
    rejection(env, errors.map((f) => `[${f.rule}] ${f.message}`));
    return 0;
  }

  // Branch off main BEFORE writing so an edited re-run regenerates from a clean
  // base and force-pushes an identical tree.
  const branch = `normalize/issue-${env.issueNumber}`;
  git('fetch', 'origin', 'main');
  git('checkout', '-B', branch, 'FETCH_HEAD');

  const abs = join(REPO_ROOT, label);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, stringifyYaml(record, { lineWidth: 0 }), 'utf8');

  git('add', label);
  const coauthorEmail = `${env.authorId}+${env.authorLogin}@users.noreply.github.com`;
  const messageFile = writeScratchFile(
    PATHS.build,
    'normalize-commit.txt',
    `Normalize ${record.entity} FY${record.fiscal_year} (${record.status})\n\n` +
      `Budget record extracted via issue #${env.issueNumber}, from ${record.source}.\n\n` +
      `Co-authored-by: ${env.authorLogin} <${coauthorEmail}>\n`,
  );
  execFileSync(
    'git',
    ['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com', 'commit', '-F', messageFile],
    { stdio: 'inherit', cwd: REPO_ROOT },
  );
  git('push', '--force', 'origin', branch);

  const existing = execFileSync('gh', ['pr', 'list', '--head', branch, '--json', 'number'], { encoding: 'utf8' }).trim();
  if (existing && existing !== '[]') {
    console.log(`PR for ${branch} already open; the force-push updated it.`);
    return 0;
  }

  const npLines =
    built.notPublished.length > 0
      ? `Recorded as not published (confirmed by @${env.authorLogin}): ${built.notPublished.join(', ')}.\n\n`
      : '';
  const warnLines =
    warnings.length > 0
      ? `Findings to review (kept, not reconciled):\n${warnings.map((w) => `- ${w.message}`).join('\n')}\n\n`
      : '';
  const prBodyFile = writeScratchFile(
    PATHS.build,
    'normalize-pr.md',
    `Adds \`${rel(abs)}\`, the normalized budget record from #${env.issueNumber}.\n\n` +
      `Extracted from \`${record.source}\`. \`validate.yml\` checks it like any other PR.\n\n` +
      npLines +
      warnLines +
      `Closes #${env.issueNumber}\n`,
  );
  execFileSync(
    'gh',
    ['pr', 'create', '--head', branch, '--base', 'main', '--title', `Budget normalize: ${record.entity} FY${record.fiscal_year} (${record.status})`, '--body-file', prBodyFile],
    { stdio: 'inherit' },
  );
  console.log(`Opened normalize PR for ${record.entity} FY${record.fiscal_year}.`);
  return 0;
}

process.exit(main());
