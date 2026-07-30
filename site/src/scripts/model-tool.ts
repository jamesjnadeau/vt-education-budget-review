/**
 * The modeling island.
 *
 * Runs the engine in the browser against the same parameter files the build
 * pipeline uses. Its job is to make the arithmetic legible, which means the
 * walkthrough is not a summary of the calculation -- it is the calculation's
 * own tree, rendered node by node.
 *
 * Two parameter sets are selectable, and the distinction is enforced visually
 * rather than left to a footnote:
 *
 *   live      the real FY2027 file. Every value is null and every citation
 *             unverified, so the engine declines to compute and the tool shows
 *             precisely which parameter blocked each step.
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
  formatValue,
  input,
  perWeightedPupil,
  toSteps,
  townRate,
  type CalcNode,
  type Parameter,
  type ParameterSet,
} from '@vt-budget/model';

interface RawParameterSet {
  fiscal_year: number;
  status: 'draft' | 'verified' | 'superseded';
  note: string | null;
  parameters: Parameter[];
}

function toParameterSet(raw: RawParameterSet): ParameterSet {
  return {
    fiscal_year: raw.fiscal_year,
    status: raw.status,
    note: raw.note,
    parameters: new Map(raw.parameters.map((p) => [p.key, p])),
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

function exampleParameters(): ParameterSet {
  const entries: Array<[string, number | null, string, string]> = [
    ['membership.averaging_years', 2, 'years', 'the averaging window'],
    ['weights.grade.prek', 1, 'multiplier', 'the prekindergarten weight'],
    ['weights.grade.elementary', 1, 'multiplier', 'the elementary weight'],
    ['weights.grade.secondary', 2, 'multiplier', 'the secondary weight'],
    ['weights.economically_deprived', 0.5, 'multiplier', 'the economic deprivation weight'],
    ['weights.english_learner', 0.25, 'multiplier', 'the English learner weight'],
    ['weights.english_learner_newcomer_slife', 0.5, 'multiplier', 'the Newcomer/SLIFE weight'],
    ['weights.sparsity', 0.1, 'multiplier', 'the sparsity weight'],
    ['weights.small_school', 0.2, 'multiplier', 'the small school weight'],
    ['yield.property_dollar_equivalent', 10_000, 'usd_per_pupil', 'the property yield'],
    ['yield.income_dollar_equivalent', 20_000, 'usd_per_pupil', 'the income yield'],
    ['tax.excess_spending_threshold', 25_000, 'usd_per_pupil', 'the excess spending threshold'],
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
    });
  }
  return {
    fiscal_year: 2027,
    status: 'draft',
    note: 'ILLUSTRATIVE EXAMPLE. Not Vermont law.',
    parameters,
  };
}

// --------------------------------------------------------------------------
// Rendering
// --------------------------------------------------------------------------

const STATUS_LABEL: Record<CalcNode['status'], string> = {
  ok: 'computed',
  unverified: 'blocked: parameter unverified',
  missing_input: 'blocked: figure not published',
  contingent: 'contingent on legislation',
};

const STATUS_CLASS: Record<CalcNode['status'], string> = {
  ok: 'ok',
  unverified: 'unverified',
  missing_input: 'missing-input',
  contingent: 'contingent',
};

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderWalkthrough(root: CalcNode, container: HTMLElement): void {
  container.replaceChildren();
  const list = el('ol', 'walkthrough');

  for (const { depth, node } of toSteps(root)) {
    const item = el('li', 'step');
    item.style.paddingLeft = `${1 + depth * 0.9}rem`;

    const head = el('div', 'step-head');
    head.append(el('span', 'step-label', node.label));
    head.append(el('span', `tag ${STATUS_CLASS[node.status]}`, STATUS_LABEL[node.status]));
    head.append(el('span', 'step-value', formatValue(node.value, node.unit)));
    item.append(head);

    item.append(el('p', 'step-explanation', node.explanation));

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
      item.append(cite);
    }

    for (const note of node.notes) item.append(el('p', 'step-citation', note));

    list.append(item);
  }

  container.append(list);
}

function renderBlockers(root: CalcNode, container: HTMLElement): void {
  container.replaceChildren();
  if (root.blockers.length === 0) return;

  const box = el('div', 'notice blocking');
  box.append(el('strong', undefined, `${root.blockers.length} thing(s) stand between this scenario and a number`));

  const unverified = root.blockers.filter((b) => b.kind === 'unverified_parameter');
  const missing = root.blockers.filter((b) => b.kind === 'missing_input');

  if (unverified.length > 0) {
    box.append(
      el(
        'p',
        undefined,
        `${unverified.length} statutory parameter(s) have not been verified against current statute text. This is outstanding work on our side, not a gap in anyone's published data.`,
      ),
    );
    const ul = el('ul');
    for (const b of unverified) ul.append(el('li', undefined, b.detail));
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
    for (const b of missing) ul.append(el('li', undefined, b.detail));
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

export function initModelTool(liveParameters: RawParameterSet[]): void {
  const modeSelect = document.getElementById('parameter-mode') as HTMLSelectElement | null;
  const walkthrough = document.getElementById('walkthrough');
  const blockers = document.getElementById('blockers');
  const citations = document.getElementById('citations');
  const assumptions = document.getElementById('assumptions');
  const exampleWarning = document.getElementById('example-warning');
  const summary = document.getElementById('summary');

  if (!walkthrough || !blockers || !citations || !assumptions || !summary) return;

  renderAssumptions(assumptions);

  const recompute = (): void => {
    const useExample = modeSelect?.value === 'example';
    if (exampleWarning) exampleWarning.hidden = !useExample;

    const parameters = useExample
      ? exampleParameters()
      : toParameterSet(
          liveParameters.find((p) => p.fiscal_year === 2027) ?? {
            fiscal_year: 2027,
            status: 'draft',
            note: null,
            parameters: [],
          },
        );

    if (parameters.parameters.size === 0) {
      walkthrough.replaceChildren();
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
          fiscal_year: 2025,
          prekindergarten: numberField('prek-1'),
          kindergarten_through_5: numberField('k5-1'),
          grades_6_through_8: numberField('g68-1'),
          grades_9_through_12: numberField('g912-1'),
        },
        {
          fiscal_year: 2026,
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
      // A school with no name is no school. An unnamed row would otherwise
      // become a weight applied to an anonymous entity in the walkthrough.
      small_schools:
        smallSchoolName !== null && smallSchoolName !== ''
          ? [{ name: smallSchoolName, average_two_year_enrollment: smallSchoolEnrollment }]
          : [],
      source: 'figures entered by you in this form',
    });

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
      // No illustrative default exists for this field (see the form): it is the
      // Secretary of Education's statewide average determination, not a figure
      // the user is supposing about their own district. Left blank it is null,
      // which surfaces as a missing_input blocker in excessSpending rather than
      // a fabricated statewide number.
      numberField('statewide-avg'),
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
      dl.append(dd);
    }
    summary.append(dl);
  };

  document.getElementById('scenario-form')?.addEventListener('input', recompute);
  modeSelect?.addEventListener('change', recompute);
  recompute();
}
