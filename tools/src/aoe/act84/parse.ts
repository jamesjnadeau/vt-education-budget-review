/**
 * Reads AOE's Act 84 tax rate discount worksheet (2024-02-08), as text from
 * `pdftotext -layout`, into one row per district.
 *
 * Only the FY2025 decrease is kept. The later columns predate Act 183 and
 * are not read. The rows' pre-Act 127 ADM must add up to the Total line, so
 * a missed or garbled row fails here instead of reaching the warehouse.
 */

export interface WorksheetRow {
  /** 1-based line in the .txt. */
  readonly line: number;
  /** Supervisory union number, as printed ("03"). */
  readonly su: string;
  /** District name, as printed. */
  readonly name: string;
  readonly county: string;
  readonly pre_act127_ltw_adm: number;
  /** The first "$" figure on the row: the FY2025 decrease. */
  readonly fy2025_decrease: number;
}

export interface Worksheet {
  readonly rows: WorksheetRow[];
  readonly total: { readonly pre_act127_ltw_adm: number; readonly line: number };
}

const ROW = /^\s*(\d\d)\s+(.+?)\s{2,}(\w[\w ]*?)\s{2,}([\d,.]+)\s.*?\$\s+([\d.]+)/;
const LOOKS_LIKE_ROW = /^\s*\d\d\s/;
const TOTAL = /^\s*Total\s+([\d,.]+)/;

const num = (s: string): number => Number(s.replaceAll(',', ''));
const cents = (x: number): number => Math.round(x * 100);

export function parseWorksheet(text: string): Worksheet {
  const rows: WorksheetRow[] = [];
  let total: Worksheet['total'] | undefined;
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const t = TOTAL.exec(raw);
    if (t) {
      total = { pre_act127_ltw_adm: num(t[1]!), line };
      return;
    }
    if (!LOOKS_LIKE_ROW.test(raw)) return;
    const m = ROW.exec(raw);
    if (!m) throw new Error(`Act 84 worksheet line ${line} starts like a district row but does not parse: ${raw.trim()}`);
    rows.push({
      line,
      su: m[1]!,
      name: m[2]!,
      county: m[3]!,
      pre_act127_ltw_adm: num(m[4]!),
      fy2025_decrease: num(m[5]!),
    });
  });
  if (!total) throw new Error('Act 84 worksheet has no Total line');
  const sum = rows.reduce((acc, r) => acc + cents(r.pre_act127_ltw_adm), 0);
  if (sum !== cents(total.pre_act127_ltw_adm)) {
    throw new Error(
      `Act 84 worksheet rows add up to ${sum / 100} pre-Act 127 ADM, but the Total line (line ${total.line}) says ${total.pre_act127_ltw_adm}`,
    );
  }
  return { rows, total };
}
