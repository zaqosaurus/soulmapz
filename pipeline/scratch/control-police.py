#!/usr/bin/env python3
"""Stage The Washington Post's fatal police shootings database (v2, 2015–2024) →
data/staging/control-police.json. WHEN THE STATE KILLS — county rates only.
PROTOCOL: names, ages, race, exact points and every per-person field are dropped here,
at staging; only counts per county and year leave this script.
Raw: data/raw/wapo/fatal-police-shootings-data.csv from
  https://raw.githubusercontent.com/washingtonpost/data-police-shootings/master/v2/fatal-police-shootings-data.csv
Run:  python3 -I pipeline/scratch/control-police.py
"""
import csv, hashlib, json, os, sys
from collections import Counter, defaultdict
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "pipeline"))
from correlate import county_polygons, county_of
RAW = os.path.join(ROOT, "data", "raw", "wapo", "fatal-police-shootings-data.csv")
YEARS = list(range(2015, 2025))
faith = json.load(open(os.path.join(ROOT, "data", "staging", "faith-altar.json")))["regions"]
pop = {str(r["key"]).zfill(5): r["meta"]["population_2020"] for r in faith}
nm = {str(r["key"]).zfill(5): (r["meta"]["county"], r["meta"]["state"]) for r in faith}
ST = {"AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas","CA":"California","CO":"Colorado","CT":"Connecticut","DE":"Delaware","DC":"District of Columbia","FL":"Florida","GA":"Georgia","HI":"Hawaii","ID":"Idaho","IL":"Illinois","IN":"Indiana","IA":"Iowa","KS":"Kansas","KY":"Kentucky","LA":"Louisiana","ME":"Maine","MD":"Maryland","MA":"Massachusetts","MI":"Michigan","MN":"Minnesota","MS":"Mississippi","MO":"Missouri","MT":"Montana","NE":"Nebraska","NV":"Nevada","NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico","NY":"New York","NC":"North Carolina","ND":"North Dakota","OH":"Ohio","OK":"Oklahoma","OR":"Oregon","PA":"Pennsylvania","RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota","TN":"Tennessee","TX":"Texas","UT":"Utah","VT":"Vermont","VA":"Virginia","WA":"Washington","WV":"West Virginia","WI":"Wisconsin","WY":"Wyoming"}
byname = {}
for f, (c, s) in nm.items():
    base = c.replace(" County", "").replace(" Parish", "").replace(" Borough", "").replace(" Census Area", "").replace(" city", "").lower()
    byname[(base, s)] = f
polys = county_polygons()
places = {}
for row in csv.DictReader(open(os.path.join(ROOT, "data", "ref", "us_places.csv"), encoding="utf-8")):
    k = (row["state"], row["city_lower"])
    if k not in places or float(row["pop"] or 0) > places[k][2]: places[k] = (float(row["lat"]), float(row["lon"]), float(row["pop"] or 0))
counts = defaultdict(lambda: [0] * len(YEARS))
how = Counter(); drops = Counter(); total = 0
for r in csv.DictReader(open(RAW, encoding="utf-8")):
    y = int(r["date"][:4])
    if y not in YEARS: drops[f"outside 2015–2024 ({y})"] += 1; continue
    f = None
    if r["latitude"] and r["longitude"]:
        f = county_of(float(r["latitude"]), float(r["longitude"]), polys)
        if f: how["point in county polygon"] += 1
    if not f and r["county"]:
        cn = r["county"].lower()
        for suf in (" county", " parish", " city", " borough"):
            if cn.endswith(suf): cn = cn[: -len(suf)]
        f = byname.get((cn, ST.get(r["state"], "")))
        if f: how["county name match"] += 1
    if not f and r["city"]:
        g = places.get((r["state"], r["city"].lower()))
        if g:
            f = county_of(g[0], g[1], polys)
            if f: how["city centre (repo gazetteer) in county polygon"] += 1
    if not f or f not in pop: drops["no county resolved"] += 1; continue
    counts[f][YEARS.index(y)] += 1; total += 1
regions = []
for f in pop:                      # every county: no recorded killing is a zero, not a gap
    ys = counts.get(f, [0] * len(YEARS))
    n = sum(ys); p = pop[f]
    if not p: continue
    rate = round(n / p * 1e5, 2)
    c, s = nm[f]
    regions.append({"key": f, "value": rate, "label": f"{rate} per 100k over 2015–2024 ({n} killed) — {c}, {s}",
                    "meta": {"killed": n, "population_2020": p, "series": {str(y): round(v / p * 1e6, 2) for y, v in zip(YEARS, ys)}}})
out = {"layer": "control-police", "retrieved": "2026-11-06", "vintage": "2015–2024",
       "sources": [{"name": "The Washington Post, Fatal Force — fatal police shootings database (v2)", "url": "https://github.com/washingtonpost/data-police-shootings", "note": "CC-BY-NC-SA 4.0"}],
       "regions": regions}
json.dump(out, open(os.path.join(ROOT, "data", "staging", "control-police.json"), "w"), ensure_ascii=False, separators=(",", ":"))
st_tot = Counter(); 
for r in regions: st_tot[nm[r["key"]][1]] += r["meta"]["killed"]
st_pop = Counter()
for f, p in pop.items(): st_pop[nm[f][1]] += p
st_rate = sorted(((s, st_tot[s] / st_pop[s] * 1e5) for s in st_tot), key=lambda x: -x[1])
per_year = [sum(r["meta"]["series"][str(y)] * r["meta"]["population_2020"] / 1e6 for r in regions) for y in YEARS]
prov = {"layer": "control-police", "retrieved": "2026-11-06",
  "license": {"name": "CC-BY-NC-SA 4.0", "text_file": "data/raw/wapo/LICENSE (read 2026-11-06)", "share_alike": "the derived county layer is offered under the same licence (DATA_LICENSES.md)"},
  "files": {"fatal-police-shootings-data.csv": {"url": "https://raw.githubusercontent.com/washingtonpost/data-police-shootings/master/v2/fatal-police-shootings-data.csv", "bytes": os.path.getsize(RAW), "sha256": hashlib.sha256(open(RAW, "rb").read()).hexdigest()}},
  "method": "Each record is placed in a county (its point in the county polygon; else the source's county name; else its city's centre from the repo gazetteer), counted by year, and divided by the county's 2020 Census population. Value: killed per 100,000 over the decade; series: killed per 1,000,000 in each year.",
  "protocol": "Names, ages, gender, race, mental-illness flags, agency ids and exact coordinates are dropped at staging. Nothing person-level reaches the page.",
  "counts": {"placed": total, "placement": dict(how), "dropped": dict(drops), "counties": len(regions), "per_year": {str(y): round(v) for y, v in zip(YEARS, per_year)}},
  "caveats": ["The Post tracks only fatal shootings by on-duty officers; deaths by other means (restraint, Tasers, vehicles) are outside this database.",
              "The Post stopped adding new years after 2024 (README).", "Counties with a few deaths and few people carry unstable rates; the count is in every label."],
  "validation": {"known_answers": {"about 1,000 a year": str({str(y): round(v) for y, v in zip(YEARS, per_year)}),
                                   "California most in absolute terms": str(st_tot.most_common(3)),
                                   "New Mexico or Alaska highest per capita": str([(s, round(v, 2)) for s, v in st_rate[:4]])}}}
json.dump(prov, open(os.path.join(ROOT, "data", "staging", "control-police.provenance.json"), "w"), indent=1, ensure_ascii=False)
print(total, "placed;", dict(how), dict(drops))
print(prov["validation"]["known_answers"])
