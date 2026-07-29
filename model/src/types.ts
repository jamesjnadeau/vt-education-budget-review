/**
 * Core types for the computation engine.
 *
 * The engine's output is not a number but a tree. Every node carries its
 * inputs, the operation applied, the result, a plain-language explanation and
 * the citation of every parameter used. The UI renders this tree directly as
 * the "show your work" walkthrough, which is why the explanation is produced
 * here rather than assembled in the presentation layer -- the walkthrough and
 * the arithmetic must never be able to drift apart.
 */

export type Unit =
  | 'usd'
  | 'usd_per_pupil'
  | 'pupils'
  | 'rate_per_100'
  | 'ratio'
  | 'count'
  | 'multiplier'
  | 'fte'
  | 'years'
  | 'none';

export interface Citation {
  readonly statute: string;
  readonly session_law: string | null;
  readonly source_url: string | null;
  readonly quote: string | null;
  readonly verified: boolean;
  readonly verified_date: string | null;
  readonly verified_by: string | null;
}

export interface ParameterRange {
  readonly low: number;
  readonly high: number;
  readonly central: number | null;
  readonly basis: string;
}

export interface Parameter {
  readonly key: string;
  readonly value: number | string | boolean | readonly unknown[] | null;
  readonly unit: string;
  readonly description: string;
  readonly citation: Citation;
  readonly applies_to: string | null;
  readonly range: ParameterRange | null;
  readonly contingent: boolean;
}

export interface ParameterSet {
  readonly fiscal_year: number;
  readonly status: 'draft' | 'verified' | 'superseded';
  readonly note: string | null;
  readonly parameters: ReadonlyMap<string, Parameter>;
}

/**
 * Why a node does or does not carry a value.
 *
 * The distinction between `unverified` and `missing_input` is the whole
 * credibility position in one field: `unverified` means we have not yet
 * confirmed a statutory value against current law, and `missing_input` means
 * the district did not publish a figure. One is our outstanding work, the
 * other is a fact about the source. They must never be collapsed.
 */
export type NodeStatus = 'ok' | 'unverified' | 'missing_input' | 'contingent';

export interface Blocker {
  readonly kind: 'unverified_parameter' | 'missing_input' | 'contingent_parameter';
  readonly ref: string;
  readonly detail: string;
}

export type Op =
  | 'input'
  | 'parameter'
  | 'sum'
  | 'difference'
  | 'product'
  | 'quotient'
  | 'weighted_sum'
  | 'mean'
  | 'max'
  | 'min'
  | 'clamp'
  | 'passthrough';

export interface CalcNode {
  readonly id: string;
  readonly op: Op;
  readonly label: string;
  /** Null whenever status is anything but `ok` or `contingent`. */
  readonly value: number | null;
  readonly unit: Unit;
  readonly inputs: readonly CalcNode[];
  readonly parameters: readonly Parameter[];
  /** Plain language, already rendered. The UI shows this verbatim. */
  readonly explanation: string;
  readonly status: NodeStatus;
  /** Everything standing between this node and a trustworthy number. */
  readonly blockers: readonly Blocker[];
  readonly notes: readonly string[];
  /** Present only for nodes downstream of a contingent parameter. */
  readonly range: { readonly low: number; readonly high: number } | null;
}

export interface EngineContext {
  readonly parameters: ParameterSet;
  /** Monotonic counter backing node ids; ids are stable for a given traversal order. */
  nextId: () => string;
}
