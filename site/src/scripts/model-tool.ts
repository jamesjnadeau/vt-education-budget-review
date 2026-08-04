/**
 * The modeling island.
 *
 * Runs the engine in the browser against the same parameter files the build
 * pipeline uses. Its job is to make the arithmetic legible, which means the
 * walkthrough is not a summary of the calculation -- it is the calculation's
 * own tree, rendered node by node.
 *
 * The parameter set is selectable, and the distinction between kinds is
 * enforced visually rather than left to a footnote:
 *
 *   live      one option per real fiscal-year file (FY2025, FY2026, FY2027,
 *             …), read straight from the build's parameters.json. Every value
 *             is null and every citation unverified, so the engine declines to
 *             compute and the tool shows precisely which parameter blocked each
 *             step. Each option's label reports that year's own status and
 *             count of unverified numbers, so no year is passed off as more
 *             settled than it is.
 *
 *   example   deliberately arbitrary weights, so a reader can see what a
 *             completed walkthrough looks like. Their citation field reads
 *             "SYNTHETIC TEST FIXTURE -- not a statutory value and not Vermont
 *             law", and that string is rendered in the citation column of every
 *             step, so an example figure announces what it is wherever it is
 *             screenshotted or quoted.
 */

import {
  collectParameters,
  computeWeightedMembership,
  createContext,
  defaultAssumptions,
  formatRange,
  formatValue,
  input,
  perWeightedPupil,
  toSteps,
  townRate,
  type Blocker,
  type CalcNode,
  type MembershipResult,
  type Parameter,
  type ParameterSet,
  type PublishedInput,
  type Unit,
} from '@vt-budget/model';

import { enteredYearTotal } from './entered-total.ts';
import { SHARE_FIELDS, decodeScenario, shareUrl, type Scenario } from './share-link.ts';
import { nextStatewideAverage } from './statewide-average.ts';
import { studentSummarySections } from './student-summary.ts';

// resolved-adm.json (Task 5's output) is a build artifact under
// site/src/generated/ -- gitignored and written by `npm run build:data`, which
// `npm run typecheck` runs standalone and *before* (see .github/workflows/
// validate.yml). A static `import ... from '../generated/resolved-adm.json'`
// here would make tsc resolve a file that does not exist yet on a fresh
// checkout (TS2307), the same reason none of the other generated/*.json files
// are imported directly by a .ts file in this project -- they are only ever
// imported from .astro frontmatter (excluded from the tsc project; see
// site/tsconfig.json) and handed to this island as a parameter, exactly like
// `liveParameters` below. `ResolvedAdmData` mirrors that pattern.
export interface ResolvedAdmBand {
  value: number | null;
  source: 'district' | 'aoe' | 'unknown';
}

export interface ResolvedAdmData {
  generated?: string;
  entities: Record<string, Record<string, Record<string, ResolvedAdmBand>>>;
}

// The input key carrying the Secretary of Education's statewide average
// determination on each year's parameter set. Matches the key used in the
// fyNNNN.yaml `inputs:` blocks and the golden fixtures.
const STATEWIDE_AVERAGE_KEY = 'statewide_average_per_pupil';

interface RawParameterSet {
  fiscal_year: number;
  status: 'draft' | 'verified' | 'superseded';
  note: string | null;
  parameters: Parameter[];
  // Published inputs (e.g. the statewide average) the formula consumes,
  // distinct from statutory parameters. Absent on the empty fallbacks
  // constructed in code.
  inputs?: PublishedInput[];
  // Present on the sets read from parameters.json; absent on the empty
  // fallbacks constructed in code. `file` is the source path, used to keep
  // this tool to the main-formula year files; `unverified_count` drives the
  // honest per-year label in the picker.
  file?: string;
  unverified_count?: number;
}

// The published statewide-average figure on a set, or null when the year's
// determination is not yet on file (its `inputs` value is null, or absent).
function publishedStatewideAverage(set: RawParameterSet | undefined): number | null {
  const entry = set?.inputs?.find((i) => i.key === STATEWIDE_AVERAGE_KEY);
  return entry?.value ?? null;
}

// The what-if tool drives the main pupil-weighting and tax-rate formula, whose
// parameter files are named fyNNNN.yaml, one per fiscal year. Suffixed variants
// (e.g. fy2030-small-sparse.yaml) parameterise their own tools and pages, so
// they are not offered here even though the build bundles them into the same
// parameters.json. A set with no file recorded is kept rather than dropped.
const MAIN_FORMULA_FILE = /(?:^|\/)fy\d{4}\.yaml$/;

function liveSets(sets: RawParameterSet[]): RawParameterSet[] {
  return sets
    .filter((s) => s.file === undefined || MAIN_FORMULA_FILE.test(s.file))
    .sort((a, b) => b.fiscal_year - a.fiscal_year);
}

// One label per live option. It states the year's own status rather than a
// single blanket caveat: a year with unverified numbers says how many, a
// verified year says so, and everything else reads as draft.
function liveLabel(set: RawParameterSet): string {
  const n = set.unverified_count ?? 0;
  const detail =
    n > 0
      ? `${n} number${n === 1 ? '' : 's'} not checked yet`
      : set.status === 'verified'
        ? 'verified'
        : 'draft';
  return `Live — FY${set.fiscal_year} (${detail})`;
}

function toParameterSet(raw: RawParameterSet): ParameterSet {
  return {
    fiscal_year: raw.fiscal_year,
    status: raw.status,
    note: raw.note,
    parameters: new Map(raw.parameters.map((p) => [p.key, p])),
    inputs: new Map((raw.inputs ?? []).map((i) => [i.key, i])),
  };
}

const SYNTHETIC_CITATION = {
  statute: 'SYNTHETIC TEST FIXTURE — not a statutory value and not Vermont law',
  session_law: null,
  source_url: null,
  quote: null,
  verified: true,
  verified_date: '2000-01-01',
  verified_by: 'illustrative example',
} as const;

// The Example mode's parameters. Exported so a test can run the same
// computation the island runs: the keys here MUST match every key the engine
// reads, because a single missing key makes lookup() throw MissingParameterError
// mid-walkthrough, and the throw lands inside recompute() after the example
// banner is shown -- so the banner would flip to Example while the previous
// (real) walkthrough stayed frozen on screen. The keys are kept in lockstep with
// a real fyNNNN.yaml file's parameter keys; only the values are synthetic round
// numbers, chosen so a reader can check the arithmetic by hand.
export function exampleParameters(): ParameterSet {
  const entries: Array<[string, number | boolean | null, string, string]> = [
    ['membership.long_term_membership_years', 2, 'years', 'the averaging window'],
    ['membership.hold_harmless_applies', false, 'boolean', 'whether the hold harmless floor applies'],
    // Grade weights are ADDITIVE increments on a base count of 1, so a grades
    // 9-12 weight of 1 makes a secondary pupil count as 2 -- the "high-school
    // weight of exactly 2" the mode's banner promises.
    ['weights.grade.prekindergarten', 0, 'multiplier', 'the prekindergarten weight'],
    ['weights.grade.kindergarten_through_5', 0, 'multiplier', 'the kindergarten-through-5 weight'],
    ['weights.grade.6_through_8', 0.5, 'multiplier', 'the grades 6-8 weight'],
    ['weights.grade.9_through_12', 1, 'multiplier', 'the grades 9-12 weight'],
    ['weights.poverty_185_fpl', 0.5, 'multiplier', 'the poverty weight'],
    ['weights.english_learner', 0.5, 'multiplier', 'the English learner weight'],
    // Every sparsity band, because the user can change density and the engine
    // reads whichever band that density falls into.
    ['weights.sparsity.density_under_36', 0.1, 'multiplier', 'the sparsity weight under 36 per sq mi'],
    ['weights.sparsity.density_36_to_55', 0.05, 'multiplier', 'the sparsity weight 36-55 per sq mi'],
    ['weights.sparsity.density_55_to_100', 0, 'multiplier', 'the sparsity weight 55-100 per sq mi'],
    ['weights.small_school.density_ceiling', 50, 'count', 'the small-school density ceiling'],
    ['weights.small_school.enrollment_under_100', 0.2, 'multiplier', 'the small-school weight under 100'],
    ['weights.small_school.enrollment_100_to_250', 0.1, 'multiplier', 'the small-school weight 100-250'],
    ['tax.homestead_base_rate', 1, 'rate_per_100', 'the homestead base rate'],
    ['tax.nonhomestead_base_rate', 1.5, 'rate_per_100', 'the nonhomestead base rate'],
    ['tax.spending_adjustment_floor', 1, 'ratio', 'the spending adjustment floor'],
    // The engine reads the excess-spending threshold as a multiple of the
    // statewide average (see excessSpending in the model), so the example states
    // it that way: a round 1.2 against a round $20,000 average gives a $24,000
    // threshold a reader can check by hand.
    ['tax.excess_spending_threshold_ratio', 1.2, 'ratio', 'the excess spending threshold, as a multiple of the statewide average'],
    ['tax.excess_spending_capital_reserve_multiplier', 1.5, 'multiplier', 'the capital reserve add-on multiplier'],
    ['tax.income_percentage_target', 0.02, 'ratio', 'the income percentage target'],
    ['yield.property_dollar_equivalent', 10_000, 'usd_per_pupil', 'the property yield'],
    ['yield.income_dollar_equivalent', 20_000, 'usd_per_pupil', 'the income yield'],
    ['tax.statewide_adjustment', 1, 'ratio', 'the statewide adjustment'],
  ];

  const parameters = new Map<string, Parameter>();
  for (const [key, value, unit, description] of entries) {
    parameters.set(key, {
      key,
      value,
      unit,
      description,
      citation: SYNTHETIC_CITATION,
      applies_to: null,
      range: null,
      contingent: false,
      is_law: true,
      structural_note: null,
    });
  }
  // The statewide average is a published input, not a rule, so it rides in the
  // set's inputs -- the same slot the live year files use. Giving the example a
  // round synthetic figure lets this mode both auto-fill the field and show a
  // completed excess-spending step, while its SYNTHETIC citation keeps it from
  // ever reading as a real Vermont figure.
  const inputs = new Map<string, PublishedInput>([
    [
      STATEWIDE_AVERAGE_KEY,
      {
        key: STATEWIDE_AVERAGE_KEY,
        value: 20_000,
        unit: 'usd_per_pupil',
        description: 'the statewide average district per pupil education spending',
        citation: SYNTHETIC_CITATION,
      },
    ],
  ]);
  return {
    fiscal_year: 2027,
    status: 'draft',
    note: 'ILLUSTRATIVE EXAMPLE. Not Vermont law.',
    parameters,
    inputs,
  };
}

// --------------------------------------------------------------------------
// Rendering
// --------------------------------------------------------------------------

// Four kinds of blank, four labels. The wording is doing real work: whose
// problem a blank is differs in each case, and a reader who cannot tell them
// apart will read every gap as our incompetence or as the State's.
const STATUS_LABEL: Record<CalcNode['status'], string> = {
  ok: 'computed',
  unverified: 'blocked: parameter unverified',
  missing_input: 'blocked: figure not published',
  undetermined: 'undetermined: the State has not decided',
  not_computable: 'not computable from public data',
  contingent: 'contingent on legislation',
  estimated: 'estimated (from range)',
};

const STATUS_CLASS: Record<CalcNode['status'], string> = {
  ok: 'ok',
  unverified: 'unverified',
  missing_input: 'missing-input',
  undetermined: 'undetermined',
  not_computable: 'not-computable',
  contingent: 'contingent',
  estimated: 'estimated',
};

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Rewrite the grade-entry legends and labels to name the two membership years
// for the selected fiscal year. The markup carries `data-adm-slot="0"` on every
// span that should show the earlier year and `"1"` on every span for the later
// year; this is the one place that fills them in, so the form always agrees with
// the fiscal year the walkthrough is computing.
function setAdmYearLabels(earlierYear: number, laterYear: number): void {
  const byYear: Record<string, number> = { '0': earlierYear, '1': laterYear };
  for (const span of document.querySelectorAll<HTMLElement>('[data-adm-slot]')) {
    const year = byYear[span.dataset.admSlot ?? ''];
    if (year !== undefined) span.textContent = `FY${year}`;
  }
}

function renderWalkthrough(root: CalcNode, container: HTMLElement): void {
  container.replaceChildren();
  const list = el('ol', 'walkthrough');

  for (const { depth, node } of toSteps(root)) {
    const item = el('li', 'step');
    item.style.paddingLeft = `${1 + depth * 0.9}rem`;

    // The step's header (label, status, value) is always visible; its
    // explanation and sources fold away behind a native disclosure, so the
    // resting view is a clean list of steps and the work is one click away.
    const disclosure = el('details', 'step-disclosure');
    const head = el('summary', 'step-head');
    head.append(el('span', 'step-label', node.label));
    head.append(el('span', `tag ${STATUS_CLASS[node.status]}`, STATUS_LABEL[node.status]));
    head.append(el('span', 'step-value', formatValue(node.value, node.unit)));
    const stepBand = formatRange(node.range, node.unit);
    if (stepBand) head.append(el('span', 'step-range', `range ${stepBand}`));
    disclosure.append(head);

    const detail = el('div', 'step-detail');
    detail.append(el('p', 'step-explanation', node.explanation));

    for (const parameter of node.parameters) {
      const cite = el('p', 'step-citation');
      cite.append(document.createTextNode('Parameter: '));
      const code = el('code', undefined, parameter.key);
      cite.append(code);
      cite.append(document.createTextNode(` — ${parameter.citation.statute}`));
      if (!parameter.citation.verified) {
        cite.append(document.createTextNode(' '));
        cite.append(el('span', 'tag unverified', 'not verified'));
      }
      detail.append(cite);
    }

    for (const note of node.notes) detail.append(el('p', 'step-citation', note));

    disclosure.append(detail);
    item.append(disclosure);
    list.append(item);
  }

  container.append(list);
}

/**
 * One blocking item, named and annotated with its estimation range.
 *
 * A blocker's `ref` is the parameter (or input) key, so we lead with it: a
 * reader who only skims wants to know *which* figure is at issue before reading
 * why. A range is what turns a blank into an estimate, so each item reports
 * whether one has been supplied and, if so, its values. Three states matter and
 * must not collapse: no range (nothing to estimate from), a range that still
 * lacks the central value estimation needs, and a range with a central value
 * the engine is already using to carry the figure as an estimate.
 */
function blockerItem(b: Blocker, byKey: Map<string, Parameter>): HTMLElement {
  const li = el('li');
  li.append(el('code', 'blocker-name', b.ref));
  li.append(document.createTextNode(` — ${b.detail}`));

  const param = byKey.get(b.ref);
  const band = param ? formatRange(param.range, param.unit as Unit) : null;
  const range = el('p', 'blocker-range');
  if (band && param?.range?.central !== null && param?.range?.central !== undefined) {
    range.textContent =
      `A range has been supplied — ${band}, central ${formatValue(param.range.central, param.unit as Unit)} — and the engine uses that central value to carry this figure as an estimate until a number is published.`;
  } else if (band) {
    range.textContent =
      `A range has been supplied — ${band} — but it has no central value yet, so it cannot be estimated until one is set.`;
  } else {
    range.textContent =
      'No range has been supplied; one is needed before this item can be estimated.';
  }
  li.append(range);
  return li;
}

function renderBlockers(root: CalcNode, container: HTMLElement): void {
  container.replaceChildren();
  if (root.blockers.length === 0) return;

  const byKey = new Map(collectParameters(root).map((p) => [p.key, p]));

  const box = el('div', 'notice blocking');
  box.append(el('strong', undefined, `${root.blockers.length} thing(s) stand between this scenario and a number`));

  const estimated = root.blockers.filter((b) => b.kind === 'estimated_parameter');
  const contingent = root.blockers.filter((b) => b.kind === 'contingent_parameter');
  const unverified = root.blockers.filter((b) => b.kind === 'unverified_parameter');
  const missing = root.blockers.filter((b) => b.kind === 'missing_input');
  const undetermined = root.blockers.filter((b) => b.kind === 'undetermined_determination');
  const terminal = root.blockers.filter((b) => b.kind === 'not_computable');

  if (estimated.length > 0) {
    box.append(
      el(
        'p',
        undefined,
        `${estimated.length} figure(s) are carried as an estimate from a stated range because no number has been published. The scenario still produces a value; it is labeled an estimate rather than the settled figure.`,
      ),
    );
    const ul = el('ul');
    for (const b of estimated) ul.append(blockerItem(b, byKey));
    box.append(ul);
  }

  if (contingent.length > 0) {
    box.append(
      el(
        'p',
        undefined,
        `${contingent.length} item(s) depend on legislation that has not been enacted, so they are shown as a band rather than a single number.`,
      ),
    );
    const ul = el('ul');
    for (const b of contingent) ul.append(blockerItem(b, byKey));
    box.append(ul);
  }

  if (unverified.length > 0) {
    box.append(
      el(
        'p',
        undefined,
        `${unverified.length} statutory parameter(s) have not been verified against current statute text. This is outstanding work on our side, not a gap in anyone's published data.`,
      ),
    );
    const ul = el('ul');
    for (const b of unverified) ul.append(blockerItem(b, byKey));
    box.append(ul);
  }

  if (missing.length > 0) {
    box.append(
      el(
        'p',
        undefined,
        `${missing.length} figure(s) were not published by the source. These are facts about the documents, not about our progress.`,
      ),
    );
    const ul = el('ul');
    for (const b of missing) ul.append(blockerItem(b, byKey));
    box.append(ul);
  }

  if (undetermined.length > 0) {
    box.append(
      el(
        'p',
        undefined,
        `${undetermined.length} item(s) wait on a decision the State has not made. Nobody has failed to publish these — there is nothing yet to publish.`,
      ),
    );
    const ul = el('ul');
    for (const b of undetermined) ul.append(blockerItem(b, byKey));
    box.append(ul);
  }

  if (terminal.length > 0) {
    box.append(
      el(
        'p',
        undefined,
        `${terminal.length} item(s) cannot be answered from public data at all. These are final answers rather than outstanding work, and no amount of further effort here turns them into figures.`,
      ),
    );
    const ul = el('ul');
    for (const b of terminal) ul.append(blockerItem(b, byKey));
    box.append(ul);
  }

  container.append(box);
}

function renderCitations(root: CalcNode, container: HTMLElement): void {
  container.replaceChildren();
  const parameters = collectParameters(root);
  if (parameters.length === 0) return;

  const table = el('table');
  const thead = el('thead');
  thead.innerHTML = '<tr><th scope="col">Parameter</th><th scope="col">Value</th><th scope="col">Authority</th><th scope="col">Verified</th></tr>';
  table.append(thead);

  const tbody = el('tbody');
  for (const p of parameters) {
    const row = el('tr');
    const key = el('td');
    key.append(el('code', undefined, p.key));
    row.append(key);
    row.append(el('td', 'numeric', p.value === null ? '—' : String(p.value)));
    row.append(el('td', undefined, p.citation.statute));
    const verified = el('td');
    verified.append(
      p.citation.verified
        ? el('span', 'tag ok', p.citation.verified_date ?? 'verified')
        : el('span', 'tag unverified', 'not verified'),
    );
    row.append(verified);
    tbody.append(row);
  }
  table.append(tbody);

  const wrap = el('div', 'scroll-x');
  wrap.append(table);
  container.append(wrap);
}

function renderAssumptions(container: HTMLElement): void {
  container.replaceChildren();
  const table = el('table');
  const thead = el('thead');
  thead.innerHTML = '<tr><th scope="col">Assumption</th><th scope="col">Default</th><th scope="col">Why this default</th></tr>';
  table.append(thead);

  const tbody = el('tbody');
  for (const a of defaultAssumptions()) {
    const row = el('tr');
    row.append(el('td', undefined, a.label));
    row.append(el('td', 'numeric', String(a.value)));
    row.append(el('td', undefined, a.rationale));
    tbody.append(row);
  }
  table.append(tbody);

  const wrap = el('div', 'scroll-x');
  wrap.append(table);
  container.append(wrap);
}

function renderStudentSummary(membership: MembershipResult, container: HTMLElement): void {
  container.replaceChildren();
  for (const section of studentSummarySections(membership)) {
    container.append(el('h3', 'student-summary-heading', section.heading));
    const dl = el('dl', 'facts');
    for (const row of section.rows) {
      dl.append(el('dt', undefined, row.label));
      const dd = el('dd');
      dd.append(document.createTextNode(formatValue(row.node.value, row.node.unit) + ' '));
      dd.append(el('span', `tag ${STATUS_CLASS[row.node.status]}`, STATUS_LABEL[row.node.status]));
      const factBand = formatRange(row.node.range, row.node.unit);
      if (factBand) dd.append(el('span', 'fact-range', ` (range ${factBand})`));
      dl.append(dd);
    }
    container.append(dl);
  }
}

// --------------------------------------------------------------------------
// Wiring
// --------------------------------------------------------------------------

function numberField(id: string): number | null {
  const element = document.getElementById(id) as HTMLInputElement | null;
  if (!element) return null;
  if (element.value.trim() === '') return null;
  const value = Number(element.value);
  return Number.isFinite(value) ? value : null;
}

function textField(id: string): string | null {
  const element = document.getElementById(id) as HTMLInputElement | null;
  if (!element) return null;
  return element.value.trim();
}

// Read every shareable field's current value into a Scenario keyed by DOM id.
// Reads `.value`, which works for both the <input> fields and the <select>
// mode picker. Blank fields are omitted, so the link carries only what the
// user actually entered.
function readScenario(): Scenario {
  const scenario: Scenario = {};
  for (const { id } of SHARE_FIELDS) {
    const element = document.getElementById(id) as
      | HTMLInputElement
      | HTMLSelectElement
      | null;
    if (element && element.value.trim() !== '') scenario[id] = element.value;
  }
  return scenario;
}

// Write a decoded Scenario back into the form. Only fields the scenario carries
// are touched, so a partial link leaves the untouched fields at their HTML
// defaults. Setting a <select> to a value with no matching option is a no-op in
// the browser, so a link naming a fiscal year that is no longer built simply
// leaves the picker on its default -- recompute() then reports honestly that no
// parameter file is available rather than inventing one.
function applyScenario(scenario: Scenario): void {
  for (const { id } of SHARE_FIELDS) {
    const value = scenario[id];
    if (value === undefined) continue;
    const element = document.getElementById(id) as
      | HTMLInputElement
      | HTMLSelectElement
      | null;
    if (element) element.value = value;
  }
}

export function initModelTool(
  liveParameters: RawParameterSet[],
  resolvedAdmData: ResolvedAdmData = { entities: {} },
): void {
  const modeSelect = document.getElementById('parameter-mode') as HTMLSelectElement | null;
  const walkthrough = document.getElementById('walkthrough');
  const blockers = document.getElementById('blockers');
  const citations = document.getElementById('citations');
  const assumptions = document.getElementById('assumptions');
  const exampleWarning = document.getElementById('example-warning');
  const summary = document.getElementById('summary');
  const studentSummary = document.getElementById('student-summary');
  const fy2025Total = document.getElementById('fy2025-total');
  const fy2026Total = document.getElementById('fy2026-total');
  const priorYearGroup = document.getElementById('prior-year-group');

  if (!walkthrough || !blockers || !citations || !assumptions || !summary) return;

  renderAssumptions(assumptions);

  // Build the picker from the parameter sets themselves: one option per live
  // fiscal year (newest first, so the most recent year is the default), then
  // the example. Nothing here names a year, so adding fy2028.yaml to the build
  // makes it selectable with no change to this file.
  const sets = liveSets(liveParameters);
  if (modeSelect) {
    modeSelect.replaceChildren();
    for (const set of sets) {
      const option = document.createElement('option');
      option.value = String(set.fiscal_year);
      option.textContent = liveLabel(set);
      modeSelect.append(option);
    }
    const example = document.createElement('option');
    example.value = 'example';
    example.textContent = 'Example (not real Vermont law)';
    modeSelect.append(example);
  }

  // A plain tally of the grade-band counts typed for one year, shown inside its
  // fieldset. Independent of the parameter set, so it runs at the top of every
  // recompute and stays honest about blanks: one empty band leaves the year's
  // total unknown rather than reporting a partial sum as a headcount.
  const showYearTotal = (element: HTMLElement | null, ids: readonly string[]): void => {
    if (!element) return;
    const total = enteredYearTotal(ids.map((id) => numberField(id)));
    element.textContent =
      total === null
        ? 'Total entered: — (enter all four grades)'
        : `Total entered: ${formatValue(total, 'pupils')} students`;
  };

  const recompute = (): void => {
    const useExample = modeSelect?.value === 'example';
    if (exampleWarning) exampleWarning.hidden = !useExample;

    showYearTotal(fy2025Total, ['prek-1', 'k5-1', 'g68-1', 'g912-1']);
    showYearTotal(fy2026Total, ['prek-2', 'k5-2', 'g68-2', 'g912-2']);

    const selectedYear = Number(modeSelect?.value);
    const parameters = useExample
      ? exampleParameters()
      : toParameterSet(
          liveParameters.find((p) => p.fiscal_year === selectedYear) ?? {
            fiscal_year: selectedYear,
            status: 'draft',
            note: null,
            parameters: [],
          },
        );

    // The two average-daily-membership years are the selected fiscal year and
    // the one before it (16 V.S.A. § 4001(7)). Both the form's grade-entry
    // legends/labels and the walkthrough's per-year steps read from this pair,
    // so the year the user is entering figures for tracks the picker instead of
    // sitting on whatever year was hardcoded when the form was written.
    const laterYear = parameters.fiscal_year;
    const earlierYear = laterYear - 1;
    setAdmYearLabels(earlierYear, laterYear);

    // Last year's weighted membership is only asked for where § 4010(e) binds;
    // the parameter file says whether it does. Hiding the field elsewhere keeps
    // an inert input off the form, and — because it is hidden, not just ignored —
    // a figure left over from a floor year cannot silently ride along into a year
    // the floor is off.
    const floorApplies =
      parameters.parameters.get('membership.hold_harmless_applies')?.value === true;
    if (priorYearGroup) priorYearGroup.hidden = !floorApplies;

    if (parameters.parameters.size === 0) {
      walkthrough.replaceChildren();
      if (studentSummary) studentSummary.replaceChildren();
      summary.textContent = 'No parameter file is available to compute with.';
      return;
    }

    const ctx = createContext(parameters);

    const smallSchoolName = textField('small-school-name');
    const smallSchoolEnrollment = numberField('small-school-enrollment');

    const membership = computeWeightedMembership(ctx, {
      entity: 'ud/illustrative',
      adm_years: [
        {
          fiscal_year: earlierYear,
          prekindergarten: numberField('prek-1'),
          kindergarten_through_5: numberField('k5-1'),
          grades_6_through_8: numberField('g68-1'),
          grades_9_through_12: numberField('g912-1'),
        },
        {
          fiscal_year: laterYear,
          prekindergarten: numberField('prek-2'),
          kindergarten_through_5: numberField('k5-2'),
          grades_6_through_8: numberField('g68-2'),
          grades_9_through_12: numberField('g912-2'),
        },
      ],
      state_placed_fte: numberField('state-placed'),
      poverty_185_fpl: numberField('econ'),
      english_learners: numberField('el'),
      persons_per_square_mile: numberField('density'),
      // Only consult last year's figure where the floor is in force; in other
      // years it plays no part and the field is hidden, so we do not read it.
      prior_year_weighted_membership: floorApplies ? numberField('prior-year-membership') : null,
      // A school with no name is no school. An unnamed row would otherwise
      // become a weight applied to an anonymous entity in the walkthrough.
      small_schools:
        smallSchoolName !== null && smallSchoolName !== ''
          ? [{ name: smallSchoolName, average_two_year_enrollment: smallSchoolEnrollment }]
          : [],
      source: 'figures entered by you in this form',
    });

    if (studentSummary) renderStudentSummary(membership, studentSummary);

    const spending = input(ctx, 'Education spending', numberField('spending'), 'usd', {
      source: 'figures entered by you in this form',
    });
    const perPupil = perWeightedPupil(ctx, spending, membership.total);
    const rate = townRate(
      ctx,
      perPupil,
      {
        town: 'your town',
        cla: numberField('cla'),
        cla_source: 'figure entered by you in this form',
      },
      // The Secretary of Education's statewide average determination, not a
      // figure the user is supposing about their own district. When the selected
      // year has it on file the field is pre-filled from that published input
      // (see applyStatewidePrefill); otherwise it is blank, which is null, which
      // surfaces as a missing_input blocker in excessSpending rather than a
      // fabricated statewide number.
      numberField('statewide-avg'),
      // Act 183 adjustments to the excess spending comparison. Blank means the
      // district has none, so the comparison is just its per pupil spending.
      {
        capitalReserveFivePlusYears: numberField('capital-reserve'),
        bondExclusionPreJuly2024: numberField('bond-exclusion'),
        weightedMembership: membership.total,
      },
    );

    renderWalkthrough(rate.billedRate, walkthrough);
    renderBlockers(rate.billedRate, blockers);
    renderCitations(rate.billedRate, citations);

    summary.replaceChildren();
    const results: Array<[string, CalcNode]> = [
      ['Weighted long-term membership', membership.total],
      ['Education spending per weighted pupil', perPupil],
      ['Equalized homestead rate', rate.equalizedRate],
      ['Homestead rate as billed', rate.billedRate],
    ];
    const dl = el('dl', 'facts');
    for (const [label, node] of results) {
      dl.append(el('dt', undefined, label));
      const dd = el('dd');
      dd.append(document.createTextNode(formatValue(node.value, node.unit) + ' '));
      dd.append(el('span', `tag ${STATUS_CLASS[node.status]}`, STATUS_LABEL[node.status]));
      const factBand = formatRange(node.range, node.unit);
      if (factBand) dd.append(el('span', 'fact-range', ` (range ${factBand})`));
      dl.append(dd);
    }
    summary.append(dl);
  };

  // Offer the selected year's published statewide average, without ever
  // overwriting a figure the user typed. The decision lives in a pure, tested
  // helper; this is the DOM glue around it. It runs on year changes and once at
  // startup -- never on plain input, so a value the user is typing stands.
  const statewideField = document.getElementById('statewide-avg') as HTMLInputElement | null;
  let lastStatewideAutofill: number | null = null;
  const applyStatewidePrefill = (): void => {
    if (!statewideField) return;
    const published =
      modeSelect?.value === 'example'
        ? (exampleParameters().inputs.get(STATEWIDE_AVERAGE_KEY)?.value ?? null)
        : publishedStatewideAverage(
            liveParameters.find((p) => p.fiscal_year === Number(modeSelect?.value)),
          );
    const result = nextStatewideAverage(published, statewideField.value, lastStatewideAutofill);
    if (result !== null) {
      statewideField.value = result.field;
      lastStatewideAutofill = result.autofilled;
    }
  };

  // Load-a-district ADM prefill. Mirrors the statewide-average prefill: it fills
  // a field only when the user has not already typed one, and it records what it
  // autofilled so a later prefill can replace its own value but never the user's.
  const entities = resolvedAdmData.entities ?? {};
  const loadEntity = document.getElementById('load-entity') as HTMLSelectElement | null;
  const loadYear = document.getElementById('load-year') as HTMLSelectElement | null;
  const SOURCE_TEXT: Record<string, string> = {
    district: 'from the district’s budget',
    aoe: 'from the state AOE count',
    unknown: 'not available',
  };
  const BAND_FIELD: Record<string, string> = {
    prekindergarten: 'prek', kindergarten_through_5: 'k5', grades_6_through_8: 'g68', grades_9_through_12: 'g912',
  };
  const autofilledAdm = new Set<string>();

  const fillBandRow = (band: Record<string, ResolvedAdmBand> | undefined, slot: '1' | '2'): void => {
    for (const [key, prefix] of Object.entries(BAND_FIELD)) {
      const id = `${prefix}-${slot}`;
      const field = document.getElementById(id) as HTMLInputElement | null;
      const note = document.querySelector<HTMLElement>(`[data-adm-source="${id}"]`);
      if (!field) continue;
      const resolved = band?.[key];
      // Never overwrite a value the user typed (one we did not autofill).
      const userTyped = field.value !== '' && !autofilledAdm.has(id);
      if (!userTyped && resolved && resolved.value !== null) {
        field.value = String(resolved.value);
        autofilledAdm.add(id);
      } else if (!userTyped) {
        field.value = '';
        autofilledAdm.delete(id);
      }
      if (note) note.textContent = resolved ? SOURCE_TEXT[resolved.source] ?? '' : '';
    }
  };

  const applyAdmPrefill = (): void => {
    const entity = loadEntity?.value ?? '';
    const year = loadYear?.value ?? '';
    if (!entity || !year || !entities[entity]?.[year]) return;
    fillBandRow(entities[entity]?.[String(Number(year) - 1)], '1');
    fillBandRow(entities[entity]?.[year], '2');
    recompute();
  };

  // Populate the entity options (sorted), and the year options for the chosen entity.
  for (const slug of Object.keys(entities).sort()) {
    const opt = document.createElement('option');
    opt.value = slug; opt.textContent = slug;
    loadEntity?.append(opt);
  }
  loadEntity?.addEventListener('change', () => {
    if (!loadYear) return;
    loadYear.replaceChildren(new Option('— none —', ''));
    for (const y of Object.keys(entities[loadEntity.value] ?? {}).sort()) loadYear.append(new Option(`FY${y}`, y));
    applyAdmPrefill();
  });
  loadYear?.addEventListener('change', applyAdmPrefill);

  document.getElementById('scenario-form')?.addEventListener('input', recompute);
  modeSelect?.addEventListener('change', () => {
    applyStatewidePrefill();
    recompute();
  });

  // Build a link that reproduces the current form and copy it to the clipboard.
  // The address bar is left untouched while editing; the link is produced only
  // on click. When the clipboard API is unavailable (insecure context, denied
  // permission) the URL is shown in the status line so it can be copied by hand.
  const shareButton = document.getElementById('share-link');
  const shareStatus = document.getElementById('share-status');
  shareButton?.addEventListener('click', () => {
    const base = window.location.origin + window.location.pathname;
    const url = shareUrl(base, readScenario());
    const clipboard = navigator.clipboard;
    if (clipboard) {
      clipboard.writeText(url).then(
        () => {
          if (shareStatus) shareStatus.textContent = 'Link copied to clipboard';
        },
        () => {
          if (shareStatus) shareStatus.textContent = url;
        },
      );
    } else if (shareStatus) {
      shareStatus.textContent = url;
    }
  });

  // A shared link carries a scenario in the query string. Apply it after the
  // picker options exist (so the mode <select> can adopt the shared year) and
  // before applyStatewidePrefill (so a statewide-average carried in the link
  // counts as user-entered and the prefill leaves it alone). Fields the link
  // omits keep their HTML defaults.
  applyScenario(decodeScenario(window.location.search));

  applyStatewidePrefill();
  recompute();
}
