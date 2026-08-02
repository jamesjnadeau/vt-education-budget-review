/**
 * Scenario <-> URL translation for the what-if tool's shareable links.
 *
 * Every field on the what-if form is a value the reader is supposing about a
 * district, so a shareable link is just those values written into the URL. This
 * module owns two things and nothing else: the map from each form field's DOM id
 * to a short, readable query-parameter name, and the pure encode/decode/build
 * functions over that map. It touches no DOM, so it is unit-tested directly; the
 * island (model-tool.ts) is thin glue that reads the form into a Scenario and
 * writes a decoded Scenario back into the form -- the same shape as the
 * statewide-average helper.
 *
 * Design rules, all enforced by tests:
 *   - Only non-empty values are encoded. A blank field is left out of the URL,
 *     so a shared link never asserts a value the sharer did not enter, and a
 *     decoded link never overwrites a field the link did not carry.
 *   - Unknown params are ignored on decode, so the tool tolerates tracking
 *     params, hand edits, or params from a later version.
 *   - Param names are readable and hand-editable, and decoupled from the DOM ids
 *     so a future id rename need not break existing links (update the registry).
 */

/** A form field's value, keyed by its DOM element id. */
export type Scenario = Record<string, string>;

/** One shareable field: its DOM element id and the URL query key it maps to. */
export interface ShareField {
  readonly id: string;
  readonly param: string;
}

// The order here is the order params appear in the URL. parameter-mode leads so
// the fiscal year / example choice is the first thing a reader sees in the link.
// Every id below is an existing element id in site/src/pages/model/index.astro.
export const SHARE_FIELDS: readonly ShareField[] = [
  { id: 'parameter-mode', param: 'mode' },
  { id: 'prek-1', param: 'prek1' },
  { id: 'k5-1', param: 'k5_1' },
  { id: 'g68-1', param: 'g68_1' },
  { id: 'g912-1', param: 'g912_1' },
  { id: 'prek-2', param: 'prek2' },
  { id: 'k5-2', param: 'k5_2' },
  { id: 'g68-2', param: 'g68_2' },
  { id: 'g912-2', param: 'g912_2' },
  { id: 'state-placed', param: 'state_placed' },
  { id: 'econ', param: 'econ' },
  { id: 'el', param: 'el' },
  { id: 'density', param: 'density' },
  { id: 'small-school-name', param: 'school' },
  { id: 'small-school-enrollment', param: 'enrollment' },
  { id: 'spending', param: 'spending' },
  { id: 'cla', param: 'cla' },
  { id: 'statewide-avg', param: 'statewide_avg' },
];

/**
 * Encode a scenario into a query string (no leading '?'), one param per
 * non-empty field, in SHARE_FIELDS order. URLSearchParams handles escaping.
 */
export function encodeScenario(scenario: Scenario): string {
  const params = new URLSearchParams();
  for (const { id, param } of SHARE_FIELDS) {
    const value = scenario[id];
    if (value !== undefined && value.trim() !== '') params.set(param, value);
  }
  return params.toString();
}

/**
 * Decode a query string (with or without a leading '?') into a scenario keyed by
 * DOM id, including only recognized, non-empty params. Unknown params are dropped.
 */
export function decodeScenario(query: string): Scenario {
  const params = new URLSearchParams(query);
  const scenario: Scenario = {};
  for (const { id, param } of SHARE_FIELDS) {
    const value = params.get(param);
    if (value !== null && value.trim() !== '') scenario[id] = value;
  }
  return scenario;
}

/** Build a full shareable URL from a base (origin + pathname) and a scenario. */
export function shareUrl(base: string, scenario: Scenario): string {
  const query = encodeScenario(scenario);
  return query === '' ? base : `${base}?${query}`;
}
