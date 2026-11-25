/**
 * Where a published figure comes from. The values are read from the intake
 * provenance file at build time, so the publisher, title, date and link are
 * never typed by hand here.
 */
import { parse as parseYaml } from 'yaml';
import provenanceText from '../../../intake/tax-rates/fy2026/provenance.yaml?raw';

export interface Source {
  publisher: string;
  document: string;
  date: string;
  url: string;
}

interface ProvenanceArtifact {
  publisher: string;
  title: string;
  published_date: string;
  document_page: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "2025-08-18" becomes "August 18, 2025". */
function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`provenance published_date is not YYYY-MM-DD: ${iso}`);
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

function fromProvenance(text: string): Source {
  const doc = parseYaml(text) as { artifacts: ProvenanceArtifact[] };
  const a = doc.artifacts.find((x) => x.publisher && x.title && x.published_date && x.document_page);
  if (!a) throw new Error('provenance file has no artifact with publisher, title, published_date and document_page');
  return { publisher: a.publisher, document: a.title, date: longDate(a.published_date), url: a.document_page };
}

export const TAX_RATES_FY2026: Source = fromProvenance(provenanceText);

export function sourceText(s: Source, label = 'Source:'): string {
  return `${label} ${s.publisher}, “${s.document}”, ${s.date}.`;
}
