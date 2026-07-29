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
  readonly member_towns: readonly string[];
  readonly grades: readonly string[];
  readonly website: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
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
