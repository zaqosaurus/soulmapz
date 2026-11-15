# THE SOUL SURVEY

*A topographic survey of the collective soul, conducted in objective data.*

One map. Many layers. Where humanity puts its desire, its genius, its machines, and its
grief — rendered as terrain. Toggle layers on and off and watch society transform:
density becomes elevation, overlap becomes light.

## What this is

Every layer of the Survey is a strange-but-real dataset with coordinates:
where the notable dead were born, where the data centers hum, where desire points,
where the fulfillment network breathes, where the cars crashed, where the jobs vanished,
where America named its land after devils and angels.

Alone, each map is a curiosity. Stacked, they are a relief map of us.

## Architecture

```
registry/registry.json       ← the contract. every layer is one entry here, including its
                               `pack` block (how its staging data becomes a payload)
pipeline/scratch/<id>.py     ← one fetch/stage script per acquired layer → data/staging/<id>.json
                               (+ <id>.provenance.json: licence, SHA-256, method, known answers)
pipeline/packer.py           ← registry-declared packing (points, regions, flows, raster)
pipeline/validate.py         ← acquisition checks: coordinates, duplicates, protocol fields
pipeline/build.py            ← packs staging → data/layers/*.json, compresses, injects everything
                               into site/template.html → dist/index.html (+ a plain fallback)
pipeline/correlate.py        ← findings, each hypothesis written down before it is run
site/                        ← the engine (vanilla JS + d3, canvas compositing); boot.js inflates
                               the gzip payloads in the browser before the survey starts
tests/smoke.js, views.js     ← headless checks (82) and canonical-view pixel comparison
data/staging/                ← clean, verified records + provenance (committed)
data/layers/                 ← packed, quantized layer files (committed, build output)
dist/index.html              ← THE SURVEY. one file, ~4.3 MB, zero runtime network calls.
```

Principles (do not reverse casually):

1. **Zero runtime network calls.** Basemaps, data, and libraries are baked into the
   built HTML. The map must render forever, offline, anywhere.
2. **No fabricated records.** Every point comes from a named source with a retrieval
   date. Provenance ships in `data/staging/<id>.provenance.json` and on the map itself.
3. **The registry is the only integration point.** The engine renders whatever the
   registry declares. Adding a layer never requires touching engine code.
4. **Density is elevation.** The composite terrain (hillshade + contours) is derived
   from the active layers' density fields. The map is topographic, not decorative.

## Adding a layer

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/ADDING_A_LAYER.md](docs/ADDING_A_LAYER.md).
Short version: read the source's terms, write a staging script that emits
`data/staging/<id>.json` and its provenance sidecar, validate it, add a registry entry with a
`pack` block (accent, theme, essay: what/how/why), run `python3 pipeline/build.py` and look at
the result. **Page-weight ceiling: the built page stays a single
self-contained file under 8 MB** — aggregate to cells, not rows.

## Where this is going

- [docs/HANDOFF.md](docs/HANDOFF.md) — **start here when resuming work**: state, rules,
  commands, environment, gotchas, what's next.
- [docs/NEXT.md](docs/NEXT.md) — what to do after v0.7: the light side, legible legends,
  sharper findings, the one magic thing, and the long view (a portrait of every reader's place,
  guess-before-you-look, the exceptions, the living record).
- [docs/PLAN_V07.md](docs/PLAN_V07.md) — the current plan in phases, its QC loops, the
  status table and the goal scorecard.
- [docs/NOTES_V07.md](docs/NOTES_V07.md) — the surveyor's notebook for v0.7: findings
  kept and rejected, judgment calls, bugs and how they were caught, debt, and new ideas.
- [docs/WANTLIST.md](docs/WANTLIST.md) — the data grocery list, organized by soul
  question, with the binding ethics protocol and each slate's result.
- [docs/EXPERIENCE.md](docs/EXPERIENCE.md) — the feature vision: entity lenses,
  citizen readings, star bios, dossier diffs, the print atlas, and the expanded canon.
- [docs/DATA_API.md](docs/DATA_API.md) — every staging file as a stable raw endpoint.

## Findings

`pipeline/correlate.py` computes descriptive spatial statistics across layers at build
time (county joins, cell-grid correlations). Hand-reviewed results ship in
`data/findings.json` and render as FINDINGS cards — each with its method note and the
standing disclaimer: **where, not why**. One deliberately spurious correlation is
included as the epistemic control. Every hypothesis is written down with its pass bar
*before* it is run (`correlate.py` blocks `v06`, `v07`, `v08`); the findings menu and the
atlas also list every hypothesis that was **tested and not found**, so the map shows how
it looked, not only what it found. Round two (v0.7) pre-stated thirteen pairs: one
shipped, ten were rejected, two wait on pending layers.

For teachers: [CLASSROOM.md](CLASSROOM.md) — three lessons keyed to the lesson cards
and the tested-and-not-found ledger, plus guided readings.

## Deploy (GitHub Pages)

The build also writes `docs/index.html`. Enable Pages once:
repo **Settings → Pages → Deploy from a branch → `main` / `docs`** — the survey then
lives at `https://zaqosaurus.github.io/soulmapz/` (forks: `https://<owner>.github.io/<repo>/`).

## Provenance & licenses

See [DATA_LICENSES.md](DATA_LICENSES.md). Sources include NHTSA FARS, USGS GNIS,
OpenStreetMap (ODbL), the cross-verified database of notable people (Laouenan et al.,
*Scientific Data* 2022, CC-BY-SA), Pornhub Insights 2025 (archived official data,
press-verified), fba.wiki Amazon facility codes, Fortune's 2025 ranking, and GeoNames
(CC-BY), and since v0.7 Glottolog, the WRI power-plant database, The New York Times'
COVID data, The Washington Post's Fatal Force, the Princeton Eviction Lab, OpenFlights,
UCDP, UNHCR, IRS Statistics of Income, the Census Bureau's ACS and Wikidata. Several are
non-commercial or share-alike; this survey is non-commercial, and anything is removed on
request — through the repository's removal-request issue form, or privately at
issue@soupmap.org. Every layer ships with a provenance file; five slots are
deliberately pending rather than faked, each naming its gate. Review licenses before
distributing.
