#!/usr/bin/env python3
"""Stage Eviction Lab county estimates 2000–2018 → data/staging/motion-eviction.json.
THE PRICE OF STAYING — households threatened with eviction per 100 renting households.
Raw: data/raw/eviction/county_eviction_estimates_2000_2018.csv from
  https://eviction-lab-data-downloads.s3.amazonaws.com/estimating-eviction-prevalance-across-us/
Licence: ODC-BY 1.0 (stated on data-downloads.evictionlab.org, read 2026-11-06).
Run:  python3 -I pipeline/scratch/motion-eviction.py
"""
import csv, hashlib, json, os
from collections import defaultdict, Counter
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "data", "raw", "eviction", "county_eviction_estimates_2000_2018.csv")
YEARS = list(range(2000, 2019))
rows = list(csv.DictReader(open(RAW, encoding="utf-8")))
by = defaultdict(dict); name = {}; filings = Counter(); drops = Counter()
for r in rows:
    f = r["FIPS_county"].zfill(5); y = int(r["year"])
    name[f] = f"{r['county']}, {r['state']}"
    try: rh, ht, fi = float(r["renting_hh"]), float(r["hh_threat_estimate"]), float(r["filings_estimate"])
    except ValueError: drops["missing estimate"] += 1; continue
    filings[y] += fi
    if rh < 50: drops["fewer than 50 renting households (rate not shown)"] += 1; continue
    by[f][y] = (ht, rh)
regions = []
for f, ys in by.items():
    last = [ys[y] for y in range(2014, 2019) if y in ys]
    if not last: drops["no 2014–2018 estimate"] += 1; continue
    rate = round(sum(h for h, _ in last) / sum(rh for _, rh in last) * 100, 2)
    series = {str(y): round(ys[y][0] / ys[y][1] * 100, 2) for y in YEARS if y in ys}
    regions.append({"key": f, "value": rate,
                    "label": f"{rate} of every 100 renting households threatened with eviction a year (2014–18) — {name[f]}",
                    "meta": {"series": series, "renting_hh_2018": ys.get(2018, (0, 0))[1]}})
out = {"layer": "motion-eviction", "retrieved": "2026-11-06", "vintage": "2000–2018 (model estimates, deposited 2022)",
       "sources": [{"name": "Gromis, Fellows, Hendrickson, Edmonds, Leung, Porton & Desmond — Estimating Eviction Prevalence across the United States, Princeton University Eviction Lab (2022)", "url": "https://data-downloads.evictionlab.org/", "note": "ODC-BY 1.0"}],
       "regions": regions}
json.dump(out, open(os.path.join(ROOT, "data", "staging", "motion-eviction.json"), "w"), ensure_ascii=False, separators=(",", ":"))
top = sorted(regions, key=lambda r: -r["value"])[:8]
st = Counter(r["label"].split(", ")[-1] for r in sorted(regions, key=lambda r: -r["value"])[:100])
prov = {"layer": "motion-eviction", "retrieved": "2026-11-06",
  "license": {"name": "ODC-BY 1.0 (Open Data Commons Attribution License)", "statement": "data-downloads.evictionlab.org (read 2026-11-06): 'This data is shared under the terms of the Open Data Commons Attribution License (ODC-BY 1.0).'",
              "citation": "Ashley Gromis, Ian Fellows, James R. Hendrickson, Lavar Edmonds, Lillian Leung, Adam Porton, and Matthew Desmond. Estimating Eviction Prevalence across the United States. Princeton University Eviction Lab. Deposited May 13, 2022."},
  "gate": "PLAN_V07 2.3 required that redistribution of derived rates be allowed: ODC-BY 1.0 allows it with attribution. Only the published model estimates are used — not the proprietary-count files.",
  "files": {"county_eviction_estimates_2000_2018.csv": {"bytes": os.path.getsize(RAW), "sha256": hashlib.sha256(open(RAW, "rb").read()).hexdigest()}},
  "method": "Households threatened with eviction (model estimate) divided by renting households, per 100. Overall value pools 2014–2018; the series gives each year. Counties with fewer than 50 renting households in a year are not shown for that year.",
  "counts": {"rows": len(rows), "counties": len(regions), "dropped": dict(drops), "national_filings_estimate_by_year": {str(y): round(v) for y, v in sorted(filings.items())}},
  "caveats": ["These are modelled estimates with confidence intervals (in the source), filling counties where courts do not report.", "A filing threatens a household; not every filing ends in a removal.", "Ends in 2018: the pandemic moratoria and what came after are not here."],
  "validation": {"known_answers": {"about 3.6 million filings a year": f"mean {round(sum(filings.values())/len(filings)):,}",
                                   "highest rates concentrated in the Southeast": str(st.most_common(5)),
                                   "Richmond, VA near the top": str([(r['label'].split(' — ')[1], r['value']) for r in top])}}}
json.dump(prov, open(os.path.join(ROOT, "data", "staging", "motion-eviction.provenance.json"), "w"), indent=1, ensure_ascii=False)
print(len(regions), "counties;", dict(drops)); print(json.dumps(prov["validation"]["known_answers"], indent=1, ensure_ascii=False))
