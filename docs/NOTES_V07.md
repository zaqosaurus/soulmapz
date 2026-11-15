# FIELD NOTES — v0.7
### What was found, what was decided, what was learned, and what comes next

*Written 2026-11-15, at the end of the v0.7 build (PLAN_V07 Phases 0–3). PLAN_V07.md is the
plan and its scorecard; this file is the surveyor's notebook: the reasons behind the
choices, the numbers that did and did not hold, the bugs and how they were caught, and the
ideas that came up along the way. Read it before Phase 4.*

---

## 1. What v0.7 is, in numbers

| | v0.6 | v0.7 |
|---|---|---|
| Live layers | 15 | **27** (12 new) |
| PENDING slots (gate named on the map) | 2 | 5 |
| Layers on the world sheet | 4 | 10 |
| Page weight | 7.13 MB (uncompressed) | **4.28 MB** (compressed; 8 MB ceiling) |
| Smoke checks | 49 | **82** |
| Atlas | 24 pages | **34 pages**, reviewed page by page |
| Render forms | points, county tint, county flows, cells | + **country tint, categorical tint, great-circle flows, raster, time series on any layer, tooltip templates, colour-by-field, size-by-field** |

New layers: The Last Speakers (Glottolog), The World's Furnaces (WRI), The Year Without
Goodbyes (NYT COVID), When the State Kills (WaPo), The Price of Staying (Eviction Lab), The
Sky Roads (OpenFlights), The World at War (UCDP), The Uprooted (UNHCR), The Last Dark
(Wikidata), Gifts on the Return (IRS SOI), Tables for One and Love, Counted (Census ACS).

Eight unlocks of data the map already carried: UFO shapes and decades, Superfund replayed
1983→2026, omen feature classes, the 5,000 brightest by calling, data-center operators
(from OSM's tag, not name-guessing) and the AI build-out, faith families, the sorting in
people.

---

## 2. Findings

### Tested and rejected (both pre-stated, both logged in `pipeline/correlate.py v07`)

**H17 — "The thrones are exhaling."** The early number (64% of Fortune 500 headquarters
counties lose households, vs 48% of other counties) looked like a story about capital and
flight. Against size-matched controls (each HQ county vs the 10 non-HQ counties nearest in
population) the gap is **65% vs 58%** — under the 10-point bar set before running.
Within states the sign holds (HQ county below its controls in 96 of 144) but the effect is
small. *Lesson:* most of the raw contrast was size. Big counties lose households; HQs sit in
big counties.

**H18 — "The price per head."** The early number ($312 per resident in small towns vs $4.27 in
big cities) came from loose denominators. With verified 2020 populations for the 18 Ledger
entries where the victim is the residents' own government, the medians are **$270 vs $141 —
1.9×**, under the pre-stated 5× bar. 26 entries were excluded by rule: 13 bribery/kickback
cases (no cost per resident is defined), 8 special districts (school, water, utility), 5 mixed
victims. *Lesson:* the most quotable number in the project died the moment its denominator
was checked. The per-resident figure itself is a fact and now rides on 18 Ledger tooltips
(Dixon, IL: $3,516 per resident).

### Observations printed on plates (descriptive, verified, not finding cards)

These were checked against the data before the essay said them; several essay drafts were
corrected by the check.

- **Omens by feature:** 89% of Gaps and 84% of Ridges carry a devil's name; 86% of Towns took
  an angel's or a paradise's (overall: 70% devil). We fear the passes and bless where we live.
- **Superfund replay:** 406 sites standing in 1983 → 1,343 in 2026, which equals EPA's own
  "final" count — the strongest known-answer check of the build.
- **COVID quarters:** spring 2020 was New Jersey, New York *and southwest Georgia* (the Albany
  cluster tops 2020 Q2; NYC is sixth). The draft's "Appalachia in the winters" was **not**
  supported and was cut. Whole-state spikes (Kansas 2021 Q2, Nebraska 2022 Q4) look like
  batch reporting and the plate says so.
- **Police killings:** New Mexico 10.1 and Alaska 9.1 per 100k over the decade; Rhode Island,
  Connecticut, Massachusetts, New York near 1 — a tenfold gap. A draft sentence linking it to
  "where help is far and guns are near" was speculative and was cut.
- **Evictions:** Maryland fills the top of the list because its rent courts allow a new filing
  every month rent is late. The Dakotas and Wyoming barely register; Idaho and Montana are
  middling (the draft's "rural West" was wrong and was narrowed).
- **War:** the five-year periods read Rwanda/Bosnia → Congo → Ethiopia → Syria → Tigray/Ukraine →
  Ukraine/Sudan (2025). Rwanda 1989–94 is the darkest cell on the map (5,339 per 100k).
- **Refugees:** most of the uprooted live one border away. Venezuela only becomes the largest
  origin once UNHCR's "other people in need of international protection" is counted.
- **Gifts on the Return:** two maps in one — tithing (Utah holds 12 of the top 50 counties)
  and wealth (Bentonville, Aspen, Jackson Hole, Manhattan).
- **Love, Counted:** three counties in four are too thinly sampled to say anything. The honest
  reading of that layer is its dark.

### Candidate findings for Phase 4 (not yet run — pre-state before running)

See PLAN_V07 §6. Additions and corrections from this build:
- **Living alone × overdoses** is listed in §6 as "The Empty Chair" — that title is already
  taken by the connectedness finding. Rename before shipping (e.g. *Tables for One, Again*).
- **COVID deaths × connectedness**, **COVID × adherence**, **evictions × the sorting**,
  **evictions × overdoses**, **power fuel × data centers**, **languages × remembered births**
  are all runnable now.
- **Night lights × UFO sightings** and **The Commons × connectedness** wait on PENDING slots.
- New, runnable: **police killings × living alone** (isolation and crisis calls), **war
  deaths × endangered languages by country** (the essay hints at it; test it), **gifts ×
  adherence** (does itemized giving track congregations once income is controlled?),
  **same-sex couples × the sorting** (where do the reliable estimates sit on the migration
  map?). Use only the 763 reliable county estimates for the last one.

---

## 3. Judgment calls (and why)

| Call | Reason |
|---|---|
| IRS giving shipped as **Gifts on the Return**, not "Kindness" | Only 9.6% of 2022 returns itemize (7.6% claim a gift); county itemization tracks wealth (0–29%). The data is honest about itemized gifts and dishonest as "generosity". The Kindness slot stays PENDING for a real measure. |
| Census same-sex estimates with CV > 30% are **left untinted** | 2,459 of 3,222 counties. Colour would turn sampling noise into geography. The tooltip still shows the estimate, its margin and the word "unreliable". |
| UNHCR flows include **other people in need of international protection** | It is UNHCR's own headline category, and without it 5.9 million people (2.8M Venezuelans in Colombia) vanish. |
| WaPo: **every county present, zeros included** | A county with no recorded killing is a zero, not a gap. Names, ages, race and exact points are dropped *at staging*. |
| WaPo placement: coordinates → county name → **city centre** | Raised placement from 92% to 98.4%. The city-centre fallback can mis-assign a city that spans counties; disclosed. |
| NYT COVID: NYC's combined rate **shown on all five boroughs** | The source reports NYC as one unit; splitting it would invent data. |
| NYT COVID: negative quarterly revisions **clamped to zero** | 157 cases; the overall rate uses the final cumulative count, so totals stay exact. |
| Eviction Lab: **model estimates only**, not the proprietary-count files | The estimates are published under ODC-BY; the counts carry a different provenance. |
| OpenFlights: corridors with **two or more airlines** | 18,858 pairs drawn would be a white sheet; 8,362 keep it legible. Disclosed. |
| UCDP: **today's population** as the denominator for every period | No population series was reachable (World Bank blocked); disclosed on the plate. |
| Dark-sky places from **Wikidata**, not DarkSky International | darksky.org runs a bot challenge; the survey does not get around bot checks. Disclosed as a partial mirror. |
| Data-center joint ventures filed under **one named partner** | The operator lens needs one code per facility; the raw operator string is shown on hover so nothing is hidden. |
| Star "callings" are the **survey's own fold** of Pantheon domains | Nine groups; the mapping is in `pipeline/build.py` (STAR_GROUP) for anyone to dispute. |
| Census terms page not read | www.census.gov stayed refused even after `*.census.gov` was allowed. Basis recorded instead: U.S. government work, 17 U.S.C. § 105. Read it when the host opens. |

---

## 4. Bugs found, and how

Most of these were caught by looking — a screenshot, an atlas page — not by a failing
assertion. That is the argument for keeping the render review in every loop.

| Bug | Caught by | Fix |
|---|---|---|
| Era bar did not follow a soloed timed layer | fixture smoke check | `openPlate`/`closePlate` call `eraRefresh()` |
| Opening a world-only layer's plate from the U.S. sheet stayed on the U.S. sheet | code read while fixing the above | switch to the layer's sheet |
| A tooltip outlived its layer after solo changed | fixture screenshot | hide unpinned tips on solo change |
| **Adding a layer silently changed what old shared links show** (layer bits were positional over rail order) | noticed when The Last Speakers took slot 2 | frozen v0.6 order + appended layers (`HASH_ORDER`); smoke-checked |
| The 13-step era bar ran under the rail, then under the plate | screenshot; smoke click intercepted | bar centred between rail and plate; label tag yields when space is short |
| Great circles over the pole traced the sheet's top edge | Uprooted screenshot | pen lifts above 78° |
| Russia's centroid in the Bering Sea | coordinate spot-print | spherical vertex mean |
| 35k additive glows washed to white (plants), 8k arcs to a sheet (sky roads) | screenshots | per-layer `size.alpha/core`, `flowStyle` |
| Validator false alarms: antimeridian polygons, small islands stepped over | validator output (Salekhard "offshore", Oahu "offshore") | continuous ring unwrap; ring probes every 0.1° |
| Canadian/Mexican plants on the U.S. sheet | screenshot | registry `scopeFilter` |
| Fallback page stale → false "data differs" failure | smoke | build always writes the plain page |
| UFO plate counted records, chips counted reports | atlas review | plate stat from report counts |
| World-first layers printed on the U.S. sheet in the atlas | atlas review | plate uses `scopes[0]` |
| Colophon/About credited only v0.6 sources (NYT credit and share-alike notices missing) | atlas review | all v0.7 sources credited |
| Two Census plates printed no stats: a **duplicate registry key** kept the empty one | atlas review | fixed; `build.py` now refuses duplicate keys |
| Lens chip counts were groups, not reports, on aggregated layers | reconciling chips against staging | weighted lens counts |

**Headless noise floor:** the Great Sorting view varies ~1.2% between two runs of the *same*
build (progressive baking on the frame clock), and the Meta view ~0.1%. `tests/views.js`
carries a per-view tolerance; anything over it is investigated against the previous build
before code changes.

---

## 5. Access log (what the environment allowed)

| Host | State | Used for |
|---|---|---|
| raw.githubusercontent.com | works | Glottolog, WRI, NYT, WaPo, OpenFlights |
| eviction-lab-data-downloads.s3.amazonaws.com | works | evictions |
| www.irs.gov | works | gifts (and v0.5 migration) |
| ucdp.uu.se | works | conflict deaths |
| api.unhcr.org | works | refugee flows |
| query.wikidata.org | works (incl. `mwapi` entity search) | dark-sky places, populations, ISO codes |
| www2.census.gov | works since 2026-11-15 (maintainer allowed) | ACS summary files — no key needed |
| api.census.gov | reachable, but every data query redirects to `missing_key` | — |
| www.census.gov | refused by the proxy | Census terms page |
| www.atf.gov | origin bot gate (403) | The Arsenal — PENDING |
| overpass-api.de, overpass.kumi.systems | connection never completes | The Commons — PENDING |
| eogdata.mines.edu | certificate fails | night lights — PENDING |
| darksky.org | bot challenge | (Wikidata instead) |
| api.worldbank.org, www.wikidata.org, openflights.org, www.unhcr.org, countyhealthrankings.org | refused | worked around (Wikidata, repo source, search excerpt) |

---

## 6. Known weaknesses and debt

- **No numeric colour legend on tint layers.** A reader sees light and dark but not what
  "dark" means. Categorical layers have a legend; sequential ones don't. (Top idea below.)
- **Flows have no hover.** You cannot ask an arc where it goes or how many people it carries.
- **Plate stats are hand-written** in the registry and can drift from the data (the UFO and
  Census plates both drifted this build). They should be computed at build time.
- **Seven layers still use per-layer build code** (memory, desire, crashes, fortune500,
  fulfillment, ledger, sorting). Migrating them to `pack` blocks would finish Phase 0.3.
- **The rail is long** (32 entries). With more layers, discovery suffers; themes may need to
  collapse, or sheets need curated layer sets.
- **Canonical views need a re-baseline** — the v0.6 baseline no longer matches by design
  (new layers in the rail). Do it at release and commit the PNG hashes.
- **Smoke takes several minutes**; a worker restart killed one run mid-way. A fast/slow split would
  make the loop cheaper.
- **Phone width is checked only for the recorder and drawer.** The new era bar, plates with
  toggles, and world flows were not checked at 390 px.
- **Two atlas plates are very dim** (Fulfillment, Ledger) — legible on screen, faint in print.
- **The Census terms page** has not been read (host refused).
- **Version string** is 0.7.0-dev until the Phase 5 release.

---

## 7. Ideas to make the survey better

### Engine and reading experience
1. **Legends that count.** A slim ramp on every sequential tint: min, median, max, the unit,
   and the vmin/vmax actually used. Generated from the payload, so it cannot drift.
2. **Bivariate counties.** The survey's core gesture is stacking, but two county tints today
   just overlap. A 3×3 bivariate scheme (e.g. living alone × overdoses) would let a reader *see*
   a Phase 4 finding before reading it — and see where it fails.
3. **Arc hover.** Nearest-arc picking for flows: origin, destination, count. The Uprooted
   deserves it most.
4. **Computed plate stats.** `plateStats` entries that name a function (`max`, `median`,
   `count`, `share`) over the payload instead of a literal string.
5. **"What's here" for a county across every layer** — the dossier already does this for v0.5
   layers; extend it to the twelve new ones automatically from the registry.
6. **Download this layer** button on each plate: the staging JSON and the sidecar, with the
   licence line — the Data API, one click away.
7. **Sheet 3** in the atlas (*The World's Voices and Furnaces*) and a per-reading atlas: print
   just the pages a citizen reading visits.
8. **Accessibility pass:** keyboard order through the rail and plates, focus rings, and a
   colour-blind check of the faith families palette and the fuel colours.
9. **Performance:** move great-circle sampling and county-tint baking to a Web Worker; the
   world sheet with flows on is the slowest view.

### Data (now reachable — www2.census.gov is open)
10. **Languages spoken at home** (ACS B16001) by county — the U.S. half of The Last Speakers.
11. **Where America was born** (ACS B05006, place of birth for the foreign-born) — world →
    county flows into the U.S., a natural partner to The Uprooted.
12. **Rent burden** (ACS B25070) — the cost side of The Price of Staying.
13. **The long commute** (ACS B08303, 60+ minutes) — Motion, in hours of people's lives.
14. **Child poverty** (SAIPE, already listed by the census-gov provider) — the Childhood family.
15. **Bars vs. churches** (County Business Patterns, NAICS 7224 vs 8131) — on the wantlist since
    v0.5; CBP bulk files sit on www2.census.gov.
16. **The Commons without Overpass:** Geofabrik regional extracts (download.geofabrik.de) of
    OpenStreetMap — libraries, playgrounds, pools — filtered offline. Ask to allow that host.
17. **Night lights without eogdata:** NASA Black Marble (VNP46) via LAADS or Earthdata would
    need hosts and an account; alternatively a published, openly-licensed coarse composite.
18. **WARN layoffs:** the ~30 open state WARN pages, scraped politely, one parser per state —
    the original pending slot's redemption.

### Process
19. **CI:** a GitHub Action that builds and runs `tests/smoke.js` on every push to the PR, so a
    stop-and-restart worker never has to be the only witness.
20. **Sidecar schema check:** `validate.py` should also verify the provenance file has a
    licence, SHA-256 per file, known answers and a spot-check line — the §4 loop as a lint.
21. **Plate-number reconciliation test:** for each layer, every number in its plate stats must
    be found in (or computed from) its staging data.
22. **One staging script per layer, re-runnable from `data/raw/`** is now the norm — finish it
    by adding a `make`-style `pipeline/refresh.py <id>` that re-downloads, re-stages,
    re-validates and prints the diff in counts.

---

## 8. Thoughts

The plan's discipline paid for itself. The two most quotable numbers of the build — the
thrones exhaling and the price per head — were written down with their bars *before* running,
and both failed honestly. Without the pre-stated gates both would be on the Findings page
today, and both would be wrong in the way that matters: a size effect and a denominator.

The other recurring lesson was that **the render is a test**. The atlas review found more
real defects than any assertion did: missing credits, wrong sheets, a stale count, empty stat
blocks. Counts and checksums prove the data arrived; only looking proves the page tells the
truth about it.

Three choices shaped the character of v0.7 and are worth defending if challenged: renaming
the IRS layer rather than shipping it as kindness; leaving three quarters of the same-sex
couples map dark rather than colouring noise; and keeping every gated source as a visible
PENDING slot rather than a substitute. Each makes the map less impressive at a glance and
more trustworthy on inspection, which is the trade the survey exists to make.

The survey is now heavier on loss than on light: war, police killings, COVID, evictions,
overdoses, suicide, crashes. The light side has languages, dark skies, gifts, love counted,
and the commons still pending. Phase 4 and the next acquisitions should lean toward the light
— the commons, kindness that does not require itemizing, the places people gather — not to
balance the books but because a survey of the soul that only measures wounds is not
complete.
