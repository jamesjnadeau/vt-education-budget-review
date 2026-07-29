# AOE Public Data API snapshot, 2026-07-29

Raw responses exactly as returned, one file per endpoint. This is the provenance
record for the directory layer: the registry in `registry/entities/` is derived
from these files and can be rebuilt from them with `npm run registry:sync -- --from 2026-07-29`.

The site must be able to build from snapshots alone. The API is a convenience
layer, not a dependency.

| Endpoint | Records |
|---|---|
| `supervisoryUnions` | 54 |
| `unionDistricts` | 61 |
| `towns` | 267 |
| `publicSchools` | 289 |
| `independentSchools` | 126 |
| `organizations` | 830 |
| `closedOrganizations` | 47 |
