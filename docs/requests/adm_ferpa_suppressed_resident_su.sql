-- ADM by SUPERVISORY UNION OF RESIDENCE / school year, with FERPA-style disclosure avoidance.
--
-- Request follow-up to #840. Derived from adm_ferpa_suppressed_lea.sql (the
-- town-of-residence extract) and changes ONE thing: the grain.
--
--   Each student is counted in the supervisory union that their RESIDENT TOWN
--   (ADMTDIST) belongs to, in every year. A student who lives in a member town
--   and attends school in another SU is still counted in the home SU.
--
-- Why this is asked for. The SU-grain file delivered under #840 equals the sum
-- of its member towns' resident ADM in SY24 but not in SY25 or SY26, mostly in
-- grades 9-12 and in both directions. The query that produced it was not
-- supplied. The SY25/SY26 roster used the ADMINID column as the SU, the SY24
-- roster used SUID; if ADMINID names the SU that ADMINISTERS the school
-- attended, SY25/SY26 would count by school attended, which is not the same
-- thing. Please confirm which column each year's SU file was grouped on, and
-- run this one for the resident-SU series.
--
-- The town -> SU map below is explicit rather than a join to a table we cannot
-- see, so the grouping is auditable. It lists the 260 Vermont towns, current
-- (2026-27) membership, from the project's registry of AOE organization IDs.
-- ADMTDIST codes with no SU (the 900-series out-of-state/out-of-country buckets,
-- T000 unknown, and T211 Underhill ID) are dropped by the inner join. If your
-- ADMTDIST/SU table disagrees with this map for any town, yours wins; say so.
--
-- The suppression logic is UNCHANGED (min_n = 11, the same four rules) and is
-- applied per SU. A suppressed SU band is the same primary/complementary rule
-- as before, so SU cells will rarely be suppressed except in the smallest SUs.

WITH params AS (
  SELECT 11 AS min_n            -- ED/EDFacts minimum cell size: fewer than 11 is not reportable
),

/* ---------- 0. Resident town -> supervisory union of residence ---------- */
town_su AS (
  SELECT * FROM (VALUES
      ('T001', 'SU002'),  -- addison
      ('T002', 'SU034'),  -- albany
      ('T003', 'SU024'),  -- alburgh
      ('T004', 'SU063'),  -- andover
      ('T005', 'SU005'),  -- arlington
      ('T006', 'SU047'),  -- athens
      ('T007', 'SU020'),  -- bakersfield
      ('T008', 'SU063'),  -- baltimore
      ('T009', 'SU051'),  -- barnard
      ('T010', 'SU009'),  -- barnet
      ('T011', 'SU061'),  -- barre-city
      ('T012', 'SU061'),  -- barre-town
      ('T013', 'SU034'),  -- barton-id
      ('T014', 'SU025'),  -- belvidere
      ('T015', 'SU005'),  -- bennington-id
      ('T017', 'SU004'),  -- benson
      ('T018', 'SU020'),  -- berkshire
      ('T019', 'SU032'),  -- berlin
      ('T020', 'SU030'),  -- bethel
      ('T021', 'SU019'),  -- bloomfield
      ('T022', 'SU012'),  -- bolton
      ('T023', 'SU027'),  -- bradford-id
      ('T024', 'SU028'),  -- braintree
      ('T026', 'SU036'),  -- brandon
      ('T027', 'SU048'),  -- brattleboro
      ('T028', 'SU051'),  -- bridgewater
      ('T029', 'SU003'),  -- bridport
      ('T030', 'SU031'),  -- brighton
      ('T031', 'SU001'),  -- bristol
      ('T032', 'SU028'),  -- brookfield
      ('T033', 'SU046'),  -- brookline
      ('T034', 'SU034'),  -- brownington
      ('T035', 'SU019'),  -- brunswick
      ('T036', 'SU067'),  -- burke
      ('T037', 'SU015'),  -- burlington
      ('T038', 'SU009'),  -- cabot
      ('T039', 'SU032'),  -- calais
      ('T040', 'SU025'),  -- cambridge
      ('T041', 'SU019'),  -- canaan
      ('T042', 'SU004'),  -- castleton
      ('T043', 'SU063'),  -- cavendish
      ('T044', 'SU031'),  -- charleston
      ('T045', 'SU014'),  -- charlotte
      ('T046', 'SU030'),  -- chelsea
      ('T047', 'SU063'),  -- chester
      ('T048', 'SU036'),  -- chittenden
      ('T049', 'SU033'),  -- clarendon
      ('T050', 'SU007'),  -- colchester
      ('T051', 'SU067'),  -- concord
      ('T052', 'SU027'),  -- corinth
      ('T053', 'SU003'),  -- cornwall
      ('T054', 'SU031'),  -- coventry
      ('T055', 'SU035'),  -- craftsbury
      ('T056', 'SU006'),  -- danby
      ('T057', 'SU009'),  -- danville
      ('T058', 'SU031'),  -- derby
      ('T059', 'SU006'),  -- dorset
      ('T060', 'SU046'),  -- dover
      ('T061', 'SU048'),  -- dummerston
      ('T063', 'SU042'),  -- duxbury
      ('T064', 'SU019'),  -- east-haven
      ('T065', 'SU032'),  -- east-montpelier
      ('T066', 'SU025'),  -- eden
      ('T067', 'SU026'),  -- elmore
      ('T068', 'SU020'),  -- enosburgh
      ('T069', 'SU065'),  -- essex-junction
      ('T070', 'SU065'),  -- essex-town
      ('T071', 'SU022'),  -- fairfax
      ('T072', 'SU023'),  -- fairfield
      ('T073', 'SU004'),  -- fair-haven
      ('T074', 'SU064'),  -- fairlee
      ('T075', 'SU042'),  -- fayston
      ('T076', 'SU002'),  -- ferrisburgh
      ('T077', 'SU022'),  -- fletcher
      ('T078', 'SU021'),  -- franklin
      ('T079', 'SU022'),  -- georgia
      ('T080', 'SU034'),  -- glover
      ('T081', 'SU036'),  -- goshen
      ('T082', 'SU047'),  -- grafton
      ('T083', 'SU019'),  -- granby
      ('T084', 'SU024'),  -- grand-isle
      ('T085', 'SU030'),  -- granville
      ('T086', 'SU035'),  -- greensboro
      ('T087', 'SU027'),  -- groton
      ('T088', 'SU019'),  -- guildhall
      ('T089', 'SU048'),  -- guilford
      ('T090', 'SU049'),  -- halifax
      ('T091', 'SU030'),  -- hancock
      ('T092', 'SU035'),  -- hardwick
      ('T093', 'SU054'),  -- hartford
      ('T094', 'SU052'),  -- hartland
      ('T095', 'SU021'),  -- highgate
      ('T096', 'SU014'),  -- hinesburg
      ('T097', 'SU031'),  -- holland
      ('T098', 'SU004'),  -- hubbardton
      ('T099', 'SU012'),  -- huntington
      ('T100', 'SU025'),  -- hyde-park
      ('T101', 'SU066'),  -- ira
      ('T102', 'SU034'),  -- irasburg
      ('T103', 'SU024'),  -- isle-lamotte
      ('T104', 'SU046'),  -- jamaica
      ('T105', 'SU031'),  -- jay
      ('T106', 'SU012'),  -- jericho
      ('T107', 'SU025'),  -- johnson
      ('T108', 'SU019'),  -- kirby
      ('T109', 'SU006'),  -- landgrove
      ('T110', 'SU036'),  -- leicester
      ('T111', 'SU019'),  -- lemington
      ('T112', 'SU070'),  -- lincoln
      ('T113', 'SU006'),  -- londonderry
      ('T114', 'SU031'),  -- lowell
      ('T115', 'SU063'),  -- ludlow
      ('T116', 'SU067'),  -- lunenburg
      ('T117', 'SU067'),  -- lyndon
      ('T118', 'SU019'),  -- maidstone
      ('T119', 'SU006'),  -- manchester
      ('T120', 'SU046'),  -- marlboro
      ('T121', 'SU009'),  -- marshfield
      ('T122', 'SU036'),  -- mendon
      ('T123', 'SU003'),  -- middlebury
      ('T124', 'SU032'),  -- middlesex
      ('T125', 'SU066'),  -- middletown-springs
      ('T126', 'SU010'),  -- milton
      ('T127', 'SU001'),  -- monkton
      ('T128', 'SU020'),  -- montgomery
      ('T129', 'SU069'),  -- montpelier
      ('T130', 'SU042'),  -- moretown
      ('T131', 'SU031'),  -- morgan
      ('T132', 'SU026'),  -- morristown
      ('T133', 'SU063'),  -- mt-holly
      ('T134', 'SU006'),  -- mt-tabor
      ('T135', 'SU067'),  -- newark
      ('T136', 'SU027'),  -- newbury
      ('T137', 'SU046'),  -- newfane
      ('T138', 'SU001'),  -- new-haven
      ('T139', 'SU031'),  -- newport-city
      ('T140', 'SU031'),  -- newport-town
      ('T141', 'SU005'),  -- north-bennington
      ('T142', 'SU068'),  -- northfield
      ('T143', 'SU024'),  -- north-hero
      ('T144', 'SU019'),  -- norton
      ('T145', 'SU055'),  -- norwich
      ('T146', 'SU068'),  -- orange
      ('T147', 'SU034'),  -- orleans-id
      ('T148', 'SU004'),  -- orwell
      ('T149', 'SU002'),  -- panton
      ('T150', 'SU006'),  -- pawlet
      ('T151', 'SU009'),  -- peacham
      ('T152', 'SU006'),  -- peru
      ('T153', 'SU051'),  -- pittsfield
      ('T154', 'SU036'),  -- pittsford
      ('T155', 'SU009'),  -- plainfield
      ('T156', 'SU051'),  -- plymouth
      ('T157', 'SU051'),  -- pomfret
      ('T158', 'SU066'),  -- poultney
      ('T159', 'SU005'),  -- pownal
      ('T160', 'SU066'),  -- proctor
      ('T161', 'SU048'),  -- putney
      ('T162', 'SU028'),  -- randolph
      ('T163', 'SU051'),  -- reading
      ('T164', 'SU049'),  -- readsboro
      ('T165', 'SU020'),  -- richford
      ('T166', 'SU012'),  -- richmond
      ('T167', 'SU003'),  -- ripton
      ('T168', 'SU030'),  -- rochester
      ('T169', 'SU047'),  -- rockingham
      ('T170', 'SU069'),  -- roxbury
      ('T171', 'SU030'),  -- royalton
      ('T172', 'SU006'),  -- rupert
      ('T173', 'SU040'),  -- rutland-city
      ('T174', 'SU066'),  -- rutland-town
      ('T175', 'SU027'),  -- ryegate
      ('T176', 'SU023'),  -- st-albans-city
      ('T177', 'SU023'),  -- st-albans-town
      ('T178', 'SU014'),  -- st-george
      ('T179', 'SU011'),  -- st-johnsbury
      ('T180', 'SU003'),  -- salisbury
      ('T181', 'SU005'),  -- sandgate
      ('T182', 'SU049'),  -- searsburg
      ('T183', 'SU005'),  -- shaftsbury
      ('T184', 'SU030'),  -- sharon
      ('T185', 'SU067'),  -- sheffield
      ('T186', 'SU014'),  -- shelburne
      ('T187', 'SU020'),  -- sheldon
      ('T188', 'SU051'),  -- killington
      ('T189', 'SU003'),  -- shoreham
      ('T190', 'SU033'),  -- shrewsbury
      ('T191', 'SU016'),  -- south-burlington
      ('T192', 'SU024'),  -- south-hero
      ('T193', 'SU056'),  -- springfield
      ('T194', 'SU049'),  -- stamford
      ('T195', 'SU035'),  -- stannard
      ('T196', 'SU001'),  -- starksboro
      ('T197', 'SU030'),  -- stockbridge
      ('T198', 'SU026'),  -- stowe
      ('T199', 'SU030'),  -- strafford
      ('T200', 'SU046'),  -- stratton
      ('T201', 'SU036'),  -- sudbury
      ('T202', 'SU006'),  -- sunderland
      ('T203', 'SU067'),  -- sutton
      ('T204', 'SU021'),  -- swanton
      ('T205', 'SU027'),  -- thetford
      ('T206', 'SU033'),  -- tinmouth
      ('T207', 'SU027'),  -- topsham
      ('T208', 'SU046'),  -- townshend
      ('T209', 'SU031'),  -- troy
      ('T210', 'SU030'),  -- tunbridge
      ('T212', 'SU012'),  -- underhill-town
      ('T213', 'SU002'),  -- vergennes
      ('T214', 'SU048'),  -- vernon
      ('T215', 'SU064'),  -- vershire
      ('T216', 'SU019'),  -- victory
      ('T217', 'SU042'),  -- waitsfield
      ('T218', 'SU009'),  -- walden
      ('T219', 'SU033'),  -- wallingford
      ('T220', 'SU002'),  -- waltham
      ('T221', 'SU046'),  -- wardsboro
      ('T222', 'SU042'),  -- warren
      ('T223', 'SU068'),  -- washington
      ('T224', 'SU042'),  -- waterbury
      ('T225', 'SU009'),  -- waterford
      ('T226', 'SU025'),  -- waterville
      ('T227', 'SU052'),  -- weathersfield
      ('T228', 'SU066'),  -- wells
      ('T229', 'SU027'),  -- wells-river
      ('T230', 'SU064'),  -- west-fairlee
      ('T231', 'SU031'),  -- westfield
      ('T232', 'SU065'),  -- westford
      ('T233', 'SU004'),  -- west-haven
      ('T234', 'SU047'),  -- westminster
      ('T235', 'SU034'),  -- westmore
      ('T236', 'SU006'),  -- weston
      ('T237', 'SU066'),  -- west-rutland
      ('T238', 'SU052'),  -- west-windsor
      ('T239', 'SU003'),  -- weybridge
      ('T240', 'SU067'),  -- wheelock
      ('T241', 'SU036'),  -- whiting
      ('T242', 'SU049'),  -- whitingham
      ('T243', 'SU068'),  -- williamstown
      ('T244', 'SU014'),  -- williston
      ('T245', 'SU049'),  -- wilmington
      ('T246', 'SU046'),  -- windham
      ('T247', 'SU052'),  -- windsor
      ('T248', 'SU006'),  -- winhall
      ('T249', 'SU017'),  -- winooski
      ('T250', 'SU035'),  -- wolcott
      ('T251', 'SU035'),  -- woodbury
      ('T252', 'SU005'),  -- woodford
      ('T253', 'SU051'),  -- woodstock
      ('T254', 'SU032'),  -- worcester
      ('T255', 'SU012'),  -- buels-gore
      ('T256', 'SU019'),  -- averill
      ('T257', 'SU019'),  -- averys-gore
      ('T258', 'SU019'),  -- ferdinand
      ('T259', 'SU005'),  -- glastenbury
      ('T260', 'SU019'),  -- lewis
      ('T261', 'SU049'),  -- somerset
      ('T262', 'SU019'),  -- warners-grant
      ('T263', 'SU019'),  -- warrens-grant
      ('T999', 'SU064')  -- orford-nh
  ) AS m(town, resident_su)
),

/* ---------- 1. Student-level roster ----------
   `ADMTDIST` is the student's resident town. It is rolled up to the SU the town
   belongs to (town_su above); the SU the student ATTENDS (SUID / ADMINID) is
   deliberately not used. Everything downstream keys off the `lea` alias, which
   in this file holds the resident SU id.

   SY24 nslelg_flag is deliberately NULL rather than (ADMFPSTAT = 'F'). If SY24
   carries a genuine NSLELG eligibility field, substitute it here; if it does
   not, leave the NULL and the disclosure column will report 'not_collected'. */
roster AS (
  SELECT
    ADMTDIST          AS town,
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

  SELECT ADMTDIST, 'SY25', PERMID, GRADE, ADM,
         (ELL = 1), TRUE, (NSLELG = 1), TRUE
  FROM read_files('/Volumes/adm/sy25/adm/adm_final.parquet')

  UNION ALL

  SELECT ADMTDIST, 'SY26', PERMID, GRADE, ADM,
         (ELL = 1), TRUE, (NSLELG = 1), TRUE
  FROM read_files('/Volumes/adm/sy26/adm/adm_final.parquet')
),

banded AS (
  SELECT
    m.resident_su AS lea,
    r.*,
    CASE
      WHEN grade IN ('PK','EE')                              THEN 'prekindergarten'
      WHEN grade IN ('K','KF','KP','01','02','03','04','05') THEN 'kindergarten_through_5'
      WHEN grade IN ('06','07','08')                         THEN 'grades_6_through_8'
      WHEN grade IN ('09','10','11','12')                    THEN 'grades_9_through_12'
    END AS grade_band
  FROM roster r
  JOIN town_su m ON m.town = r.town
),

/* ---------- 2. Denominator and subgroup headcounts per LEA / year ---------- */
lea_totals AS (
  SELECT
    lea,
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
  t.lea                                                   AS su,
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
