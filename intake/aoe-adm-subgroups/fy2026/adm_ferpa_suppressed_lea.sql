-- ADM by LEA / school year, with FERPA-style disclosure avoidance.
--
-- Revision of adm_ferpa_suppressed.sql (2026-08-21). Changes from that version:
--
--   1. GRAIN. Aggregates by LEA / school district rather than supervisory union.
--      The SU identifier is retained as a passthrough column so the output
--      reconciles against the SU-grain file already delivered.
--   2. SY24 NSLELG. The prior version used (ADMFPSTAT = 'F'), which is true for
--      nearly every student and therefore does not measure eligibility. It is
--      replaced with a null-returning branch. See the note at the roster.
--   3. NOT-COLLECTED. The prior version returned literal 0 for an uncollected
--      measure and called it "a true 0". It was not. It now returns NULL, which
--      keeps 0 meaning exactly one thing.
--   4. TOTAL ADM. Each LEA's total ADM is emitted as its own column, so the
--      suppressed grade bands are bounded by a published total rather than open.
--
-- The suppression logic itself is UNCHANGED. min_n stays 11 and all four rules
-- below are applied exactly as before. Finer grain will suppress more cells;
-- that is expected and is not a reason to loosen anything.
--
-- Rules applied, following ED/NCES SLDS Technical Brief 3 practice:
--   1. Reporting floor  - an LEA/year whose total population is < min_n reports nothing.
--   2. Primary          - a cell with 1..min_n-1 students is withheld.
--   3. Complement       - a subgroup is withheld when the students NOT in it number
--                         < min_n (a 100% cell discloses every student's status).
--   4. Complementary    - across the four grade bands, a lone suppressed band is
--                         derivable by subtraction, so the next-smallest non-empty
--                         band is also blanked.

WITH params AS (
  SELECT 11 AS min_n            -- ED/EDFacts minimum cell size: fewer than 11 is not reportable
),

/* ---------- 1. Student-level roster ----------
   `ADMTDIST` is taken to be the district of record for ADM purposes. If that is
   not the grain long-term weighted ADM is computed on, please say so -- the
   resident district is what this analysis needs. Everything downstream keys off
   the `lea` alias only.

   SY24 nslelg_flag is deliberately NULL rather than (ADMFPSTAT = 'F'). If SY24
   carries a genuine NSLELG eligibility field, substitute it here; if it does
   not, leave the NULL and the disclosure column will report 'not_collected'. */
roster AS (
  SELECT
    ADMTDIST          AS lea,
    SUID              AS su,           -- retained for reconciliation
    'SY24'            AS school_year,
    PERMID            AS student_id,
    GRADE             AS grade,
    ADM               AS adm,
    FALSE             AS ell_flag,
    FALSE             AS ell_collected,      -- ELL not collected in SY24
    CAST(NULL AS BOOLEAN) AS nslelg_flag,
    FALSE             AS nslelg_collected    -- see note above
  FROM read_files('/Volumes/adm/sy24/adm/adm_final.parquet')

  UNION ALL

  SELECT ADMTDIST, ADMINID, 'SY25', PERMID, GRADE, ADM,
         (ELL = 1), TRUE, (NSLELG = 1), TRUE
  FROM read_files('/Volumes/adm/sy25/adm/adm_final.parquet')

  UNION ALL

  SELECT ADMTDIST, ADMINID, 'SY26', PERMID, GRADE, ADM,
         (ELL = 1), TRUE, (NSLELG = 1), TRUE
  FROM read_files('/Volumes/adm/sy26/adm/adm_final.parquet')
),

banded AS (
  SELECT
    r.*,
    CASE
      WHEN grade IN ('PK','EE')                              THEN 'prekindergarten'
      WHEN grade IN ('K','KF','KP','01','02','03','04','05') THEN 'kindergarten_through_5'
      WHEN grade IN ('06','07','08')                         THEN 'grades_6_through_8'
      WHEN grade IN ('09','10','11','12')                    THEN 'grades_9_through_12'
    END AS grade_band
  FROM roster r
),

/* ---------- 2. Denominator and subgroup headcounts per LEA / year ---------- */
lea_totals AS (
  SELECT
    lea,
    ANY_VALUE(su)                                             AS su,
    school_year,
    COUNT(DISTINCT student_id)                                AS n_total,
    SUM(adm)                                                  AS adm_total,
    COUNT(DISTINCT CASE WHEN ell_flag    THEN student_id END) AS n_ell,
    COUNT(DISTINCT CASE WHEN nslelg_flag THEN student_id END) AS n_nslelg,
    SUM(CASE WHEN ell_flag    THEN adm ELSE 0 END)            AS adm_ell,
    SUM(CASE WHEN nslelg_flag THEN adm ELSE 0 END)            AS adm_nslelg,
    BOOL_OR(ell_collected)                                    AS ell_collected,
    BOOL_OR(nslelg_collected)                                 AS nslelg_collected
  FROM banded
  GROUP BY lea, school_year
),

/* ---------- 3. Grade-band cells, gridded so "serves no such grades" != "missing" ---------- */
band_observed AS (
  SELECT
    lea, school_year, grade_band,
    COUNT(DISTINCT student_id) AS n_band,
    SUM(adm)                   AS adm_band
  FROM banded
  WHERE grade_band IS NOT NULL
  GROUP BY lea, school_year, grade_band
),

band_cells AS (
  SELECT
    t.lea,
    t.school_year,
    g.grade_band,
    COALESCE(o.n_band, 0)   AS n_band,
    COALESCE(o.adm_band, 0) AS adm_band
  FROM lea_totals t
  CROSS JOIN (VALUES
      ('prekindergarten'),
      ('kindergarten_through_5'),
      ('grades_6_through_8'),
      ('grades_9_through_12')
    ) AS g(grade_band)
  LEFT JOIN band_observed o
    ON  o.lea         = t.lea
    AND o.school_year = t.school_year
    AND o.grade_band  = g.grade_band
),

/* ---------- 4. Primary + complementary suppression across the grade bands ---------- */
band_primary AS (
  SELECT
    c.*,
    CASE WHEN c.n_band BETWEEN 1 AND p.min_n - 1 THEN 1 ELSE 0 END AS primary_supp
  FROM band_cells c
  CROSS JOIN params p
),

band_ranked AS (
  SELECT
    b.*,
    SUM(primary_supp) OVER (PARTITION BY lea, school_year) AS n_primary,
    ROW_NUMBER() OVER (
      PARTITION BY lea, school_year, primary_supp
      ORDER BY CASE WHEN n_band = 0 THEN 1 ELSE 0 END, n_band, grade_band
    ) AS rn
  FROM band_primary b
),

band_final AS (
  SELECT
    lea, school_year, grade_band, n_band, adm_band,
    CASE
      WHEN primary_supp = 1 THEN TRUE
      -- a single suppressed band is recoverable by subtracting the published bands
      -- from the LEA total, so blank the smallest non-empty survivor as well
      WHEN n_primary = 1 AND primary_supp = 0 AND n_band > 0 AND rn = 1 THEN TRUE
      ELSE FALSE
    END AS suppressed
  FROM band_ranked
),

band_pivot AS (
  SELECT
    lea,
    school_year,
    MAX(CASE WHEN grade_band = 'prekindergarten'        THEN IF(suppressed, NULL, adm_band) END) AS prekindergarten,
    MAX(CASE WHEN grade_band = 'kindergarten_through_5' THEN IF(suppressed, NULL, adm_band) END) AS kindergarten_through_5,
    MAX(CASE WHEN grade_band = 'grades_6_through_8'     THEN IF(suppressed, NULL, adm_band) END) AS grades_6_through_8,
    MAX(CASE WHEN grade_band = 'grades_9_through_12'    THEN IF(suppressed, NULL, adm_band) END) AS grades_9_through_12,
    SUM(IF(suppressed, 1, 0))                                                                    AS bands_suppressed
  FROM band_final
  GROUP BY lea, school_year
)

SELECT
  t.lea,
  t.su,
  t.school_year,

  -- already public; lets the suppressed bands be bounded rather than open-ended
  IF(t.n_total < p.min_n, NULL, t.adm_total)              AS adm_total,

  IF(t.n_total < p.min_n, NULL, b.prekindergarten)        AS prekindergarten,
  IF(t.n_total < p.min_n, NULL, b.kindergarten_through_5) AS kindergarten_through_5,
  IF(t.n_total < p.min_n, NULL, b.grades_6_through_8)     AS grades_6_through_8,
  IF(t.n_total < p.min_n, NULL, b.grades_9_through_12)    AS grades_9_through_12,

  CASE
    WHEN NOT t.ell_collected                THEN NULL  -- CHANGED: was literal 0
    WHEN t.n_total < p.min_n                THEN NULL  -- population below the reporting floor
    WHEN t.n_ell BETWEEN 1 AND p.min_n - 1  THEN NULL  -- primary: small cell
    WHEN t.n_total - t.n_ell < p.min_n      THEN NULL  -- complement: near-100% cell
    ELSE t.adm_ell
  END AS ell,

  CASE
    WHEN NOT t.nslelg_collected                THEN NULL  -- CHANGED: was a bad SY24 proxy
    WHEN t.n_total < p.min_n                   THEN NULL
    WHEN t.n_nslelg BETWEEN 1 AND p.min_n - 1  THEN NULL
    WHEN t.n_total - t.n_nslelg < p.min_n      THEN NULL
    ELSE t.adm_nslelg
  END AS nslelg,

  /* ---- Disclosure columns. PLEASE RETAIN THESE.
         Without them an uncollected measure cannot be told from a true zero, nor
         a small cell from a near-100% one. Treated as internal documentation and
         not republished. ---- */
  CASE
    WHEN NOT t.ell_collected               THEN 'not_collected'
    WHEN t.n_total < p.min_n               THEN 'below_reporting_floor'
    WHEN t.n_ell BETWEEN 1 AND p.min_n - 1 THEN 'primary_small_cell'
    WHEN t.n_total - t.n_ell < p.min_n     THEN 'complement_small_cell'
    WHEN t.n_ell = 0                       THEN 'published_true_zero'
    ELSE 'published'
  END AS ell_disclosure,
  CASE
    WHEN NOT t.nslelg_collected               THEN 'not_collected'
    WHEN t.n_total < p.min_n                  THEN 'below_reporting_floor'
    WHEN t.n_nslelg BETWEEN 1 AND p.min_n - 1 THEN 'primary_small_cell'
    WHEN t.n_total - t.n_nslelg < p.min_n     THEN 'complement_small_cell'
    WHEN t.n_nslelg = 0                       THEN 'published_true_zero'
    ELSE 'published'
  END AS nslelg_disclosure,
  b.bands_suppressed

FROM lea_totals t
JOIN band_pivot b
  ON  b.lea         = t.lea
  AND b.school_year = t.school_year
CROSS JOIN params p
ORDER BY t.lea, t.school_year
