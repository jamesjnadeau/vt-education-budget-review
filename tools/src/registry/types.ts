export type EntityType =
  | 'su'
  | 'sd'
  | 'ud'
  | 'school'
  | 'town'
  | 'academy'
  | 'techcenter'
  | 'independent'
  | 'state';

export type DateBasis = 'statute' | 'aoe_published' | 'first_observed' | 'manual' | 'unknown';

export interface ManualOverride {
  readonly field: string;
  readonly reason: string;
  readonly set_by: string;
  readonly set_date: string;
}

export interface RegistryEntity {
  readonly slug: string;
  readonly name: string;
  readonly type: EntityType;
  readonly aoe_org_id?: string;
  readonly aoe_server_id: number | null;
  readonly edfi_id: number | null;
  readonly effective_from: string | null;
  readonly effective_from_basis: DateBasis;
  readonly effective_to: string | null;
  readonly effective_to_basis: DateBasis;
  readonly successor: string | null;
  readonly successor_basis: string | null;
  readonly supervisory_union: string | null;
  readonly operated_by: string | null;
  /**
   * True for AOE reporting buckets (a town record named UNKNOWN, and similar)
   * rather than real organizations. Kept in the registry because other records
   * legitimately reference them, but NO average daily membership is awarded to
   * them: they contribute no weighted pupils, owe no budget in the coverage
   * matrix, and cannot take part in a merger scenario.
   */
  readonly reporting_only: boolean;
  readonly member_towns: readonly string[];
  readonly grades: readonly string[];
  readonly website: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;

  // --- school-only fields, all null on every other entity type -------------

  /** Integer form of `grades`. PK and EE are -1, K is 0, grades 1-12 themselves. */
  readonly grade_span?: { readonly low: number; readonly high: number; readonly as_stated: string | null } | null;
  readonly grade_span_class?: string | null;
  /**
   * MailingCity verbatim. A POSTAL designation, not a municipality: Vermont post
   * office names routinely cover parts of several towns. Recorded because it is
   * what the source says, and never read as `municipality`.
   */
  readonly mailing_city?: string | null;
  /**
   * Slug of the town the building stands in. Not set by the sync -- the API
   * publishes no municipality, only a mailing address -- so it arrives from the
   * derived geocode in `derived/school-municipality/` or by hand.
   */
  readonly municipality?: string | null;
  readonly municipality_basis?:
    | 'census_geocoder_point_in_polygon'
    | 'aoe_mailing_city'
    | 'manual'
    | 'unknown';
  /**
   * AOE publishes coordinates with no statement of how they were derived, so the
   * sync records `unknown` rather than assuming rooftop. The distance criterion
   * declines at that precision, which is the correct behaviour: a coordinate of
   * unstated provenance cannot screen a ten-mile threshold.
   */
  readonly geocode_precision?: 'rooftop' | 'parcel' | 'street' | 'municipality_centroid' | 'unknown';
  readonly school_type?: 'public' | 'approved_independent' | 'career_technical_center' | 'other' | null;

  readonly manual_overrides: readonly ManualOverride[];
  readonly notes: string | null;
}

export interface RegistryFile {
  readonly schema_version: '1.0';
  readonly entity_type: EntityType;
  readonly synced_from: {
    readonly api: string;
    readonly endpoint: string;
    readonly last_synced: string;
    readonly snapshot: string | null;
  };
  readonly records: readonly RegistryEntity[];
}

export type Registry = ReadonlyMap<string, RegistryEntity>;
