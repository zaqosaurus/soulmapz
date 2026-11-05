# THE DATA API

*Every staging file is a stable, versioned endpoint. Zero infrastructure; total legitimacy.*

The survey's data lives in `data/staging/` as plain JSON with a provenance sidecar beside
every file. GitHub serves them raw. Pin a release tag instead of `main` for a frozen vintage
(`https://raw.githubusercontent.com/zaqosaurus/soulmapz/v0.6.0/...`). Licenses per layer are in
[DATA_LICENSES.md](../DATA_LICENSES.md) — several require attribution and one is share-alike.

## Shapes

| Shape | Keys | Used by |
|---|---|---|
| points | `records[]` of `{lat, lon, v, name?, meta{}}` | crashes, data centers, thrones, fulfillment, omens, Superfund, sightings, the ledger |
| regions | `regions[]` of `{key, value, label, meta?}` — key is a 5-digit county FIPS or `US-XX` state | overdoses, suicide, connectedness, adherence, desire |
| cells | `cells[]` of `{lat, lon, v, top?[]}` on a 0.25° grid | memory, eras |
| flows | `counties[]` of `{fips, in, out, net}` + `flows[]` of `{a, b, hh}` | the sorting |

## Endpoints

| Layer | Vintage | Records | Staging | Provenance |
|---|---|---|---|---|
| Where the Remembered Were Born | 2026-07-07 | 1,704,189 | [`memory-births.json`](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/memory-births.json) | [sidecar](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/memory-births.provenance.json) |
| The Last Speakers | 2026-11-05 | 7,836 | [`memory-languages.json`](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/memory-languages.json) | [sidecar](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/memory-languages.provenance.json) |
| The Geography of Desire | 2026-07-06 | 29 | [`desire-searches.json`](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/desire-searches.json) | [sidecar](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/desire-searches.provenance.json) |
| Where the Cloud Touches Ground | 2026-07-06 | 4,342 | [`power-datacenters.json`](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/power-datacenters.json) | [sidecar](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/power-datacenters.provenance.json) |
| The Thrones of Capital | 2026-07-06 | 500 | [`power-fortune500.json`](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/power-fortune500.json) | [sidecar](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/power-fortune500.provenance.json) |
| The World's Furnaces | 2026-11-05 | 34,936 | [`power-plants.json`](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/power-plants.json) | [sidecar](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/power-plants.provenance.json) |
| The Fulfillment Bloodstream | 2026-07-06 | 314 | [`motion-fulfillment.json`](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/motion-fulfillment.json) | [sidecar](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/motion-fulfillment.provenance.json) |
| Every Fatal Crash of 2023 | 2026-07-07 | 37,640 | [`loss-crashes.json`](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/loss-crashes.json) | [sidecar](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/loss-crashes.provenance.json) |
| Devil's Land, Angel's Land | 2026-07-07 | 2,731 | [`omen-names.json`](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/omen-names.json) | [sidecar](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/omen-names.provenance.json) |
| The Sky Is Watching Back | 2026-07-07 | 54,947 | [`wonder-ufos.json`](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/wonder-ufos.json) | [sidecar](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/wonder-ufos.provenance.json) |
| The Quiet Epidemic | 2026-07-07 | 3,014 | [`despair-overdoses.json`](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/despair-overdoses.json) | [sidecar](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/despair-overdoses.provenance.json) |
| What We Buried | 2026-07-07 | 1,840 | [`residue-superfund.json`](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/residue-superfund.json) | [sidecar](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/residue-superfund.provenance.json) |
| The Quiet Hours | 2026-07-07 | 2,448 | [`despair-suicide.json`](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/despair-suicide.json) | [sidecar](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/despair-suicide.provenance.json) |
| The Great Sorting | 2026-07-07 | 2,866 | [`motion-sorting.json`](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/motion-sorting.json) | [sidecar](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/motion-sorting.provenance.json) |
| The Company We Keep | 2026-07-07 | 3,018 | [`company-socialcapital.json`](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/company-socialcapital.json) | [sidecar](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/company-socialcapital.provenance.json) |
| The Altar | 2026-07-07 | 3,143 | [`faith-altar.json`](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/faith-altar.json) | [sidecar](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/faith-altar.provenance.json) |
| The Ledger of Betrayals | 2026-07-07 | 44 | [`betrayal-ledger.json`](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/betrayal-ledger.json) | [sidecar](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/betrayal-ledger.provenance.json) |
| memory-eras (enrichment) | — | — | [`memory-eras.json`](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/memory-eras.json) | [sidecar](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/memory-eras.provenance.json) |
| memory-bios (enrichment) | — | — | [`memory-bios.json`](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/memory-bios.json) | [sidecar](https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/memory-bios.provenance.json) |

## One-liners

```bash
# the registry — every layer's contract, essay, and caveat
curl -sL https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/registry/registry.json | python3 -m json.tool | head -60

# the findings, with their method notes and the spurious control
curl -sL https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/findings.json

# one layer and its provenance
curl -sL https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/betrayal-ledger.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d['records']), 'records;', d['retrieved'])"
curl -sL https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/staging/betrayal-ledger.provenance.json | head -c 600

# the packed payloads the page itself renders (quantized, cell-aggregated)
curl -sL https://raw.githubusercontent.com/zaqosaurus/soulmapz/main/data/layers/loss-crashes.json | head -c 300
```

## Rules of the road

- **Cite the source, not the survey.** Each file names its source and retrieval date; pass them on.
- **The dark stays dark.** Suppressed counties are absent on purpose. Do not interpolate them.
- **Protocol layers stay heat.** Suicide data ships as county rates only — never re-join it to points.
- **Where, not why.** Correlations you compute inherit the standing disclaimer.

*Generated by `pipeline/build.py` at build time for `zaqosaurus/soulmapz`.*
