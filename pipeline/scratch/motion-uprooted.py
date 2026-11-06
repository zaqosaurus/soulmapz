#!/usr/bin/env python3
"""Stage UNHCR refugee population statistics (end-2024) → data/staging/motion-uprooted.json.
THE UPROOTED — refugees, asylum-seekers and other people in need of international protection, from country of origin to country of asylum.
Raw: data/raw/unhcr/pop2024.json from
  https://api.unhcr.org/population/v1/population/?limit=10000&yearFrom=2024&yearTo=2024&coo_all=true&coa_all=true
Licence: CC BY 4.0 with UNHCR's supplemental Terms of Use for Datasets (read 2026-11-06).
Country codes ISO3 → ISO numeric via Wikidata (CC0); positions = centroid of each country's
largest polygon in the map's own Natural Earth 1:110m shapes.
Run:  python3 -I pipeline/scratch/motion-uprooted.py
"""
import json, os, sys, hashlib
from collections import Counter
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "pipeline"))
from validate import country_polys
RAW = os.path.join(ROOT, "data", "raw", "unhcr", "pop2024.json")
items = json.load(open(RAW))["items"]
a3n = {}
for b in json.load(open(os.path.join(ROOT, "data", "raw", "wikidata", "iso3_num.json")))["results"]["bindings"]:
    a3n.setdefault(b["a3"]["value"], b["num"]["value"].zfill(3))
cp = country_polys()
def centroid(iso):
    """Spherical mean of the largest polygon's vertices — safe across the antimeridian
    (a planar centroid put Russia in the Bering Sea)."""
    import math
    polys = cp.get(iso)
    if not polys: return None
    best = max(polys, key=lambda p: len(p[4][0]))
    X = Y = Z = 0
    for lon, lat in best[4][0]:
        la, lo = math.radians(lat), math.radians(lon)
        X += math.cos(la) * math.cos(lo); Y += math.cos(la) * math.sin(lo); Z += math.sin(la)
    return (math.degrees(math.atan2(Z, math.hypot(X, Y))), math.degrees(math.atan2(Y, X)))
num = lambda v: int(v) if isinstance(v, int) or (isinstance(v, str) and v.isdigit()) else 0
flows = []; drops = Counter(); total = 0; by_origin = Counter(); by_host = Counter()
for r in items:
    n = num(r["refugees"]) + num(r["asylum_seekers"]) + num(r["oip"])
    if n <= 0: continue
    a, b = r["coo_iso"], r["coa_iso"]
    if a == b: drops["same country"] += n; continue
    ia, ib = a3n.get(a), a3n.get(b)
    if not ia or not ib: drops[f"no ISO code: {r['coo_name'] if not ia else r['coa_name']}"] += n; continue
    ca, cb = centroid(ia), centroid(ib)
    if not ca or not cb: drops[f"not on the 1:110m map: {r['coo_name'] if not ca else r['coa_name']}"] += n; continue
    total += n; by_origin[r["coo_name"]] += n; by_host[r["coa_name"]] += n
    flows.append({"a": [round(ca[0], 2), round(ca[1], 2)], "b": [round(cb[0], 2), round(cb[1], 2)], "v": n, "an": r["coo_name"], "bn": r["coa_name"]})
out = {"layer": "motion-uprooted", "retrieved": "2026-11-06", "vintage": "end-2024",
       "sources": [{"name": "UNHCR Refugee Population Statistics Database (Refugee Data Finder API)", "url": "https://api.unhcr.org/population/v1/", "note": "CC BY 4.0, UNHCR Terms of Use for Datasets"}],
       "flows": flows}
json.dump(out, open(os.path.join(ROOT, "data", "staging", "motion-uprooted.json"), "w"), ensure_ascii=False, separators=(",", ":"))
prov = {"layer": "motion-uprooted", "retrieved": "2026-11-06",
  "license": {"name": "CC BY 4.0 with supplemental Terms of Use for Datasets",
              "statement": "unhcr.org/us/terms-use-datasets (read via search excerpt 2026-11-06; www.unhcr.org is not reachable from the build environment): 'Except where otherwise provided, the datasets made available by UNHCR on the UNHCR Refugee Population Statistics Database (the “Datasets”) are licensed under a Creative Commons Attribution International License 4.0 (the “CC BY License”) and the provision thereof is subject to the supplemental terms contained below in these Terms of Use for Datasets.' The Methodology page states the same.",
              "attribution": "UNHCR Refugee Population Statistics Database"},
  "files": {"pop2024.json": {"bytes": os.path.getsize(RAW), "sha256": hashlib.sha256(open(RAW, "rb").read()).hexdigest()}},
  "method": "For each origin–asylum pair at end-2024: refugees + asylum-seekers + other people in need of international protection (UNHCR's own headline category). Internally displaced people (same country) are not drawn. Arcs run between the centroids of each country's largest polygon on the map.",
  "counts": {"pairs_in": len(items), "flows": len(flows), "people_drawn": total, "dropped_people": dict(drops)},
  "caveats": ["Stocks at end-2024, not flows within the year: an arc is everyone from A then living in B.", "Palestine refugees under UNRWA's mandate are outside UNHCR's statistics.", "Country centroids, not camps or cities."],
  "validation": {"known_answers": {"largest origins include Afghanistan, Syria, Venezuela, Ukraine, Sudan": str(by_origin.most_common(6)),
                                   "largest hosts include Iran, Türkiye, Colombia, Germany, Uganda (and the U.S., through pending asylum claims)": str(by_host.most_common(6))}}}
json.dump(prov, open(os.path.join(ROOT, "data", "staging", "motion-uprooted.provenance.json"), "w"), indent=1, ensure_ascii=False)
print(len(flows), "flows;", f"{total:,} people;", dict(drops))
print(by_origin.most_common(6)); print(by_host.most_common(6))
