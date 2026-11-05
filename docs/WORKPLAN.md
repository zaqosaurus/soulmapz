# THE WORKPLAN — v0.6
### "the ledger lit, citizen readings, constellations, the plunge, the living log"

This document is the working plan for the v0.6 release, written so that any session
(human or agent) can pick the work up mid-stream. It records what was found, what was
decided, what is done, and what remains — file by file. Update the STATUS table as
work lands; delete this file (or fold it into the SURVEY LOG) when v0.6 ships.

Branch: `claude/trusting-sagan-wkfcpi`. Base: `main` at `24977f2` (v0.5 Pages copy).

---

## 1. DIAGNOSIS (what v0.5 actually does, verified by running it)

The build is reproducible: `python3 pipeline/build.py` regenerates `dist/index.html`
byte-for-byte from the committed inputs (7.05 MB, under the 8 MB ceiling). Playwright
loads the page with zero console errors. The map is gorgeous. But:

1. **The Ledger of Betrayals renders nothing.** `site/app.js` has no draw path, sprite,
   tooltip, label, index entry, or audio voice for `betrayal-ledger`. The layer only
   contributes faint hillshade (weight 0.3). This is the maintainer's #1 wantlist item
   and the subject of a reading — the reading opened onto a blank screen.
2. **Three readings fly into nowhere.** `flyTo()` projects the four corners of a bbox;
   `d3.geoAlbersUsa` returns `null` for ocean corners, so a country-wide bbox
   `[[-125,24],[-66,50]]` yields one valid corner, a degenerate extent, and k=26 zoomed
   onto empty ocean. Affected: *The Dark States*, *The Great Sorting*, *The Ledger of
   Betrayals* (verified at 1600×950 and 1366×768).
3. **Permalinks are not portable.** The hash stores the camera as pixel `x/y`, which
   only reproduces the view on a screen of the same size.
4. **Touch users get nothing from hover.** Tooltips are hover-only; a tap does nothing.
5. **The registry principle was violated silently.** "Adding a layer never requires
   touching engine code" — but an unknown point layer draws nothing. Needs a default voice.
6. **Stale copy.** Orientation says "Seven instruments" (15 live). About says one layer
   is pending (two are). Repo/site URLs are hard-coded to `ansalamalasna/soulmap`
   although this checkout's remote is `zaqosaurus/soulmapz`.
7. **The v0.5 heat layers are absent from the dossier** (suicide, connectedness,
   adherence, the sorting) and have no audio voices.
8. **Network from the build environment**: atf.gov, data.cdc.gov, geonames, NASA and
   darksky are unreachable; raw.githubusercontent.com is reachable but the candidate
   community datasets (BFRO, haunted places) are DVC-tracked, not committed. **No new
   data acquisitions this round.** `control-arsenal` and `loss-layoffs` stay PENDING.

## 2. THE RELEASE (what v0.6 is)

Following `docs/EXPERIENCE.md`'s own priority matrix, v0.6 ships the **Citizen Readings
tentpole** plus the small-effort items, on top of the repairs above. Scope, in order:

| # | Item | Source | Effort | Notes |
|---|---|---|---|---|
| A | Light the Ledger | repair | S | coin sprite, area ∝ amount stolen, crisp ring, labels, tooltip with who/years/scheme/outcome + **citations packed into the page** (`cites`, ≤3 URLs), index entries for towns and the convicted, audio voice |
| B | flyTo sampling | repair | S | sample a 8×8 grid inside the bbox; fit to whatever projects; identity fallback |
| C | Permalink codec v2 | repair + Pins/Embed prerequisite | S | `c=lon,lat&k=` (geographic centre), `z=lid:field:v` (lens), `t=` (tour); legacy `x/y` still parses |
| D | **Citizen Readings** | EXPERIENCE #4 (impact 5) | M/L | RECORD mode → stops {camera, scope, layer bits, era, lens, benchmark pin, caption} → base64url JSON in the hash → playback as a reading with PREV/NEXT/END and ✎ COUNTER-READING (fork into the recorder) → share card with COPY LINK and COPY EMBED (iframe) |
| E | Pins & Field Notes | EXPERIENCE #7 | S | folded into D: a stop may carry a benchmark (the favicon triangle) set by clicking the map while composing |
| F | Embed Kit | EXPERIENCE #8 | S | folded into D's share card; also a ⤴ SHARE masthead button for the current view |
| G | Random Plunge | EXPERIENCE #12 | S | `?` key + readings-menu entry; weighted pool from the Index (ledger, thrones, buried ground, omens, densest skies, stars, named data centers); arrives with the tooltip pinned |
| H | Time Everywhere (light) | EXPERIENCE #6 | S | `seq` lenses (Month, Decade) get a ▶ that steps the lens — a year of grief crossing the country |
| I | Constellations | EXPERIENCE #3 | M | entity lenses only (`constellation: true` on Operator and Facility type) draw a 2-nearest-neighbour web among the filtered members; cached per scope; ≤700 members; never for unrelated things (no constellation for Month, Status, Side, or the Ledger) |
| J | Tap/click to pin tooltips | repair (mobile) | S | click pins; mouse wander >70px releases; touch holds until the next tap; pinned tooltips accept clicks (the receipts become links) |
| K | Dossier rows | repair | S | suicide rate (with the 988 line, protocol), economic connectedness, adherents per 1k + largest tradition, net migration, nearest betrayal |
| L | Living Log | EXPERIENCE #14 | S | `build.py` bakes `git log` subjects into `meta.log`; About renders it |
| M | Data API page | EXPERIENCE #9 | S | `docs/DATA_API.md` **generated at build** from the registry (raw endpoints + curl one-liners) |
| N | Repo/site from git remote | repair | S | `build.py` derives `owner/repo` from `origin`; registry `meta.repo`/`meta.site` override; template uses `{{SITE}}` |
| O | Sound Solos | EXPERIENCE #11 | S | already true: the plate's SOLO VIEW drives the mix; say so on the plate |
| P | Classroom Packet | EXPERIENCE #13 | S | `docs/CLASSROOM.md` |
| Q | Copy, voices, version | repair | S | orientation `{n}`, hero hint, About controls/releases, audio voices for the five v0.5 layers, version 0.6.0 |
| R | Smoke test | new | S | `tests/smoke.js` (Playwright, optional dev dependency): no console errors, ledger draws pixels, flights land at k≈1, permalink round-trip, tour playback, plunge, pin |

Out of scope (deliberately): Print Atlas (L), new data layers (network-gated), hotkeys
for layers 11–15.

## 3. DESIGN DECISIONS (so they are not re-litigated)

- **Hash format v2** — `#s=us&l=<bits>&e=<era>&k=<zoom>&c=<lon>,<lat>[&z=<lid>:<field>:<v>][&t=<tour>]`.
  `k` is the zoom multiplier over the fitted projection (comparable across screens);
  `c` is the geographic centre of the extent. `camFor(lon,lat,k)` / `camNow()` /
  `flyToCam()` are the primitives. v1 (`x`,`y`) is read but never written.
- **Tour encoding** — `t=` is base64url of UTF-8 JSON `{v:1, t:title, s:[stops]}`,
  stop = `{c:[lon,lat], k, s:scope, l:bits, e:era, z:{lid,field,v}|null, p:[lon,lat]|null, x:caption}`.
  No server, no account: the reading lives in the link. Captions are escaped on render.
- **Playback** — a loaded tour appears at the top of the READINGS menu as a citizen
  reading and auto-starts instead of the orientation. `tourIdx` is a separate cursor
  from `reading`; `endReading()` clears both and keeps `tourParam` so the link still
  carries the reading after the reader wanders.
- **Forking** — COUNTER-READING seeds the recorder with the tour's stops and title
  `Re: <title>`; the result is a new link. The survey becomes a medium.
- **Benchmarks** — while composing, a map click sets the pin for the *next* captured
  stop (it does not pin a tooltip). Drawn as the favicon glyph in gold with a label.
- **Pinned tooltips** — `tipPinned={content,x,y}` in base coordinates; repositioned on
  every label draw so it rides with the map. `zoomB.clickDistance(6)` so taps survive.
- **Constellations are lens-only and entity-only.** A nearest-neighbour web implies a
  relation; drawing it between unrelated betrayals or random months would lie.
- **Default voice** — `spriteFor(lid)` + a generic branch in `drawPointsTo` and
  `tipHTML`, so a registry-only layer renders and hovers without engine edits.
- **Repo URL** — derived at build from `git remote get-url origin`; the original
  author can set `meta.repo`/`meta.site` in the registry to keep links on their home.
- **Living log** — subjects only; trailers never reach the page. Builds without git
  degrade to an empty log.
- **Suicide in the dossier** — a rate for a county is heat, not a point, so it is
  allowed under the protocol; the row carries the 988 line.

## 4. STATUS (update as work lands)

| File | State | What changed |
|---|---|---|
| `pipeline/build.py` | **done, verified** | `repo_info()`, `living_log()`, `write_data_api()`; packs `cites` for the ledger; `seq`/`constellation` flags on filters; `{{SITE}}`/`{{REPO}}` substitution; 8 MB warning |
| `site/template.html` | **partial** | og tags use `{{SITE}}`; og:description says fifteen. **TODO:** add `#recCard`, `#shareCard`, `#shareBtn` |
| `registry/registry.json` | **done** | version 0.6.0; `meta.repo`/`meta.site` (empty = derive); orientation text uses `{n}` |
| `site/app.js` | **in progress** | DONE: VIS/sprite/`spriteFor`, ledger draw + ring, generic draw fallback, `drawConstellation` + cache, ledger tooltip with receipts, generic tooltip fallback, ledger labels, benchmark glyphs, pinned-tooltip reposition, `flyTo` sampling, `camFor/camNow/flyToCam`, `renderTip/placeTip/pinTip/unpinTip/onClick`, hash codec v2 (`currentHash/writeHash/parseHash/applyPendingLens`). **TODO:** openPlate lens chips (data-const/data-seq, ▶ play, handler sets `constellation`), closePlate stops lens play, plate DATA links from `R.meta.repo`, hero hint, About (repo/site, living log, controls, releases, two pending layers), readings menu (COMPOSE, PLUNGE, citizen entry), orientation `{n}` → word, `endReading` clears tour, `buildIndex` (ledger towns + convicted, named data centers, densest UFO cells, counties with centroids), `renderIdx` dossier button for counties, `computeDossier` rows, audio voices + generic pluck, the v0.6 section (recorder, tour codec/playback, share card, plunge, lens play), `init` wiring (click handler, clickDistance, shareBtn, `?` key, ESC order, `pendingGeo`, `applyPendingLens`, tour start, pointerleave respects pins) |
| `site/styles.css` | **todo** | `.wide`/`.pinned` tooltip, `.tt-pin`, `.tt-cite`, `#recCard`, `#shareCard`, `.lz-play`, `.rm-item.special`, mobile rules |
| `docs/DATA_API.md` | **done (generated)** | regenerated on every build |
| `docs/CLASSROOM.md` | **todo** | three guided readings, five dossier prompts, methods sheet, worksheet keyed to findings incl. the spurious card |
| `docs/EXPERIENCE.md` | **todo** | mark shipped items (v0.6) |
| `README.md`, `CONTRIBUTING.md` | **todo** | pipeline path (`pipeline/scratch/` + sidecars), deploy URL, smoke test |
| `tests/smoke.js` | **todo** | Playwright smoke test |
| `dist/`, `docs/index.html` | **rebuild last** | `python3 pipeline/build.py`; confirm < 8 MB; screenshots before/after |

## 5. HOW TO RESUME

```bash
git fetch origin claude/trusting-sagan-wkfcpi && git checkout claude/trusting-sagan-wkfcpi
python3 pipeline/build.py            # must succeed before and after every engine edit
node tests/smoke.js                  # once it exists; needs playwright + chromium
```

Verification that must pass before shipping: build < 8 MB; Playwright reports zero page
errors; the Ledger reading lands at k≈1 with coin-gold points visible; a v1 permalink
still opens; a v2 permalink opens on the same centre at a different viewport size; a
two-stop tour survives encode → reload → playback; `?` plunges somewhere with a pinned
tooltip; a click pins and a click away releases.

Commit plan: (1) pipeline + registry + docs, (2) engine + styles + template,
(3) `dist:`/`docs:` build copies, (4) tests + README. Push to the designated branch only.
