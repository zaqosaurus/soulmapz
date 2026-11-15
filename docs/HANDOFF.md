# HANDOFF — read this first

*For the next agent working on THE SOUL SURVEY. Written 2026-11-15 at the end of v0.7
(PLAN_V07 Phases 0–3). Keep this file current: update it at the end of every working session.*

## 1. What this project is

A single self-contained web page (`dist/index.html`, ~4.3 MB, zero runtime network calls)
that maps "the collective soul" in real, sourced data: births of the remembered, data centers,
crashes, overdoses, languages going silent, wars, refugees, evictions, dark-sky places, and more —
27 layers, each with a what/how/why essay, a provenance sidecar and an honest caveat. Layers
stack into terrain; findings are descriptive ("where, not why"). It is **non-commercial**, and
anything is removed on request.

Repository: `zaqosaurus/soulmapz`. Work happens on a feature branch, then reaches `main`.

## 2. Read in this order

1. **This file.**
2. [`docs/PLAN_V07.md`](PLAN_V07.md) — §1 standing rules (binding), §6 Phase 4, §7 Phase 5,
   §8 QC loops, §10 status table and goal scorecard.
3. [`docs/NOTES_V07.md`](NOTES_V07.md) — findings kept and rejected, the judgment calls and
   why, every bug and how it was caught, known debt, 22 ideas.
4. [`docs/ADDING_A_LAYER.md`](ADDING_A_LAYER.md) — the acquisition workflow and the registry
   `pack` block reference.
5. [`docs/WANTLIST.md`](WANTLIST.md) — the protocol (binding) and the data wish list.
6. Skim `pipeline/correlate.py` (findings and their logged verdicts) and `registry/registry.json`.

## 3. State on 2026-11-15

| | |
|---|---|
| Version string | `0.7.0-dev` (the Phase 5 release sets `0.7.0`) |
| Live layers / PENDING slots | 27 / 5 (The Banished Dark, The Commons, The Arsenal, Kindness, Notice of Mass Layoff) |
| Page weight | 4.28 MB of an 8 MB ceiling (compressed payloads) |
| Smoke test | 82/82 (`tests/smoke.js`) |
| Atlas | 34 pages, reviewed page by page on the final build |
| Findings | 10 cards on the page; v0.7's two hypotheses (H17, H18) were **rejected** and logged |
| Branch | `claude/trusting-sagan-wkfcpi`, fast-forwarded into `main` on 2026-11-15 |
| Built page in git | **still the v0.5 build** in `dist/index.html` and `docs/index.html` — by the maintainer's rule the built page is committed only in the release commit (Phase 5). GitHub Pages therefore still shows v0.5 until then. |

## 4. The maintainer — how they work

- Wants **commits and pushes as you go**, not one big push at the end.
- Wants **few chat messages**: report what matters, not every step. They are not watching live.
- Likes `/goal` for long runs with a clear done-condition.
- Prefers **adding before polishing**; will tell you if they disagree.
- Asks you to **ask questions first** when a decision is genuinely theirs (scope, publishing,
  credentials, allowing hosts). They add allowed hosts on request — name the exact host.
- Binding project rules they set (also in PLAN_V07 §1):
  - Non-commercial; CC-BY-NC sources are fine; removal on request (contact via the issue tracker
    until a contact method exists — Phase 5 adds one; ask them what it should be).
  - **The dead are not named unless notable** (in the memory layer or on Wikidata with a
    Wikipedia article). Death data ships as rates or counts for places; name fields are dropped
    at staging.
  - **Read and record each source's terms.** Facts are free; licences and site terms still bind.
  - **Never get around a bot check.** A site that refuses scripts becomes a PENDING slot.
  - **Headless rule:** a failing headless check says where to look; change code only when the
    cause is visible in the code or reproduces on the previous build. Don't over-correct for
    headless quirks.
  - No `dist/index.html` or `docs/index.html` commits except the release commit.

## 5. Commands

```bash
python3 pipeline/build.py                        # ~5 s; weight ledger per payload; fails above 8 MB
NODE_PATH=$(npm root -g) timeout 590 node tests/smoke.js   # 82 checks, several minutes; SHOTS=<dir> saves screenshots + atlas.pdf
git checkout -- dist/index.html docs/index.html  # after every build until the release commit
python3 pipeline/validate.py <id> [--protocol] [--us]      # acquisition step 4
python3 pipeline/check_pack.py [ref]             # payload equivalence after packer/engine refactors
NODE_PATH=$(npm root -g) node tests/views.js <out> [baseline]   # canonical-view pixel comparison
NODE_PATH=$(npm root -g) node tests/look.js <id> <us|world> <out.png> [lens]   # solo one layer and screenshot it
python3 pipeline/correlate.py v07                # H17/H18; add a `v08` block for Phase 4
python3 -I pipeline/scratch/<id>.py              # re-stage a layer from data/raw/ (re-download first; raw is git-ignored)
```

Registry edits from Python (keeps hand formatting, refuses duplicate keys):

```python
import sys; sys.path.insert(0, "pipeline")
from regedit import set_key, add_layer
```

## 6. Environment notes (cloud container)

- Outbound HTTPS goes through an agent proxy; status at `$HTTPS_PROXY/__agentproxy/status`.
  Send an honest User-Agent naming the project:
  `THE-SOUL-SURVEY/0.7 (non-commercial open data map; https://github.com/zaqosaurus/soulmapz)`.
- **Reachable:** raw.githubusercontent.com, the Eviction Lab S3 bucket, www.irs.gov, ucdp.uu.se,
  api.unhcr.org, query.wikidata.org (its `wikibase:mwapi` service does entity search),
  **www2.census.gov** (ACS summary files, no key). **Not:** api.census.gov data (needs a key),
  www.census.gov, www.atf.gov (bot gate), Overpass, eogdata.mines.edu, darksky.org, World Bank,
  www.wikidata.org, openflights.org, www.unhcr.org, countyhealthrankings.org. Full log:
  NOTES_V07 §5. Firecrawl tools can read public pages (used to read UNHCR's terms).
- Playwright + Chromium are pre-installed; use `NODE_PATH=$(npm root -g)`. Don't reinstall.
- **The worker process can restart mid-task.** Commit and push small and often; a long smoke
  run can be killed (exit 137) — just rerun it. Untracked scratch work is lost on restart.
- Put temporary files in the session scratchpad, not `/tmp`. Read downloaded data with `python3 -I`.

## 7. Gotchas that cost time

- **Registry:** edit by text or with `pipeline/regedit.py`. A duplicate key silently wins in
  JSON — it once blanked two atlas plates. The build now refuses duplicates.
- **Permalinks:** layers are addressed by position in `HASH_ORDER` (`site/app.js`): the frozen
  v0.6 order plus every later layer appended in registry order. Never reorder it; new layers
  are appended automatically.
- **`site/app.js`** is one IIFE. New DOM ids must exist in `site/template.html` or `init()`
  throws. New code goes before `// ---------- zoom ----------`.
- **Time:** the era bar belongs to the first *active* timed layer in rail order; `eraFor(lid)`
  returns the era only for that layer. Solo view changes which layer that is.
- **Tints:** a region `value` of `null` is shown in the tooltip but not coloured. Series get their
  own colour scale (`vmaxT`). `vminQuantile` and `tintMax` fix low-contrast layers.
- **Additive light:** dense point and flow layers wash to white; tune `size.alpha/core` and
  `flowStyle`.
- **Validator:** small oceanic islands are missing from the 1:50m coastline; record them as a
  hand-reviewed exception in the sidecar (`validation.reviewed_offshore`).
- **Headless noise:** the Great Sorting view varies ~1.2% between identical runs; `tests/views.js`
  carries a per-view tolerance. The canonical-view baseline is v0.6 and needs re-baselining at release.
- **Essays:** check every number and every causal-sounding sentence against the data before it
  ships. Four drafts in v0.7 were wrong (NOTES_V07 §2).
- **Smoke clicks** can be intercepted by the plate or era bar; that has twice been a real layout
  bug, not a test bug — look at a screenshot before changing the test.

## 8. What's next

**Phase 4 — findings, readings, atlas (round 2).** PLAN_V07 §6 lists 13 hypothesis pairs; 11 are
runnable now (two wait on PENDING slots). Write each hypothesis and its bar into a `v08` block in
`pipeline/correlate.py` *before* running it; ship only what passes §8; log every verdict. Build at
least 4 new readings, add atlas Sheet 3, and re-verify The World at War essay's open question
(war × endangered languages) — it is phrased as untested on purpose.

**Phase 5 — release v0.7** (PLAN_V07 §7): version `0.7.0`, the release commit with `dist/` and
`docs/index.html`, README/CONTRIBUTING/CLASSROOM, a removal-request contact method, re-baselined
canonical views.

**Decisions only the maintainer can make** (ask, don't assume):
- The removal-request contact method (an email, a form, the issue tracker?).
- When to cut the release commit (it makes GitHub Pages show v0.7).
- Allowing more hosts for PENDING slots: `www.census.gov` (to read the Census terms page),
  `download.geofabrik.de` (The Commons from OpenStreetMap extracts), an Earthdata host
  (night lights).

**Good next ideas** are ranked in NOTES_V07 §7 — the strongest: numeric legends on every tint,
bivariate county maps, arc hover, plate stats computed from data, CI running the smoke test.

## 9. How to finish a session well

Run the build and the smoke test; look at what you changed; regenerate and read any atlas page
you touched; update PLAN_V07's status table and this file; commit with a clear message; push.
Say in one short message what changed and anything that needs the maintainer.
