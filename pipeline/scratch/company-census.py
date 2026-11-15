#!/usr/bin/env python3
"""Stage ACS 2019–2023 5-year county estimates → two layers:
  data/staging/company-alone.json  TABLES FOR ONE  — householders living alone, % of households (B11001)
  data/staging/company-love.json   LOVE, COUNTED   — same-sex couple households per 1,000 households
                                   (B09019: same-sex spouse + same-sex unmarried partner of the householder)
Raw: data/raw/census/acs/acsdt5y2023-{b11001,b09019}.dat from
  https://www2.census.gov/programs-surveys/acs/summary_file/2023/table-based-SF/data/5YRData/
Public domain (U.S. government work, 17 U.S.C. § 105). The Census API now requires a key;
the table-based summary files on www2.census.gov do not.
Margins of error (90%) are carried through; an estimate whose coefficient of variation exceeds
30% is flagged as unreliable in its label, never hidden or smoothed.
Run:  python3 -I pipeline/scratch/company-census.py
"""
import hashlib, json, math, os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "data", "raw", "census", "acs")
def table(fn):
    rows = {}
    with open(os.path.join(RAW, fn), encoding="utf-8") as f:
        hdr = f.readline().rstrip("\n").split("|")
        for line in f:
            p = line.rstrip("\n").split("|")
            if not p[0].startswith("0500000US"): continue
            rows[p[0][-5:]] = dict(zip(hdr, p))
    return rows
num = lambda r, k: float(r[k]) if r.get(k) not in (None, "", "-", "null") else None
hh, rel = table("acsdt5y2023-b11001.dat"), table("acsdt5y2023-b09019.dat")
nm = {str(r["key"]).zfill(5): (r["meta"]["county"], r["meta"]["state"]) for r in json.load(open(os.path.join(ROOT, "data", "staging", "faith-altar.json")))["regions"]}
def ratio_moe(x, mx, y, my, scale):
    p = x / y
    inner = mx * mx - p * p * my * my
    if inner < 0: inner = mx * mx + p * p * my * my       # Census guidance: use the + form when negative
    return math.sqrt(inner) / y * scale
alone, love, flags = [], [], {"alone": 0, "love": 0}
for f, r in hh.items():
    tot, mtot = num(r, "B11001_E001"), num(r, "B11001_M001")
    a, ma = num(r, "B11001_E008"), num(r, "B11001_M008")
    if not tot or a is None: continue
    name = nm.get(f, (f, ""))
    lab = f"{name[0]}, {name[1]}" if name[1] else f
    pct = a / tot * 100; m = ratio_moe(a, ma, tot, mtot, 100)
    cv = (m / 1.645) / pct if pct else 9
    unrel = cv > 0.30
    flags["alone"] += unrel
    alone.append({"key": f, "value": round(pct, 1), "label": f"{pct:.1f}% of households are one person living alone (±{m:.1f}){' — unreliable estimate' if unrel else ''} — {lab}",
                  "meta": {"households": int(tot), "living_alone": int(a), "moe_pct": round(m, 2), "unreliable": unrel}})
    q = rel.get(f)
    if not q: continue
    s1, m1, s2, m2 = num(q, "B09019_E011"), num(q, "B09019_M011"), num(q, "B09019_E013"), num(q, "B09019_M013")
    if s1 is None or s2 is None: continue
    ss = s1 + s2; mss = math.sqrt((m1 or 0) ** 2 + (m2 or 0) ** 2)
    per = ss / tot * 1000; mper = ratio_moe(ss, mss, tot, mtot, 1000) if ss else mss / tot * 1000
    unrel = ss == 0 or (mper / 1.645) / per > 0.30
    flags["love"] += unrel
    # an unreliable estimate is not drawn as colour (value None); its label still tells the reader
    love.append({"key": f, "value": None if unrel else round(per, 2), "label": f"{per:.1f} same-sex couple households per 1,000 (±{mper:.1f}){' — unreliable estimate' if unrel else ''} — {lab}",
                 "meta": {"households": int(tot), "same_sex_couples": int(ss), "married": int(s1), "unmarried": int(s2), "moe_per_1000": round(mper, 2), "unreliable": unrel}})
src = [{"name": "U.S. Census Bureau, American Community Survey 2019–2023 5-year estimates, table-based summary file", "url": "https://www2.census.gov/programs-surveys/acs/summary_file/2023/table-based-SF/", "note": "public domain"}]
files = {fn: {"bytes": os.path.getsize(os.path.join(RAW, fn)), "sha256": hashlib.sha256(open(os.path.join(RAW, fn), "rb").read()).hexdigest()} for fn in ("acsdt5y2023-b11001.dat", "acsdt5y2023-b09019.dat")}
def top(lst, k=6): return [(x["label"].split(" — ")[-1], x["value"]) for x in sorted((x for x in lst if not x["meta"]["unreliable"]), key=lambda x: -x["value"])][:k]
def bottom(lst, k=4): return [(x["label"].split(" — ")[-1], x["value"]) for x in sorted((x for x in lst if not x["meta"]["unreliable"]), key=lambda x: x["value"])][:k]
nat_hh = sum(x["meta"]["households"] for x in alone)
for lid, lst, method, table_ids in (
    ("company-alone", alone, "Householders living alone (B11001_008) ÷ all households (B11001_001), per cent; MOE by the Census ratio formula.", "B11001"),
    ("company-love", love, "Same-sex spouses (B09019_011) + same-sex unmarried partners (B09019_013) of householders ÷ all households (B11001_001), per 1,000. Each such person marks one same-sex couple household. MOEs combined in quadrature, then by the ratio formula.", "B09019, B11001")):
    json.dump({"layer": lid, "retrieved": "2026-11-15", "vintage": "ACS 2019–2023 5-year", "sources": src, "regions": lst},
              open(os.path.join(ROOT, "data", "staging", f"{lid}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    prov = {"layer": lid, "retrieved": "2026-11-15",
            "license": {"name": "Public domain (U.S. government work, 17 U.S.C. § 105)", "note": "www.census.gov (terms page) is not reachable from the build environment; Census Bureau data products are works of the U.S. government."},
            "gate_history": "2026-11-06: api.census.gov began requiring an API key in the URL and www2.census.gov was not allowed — slot PENDING. 2026-11-15: the maintainer allowed www2.census.gov; the table-based summary files need no key.",
            "files": files, "tables": table_ids, "method": method,
            "counts": {"counties": len(lst), "unreliable_cv_over_30pct": flags["alone" if lid == "company-alone" else "love"]},
            "caveats": ["Five-year pooled survey estimates (2019–2023), not a count; every label carries its 90% margin of error.",
                        "Estimates with a coefficient of variation above 30% are labelled unreliable on the map, not hidden.",
                        "Households, never people: nobody is identifiable from these figures."] + (["Same-sex couples are self-reported in the survey; small counties often show zero with a wide margin — absence in a sample is not absence in a place."] if lid == "company-love" else []),
            "validation": {"highest_reliable": top(lst), "lowest_reliable": bottom(lst)}}
    json.dump(prov, open(os.path.join(ROOT, "data", "staging", f"{lid}.provenance.json"), "w"), indent=1, ensure_ascii=False)
    print(lid, len(lst), "counties;", prov["counts"], "\n  top", top(lst), "\n  bottom", bottom(lst))
