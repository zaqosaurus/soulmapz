#!/usr/bin/env python3
"""THE SOUL SURVEY — build script (v2).
Packs data/staging/*.json into compact layer payloads, merges era buckets,
computes stats, and injects registry + data + basemaps + vendored libs into
a single self-contained dist/index.html. Zero runtime network calls.
"""
import json, os, sys, gzip, base64
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def p(*parts): return os.path.join(ROOT, *parts)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from correlate import county_centroids
from packer import pack_layer, lenses_for

STATE_FIPS = {"01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY"}

import re
def shrink_label(s):
    """Page-weight discipline: labels lose ' County' and parenthetical vintages
    (the plate carries vintage); tooltips stay readable."""
    s = re.sub(r"\s*\((?:19|20)\d\d[^)]*\)", "", s)
    s = s.replace(" County,", ",").replace(" Parish,", ",").replace(" Borough,", ",").replace(" Census Area,", ",")
    s = s.replace("economic connectedness", "EC").replace(" deaths per 100k", "/100k").replace(" per 100k", "/100k")
    s = s.replace(" households", " hh")
    return re.sub(r"\s+", " ", s).strip()

def pack_county_regions(st):
    counties, vals = {}, []
    for r in st["regions"]:
        counties[str(r["key"]).zfill(5)] = {"v": r["value"], "label": shrink_label(r["label"])}
        vals.append(r["value"])
    vals.sort()
    vmax = vals[int(len(vals)*0.95)] if vals else 1
    return counties, round(float(vmax), 3)

STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"]
ERA_LABELS = ["≤ 500", "501–1500", "1501–1800", "1801–1900", "1901–2018"]
STAR_GROUPS = ["Screen", "Music", "Letters", "Art", "Thought & science", "Sport", "Power", "Faith", "Other callings"]
STAR_GROUP = {}
for _g, _ds in enumerate([
    "actor film screenwriter comedian producer model director actress",
    "singer composer guitar rapper music conductor pianist opera musician drummer",
    "writer poet novelist playwright author journalist historian",
    "painter artist sculptor architect photographer designer",
    "philosopher mathematician physicist economist biologist chemist anthropologist astronomer psychologist inventor engineer physician theologian scientist",
    "football player basket wrestler driver boxer baseball tennis cyclist athlete",
    "politician king emperor monarch queen sovereign sultan statesman aristocrat political officer militar soldier entrepreneur business lawyer pharaoh",
    "priest prophet religious cleric pope saint"]):
    for _d in _ds.split(): STAR_GROUP[_d] = _g
STAR_GROUP["martial art"] = 5

def load(path):
    with open(path, encoding="utf-8") as f: return json.load(f)

def rnd(x, nd=3): return round(float(x), nd)
def fmt_int(n): return f"{n:,}"

def load_staging(layer_id):
    fp = p("data","staging",f"{layer_id}.json")
    return load(fp) if os.path.exists(fp) else None

# ---------- v0.6: the survey knows where it lives ----------
def _git(*args):
    import subprocess
    try:
        out = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, timeout=20)
        return out.stdout.strip() if out.returncode == 0 else ""
    except Exception:
        return ""

def repo_info(meta):
    """owner/repo and the Pages URL. registry meta.repo wins when set (the original
    author's home); otherwise derived from the git remote so forks link to themselves."""
    repo = (meta.get("repo") or "").strip()
    if not repo:
        url = _git("remote", "get-url", "origin")
        m = re.search(r"github\.com[:/]([^/]+)/([^/\s]+?)(?:\.git)?$", url)
        if m: repo = f"{m.group(1)}/{m.group(2)}"
    if not repo:
        repo = "ansalamalasna/soulmap"
    owner, name = repo.split("/", 1)
    site = (meta.get("site") or "").strip() or f"https://{owner}.github.io/{name}/"
    return repo, site

def living_log(limit=80):
    """THE LIVING LOG — the survey's memory of itself, straight from git history.
    Subjects only; trailers never reach the page."""
    raw = _git("log", "--date=short", "--pretty=%ad%x09%s", "-n", str(limit), "--no-merges")
    rows = []
    for line in raw.splitlines():
        if "\t" not in line: continue
        d, s = line.split("\t", 1)
        s = s.strip()
        if not s or s.lower().startswith("merge "): continue
        rows.append([d, s[:140]])
    return rows

def write_data_api(registry, repo, layers_data):
    """docs/DATA_API.md — the Data API that already exists: every staging file as a
    stable raw endpoint, one curl line each. Regenerated every build so counts and
    vintages never drift from the page."""
    raw = f"https://raw.githubusercontent.com/{repo}/main"
    lines = ["# THE DATA API", "",
             "*Every staging file is a stable, versioned endpoint. Zero infrastructure; total legitimacy.*", "",
             "The survey's data lives in `data/staging/` as plain JSON with a provenance sidecar beside",
             "every file. GitHub serves them raw. Pin a release tag instead of `main` for a frozen vintage",
             f"(`{raw.replace('/main', '/v' + registry['meta']['version'])}/...`). Licenses per layer are in",
             "[DATA_LICENSES.md](../DATA_LICENSES.md) — several require attribution and one is share-alike.", "",
             "## Shapes", "",
             "| Shape | Keys | Used by |", "|---|---|---|",
             "| points | `records[]` of `{lat, lon, v, name?, meta{}}` | crashes, data centers, thrones, fulfillment, omens, Superfund, sightings, the ledger |",
             "| regions | `regions[]` of `{key, value, label, meta?}` — key is a 5-digit county FIPS or `US-XX` state | overdoses, suicide, connectedness, adherence, desire |",
             "| cells | `cells[]` of `{lat, lon, v, top?[]}` on a 0.25° grid | memory, eras |",
             "| flows | `counties[]` of `{fips, in, out, net}` + `flows[]` of `{a, b, hh}` | the sorting |", "",
             "## Endpoints", "",
             "| Layer | Vintage | Records | Staging | Provenance |", "|---|---|---|---|---|"]
    for lay in registry["layers"]:
        lid = lay["id"]
        if lay.get("status") != "live": continue
        st_path = p("data","staging",f"{lid}.json")
        if not os.path.exists(st_path): continue
        vint = str(lay.get("vintage") or (lay.get("retrieved") or "")[:10])
        d = layers_data.get(lid, {})
        n = d.get("n", len(d.get("counties", {}) or d.get("us", {}) or {}))
        lines.append(f"| {lay['title']} | {vint} | {n:,} | [`{lid}.json`]({raw}/data/staging/{lid}.json) | [sidecar]({raw}/data/staging/{lid}.provenance.json) |")
    for extra in ("memory-eras", "memory-bios"):
        if os.path.exists(p("data","staging",f"{extra}.json")):
            lines.append(f"| {extra} (enrichment) | — | — | [`{extra}.json`]({raw}/data/staging/{extra}.json) | [sidecar]({raw}/data/staging/{extra}.provenance.json) |")
    lines += ["", "## One-liners", "", "```bash",
              f"# the registry — every layer's contract, essay, and caveat",
              f"curl -sL {raw}/registry/registry.json | python3 -m json.tool | head -60", "",
              f"# the findings, with their method notes and the spurious control",
              f"curl -sL {raw}/data/findings.json", "",
              f"# one layer and its provenance",
              f"curl -sL {raw}/data/staging/betrayal-ledger.json | python3 -c \"import json,sys; d=json.load(sys.stdin); print(len(d['records']), 'records;', d['retrieved'])\"",
              f"curl -sL {raw}/data/staging/betrayal-ledger.provenance.json | head -c 600", "",
              f"# the packed payloads the page itself renders (quantized, cell-aggregated)",
              f"curl -sL {raw}/data/layers/loss-crashes.json | head -c 300",
              "```", "",
              "## Rules of the road", "",
              "- **Cite the source, not the survey.** Each file names its source and retrieval date; pass them on.",
              "- **The dark stays dark.** Suppressed counties are absent on purpose. Do not interpolate them.",
              "- **Protocol layers stay heat.** Suicide data ships as county rates only — never re-join it to points.",
              "- **Where, not why.** Correlations you compute inherit the standing disclaimer.", "",
              f"*Generated by `pipeline/build.py` at build time for `{repo}`.*", ""]
    os.makedirs(p("docs"), exist_ok=True)
    with open(p("docs","DATA_API.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

# ---- plate extras for registry-packed layers (statistics, not packing) ----
def _hook_omen(lay, st, d):
    lay["dark"] = sum(1 for x in d["s"] if x == 0); lay["light"] = d["n"] - lay["dark"]
    d["dark"], d["light"] = lay["dark"], lay["light"]

def _hook_suicide(lay, st, d):
    if st.get("suppressedCount") is not None:
        lay["plateStats"].append({"label":"counties suppressed (kept dark)","value":fmt_int(st["suppressedCount"])})
    youth = sorted(st.get("stateYouth") or [], key=lambda r: -r["value"])[:3]
    if youth:
        lay["plateStats"].append({"label":"highest state youth rates","value":" · ".join(f"{y['state']} {y['value']}" for y in youth)})
    lay["plateStats"].append({"label":"vintage","value":st.get("vintage","")})

def _hook_social(lay, st, d):
    rr = sorted(st["regions"], key=lambda r: -r["value"])
    ecl = lambda r: re.sub(r"^economic connectedness\s*", "EC ", r["label"])
    lay["plateStats"].append({"label":"most connected","value":ecl(rr[0])})
    lay["plateStats"].append({"label":"least connected","value":ecl(rr[-1])})
    lay["plateStats"].append({"label":"benchmark","value":"EC 1.0 = class-blind friendship"})

PLATE_HOOKS = {"omen-names": _hook_omen, "despair-suicide": _hook_suicide, "company-socialcapital": _hook_social}

def build():
    registry = load(p("registry","registry.json"))
    fpath = p("data","findings.json")
    if os.path.exists(fpath):
        registry["findings"] = load(fpath)
    repo, site = repo_info(registry["meta"])
    registry["meta"]["repo"] = repo
    registry["meta"]["site"] = site
    registry["meta"]["log"] = living_log()
    print(f"  home: {repo} → {site}  ·  living log: {len(registry['meta']['log'])} entries")
    layers_data = {}
    for lay in registry["layers"]:
        lid = lay["id"]
        st = load_staging(lid)
        if st is None:
            lay["status"] = "pending"
            lay["count"] = 0
            continue
        lay["retrieved"] = st.get("retrieved","")
        lay["sources"] = st.get("sources", [])

        if lay.get("pack"):
            # v0.7 Phase 0.3: the registry declares the payload; no per-layer code
            d = pack_layer(lay, st, shrink_label)
            layers_data[lid] = d
            cnt = lay["pack"].get("count")
            lay["count"] = (sum(d[cnt]) if cnt and cnt in d else
                            d["n"] if d["kind"] in ("points", "flows", "raster") else
                            len(d.get("counties") or d.get("countries") or {}))
            fl = lenses_for(lay, d)
            if fl: lay.setdefault("filters", []).extend(fl)
            if d.get("time"): lay["time"] = d["time"]
            if d.get("categories"): lay["categories"] = d["categories"]
            hook = PLATE_HOOKS.get(lid)
            if hook: hook(lay, st, d)

        elif lid == "memory-births":
            cells = st["cells"]
            labs = {}
            c_lat, c_lon, c_v = [], [], []
            for i, c in enumerate(cells):
                c_lat.append(rnd(c["lat"],2)); c_lon.append(rnd(c["lon"],2)); c_v.append(int(c["v"]))
                if c["v"] >= 9 and c.get("top"):
                    labs[str(i)] = c["top"][0][:48]
            stars = sorted(st["records"], key=lambda r: -(r.get("v") or 0))[:5000]
            s_pack = {
                "lat":[rnd(r["lat"]) for r in stars], "lon":[rnd(r["lon"]) for r in stars],
                "v":[rnd(r.get("v") or 0,1) for r in stars], "name":[(r.get("name") or "")[:48] for r in stars],
                "birth":[(r.get("meta") or {}).get("birth") for r in stars],
                "dom":[((r.get("meta") or {}).get("domain") or "")[:24] for r in stars]}
            # v0.7 Phase 1.5: the remembered, by calling — Pantheon domains folded into nine groups
            s_pack["dg"] = [STAR_GROUP.get(((r.get("meta") or {}).get("domain") or "").lower(), 8) for r in stars]
            bios = load_staging("memory-bios")
            if bios:
                bmap = {(b["name"], b.get("birth")): b for b in bios.get("bios", [])}
                s_pack["desc"] = []
                s_pack["death"] = []
                hit = 0
                for r in stars:
                    b = bmap.get(((r.get("name") or "")[:48], (r.get("meta") or {}).get("birth"))) or bmap.get((r.get("name"), (r.get("meta") or {}).get("birth")))
                    if b: hit += 1
                    s_pack["desc"].append((b.get("desc") or "")[:110] if b else "")
                    s_pack["death"].append(b.get("death") if b else None)
                print(f"  bios joined: {hit}/5000 stars")
            total = sum(c_v)
            packed = {"kind":"memory","n":total,
                "cells":{"lat":c_lat,"lon":c_lon,"v":c_v,"lab":labs},"stars":s_pack}
            # merge era buckets if present
            eras = load_staging("memory-eras")
            if eras:
                emap = {}
                for c in eras["cells"]:
                    emap[f'{rnd(c["lat"],2)},{rnd(c["lon"],2)}'] = c["e"]
                e_arr, matched = [], 0
                for la, lo in zip(c_lat, c_lon):
                    e = emap.get(f"{la},{lo}")
                    if e is not None: matched += 1
                    e_arr.append(e)
                totals = [0]*5
                for e in e_arr:
                    if e:
                        for k in range(5): totals[k] += e[k]
                packed["cells"]["e"] = e_arr
                packed["eras"] = {"labels": ERA_LABELS, "totals": totals}
                print(f"  eras merged: {matched}/{len(c_lat)} cells matched; totals={totals}")
            layers_data[lid] = packed
            lay["count"] = total
            us = 0
            for la,lo,v in zip(c_lat,c_lon,c_v):
                if (24<=la<=50 and -125<=lo<=-66) or (51<=la<=72 and -170<=lo<=-129) or (18<=la<=23 and -161<=lo<=-154):
                    us += v
            lay["plateStats"].append({"label":"born in the U.S. (approx)","value":fmt_int(us)})

        elif lid == "desire-searches":
            us_map, world_map = {}, {}
            for r in st["regions"]:
                k = r["key"]
                if k.startswith("US-"):
                    us_map[k[3:]] = r["label"]
                else:
                    meta = r.get("meta") or {}
                    world_map[k] = {"label": r["label"], "country": meta.get("country", k), "kind": meta.get("kind","")}
            dark = [s for s in STATES if s not in us_map]
            layers_data[lid] = {"kind":"regions","us":us_map,"dark":dark,"world":world_map,"year":st.get("year","2025")}
            lay["count"] = len(us_map)

        elif lid == "loss-crashes":
            recs = st["records"]
            pk = {"lat":[rnd(r["lat"]) for r in recs],"lon":[rnd(r["lon"]) for r in recs],
                  "v":[int(r.get("v") or 1) for r in recs],
                  "m":[int((r.get("meta") or {}).get("m") or 0) for r in recs]}
            deaths = sum(pk["v"])
            months = Counter()
            for v,m in zip(pk["v"],pk["m"]): months[m]+=v
            peak = months.most_common(1)[0] if months else (0,0)
            MN = ["","January","February","March","April","May","June","July","August","September","October","November","December"]
            layers_data[lid] = {"kind":"points","n":len(recs),"deaths":deaths, **pk}
            lay["count"] = len(recs); lay["deaths"] = deaths
            if not any(s.get("label")=="deadliest month" for s in lay["plateStats"]):
                lay["plateStats"].append({"label":"deadliest month","value":f"{MN[peak[0]]} — {fmt_int(peak[1])} deaths"})

        elif lid == "power-fortune500":
            recs = sorted(st["records"], key=lambda r: (r.get("meta") or {}).get("rank") or 999)
            pk = {"lat":[rnd(r["lat"]) for r in recs],"lon":[rnd(r["lon"]) for r in recs],
                  "name":[r["name"][:36] for r in recs],
                  "v":[(r.get("v") if r.get("v") is not None else 0) for r in recs],
                  "rank":[(r.get("meta") or {}).get("rank") for r in recs],
                  "loc":[f"{(r.get('meta') or {}).get('city','')}, {(r.get('meta') or {}).get('state','')}" for r in recs]}
            total_rev = sum(pk["v"])
            layers_data[lid] = {"kind":"points","n":len(recs), **pk}
            lay["count"] = len(recs)
            if not any(s.get("label")=="combined revenue" for s in lay["plateStats"]):
                lay["plateStats"].append({"label":"combined revenue","value":f"${total_rev/1e6:,.1f} trillion"})

        elif lid == "motion-fulfillment":
            TYPES = {"Fulfillment Center":0,"Sortation Center":1,"IXD":2,"Inbound Cross-Dock":2}
            TYPE_NAMES = ["Fulfillment Center","Sortation Center","Inbound Cross-Dock"]
            recs = st["records"]
            pk = {"lat":[rnd(r["lat"]) for r in recs],"lon":[rnd(r["lon"]) for r in recs],
                  "name":[(r.get("name") or "")[:12] for r in recs],
                  "t":[TYPES.get((r.get("meta") or {}).get("type",""),0) for r in recs],
                  "loc":[f"{(r.get('meta') or {}).get('city','')}, {(r.get('meta') or {}).get('state','')}" for r in recs]}
            states = Counter((r.get("meta") or {}).get("state","") for r in recs)
            top3 = " · ".join(f"{s} {c}" for s,c in states.most_common(3))
            layers_data[lid] = {"kind":"points","n":len(recs),"typeNames":TYPE_NAMES, **pk}
            lay["count"] = len(recs)
            if not any(s.get("label")=="top states" for s in lay["plateStats"]):
                lay["plateStats"].append({"label":"top states","value":top3})

        elif lid == "control-arsenal":
            recs = st["records"]
            pk = {"lat":[rnd(r["lat"]) for r in recs],"lon":[rnd(r["lon"]) for r in recs],
                  "v":[int(r.get("v") or 1) for r in recs]}
            total = st.get("totalDealers") or sum(pk["v"])
            layers_data[lid] = {"kind":"points","n":len(recs),"dealers":total, **pk}
            lay["count"] = total
            lay["plateStats"].append({"label":"licensed dealers (types 01+02)","value":fmt_int(total)})
            lay["plateStats"].append({"label":"cells on the map","value":fmt_int(len(recs))})
            lay["plateStats"].append({"label":"vintage","value":st.get("vintage","")})

        elif lid == "betrayal-ledger":
            # Protocol gate at build time: conviction + court amount + 2+ citations.
            # Staging keeps partial entries for citation completion; the page ships only the impeccable.
            allr = st["records"]
            recs = sorted([r for r in allr if (r.get("v") or 0) > 0 and len((r.get("meta") or {}).get("cites") or []) >= 2],
                          key=lambda r: -(r.get("v") or 0))
            if len(recs) < len(allr):
                print(f"  betrayal-ledger: {len(allr)-len(recs)} entries held back pending citations/amounts")
            pk = {"lat":[rnd(r["lat"]) for r in recs],"lon":[rnd(r["lon"]) for r in recs],
                  "name":[(r.get("name") or "")[:44] for r in recs],
                  "v":[int(r.get("v") or 0) for r in recs],
                  "who":[((r.get("meta") or {}).get("who") or "")[:70] for r in recs],
                  "years":[((r.get("meta") or {}).get("years") or "")[:20] for r in recs],
                  "scheme":[((r.get("meta") or {}).get("scheme") or "")[:220] for r in recs],
                  "outcome":[((r.get("meta") or {}).get("outcome") or "")[:220] for r in recs],
                  # the receipts ride with the point: up to three citations per entry (URLs only)
                  "cites":[[str(c)[:160] for c in ((r.get("meta") or {}).get("cites") or [])[:3]] for r in recs]}
            # v0.7: the price per head, only where the victim is the residents' own government
            phs = load_staging("betrayal-ledger-perhead")
            if phs:
                phm = {r["name"]: r for r in phs["rows"]}
                pk["ph"] = [phm[r["name"]]["per_resident"] if r["name"] in phm else -1 for r in recs]
                pk["phj"] = [phm[r["name"]]["jurisdiction"] if r["name"] in phm else "" for r in recs]
                pk["php"] = [phm[r["name"]]["population_2020"] if r["name"] in phm else 0 for r in recs]
            total = sum(pk["v"])
            layers_data[lid] = {"kind":"points","n":len(recs),"stolen":total, **pk}
            lay["count"] = len(recs)
            lay["amt"] = f"${total/1e6:,.0f}M"
            for r in recs[:4]:
                place = re.sub(r"\s*\(.*\)$", "", r["name"])   # 'Hidalgo County, TX (Weslaco contracts)' -> 'Hidalgo County, TX'
                lay["plateStats"].append({"label":place+" — "+(r.get("meta") or {}).get("years",""),"value":f"${r['v']/1e6:,.1f}M"})

        elif lid == "motion-sorting":
            cents = county_centroids()
            cname = {}
            ctopo = load(p("data","ref","counties-10m.json"))
            for g in ctopo["objects"]["counties"]["geometries"]:
                cname[str(g["id"]).zfill(5)] = g.get("properties",{}).get("name","")
            counties, vals = {}, []
            for c in st["counties"]:
                f = str(c["fips"]).zfill(5)
                nm = cname.get(f,"")
                stp = STATE_FIPS.get(f[:2],"")
                sign = "+" if c["net"]>=0 else "−"
                counties[f] = {"v": c["net"], "label": f"net {sign}{abs(c['net']):,} hh — {nm}, {stp}"}
                if c.get("people") is not None: counties[f]["p"] = c["people"]   # v0.7 1.8: the same sorting, in people
                vals.append(abs(c["net"]))
            vals.sort()
            vmax = vals[int(len(vals)*0.95)] if vals else 1
            alat,alon,blat,blon,hh,pp = [],[],[],[],[],[]
            skipped = 0
            for fl in st["flows"]:
                if fl["hh"] < 120: continue   # page-weight cutoff, disclosed on the plate
                a = cents.get(str(fl["a"]).zfill(5)); b = cents.get(str(fl["b"]).zfill(5))
                if not a or not b: skipped += 1; continue
                alat.append(rnd(a[0],2)); alon.append(rnd(a[1],2))
                blat.append(rnd(b[0],2)); blon.append(rnd(b[1],2))
                hh.append(int(fl["hh"])); pp.append(int(fl.get("people") or 0))
            hs = sorted(hh)
            arcmax = hs[int(len(hs)*0.95)] if hs else 1
            ps = sorted(pp); arcmaxp = ps[int(len(ps)*0.95)] if ps else 1
            pv = sorted(abs(c.get("people") or 0) for c in st["counties"]); vmaxp = pv[int(len(pv)*0.95)] if pv else 1
            layers_data[lid] = {"kind":"flows","n":len(counties),
                                "counties":counties,"vmax":vmax,
                                "arcs":{"alat":alat,"alon":alon,"blat":blat,"blon":blon,"hh":hh,"pp":pp},
                                "arcmax":arcmax,"arcmaxp":arcmaxp,"vmaxp":vmaxp,"vintage":st.get("vintage","")}
            lay["count"] = len(counties); lay["arcs"] = len(hh)
            gain = sorted(st["counties"], key=lambda c: -c["net"])[:2]
            lose = sorted(st["counties"], key=lambda c: c["net"])[:2]
            lay["plateStats"].append({"label":"biggest inhale","value":" · ".join(f"{cname.get(str(c['fips']).zfill(5),'')} {STATE_FIPS.get(str(c['fips']).zfill(5)[:2],'')} +{c['net']:,}" for c in gain)})
            lay["plateStats"].append({"label":"biggest exhale","value":" · ".join(f"{cname.get(str(c['fips']).zfill(5),'')} {STATE_FIPS.get(str(c['fips']).zfill(5)[:2],'')} {c['net']:,}" for c in lose)})
            lay["plateStats"].append({"label":"corridors drawn","value":fmt_int(len(hh))+f" (of 53,614 real pairs)"})
            if skipped: print(f"  motion-sorting: {skipped} flows skipped (no centroid)")

        lay["status"] = "live"
        sl = lay.get("statline","")
        sl = sl.replace("{n}", fmt_int(lay.get("count",0)))
        sl = sl.replace("{deaths}", fmt_int(lay.get("deaths",0)))
        sl = sl.replace("{dark}", fmt_int(lay.get("dark",0)))
        sl = sl.replace("{light}", fmt_int(lay.get("light",0)))
        sl = sl.replace("{arcs}", fmt_int(lay.get("arcs",0)))
        sl = sl.replace("{amt}", str(lay.get("amt","")))
        lay["statline"] = sl

    # ---- entity lens filters (declared from packed fields) ----
    def mk_filter(lid, field, label, code_labels, seq=False, constellation=False):
        """A lens is data. `seq` lenses are ordered in time and get a play control;
        `constellation` lenses select one real network (an operator, a facility class)
        and get their members drawn as a constellation — never for unrelated things."""
        d = layers_data.get(lid)
        if not d or field not in d: return
        counts = Counter(d[field])
        values = [[code, lbl, counts.get(code, 0)] for code, lbl in code_labels if counts.get(code, 0) > 0]
        if len(values) < 2: return
        for lay in registry["layers"]:
            if lay["id"] == lid:
                fl = {"field": field, "label": label, "values": values}
                if seq: fl["seq"] = True
                if constellation: fl["constellation"] = True
                lay.setdefault("filters", []).append(fl)
    if "memory-births" in layers_data:
        dg = layers_data["memory-births"]["stars"]["dg"]
        cnt = Counter(dg)
        for lay in registry["layers"]:
            if lay["id"] == "memory-births":
                lay.setdefault("filters", []).append({"field": "dg", "label": "The 5,000 brightest, by calling", "stars": True,
                    "values": [[i, g, cnt.get(i, 0)] for i, g in enumerate(STAR_GROUPS) if cnt.get(i, 0)]})
    if "motion-fulfillment" in layers_data:
        mk_filter("motion-fulfillment","t","Facility type",[(0,"Fulfillment"),(1,"Sortation"),(2,"Cross-dock")], constellation=True)
    if "loss-crashes" in layers_data:
        MNL = [(i, m) for i, m in enumerate(["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]) if i]
        mk_filter("loss-crashes","m","Month",MNL, seq=True)

    # readings only run when all their layers are live
    live_ids = {l["id"] for l in registry["layers"] if l.get("status") == "live"}
    registry["readings"] = [r for r in registry["readings"]
                            if r.get("special") or all(x in live_ids for x in r.get("layers", []))]

    os.makedirs(p("data","layers"), exist_ok=True)
    for lid, d in layers_data.items():
        with open(p("data","layers",f"{lid}.json"),"w") as f:
            json.dump(d, f, separators=(",",":"))

    counties = load(p("data","ref","counties-10m.json"))
    counties["objects"] = {"counties": counties["objects"]["counties"]}

    basemaps = {
        "land": load(p("data","ref","land-50m.json")),
        "countries": load(p("data","ref","countries-110m.json")),
        "states": load(p("data","ref","states-10m.json")),
        "nation": load(p("data","ref","nation-10m.json")),
        "counties": counties,
        "places": load(p("data","ref","places_baked.json")),
    }

    def read(fp):
        with open(fp, encoding="utf-8") as f: return f.read()

    def js_safe(obj):
        s = json.dumps(obj, separators=(",",":"), ensure_ascii=False)
        return s.replace("</", "<\\/")

    html = read(p("site","template.html"))
    html = html.replace("{{SITE}}", site).replace("{{REPO}}", repo)
    html = html.replace("/*{{CSS}}*/", read(p("site","styles.css")))
    html = html.replace("//{{VENDOR}}", read(p("site","vendor","d3.v7.min.js")) + "\n" + read(p("site","vendor","topojson-client.min.js")))
    # ---- v0.7 Phase 0.1: compressed payloads ----
    # Layer data and basemaps ride as gzip+base64 and are inflated in the browser with
    # DecompressionStream before the app starts. `--plain` builds the uncompressed page
    # (for browsers without DecompressionStream, and for debugging).
    plain = "--plain" in sys.argv
    # the fallback page is always written beside the real one (git-ignored), so the
    # smoke test can prove both load paths carry the same data
    if not plain:
        fb = html.replace("//{{DATA}}", "window.__REGISTRY__=" + js_safe(registry) + ";\n" +
                          "window.__LAYERDATA__=" + js_safe(layers_data) + ";\n" +
                          "window.__BASEMAPS__=" + js_safe(basemaps) + ";")
        fb = fb.replace("//{{APP}}", "window.__SOUL_APP__=function(){\n" + read(p("site","app.js")) + "\n};\n" + read(p("site","boot.js")))
        os.makedirs(p("dist"), exist_ok=True)
        with open(p("dist","index.plain.html"), "w", encoding="utf-8") as f: f.write(fb)
    def gz64(obj):
        raw = json.dumps(obj, separators=(",",":"), ensure_ascii=False).encode("utf-8")
        return base64.b64encode(gzip.compress(raw, 9, mtime=0)).decode("ascii")
    if plain:
        data_js = ("window.__LAYERDATA__=" + js_safe(layers_data) + ";\n" +
                   "window.__BASEMAPS__=" + js_safe(basemaps) + ";")
    else:
        data_js = ("window.__PACKED__={ld:\"" + gz64(layers_data) + "\",bm:\"" + gz64(basemaps) + "\"};")
    html = html.replace("//{{DATA}}", "window.__REGISTRY__=" + js_safe(registry) + ";\n" + data_js)
    boot = read(p("site","boot.js"))
    html = html.replace("//{{APP}}", "window.__SOUL_APP__=function(){\n" + read(p("site","app.js")) + "\n};\n" + boot)

    os.makedirs(p("dist"), exist_ok=True)
    out = p("dist","index.plain.html" if plain else "index.html")
    with open(out,"w",encoding="utf-8") as f: f.write(html)
    if not plain:
        os.makedirs(p("docs"), exist_ok=True)
        import shutil
        shutil.copyfile(out, p("docs","index.html"))
    write_data_api(registry, repo, layers_data)
    size = os.path.getsize(out)
    weight_ledger(size, registry, layers_data, basemaps, plain)

def weight_ledger(size, registry, layers_data, basemaps, plain):
    """Phase 0.2 — the page-weight ledger. Every payload's raw and compressed size and
    its share of the 8 MB budget; soft warning at 6 MB, hard failure at 8 MB."""
    BUDGET, SOFT = 8_000_000, 6_000_000
    def kb(obj):
        raw = json.dumps(obj, separators=(",",":"), ensure_ascii=False).encode("utf-8")
        return len(raw), len(base64.b64encode(gzip.compress(raw, 9, mtime=0)))
    rows = [(lid, *kb(d), d.get("n", len(d.get("us",{}) or d.get("counties",{}) or {}))) for lid, d in layers_data.items()]
    rows += [("basemap:" + k, *kb(v), "") for k, v in basemaps.items()]
    rows.sort(key=lambda r: -r[2])
    print(f"\n  {'payload':<28}{'raw KB':>9}{'shipped KB':>12}{'budget':>8}   n")
    for name, raw, comp, n in rows:
        shipped = raw if plain else comp
        print(f"  {name:<28}{raw/1e3:>9.0f}{shipped/1e3:>12.0f}{shipped/BUDGET*100:>7.1f}%   {n}")
    other = size - sum((r[1] if plain else r[2]) for r in rows)
    print(f"  {'(registry, engine, vendor, css)':<28}{'':>9}{other/1e3:>12.0f}{other/BUDGET*100:>7.1f}%")
    print(f"\nbuilt dist/{'index.plain.html' if plain else 'index.html'}: {size/1e6:.2f} MB of 8 MB ({'plain' if plain else 'compressed'}; copied to docs/; docs/DATA_API.md regenerated)")
    if size > BUDGET:
        print("  !! PAGE-WEIGHT CEILING BREACHED (8 MB) — aggregate harder before shipping")
        sys.exit(1)
    if size > SOFT:
        print("  !  soft warning: page above 6 MB")

if __name__ == "__main__":
    build()
