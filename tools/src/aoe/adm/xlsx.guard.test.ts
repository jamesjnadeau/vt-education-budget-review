import { describe, expect, it, vi, type Mock } from 'vitest';

// This file exercises the sheet-count guard in xlsx.ts without needing real
// multi-sheet or empty-workbook fixtures (which read-excel-file, being
// read-only, cannot help us author). It mocks the library's shape directly,
// which is why it lives apart from xlsx.test.ts: that file reads the real
// artifact and must see the real library, not a stub.
vi.mock('read-excel-file/node', () => ({
  default: vi.fn(),
}));

import readXlsxFile from 'read-excel-file/node';

import { readSheetRows } from './xlsx.ts';

const mockReadXlsxFile = readXlsxFile as unknown as Mock;

describe('readSheetRows sheet-count guard', () => {
  it('throws, naming the sheets found, when a workbook has more than one sheet', async () => {
    // The scenario the guard exists for: a cover/notes tab shipped ahead of
    // the data tab would otherwise be silently read as "the" sheet.
    mockReadXlsxFile.mockResolvedValueOnce([
      { sheet: 'Cover Notes', data: [['Please read before use']] },
      { sheet: '2024', data: [['T001', 'Addison', 88.56, 57.97]] },
    ]);

    await expect(readSheetRows('/fake/multi-sheet.xlsx')).rejects.toThrow(
      /found 2.*Cover Notes.*2024/s,
    );
  });

  it('returns an empty array, without throwing, for a workbook with no sheets', async () => {
    // Pinned per code review: a zero-sheet response is not treated as the
    // ambiguous case the guard targets (there is nothing to disambiguate),
    // so this must keep resolving to `[]` rather than throwing.
    mockReadXlsxFile.mockResolvedValueOnce([]);

    await expect(readSheetRows('/fake/empty.xlsx')).resolves.toEqual([]);
  });
});
