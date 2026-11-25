/**
 * The eleven districts whose FY2026 rate the engine cannot reproduce. These are
 * the rows under "What the FY2026 table showed" in docs/act-127-transition.md.
 * Keys are registry slugs. Each reason is a plain sentence drawn from that
 * row's "Why" column. The site shows the State's published rate for these.
 */
const LOWER =
  "The State's rate is lower, likely because of a bond or other cost this site does not include yet.";
const HIGHER = "The State's rate is higher. This is probably not about the rate change at all.";

export const RATE_RESIDUALS: Readonly<Record<string, string>> = {
  'town/buels-gore':
    "Buels Gore is an unorganized gore. State law sets its school rate at one, so this site's math does not apply.",
  'town/norwich': `This page's math does not match the State's rate for Norwich. ${LOWER}`,
  'town/hartford': `This page's math does not match the State's rate for Hartford. ${LOWER}`,
  'ud/west-river-valley-union-education-district-b-72':
    "This page's math does not match the State's rate for West River. The district is newer than the State's list of rate changes, and it may be a merged district.",
  'ud/mountain-views':
    "This page's math does not match the State's rate for Mountain Views. The State's list of rate changes explains only a small part of the gap, and the rest is not known.",
  'ud/north-country-union-high':
    "This page's math does not match the State's rate for North Country. The district is not on the State's list of rate changes under this name, and it may be a merged district.",
  'town/canaan':
    "This page's math does not match the State's rate for Canaan. The State's rate is lower, and the reason is not known yet.",
  'ud/mountain-view-union-elementary-94': `This page's math does not match the State's rate for Orleans Southwest. ${HIGHER}`,
  'ud/bellows-falls-union-high-27': `This page's math does not match the State's rate for Bellows Falls. ${HIGHER}`,
  'ud/mount-anthony-union-high-14': `This page's math does not match the State's rate for Mt. Anthony. ${HIGHER}`,
  'ud/lamoille-north-modified-b-058': `This page's math does not match the State's rate for Lamoille North. ${HIGHER}`,
};

/** The reason a district's rate is not reproduced, or null if it is. */
export function residualFor(districtSlug: string | null): string | null {
  if (!districtSlug) return null;
  return Object.hasOwn(RATE_RESIDUALS, districtSlug) ? (RATE_RESIDUALS[districtSlug] ?? null) : null;
}
