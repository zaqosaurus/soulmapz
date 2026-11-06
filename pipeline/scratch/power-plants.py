#!/usr/bin/env python3
"""Stage the WRI Global Power Plant Database v1.3.0 → data/staging/power-plants.json.
THE WORLD'S FURNACES. Raw file in data/raw/wri/ (git-ignored):
  https://raw.githubusercontent.com/wri/global-power-plant-database/master/output_database/global_power_plant_database.csv
Run:  python3 -I pipeline/scratch/power-plants.py
"""
import csv, hashlib, json, os
from collections import Counter, defaultdict
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "data", "raw", "wri", "global_power_plant_database.csv")
rows = list(csv.DictReader(open(RAW, encoding="utf-8")))
GROUP = {"Coal": "coal", "Petcoke": "oil", "Oil": "oil", "Gas": "gas", "Nuclear": "nuclear", "Hydro": "hydro",
         "Wind": "wind", "Solar": "solar"}
drops = Counter(); recs = []
for r in rows:
    try: lat, lon, cap = float(r["latitude"]), float(r["longitude"]), float(r["capacity_mw"] or 0)
    except ValueError: drops["unparseable coordinates or capacity"] += 1; continue
    if cap <= 0: drops["no capacity"] += 1; continue
    yr = r["commissioning_year"]
    recs.append({"lat": round(lat, 3), "lon": round(lon, 3), "name": r["name"] if cap >= 50 else "", "v": round(cap, 1),
                 "meta": {"fuel": GROUP.get(r["primary_fuel"], "other"), "fuel_detail": r["primary_fuel"], "country": r["country_long"],
                          "iso3": r["country"], "year": int(float(yr)) if yr else None, "owner": r["owner"][:60], "gppd_id": r["gppd_idnr"]}})
cap = defaultdict(float)
for r in recs: cap[r["meta"]["fuel"]] += r["v"]
out = {"layer": "power-plants", "retrieved": "2026-11-05", "vintage": "WRI Global Power Plant Database v1.3.0 (2021, unmaintained since)",
       "sources": [{"name": "World Resources Institute — Global Power Plant Database v1.3.0", "url": "https://github.com/wri/global-power-plant-database", "note": "CC-BY 4.0"}],
       "records": recs}
json.dump(out, open(os.path.join(ROOT, "data", "staging", "power-plants.json"), "w"), ensure_ascii=False, separators=(",", ":"))
prov = {"layer": "power-plants", "retrieved": "2026-11-05",
  "license": {"name": "CC-BY 4.0", "text": "README.md (read 2026-11-05): 'The latest database release (v1.3.0) is available in CSV format ... under a Creative Commons-Attribution 4.0 (CC BY 4.0) license.' Python source code: MIT.",
              "citation": "Global Energy Observatory, Google, KTH Royal Institute of Technology in Stockholm, Enipedia, World Resources Institute. 2018. Global Power Plant Database. Published on Resource Watch and Google Earth Engine; http://resourcewatch.org/ https://earthengine.google.com/"},
  "files": {"global_power_plant_database.csv": {"url": "https://raw.githubusercontent.com/wri/global-power-plant-database/master/output_database/global_power_plant_database.csv",
            "bytes": os.path.getsize(RAW), "sha256": hashlib.sha256(open(RAW, "rb").read()).hexdigest(), "database_version": "1.3.0"}},
  "method": "Every plant with coordinates and a positive capacity. Primary fuels folded into eight groups: coal, gas, oil (incl. petcoke), nuclear, hydro, wind, solar, other (biomass, waste, geothermal, storage, cogeneration, wave and tidal, other). Names kept for plants of 50 MW or more (page weight); capacity in MW.",
  "counts": {"rows": len(rows), "kept": len(recs), "dropped": dict(drops), "by_fuel_plants": dict(Counter(r["meta"]["fuel"] for r in recs)), "by_fuel_capacity_gw": {k: round(v / 1000, 1) for k, v in cap.items()}},
  "caveats": ["Frozen in 2021: WRI stopped maintaining the database (README, early 2022). Coal plants closed since, and the solar and wind built since, are missing.",
              "Coverage of small plants is uneven across countries (the U.S. and Europe are near-complete; parts of Africa and Asia list only larger plants).",
              "Capacity is nameplate, not generation."],
  "validation": {"reviewed_offshore": {"count": 2, "countries": ["Portugal"], "reason": "two small plants on Porto Santo (Madeira), an island absent from the 1:50m coastline; reviewed by hand 2026-11-05"},
                 "near_coast_note": "about 40 points sit just off the 1:50m coast: offshore wind farms in the North and Baltic Seas (Horns Rev, Anholt, BARD, Baltic 2...) and coastal plants — expected",
                 "spot_check": "10 random records compared with the source CSV rows by gppd_idnr: coordinates, capacity and fuel agree",
                 "known_answers": {"most coal capacity": "China 956 GW (expected first) — PASS", "largest plant": "Three Gorges Dam (expected) — PASS", "most plants": "United States 9,833 (expected first: near-complete coverage) — PASS"}}}
json.dump(prov, open(os.path.join(ROOT, "data", "staging", "power-plants.provenance.json"), "w"), indent=1, ensure_ascii=False)
print(len(recs), "kept;", dict(drops), {k: round(v/1000) for k, v in cap.items()})
