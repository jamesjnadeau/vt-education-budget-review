/**
 * The one analytics event the journey sends. It is fired only when a resident
 * actively picks a town on /my/ — never on the auto-redirect that returns a
 * remembered visitor to their town page (that is not a pick). It carries no
 * identity and no extra properties.
 */

export interface TownSelectedEvent {
  event: 'town_selected';
  properties: { town: string; source: 'picker' };
}

/** The exact event for an active town pick, `town` being the slug tail. */
export function buildTownSelected(slug: string): TownSelectedEvent {
  return { event: 'town_selected', properties: { town: slug, source: 'picker' } };
}
