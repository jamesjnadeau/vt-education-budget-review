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
  if (value === null) return '—';
  switch (unit) {
    case 'usd':
    case 'usd_per_pupil':
      return usd.format(value);
    case 'rate_per_100':
      return usdCents.format(value);
    case 'pupils':
    case 'fte':
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

export function unitNoun(unit: Unit): string {
  switch (unit) {
    case 'pupils':
      return 'pupils';
    case 'fte':
      return 'FTE';
    case 'usd_per_pupil':
      return 'per pupil';
    case 'rate_per_100':
      return 'per $100 of equalized value';
    default:
      return '';
  }
}

// --------------------------------------------------------------------------
// Status propagation
// --------------------------------------------------------------------------

function statusFromBlockers(blockers: readonly Blocker[]): NodeStatus {
  if (blockers.some((b) => b.kind === 'unverified_parameter')) return 'unverified';
  if (blockers.some((b) => b.kind === 'missing_input')) return 'missing_input';
  if (blockers.some((b) => b.kind === 'contingent_parameter')) return 'contingent';
  return 'ok';
}

/** A contingent parameter does not prevent a value -- it qualifies it. */
function blocksValue(blockers: readonly Blocker[]): boolean {
  return blockers.some((b) => b.kind !== 'contingent_parameter');
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

function blockersOfParameter(p: Parameter): Blocker[] {
  const out: Blocker[] = [];
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
  if (p.contingent) {
    out.push({
      kind: 'contingent_parameter',
      ref: p.key,
      detail: `${p.description} depends on legislation that has not been enacted.`,
    });
  }
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

interface MakeArgs {
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
    range: null,
  };
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
  const numeric = typeof p.value === 'number' ? p.value : null;
  const cite = p.citation.session_law
    ? `${p.citation.statute}, as amended by ${p.citation.session_law}`
    : p.citation.statute;
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
      : `${p.description} is ${formatValue(numeric, unit)}, set by ${cite}.`,
    status: statusFromBlockers(blockers),
    blockers,
    notes: [],
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

export function walk(node: CalcNode, visit: (n: CalcNode, depth: number) => void, depth = 0): void {
  visit(node, depth);
  for (const child of node.inputs) walk(child, visit, depth + 1);
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

/** Flattens the tree to the ordered step list the walkthrough renders. */
export function toSteps(node: CalcNode): Array<{ depth: number; node: CalcNode }> {
  const steps: Array<{ depth: number; node: CalcNode }> = [];
  walk(node, (n, depth) => steps.push({ depth, node: n }));
  return steps;
}
