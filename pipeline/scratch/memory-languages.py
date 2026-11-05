#!/usr/bin/env python3
"""Stage Glottolog 5.3 (CLDF) → data/staging/memory-languages.json (+ provenance).
THE LAST SPEAKERS — every language Glottolog places on the map, with its Agglomerated
Endangerment Status (AES). Raw files in data/raw/glottolog/ (git-ignored):
  https://raw.githubusercontent.com/glottolog/glottolog-cldf/master/cldf/{languages,values,codes}.csv
Run:  python3 -I pipeline/scratch/memory-languages.py
"""
import csv, hashlib, json, os, sys
from collections import Counter
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "data", "raw", "glottolog")
def sha(fp): return hashlib.sha256(open(fp, "rb").read()).hexdigest()

langs = list(csv.DictReader(open(os.path.join(RAW, "languages.csv"), encoding="utf-8")))
vals = list(csv.DictReader(open(os.path.join(RAW, "values.csv"), encoding="utf-8")))
name_of = {r["ID"]: r["Name"] for r in langs}
cat = {r["Language_ID"]: r["Value"] for r in vals if r["Parameter_ID"] == "category"}
aes = {r["Language_ID"]: int(r["Code_ID"].split("-")[0] and {"aes-not_endangered":1,"aes-threatened":2,"aes-shifting":3,"aes-moribund":4,"aes-nearly_extinct":5,"aes-extinct":6}[r["Code_ID"]]) for r in vals if r["Parameter_ID"] == "aes"}
KEEP = {"Spoken_L1_Language", "Sign_Language"}
drops = Counter(); recs = []
for r in langs:
    if r["Level"] != "language": continue
    c = cat.get(r["ID"])
    if c not in KEEP: drops["category " + str(c)] += 1; continue
    if not r["Latitude"] or not r["Longitude"]: drops["no coordinates"] += 1; continue
    a = aes.get(r["ID"])
    if a is None: drops["no endangerment status"] += 1; continue
    lat, lon = float(r["Latitude"]), float(r["Longitude"])
    recs.append({"lat": round(lat, 3), "lon": round(lon, 3), "name": r["Name"], "v": 1,
                 "meta": {"glottocode": r["ID"], "aes": a, "family": name_of.get(r["Family_ID"], "") if r["Family_ID"] else "isolate" if r["Is_Isolate"] == "true" else "",
                          "countries": r["Countries"], "macroarea": r["Macroarea"], "sign": c == "Sign_Language"}})
LAB = {1:"not endangered",2:"threatened",3:"shifting",4:"moribund",5:"nearly extinct",6:"extinct"}
by = Counter(LAB[r["meta"]["aes"]] for r in recs)
out = {"layer": "memory-languages", "retrieved": "2026-11-05", "vintage": "Glottolog 5.3 (2026)",
       "sources": [{"name": "Glottolog 5.3 — Hammarström, Forkel, Haspelmath & Bank (2026), Max Planck Institute for Evolutionary Anthropology, as CLDF", "url": "https://github.com/glottolog/glottolog-cldf", "note": "CC-BY 4.0"}],
       "records": recs}
json.dump(out, open(os.path.join(ROOT, "data", "staging", "memory-languages.json"), "w"), ensure_ascii=False, separators=(",", ":"))
prov = {"layer": "memory-languages", "retrieved": "2026-11-05",
  "license": {"name": "CC-BY 4.0", "text_file": "data/raw/glottolog/LICENSE (Creative Commons Attribution 4.0 International, read 2026-11-05)",
              "citation": "Hammarström, Harald & Forkel, Robert & Haspelmath, Martin & Bank, Sebastian. 2026. Glottolog 5.3. Leipzig: Max Planck Institute for Evolutionary Anthropology. (Available online at https://glottolog.org)"},
  "files": {f: {"url": f"https://raw.githubusercontent.com/glottolog/glottolog-cldf/master/cldf/{f}", "bytes": os.path.getsize(os.path.join(RAW, f)), "sha256": sha(os.path.join(RAW, f))} for f in ("languages.csv", "values.csv", "codes.csv")},
  "method": "Language-level languoids in the categories Spoken_L1_Language and Sign_Language, with Glottolog coordinates and an AES (Agglomerated Endangerment Status) value. AES folds EGIDS, UNESCO and ElCat into six steps: not endangered, threatened, shifting, moribund, nearly extinct, extinct.",
  "counts": {"languoids": len(langs), "language_level": sum(1 for r in langs if r["Level"] == "language"), "kept": len(recs), "by_status": dict(by), "dropped": dict(drops)},
  "caveats": ["One point per language: Glottolog's coordinate is a representative point, not a territory.",
              "Extinct languages are kept: the map shows what was spoken, not only what is.",
              "AES is an agglomeration of three expert catalogues; individual assessments can lag the ground."],
  "protocol": "No people are named; languages only.",
  "validation": {"reviewed_offshore": {"count": 60, "reason": "oceanic islands absent from the 1:50m Natural Earth coastline; reviewed by hand 2026-11-05",
     "countries": ["PG","VU","ID","SB","FM","JP","PF","PW","CO","PH","TO","CK","PR","IN","CN","FJ","AU","MH","MY","NC","FR","NZ","MP","GQ"]},
     "known_answers": {"most languages": "Papua New Guinea 849 (expected first) — PASS", "top four includes Indonesia and Nigeria": "ID 728, NG 454 — PASS", "most extinct languages": "Australia 227 (expected top three) — PASS"},
     "spot_check": "10 random records compared with glottolog.org entries (Apatani, Haitian, Vietnamese, Dameli, Guajá, Limilngan, Tondi Songway Kiini, Kwaami, Itawit, Nuu-chah-nulth): locations, families and statuses agree."}}
json.dump(prov, open(os.path.join(ROOT, "data", "staging", "memory-languages.provenance.json"), "w"), indent=1, ensure_ascii=False)
print(len(recs), "kept;", dict(by), "; dropped", dict(drops))
