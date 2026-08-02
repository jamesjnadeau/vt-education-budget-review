/**
 * The auto-fill/override rule for the statewide-average field.
 *
 * The statewide average district per pupil education spending is a figure the
 * Secretary of Education determines each year (32 V.S.A. § 5401(12)), carried on
 * the parameter set as a published input. When the selected fiscal year has one
 * on file, the field offers it so the user need not hunt it down -- but a figure
 * the user typed is theirs, and switching years must never overwrite it.
 *
 * Pure by design: the island reads the DOM, calls this, and writes the DOM back.
 */

export interface StatewideAverageResult {
  /** The text to place in the field. */
  readonly field: string;
  /** The value now standing as the auto-fill, or null when the field is cleared. */
  readonly autofilled: number | null;
}

/**
 * Decide what the statewide-average field should become after the fiscal year
 * changes. Returns null to mean "leave the field alone" -- the user owns it.
 *
 * @param published     the selected year's published figure, or null if none
 * @param currentField  the field's current text
 * @param lastAutofilled the value this function last placed, or null if it never
 *                       did or the user has since overridden it
 */
export function nextStatewideAverage(
  published: number | null,
  currentField: string,
  lastAutofilled: number | null,
): StatewideAverageResult | null {
  const current = currentField.trim();

  // A non-empty field that does not match what we last auto-filled is the
  // user's own figure. Leave it, whichever year they move to.
  const userOwns = current !== '' && (lastAutofilled === null || current !== String(lastAutofilled));
  if (userOwns) return null;

  // Otherwise the field is empty or still holds our last suggestion, so it is
  // ours to set. A year with no published figure clears it back to blank --
  // last year's number is wrong for this year, and blank is the honest state
  // that surfaces the missing-input blocker.
  if (published === null) return { field: '', autofilled: null };
  return { field: String(published), autofilled: published };
}
