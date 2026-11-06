#!/usr/bin/env python3
"""Stage IRS SOI county income data (tax year 2022) → data/staging/company-gifts.json.
GIFTS ON THE RETURN — itemized charitable deductions as a share of income, by county.
Honest scope: this is where gifts are *itemized*, which after the 2017 tax law is mostly
where incomes and deductions are high. It is not a measure of generosity (see 'Kindness').
Raw: data/raw/irs/22incyallnoagi.csv from https://www.irs.gov/pub/irs-soi/22incyallnoagi.csv
Licence: U.S. government work (public domain), IRS Statistics of Income.
Run:  python3 -I pipeline/scratch/company-gifts.py
"""
import csv, hashlib, json, os
from collections import Counter
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, "data", "raw", "irs", "22incyallnoagi.csv")
faith = {str(r["key"]).zfill(5): (r["meta"]["county"], r["meta"]["state"]) for r in json.load(open(os.path.join(ROOT, "data", "staging", "faith-altar.json")))["regions"]}
regions, drops = [], Counter()
nat = [0, 0, 0, 0, 0]
for r in csv.DictReader(open(RAW, encoding="latin-1")):
    if r["COUNTYFIPS"] == "000": continue
    f = r["STATEFIPS"].zfill(2) + r["COUNTYFIPS"].zfill(3)
    n1, agi, ngift, gift, nitem = (float(r[k] or 0) for k in ("N1", "A00100", "N19700", "A19700", "N04470"))
    nat = [a + b for a, b in zip(nat, (n1, agi, ngift, gift, nitem))]
    if n1 < 500 or agi <= 0: drops["fewer than 500 returns or no income"] += 1; continue
    share = round(gift / agi * 100, 2)
    nm = faith.get(f, (r["COUNTYNAME"], r["STATE"]))
    regions.append({"key": f, "value": share,
                    "label": f"{share}% of income given in itemized gifts · {round(ngift / n1 * 100, 1)}% of returns claim one — {nm[0]}, {nm[1]}",
                    "meta": {"returns": int(n1), "returns_claiming": int(ngift), "returns_itemizing": int(nitem), "gifts_thousands": int(gift), "agi_thousands": int(agi)}})
out = {"layer": "company-gifts", "retrieved": "2026-11-06", "vintage": "tax year 2022",
       "sources": [{"name": "IRS Statistics of Income — County Data, tax year 2022 (22incyallnoagi.csv)", "url": "https://www.irs.gov/statistics/soi-tax-stats-county-data", "note": "U.S. government work"}],
       "regions": regions}
json.dump(out, open(os.path.join(ROOT, "data", "staging", "company-gifts.json"), "w"), ensure_ascii=False, separators=(",", ":"))
top = sorted(regions, key=lambda r: -r["value"])[:8]
st = Counter(r["label"].split(", ")[-1] for r in top[:0] + sorted(regions, key=lambda r: -r["value"])[:50])
prov = {"layer": "company-gifts", "retrieved": "2026-11-06",
  "license": {"name": "Public domain (U.S. government work, 17 U.S.C. § 105)", "source_page": "https://www.irs.gov/statistics/soi-tax-stats-county-data"},
  "files": {"22incyallnoagi.csv": {"url": "https://www.irs.gov/pub/irs-soi/22incyallnoagi.csv", "bytes": os.path.getsize(RAW), "sha256": hashlib.sha256(open(RAW, "rb").read()).hexdigest()}},
  "method": "Itemized charitable contributions (A19700) divided by adjusted gross income (A00100), per county, tax year 2022; also the share of returns claiming the deduction (N19700/N1). Counties under 500 returns are not shown.",
  "measurement_warning": f"Only {nat[4]/nat[0]*100:.1f}% of returns itemized in 2022 and {nat[2]/nat[0]*100:.1f}% claimed a charitable deduction. Gifts by the other ~90% of filers are invisible here. This layer shows where giving is recorded on tax returns — tracking income, home values and state tax law — not how generous a place is. The 'Kindness' slot stays PENDING for that.",
  "counts": {"counties": len(regions), "dropped": dict(drops), "national": {"returns": int(nat[0]), "itemizing_pct": round(nat[4]/nat[0]*100, 1), "claiming_gift_pct": round(nat[2]/nat[0]*100, 1), "gifts_share_of_agi_pct": round(nat[3]/nat[1]*100, 2)}},
  "validation": {"known_answers": {"Utah counties near the top (tithing)": str([(r['label'].split(' — ')[1], r['value']) for r in top]), "states in the top 50": str(st.most_common(5))}}}
json.dump(prov, open(os.path.join(ROOT, "data", "staging", "company-gifts.provenance.json"), "w"), indent=1, ensure_ascii=False)
print(len(regions), dict(drops), prov["counts"]["national"]); print(prov["validation"]["known_answers"])
