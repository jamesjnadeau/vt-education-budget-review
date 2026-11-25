import type { Figure } from './journey.ts';

/** The example house the dollar figures are worked out for. */
export const EXAMPLE_HOUSE = 250_000;

// Work in whole ten-thousandths so a half dollar rounds the way people expect.
// Floating point math would turn 3115.5 into 3115.4999.
function tenThousandths(rate: number): number {
  return Math.round(rate * 10_000);
}

function perHundred(rate: number): string {
  const u = tenThousandths(rate);
  return `$${Math.floor(u / 10_000)}.${String(u % 10_000).padStart(4, '0')}`;
}

function perThousand(rate: number): string {
  const cents = Math.round(tenThousandths(rate) / 10);
  const whole = Math.floor(cents / 100).toLocaleString('en-US');
  return `$${whole}.${String(cents % 100).padStart(2, '0')}`;
}

/** Whole dollars a year on the example house: rate per $100 times house value over 100. */
function exampleDollars(rate: number): string {
  const dollars = Math.round((tenThousandths(rate) * (EXAMPLE_HOUSE / 100)) / 10_000);
  return `$${dollars.toLocaleString('en-US')}`;
}

const HOUSE = `$${EXAMPLE_HOUSE.toLocaleString('en-US')}`;

/** The unit line in three parts, so a page can link the middle one. */
export function rateUnitParts(ratePer100: number): { before: string; linkText: string; after: string } {
  return {
    before: `${perHundred(ratePer100)} per $100 of value (${perThousand(ratePer100)} per $1,000). About ${exampleDollars(ratePer100)} a year on a ${HOUSE} house (an example). School tax only, `,
    linkText: 'before the property tax credit',
    after: '.',
  };
}

export function rateUnitLine(ratePer100: number): string {
  const p = rateUnitParts(ratePer100);
  return p.before + p.linkText + p.after;
}

export function rateRangeText(low: number, high: number): string {
  return `${perHundred(low)} to ${perHundred(high)} per $100 of value. About ${exampleDollars(low)} to ${exampleDollars(high)} a year on a ${HOUSE} house (an example).`;
}

/** Lines to show under a rate. A blank rate gets none, so no dollar figure is ever invented. */
export function rateLines(rate: Figure<number>): string[] {
  return rate.kind === 'value' ? [rateUnitLine(rate.value)] : [];
}
