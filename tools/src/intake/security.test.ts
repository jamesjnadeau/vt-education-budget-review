import { describe, expect, it } from 'vitest';

import {
  MAX_ATTACHMENT_BYTES,
  contentErrors,
  filenameError,
  isAllowedAttachmentUrl,
  magicBytesMatch,
  mediaTypeFor,
} from './security.ts';

describe('filenameError', () => {
  it('accepts a plain released filename, spaces and all', () => {
    expect(filenameError('ACSD Budget Book FY24.pdf')).toBeNull();
  });

  it('rejects a path traversal', () => {
    expect(filenameError('../../.github/workflows/deploy.yml')).not.toBeNull();
  });

  it('rejects an embedded path separator', () => {
    expect(filenameError('sub/dir/budget.pdf')).not.toBeNull();
    expect(filenameError('sub\\dir\\budget.pdf')).not.toBeNull();
  });

  it('rejects a leading dot', () => {
    expect(filenameError('.hidden.pdf')).not.toBeNull();
  });

  it('rejects control characters', () => {
    expect(filenameError('budget\x07.pdf')).not.toBeNull();
    expect(filenameError('budget\n.pdf')).not.toBeNull();
  });

  it('rejects an extension outside the LFS allowlist', () => {
    expect(filenameError('budget.exe')).not.toBeNull();
    expect(filenameError('budget.txt')).not.toBeNull();
    expect(filenameError('budget')).not.toBeNull();
  });

  it('accepts a case-variant extension the .gitattributes filters also match', () => {
    // .gitattributes tracks both *.pdf and *.PDF; a case-sensitive check would
    // let `.Pdf` land as a plain git blob, defeating the LFS decision.
    expect(filenameError('budget.PDF')).toBeNull();
    expect(filenameError('budget.Pdf')).toBeNull();
    expect(filenameError('sheet.XLSX')).toBeNull();
  });
});

describe('isAllowedAttachmentUrl', () => {
  it('allows the three GitHub attachment hosts', () => {
    expect(isAllowedAttachmentUrl('https://github.com/user-attachments/assets/uuid')).toBe(true);
    expect(isAllowedAttachmentUrl('https://objects.githubusercontent.com/x')).toBe(true);
    expect(isAllowedAttachmentUrl('https://user-images.githubusercontent.com/1/2.png')).toBe(true);
  });

  it('rejects github.com paths that are not user-attachments', () => {
    expect(isAllowedAttachmentUrl('https://github.com/owner/repo/raw/main/evil')).toBe(false);
  });

  it('rejects any other host, so the workflow is not a fetch proxy', () => {
    expect(isAllowedAttachmentUrl('https://evil.example.com/x.pdf')).toBe(false);
    expect(isAllowedAttachmentUrl('http://github.com/user-attachments/assets/uuid')).toBe(false);
  });

  it('rejects a lookalike host that merely ends with the allowed one', () => {
    expect(isAllowedAttachmentUrl('https://objects.githubusercontent.com.evil.com/x')).toBe(false);
  });
});

describe('magicBytesMatch', () => {
  it('accepts a PDF that begins %PDF-', () => {
    expect(magicBytesMatch('budget.pdf', Buffer.from('%PDF-1.7\n...'))).toBe(true);
  });

  it('accepts an xlsx that begins with the ZIP magic', () => {
    expect(magicBytesMatch('sheet.xlsx', Buffer.from('PKrest'))).toBe(true);
  });

  it('accepts a legacy .xls with the OLE compound-file magic', () => {
    expect(
      magicBytesMatch('old.xls', Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
    ).toBe(true);
  });

  it('rejects a PDF extension whose bytes are not a PDF', () => {
    expect(magicBytesMatch('budget.pdf', Buffer.from('<html>not a pdf'))).toBe(false);
  });

  it('is case-insensitive about the extension', () => {
    expect(magicBytesMatch('budget.PDF', Buffer.from('%PDF-1.4'))).toBe(true);
  });
});

describe('mediaTypeFor', () => {
  it('derives the media type from the extension', () => {
    expect(mediaTypeFor('budget.pdf')).toBe('application/pdf');
    expect(mediaTypeFor('sheet.XLSX')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });
});

describe('MAX_ATTACHMENT_BYTES', () => {
  it('is the 25 MB issue-attachment ceiling', () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(25 * 1024 * 1024);
  });
});

describe('contentErrors', () => {
  it('passes a real PDF under the size cap', () => {
    expect(contentErrors('budget.pdf', Buffer.from('%PDF-1.7 body'))).toEqual([]);
  });

  it('rejects a file over the 25 MB cap', () => {
    const oversize = Buffer.alloc(MAX_ATTACHMENT_BYTES + 1);
    oversize.write('%PDF-');
    const errors = contentErrors('budget.pdf', oversize);
    expect(errors.some((e) => /25 MB|too large/i.test(e))).toBe(true);
  });

  it('rejects bytes whose magic does not match the extension', () => {
    const errors = contentErrors('budget.pdf', Buffer.from('<html>'));
    expect(errors.some((e) => /pdf/i.test(e))).toBe(true);
  });
});
