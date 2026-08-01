/**
 * Generating the `provenance.yaml` that sits beside a raw artifact.
 *
 * The provenance record is the product here: it is what makes a number derived
 * from this document citable later. Three of its fields are computed from the
 * received bytes rather than typed by a human -- `sha256`, `bytes`,
 * `media_type` -- because the hash in particular is the one field a typo
 * silently breaks. `retrieved_by` is the issue author's handle. Everything else
 * comes from the validated submission.
 */

import { stringify as stringifyYaml } from 'yaml';

import { mediaTypeFor } from './security.ts';
import type { Submission } from './submission.ts';

export interface ProvenanceArtifact {
  readonly file: string;
  readonly source_url: string | null;
  readonly retrieved_date: string;
  readonly retrieval_method: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly media_type: string | null;
  readonly retrieved_by: string;
  readonly document_type: string;
  readonly note: string | null;
}

export interface ProvenanceDoc {
  readonly schema_version: '1.0';
  readonly entity: string;
  readonly fiscal_year: number;
  readonly artifacts: readonly ProvenanceArtifact[];
}

export interface ArtifactFacts {
  readonly sha256: string;
  readonly bytes: number;
}

function artifactFrom(submission: Submission, facts: ArtifactFacts): ProvenanceArtifact {
  return {
    file: submission.filename,
    source_url: submission.sourceUrl,
    retrieved_date: submission.retrievedDate,
    retrieval_method: submission.retrievalMethod,
    sha256: facts.sha256,
    bytes: facts.bytes,
    media_type: mediaTypeFor(submission.filename),
    retrieved_by: submission.retrievedBy,
    document_type: submission.documentType,
    note: submission.note,
  };
}

/**
 * Builds the provenance doc for a submission, appending to `existing` when a
 * directory already holds artifacts. An artifact whose filename matches one
 * already recorded replaces it, so re-running the workflow on an edited issue
 * regenerates the same file rather than accumulating duplicates.
 */
export function buildProvenance(
  submission: Submission,
  facts: ArtifactFacts,
  existing: ProvenanceDoc | null,
): ProvenanceDoc {
  const artifact = artifactFrom(submission, facts);
  const kept = (existing?.artifacts ?? []).filter((a) => a.file !== artifact.file);
  return {
    schema_version: '1.0',
    entity: submission.entity,
    fiscal_year: submission.fiscalYear,
    artifacts: [...kept, artifact],
  };
}

/** The doc as YAML, block style, ready to write beside the artifact. */
export function serializeProvenance(doc: ProvenanceDoc): string {
  return stringifyYaml(doc, { lineWidth: 0 });
}
