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
   **Removal on request:** anything is taken down when a person represented in it or a
   rights holder asks. The request channel is the issue tracker until a dedicated contact
   method exists (Phase 5 adds it to About, README, and the atlas).
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
| 0 · foundations | **done** 2026-11-05 | 7.13 → 2.85 MB (gzip+base64, DecompressionStream; plain fallback written beside the page and checked for identical data). Page-weight ledger per payload. `pipeline/packer.py`: registry-declared packing (9 layers migrated; `check_pack.py` proved identical payloads). Time everywhere, county + country tint, categorical tint with legend, great-circle flows, raster, tooltip templates — each proven on smoke fixtures that never ship. Canonical views (`tests/views.js`) unchanged except the era-bar strip. Figures as of the end of Phase 0: 2.85 MB, smoke 64/64. **Current (2026-11-06): 4.11 MB, smoke 82/82.** |
| 1 · unlock what we have | **done** 2026-11-05 | All 8 unlocks live; lens/time counts reconcile with staging (Superfund 2026 = EPA's 1,343 final). Findings: H17 thrones and H18 price-per-head both **rejected** at their pre-stated bars (logged in `correlate.py v07`); per-resident theft now on 18 Ledger tooltips. **Gate found:** api.census.gov now requires an API key in the URL (redirects to missing_key) — affects Phase 3.3/3.4. Figures as of the end of Phase 1: 2.95 MB, smoke 73/73. **Current (2026-11-06): 4.11 MB, smoke 82/82.** |
| 2 · reachable acquisitions | **done** 2026-11-06 | **6 of 6 shipped**, each through the §4 loop (terms on file, SHA-256, `pipeline/validate.py`, known answers, 10-record spot check, render reviewed): The Last Speakers (Glottolog 5.3, 7,836 languages, CC-BY), The World's Furnaces (WRI v1.3.0, 34,936 plants, CC-BY), The Year Without Goodbyes (NYT county COVID, non-commercial licence), When the State Kills (WaPo Fatal Force, county rates only, CC-BY-NC-SA), The Price of Staying (Eviction Lab estimates, ODC-BY — gate passed), The Sky Roads (OpenFlights, ODbL). 4.06 MB after Phase 2. Fixes found on the way: permalinks now address layers in a frozen v0.6 order (adding layers no longer changes old links); era bar fits between rail and plate. |
| 3 · network unlock | **done** 2026-11-06 | **Shipped:** The World at War (UCDP GED 26.1, CC BY, Wikidata populations), The Uprooted (UNHCR end-2024, 44.8M people, CC BY), The Last Dark (Wikidata, 164 dark-sky places, CC0). **PENDING with gates named on the plate and in the colophon:** Tables for One and Love, Counted (Census API now demands a key in the URL; bulk host unreachable), Kindness (IRS data reachable but counts only itemized gifts — 9.6% of returns — so it would map wealth: a measurement gate), The Banished Dark (VIIRS host fails certificates; raster engine ready), The Commons (Overpass connections do not complete), The Arsenal (ATF bot gate, 403, not circumvented). Blocked here and worked around: World Bank API, www.wikidata.org, openflights.org, www.unhcr.org (terms read from the repository source or a search excerpt). |
| 4 · findings round 2 | not started | Next goal. New layers to lay against each other: COVID × connectedness, police killings × the Arsenal slot, eviction × the Sorting, war × languages. Pre-state each hypothesis in `correlate.py` before running. |
| 5 · release v0.7 | not started | |

**Goal scorecard (the v0.7 goal: Phases 0–3), verified 2026-11-06**

| Goal item | Outcome | Evidence |
|---|---|---|
| Phase 0 foundations (0.1–0.9) | done | commits c3f5f0e…; smoke fixtures for country tint, world flows, timed layer, categorical legend, raster, tooltip template; `check_pack.py` equivalence; `tests/views.js` comparison |
| Phase 1 unlocks 1.1–1.8 | done, all 8 live | lens and time counts reconcile with staging (script checks in the commit messages); smoke checks per lens/toggle |
| Finding: price per head | **rejected** at its pre-stated bar (1.9× < 5×) | `correlate.py v07` H18; per-resident figure on 18 tooltips |
| Finding: thrones exhaling | **rejected** at its pre-stated bar (7 < 10 points vs size-matched) | `correlate.py v07` H17 |
| 2.1 Glottolog (mandatory) | shipped | layer(memory-languages) |
| 2.2 WRI power plants (mandatory) | shipped | layer(power-plants) |
| 2.3 Eviction Lab | shipped (terms gate passed: ODC-BY) | layer(motion-eviction) |
| 2.4 NYT COVID | shipped | layer(loss-covid) |
| 2.5 WaPo police shootings | shipped, county rates only | layer(control-police) |
| 2.6 OpenFlights | shipped | layer(motion-skyroads) |
| 3.3 Census — living alone | **PENDING** (Census API requires a key in the URL; bulk host unreachable) | registry `company-alone` pendingNote; colophon |
| 3.4 Census — same-sex couples | **PENDING** (same gate) | registry `company-love` |
| 3.2 IRS giving | **PENDING** — measurement gate (itemized-only data would map wealth) | registry `company-kindness`; 9.6% itemize (2022) |
| 3.7 UCDP conflict deaths | shipped | layer(control-war) |
| 3.8 UNHCR refugee flows | shipped | layer(motion-uprooted) |
| 3.9 Wikidata dark-sky places | shipped | layer(wonder-darksky) |
| Smoke green with checks per new form and layer | 82/82 | `tests/smoke.js` (fixtures section; every point/flow layer solo; every timed layer scrubs; Phase 1 lenses) |
| Page under 8 MB | 4.11 MB | build ledger |
| Atlas reviewed page by page | 31 pages at 75 dpi + text scan; 6 defects fixed | commits "atlas: plates use…", "atlas review: credit every v0.7 source…" |
| STATUS updated, pushed to PR #1 | this table | branch `claude/trusting-sagan-wkfcpi` |

---

## 11. HANDOFF (read this first when resuming)

**State on 2026-11-06.** Branch `claude/trusting-sagan-wkfcpi`, PR #1 open (not merged, by choice).
Phases 0–3 of this plan are done (see STATUS). 24 live layers (9 new in v0.7) + 7 PENDING slots, page 4.11 MB of 8,
smoke 82/82, atlas 31 pages reviewed page by page at 75 dpi (text scanned for template errors; colophon
credits every new source and its share-alike duty). Version string is 0.7.0-dev until the Phase 5 release. Next: Phase 4 (findings round 2), then Phase 5
(release: dist/docs commit, README/CONTRIBUTING/CLASSROOM, contact method for removal requests).

**New tools since v0.6**
- `pipeline/packer.py` — registry `pack` blocks (points/regions/flows/raster; enum, year, decade, str,
  int, float; `aggregate`, `time`, `category`, `lenses`, `coordNd`). Per-layer branches remain only for
  memory, desire, crashes, fortune500, fulfillment, ledger, sorting.
- `pipeline/validate.py <id> [--protocol] [--us]` — acquisition step 4; island exceptions must be
  hand-reviewed and recorded in the sidecar (`validation.reviewed_offshore`).
- `pipeline/check_pack.py [ref]` — payload equivalence for engine refactors.
- `tests/views.js <out> [baseline]` — canonical-view pixel comparison (re-baseline after content changes).
- `pipeline/scratch/<id>.py` — one staging script per acquired layer; raw files in `data/raw/` (git-ignored).
- Registry display keys: `colorBy`, `size`, `tip` (`ti`, `ti2`, `s`), `scopeFilter`, `tintMax`, `flowStyle`,
  `time`, `categories` (toggle), `protocol`, `pendingNote`.

**Headless caveats (not verifiable here):** sound, GPU performance on real devices, touch gestures,
the print dialog itself (the PDF is produced by the test), clipboard.

**Commands**
```bash
python3 pipeline/build.py                       # ~3 s; prints the page size; regenerates docs/DATA_API.md
NODE_PATH=$(npm root -g) node tests/smoke.js    # 82 checks; SHOTS=<dir> saves screenshots + atlas.pdf
python3 pipeline/correlate.py                   # v0.5 findings; `... v06` for v0.6; `... v07` for H17/H18
python3 pipeline/validate.py <layer-id> [--protocol] [--us]   # acquisition step 4
python3 -I pipeline/scratch/<layer-id>.py       # re-stage an acquired layer from data/raw/ (re-download first)
git checkout -- dist/index.html docs/index.html # after every build until a release commit
```

**Working rules learned the hard way**
- Do not commit `dist/index.html` or `docs/index.html` until a release commit (maintainer's choice).
- Edit `registry/registry.json` by text, not by `json.dump`, or the whole file reformats.
- A headless failure says where to look; change code only when the cause is in the code or
  reproduces on the previous build. Review renders and the atlas PDF by eye, not just counts.
- Never get around a site's bot check (no browser User-Agent spoofing). Send an honest
  User-Agent naming the project. A site that refuses scripts becomes a PENDING slot.
- `app.js` is one IIFE; new code goes before `// ---------- zoom ----------`; `init()` wires DOM.
  New DOM ids must exist in `site/template.html` or `init()` throws and the page dies.
- Commit trailers come from the session's attribution reminder. No model ids anywhere in the repo.

**Network (verified 2026-11-06):** works — raw.githubusercontent.com, the Eviction Lab S3 bucket,
www.irs.gov, ucdp.uu.se, api.unhcr.org (`/population/v1/...`), query.wikidata.org (including its
`wikibase:mwapi` entity search). **Changed since 11-05:** api.census.gov is reachable but every data
query now redirects to `missing_key` (an API key in the URL is required). Fails — www.atf.gov (origin
bot gate, 403), overpass-api.de and overpass.kumi.systems (connection never completes), eogdata.mines.edu
(certificate), darksky.org (bot challenge), api.worldbank.org, www.wikidata.org, openflights.org,
www.unhcr.org, www2.census.gov (proxy refuses: not on the allow list). Everything else is untested.

**Next action:** Phase 4 — write the round-2 hypotheses into `correlate.py` (a `v08` block) before
running anything, then the readings and atlas pages for the new layers.
