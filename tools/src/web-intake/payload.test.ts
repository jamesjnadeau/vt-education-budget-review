import { describe, expect, it } from 'vitest';
import { buildWebSubmission, toDispatchPayload } from './payload.ts';

const slugs = new Set(['su/addison-central']);

function valid(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    submission_id: 'sub-1',
    upload_id: 'up-1',
    entity: 'su/addison-central',
    fiscal_year: '2026',
    fields: {
      document_url: null,
      source_url: 'https://example.org/doc',
      retrieved_date: '2026-11-01',
      retrieval_method: 'manual-download',
      document_type: 'budget_book',
      note: null,
      name: 'Jane',
    },
    ...extra,
  };
}

describe('toDispatchPayload', () => {
  it('drops email and other unnamed keys', () => {
    const result = toDispatchPayload('sub-1', {
      entity: ' su/addison-central ',
      fiscal_year: '2026',
      email: 'a@b.c',
      'bot-field': 'x',
      'cf-turnstile-response': 'tok',
      source_url: 'https://example.org/doc',
      note: '',
    });
    const json = JSON.stringify(result);
    expect(json).not.toContain('a@b.c');
    expect(json).not.toContain('bot-field');
    expect(json).not.toContain('tok');
    expect(Object.keys(result).length).toBeLessThanOrEqual(10);
    expect(result.entity).toBe('su/addison-central');
    expect(result.fields.note).toBeNull();
    expect(result.fields.source_url).toBe('https://example.org/doc');
  });
});

describe('buildWebSubmission', () => {
  it('accepts a valid upload payload', () => {
    const r = buildWebSubmission(valid(), slugs);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.submission.source.kind).toBe('upload');
      expect(r.submission.name).toBe('Jane');
      expect(r.submission.submissionId).toBe('sub-1');
    }
  });

  it('rejects both upload and link', () => {
    const p = valid();
    (p.fields as Record<string, unknown>).document_url = 'https://x/y.pdf';
    const r = buildWebSubmission(p, slugs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain('Send either a file or a link, not both.');
  });

  it('rejects neither', () => {
    const r = buildWebSubmission(valid({ upload_id: null }), slugs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain('Send a file or a link to the document.');
  });

  it('rejects an http link', () => {
    const p = valid({ upload_id: null });
    (p.fields as Record<string, unknown>).document_url = 'http://x/y.pdf';
    const r = buildWebSubmission(p, slugs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toContain('https');
  });

  it('accepts an https link', () => {
    const p = valid({ upload_id: null });
    (p.fields as Record<string, unknown>).document_url = 'https://x/y.pdf';
    const r = buildWebSubmission(p, slugs);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.submission.source).toEqual({ kind: 'link', url: 'https://x/y.pdf' });
  });

  it('returns errors for non-object payloads without throwing', () => {
    const r = buildWebSubmission(null, slugs);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.entity).toBe('unknown');
    expect(() => buildWebSubmission({ entity: 5 }, slugs)).not.toThrow();
    const r2 = buildWebSubmission({ entity: 5 }, slugs);
    expect(r2.ok).toBe(false);
  });
});
