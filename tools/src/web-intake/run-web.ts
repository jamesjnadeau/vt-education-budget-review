/**
 * The web mode of the intake job: turn one repository_dispatch payload into a
 * pull request (or a failure issue). All IO is injected so the flow is tested
 * with fakes; tools/src/cli/intake.ts wires the real git/gh/download pieces.
 *
 * The payload is public input. Only the named fields are read (an email that
 * reaches the payload is never copied anywhere), and nothing here builds a
 * shell command: hostile text only ever lands in files passed with --body-file
 * or in the provenance YAML.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { buildProvenance, serializeProvenance, type ProvenanceDoc } from '../intake/provenance.ts';
import { contentErrors, mediaTypeFor } from '../intake/security.ts';
import { DownloadError, isUploadId } from './download-client.ts';
import { chooseWebFilename } from './filename.ts';
import { LinkFetchError, type FetchedLink } from './fetch-link.ts';
import { MAX_WEB_BYTES } from './limits.ts';
import { buildWebSubmission, type WebSubmission } from './payload.ts';
import { collisionError, findDuplicate } from './corpus.ts';
import { toSubmission, type Obtained } from './provenance-map.ts';

export interface WebRunDeps {
  knownSlugs: ReadonlySet<string>;
  repoRoot: string;
  today: string;
  download: (id: string) => Promise<{ filename: string; bytes: Buffer }>;
  fetchLink: (url: string) => Promise<FetchedLink>;
  writeArtifact: (relDir: string, filename: string, bytes: Buffer, provenanceYaml: string) => void;
  openPr: (branch: string, title: string, bodyFile: string) => Promise<string>;
  openFailureIssue: (title: string, bodyFile: string) => Promise<void>;
  cleanupUpload: (id: string) => Promise<void>;
}

export type WebRunResult = { ok: true; pr: string } | { ok: false; reasons: string[] };

/** A zero-width joiner after each '@' stops the App from @mentioning users or teams. */
const defang = (s: string): string => s.replace(/@/g, '@\u200d');
const flat = (s: string, max = 120): string => defang(s.replace(/[\p{Cc}\s]+/gu, ' ').trim().slice(0, max));
const cell = (s: string | null): string => (s === null ? '' : flat(s, 300).replace(/\|/g, '\\|'));

function scratchFile(name: string, contents: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'web-intake-')), name);
  writeFileSync(path, contents, 'utf8');
  return path;
}

/** A fenced block whose fence is longer than any backtick run inside, so the text cannot close it. */
function fenced(text: string): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((r) => r.length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}text\n${text}\n${fence}`;
}

/** The last path segment of a URL, decoded, or null when it cannot be decoded. */
function nameFromUrl(url: string): string | null {
  let segment: string;
  try {
    segment = new URL(url).pathname.split('/').pop() ?? '';
  } catch {
    return null;
  }
  try {
    segment = decodeURIComponent(segment);
  } catch {
    return null;
  }
  return segment === '' ? null : segment;
}

/** corpus.ts joins the provenance file value unchecked: keep the extension lowercase. */
const lowerExtension = (filename: string): string => filename.replace(/\.([^.]+)$/, (_m, ext: string) => `.${ext.toLowerCase()}`);

function submissionIdOf(payload: unknown): string {
  const id = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>)['submission_id'] : null;
  return typeof id === 'string' && id.trim() !== '' ? flat(id, 80) : 'unknown';
}

function prBody(ws: WebSubmission, filename: string, sha256: string, how: Obtained): string {
  const rows: [string, string | null][] = [
    ['Entity', ws.entity],
    ['Fiscal year', String(ws.fiscalYear)],
    ['Document type', ws.documentType],
    ['File', filename],
    ['Obtained', how.kind === 'link' ? `fetched from a link on ${how.fetchedDate}` : 'uploaded through the form'],
    ['Source URL', how.kind === 'link' ? how.finalUrl : ws.sourceUrl],
    ['Retrieved date', how.kind === 'link' ? how.fetchedDate : ws.retrievedDate],
    ['Retrieval method', how.kind === 'link' ? 'http-fetch' : ws.retrievalMethod],
    ['SHA-256', sha256],
  ];
  const table = ['| Field | Value |', '| --- | --- |', ...rows.map(([k, v]) => `| ${k} | ${cell(v)} |`)].join('\n');
  const note = ws.note === null ? '' : `\n\nNote from the contributor:\n\n${fenced(ws.note)}`;
  return (
    `Sent through the web form on the site. Netlify submission id: ${ws.submissionId}.\n\n${table}${note}\n\n` +
    'The raw artifact and its provenance record only. `validate.yml` checks this like any other PR.\n'
  );
}

function failureBody(entity: string, fy: string, submissionId: string, reasons: readonly string[]): string {
  return (
    `A document sent through the web form could not be filed.\n\n` +
    `- Entity: ${flat(entity)}\n- Fiscal year: ${flat(fy, 20)}\n- Submission id: ${submissionId}\n\n` +
    `Reasons:\n\n${reasons.map((r) => `- ${defang(r.replace(/\s*\n\s*/g, ' '))}`).join('\n')}\n\n` +
    'Re-send it through the GitHub issue form once fixed.\n'
  );
}

export async function runWebIntake(payload: unknown, deps: WebRunDeps): Promise<WebRunResult> {
  const fail = async (entity: string, fy: string, reasons: string[]): Promise<WebRunResult> => {
    const bodyFile = scratchFile('web-intake-failure.md', failureBody(entity, fy, submissionIdOf(payload), reasons));
    await deps.openFailureIssue(`Web intake failed: ${flat(entity, 80)} FY${flat(fy, 20)}`, bodyFile);
    return { ok: false, reasons };
  };

  const built = buildWebSubmission(payload, deps.knownSlugs);
  if (!built.ok) return fail(built.entity, built.fiscalYear, built.errors);
  const ws = built.submission;
  const failHere = (reasons: string[]) => fail(ws.entity, String(ws.fiscalYear), reasons);
  // The id becomes a git branch name, so it must be a plain token.
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(ws.submissionId)) {
    return failHere(['The submission id is not a plain token, so no branch can be named for it.']);
  }

  if (ws.source.kind === 'upload' && !isUploadId(ws.source.uploadId)) {
    return failHere(['The upload id is not valid.']);
  }

  // --- obtain the bytes ---------------------------------------------------
  let bytes: Buffer;
  let original: string | null;
  let contentType: string | null = null;
  let how: Obtained;
  try {
    if (ws.source.kind === 'upload') {
      const got = await deps.download(ws.source.uploadId);
      bytes = got.bytes;
      original = got.filename;
      how = { kind: 'upload' };
    } else {
      const got = await deps.fetchLink(ws.source.url);
      bytes = got.bytes;
      original = nameFromUrl(got.finalUrl);
      contentType = got.contentType;
      how = { kind: 'link', finalUrl: got.finalUrl, fetchedDate: deps.today };
    }
  } catch (err) {
    if (err instanceof DownloadError || err instanceof LinkFetchError) return failHere([err.message]);
    throw err;
  }

  // --- name and content checks -------------------------------------------
  const chosen = chooseWebFilename({
    original,
    contentType,
    entityDir: ws.entityDir,
    fiscalYear: ws.fiscalYear,
    documentType: ws.documentType,
  });
  if (!chosen.ok) return failHere([chosen.error]);
  const filename = lowerExtension(chosen.filename);

  const reasons: string[] = [...contentErrors(filename, bytes, MAX_WEB_BYTES)];
  const relDir = `intake/${ws.entityDir}/fy${ws.fiscalYear}`;
  const relPath = `${relDir}/${filename}`;
  const absPath = join(deps.repoRoot, relPath);
  const collision = collisionError(absPath);
  if (collision !== null) reasons.push(collision.split(absPath).join(relPath));

  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const duplicate = findDuplicate(sha256, join(deps.repoRoot, 'intake'));
  if (duplicate !== null) reasons.push(`This exact file is already in the repository at ${duplicate}.`);
  if (mediaTypeFor(filename) === null) reasons.push(`"${filename}" is not an accepted file type.`);
  if (reasons.length > 0) return failHere(reasons);

  // --- provenance, write, PR ---------------------------------------------
  const submission = toSubmission(ws, filename, chosen.generated, how);
  const provPath = join(deps.repoRoot, relDir, 'provenance.yaml');
  let existing: ProvenanceDoc | null = null;
  if (existsSync(provPath)) {
    const doc = parseYaml(readFileSync(provPath, 'utf8')) as ProvenanceDoc | null;
    existing = Array.isArray(doc?.artifacts) ? doc : null;
  }
  const provenance = buildProvenance(submission, { sha256, bytes: bytes.length }, existing);
  let pr: string;
  try {
    deps.writeArtifact(relDir, filename, bytes, serializeProvenance(provenance));
    const bodyFile = scratchFile('web-intake-pr.md', prBody(ws, filename, sha256, how));
    pr = await deps.openPr(
      `intake/web-${ws.submissionId}`,
      `Budget intake: ${flat(ws.entity, 80)} FY${ws.fiscalYear}`,
      bodyFile,
    );
  } catch (err) {
    // The upload is deliberately kept (cleanup is skipped) so a human can retry.
    console.error(`web-intake: filing failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    return failHere(['The document was accepted but opening the pull request failed. Check the workflow run.']);
  }

  if (ws.source.kind === 'upload') {
    try {
      await deps.cleanupUpload(ws.source.uploadId);
    } catch (err) {
      console.error(`Could not delete upload ${ws.source.uploadId}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }
  return { ok: true, pr };
}
