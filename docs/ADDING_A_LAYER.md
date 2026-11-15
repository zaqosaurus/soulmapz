# Adding a Layer to the Soul Survey

A layer is: **a dataset with coordinates + an essay about what it says about us.**
Since v0.7 most layers need **no engine code and no build code**: a staging script, a
registry entry with a `pack` block, and the acquisition loop below. The binding rules are
in [WANTLIST.md](WANTLIST.md) (the protocol) and [PLAN_V07.md](PLAN_V07.md) §1 and §4.

## 0. Gate first

Read the source's licence or terms and save the text (or the exact statement, with URL and
date) in the provenance sidecar. If redistribution is not allowed, stop: the layer becomes a
**PENDING slot** with the gate named (`"status": "pending"`, `"pendingNote"`). If the site
refuses scripts (a bot check), do not get around it — that is also a PENDING slot. If the
data is reachable but measures something other than what the title promises, rename the
layer to what it measures (see *Gifts on the Return* in [NOTES_V07.md](NOTES_V07.md)).

## 1. Fetch and stage

- Download into `data/raw/<source>/` (git-ignored). Record URL, bytes and SHA-256.
- Write `pipeline/scratch/<id>.py`, run with `python3 -I`, that writes
  `data/staging/<id>.json` and `data/staging/<id>.provenance.json`.
- **Protocol layers** (deaths, violence, anything about people): drop names, ages, race,
  addresses and exact points *in the staging script*. Only counts or rates for places leave it.

Staging shapes:

```jsonc
{ "layer": "<id>", "retrieved": "2026-11-15", "vintage": "...", "sources": [{ "name": "...", "url": "...", "note": "licence" }],
  // one of:
  "records": [ { "lat": 34.05, "lon": -118.24, "v": 1, "name": "optional", "meta": { } } ],   // points
  "regions": [ { "key": "06037", "value": 41.2, "label": "...", "meta": { "series": { "0": 1.2 } } } ], // county (5-digit FIPS) or country (ISO numeric)
  "flows":   [ { "a": [lat, lon], "b": [lat, lon], "v": 120, "an": "from", "bn": "to" } ]       // any point pair → great circles
}
```

A region's `value` may be `null`: it is shown in the tooltip but not tinted (use it for
estimates too uncertain to colour).

The sidecar carries: licence, files (url, bytes, sha256), method, counts in/out with drop
reasons, caveats, protocol note, and `validation` (known answers, spot check, any
hand-reviewed exceptions).

## 2. Validate

```bash
python3 pipeline/validate.py <id> [--protocol] [--us]
```

Checks coordinates (range, (0,0), on land or near a coast), duplicates (by the source's own
id when present) and, with `--protocol`, person-level fields. Oceanic islands missing from
the 1:50m coastline must be **reviewed by hand** and recorded in the sidecar as
`validation.reviewed_offshore` with the exact count and countries — nothing else passes.

Then, by hand and written into the sidecar:
- **Known answers:** three facts about the dataset written down *before* looking
  (e.g. "Papua New Guinea holds the most languages"). If one fails, find out why.
- **Spot check:** ten random records compared with the raw source rows.

## 3. Register

Add an entry to `registry/registry.json` (edit the text; a `json.dump` rewrite reformats the
whole file, and the build refuses duplicate keys). Core keys:

`id, title, theme, accent, scopes (["us"], ["world"], or both — the first is the atlas sheet),
forms ({points|flows|tint, regionKind: county|country}), weight, unit, statline ({n} = count),
status: "pending" (the build marks it live when staging exists), caveat, essay {what, how, why},
plateStats`

The **`pack` block** replaces per-layer build code:

```jsonc
"pack": {
  "kind": "points" | "regions" | "flows" | "raster",
  "fields": [ { "name": "fu", "from": "meta.fuel", "type": "enum",
                "values": ["coal","gas"], "labels": ["Coal","Gas"], "default": -1,
                "alias": {"raw": "value"}, "contains": [["substring","value"]] },
              { "name": "yr", "from": "meta.date", "type": "year" },      // also: decade, int, float (nd), str (max)
              { "name": "name", "from": "name|meta.operator", "type": "str", "max": 40 } ],  // "a|b": first non-empty
  "lenses": [ { "field": "fu", "label": "Fuel", "constellation": false, "min": 3 } ],
  "time":   { "field": "yr", "label": "...", "mode": "in" | "upto", "endField": "...",
              "buckets": [[lo, hi, "label"], ...] },           // regions: { "from": "meta.series", ... }
  "aggregate": { "nd": 2, "sum": "v" },                        // group by place + every field
  "category":  { "from": "meta.x", "values": [...], "labels": [...], "colors": [...], "toggle": true },
  "coordNd": 2, "sort": "-v", "limit": 5000, "min": 2,         // flows: min weight
  "vminQuantile": 0.05, "vmaxQuantile": 0.97, "count": "v"
}
```

Display keys: `colorBy {field, colors}`, `size {field, scale: log|sqrt, min, max, vmax, alpha,
worldAlpha, core}`, `tip {ti, ti2, s}` with `{field|fmt}` (int, money, mw, month, year, f1, raw),
`scopeFilter {us: {field, label|value}}`, `tintMax`, `flowStyle {alpha, width, noEnds}`,
`protocol` (banner text on the plate).

Add a row to `DATA_LICENSES.md`, and a credit to the colophon/About licence lines in
`site/app.js` if the licence asks for attribution or share-alike notice.

## 4. Build, look, test

```bash
python3 pipeline/build.py                       # weight ledger per payload; fails above 8 MB
NODE_PATH=$(npm root -g) node tests/smoke.js    # every point/flow layer is soloed; every timed layer is scrubbed
git checkout -- dist/index.html docs/index.html # until a release commit
```

**Look at it.** Solo the layer on each sheet and screenshot it: is it legible, does the colour
ramp mislead, do additive glows wash to white (lower `size.alpha` / `flowStyle.alpha`), are
labels colliding? Read the plate. Check every number the essay states against the data —
in v0.7 four essay sentences were cut or narrowed this way. Then regenerate the atlas
(`SHOTS=<dir> node tests/smoke.js` writes `atlas.pdf`) and read the new page.

## 5. Commit

One commit per layer: `layer(<id>): <source> <vintage> — <count>, <title>`, with the gate,
known answers and anything unusual in the body.

## Design contract

- Accent colours luminous on near-black (`#0a0d12`); test overlap blending.
- `weight` raises the composite terrain; tint and flow layers use 0.
- Essays are three movements: **What** (the data, plainly), **How** (method, source, caveats),
  **Why** (the soul reading — earned, not purple, and never a causal claim the data cannot carry).
