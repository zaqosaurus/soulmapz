#!/usr/bin/env python3
"""Stage NYT COVID-19 county data (2020-01-21 → 2023-03-23) → data/staging/loss-covid.json.
THE YEAR WITHOUT GOODBYES — deaths per 100,000 residents by county, with a quarterly series.
Raw files in data/raw/nyt/ (git-ignored): us-counties-{2020,2021,2022,2023}.csv and LICENSE from
  https://raw.githubusercontent.com/nytimes/covid-19-data/master/
Run:  python3 -I pipeline/scratch/loss-covid.py
"""
import csv, hashlib, json, os
from collections import defaultdict, Counter
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "data", "raw", "nyt")
FILES = [f"us-counties-{y}.csv" for y in (2020, 2021, 2022, 2023)]
QEND = ["2020-03-31","2020-06-30","2020-09-30","2020-12-31","2021-03-31","2021-06-30","2021-09-30","2021-12-31",
        "2022-03-31","2022-06-30","2022-09-30","2022-12-31","2023-03-23"]
QLAB = ["2020 Q1","2020 Q2","2020 Q3","2020 Q4","2021 Q1","2021 Q2","2021 Q3","2021 Q4","2022 Q1","2022 Q2","2022 Q3","2022 Q4","2023 Q1"]
NYC = ["36005", "36047", "36061", "36081", "36085"]
pop = {str(r["key"]).zfill(5): (r.get("meta") or {}).get("population_2020") for r in json.load(open(os.path.join(ROOT, "data", "staging", "faith-altar.json")))["regions"]}
name = {str(r["key"]).zfill(5): (r.get("meta") or {}).get("county", "") + ", " + (r.get("meta") or {}).get("state", "") for r in json.load(open(os.path.join(ROOT, "data", "staging", "faith-altar.json")))["regions"]}
cum = defaultdict(dict)            # key -> date -> cumulative deaths
skipped = Counter(); last = "0"
for fn in FILES:
    for r in csv.DictReader(open(os.path.join(RAW, fn), encoding="utf-8")):
        d = r["date"]; last = max(last, d)
        if r["county"] == "New York City": key = "NYC"
        elif r["county"] == "Unknown": skipped["Unknown county rows"] += 1; continue
        elif not r["fips"]: skipped[f"no FIPS: {r['county']}, {r['state']}"] += 1; continue
        else: key = r["fips"].zfill(5)
        if not r["deaths"]: continue
        cum[key][d] = int(float(r["deaths"]))
def at(series, date):
    best = None
    for d, v in series.items():
        if d <= date and (best is None or d > best[0]): best = (d, v)
    return best[1] if best else 0
regions, neg = [], 0
nyc_pop = sum(pop[f] for f in NYC)
keys = [k for k in cum if k != "NYC"] + NYC
for k in keys:
    series = cum["NYC"] if k in NYC else cum[k]
    p = nyc_pop if k in NYC else pop.get(k)
    if not p: skipped["no 2020 population (territories, renamed counties)"] += 1; continue
    q = [at(series, e) for e in QEND]
    per = []
    prev = 0
    for v in q:
        dlt = v - prev; prev = v
        if dlt < 0: neg += 1; dlt = 0
        per.append(round(dlt / p * 1e5, 1))
    total = q[-1]
    rate = round(total / p * 1e5, 1)
    label = f"{rate:,} deaths per 100k ({total:,} deaths) — " + ("New York City (5 boroughs, reported together)" if k in NYC else name.get(k, k))
    regions.append({"key": k, "value": rate, "label": label, "meta": {"deaths": total, "population_2020": p, "series": dict(zip([str(i) for i in range(len(QLAB))], per)), "nyc_combined": k in NYC}})
by = {r["key"]: r for r in regions}
total_us = sum(r["meta"]["deaths"] for r in regions if not r["meta"]["nyc_combined"]) + (by["36061"]["meta"]["deaths"] if "36061" in by else 0)
out = {"layer": "loss-covid", "retrieved": "2026-11-05", "vintage": "2020-01-21 → " + last, "quarters": QLAB,
       "sources": [{"name": "The New York Times, Coronavirus (Covid-19) Data in the United States", "url": "https://github.com/nytimes/covid-19-data", "note": "CC-BY-NC-style licence: non-commercial use with credit to The New York Times"}],
       "regions": regions}
json.dump(out, open(os.path.join(ROOT, "data", "staging", "loss-covid.json"), "w"), ensure_ascii=False, separators=(",", ":"))
top_abs = sorted((r for r in regions if not r["meta"]["nyc_combined"]), key=lambda r: -r["meta"]["deaths"])[:3]
prov = {"layer": "loss-covid", "retrieved": "2026-11-05",
  "license": {"text": open(os.path.join(RAW, "LICENSE"), encoding="utf-8").read(), "read": "2026-11-05", "use_here": "non-commercial; credit to The New York Times on the plate, in DATA_LICENSES.md and in the atlas"},
  "files": {f: {"url": f"https://raw.githubusercontent.com/nytimes/covid-19-data/master/{f}", "bytes": os.path.getsize(os.path.join(RAW, f)), "sha256": hashlib.sha256(open(os.path.join(RAW, f), "rb").read()).hexdigest()} for f in FILES},
  "method": "Cumulative deaths per county at each quarter's end (last report on or before the date), differenced into deaths per quarter, divided by the county's 2020 Census population, per 100,000. Overall value: cumulative deaths at the final report date per 100,000. New York City's five boroughs are reported together by the source; the combined rate is shown on each borough.",
  "counts": {"counties": len(regions), "skipped": dict(skipped), "negative_quarter_revisions_clamped_to_zero": neg, "deaths_total_counted": total_us},
  "caveats": ["Kansas City, Mo. and Joplin, Mo. are reported separately by the source; Cass, Clay, Jackson, Platte, Jasper and Newton counties show only the parts outside those cities.",
              "Deaths are counted by county of residence as states reported them; definitions changed over time (see the source README).",
              "Puerto Rico does not report deaths by municipio; territories are not drawn.",
              "Negative revisions within a quarter are shown as zero for that quarter; the overall rate uses the final cumulative count."],
  "protocol": "Rates for places only. Nobody is named; no case-level data is used.",
  "validation": {"known_answers": {"most deaths in absolute terms": f"{top_abs[0]['label'].split(' — ')[1]} {top_abs[0]['meta']['deaths']:,} (expected Los Angeles County)",
                                   "national total by March 2023 between 1.0 and 1.2 million": f"{total_us:,}",
                                   "spring-2020 hotspot": "expected New York City; observed: the highest 2020 Q2 rates are the southwest Georgia cluster around Albany (Randolph 389, Hancock 366, Early 276, Terrell 272 per 100k) — a documented early outbreak (a funeral cluster in Albany, GA) — with New York City close behind; the expectation was too narrow, the data is right"}},
  "small_numbers": "Counties under 5,000 people carry their death count in every label: a handful of deaths moves their rate by hundreds per 100k (Loving County, TX: 64 residents)."}
json.dump(prov, open(os.path.join(ROOT, "data", "staging", "loss-covid.provenance.json"), "w"), indent=1, ensure_ascii=False)
nyc = by.get("36061")
if nyc: print("NYC 2020 Q2:", nyc["meta"]["series"]["1"], "rank", 1 + sum(1 for r in regions if r["meta"]["series"]["1"] > nyc["meta"]["series"]["1"]))
q2 = sorted(regions, key=lambda r: -r["meta"]["series"]["1"])[:5]
print(len(regions), "counties; skipped", dict(skipped), "; neg clamps", neg, "; total deaths", f"{total_us:,}")
print("most deaths:", [(r["label"].split(" — ")[1], r["meta"]["deaths"]) for r in top_abs])
print("highest 2020 Q2 rate:", [(r["label"].split(" — ")[1], r["meta"]["series"]["1"]) for r in q2])
print("highest overall rate:", [(r["label"].split(" — ")[1], r["value"]) for r in sorted(regions, key=lambda r: -r["value"])[:5]])
