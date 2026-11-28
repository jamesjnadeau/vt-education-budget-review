/**
 * The eleven districts whose FY2026 rate the engine cannot reproduce. These are
 * the rows under "What the FY2026 table showed" in docs/act-127-transition.md.
 * Keys are registry slugs. Each reason is one plain sentence drawn from that
 * row's "Why" column. The site shows the State's published rate for these.
 *
 * Each reason compares the State's published rate (the one the page shows) with
 * what this site's own math gets. The page does not show that math, so each
 * sentence says which one is lower or higher.
 */
/** The only year this site's math was compared with the State's table. */
export const RESIDUAL_YEAR = 2026;

const lower = (name: string, why: string): string =>
  `The State's published rate for ${name} is lower than what this site's math gets, ${why}.`;
const higher = (name: string): string =>
  `The State's published rate for ${name} is higher than what this site's math gets, and the State may count this district in a different way.`;

export const RATE_RESIDUALS: Readonly<Record<string, string>> = {
  'town/buels-gore':
    "Buels Gore is an unorganized gore, and State law sets its school rate at one, so this site's math does not apply.",
  'town/norwich': lower('Norwich', 'which may be from a bond or other cost not counted here'),
  'town/hartford': lower('Hartford', 'which may be from a bond or other cost not counted here'),
  'ud/west-river-valley-union-education-district-b-72': lower(
    'West River',
    "and the district is newer than the State's list of rate changes",
  ),
  'ud/mountain-views': lower(
    'Mountain Views',
    "and the State's list of rate changes explains only a small part of the gap",
  ),
  'ud/north-country-union-high': lower(
    'North Country',
    "and the district is not on the State's list of rate changes under this name",
  ),
  'town/canaan': lower('Canaan', 'and the reason is not known yet'),
  'ud/mountain-view-union-elementary-94': higher('Mountain View #94 (Orleans Southwest)'),
  'ud/bellows-falls-union-high-27': higher('Bellows Falls'),
  'ud/mount-anthony-union-high-14': higher('Mt. Anthony'),
  'ud/lamoille-north-modified-b-058': higher('Lamoille North'),
};

/** The reason a district's rate is not reproduced, or null if it is. */
export function residualFor(districtSlug: string | null): string | null {
  if (!districtSlug) return null;
  return Object.hasOwn(RATE_RESIDUALS, districtSlug) ? (RATE_RESIDUALS[districtSlug] ?? null) : null;
}
