"""THE SOUL SURVEY — registry-declared packing (v0.7 Phase 0.3).

A layer's registry entry may carry a `pack` block. When it does, the build packs the
staging file from that declaration instead of per-layer code:

  "pack": {
    "kind": "points" | "regions" | "flows" | "raster",
    "fields": [ {"name": "st2", "from": "meta.status", "type": "enum",
                 "values": ["proposed", "final", "deleted"], "labels": [...], "default": 1}, ... ],
    "sort": "-v", "limit": 5000,
    "lenses": [ {"field": "st2", "label": "Status", "seq": false, "constellation": false} ],
    "time": {"field": "yr", "label": "Year listed", "mode": "in" | "upto",
             "buckets": [[lo, hi, "label"], ...]}
  }

Field types
  float  (nd = decimals, default 3)   int   str (max = length)   year (first 4-digit run)
  enum   explicit `values` (raw strings, matched case-insensitively) with optional `labels`
         and `alias` {raw: value}; or `top: N` to keep the N most frequent values and
         send the rest to "other". Unknown → `default` (or the "other" code, or -1).
Points always carry lat/lon (3 decimals). Regions carry {v, label[, c][, t]} per key.
The packed payload records `codes` {field: [labels]} so the page can name enum values.
"""
import re
from collections import Counter

def get(rec, path):
    cur = rec
    for part in path.split("."):
        if cur is None: return None
        cur = cur.get(part) if isinstance(cur, dict) else None
    return cur

def rnd(x, nd=3): return round(float(x), nd)

def _year(v):
    if v is None: return 0
    if isinstance(v, (int, float)): return int(v)
    m = re.search(r"(1[5-9]\d\d|20\d\d)", str(v))
    return int(m.group(1)) if m else 0

def enum_table(spec, raws):
    """→ (encode(raw) -> code, labels[])"""
    alias = {str(k).lower(): v for k, v in (spec.get("alias") or {}).items()}
    norm = lambda r: alias.get(str(r).strip().lower(), str(r).strip()) if r not in (None, "") else None
    if "values" in spec:
        values = [str(v) for v in spec["values"]]
        labels = spec.get("labels") or values
    else:
        cnt = Counter(n for n in (norm(r) for r in raws) if n is not None)
        values = [v for v, _ in cnt.most_common(spec.get("top", 12))]
        labels = [v[:1].upper() + v[1:] for v in values]
        if spec.get("other", True):
            values.append("\x00other"); labels.append(spec.get("otherLabel", "Other"))
    idx = {v.lower(): i for i, v in enumerate(values)}
    other = idx.get("\x00other")
    default = spec.get("default", other if other is not None else -1)
    def enc(raw):
        n = norm(raw)
        if n is None: return default
        return idx.get(n.lower(), default)
    return enc, labels

def encoder(spec, recs):
    t = spec.get("type", "str")
    src = spec.get("from", spec["name"])
    if t == "enum":
        enc, labels = enum_table(spec, [get(r, src) for r in recs])
        return (lambda r: enc(get(r, src))), labels
    if t == "float":
        nd = spec.get("nd", 3)
        dflt = spec.get("default", 0)
        return (lambda r: rnd(get(r, src), nd) if get(r, src) is not None else dflt), None
    if t == "int":
        dflt = spec.get("default", 0)
        return (lambda r: int(get(r, src)) if get(r, src) is not None else dflt), None
    if t == "year":
        return (lambda r: _year(get(r, src))), None
    mx = spec.get("max", 60)
    return (lambda r: str(get(r, src) or "")[:mx]), None

def _sorted(recs, key):
    if not key: return recs
    desc = key.startswith("-"); k = key.lstrip("-")
    return sorted(recs, key=lambda r: (get(r, k) or 0), reverse=desc)

def time_buckets(spec, values):
    """Per-record bucket index (mode "in") or the record's own value; the page decides
    visibility from the bucket ranges. Returns counts per bucket for the plate."""
    b = spec["buckets"]; mode = spec.get("mode", "in")
    counts = []
    for lo, hi, _ in b:
        if mode == "upto": counts.append(sum(1 for v in values if v and v <= hi))
        else: counts.append(sum(1 for v in values if v and lo <= v <= hi))
    return counts

def pack_points(lay, st):
    spec = lay["pack"]
    recs = [r for r in st["records"] if r.get("lat") is not None and r.get("lon") is not None]
    recs = _sorted(recs, spec.get("sort"))
    if spec.get("limit"): recs = recs[:spec["limit"]]
    out = {"kind": "points", "n": len(recs),
           "lat": [rnd(r["lat"]) for r in recs], "lon": [rnd(r["lon"]) for r in recs]}
    codes = {}
    for f in spec.get("fields", []):
        enc, labels = encoder(f, recs)
        out[f["name"]] = [enc(r) for r in recs]
        if labels is not None: codes[f["name"]] = labels
    if codes: out["codes"] = codes
    tm = spec.get("time")
    if tm:
        out["time"] = {"field": tm["field"], "mode": tm.get("mode", "in"), "label": tm.get("label", ""),
                       "buckets": tm["buckets"], "counts": time_buckets(tm, out[tm["field"]])}
    return out

def pack_regions(lay, st, shrink_label=lambda s: s):
    spec = lay["pack"]
    rk = spec.get("regionKind", "county")
    pad = {"county": 5, "country": 3}.get(rk, 0)
    regions, vals = {}, []
    cat = spec.get("category")
    cat_enc, cat_labels = (None, None)
    if cat:
        cat_enc, cat_labels = enum_table(cat, [get(r, cat["from"]) for r in st["regions"]])
    tm = spec.get("time")
    for r in st["regions"]:
        key = str(r["key"]).zfill(pad) if pad else str(r["key"])
        lab = r.get("label", "")
        e = {"v": r["value"], "label": shrink_label(lab) if spec.get("shrink", True) else lab}
        if cat: e["c"] = cat_enc(get(r, cat["from"]))
        if tm:
            series = get(r, tm["from"]) or {}
            e["t"] = [(None if series.get(str(b[0])) is None else rnd(series.get(str(b[0])), tm.get("nd", 1))) for b in tm["buckets"]]
        regions[key] = e
        vals.append(r["value"])
    vals.sort()
    q = spec.get("vmaxQuantile", 0.95)
    vmax = vals[int(len(vals) * q)] if vals else 1
    out = {"kind": "regions", "regionKind": rk, ("counties" if rk == "county" else "countries"): regions,
           "vmax": round(float(vmax), 3), "vintage": st.get("vintage", "")}
    if cat:
        out["categories"] = {"field": "c", "label": cat.get("label", ""), "labels": cat_labels,
                             "colors": cat.get("colors") or [],
                             "counts": [sum(1 for e in regions.values() if e.get("c") == i) for i in range(len(cat_labels))]}
    if tm:
        out["time"] = {"label": tm.get("label", ""), "buckets": tm["buckets"], "mode": "series"}
        if tm.get("vmaxAll"):
            allv = sorted(x for e in regions.values() for x in e["t"] if x is not None)
            if allv: out["vmax"] = round(float(allv[int(len(allv) * q)]), 3)
    return out

def pack_flows(lay, st):
    """Generic flows: st["flows"] = [{a:[lat,lon], b:[lat,lon], v, an?, bn?}] — any point
    pair (airports, country centroids). Drawn as great-circle arcs on the world sheet."""
    spec = lay["pack"]
    fl = sorted(st["flows"], key=lambda f: -(f.get("v") or 0))
    if spec.get("min"): fl = [f for f in fl if (f.get("v") or 0) >= spec["min"]]
    if spec.get("limit"): fl = fl[:spec["limit"]]
    arcs = {"alat": [rnd(f["a"][0], 2) for f in fl], "alon": [rnd(f["a"][1], 2) for f in fl],
            "blat": [rnd(f["b"][0], 2) for f in fl], "blon": [rnd(f["b"][1], 2) for f in fl],
            "hh": [rnd(f.get("v") or 0, 1) for f in fl]}
    if any("an" in f for f in fl):
        arcs["an"] = [str(f.get("an", ""))[:32] for f in fl]
        arcs["bn"] = [str(f.get("bn", ""))[:32] for f in fl]
    hs = sorted(arcs["hh"])
    out = {"kind": "flows", "geo": True, "n": len(fl), "arcs": arcs,
           "arcmax": hs[int(len(hs) * 0.95)] if hs else 1, "vintage": st.get("vintage", "")}
    if st.get("nodes"):
        out["nodes"] = st["nodes"]
    return out

def pack_raster(lay, st):
    """A quantized grid over a lat/lon box: st = {bbox:[w,s,e,n], w, h, values: base64 of
    w*h bytes (0 = no data)}. Values are already 8-bit; the page colours and alpha-scales."""
    return {"kind": "raster", "n": st.get("n", 0), "bbox": st["bbox"], "w": st["w"], "h": st["h"],
            "b64": st["values"], "vintage": st.get("vintage", "")}

def pack_layer(lay, st, shrink_label=lambda s: s):
    kind = lay["pack"]["kind"]
    if kind == "points": return pack_points(lay, st)
    if kind == "regions": return pack_regions(lay, st, shrink_label)
    if kind == "flows": return pack_flows(lay, st)
    if kind == "raster": return pack_raster(lay, st)
    raise ValueError(f"{lay['id']}: unknown pack kind {kind}")

def lenses_for(lay, d):
    """Registry lens declarations → the filters the page already understands."""
    out = []
    for ls in lay["pack"].get("lenses", []):
        field = ls["field"]
        arr = d.get(field)
        if arr is None: continue
        labels = (d.get("codes") or {}).get(field) or ls.get("labels")
        cnt = Counter(arr)
        values = [[i, labels[i], cnt.get(i, 0)] for i in range(len(labels)) if cnt.get(i, 0) >= ls.get("min", 1)]
        if len(values) < 2: continue
        fl = {"field": field, "label": ls["label"], "values": values}
        if ls.get("seq"): fl["seq"] = True
        if ls.get("constellation"): fl["constellation"] = True
        out.append(fl)
    return out
