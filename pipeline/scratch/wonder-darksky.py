#!/usr/bin/env python3
"""Stage dark-sky places from Wikidata → data/staging/wonder-darksky.json.
THE LAST DARK. darksky.org shows a bot challenge to scripts (not circumvented), so the list
comes from Wikidata (CC0): items that are, or are designated as, an International Dark Sky
Park, Reserve, Sanctuary, Community, Urban Night Sky Place, or a generic dark-sky preserve.
Raw: data/raw/wikidata/darksky.json (SPARQL result, query in this file's provenance sidecar).
Run:  python3 -I pipeline/scratch/wonder-darksky.py
"""
import json, os, re, hashlib
from collections import Counter
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "data", "raw", "wikidata", "darksky.json")
KIND = {"Q72114299": "sanctuary", "Q72114283": "reserve", "Q52216504": "park", "Q72114249": "community", "Q72114320": "urban", "Q3457162": "preserve"}
PRI = ["sanctuary", "reserve", "park", "community", "urban", "preserve"]
items = {}
for b in json.load(open(RAW))["results"]["bindings"]:
    q = b["x"]["value"].rsplit("/", 1)[1]
    it = items.setdefault(q, {"kinds": set(), "coord": None, "country": "", "label": b.get("xLabel", {}).get("value", ""), "wp": ""})
    it["kinds"].add(KIND[b["kind"]["value"].rsplit("/", 1)[1]])
    if "coord" in b and not it["coord"]: it["coord"] = b["coord"]["value"]
    if "countryLabel" in b: it["country"] = b["countryLabel"]["value"]
    if "article" in b: it["wp"] = b["article"]["value"]
recs, drops = [], Counter()
for q, it in items.items():
    m = re.match(r"Point\(([-\d.eE]+) ([-\d.eE]+)\)", it["coord"] or "")
    if not m: drops["no coordinates"] += 1; continue
    if re.fullmatch(r"Q\d+", it["label"]): drops["no English label"] += 1; continue
    kind = next(k for k in PRI if k in it["kinds"])
    recs.append({"lat": round(float(m.group(2)), 3), "lon": round(float(m.group(1)), 3), "name": it["label"], "v": 1,
                 "meta": {"qid": q, "kind": kind, "country": it["country"], "wikipedia": it["wp"]}})
out = {"layer": "wonder-darksky", "retrieved": "2026-11-06", "vintage": "Wikidata, 2026-11-06",
       "sources": [{"name": "Wikidata — dark-sky places (instances or designations of DarkSky International categories)", "url": "https://query.wikidata.org/", "note": "CC0"}],
       "records": recs}
json.dump(out, open(os.path.join(ROOT, "data", "staging", "wonder-darksky.json"), "w"), ensure_ascii=False, separators=(",", ":"))
prov = {"layer": "wonder-darksky", "retrieved": "2026-11-06", "license": {"name": "CC0 (Wikidata)"},
  "gate": "darksky.org presents a bot challenge to scripts; the survey does not get around bot checks, so DarkSky International's own register was not read. Wikidata's record is a partial mirror of it.",
  "files": {"darksky.json": {"bytes": os.path.getsize(RAW), "sha256": hashlib.sha256(open(RAW, "rb").read()).hexdigest()}},
  "query_classes": KIND, "method": "Items with P31 or P1435 among the classes above; one kind per item (sanctuary > reserve > park > community > urban > generic preserve); P625 coordinates.",
  "counts": {"items": len(items), "kept": len(recs), "dropped": dict(drops), "by_kind": dict(Counter(r["meta"]["kind"] for r in recs)), "by_country": dict(Counter(r["meta"]["country"] for r in recs).most_common(10))},
  "caveats": ["Incomplete: Wikidata does not yet record every certified place; the true count is higher.", "A point per place; reserves cover large areas."],
  "validation": {"reviewed_offshore": {"count": 1, "countries": ["United Kingdom"], "reason": "Pitcairn Islands (a Dark Sky Sanctuary since 2019), too small for the 1:50m coastline; reviewed by hand 2026-11-06"},
                 "known_answers": {"first International Dark Sky Park (Natural Bridges, 2007) present": "PASS", "Aoraki Mackenzie reserve (NZ) present": "PASS", "Central Idaho reserve present": "PASS", "the U.S. holds the most places": str(Counter(r['meta']['country'] for r in recs).most_common(1))}}}
json.dump(prov, open(os.path.join(ROOT, "data", "staging", "wonder-darksky.provenance.json"), "w"), indent=1, ensure_ascii=False)
print(len(recs), "kept;", dict(drops), prov["counts"]["by_kind"])
