/**
 * Reading a GitHub issue-form submission back into fields.
 *
 * An issue form renders each field as a `### <label>` heading followed by the
 * value the contributor entered, with omitted optional fields shown as the
 * literal `_No response_`. That rendered markdown is the only thing the webhook
 * carries, so parsing it -- rather than any structured payload -- is how the
 * workflow recovers what was submitted. Kept a pure function over a string so
 * every hostile shape can be exercised against a fixture instead of a real
 * issue.
 */

const NO_RESPONSE = '_No response_';

/**
 * Fields keyed by their heading, lowercased. A heading with no value, or the
 * `_No response_` sentinel, maps to null; a heading absent from the body is
 * absent from the map, so a caller can tell "left blank" from "never asked".
 */
export function parseIssueForm(body: string): Map<string, string | null> {
  const out = new Map<string, string | null>();
  // Split on headings at the start of a line. The first chunk is whatever sat
  // before the first heading (nothing, for a real form) and is discarded.
  const parts = body.split(/^###[ \t]+/m);
  for (const part of parts.slice(1)) {
    const newline = part.indexOf('\n');
    const heading = (newline === -1 ? part : part.slice(0, newline)).trim().toLowerCase();
    if (!heading) continue;
    const value = newline === -1 ? '' : part.slice(newline + 1).trim();
    out.set(heading, value === '' || value === NO_RESPONSE ? null : value);
  }
  return out;
}

export interface Attachment {
  readonly text: string;
  readonly url: string;
}

// A markdown link or image embed: `[text](url)` or `![text](url)`. GitHub
// renders a dragged-in file as exactly this, with the district's filename as
// the link text and a bare user-attachments UUID as the target. A plain-text
// URL in an input field is NOT this shape, so a source_url never reads as an
// attachment.
const LINK = /!?\[([^\]]*)\]\(([^)\s]+)\)/g;

/** Every attachment link in the body, in order, so the caller can reject more than one. */
export function findAttachments(body: string): Attachment[] {
  const out: Attachment[] = [];
  for (const match of body.matchAll(LINK)) {
    out.push({ text: match[1] ?? '', url: match[2] ?? '' });
  }
  return out;
}
