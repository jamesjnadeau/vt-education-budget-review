# AOE enrollment dashboard dataset

Per-school enrollment by grade, 2004–2026, from data.vermont.gov (dataset 3y6q-qqc7). Raw file,
never edited; hash in `provenance.yaml`. The dataset does not state its count dates. James Nadeau
confirmed on 2026-11-22 that the `DC#06_FALL_ADM_Official` rows are the October 1 headcount used
for § 4019 "enrollment". The year-end collection counts later arrivals and is not used.
Parsed by `tools/src/small-sparse/enrollment.ts`.
