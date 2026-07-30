/**
 * Year labels for an AOE ADM report, and the invariants that catch a misfiled
 * or mislabeled download.
 *
 * One row of numbers carries more than one year, and conflating them misdates
 * the whole series:
 *
 *   count_year   the school year pupils were actually counted  ("2023-2024")
 *   adm_label    AOE's "(ADM-NN)" label                        (25)
 *   fiscal_year  the determination year, and this project's     (2025)
 *                single name for the year
 *
 * fiscal_year and count_year sit TWO years apart, and that is correct: a FY2025
 * determination is made on pupils counted in SY2023-24. Both invariants below
 * were verified against all ten published years with no exceptions, so a
 * violation means a bad file rather than an unusual one.
 */

export interface YearLabels {
  readonly count_year: string;
  readonly count_year_start: number;
  readonly adm_label: number;
  readonly fiscal_year: number;
  readonly source_title: string;
}

const TITLE = /for\s+(\d{4})-(\d{4})\s*\(ADM-(\d{2})\)/i;
const LINK = /^(\d{4})-(\d{4})\s*\(ADM-(\d{2})\)\s*(.+)$/i;

/**
 * The invisible characters below are built from their numeric code points
 * rather than typed as literal characters or `\u` escape sequences in this
 * file's source text. Either of those forms is exactly the kind of byte that
 * gets silently mangled -- dropped, re-encoded, or normalized away -- when it
 * passes through an editor, a diff, or a chat transcript, which would leave
 * this module unable to strip the very characters it exists to strip. Building
 * them from `String.fromCharCode` keeps every code point visible as a plain
 * ASCII hex literal, so the intent here can be verified by eye.
 */

// U+00A0 NO-BREAK SPACE -- AOE's CMS emits this in place of an ordinary space.
const NBSP = String.fromCharCode(0x00a0);
const NBSP_RE = new RegExp(NBSP, 'g');

// Zero-width and directional formatting characters, plus the line/paragraph
// separators and the UTF-8 byte-order mark. ADM-16's link text carries a
// trailing zero-width space (U+200B); the others are stripped defensively
// since AOE's CMS is not a controlled source of plain text.
const INVISIBLE_CODEPOINTS = [
  0x200b, // ZERO WIDTH SPACE
  0x200c, // ZERO WIDTH NON-JOINER
  0x200d, // ZERO WIDTH JOINER
  0x200e, // LEFT-TO-RIGHT MARK
  0x200f, // RIGHT-TO-LEFT MARK
  0x2028, // LINE SEPARATOR
  0x2029, // PARAGRAPH SEPARATOR
  0xfeff, // ZERO WIDTH NO-BREAK SPACE / BYTE ORDER MARK
];
const INVISIBLE_RE = new RegExp(
  `[${INVISIBLE_CODEPOINTS.map((codePoint) => String.fromCharCode(codePoint)).join('')}]`,
  'g',
);

/** Applies the two invariants, or explains precisely which one failed. */
function build(
  startRaw: string,
  endRaw: string,
  labelRaw: string,
  sourceTitle: string,
): YearLabels {
  const count_year_start = Number(startRaw);
  const count_year_end = Number(endRaw);
  const adm_label = Number(labelRaw);
  const fiscal_year = adm_label + 2000;

  if (count_year_end - count_year_start !== 1) {
    throw new Error(
      `"${sourceTitle}" spans ${startRaw}-${endRaw}, which is not two consecutive school years.`,
    );
  }

  const expectedStart = fiscal_year - 2;
  if (count_year_start !== expectedStart) {
    throw new Error(
      `"${sourceTitle}" is labelled ADM-${labelRaw}, so its count year must start in ` +
        `${expectedStart}, but it states ${startRaw}. The invariant ` +
        `count_year_start == fiscal_year - 2 holds for every published year, so this ` +
        `file is mislabeled rather than unusual.`,
    );
  }

  return {
    count_year: `${startRaw}-${endRaw}`,
    count_year_start,
    adm_label,
    fiscal_year,
    source_title: sourceTitle,
  };
}

export function parseTitleRow(title: string): YearLabels {
  const trimmed = title.trim();
  const m = TITLE.exec(trimmed);
  if (!m) {
    throw new Error(
      `Could not read year labels from the title row "${trimmed}". Expected something ` +
        `containing "for YYYY-YYYY (ADM-NN)".`,
    );
  }
  return build(m[1] as string, m[2] as string, m[3] as string, trimmed);
}

/**
 * AOE's CMS emits non-breaking spaces and, in ADM-16's case, a trailing
 * zero-width space. Left in place they defeat a plain text match.
 */
export function normalizeLinkText(raw: string): string {
  return raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(NBSP_RE, ' ')
    .replace(INVISIBLE_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseLinkText(text: string): YearLabels & { readonly grain: string } {
  const normalized = normalizeLinkText(text);
  const m = LINK.exec(normalized);
  if (!m) {
    throw new Error(
      `Could not read year labels from the link text "${normalized}". Expected ` +
        `"YYYY-YYYY (ADM-NN) <grain>".`,
    );
  }
  const labels = build(m[1] as string, m[2] as string, m[3] as string, normalized);
  return { ...labels, grain: (m[4] as string).trim() };
}

/**
 * The filename is a third statement of the year. It is checked because the
 * cheapest real failure is a human downloading the right link into the wrong
 * name, or the wrong link at all.
 *
 * Three URL slug eras exist, so both spellings are accepted:
 *   ...-by-resident-district-fy24.xlsx      (eras A and B)
 *   ...-resident-district-adm17.xlsx        (era C)
 */
export function assertYearAgreement(labels: YearLabels, filename: string): void {
  const m = /(?:fy|adm)[-_]?(\d{2})(?!\d)/i.exec(filename);
  if (!m) {
    throw new Error(
      `The filename "${filename}" states no year, so it cannot be checked against the ` +
        `document's own ADM-${labels.adm_label} label. Rename it as released rather than ` +
        `guessing which year it is.`,
    );
  }
  const fromName = Number(m[1]);
  if (fromName !== labels.adm_label) {
    throw new Error(
      `The filename "${filename}" says ADM-${fromName} but the document says ` +
        `ADM-${labels.adm_label} (count year ${labels.count_year}). These disagree, so the ` +
        `file is misfiled or misnamed. Resolve it by hand rather than trusting either.`,
    );
  }
}
