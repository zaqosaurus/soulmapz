# THE PLAN — v0.7 "The Diverse Map"
### Unlock what we have, acquire what we can reach, push for the rest

Written 2026-11-05 after v0.6 (PR [#1](https://github.com/zaqosaurus/soulmapz/pull/1)). This is the
working plan for making the main map broader: more of the world, more of the soul than
its wounds, more render forms, more time. It is phased so each phase ships something
real and leaves the branch green. Progress is tracked in the STATUS table at the end.

---

## 0. WHY (the diagnosis this plan answers)

| Imbalance | Today | Target after v0.7 |
|---|---|---|
| Geography | 11 of 15 live layers are U.S.-only; the world sheet has 4 | at least 8 world layers |
| Emotional range | ~9 layers measure harm, loss, or control; none measures joy, love, kindness, play, or beauty | at least 4 "light" layers (most need Phase 3 network access) |
| Render forms | 9 points, 6 county tints, 1 flow, 0 raster; no country tint | adds country tint, world flows, categorical tint, raster |
| Time | only memory moves through time | at least 4 layers with a time scrubber |
| Page weight | 7.13 MB of the 8 MB ceiling | under 4 MB with more layers than today |

## 1. STANDING RULES (binding on every phase)

These extend the WANTLIST protocol and the README principles.

1. **Non-commercial.** The survey is a non-commercial project. CC-BY-NC and similar
   licenses are acceptable; the About panel, DATA_LICENSES.md, and the atlas colophon say
   so. A source whose terms forbid redistribution even non-commercially ships as a
   PENDING slot, with the gate named.
2. **The dead are not named unless they are notable.** "Notable" means the person
   already appears in the cross-verified database of notable people (the memory layer)
   or has a Wikidata entry with a Wikipedia article. Every other dataset about deaths
   ships as rates or counts for places. Name fields are dropped at staging, not hidden
   at render. The build fails if a protocol layer's packed payload carries a name field.
3. **Terms are read, recorded, and obeyed.** Public availability is not a license. For
   each source: the license or terms text is saved verbatim in the provenance sidecar,
   with the URL and date read. Facts themselves are generally free to use in the U.S.;
   compilations, site terms of use, and licenses still bind.
4. **No fabricated records.** Unchanged: every point traces to a named source with a
   retrieval date; gaps stay dark and are disclosed.
5. **Zero runtime network calls; one self-contained file; under 8 MB.**
6. **Where, not why.** Findings are descriptive and pass the QC gates in §8.
7. **Headless rule.** A failing check says where to look. Code changes only when the
   cause is visible in the code or reproducible on the previous build. What headless
   cannot verify (sound, GPU performance, real touch, print dialog, clipboard) is listed
   in each phase's report rather than claimed.

---

## 2. PHASE 0 — FOUNDATIONS (engine and build)

Nothing new can ship until the page has room and the engine stops needing per-layer
code. This phase changes no visible content.

| # | Work | Detail |
|---|---|---|
| 0.1 | **Compressed payloads** | `build.py` embeds `__LAYERDATA__` and `__BASEMAPS__` as gzip+base64; `app.js` inflates them at load with the browser's `DecompressionStream`, before `init()`. Measured: 7.13 MB → ~2.74 MB. A plain-JSON fallback path stays for browsers without `DecompressionStream` (build flag), so nothing breaks offline. |
| 0.2 | **Page-weight ledger** | Every build prints a per-layer table (raw KB, compressed KB, share of budget) and fails at 8 MB. A soft warning fires at 6 MB. |
| 0.3 | **Registry-declared packing** | Replace the per-layer `if/elif` chain in `build.py` with a `pack` block in each registry entry: kind (points, regions, cells, flows), which staging fields to keep, field types (int, float with precision, enum → code table, string with max length), and which fields become lenses. Existing layers migrate one at a time; the packed output is diffed against the old packer for identical content. |
| 0.4 | **Registry-declared tooltips and labels** | `tip` template strings in the registry (`"{name} · {status} · {state}"`, with formatters for money, int, month, year) replace the per-layer branches in `tipHTML`. Hand-tuned branches stay where they add something (stars, the Ledger). |
| 0.5 | **Country tint** | Generic `regionKind: "country"` keyed by ISO numeric, all ~177 Natural Earth countries (today only desire's 20 hard-coded countries work). |
| 0.6 | **World flows** | Flows generalize from county-centroid pairs to arbitrary point pairs or country pairs, drawn as great-circle arcs on the Equal Earth sheet. |
| 0.7 | **Time Everywhere** | A registry `time` spec (field, bucket labels, kind: year or month) gives any layer the scrubber. The era bar becomes per-layer: it shows the buckets of the first active timed layer. Memory keeps its era buckets through the same mechanism. |
| 0.8 | **Categorical tint** | A region layer may declare `categories` (code → label → color) to draw a categorical map instead of a sequential one, with a legend in the plate. |
| 0.9 | **Raster form (prepared, not used yet)** | A quantized grid payload (`kind: raster`, 8-bit values over a lat/lon box) drawn as a colored, alpha-scaled image. Needed in Phase 3 for night lights. Built now against a synthetic test grid that never ships. |

**Phase 0 QC loop**
- Before touching code: render 8 canonical views (US default, World default, each
  reading's landing view, the Ledger plate, the Meta constellation) to PNG.
- After each sub-step: rebuild, run `tests/smoke.js`, re-render the 8 views, and compare
  pixel difference per view. Allowed: below 0.5% of pixels changed (font antialiasing).
  Anything more is investigated before continuing.
- Packed-payload equivalence: old and new packers produce the same values after
  decoding (a script compares them field by field).
- Smoke test grows checks for: compressed load path, fallback path, country tint,
  world flows, a timed layer scrubbing, a categorical legend.

**Exit criteria:** page under 3.2 MB with the same 15 layers; smoke test all green; the
8 views match; no per-layer `if/elif` left in `build.py` for layers migrated.

---

## 3. PHASE 1 — UNLOCK WHAT WE ALREADY HAVE (no new downloads)

The staging files already carry fields the map ignores. Each item is a registry change
on top of Phase 0, plus an essay line on the plate.

| # | Unlock | Source field | Form |
|---|---|---|---|
| 1.1 | **What shape was it?** UFO lens by reported shape: light, triangle, circle, fireball, disk, sphere… with constellation off | `wonder-ufos.meta.shape` (80k reports) | entity lens |
| 1.2 | **The sky by decade**, as a real scrubber instead of the "latest decade" lens | `wonder-ufos.meta.yr` | time |
| 1.3 | **Forty years of buried ground**: Superfund sites by listing year, 1983 → today, and when they were deleted | `listing_date`, `deletion_date` | time |
| 1.4 | **Where the devils live**: omen lens by feature class (valley, summit, stream, populated place) | `omen-names.meta.class` | lens |
| 1.5 | **The remembered, by calling**: star lens by domain (actors, writers, composers, philosophers, athletes, politicians) | `memory-births` star `dom` | lens |
| 1.6 | **Who owns the cloud**: operator lens from the real `operator` field, replacing name matching; plus "AI campus" status from the Brockovich records | `power-datacenters.meta.operator`, `status`, `source` | lens + constellation |
| 1.7 | **The altar's families**: a categorical map of each county's largest religious tradition | `faith-altar.meta.largest_tradition_family` | categorical tint |
| 1.8 | **The sorting, in people**: toggle households ↔ individuals on the flows | `motion-sorting.people` | plate toggle |

**Findings from existing data (each goes through the §8 finding gates):**
- **The price per head** — Ledger theft per resident of the *victim jurisdiction*
  (town, county, school district, water district). Needs a hand-curated population per
  entry, taken from the entry's own citations or the reference gazetteer, recorded in
  staging with its source. Entries without a verifiable denominator are excluded and
  counted on the card. Early number (unreviewed): median $312 per resident in towns under
  25,000 vs $4.27 in cities over 250,000.
- **The thrones are exhaling** — 64% of Fortune 500 headquarters counties lose households
  on net. Must survive a size-matched comparison (each HQ county against non-HQ counties
  of similar population) before it ships.
- Re-run the v0.6 rejects only if a Phase 1 field gives them a new, pre-stated
  hypothesis. No fishing.

**Phase 1 QC loop:** for each lens, the counts shown on the chips must equal counts
computed directly from staging (script check); every new lens and the categorical
legend gets a smoke check; screenshots of each new view are reviewed by eye.

**Exit criteria:** 8 unlocks live, smoke green, findings either shipped with method notes
or logged as rejected, page under 3.5 MB.

---

## 4. PHASE 2 — ACQUIRE WHAT WE CAN REACH TODAY

Verified downloadable from the build environment on 2026-11-05 (GitHub raw files and
the Eviction Lab bucket). In order of value to the map's balance:

| # | Layer (working title) | Source | Scope · form | Terms check | Protocol |
|---|---|---|---|---|---|
| 2.1 | **The Last Speakers** | Glottolog CLDF (`languages.csv`, `values.csv` for AES endangerment) | world · points with endangerment lens (not endangered → extinct) | CC-BY 4.0 | none |
| 2.2 | **The World's Furnaces** | WRI Global Power Plant Database v1.3 | world · points sized by capacity, fuel lens (coal, gas, oil, nuclear, hydro, wind, solar) | CC-BY 4.0; frozen 2021, disclosed | none |
| 2.3 | **The Price of Staying** | Eviction Lab county estimates 2000–2018 (`county_eviction_estimates_2000_2018.csv`) | US · county tint with year scrubber | read the Eviction Lab terms and the codebook; proprietary-derived files ship only if the terms allow redistribution of derived rates | rates only |
| 2.4 | **The Year Without Goodbyes** | NYT COVID-19 county data (2020–2022) | US · county tint, deaths per 100k, monthly scrubber | CC-BY-NC 4.0 (allowed: non-commercial) | rates only; nobody named |
| 2.5 | **When the State Kills** | Washington Post fatal police shootings database | US · county rate per 100k, 2015→, year scrubber | CC-BY-NC-SA 4.0 (share-alike applies to the derived layer; noted in licenses) | names, ages, and exact points dropped at staging; county rates only; protocol banner on the plate |
| 2.6 | **The Sky Roads** | OpenFlights airports + routes | world · flows between airports | ODbL; frozen 2014, disclosed on the plate | none |

Population denominators for 2.3–2.5 come from data already in the repo (county
`population_2020` in the faith staging file, which cites the 2020 Census).

**Per-layer acquisition loop (applies to every layer in Phases 2 and 3)**
1. **Gate** — read the terms; record them verbatim in the provenance sidecar. Stop and
   mark PENDING if redistribution is not allowed.
2. **Fetch** — download into `data/raw/` (git-ignored), record URL, date, byte size, and
   SHA-256.
3. **Stage** — a script in `pipeline/scratch/<id>.py` writes `data/staging/<id>.json` and
   `<id>.provenance.json` (method, counts in and out, drops with reasons, caveats).
4. **Validate** (automated, script prints PASS/FAIL):
   - record counts reconcile with the source's own documentation or row count;
   - every coordinate lies inside its declared country or state polygon (catches swapped
     lat/lon, 0,0, and sign errors);
   - no duplicate keys; values in plausible ranges; suppressed or missing values counted;
   - protocol scan: no name, age, or address fields on protocol layers.
5. **Known-answer checks** — three facts about each dataset that are already public,
   written down before looking (e.g., Papua New Guinea holds the most languages; China
   holds the most coal capacity; Los Angeles County holds the most COVID deaths in
   absolute terms). If one fails, find out why before going on.
6. **Hand spot-check** — 10 random records compared against the source rows.
7. **Register** — registry entry with accent, scopes, forms, pack, tip, time, essay
   (what / how / why), caveat, plateStats; DATA_LICENSES.md row; WANTLIST status → ✓.
8. **Look** — build, open the layer solo and in its reading, screenshot, review by eye:
   legible, honest legend, no misleading color ramp, labels not colliding.
9. **Smoke** — the smoke test picks up the layer automatically (draws in solo, plate
   opens, atlas page composes); add a layer-specific check if it has a new form.
10. **Commit** — one commit per layer: `layer(<id>): <source> <vintage> — <count>`.

**Exit criteria:** at least 4 of 6 shipped (2.1 and 2.2 mandatory, they are the world
layers), each with sidecar and license row; page under 5 MB; smoke green.

---

## 5. PHASE 3 — UNLOCK THE NETWORK, THEN THE LIGHT SIDE

These need hosts the environment blocks today. The maintainer adds them under
**Allowed domains** in the environment's network settings. If a host stays blocked, its
layer ships as a PENDING slot with the gate named — never a substitute guess.

| # | Layer | Host(s) to allow | Scope · form |
|---|---|---|---|
| 3.1 | **The Commons** — public libraries, playgrounds, public pools, skateparks, community gardens | `overpass-api.de` | US + world · points with lens by kind |
| 3.2 | **Kindness** — charitable giving as a share of income | `irs.gov` (SOI county data) | US · county tint |
| 3.3 | **The Empty Chair** — people living alone | `api.census.gov` (ACS 5-year) | US · county tint |
| 3.4 | **Love, Counted** — same-sex couple households | `api.census.gov` | US · county tint |
| 3.5 | **The Banished Dark** — night lights | `eogdata.mines.edu` (VIIRS annual composite) | US + world · raster (Phase 0.9) |
| 3.6 | **The Arsenal** — the reserved slot, retried | `atf.gov` | US · cells |
| 3.7 | **The World at War** — conflict deaths | `ucdp.uu.se` (UCDP GED) | world · country or admin-area rates, year scrubber; no names |
| 3.8 | **The Uprooted** — refugee flows by origin and asylum country | `api.unhcr.org` | world · country flows (Phase 0.6) |
| 3.9 | **Dark-sky places** | `darksky.org` | world · points |

Raster budget: night lights are aggregated to ~0.1° (world) and ~0.05° (US) 8-bit grids,
targeting under 600 KB compressed together.

**Exit criteria:** every allowed host's layer shipped through the §4 loop; every
still-blocked host recorded as a PENDING slot with its gate; page under 7 MB.

---

## 6. PHASE 4 — FINDINGS, READINGS, ATLAS (round 2)

New layers exist to be laid against each other. Pre-stated hypotheses, written before
running anything (the correlator records each with its verdict):

| Pair | Question |
|---|---|
| Night lights × UFO sightings | Do sightings need dark skies, or people? (Sightings per capita by darkness band.) |
| Evictions × the sorting | Do counties that evict more also exhale households? |
| Evictions × overdoses | Is the price of staying paid in the same places as the epidemic? |
| Power fuel × data centers | What powers the cloud: share of data-center cells within 50 km of coal vs hydro vs nuclear, by country |
| Endangered languages × remembered births | Where the world remembers people versus where whole languages go silent |
| COVID deaths × connectedness | Did cross-class friendship coincide with lower death rates? |
| COVID deaths × adherence | Did congregational density coincide with higher or lower death rates? |
| The Commons × connectedness | Do places with more shared public space have more cross-class friendship? |
| Living alone × overdoses | The Empty Chair, handled gently (no suicide data, per protocol) |

New readings (titles from the expanded canon): *The Last Speakers*, *What Powers the
Cloud*, *The Price of Staying*, *The Year Without Goodbyes*, *The Commons*, *Where the
Wild Things Are Seen* (night lights × sightings).

The atlas regenerates automatically; its sheets gain a third: *Sheet 3 — The World's
Voices and Furnaces*.

**Exit criteria:** every pre-stated pair run and logged; shipped findings pass §8;
at least 4 new readings; atlas PDF reviewed page by page.

---

## 7. PHASE 5 — RELEASE v0.7

- Docs: README (architecture now registry-packed; pipeline path; compressed payloads),
  CONTRIBUTING (how to add a layer with `pack`, `tip`, `time`), ADDING_A_LAYER
  (schema), EXPERIENCE (mark shipped), WANTLIST (statuses), DATA_LICENSES (every new row,
  non-commercial notice), CLASSROOM.md (guided readings keyed to the two lesson cards).
- About panel: release line, non-commercial notice, new sources.
- Release build committed (`dist: v0.7 build`, `docs: v0.7 Pages copy`).
- PR description updated; WORKPLAN and this plan's STATUS closed out.

---

## 8. THE QC LOOPS (all of them, in one place)

**Loop A — every acquisition:** the 10-step loop in §4. Nothing ships without its sidecar,
its terms on file, its known-answer checks, and a human-eye review of the render.

**Loop B — every build:**
1. `python3 pipeline/build.py` → page-weight ledger; fail above 8 MB.
2. `node tests/smoke.js` → all green (checks grow with each phase).
3. Canonical-view pixel comparison when engine code changed (Phase 0 tolerance).
4. Protocol scan of packed payloads (no names on protocol layers).

**Loop C — every finding:**
1. Hypothesis written in `correlate.py` *before* the run.
2. Thresholds: |r| ≥ 0.20 nationwide, still ≥ 0.15 within states (or within countries
   for world findings), n ≥ 500 units, and a quintile or bucket gap that reads in plain
   numbers.
3. Confound checks: population bands, within-state, and one named plausible confounder
   tested where data allows.
4. Wording review: descriptive verbs only; the card names at least one alternative
   explanation; safe-messaging rules for anything near despair.
5. Verdict logged (SHIPPED / REJECTED / LESSON) with numbers, in `correlate.py`.
6. A deliberately skeptical second read of each shipped card's text before commit.

**Loop D — every phase end:**
1. Full smoke run plus screenshots of every new view, reviewed by eye.
2. Atlas PDF regenerated and reviewed page by page.
3. Headless caveats listed (what was not and cannot be verified here).
4. STATUS table below updated, committed, pushed; PR picks it up.

**Stop rules:** a layer whose terms forbid redistribution becomes a PENDING slot; a
finding that fails a gate is logged, not softened; a page-weight breach blocks the
phase until something is aggregated harder; a protocol scan hit blocks the build.

---

## 9. ORDER AND WHY

Phase 0 first: without compression the page cannot hold one more world layer, and
without registry packing every layer costs engine code. Phase 1 next: zero acquisition
risk, and it exercises the new lens, time, and categorical machinery on data we trust.
Phase 2 then fills the world sheet with the two CC-BY world layers before the
licence-sensitive U.S. layers. Phase 3 waits on network access and can run in parallel
with Phase 2 the moment hosts are allowed. Phase 4 needs the new layers. Phase 5 last.

## 10. STATUS

| Phase | State | Notes |
|---|---|---|
| 0 · foundations | not started | |
| 1 · unlock what we have | not started | |
| 2 · reachable acquisitions | not started | sources verified reachable 2026-11-05 |
| 3 · network unlock | blocked on host allow-list | hosts listed in §5 |
| 4 · findings round 2 | not started | |
| 5 · release v0.7 | not started | |
