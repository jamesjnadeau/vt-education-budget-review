/**
 * Node constructors for the computation tree.
 *
 * Two invariants hold across every constructor in this file, and the rest of
 * the engine depends on them:
 *
 *  1. A node cannot carry a value if anything it rests on is unverified or
 *     missing. Status and blockers propagate upward automatically, so an
 *     unverified statutory weight cannot silently become a published figure
 *     several steps downstream. This is a structural guarantee, not a
 *     convention someone has to remember.
 *
 *  2. The explanation is generated from the same inputs as the arithmetic, in
 *     the same call. The "show your work" narration cannot drift out of sync
 *     with the number it describes because there is no path that produces one
 *     without the other.
 */

import type {
  Blocker,
  CalcNode,
  EngineContext,
  NodeStatus,
  Op,
  Parameter,
  ParameterSet,
  Unit,
} from './types.ts';

export function createContext(parameters: ParameterSet): EngineContext {
  let n = 0;
  return {
    parameters,
    nextId: () => `n${++n}`,
  };
}

// --------------------------------------------------------------------------
// Formatting
// --------------------------------------------------------------------------

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const usdCents = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});
const decimal1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const decimal4 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 });
const plain = new Intl.NumberFormat('en-US');

export function formatValue(value: number | null, unit: Unit): string {
  if (value == null || !Number.isFinite(value)) return '—';
  switch (unit) {
    case 'usd':
    case 'usd_per_pupil':
      return usd.format(value);
    case 'rate_per_100':
      return usdCents.format(value);
    case 'pupils':
    case 'fte':
    case 'persons_per_square_mile':
    case 'miles':
    case 'minutes':
      return decimal1.format(value);
    case 'ratio':
    case 'multiplier':
      return decimal4.format(value);
    case 'count':
    case 'years':
      return plain.format(value);
    case 'none':
      return decimal4.format(value);
  }
}

/** Formats a low/high band with the same unit rules as formatValue. */
export function formatRange(
  range: { readonly low: number; readonly high: number } | null,
  unit: Unit,
): string | null {
  if (range === null) return null;
  return `${formatValue(range.low, unit)}–${formatValue(range.high, unit)}`;
}

export function unitNoun(unit: Unit): string {
  switch (unit) {
    case 'pupils':
      return 'pupils';
    case 'fte':
      return 'FTE';
    case 'usd_per_pupil':
      return 'per pupil';
    case 'persons_per_square_mile':
      return 'persons per square mile of land';
    case 'miles':
      return 'road miles';
    case 'minutes':
      return 'minutes';
    case 'rate_per_100':
      return 'per $100 of equalized value';
    default:
      return '';
  }
}

// --------------------------------------------------------------------------
// Status propagation
// --------------------------------------------------------------------------

/**
 * A node has one status but may have several blockers, so the order below is a
 * claim about which one a reader most needs to hear.
 *
 * Terminal first. If any input is `not_computable` the result will never exist,
 * however much verifying or publishing happens elsewhere -- reporting such a
 * node as `unverified` would promise that reading a statute fixes it. Next
 * `undetermined`, which is somebody's future decision rather than anybody's
 * unfinished work. Only then our own outstanding verification, then the source
 * document's silence, then the contingency label.
 */
function statusFromBlockers(blockers: readonly Blocker[]): NodeStatus {
  if (blockers.some((b) => b.kind === 'not_computable')) return 'not_computable';
  if (blockers.some((b) => b.kind === 'undetermined_determination')) return 'undetermined';
  if (blockers.some((b) => b.kind === 'unverified_parameter')) return 'unverified';
  if (blockers.some((b) => b.kind === 'missing_input')) return 'missing_input';
  if (blockers.some((b) => b.kind === 'contingent_parameter')) return 'contingent';
  if (blockers.some((b) => b.kind === 'estimated_parameter')) return 'estimated';
  return 'ok';
}

/** A contingent or estimated parameter does not prevent a value -- it qualifies it. */
function blocksValue(blockers: readonly Blocker[]): boolean {
  return blockers.some((b) => b.kind !== 'contingent_parameter' && b.kind !== 'estimated_parameter');
}

function dedupeBlockers(blockers: readonly Blocker[]): Blocker[] {
  const seen = new Set<string>();
  const out: Blocker[] = [];
  for (const b of blockers) {
    const key = `${b.kind}::${b.ref}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}

/**
 * A parameter with a stated range and a central value stands in for an
 * unpublished figure: it computes from that central value as a labeled
 * estimate rather than blocking. Shared by `blockersOfParameter` (which
 * decides whether to raise) and `parameterNode` (which decides what to
 * compute) so the two can never drift apart on what counts as an estimate.
 */
function isEstimated(p: Parameter): boolean {
  return p.range !== null && p.range.central !== null && p.value === null;
}

function contingentBlocker(p: Parameter): Blocker {
  return {
    kind: 'contingent_parameter',
    ref: p.key,
    detail: `${p.description} depends on legislation that has not been enacted.`,
  };
}

function blockersOfParameter(p: Parameter): Blocker[] {
  const out: Blocker[] = [];

  // This deliberately takes precedence over the unverified/missing blockers
  // it would otherwise raise -- we have chosen to carry the estimate, and
  // `estimated_parameter` is non-blocking below.
  if (isEstimated(p)) {
    out.push({
      kind: 'estimated_parameter',
      ref: p.key,
      detail: `${p.description} (${p.citation.statute}) is carried as an estimate from a stated range; no figure has been published for this year.`,
    });
    if (p.contingent) out.push(contingentBlocker(p));
    return out;
  }

  if (!p.citation.verified) {
    out.push({
      kind: 'unverified_parameter',
      ref: p.key,
      detail: `${p.description} (${p.citation.statute}) has not been verified against current statute text.`,
    });
  }
  if (p.value === null && p.citation.verified && !p.contingent) {
    out.push({
      kind: 'missing_input',
      ref: p.key,
      detail: `${p.description} has no value set for this fiscal year.`,
    });
  }
  if (p.contingent) out.push(contingentBlocker(p));
  return out;
}

function gather(inputs: readonly CalcNode[], params: readonly Parameter[]): Blocker[] {
  const out: Blocker[] = [];
  for (const i of inputs) out.push(...i.blockers);
  for (const p of params) out.push(...blockersOfParameter(p));
  return dedupeBlockers(out);
}

// --------------------------------------------------------------------------
// Generic constructor
// --------------------------------------------------------------------------

export interface MakeArgs {
  readonly op: Op;
  readonly label: string;
  readonly unit: Unit;
  readonly inputs?: readonly CalcNode[];
  readonly parameters?: readonly Parameter[];
  /** Computes the value from already-resolved, non-null operands. */
  readonly compute: (operands: readonly number[], params: readonly Parameter[]) => number | null;
  readonly explain: (value: number | null, operands: readonly CalcNode[], params: readonly Parameter[]) => string;
  readonly notes?: readonly string[];
}

function make(ctx: EngineContext, args: MakeArgs): CalcNode {
  const inputs = args.inputs ?? [];
  const parameters = args.parameters ?? [];
  const notes = [...(args.notes ?? [])];

  const blockers = gather(inputs, parameters);

  let value: number | null = null;
  if (!blocksValue(blockers)) {
    const operands = inputs.map((i) => i.value);
    if (operands.every((v): v is number => v !== null)) {
      value = args.compute(operands, parameters);
      if (value !== null && !Number.isFinite(value)) {
        blockers.push({
          kind: 'missing_input',
          ref: args.label,
          detail: 'The calculation produced a non-finite result, usually a division by zero.',
        });
        value = null;
      }
    }
  }

  // Interval propagation. When any input carries a range, evaluate this node's
  // own formula at the corners of the input intervals and take the extremes.
  // It reuses `compute` rather than duplicating each formula's interval math.
  // Runs only when a point value exists, so a blocked node stays a plain
  // blank rather than sprouting a band with no center.
  //
  // Corner evaluation is the exact min/max ONLY under two assumptions: every
  // op here is coordinate-wise monotone per argument (true today), AND each
  // ranged input is independent of the others (also true today — no node yet
  // combines two inputs derived from the same ranged source). If a future
  // node introduced such a "diamond" dependency, corner evaluation would
  // become an over-approximation (it would evaluate impossible corners),
  // not exact.
  //
  // Monotonicity also assumes no denominator's interval straddles zero — if
  // it did, the true quotient range would be unbounded, and corner
  // evaluation would silently return a wrongly-narrow finite band. `make()`
  // is op-agnostic and has no way to know which inputs are denominators, so
  // this isn't guarded here; it's unreachable with current parameters (e.g.
  // the statewide adjustment ranges 0.7-0.8, never crossing zero).
  let range: { low: number; high: number } | null = null;
  if (value !== null && inputs.some((i) => i.range !== null)) {
    const intervals = inputs.map((i) =>
      i.range ? ([i.range.low, i.range.high] as const) : ([i.value as number, i.value as number] as const),
    );
    if (intervals.every(([lo, hi]) => Number.isFinite(lo) && Number.isFinite(hi))) {
      const corners = intervals.reduce<number[][]>(
        (acc, [lo, hi]) => {
          const ends = lo === hi ? [lo] : [lo, hi];
          return acc.flatMap((prefix) => ends.map((end) => [...prefix, end]));
        },
        [[]],
      );
      const results: number[] = [];
      for (const corner of corners) {
        const r = args.compute(corner, parameters);
        if (r !== null && Number.isFinite(r)) results.push(r);
      }
      if (results.length > 0) range = { low: Math.min(...results), high: Math.max(...results) };
    }
  }

  const status = statusFromBlockers(blockers);

  return {
    id: ctx.nextId(),
    op: args.op,
    label: args.label,
    value,
    unit: args.unit,
    inputs,
    parameters,
    explanation: value === null && blockers.length > 0
      ? explainBlocked(args.label, blockers)
      : args.explain(value, inputs, parameters),
    status,
    blockers,
    notes,
    range,
  };
}

/**
 * The generic constructor, for operations the curated set above does not cover.
 *
 * Exported deliberately, and it is the only sanctioned way to add one. The two
 * invariants at the top of this file -- status propagates upward, and the
 * explanation is produced in the same call as the arithmetic -- live inside
 * `make`. A module that hand-rolls a CalcNode object literal instead gets
 * neither, and the failure is silent: the node looks identical and simply
 * forgets to refuse. Reach for this rather than for a literal.
 */
export function derive(ctx: EngineContext, args: MakeArgs): CalcNode {
  return make(ctx, args);
}

function explainBlocked(label: string, blockers: readonly Blocker[]): string {
  const reasons = blockers.filter((b) => b.kind !== 'contingent_parameter').map((b) => b.detail);
  if (reasons.length === 0) return `${label} could not be computed.`;
  return `${label} cannot be computed yet. ${reasons.join(' ')}`;
}

// --------------------------------------------------------------------------
// Leaves
// --------------------------------------------------------------------------

export interface InputOptions {
  readonly notes?: readonly string[];
  /** Where this datum came from -- a warehouse record, an AOE report, a user's scenario setting. */
  readonly source?: string;
}

/** A datum from the warehouse, an enrichment join, or the user's scenario. */
export function input(
  ctx: EngineContext,
  label: string,
  value: number | null,
  unit: Unit,
  options: InputOptions = {},
): CalcNode {
  const blockers: Blocker[] =
    value === null
      ? [
          {
            kind: 'missing_input',
            ref: label,
            detail: `${label} was not published in the source document.`,
          },
        ]
      : [];
  const src = options.source ? ` Source: ${options.source}.` : '';
  return {
    id: ctx.nextId(),
    op: 'input',
    label,
    value,
    unit,
    inputs: [],
    parameters: [],
    explanation:
      value === null
        ? `${label} is not available. The source document does not publish it, and the engine does not estimate values it was not given.`
        : `${label} is ${formatValue(value, unit)}${unitNoun(unit) ? ' ' + unitNoun(unit) : ''}.${src}`,
    status: value === null ? 'missing_input' : 'ok',
    blockers,
    notes: options.notes ?? [],
    range: null,
  };
}

/**
 * A quantity withheld because the State has not made a decision that does not
 * yet exist.
 *
 * Distinct from `input(ctx, label, null, ...)`, which says a document is silent.
 * Nobody has failed to publish an AOE small/sparse necessity determination:
 * there are none to publish, because the rules governing them are unwritten.
 * The two must render differently or the site accuses AOE of an omission.
 */
export function undetermined(
  ctx: EngineContext,
  label: string,
  unit: Unit,
  detail: string,
  options: InputOptions = {},
): CalcNode {
  return {
    id: ctx.nextId(),
    op: 'input',
    label,
    value: null,
    unit,
    inputs: [],
    parameters: [],
    explanation: `${label} is undetermined. ${detail}`,
    status: 'undetermined',
    blockers: [{ kind: 'undetermined_determination', ref: label, detail }],
    notes: options.notes ?? [],
    range: null,
  };
}

/**
 * A quantity that cannot be answered from public data at all.
 *
 * Terminal, and a correct final answer rather than a gap. Whether a mountain
 * pass makes a bus route unsafe is a certification the supervisory union makes;
 * whether a receiving school could absorb the students needs building capacity
 * figures that are local and unpublished. Presenting either as outstanding work
 * would imply that enough effort here produces a number, and it does not.
 */
export function notComputable(
  ctx: EngineContext,
  label: string,
  unit: Unit,
  reason: 'requires_certification' | 'requires_local_model' | 'requires_projection',
  detail: string,
  options: InputOptions = {},
): CalcNode {
  return {
    id: ctx.nextId(),
    op: 'input',
    label,
    value: null,
    unit,
    inputs: [],
    parameters: [],
    explanation: detail,
    status: 'not_computable',
    blockers: [{ kind: 'not_computable', ref: `${label} (${reason})`, detail }],
    notes: options.notes ?? [],
    range: null,
  };
}

export class MissingParameterError extends Error {
  constructor(key: string, fiscalYear: number) {
    super(`Parameter "${key}" is not defined in the FY${fiscalYear} parameter set.`);
    this.name = 'MissingParameterError';
  }
}

export function lookup(ctx: EngineContext, key: string): Parameter {
  const p = ctx.parameters.parameters.get(key);
  if (!p) throw new MissingParameterError(key, ctx.parameters.fiscal_year);
  return p;
}

/** A statutory parameter surfaced as its own node, so the walkthrough can cite it. */
export function parameterNode(ctx: EngineContext, key: string, unit: Unit): CalcNode {
  const p = lookup(ctx, key);
  const blockers = dedupeBlockers(blockersOfParameter(p));
  const estimated = isEstimated(p);
  const numeric = typeof p.value === 'number' ? p.value : estimated && p.range ? p.range.central : null;
  const cite = p.citation.session_law
    ? `${p.citation.statute}, as amended by ${p.citation.session_law}`
    : p.citation.statute;

  // Not every parameter is a number. Booleans switch a provision on or off and
  // should read as such rather than as an em dash.
  const rendered =
    typeof p.value === 'boolean'
      ? p.value
        ? 'in force'
        : 'not in force'
      : numeric !== null
        ? formatValue(numeric, unit)
        : String(p.value ?? '—');

  return {
    id: ctx.nextId(),
    op: 'parameter',
    label: p.description,
    value: blocksValue(blockers) ? null : numeric,
    unit,
    inputs: [],
    parameters: [p],
    explanation: blocksValue(blockers)
      ? explainBlocked(p.description, blockers)
      : estimated && p.range
        ? `${p.description} is estimated at ${formatValue(numeric, unit)} (range ${formatValue(p.range.low, unit)}–${formatValue(p.range.high, unit)}); ${cite} has not published a figure for this year, so the range's central value stands in. ${p.range.basis}`
        : p.is_law
          ? `${p.description} is ${rendered}, set by ${cite}.`
          : // A proposal must never read as a rule. The clause is generated here,
            // beside the number, rather than left to a renderer to remember.
            `${p.description} is ${rendered} under ${cite}. That is a PROPOSED standard, ` +
            `not law: it has not been enacted and may never be.`,
    status: statusFromBlockers(blockers),
    blockers,
    notes: p.is_law
      ? []
      : ['Measured against a proposed standard, not a legal requirement.'],
    range: p.range ? { low: p.range.low, high: p.range.high } : null,
  };
}

// --------------------------------------------------------------------------
// Operations
// --------------------------------------------------------------------------

export function sum(ctx: EngineContext, label: string, inputs: readonly CalcNode[], unit: Unit): CalcNode {
  return make(ctx, {
    op: 'sum',
    label,
    unit,
    inputs,
    compute: (ops) => ops.reduce((a, b) => a + b, 0),
    explain: (value, ops) =>
      `${label} is ${formatValue(value, unit)}, the sum of ${listOf(ops, unit)}.`,
  });
}

export function difference(
  ctx: EngineContext,
  label: string,
  minuend: CalcNode,
  subtrahend: CalcNode,
  unit: Unit,
): CalcNode {
  return make(ctx, {
    op: 'difference',
    label,
    unit,
    inputs: [minuend, subtrahend],
    compute: ([a, b]) => (a as number) - (b as number),
    explain: (value, ops) =>
      `${label} is ${formatValue(value, unit)}: ${describe(ops[0], unit)} less ${describe(ops[1], unit)}.`,
  });
}

export function product(
  ctx: EngineContext,
  label: string,
  a: CalcNode,
  b: CalcNode,
  unit: Unit,
): CalcNode {
  return make(ctx, {
    op: 'product',
    label,
    unit,
    inputs: [a, b],
    compute: ([x, y]) => (x as number) * (y as number),
    explain: (value, ops) =>
      `${label} is ${formatValue(value, unit)}: ${describe(ops[0], ops[0]?.unit ?? unit)} multiplied by ${describe(ops[1], ops[1]?.unit ?? unit)}.`,
  });
}

export function quotient(
  ctx: EngineContext,
  label: string,
  numerator: CalcNode,
  denominator: CalcNode,
  unit: Unit,
): CalcNode {
  return make(ctx, {
    op: 'quotient',
    label,
    unit,
    inputs: [numerator, denominator],
    compute: ([n, d]) => ((d as number) === 0 ? Number.NaN : (n as number) / (d as number)),
    explain: (value, ops) =>
      `${label} is ${formatValue(value, unit)}: ${describe(ops[0], ops[0]?.unit ?? unit)} divided by ${describe(ops[1], ops[1]?.unit ?? unit)}.`,
  });
}

/** Applies a statutory multiplier to a quantity, citing the multiplier. */
export function applyWeight(
  ctx: EngineContext,
  label: string,
  quantity: CalcNode,
  parameterKey: string,
  unit: Unit,
): CalcNode {
  const weight = parameterNode(ctx, parameterKey, 'multiplier');
  return make(ctx, {
    op: 'product',
    label,
    unit,
    inputs: [quantity, weight],
    compute: ([q, w]) => (q as number) * (w as number),
    explain: (value, ops) =>
      `${label} is ${formatValue(value, unit)}: ${describe(ops[0], ops[0]?.unit ?? unit)} weighted at ${formatValue(ops[1]?.value ?? null, 'multiplier')}.`,
  });
}

export function mean(ctx: EngineContext, label: string, inputs: readonly CalcNode[], unit: Unit): CalcNode {
  return make(ctx, {
    op: 'mean',
    label,
    unit,
    inputs,
    compute: (ops) => (ops.length === 0 ? Number.NaN : ops.reduce((a, b) => a + b, 0) / ops.length),
    explain: (value, ops) =>
      `${label} is ${formatValue(value, unit)}, the average of ${ops.length} year${ops.length === 1 ? '' : 's'}: ${listOf(ops, unit)}.`,
  });
}

/** Passes a value through unchanged, relabelling it for the walkthrough. */
export function relabel(ctx: EngineContext, label: string, node: CalcNode, unit: Unit): CalcNode {
  return make(ctx, {
    op: 'passthrough',
    label,
    unit,
    inputs: [node],
    compute: ([v]) => v as number,
    explain: (value) => `${label} is ${formatValue(value, unit)}.`,
  });
}

export function greaterOf(
  ctx: EngineContext,
  label: string,
  a: CalcNode,
  b: CalcNode,
  unit: Unit,
): CalcNode {
  return make(ctx, {
    op: 'max',
    label,
    unit,
    inputs: [a, b],
    compute: ([x, y]) => Math.max(x as number, y as number),
    explain: (value, ops) =>
      `${label} is ${formatValue(value, unit)}, the greater of ${describe(ops[0], unit)} and ${describe(ops[1], unit)}.`,
  });
}

// --------------------------------------------------------------------------
// Explanation helpers
// --------------------------------------------------------------------------

function describe(node: CalcNode | undefined, unit: Unit): string {
  if (!node) return 'an unavailable value';
  return `${node.label} (${formatValue(node.value, node.unit ?? unit)})`;
}

function listOf(nodes: readonly CalcNode[], unit: Unit): string {
  const parts = nodes.map((n) => describe(n, unit));
  if (parts.length <= 1) return parts[0] ?? 'nothing';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

// --------------------------------------------------------------------------
// Tree traversal
// --------------------------------------------------------------------------

/**
 * Walks the computation graph.
 *
 * It is a DAG, not a tree: the same quantity legitimately feeds more than one
 * place. Long-term membership, for instance, is both a term of weighted
 * membership and the base the sparsity weight is applied to. That sharing is
 * real and should not be papered over by cloning nodes, so instead a node is
 * expanded once and later encounters are reported with `repeated: true` and
 * not descended into. Without the guard a wide DAG is traversed exponentially
 * and the flattened output repeats whole subtrees.
 */
export function walk(
  node: CalcNode,
  visit: (n: CalcNode, depth: number, repeated: boolean) => void,
  depth = 0,
  seen: Set<string> = new Set(),
): void {
  const repeated = seen.has(node.id);
  visit(node, depth, repeated);
  if (repeated) return;
  seen.add(node.id);
  for (const child of node.inputs) walk(child, visit, depth + 1, seen);
}

/** Every parameter used anywhere beneath a node, deduplicated -- the citation list for a result. */
export function collectParameters(node: CalcNode): Parameter[] {
  const byKey = new Map<string, Parameter>();
  walk(node, (n) => {
    for (const p of n.parameters) byKey.set(p.key, p);
  });
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function collectBlockers(node: CalcNode): Blocker[] {
  return dedupeBlockers(node.blockers);
}

export interface Step {
  readonly depth: number;
  readonly node: CalcNode;
  /**
   * True when this node was already expanded earlier in the walkthrough. The UI
   * should render it as a back-reference ("as computed above") rather than
   * repeating the working, which is both shorter and more honest about the fact
   * that it is the same quantity and not a second, coincidentally equal one.
   */
  readonly repeated: boolean;
}

/** Flattens the graph to the ordered step list the walkthrough renders. */
export function toSteps(node: CalcNode): Step[] {
  const steps: Step[] = [];
  walk(node, (n, depth, repeated) => steps.push({ depth, node: n, repeated }));
  return steps;
}
