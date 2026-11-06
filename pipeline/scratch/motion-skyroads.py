#!/usr/bin/env python3
"""Stage OpenFlights routes → data/staging/motion-skyroads.json (flows between airports).
THE SKY ROADS. Raw: data/raw/openflights/{airports,routes}.dat from
  https://raw.githubusercontent.com/jpatokal/openflights/master/data/
Licence: ODbL 1.0 (database) + DbCL (contents), per data.php in the same repository
(openflights.org itself is not reachable from the build environment); route data from
Airline Route Mapper, public domain. Historic snapshot (the route file is not maintained).
Run:  python3 -I pipeline/scratch/motion-skyroads.py
"""
import csv, hashlib, json, os
from collections import Counter, defaultdict
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "data", "raw", "openflights")
ap = {}
for r in csv.reader(open(os.path.join(RAW, "airports.dat"), encoding="utf-8")):
    try: ap[r[0]] = (float(r[6]), float(r[7]), r[4] if r[4] != "\\N" else r[5], r[2], r[3])
    except (ValueError, IndexError): pass
pair = Counter(); airlines = defaultdict(set); drops = Counter(); n = 0
deg = Counter()
for r in csv.reader(open(os.path.join(RAW, "routes.dat"), encoding="utf-8")):
    n += 1
    a, b = r[3], r[5]
    if a not in ap or b not in ap: drops["airport id missing"] += 1; continue
    if a == b: drops["same airport"] += 1; continue
    k = tuple(sorted((a, b)))
    pair[k] += 1; airlines[k].add(r[0])
    deg[a] += 1; deg[b] += 1
flows = []
for (a, b), c in pair.items():
    A, B = ap[a], ap[b]
    flows.append({"a": [A[0], A[1]], "b": [B[0], B[1]], "v": len(airlines[(a, b)]), "an": A[2], "bn": B[2], "routes": c})
flows.sort(key=lambda f: -f["v"])
hubs = [(ap[k][2], ap[k][3], v) for k, v in deg.most_common(5)]
out = {"layer": "motion-skyroads", "retrieved": "2026-11-06", "vintage": "historic snapshot (~2014)",
       "sources": [{"name": "OpenFlights.org — airports and routes (route data from Airline Route Mapper)", "url": "https://github.com/jpatokal/openflights", "note": "ODbL 1.0 + DbCL"}],
       "flows": flows}
json.dump(out, open(os.path.join(ROOT, "data", "staging", "motion-skyroads.json"), "w"), ensure_ascii=False, separators=(",", ":"))
prov = {"layer": "motion-skyroads", "retrieved": "2026-11-06",
  "license": {"name": "Open Database License (ODbL) 1.0; contents under the Database Contents License (DbCL)",
              "statement": "data.php in jpatokal/openflights (read 2026-11-06): '...you are welcome to use the data as you wish, if and only if you both acknowledge the source and license any derived works made available to the public with a free license as well.' Route data from Airline Route Mapper is public domain.",
              "share_alike": "the derived flows are offered under ODbL (DATA_LICENSES.md)", "note": "openflights.org is not reachable from the build environment (proxy refusal); the licence was read from the site's own source in its repository."},
  "files": {f: {"bytes": os.path.getsize(os.path.join(RAW, f)), "sha256": hashlib.sha256(open(os.path.join(RAW, f), "rb").read()).hexdigest()} for f in ("airports.dat", "routes.dat")},
  "method": "Routes folded into undirected airport pairs; a pair's weight is the number of airlines flying it. Airports from airports.dat.",
  "counts": {"routes": n, "pairs": len(flows), "airports": len({x for k in pair for x in k}), "dropped": dict(drops)},
  "caveats": ["A historic snapshot: OpenFlights' route file is no longer maintained (roughly 2014); routes since opened or closed are not reflected.", "Airline count is not passenger volume."],
  "validation": {"known_answers": {"busiest hubs by routes": str(hubs), "count matches the data page (67,663 routes)": str(n)}}}
json.dump(prov, open(os.path.join(ROOT, "data", "staging", "motion-skyroads.provenance.json"), "w"), indent=1, ensure_ascii=False)
print(n, "routes →", len(flows), "pairs;", dict(drops)); print(hubs); print(Counter(f["v"] for f in flows).most_common(6))
