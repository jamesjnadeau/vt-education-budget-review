#!/usr/bin/env node
/**
 * The intake workflow's engine.
 *
 * Runs on `issues: [opened, edited]` filtered to the `budget-intake` label.
 * Reads the issue body, validates it, downloads the attached document, and
 * opens a PR that adds the raw artifact and a generated provenance.yaml -- or,
 * if anything is wrong, comments on the issue saying exactly what and leaves it
 * open so the `edited` trigger picks up the fix.
 *
 * The parsing, validation and provenance generation are pure functions in
 * `tools/src/intake/`, tested against fixtures. This file is the thin IO shell
 * around them: download, hash, write, git, gh. It exists so the workflow YAML
 * stays a handful of lines and none of the logic lives where it can only be
 * tested by filing a real issue.
 *
 * SECURITY: the issue body is attacker-controlled. It is read from an
 * environment variable and never interpolated into a shell. Every git and gh
 * invocation uses execFileSync with an argument array, and every body that
 * contains issue-derived text is passed through a file, so nothing the stranger
 * wrote can reach a command line.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { PATHS, REPO_ROOT } from '../paths.ts';
import { readRegistry } from '../registry/store.ts';
import {
  buildProvenance,
  serializeProvenance,
  type ProvenanceDoc,
} from '../intake/provenance.ts';
import { buildSubmission, type Submission } from '../intake/submission.ts';
import { MAX_ATTACHMENT_BYTES, contentErrors, isAllowedAttachmentUrl } from '../intake/security.ts';

interface Env {
  readonly body: string;
  readonly issueNumber: string;
  readonly authorLogin: string;
  readonly authorId: string;
  readonly repo: string;
}

function readEnv(): Env {
  const need = (name: string): string => {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not set. This CLI runs inside the intake workflow.`);
    return value;
  };
  return {
    body: process.env['ISSUE_BODY'] ?? '',
    issueNumber: need('ISSUE_NUMBER'),
    authorLogin: need('ISSUE_AUTHOR_LOGIN'),
    authorId: need('ISSUE_AUTHOR_ID'),
    repo: need('GITHUB_REPOSITORY'),
  };
}

/** Comments the given lines on the issue and leaves it open. */
function comment(env: Env, lines: readonly string[]): void {
  const bodyFile = join(PATHS.build, 'intake-comment.md');
  mkdirSync(PATHS.build, { recursive: true });
  writeFileSync(bodyFile, lines.join('\n\n') + '\n', 'utf8');
  execFileSync('gh', ['issue', 'comment', env.issueNumber, '--body-file', bodyFile], {
    stdio: 'inherit',
  });
}

function rejection(env: Env, problems: readonly string[]): void {
  comment(env, [
    'Thanks for sending this in. It cannot be accepted yet, for the reason(s) below. ' +
      'Edit the issue to fix them and this will re-run automatically — no need to open a new one.',
    ...problems.map((p) => `- ${p}`),
  ]);
}

/**
 * Downloads the attachment, enforcing the host allowlist again at fetch time
 * and capping the read at the 25 MB ceiling so an oversize file is refused
 * rather than streamed in full. Returns the bytes, or null when the file is
 * over the cap (which is reported to the contributor separately, because it is
 * the one failure they cannot fix by editing the issue).
 */
async function download(url: string): Promise<Buffer | 'oversize'> {
  if (!isAllowedAttachmentUrl(url)) {
    throw new Error(`refusing to fetch a non-allowlisted URL: ${url}`);
  }
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new Error(`attachment fetch failed with HTTP ${response.status}`);
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
    total += chunk.length;
    if (total > MAX_ATTACHMENT_BYTES) return 'oversize';
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function readExistingProvenance(dir: string): ProvenanceDoc | null {
  const path = join(dir, 'provenance.yaml');
  if (!existsSync(path)) return null;
  const doc = parseYaml(readFileSync(path, 'utf8')) as ProvenanceDoc;
  return Array.isArray(doc?.artifacts) ? doc : null;
}

const git = (...args: string[]): string =>
  execFileSync('git', args, { encoding: 'utf8', cwd: REPO_ROOT });

function commitAndOpenPr(env: Env, submission: Submission, relArtifactPath: string): void {
  const branch = `intake/issue-${env.issueNumber}`;
  const coauthorEmail = `${env.authorId}+${env.authorLogin}@users.noreply.github.com`;

  const dirRel = relArtifactPath.replace(/[^/]+$/, '');
  git('add', relArtifactPath, join(dirRel, 'provenance.yaml'));

  const messageFile = join(PATHS.build, 'intake-commit.txt');
  writeFileSync(
    messageFile,
    `Intake ${submission.entity} FY${submission.fiscalYear}\n\n` +
      `Raw artifact and its provenance record, filed via issue #${env.issueNumber}. ` +
      `Nothing else changes; extraction and normalization stay a separate step.\n\n` +
      `Co-authored-by: ${env.authorLogin} <${coauthorEmail}>\n`,
    'utf8',
  );

  // The commit is authored by the default Actions bot identity. No deploy key
  // or PAT is introduced: a bot that can be impersonated by whoever holds a
  // long-lived secret is worse for provenance than an obviously-automated one.
  execFileSync(
    'git',
    [
      '-c',
      'user.name=github-actions[bot]',
      '-c',
      'user.email=41898282+github-actions[bot]@users.noreply.github.com',
      'commit',
      '-F',
      messageFile,
    ],
    { stdio: 'inherit', cwd: REPO_ROOT },
  );

  git('push', '--force', 'origin', branch);

  const existing = execFileSync('gh', ['pr', 'list', '--head', branch, '--json', 'number'], {
    encoding: 'utf8',
  }).trim();
  if (existing && existing !== '[]') {
    console.log(`PR for ${branch} already open; the force-push updated it.`);
    return;
  }

  const prBodyFile = join(PATHS.build, 'intake-pr.md');
  writeFileSync(
    prBodyFile,
    `Adds \`${relArtifactPath}\` and its \`provenance.yaml\`, from #${env.issueNumber}.\n\n` +
      `The raw artifact and its provenance record only — extraction and normalization are a ` +
      `separate, deliberate step. \`validate.yml\` checks this like any other PR.\n\n` +
      `Provenance was computed from the received bytes (sha256, size, media type) and the author ` +
      `recorded as their GitHub handle, rather than typed by hand.\n\n` +
      `Closes #${env.issueNumber}\n`,
    'utf8',
  );
  execFileSync(
    'gh',
    [
      'pr',
      'create',
      '--head',
      branch,
      '--base',
      'main',
      '--title',
      `Budget intake: ${submission.entity} FY${submission.fiscalYear}`,
      '--body-file',
      prBodyFile,
    ],
    { stdio: 'inherit' },
  );
}

async function main(): Promise<number> {
  const env = readEnv();
  const registry = readRegistry();
  const knownSlugs = new Set(registry.keys());

  const result = buildSubmission({ body: env.body, authorLogin: env.authorLogin, knownSlugs });
  if (!result.ok) {
    rejection(env, result.errors);
    return 0;
  }
  const submission = result.submission;

  // Branch off main BEFORE writing, so a re-run on an edited issue regenerates
  // from a clean base and force-pushes an identical tree rather than piling
  // edits on top of the previous run's.
  const branch = `intake/issue-${env.issueNumber}`;
  // FETCH_HEAD is exactly the tip this fetch wrote, so it does not depend on a
  // refs/remotes/origin/main tracking ref the single-branch CI checkout may not
  // have configured.
  git('fetch', 'origin', 'main');
  git('checkout', '-B', branch, 'FETCH_HEAD');

  const bytes = await download(submission.attachmentUrl);
  if (bytes === 'oversize') {
    rejection(env, [
      `The document is over GitHub's 25 MB limit for issue attachments — the one problem you ` +
        `cannot fix by editing this issue. See CONTRIBUTING.md for the clone-and-push path that ` +
        `oversize documents still use.`,
    ]);
    return 0;
  }

  const problems = contentErrors(submission.filename, bytes);
  if (problems.length > 0) {
    rejection(env, problems);
    return 0;
  }

  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const dirRel = join('intake', submission.entityDir, `fy${submission.fiscalYear}`);
  const dirAbs = join(REPO_ROOT, dirRel);
  mkdirSync(dirAbs, { recursive: true });

  writeFileSync(join(dirAbs, submission.filename), bytes);

  const provenance = buildProvenance(
    submission,
    { sha256, bytes: bytes.length },
    readExistingProvenance(dirAbs),
  );
  writeFileSync(join(dirAbs, 'provenance.yaml'), serializeProvenance(provenance), 'utf8');

  commitAndOpenPr(env, submission, join(dirRel, submission.filename));
  console.log(`Opened intake PR for ${submission.entity} FY${submission.fiscalYear}.`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
