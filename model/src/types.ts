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
  | 'persons_per_square_mile'
  | 'miles'
  | 'minutes'
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
  /**
   * False for a parameter that records what a body proposed rather than what
   * the law says.
   *
   * The small/sparse layer draws on two sources with incompatible verification
   * rules: Act 73 as amended, and thresholds the State Board's committee
   * proposed in December 2025 and may never enact. Quoting the committee's
   * report accurately is a different act from quoting a statute accurately, and
   * a renderer that cannot tell them apart will present a proposal as law.
   */
  readonly is_law: boolean;
  /** Where the SHAPE of the calculation, not just the number, is at stake. */
  readonly structural_note: string | null;
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
 * There are four kinds of blank and they must never collapse into one another,
 * because each one belongs to a different party and implies a different remedy:
 *
 *   `unverified`     Our outstanding work. A statutory value has not been
 *                    confirmed against current law. Someone reads the act.
 *   `missing_input`  A fact about the source. The district did not publish a
 *                    figure. Nobody here can fix it by working harder.
 *   `undetermined`   The State has not made a decision that does not yet exist.
 *                    AOE has published no small/sparse necessity determinations
 *                    because the rules governing them are unwritten. Rendering
 *                    this as `missing_input` would imply AOE failed to publish
 *                    something, which is false and unfair to them.
 *   `not_computable` The question cannot be answered from public data at all --
 *                    it requires a certification, a local model, or a
 *                    projection. Terminal by design, and a correct final answer
 *                    rather than a to-do item. A coverage dashboard that paints
 *                    these red is lying about what completion looks like.
 *
 * `contingent` is not a blank: it qualifies a value rather than withholding
 * one.
 */
export type NodeStatus =
  | 'ok'
  | 'unverified'
  | 'missing_input'
  | 'undetermined'
  | 'not_computable'
  | 'contingent';

export interface Blocker {
  readonly kind:
    | 'unverified_parameter'
    | 'missing_input'
    | 'contingent_parameter'
    | 'undetermined_determination'
    | 'not_computable';
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
  | 'passthrough'
  /**
   * Tests a quantity against a statutory threshold. Its value is the QUANTITY,
   * not the verdict: a screen that reports 1 or 0 loses the number a reader
   * needs in order to see how close the school is to the line, which for a
   * school at 99 pupils against a threshold of 100 is the whole story.
   */
  | 'screen';

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
