import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

import { DownloadError } from './download-client.ts';
import { runWebIntake, type WebRunDeps } from './run-web.ts';

const PDF = Buffer.from('%PDF-1.7 hello');
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const ID = 'sub-123';
const UP = 'b'.repeat(32);

const payload = (fields: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  submission_id: ID,
  upload_id: UP,
  entity: 'su/x',
  fiscal_year: '2027',
  fields: {
    document_url: null,
    source_url: 'https://example.org/b',
    retrieved_date: '2026-11-01',
    retrieval_method: 'manual-download',
    document_type: 'budget_book',
    note: null,
    name: 'Pat',
    ...fields,
  },
  ...extra,
});

function setup(over: Partial<WebRunDeps> = {}) {
  const repoRoot = mkdtempSync(join(tmpdir(), 'run-web-'));
  const written: { relDir: string; filename: string; bytes: Buffer; yaml: string }[] = [];
  const base = {
    knownSlugs: new Set(['su/x']),
    repoRoot,
    today: '2026-11-22',
    download: vi.fn(async () => ({ filename: 'budget-fy27.pdf', bytes: PDF })),
    fetchLink: vi.fn(async () => ({ bytes: PDF, finalUrl: 'https://d.example/docs/Budget%20FY27.pdf', contentType: 'application/pdf' })),
    writeArtifact: vi.fn((relDir: string, filename: string, bytes: Buffer, yaml: string) => {
      written.push({ relDir, filename, bytes, yaml });
    }),
    openPr: vi.fn(async (_b: string, _t: string, _f: string) => 'https://github.com/o/r/pull/9'),
    openFailureIssue: vi.fn(async (_t: string, _f: string) => {}),
    cleanupUpload: vi.fn(async (_id: string) => {}),
  } satisfies WebRunDeps;
  const deps = { ...base, ...over } as typeof base;
  return { deps, written, repoRoot };
}

const bodyOf = (call: unknown[]) => readFileSync(call[call.length - 1] as string, 'utf8');

describe('runWebIntake', () => {
  it('upload happy path writes artifact and provenance, opens PR, cleans up', async () => {
    const { deps, written } = setup();
    const r = await runWebIntake(payload(), deps);
    expect(r).toEqual({ ok: true, pr: 'https://github.com/o/r/pull/9' });
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ relDir: 'intake/su-x/fy2027', filename: 'budget-fy27.pdf' });
    const art = parse(written[0]!.yaml).artifacts[0];
    expect(art).toMatchObject({ file: 'budget-fy27.pdf', sha256: sha(PDF), retrieved_by: 'web form: Pat' });
    const [branch, title, file] = deps.openPr.mock.calls[0]!;
    expect(branch).toBe('intake/web-sub-123');
    expect(title).toBe('Budget intake: su/x FY2027');
    expect(readFileSync(file, 'utf8')).toContain('Netlify submission id: sub-123.');
    expect(deps.cleanupUpload).toHaveBeenCalledWith(UP);
    expect(deps.openFailureIssue).not.toHaveBeenCalled();
  });

  it('link path records http-fetch', async () => {
    const { deps, written } = setup();
    const r = await runWebIntake(payload({ document_url: 'https://d.example/docs/Budget%20FY27.pdf' }, { upload_id: null }), deps);
    expect(r.ok).toBe(true);
    const art = parse(written[0]!.yaml).artifacts[0];
    expect(art).toMatchObject({ retrieval_method: 'http-fetch', retrieved_date: '2026-11-22', source_url: 'https://d.example/docs/Budget%20FY27.pdf' });
    expect(deps.cleanupUpload).not.toHaveBeenCalled();
  });

  it('missing upload meta becomes a failure issue', async () => {
    const { deps } = setup({ download: vi.fn(async () => { throw new DownloadError('upload not found'); }) });
    const r = await runWebIntake(payload(), deps);
    expect(r).toEqual({ ok: false, reasons: ['upload not found'] });
    expect(deps.openFailureIssue).toHaveBeenCalledTimes(1);
    const call = deps.openFailureIssue.mock.calls[0]!;
    expect(call[0]).toBe('Web intake failed: su/x FY2027');
    expect(readFileSync(call[1], 'utf8')).toContain(ID);
    expect(deps.openPr).not.toHaveBeenCalled();
    expect(deps.cleanupUpload).not.toHaveBeenCalled();
  });

  it('duplicate sha256 is rejected naming the existing path', async () => {
    const { deps, repoRoot } = setup();
    const dir = join(repoRoot, 'intake', 'su-y', 'fy2026');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'provenance.yaml'), `artifacts:\n  - file: old.pdf\n    sha256: ${sha(PDF)}\n`);
    const r = await runWebIntake(payload(), deps);
    expect(r.ok).toBe(false);
    expect(bodyOf(deps.openFailureIssue.mock.calls[0]!)).toContain('intake/su-y/fy2026/old.pdf');
    expect(deps.openPr).not.toHaveBeenCalled();
  });

  it('filename collision is rejected', async () => {
    const { deps, repoRoot } = setup();
    const dir = join(repoRoot, 'intake', 'su-x', 'fy2027');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'budget-fy27.pdf'), 'other');
    const r = await runWebIntake(payload(), deps);
    expect(r.ok).toBe(false);
    const body = bodyOf(deps.openFailureIssue.mock.calls[0]!);
    expect(body).toContain('intake/su-x/fy2027/budget-fy27.pdf');
    expect(body).not.toContain(repoRoot);
  });

  it('merges into an existing provenance.yaml', async () => {
    const { deps, written, repoRoot } = setup();
    const dir = join(repoRoot, 'intake', 'su-x', 'fy2027');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'provenance.yaml'), `schema_version: '1.0'\nentity: su/x\nfiscal_year: 2027\nartifacts:\n  - file: older.pdf\n    sha256: ${'0'.repeat(64)}\n`);
    expect((await runWebIntake(payload(), deps)).ok).toBe(true);
    expect(parse(written[0]!.yaml).artifacts.map((a: { file: string }) => a.file)).toEqual(['older.pdf', 'budget-fy27.pdf']);
  });

  it('lowercases the extension', async () => {
    const { deps, written } = setup({ download: vi.fn(async () => ({ filename: 'Budget.PDF', bytes: PDF })) });
    expect((await runWebIntake(payload(), deps)).ok).toBe(true);
    expect(written[0]!.filename).toBe('Budget.pdf');
  });

  it('web mode passes hostile note text through as data', async () => {
    const note = '"$(rm -rf /)`\n---';
    const { deps, written } = setup();
    const r = await runWebIntake(payload({ note }), deps);
    expect(r.ok).toBe(true);
    expect(parse(written[0]!.yaml).artifacts[0].note).toBe(note);
    expect(readFileSync(deps.openPr.mock.calls[0]![2], 'utf8')).toContain(note);
  });

  it('failure issue never contains email', async () => {
    const { deps } = setup({ download: vi.fn(async () => { throw new DownloadError('upload not found'); }) });
    await runWebIntake(payload({}, { email: 'secret.person@example.com' }), deps);
    const body = bodyOf(deps.openFailureIssue.mock.calls[0]!);
    expect(body).not.toContain('@');
    expect(body).not.toContain('secret.person');
  });

  it('an id unfit for a branch name is a failure', async () => {
    const { deps } = setup();
    const r = await runWebIntake({ ...payload(), submission_id: 'x y;..' }, deps);
    expect(r.ok).toBe(false);
    expect(deps.download).not.toHaveBeenCalled();
  });

  it.each(['x/../y', 'abc?x=1', `${UP}/0`, `${UP}#f`])('hostile upload id %s fails before any download', async (id) => {
    const { deps } = setup();
    const r = await runWebIntake(payload({}, { upload_id: id }), deps);
    expect(r).toEqual({ ok: false, reasons: ['The upload id is not valid.'] });
    expect(deps.download).not.toHaveBeenCalled();
    expect(deps.openFailureIssue).toHaveBeenCalledTimes(1);
  });

  it('an invalid payload becomes a failure issue', async () => {
    const { deps } = setup();
    const r = await runWebIntake({ submission_id: ID, entity: 'nope', fiscal_year: '2027' }, deps);
    expect(r.ok).toBe(false);
    expect(dirname(deps.openFailureIssue.mock.calls[0]![1])).toBeTruthy();
    expect(deps.download).not.toHaveBeenCalled();
  });
});
