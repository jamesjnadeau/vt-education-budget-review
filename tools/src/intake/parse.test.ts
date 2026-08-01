import { describe, expect, it } from 'vitest';

import { findAttachments, parseIssueForm } from './parse.ts';

// A body as GitHub renders an issue-form submission: each field becomes a
// `### <label>` heading followed by the value. Empty optional fields render as
// the literal `_No response_`.
const BODY = [
  '### Entity',
  '',
  'su/addison-central',
  '',
  '### Fiscal year',
  '',
  '2025',
  '',
  '### Document',
  '',
  '[ACSD Budget Book FY24.pdf](https://github.com/user-attachments/assets/abc-123)',
  '',
  '### Source URL',
  '',
  'https://acsdvt.org/budget.pdf',
  '',
  '### Retrieved date',
  '',
  '2025-01-15',
  '',
  '### Retrieval method',
  '',
  'manual-download',
  '',
  '### Document type',
  '',
  'budget_book',
  '',
  '### Note',
  '',
  '_No response_',
].join('\n');

describe('parseIssueForm', () => {
  it('reads each field by its heading regardless of order', () => {
    const form = parseIssueForm(BODY);
    expect(form.get('entity')).toBe('su/addison-central');
    expect(form.get('fiscal year')).toBe('2025');
    expect(form.get('retrieval method')).toBe('manual-download');
    expect(form.get('document type')).toBe('budget_book');
  });

  it('maps an omitted field (_No response_) to null', () => {
    expect(parseIssueForm(BODY).get('note')).toBeNull();
  });

  it('returns undefined for a heading that is absent entirely', () => {
    const withoutNote = BODY.split('\n').slice(0, -3).join('\n');
    expect(parseIssueForm(withoutNote).has('note')).toBe(false);
  });

  it('is insensitive to heading order', () => {
    const reordered = [
      '### Fiscal year',
      '',
      '2025',
      '',
      '### Entity',
      '',
      'su/barre',
    ].join('\n');
    const form = parseIssueForm(reordered);
    expect(form.get('entity')).toBe('su/barre');
    expect(form.get('fiscal year')).toBe('2025');
  });
});

describe('findAttachments', () => {
  it('extracts the URL from the link target and the name from the link text', () => {
    const found = findAttachments(BODY);
    expect(found).toHaveLength(1);
    expect(found[0]).toEqual({
      text: 'ACSD Budget Book FY24.pdf',
      url: 'https://github.com/user-attachments/assets/abc-123',
    });
  });

  it('finds image-embed attachments too', () => {
    const found = findAttachments('![scan.pdf](https://github.com/user-attachments/assets/x)');
    expect(found).toHaveLength(1);
    expect(found[0]?.text).toBe('scan.pdf');
  });

  it('does not treat a bare URL in a text field as an attachment', () => {
    // source_url arrives as plain text, never as a markdown link.
    const found = findAttachments('### Source URL\n\nhttps://acsdvt.org/budget.pdf');
    expect(found).toHaveLength(0);
  });

  it('reports every attachment link so the caller can reject more than one', () => {
    const two = [
      '[a.pdf](https://github.com/user-attachments/assets/1)',
      '[b.pdf](https://github.com/user-attachments/assets/2)',
    ].join('\n\n');
    expect(findAttachments(two)).toHaveLength(2);
  });
});
