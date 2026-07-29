/**
 * Client for the AOE Public Data API.
 *
 * The OpenAPI spec lives at https://datacollection.education.vermont.gov/docs/openapi.json
 * (the /docs page is a client-rendered Swagger UI, so the spec has to be fetched
 * directly rather than scraped from it).
 *
 * Two quirks of the live API that this module exists to absorb, both observed
 * against the running service rather than read off the spec:
 *
 *   1. The primary key is spelled `OrgID` on the organizations, supervisoryUnions
 *      and closed_organizations endpoints, and `OrgId` on towns, publicSchools and
 *      unionDistricts. Same field, two spellings, one API.
 *
 *   2. The live responses carry fields the spec's schemas do not declare --
 *      `OrgType`, `OperatedBy` and `EdFi_ID` all appear on supervisoryUnions
 *      despite the spec's `Organization` schema listing none of them.
 *
 * Which is the practical argument for the plan's rule that the API is a
 * convenience layer and not a dependency: everything is snapshotted, and the
 * site must be able to build from snapshots alone.
 */

export const AOE_API_BASE = 'https://datacollection.education.vermont.gov';
export const AOE_OPENAPI_URL = `${AOE_API_BASE}/docs/openapi.json`;

export const AOE_ENDPOINTS = {
  supervisoryUnions: '/api/lists/supervisoryUnions',
  unionDistricts: '/api/lists/unionDistricts',
  towns: '/api/lists/towns',
  publicSchools: '/api/lists/publicSchools',
  independentSchools: '/api/lists/independentSchools',
  organizations: '/api/lists/organizations',
  closedOrganizations: '/api/lists/closed_organizations',
} as const;

export type AoeEndpointName = keyof typeof AOE_ENDPOINTS;

/** A record as the API returns it, before either spelling of the key is resolved. */
export interface AoeRawRecord {
  readonly ServerId?: number;
  readonly Name?: string;
  readonly OrgID?: string;
  readonly OrgId?: string;
  readonly OrgType?: string;
  readonly ParentOrg?: string | null;
  readonly OperatedBy?: string | null;
  readonly Grades?: readonly string[] | null;
  readonly CloseDate?: string | null;
  readonly EdFi_ID?: number | null;
  readonly Latitude?: string | null;
  readonly Longitude?: string | null;
  readonly Website?: string | null;
  readonly MailingCity?: string | null;
  readonly [key: string]: unknown;
}

/** Resolves the two spellings of the organization ID into one. */
export function orgId(record: AoeRawRecord): string | null {
  return record.OrgID ?? record.OrgId ?? null;
}

export class AoeApiError extends Error {
  constructor(
    readonly endpoint: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AoeApiError';
  }
}

export interface FetchOptions {
  readonly timeoutMs?: number;
  readonly retries?: number;
}

async function fetchJson(url: string, options: FetchOptions = {}): Promise<unknown> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const retries = options.retries ?? 2;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          accept: 'application/json',
          // Identify the client. A public agency should be able to see who is
          // reading their API and how to reach them about it.
          'user-agent': 'vt-budget-pipeline (+https://github.com/) registry sync',
        },
      });
      if (!response.ok) {
        throw new AoeApiError(url, response.status, `${url} returned HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export async function fetchEndpoint(
  name: AoeEndpointName,
  options: FetchOptions = {},
): Promise<AoeRawRecord[]> {
  const url = `${AOE_API_BASE}${AOE_ENDPOINTS[name]}`;
  const data = await fetchJson(url, options);
  if (!Array.isArray(data)) {
    throw new AoeApiError(url, 200, `${url} returned ${typeof data}, expected a bare array.`);
  }
  return data as AoeRawRecord[];
}

export async function fetchOpenApiSpec(options: FetchOptions = {}): Promise<unknown> {
  return fetchJson(AOE_OPENAPI_URL, options);
}

export interface Snapshot {
  readonly date: string;
  readonly endpoints: Readonly<Record<string, AoeRawRecord[]>>;
}

/** Pulls every endpoint the registry is built from, for one snapshot. */
export async function fetchAll(
  date: string,
  options: FetchOptions = {},
): Promise<Snapshot> {
  const names: AoeEndpointName[] = [
    'supervisoryUnions',
    'unionDistricts',
    'towns',
    'publicSchools',
    'independentSchools',
    'organizations',
    'closedOrganizations',
  ];

  const endpoints: Record<string, AoeRawRecord[]> = {};
  for (const name of names) {
    endpoints[name] = await fetchEndpoint(name, options);
  }
  return { date, endpoints };
}
