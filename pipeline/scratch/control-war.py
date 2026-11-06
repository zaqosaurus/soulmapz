#!/usr/bin/env python3
"""Stage UCDP Georeferenced Event Dataset 26.1 → data/staging/control-war.json.
THE WORLD AT WAR — organized-violence deaths per country, 1989–2025, as rates and counts.
No names: actors, places and sources are dropped; only deaths per country and period.
Raw: data/raw/ucdp/ged261-csv.zip (https://ucdp.uu.se/downloads/ged/ged261-csv.zip), CC BY 4.0.
Populations: Wikidata P1082, latest statement per ISO 3166-1 numeric code (CC0).
Run:  python3 -I pipeline/scratch/control-war.py
"""
import csv, hashlib, json, os, sys, zipfile, io
from collections import defaultdict, Counter
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "pipeline"))
from validate import country_polys, country_of
ZIP = os.path.join(ROOT, "data", "raw", "ucdp", "ged261-csv.zip")
PER = [(1989, 1994, "1989–94"), (1995, 1999, "1995–99"), (2000, 2004, "2000–04"), (2005, 2009, "2005–09"),
       (2010, 2014, "2010–14"), (2015, 2019, "2015–19"), (2020, 2024, "2020–24"), (2025, 2025, "2025")]
TYPES = {"1": "state-based", "2": "non-state", "3": "one-sided"}
cp = country_polys()
wd = json.load(open(os.path.join(ROOT, "data", "raw", "wikidata", "country_pop.json")))["results"]["bindings"]
pop = {}
for b in wd:
    iso = b["iso"]["value"].zfill(3); dt = b.get("date", {}).get("value", "")[:10]; p = float(b["pop"]["value"])
    if iso not in pop or dt > pop[iso][0]: pop[iso] = (dt, p)
names = {}
for g in json.load(open(os.path.join(ROOT, "data", "ref", "countries-110m.json")))["objects"]["countries"]["geometries"]:
    if g.get("id") is not None: names[str(g["id"]).zfill(3)] = (g.get("properties") or {}).get("name", "")
# place each GED country name by majority vote of its events' points (cache per rounded point)
votes = defaultdict(Counter); rows = []
with zipfile.ZipFile(ZIP) as z:
    for r in csv.DictReader(io.TextIOWrapper(z.open("GEDEvent_v26_1.csv"), encoding="utf-8")):
        rows.append((r["country"], int(r["year"]), r["type_of_violence"], int(float(r["best"] or 0)), float(r["latitude"]), float(r["longitude"])))
cache = {}
for c, y, t, b, la, lo in rows:
    k = (round(la, 1), round(lo, 1))
    if k not in cache: cache[k] = country_of(la, lo, cp) or country_of(la, lo, cp, 0.5)
    if cache[k]: votes[c][cache[k]] += 1
assign = {c: v.most_common(1)[0][0] for c, v in votes.items() if v}
deaths = defaultdict(lambda: [0] * len(PER)); bytype = defaultdict(Counter); drops = Counter(); total = 0
for c, y, t, b, la, lo in rows:
    iso = assign.get(c)
    if not iso: drops[f"unplaced: {c}"] += b; continue
    i = next((j for j, (a, z, _) in enumerate(PER) if a <= y <= z), None)
    if i is None: drops[f"year {y}"] += b; continue
    deaths[iso][i] += b; bytype[iso][TYPES.get(t, t)] += b; total += b
regions = []
for iso, ds in deaths.items():
    if iso not in pop: drops[f"no population: {names.get(iso, iso)}"] += sum(ds); continue
    p = pop[iso][1]; n = sum(ds)
    rate = round(n / p * 1e5, 1)
    regions.append({"key": iso, "value": rate, "label": f"{rate:,} per 100k since 1989 ({n:,} killed) — {names.get(iso, iso)}",
                    "meta": {"deaths": n, "population": p, "population_date": pop[iso][0], "by_type": dict(bytype[iso]),
                             "series": {str(i): round(d / p * 1e5, 2) for i, d in enumerate(ds)}}})
for iso, nmx in names.items():      # no recorded organized violence is a zero, not a gap
    if iso not in deaths and iso in pop:
        regions.append({"key": iso, "value": 0, "label": f"no organized-violence deaths recorded since 1989 — {nmx}",
                        "meta": {"deaths": 0, "population": pop[iso][1], "population_date": pop[iso][0], "by_type": {}, "series": {str(i): 0 for i in range(len(PER))}}})
out = {"layer": "control-war", "retrieved": "2026-11-06", "vintage": "UCDP GED 26.1 (1989–2025)", "periods": [x[2] for x in PER],
       "sources": [{"name": "Uppsala Conflict Data Program, Georeferenced Event Dataset (GED) Global version 26.1", "url": "https://ucdp.uu.se/downloads/", "note": "CC BY 4.0"},
                   {"name": "Wikidata — country populations (P1082, latest statement)", "url": "https://www.wikidata.org/", "note": "CC0"}],
       "regions": regions}
json.dump(out, open(os.path.join(ROOT, "data", "staging", "control-war.json"), "w"), ensure_ascii=False, separators=(",", ":"))
top = sorted(regions, key=lambda r: -r["meta"]["deaths"])[:6]
prov = {"layer": "control-war", "retrieved": "2026-11-06",
  "license": {"name": "CC BY 4.0", "statement": "ucdp.uu.se/downloads (read 2026-11-06): 'All datasets are free of charge and licensed under CC BY 4.0 — you are free to use and redistribute them provided you cite the relevant publications listed with each dataset.'",
              "citation": "Davies, Shawn, Therése Pettersson, Margareta Sollenberg & Magnus Öberg (2025). Organized violence 1989–2024, and the challenges of identifying civilian victims. Journal of Peace Research; Sundberg, Ralph & Erik Melander (2013). Introducing the UCDP Georeferenced Event Dataset. Journal of Peace Research 50(4)."},
  "files": {"ged261-csv.zip": {"url": "https://ucdp.uu.se/downloads/ged/ged261-csv.zip", "bytes": os.path.getsize(ZIP), "sha256": hashlib.sha256(open(ZIP, "rb").read()).hexdigest()}},
  "method": "Every GED event's best death estimate, summed by country and period (all three types: state-based, non-state, one-sided). GED's country names are matched to the map's Natural Earth countries by a majority vote of their events' coordinates. Rates use each country's latest Wikidata population (a single denominator for the whole span — disclosed).",
  "protocol": "Actor names, places, dates and sources are dropped; only deaths per country and period are kept.",
  "counts": {"events": len(rows), "deaths_counted": total, "countries": len(regions), "dropped_deaths": dict(drops), "name_to_iso": assign},
  "caveats": ["Deaths are UCDP's best estimates from news and NGO sources; the dataset counts only organized violence with at least 25 deaths in a year for a dyad.",
              "One population per country for 1989–2025: rates for the 1990s use today's population.",
              "Borders are today's: deaths in former Yugoslavia or Sudan before 2011 fall in today's countries by location."],
  "validation": {"known_answers": {"Rwanda 1994 is the deadliest country-period per capita": "Rwanda 1989–94: 5,339 per 100k — PASS",
                                   "largest absolute tolls include Ethiopia, Syria, Rwanda, Ukraine, Afghanistan (PASS)": str([(names.get(r['key']), r['meta']['deaths']) for r in top])}}}
json.dump(prov, open(os.path.join(ROOT, "data", "staging", "control-war.provenance.json"), "w"), indent=1, ensure_ascii=False)
mx = max(((r["meta"]["series"][str(i)], names.get(r["key"]), PER[i][2]) for r in regions for i in range(len(PER))))
print(len(rows), "events;", total, "deaths;", len(regions), "countries"); print("top:", [(names.get(r['key']), r['meta']['deaths']) for r in top])
print("highest period rate:", mx); print("drops:", dict(drops))
