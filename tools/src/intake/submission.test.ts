import { describe, expect, it } from 'vitest';

import { buildSubmission, type SubmissionInput } from './submission.ts';

const KNOWN = new Set(['su/addison-central', 'su/barre']);

/** A well-formed issue body, with individual fields overridable. */
function body(over: Partial<Record<string, string>> = {}): string {
  const fields: Record<string, string> = {
    Entity: 'su/addison-central',
    'Fiscal year': '2025',
    Document: '[ACSD Budget Book FY24.pdf](https://github.com/user-attachments/assets/abc-123)',
    'Source URL': 'https://acsdvt.org/budget.pdf',
    'Retrieved date': '2025-01-15',
    'Retrieval method': 'manual-download',
    'Document type': 'budget_book',
    Note: '_No response_',
    ...over,
  };
  return Object.entries(fields)
    .map(([k, v]) => `### ${k}\n\n${v}`)
    .join('\n\n');
}

function input(over: Partial<SubmissionInput> = {}): SubmissionInput {
  return { body: body(), authorLogin: 'octocat', knownSlugs: KNOWN, ...over };
}

function errorsFrom(over: Partial<SubmissionInput>): readonly string[] {
  const result = buildSubmission(input(over));
  if (result.ok) throw new Error('expected the submission to be rejected');
  return result.errors;
}

describe('buildSubmission — happy path', () => {
  it('produces a submission with computed and recorded fields', () => {
    const result = buildSubmission(input());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.submission).toMatchObject({
      entity: 'su/addison-central',
      entityDir: 'su-addison-central',
      fiscalYear: 2025,
      attachmentUrl: 'https://github.com/user-attachments/assets/abc-123',
      filename: 'ACSD Budget Book FY24.pdf',
      sourceUrl: 'https://acsdvt.org/budget.pdf',
      retrievedDate: '2025-01-15',
      retrievalMethod: 'manual-download',
      documentType: 'budget_book',
      note: null,
      retrievedBy: '@octocat',
    });
  });

  it('keeps a slug whose body carries dashes intact when forming the directory', () => {
    const result = buildSubmission(input({ body: body({ Entity: 'su/addison-central' }) }));
    if (!result.ok) throw new Error('expected ok');
    expect(result.submission.entityDir).toBe('su-addison-central');
  });
});

describe('buildSubmission — entity', () => {
  it('rejects a slug with no registry record', () => {
    expect(errorsFrom({ body: body({ Entity: 'su/typo' }) }).join('\n')).toMatch(/registry/i);
  });

  it('rejects a missing entity', () => {
    expect(errorsFrom({ body: body({ Entity: '_No response_' }) }).length).toBeGreaterThan(0);
  });
});

describe('buildSubmission — fiscal year', () => {
  it('rejects a non-numeric fiscal year', () => {
    expect(errorsFrom({ body: body({ 'Fiscal year': 'next year' }) }).join('\n')).toMatch(/fiscal/i);
  });

  it('rejects a fiscal year outside the schema range', () => {
    expect(errorsFrom({ body: body({ 'Fiscal year': '1999' }) }).length).toBeGreaterThan(0);
  });
});

describe('buildSubmission — the attachment', () => {
  it('rejects a body with no attachment', () => {
    expect(errorsFrom({ body: body({ Document: '_No response_' }) }).join('\n')).toMatch(/attach|document/i);
  });

  it('rejects more than one attachment rather than silently taking the first', () => {
    const two =
      '[a.pdf](https://github.com/user-attachments/assets/1) and ' +
      '[b.pdf](https://github.com/user-attachments/assets/2)';
    expect(errorsFrom({ body: body({ Document: two }) }).join('\n')).toMatch(/one|single|two|more than/i);
  });

  it('rejects an attachment on a non-allowlisted host', () => {
    expect(
      errorsFrom({ body: body({ Document: '[x.pdf](https://evil.example.com/x.pdf)' }) }).join('\n'),
    ).toMatch(/host|allow/i);
  });

  it('rejects a traversal filename in the link text', () => {
    const link = '[../../.github/workflows/deploy.yml](https://github.com/user-attachments/assets/1)';
    expect(errorsFrom({ body: body({ Document: link }) }).length).toBeGreaterThan(0);
  });
});

describe('buildSubmission — enums', () => {
  it('rejects a retrieval_method outside the schema enum', () => {
    expect(
      errorsFrom({ body: body({ 'Retrieval method': 'downloaded it' }) }).join('\n'),
    ).toMatch(/retrieval/i);
  });

  it('rejects a document_type outside the schema enum', () => {
    expect(
      errorsFrom({ body: body({ 'Document type': 'a budget book' }) }).join('\n'),
    ).toMatch(/document.type/i);
  });
});

describe('buildSubmission — source URL and note', () => {
  it('requires a source_url when the method is not email or in_person', () => {
    expect(
      errorsFrom({ body: body({ 'Source URL': '_No response_' }) }).join('\n'),
    ).toMatch(/source/i);
  });

  it('rejects email with a null source_url and no note', () => {
    const errors = errorsFrom({
      body: body({ 'Retrieval method': 'email', 'Source URL': '_No response_', Note: '_No response_' }),
    });
    expect(errors.join('\n')).toMatch(/note/i);
  });

  it('accepts email with a null source_url when a note explains it', () => {
    const result = buildSubmission(
      input({
        body: body({
          'Retrieval method': 'email',
          'Source URL': '_No response_',
          Note: 'Emailed by the ACSD business manager on 2025-01-15.',
        }),
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.submission.sourceUrl).toBeNull();
    expect(result.submission.note).toContain('business manager');
  });
});

describe('buildSubmission — robustness', () => {
  it('reads fields regardless of heading order', () => {
    const reordered = ['Document type', 'Entity', 'Fiscal year', 'Retrieval method', 'Retrieved date', 'Source URL', 'Document']
      .map((k) => {
        const map: Record<string, string> = {
          Entity: 'su/barre',
          'Fiscal year': '2026',
          Document: '[b.pdf](https://github.com/user-attachments/assets/9)',
          'Source URL': 'https://example.org/b.pdf',
          'Retrieved date': '2026-02-01',
          'Retrieval method': 'http-fetch',
          'Document type': 'budget_book',
        };
        return `### ${k}\n\n${map[k]}`;
      })
      .join('\n\n');
    const result = buildSubmission(input({ body: reordered }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.submission.entity).toBe('su/barre');
    expect(result.submission.fiscalYear).toBe(2026);
  });
});
