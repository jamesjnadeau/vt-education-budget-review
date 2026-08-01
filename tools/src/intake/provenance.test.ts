import { describe, expect, it } from 'vitest';

import { parse as parseYaml } from 'yaml';

import { validateAgainst } from '../validate/schemas.ts';
import { buildProvenance, serializeProvenance, type ProvenanceDoc } from './provenance.ts';
import { buildSubmission, type Submission } from './submission.ts';

const KNOWN = new Set(['su/addison-central']);

function goodSubmission(over: Partial<Record<string, string>> = {}): Submission {
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
  const body = Object.entries(fields)
    .map(([k, v]) => `### ${k}\n\n${v}`)
    .join('\n\n');
  const result = buildSubmission({ body, authorLogin: 'octocat', knownSlugs: KNOWN });
  if (!result.ok) throw new Error(`fixture is invalid: ${result.errors.join('; ')}`);
  return result.submission;
}

const FACTS = { sha256: 'a'.repeat(64), bytes: 1234 };

describe('buildProvenance', () => {
  it('produces a doc that validates against the provenance schema', () => {
    const doc = buildProvenance(goodSubmission(), FACTS, null);
    expect(validateAgainst('provenance', doc)).toEqual([]);
  });

  it('computes sha256, bytes and media_type rather than trusting a human', () => {
    const doc = buildProvenance(goodSubmission(), FACTS, null);
    const artifact = doc.artifacts[0];
    expect(artifact?.sha256).toBe('a'.repeat(64));
    expect(artifact?.bytes).toBe(1234);
    expect(artifact?.media_type).toBe('application/pdf');
    expect(artifact?.retrieved_by).toBe('@octocat');
  });

  it('records a null source_url with the note for an emailed document', () => {
    const submission = goodSubmission({
      'Retrieval method': 'email',
      'Source URL': '_No response_',
      Note: 'Emailed by the business manager, 2025-01-15.',
    });
    const doc = buildProvenance(submission, FACTS, null);
    expect(doc.artifacts[0]?.source_url).toBeNull();
    expect(doc.artifacts[0]?.note).toContain('business manager');
    expect(validateAgainst('provenance', doc)).toEqual([]);
  });

  it('appends to an existing directory rather than overwriting it', () => {
    const first = buildProvenance(goodSubmission(), FACTS, null);
    const second = buildProvenance(
      goodSubmission({
        Document: '[ACSD Budget Book FY25.pdf](https://github.com/user-attachments/assets/def-456)',
      }),
      { sha256: 'b'.repeat(64), bytes: 5678 },
      first,
    );
    expect(second.artifacts).toHaveLength(2);
    expect(second.artifacts.map((a) => a.file)).toEqual([
      'ACSD Budget Book FY24.pdf',
      'ACSD Budget Book FY25.pdf',
    ]);
    expect(validateAgainst('provenance', second)).toEqual([]);
  });

  it('replaces an artifact of the same filename so a re-run stays idempotent', () => {
    const first = buildProvenance(goodSubmission(), FACTS, null);
    const rerun = buildProvenance(goodSubmission(), { sha256: 'c'.repeat(64), bytes: 9999 }, first);
    expect(rerun.artifacts).toHaveLength(1);
    expect(rerun.artifacts[0]?.sha256).toBe('c'.repeat(64));
  });
});

describe('serializeProvenance', () => {
  it('round-trips through YAML with schema_version kept a string', () => {
    const doc = buildProvenance(goodSubmission(), FACTS, null);
    const round = parseYaml(serializeProvenance(doc)) as ProvenanceDoc;
    expect(round.schema_version).toBe('1.0');
    expect(validateAgainst('provenance', round)).toEqual([]);
  });
});
