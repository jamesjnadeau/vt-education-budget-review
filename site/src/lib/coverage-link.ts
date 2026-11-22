/**
 * Which link an admin coverage cell gets. Order matters: a cell with a
 * warehouse file has nothing left to do; an intake-only cell goes to the
 * normalize form; anything else goes to the web form (every non-normalized
 * cell has one, so no further fallback is reachable).
 */
export interface CoverageLinkCell {
  readonly warehouseFile: string | null;
  readonly normalizeUrl: string | null;
  readonly formUrl: string | null;
}

export function coverageHref(cell: CoverageLinkCell): string | null {
  if (cell.warehouseFile) return null;
  return cell.normalizeUrl ?? cell.formUrl ?? null;
}
