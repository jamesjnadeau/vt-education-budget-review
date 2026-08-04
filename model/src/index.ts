/**
 * Vermont education funding formula engine.
 *
 * Dependency-light and pure by design: the same code runs in the build
 * pipeline (to precompute baseline figures) and in the browser (to run
 * scenarios). Nothing here touches the filesystem or the network.
 *
 * The engine's contract, in one sentence: it never returns a number it cannot
 * justify. Every value is accompanied by the tree that produced it, the
 * citations of every parameter applied, and -- where a value is absent -- an
 * explicit reason distinguishing "the district did not publish this" from
 * "we have not yet verified this against statute".
 */

export * from './types.ts';
export * from './node.ts';
export * from './membership.ts';
export * from './tax.ts';
export * from './foundation.ts';
export * from './scenario.ts';
export * from './adm-resolution.ts';
export * from './small-sparse.ts';
export { parseParameterSet, unverifiedParameters, staleParameters, ParameterFileError } from './parameters/parse.ts';
