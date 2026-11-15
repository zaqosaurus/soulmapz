# Contributing to THE SOUL SURVEY

The survey is built to grow. A layer is: **a real dataset with coordinates + an essay
about what it says about us.** If you can supply both, you can add an instrument.

## Propose a layer

Start with [docs/WANTLIST.md](docs/WANTLIST.md) — the survey's standing wishlist,
organized by soul question with an ethics protocol that binds every acquisition.
If your idea is on it, claim it in an issue; if it isn't, argue for the question
it answers.

Open an issue with the **Layer proposal** template. A good proposal answers:

1. **WHAT** — what is the dataset, plainly? What does one point/region represent?
2. **SOURCE** — a named, reachable, citable source with a license you can state.
   No scraped-and-laundered data; no fabricated records, ever. If the best source
   is gated, say so — gated layers ship as visible `PENDING` slots, not fakes.
3. **WHY** — one honest paragraph on what the layer reveals. If the answer is only
   "population density again," see the Findings page's spurious card and reconsider.

## Build a layer

The full, current workflow is in [docs/ADDING_A_LAYER.md](docs/ADDING_A_LAYER.md). In short:

1. **Gate:** read the source's licence or terms and record them. A source that forbids
   redistribution, or a site that refuses scripts, becomes a visible `PENDING` slot.
2. **Stage:** `pipeline/scratch/<id>.py` writes `data/staging/<id>.json` and
   `data/staging/<id>.provenance.json` (licence, SHA-256, method, counts, caveats).
3. **Validate:** `python3 pipeline/validate.py <id> [--protocol] [--us]`, then three known
   answers written down before looking, and a ten-record spot check against the source.
4. **Register:** a registry entry with a `pack` block (no build or engine code needed for
   points, county/country regions, flows or rasters), plus a `DATA_LICENSES.md` row.
5. **Build, look, test:** `python3 pipeline/build.py`, solo the layer and read its plate,
   check every number the essay states, run `tests/smoke.js`, read its atlas page.

## Rules that keep the survey honest

- **No fabricated records.** Every point traces to a named source with a retrieval date.
- **Provenance ships.** The `.provenance.json` is part of the layer, not optional.
- **Caveats are content.** Every plate carries a FIELD NOTE naming the layer's biases.
- **Findings are descriptive.** New correlations go through `pipeline/correlate.py`,
  get hand-reviewed, and carry the where-not-why disclaimer. The spurious exhibit stays.
  Write the hypothesis and its pass bar into `correlate.py` *before* running it; a result
  that fails its bar is logged, added to the `tested` ledger in `data/findings.json`, and
  never softened into a card.
- **Readings** live in `registry.json → readings`: `id`, `title`, `kicker`, `scope`,
  `layers`, `bbox`, `text`, and optionally `era` (open on that time step of the first timed
  layer). Check every number in a reading against staging before it ships.
- **Removal on request.** Anyone represented in the data, or a rights holder, can ask
  through the removal-request issue form or privately at issue@soupmap.org; honour it in
  the next build.
- **Page-weight ceiling: 8 MB.** The built page must stay a single self-contained file
  under 8 MB with zero runtime network calls. Aggregate aggressively (cells, not rows)
  — the memory layer compresses 1.7M births into 41.5k cells; yours can too.
