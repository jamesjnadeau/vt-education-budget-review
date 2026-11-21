/**
 * The combiner island: DOM glue for the /combiner page.
 *
 * Everything that decides what runs, what is refused and what words are shown
 * lives in combiner-view.ts and combiner-share.ts, where it is unit-tested.
 * This file reads the form, keeps the list of picked districts, calls
 * `planCombiner` and `runCombiner`, and draws the result. The walkthrough is
 * model-tool.ts's own `renderWalkthrough`, so a combined rate's math looks the
 * same as a single district's on /model.
 *
 * The rules it keeps:
 *   - No colour says good or bad. A change is a signed number and the words
 *     "goes up", "goes down" or "no change", the same way in both directions.
 *   - Nothing is ranked or called good or bad.
 *   - A blank is named, never filled in. A district that cannot be combined is
 *     disabled in the picker with its reason; one that arrives anyway (from a
 *     grouping or a link) is named in the result instead of being run.
 */

import { formatValue, runCombiner, type CalcNode, type CombinerResult, type CombinerTownRow } from '@vt-budget/model';

import {
  SUPPORTED_YEARS,
  decodeCombiner,
  linkFigureNote,
  shareCombinerUrl,
  unknownDistrictNote,
  type CombinerShareState,
  type LinkNote,
} from './combiner-share.ts';
import {
  admScale,
  admScaleText,
  blockerList,
  changeText,
  nameOf,
  plainText,
  planCombiner,
  rateText,
  resultStatus,
  type CombinerData,
  type CombinerDistrict,
} from './combiner-view.ts';
import {
  liveSets,
  publishedStatewideAverage,
  renderWalkthrough,
  statusClass,
  statusLabel,
  toParameterSet,
  type RawParameterSet,
} from './model-tool.ts';
import { nextStatewideAverage } from './statewide-average.ts';

/** The form's text fields, by share-state key and DOM id. */
const TEXT_INPUTS = [
  ['factor', 'combiner-factor'],
  ['act84', 'combiner-act84'],
  ['density', 'combiner-density'],
  ['statePlaced', 'combiner-state-placed'],
  ['poverty', 'combiner-poverty'],
  ['el', 'combiner-el'],
  ['school', 'combiner-school'],
  ['enrollment', 'combiner-enrollment'],
  ['avg', 'combiner-avg'],
] as const;

const DEFAULTS = { factor: '1', act84: '0' } as const;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/** A value and, when it is not a plain computed number, the tag saying what kind of blank it is. */
function valueWithStatus(node: CalcNode): HTMLElement {
  const span = el('span');
  span.append(document.createTextNode(formatValue(node.value, node.unit)));
  if (node.status !== 'ok') {
    span.append(document.createTextNode(' '));
    span.append(el('span', `tag ${statusClass(node)}`, statusLabel(node)));
  }
  return span;
}

function list(items: readonly string[], className?: string): HTMLUListElement {
  const ul = el('ul', className);
  for (const item of items) ul.append(el('li', undefined, item));
  return ul;
}

function notice(title: string, items: readonly string[], blocking: boolean): HTMLElement {
  const box = el('div', blocking ? 'notice blocking' : 'notice');
  box.append(el('strong', undefined, title));
  if (items.length > 0) box.append(list(items));
  return box;
}

/** A notice about a link, with its lead sentence between the title and the list. */
function linkNotice(note: LinkNote, blocking: boolean): HTMLElement {
  const box = el('div', blocking ? 'notice blocking' : 'notice');
  box.append(el('strong', undefined, note.title));
  if (note.lead !== '') box.append(el('p', undefined, note.lead));
  if (note.items.length > 0) box.append(list(note.items));
  return box;
}

/** "Burlington, South Burlington, Winooski" or "A, B, C and 13 more". */
function memberPreview(members: readonly string[], data: CombinerData): string {
  const names = members.map((m) => nameOf(m, data));
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
}

export function initCombinerTool(rawSets: RawParameterSet[], data: CombinerData): void {
  const form = byId<HTMLFormElement>('combiner-form');
  const result = byId<HTMLElement>('combiner-result');
  if (!form || !result) return;

  const live = liveSets(rawSets);
  const knownSlugs = new Set(Object.keys(data.districts));
  let picked: string[] = [];

  // --- Year ----------------------------------------------------------------
  const yearSelect = byId<HTMLSelectElement>('combiner-year');
  const years = [...new Set([...live.map((s) => s.fiscal_year), ...SUPPORTED_YEARS])].sort((a, b) => a - b);
  if (yearSelect) {
    yearSelect.replaceChildren();
    for (const year of years) {
      const runnable = SUPPORTED_YEARS.has(year) && year === data.fiscal_year;
      const option = el('option', undefined, runnable ? `FY${year}` : `FY${year} (not ready yet)`);
      option.value = String(year);
      option.disabled = !runnable;
      yearSelect.append(option);
    }
    yearSelect.value = String(data.fiscal_year);
  }

  // --- Act 170 groupings ---------------------------------------------------
  const groupingSelect = byId<HTMLSelectElement>('combiner-grouping');
  const groupingStatus = byId<HTMLElement>('combiner-grouping-status');
  if (groupingSelect) {
    for (const g of data.groupings) {
      const blocked = g.members.filter((m) => (data.districts[m]?.blockers.length ?? 1) > 0).length;
      const size = `${g.members.length} district${g.members.length === 1 ? '' : 's'}`;
      const note = blocked > 0 ? `, ${blocked} can’t be combined yet` : '';
      const option = el('option', undefined, `${g.name} (${size}${note}): ${memberPreview(g.members, data)}`);
      option.value = String(g.number);
      groupingSelect.append(option);
    }
    groupingSelect.addEventListener('change', () => {
      const g = data.groupings.find((x) => String(x.number) === groupingSelect.value);
      if (!g) return;
      picked = [...g.members];
      if (groupingStatus) {
        groupingStatus.textContent = `Loaded ${g.name}. You can add or take out districts below.`;
      }
      groupingSelect.value = '';
      update();
    });
  }

  // --- District picker, grouped under each supervisory union ---------------
  const picker = byId<HTMLElement>('combiner-picker');
  const checkboxes = new Map<string, HTMLInputElement>();
  if (picker) {
    const groups = new Map<string, CombinerDistrict[]>();
    for (const d of Object.values(data.districts)) {
      const key = d.su && data.sus[d.su] ? d.su : '';
      groups.set(key, [...(groups.get(key) ?? []), d]);
    }
    const order = [...groups.keys()].sort((a, b) => {
      if (a === '') return 1;
      if (b === '') return -1;
      return (data.sus[a]?.label ?? a).localeCompare(data.sus[b]?.label ?? b);
    });

    picker.replaceChildren();
    for (const key of order) {
      const districts = (groups.get(key) ?? []).sort((a, b) => nameOf(a.entity, data).localeCompare(nameOf(b.entity, data)));
      const ready = districts.filter((d) => d.blockers.length === 0);
      const box = el('details', 'combiner-su');
      const label = key === '' ? 'Not part of a supervisory union' : (data.sus[key]?.label ?? key);
      box.append(el('summary', undefined, `${label} (${ready.length} of ${districts.length} can be combined)`));

      // The spoken name starts with the words on the button, then says which
      // supervisory union, so the 53 buttons are told apart.
      const visible = key === '' ? 'Add every district in this list' : 'Add every district in this supervisory union';
      const addAll = el('button', 'combiner-add-su', visible);
      addAll.type = 'button';
      addAll.setAttribute('aria-label', `${visible}: ${label}`);
      addAll.disabled = ready.length === 0;
      addAll.addEventListener('click', () => {
        for (const d of ready) if (!picked.includes(d.entity)) picked.push(d.entity);
        update();
      });
      box.append(addAll);
      if (ready.length < districts.length) {
        box.append(
          el(
            'p',
            'field-help',
            ready.length === 0
              ? 'None of these districts can be combined yet.'
              : 'This adds only the districts that can be combined. The others are left out.',
          ),
        );
      }

      const ul = el('ul', 'combiner-district-list');
      for (const d of districts) {
        const li = el('li');
        const id = `combiner-pick-${d.entity.replace(/[^a-z0-9]+/gi, '-')}`;
        const input = el('input');
        input.type = 'checkbox';
        input.id = id;
        input.value = d.entity;
        input.disabled = d.blockers.length > 0;
        const reasonId = `${id}-reason`;
        if (input.disabled) input.setAttribute('aria-describedby', reasonId);
        input.addEventListener('change', () => {
          if (input.checked) {
            if (!picked.includes(d.entity)) picked.push(d.entity);
          } else {
            picked = picked.filter((p) => p !== d.entity);
          }
          update();
        });
        checkboxes.set(d.entity, input);
        const lab = el('label', undefined, ` ${nameOf(d.entity, data)}`);
        lab.htmlFor = id;
        li.append(input, lab);
        if (d.blockers.length > 0) {
          li.classList.add('combiner-blocked');
          const reason = el('p', 'field-help', `Can’t be combined yet: ${d.blockers.join(' ')}`);
          reason.id = reasonId;
          li.append(reason);
        }
        ul.append(li);
      }
      box.append(ul);
      picker.append(box);
    }
  }

  // --- The picked list, with a way to take each one out --------------------
  const pickedList = byId<HTMLElement>('combiner-picked');
  const pickedHeading = byId<HTMLElement>('combiner-picked-heading');
  function renderPicked(): void {
    if (!pickedList) return;
    pickedList.replaceChildren();
    if (picked.length === 0) {
      pickedList.append(el('p', 'field-help', 'None yet. Pick districts below, or start from a grouping above.'));
      return;
    }
    const ol = el('ol', 'combiner-picked-list');
    picked.forEach((slug, index) => {
      const li = el('li');
      li.append(el('span', undefined, nameOf(slug, data)));
      const remove = el('button', 'combiner-remove', 'Take out');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Take out ${nameOf(slug, data)}`);
      remove.addEventListener('click', () => {
        picked = picked.filter((p) => p !== slug);
        update();
        // The list was rebuilt, so the pressed button is gone. Keep focus in
        // the list: on the next Take out button, or the one before it, or on
        // the list's heading once the list is empty.
        const buttons = pickedList.querySelectorAll<HTMLButtonElement>('button.combiner-remove');
        const next = buttons[Math.min(index, buttons.length - 1)];
        if (next) next.focus();
        else pickedHeading?.focus();
      });
      li.append(document.createTextNode(' '), remove);
      const d = data.districts[slug];
      if (!d) li.append(el('p', 'field-help', 'This district is not in the data this page was built with.'));
      else if (d.blockers.length > 0) li.append(el('p', 'field-help', `Can’t be combined yet: ${d.blockers.join(' ')}`));
      ol.append(li);
    });
    pickedList.append(ol);
  }

  // --- Which district the small school is in -------------------------------
  const schoolIn = byId<HTMLSelectElement>('combiner-school-in');
  function renderSchoolIn(): void {
    if (!schoolIn) return;
    const keep = schoolIn.value;
    schoolIn.replaceChildren();
    const none = el('option', undefined, '— pick a district —');
    none.value = '';
    schoolIn.append(none);
    for (const slug of picked) {
      const option = el('option', undefined, nameOf(slug, data));
      option.value = slug;
      schoolIn.append(option);
    }
    schoolIn.value = picked.includes(keep) ? keep : '';
  }

  // --- Form <-> state --------------------------------------------------------
  function readState(): CombinerShareState {
    const state: CombinerShareState = {
      year: Number(yearSelect?.value ?? data.fiscal_year),
      districts: [...picked],
      factor: '',
      act84: '',
      density: '',
      statePlaced: '',
      poverty: '',
      el: '',
      school: '',
      enrollment: '',
      schoolIn: schoolIn?.value ?? '',
      avg: '',
    };
    for (const [key, id] of TEXT_INPUTS) state[key] = byId<HTMLInputElement>(id)?.value ?? '';
    return state;
  }

  function applyState(state: CombinerShareState): void {
    picked = [...state.districts];
    for (const [key, id] of TEXT_INPUTS) {
      const input = byId<HTMLInputElement>(id);
      if (input && state[key] !== '') input.value = state[key];
    }
    renderSchoolIn();
    if (schoolIn && state.schoolIn !== '' && picked.includes(state.schoolIn)) schoolIn.value = state.schoolIn;
  }

  // --- Result ---------------------------------------------------------------
  const parameterSet = live.find((s) => s.fiscal_year === data.fiscal_year);
  const params = parameterSet ? toParameterSet(parameterSet) : null;

  const admScaleLine = byId<HTMLElement>('combiner-adm-scale');
  function update(): void {
    for (const [slug, box] of checkboxes) box.checked = picked.includes(slug);
    renderPicked();
    renderSchoolIn();
    if (admScaleLine) admScaleLine.textContent = admScaleText(admScale(picked, data));
    renderResult();
  }

  // The result is rebuilt on every keystroke, so it is not a live region. This
  // one line is, and it changes only when the counts it gives change.
  const resultStatusLine = byId<HTMLElement>('combiner-result-status');
  function announce(text: string): void {
    if (resultStatusLine && resultStatusLine.textContent !== text) resultStatusLine.textContent = text;
  }

  function renderResult(): void {
    if (!result) return;
    result.replaceChildren();
    if (!params) {
      const missing = `This page has no numbers for FY${data.fiscal_year}, so it cannot work anything out.`;
      result.append(notice(missing, [], true));
      announce(missing);
      return;
    }
    const plan = planCombiner(readState(), data);
    if (plan.kind === 'too_few') {
      result.append(el('p', 'combiner-message', plan.message));
      announce(resultStatus(plan, null));
      return;
    }
    if (plan.kind === 'blocked' || plan.kind === 'input') {
      result.append(notice(plan.message, plan.items, true));
      announce(resultStatus(plan, null));
      return;
    }
    const outcome = runCombiner(params, plan.members, plan.options);
    announce(resultStatus(plan, outcome));
    renderSummary(outcome, result);
    renderTowns(outcome, result);
    renderRegister(outcome, result);
  }

  function renderSummary(outcome: CombinerResult, container: HTMLElement): void {
    container.append(el('h3', undefined, 'The combined district'));
    const facts = el('dl', 'facts');
    const fact = (term: string, value: HTMLElement | string) => {
      facts.append(el('dt', undefined, term));
      const dd = el('dd');
      dd.append(value);
      facts.append(dd);
    };
    fact('Districts', String(outcome.members.length));
    fact('Towns', String(outcome.towns.length));
    const scale = admScale(
      outcome.members.map((m) => m.entity),
      data,
    );
    fact(
      `Students, FY${data.fiscal_year} (average daily membership, as published)`,
      scale === null
        ? 'none on file'
        : `${scale.complete ? '' : 'at least '}${Math.round(scale.students).toLocaleString('en-US')}`,
    );
    fact(
      'Students counted for the rate (two-year average, plus state-placed students)',
      valueWithStatus(outcome.pooled.membership.longTermMembership),
    );
    fact('Weighted students', valueWithStatus(outcome.pooled.membership.total));
    fact('Education spending', valueWithStatus(outcome.pooled.spending));
    fact('Spending per weighted student', valueWithStatus(outcome.pooled.perPupil));
    container.append(facts);

    container.append(
      el(
        'p',
        undefined,
        'Spending per weighted student, for each district alone and for all of them combined. ' +
          'This is the number the tax rate is built from.',
      ),
    );
    const wrap = el('div', 'scroll-x');
    const table = el('table', 'combiner-members');
    const head = el('tr');
    for (const [text, numeric] of [
      ['District', false],
      ['Students counted for the rate', true],
      ['Weighted students', true],
      ['Spending per weighted student', true],
    ] as const) {
      const th = el('th', numeric ? 'numeric' : undefined, text);
      th.scope = 'col';
      head.append(th);
    }
    table.appendChild(el('thead')).append(head);
    const body = el('tbody');
    const row = (name: string, cells: CalcNode[], strong = false) => {
      const tr = el('tr', strong ? 'combiner-pooled-row' : undefined);
      const th = el('th', undefined, name);
      th.scope = 'row';
      tr.append(th);
      for (const node of cells) {
        const td = el('td', 'numeric');
        td.append(valueWithStatus(node));
        tr.append(td);
      }
      body.append(tr);
    };
    for (const m of outcome.members) {
      row(nameOf(m.entity, data), [m.membership.longTermMembership, m.membership.total, m.perPupil]);
    }
    row(
      'All of them combined',
      [outcome.pooled.membership.longTermMembership, outcome.pooled.membership.total, outcome.pooled.perPupil],
      true,
    );
    table.append(body);
    wrap.append(table);
    container.append(wrap);

    const math = el('details', 'combiner-math');
    math.append(el('summary', undefined, 'Show the math for the combined district’s spending per weighted student'));
    const holder = el('div');
    math.append(holder);
    math.addEventListener('toggle', () => {
      if (math.open && holder.childElementCount === 0) plainWalkthrough(outcome.pooled.perPupil, holder);
    });
    container.append(math);
  }

  /** The math under one town's row. The rate today is shown only when some town has one. */
  function rowMath(row: CombinerTownRow, holder: HTMLElement, anyToday: boolean): void {
    const sides: Array<[string, CombinerTownRow['pooled']]> = [['Rate if combined', row.pooled]];
    if (anyToday) sides.push([`Rate today, as part of ${nameOf(row.district, data)}`, row.today]);
    for (const [title, side] of sides) {
      holder.append(el('h4', undefined, title));
      if (side === null) {
        holder.append(el('p', undefined, plainText(row.notComputable ?? 'This rate was not worked out.', data)));
        continue;
      }
      const tree = el('div');
      plainWalkthrough(side.billedRate, tree);
      holder.append(tree);
    }
    const published = data.towns[row.town]?.published_homestead_rate ?? null;
    holder.append(el('h4', undefined, 'Published rate (not comparable)'));
    holder.append(
      el(
        'p',
        undefined,
        published === null
          ? 'The State’s published rate for this town is not on file.'
          : `The State published ${formatValue(published, 'rate_per_100')} for ${nameOf(row.town, data)}. ` +
              'It cannot be compared with the rate above, which rests on the figures entered on this page.',
      ),
    );
  }

  /**
   * model-tool's walkthrough, with the engine's slugs ("town/fairfax") read
   * out as names ("Fairfax") so the steps read in plain words.
   */
  function plainWalkthrough(node: Parameters<typeof renderWalkthrough>[0], holder: HTMLElement): void {
    renderWalkthrough(node, holder);
    const walker = document.createTreeWalker(holder, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text !== null; text = walker.nextNode()) {
      const before = text.nodeValue ?? '';
      const after = plainText(before, data);
      if (after !== before) text.nodeValue = after;
    }
  }

  function renderTowns(outcome: CombinerResult, container: HTMLElement): void {
    container.append(el('h3', undefined, 'Each town’s home tax rate'));
    // In this build no member has its own population density, so no town has a
    // rate today and there is no change to show. The columns for them appear
    // only when some town has one, and only then is the change explained.
    const anyToday = outcome.towns.some((r) => r.today !== null);
    container.append(
      el(
        'p',
        undefined,
        'This is the homestead education tax rate. A homestead is the home where you live. The rate is in dollars ' +
          'for each $100 of home value. ' +
          (anyToday
            ? 'Where a town has both, “today” and “if combined” are worked out by this page the same way, so ' +
              'the change comes from combining and the assumptions listed.'
            : 'The rate today is not worked out for any of these towns, so no change is shown.'),
      ),
    );
    container.append(
      el(
        'p',
        'combiner-rate-warning',
        'These rates rest on the figures entered above for the combined district. Small changes in those ' +
          'figures move the rate a lot. They cannot be compared with the rate the State published.',
      ),
    );
    const wrap = el('div', 'scroll-x');
    const table = el('table', 'combiner-towns');
    const head = el('tr');
    const columns: Array<readonly [string, boolean]> = [
      ['Town', false],
      ['District today', false],
      ...(anyToday ? ([['Rate today', true]] as const) : []),
      ['Rate if combined', true],
      ...(anyToday ? ([['Change', false]] as const) : []),
      ['Common level of appraisal', true],
    ];
    for (const [text, numeric] of columns) {
      const th = el('th', numeric ? 'numeric' : undefined, text);
      th.scope = 'col';
      head.append(th);
    }
    table.appendChild(el('thead')).append(head);
    const body = el('tbody');
    // The reason can run to a dozen sentences, so it folds; it is never dropped.
    const why = (text: string): HTMLElement => {
      const fold = el('details', 'combiner-why');
      fold.append(el('summary', undefined, 'Why'));
      fold.append(el('p', 'field-help', plainText(text, data)));
      return fold;
    };
    for (const row of outcome.towns) {
      const tr = el('tr');
      const town = el('th', undefined, nameOf(row.town, data));
      town.scope = 'row';
      tr.append(town);
      tr.append(el('td', undefined, nameOf(row.district, data)));
      if (anyToday) tr.append(el('td', 'numeric', rateText(row.today)));
      const pooledCell = el('td', 'numeric', rateText(row.pooled));
      if (!anyToday && row.pooled === null && row.notComputable) pooledCell.append(why(row.notComputable));
      tr.append(pooledCell);
      if (anyToday) {
        const change = el('td', 'combiner-change', changeText(row));
        if (row.direction === null && row.notComputable) change.append(why(row.notComputable));
        tr.append(change);
      }
      tr.append(el('td', 'numeric', row.cla === null ? 'none on file' : formatValue(row.cla, 'ratio')));
      body.append(tr);

      const mathRow = el('tr', 'combiner-math-row');
      const cell = el('td');
      cell.colSpan = columns.length;
      const details = el('details', 'combiner-math');
      details.append(el('summary', undefined, `Show the math for ${nameOf(row.town, data)}`));
      const holder = el('div');
      details.append(holder);
      details.addEventListener('toggle', () => {
        if (details.open && holder.childElementCount === 0) rowMath(row, holder, anyToday);
      });
      cell.append(details);
      mathRow.append(cell);
      body.append(mathRow);
    }
    table.append(body);
    wrap.append(table);
    container.append(wrap);
  }

  function renderRegister(outcome: CombinerResult, container: HTMLElement): void {
    container.append(el('h3', undefined, 'What we assumed'));
    const assumed = el('ul', 'combiner-assumptions');
    for (const a of outcome.assumptions) {
      const li = el('li');
      li.append(el('strong', undefined, `${a.label}: ${formatValue(a.value, a.unit)}.`));
      li.append(document.createTextNode(` ${plainText(a.rationale, data)}`));
      assumed.append(li);
    }
    container.append(assumed);

    container.append(el('h3', undefined, 'What is missing'));
    const missing = blockerList(outcome, data);
    if (missing.length === 0) {
      container.append(el('p', undefined, 'Nothing. Every number above was worked out.'));
    } else {
      container.append(
        el(
          'p',
          undefined,
          'These figures are blank, so the numbers that need them are not worked out. The page does not ' +
            'fill them in. A line that names one district blocks that district’s rate today.',
        ),
      );
      container.append(list(missing, 'combiner-blockers'));
    }

    if (outcome.caveats.length > 0) {
      container.append(el('h3', undefined, 'Also keep in mind'));
      container.append(list(outcome.caveats.map((c) => plainText(c, data))));
    }
  }

  // --- Load: defaults, then the shared link, then the statewide average ----
  for (const [key, value] of Object.entries(DEFAULTS)) {
    const id = TEXT_INPUTS.find(([k]) => k === key)?.[1];
    const input = id ? byId<HTMLInputElement>(id) : null;
    if (input && input.value === '') input.value = value;
  }

  const linkNotes = byId<HTMLElement>('combiner-link-notes');
  if (location.search !== '') {
    const decoded = decodeCombiner(location.search, knownSlugs);
    applyState(decoded.state);
    if (linkNotes) {
      const unknown = unknownDistrictNote(decoded.unknown);
      if (unknown) linkNotes.append(linkNotice(unknown, true));
      const figures = linkFigureNote(decoded.state, publishedStatewideAverage(parameterSet));
      if (figures) linkNotes.append(linkNotice(figures, false));
      if (decoded.ignoredYear !== null) {
        linkNotes.append(
          notice(
            `This link asked for the year “${decoded.ignoredYear}”. This page can only run FY${data.fiscal_year} for now, so that is shown instead.`,
            [],
            true,
          ),
        );
      }
    }
  }

  const avgInput = byId<HTMLInputElement>('combiner-avg');
  if (avgInput) {
    const next = nextStatewideAverage(publishedStatewideAverage(parameterSet), avgInput.value, null);
    if (next) avgInput.value = next.field;
  }

  // The district checkboxes and the grouping select sit inside the form, and
  // each handles its own events. A checkbox click fires `input` before
  // `change`. If the form's listener ran update() on that `input`, update()
  // would set the box back to the old pick before the checkbox's own handler
  // read it, and the click would be undone. So these two listeners skip them.
  const handledElsewhere = (event: Event): boolean => {
    const target = event.target;
    if (target === groupingSelect) return true;
    return target instanceof Element && target.closest('#combiner-picker') !== null;
  };
  form.addEventListener('input', (event) => {
    if (!handledElsewhere(event)) update();
  });
  form.addEventListener('change', (event) => {
    if (!handledElsewhere(event)) update();
  });
  form.addEventListener('submit', (event) => event.preventDefault());

  // --- Share link --------------------------------------------------------------
  const shareButton = byId<HTMLButtonElement>('combiner-share');
  const shareStatus = byId<HTMLElement>('combiner-share-status');
  shareButton?.addEventListener('click', () => {
    const url = shareCombinerUrl(`${location.origin}${location.pathname}`, readState());
    const clipboard = navigator.clipboard;
    if (clipboard) {
      clipboard.writeText(url).then(
        () => {
          if (shareStatus) shareStatus.textContent = 'Link copied.';
        },
        () => {
          if (shareStatus) shareStatus.textContent = url;
        },
      );
    } else if (shareStatus) {
      shareStatus.textContent = url;
    }
  });

  update();
}
