#!/usr/bin/env python3
"""THE SOUL SURVEY — the Correlator.
Build-time spatial statistics across layers. Emits candidate findings to stdout
for hand review. Descriptive only: WHERE, not WHY.
"""
import json, math, os, sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def p(*parts): return os.path.join(ROOT, *parts)
def load(fp):
    with open(fp, encoding="utf-8") as f: return json.load(f)

def hav(la1, lo1, la2, lo2):
    R = 6371.0
    dla, dlo = math.radians(la2-la1), math.radians(lo2-lo1)
    a = math.sin(dla/2)**2 + math.cos(math.radians(la1))*math.cos(math.radians(la2))*math.sin(dlo/2)**2
    return R*2*math.asin(math.sqrt(a))

def pearson(xs, ys):
    n = len(xs)
    mx, my = sum(xs)/n, sum(ys)/n
    num = sum((x-mx)*(y-my) for x, y in zip(xs, ys))
    dx = math.sqrt(sum((x-mx)**2 for x in xs))
    dy = math.sqrt(sum((y-my)**2 for y in ys))
    return num/(dx*dy) if dx and dy else 0.0

# ---------- county centroids from TopoJSON ----------
def county_centroids():
    topo = load(p("data","ref","counties-10m.json"))
    sx, sy = topo["transform"]["scale"]; tx, ty = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        pts, x, y = [], 0, 0
        for dx, dy in arc:
            x += dx; y += dy
            pts.append((x*sx+tx, y*sy+ty))
        arcs.append(pts)
    def geom_pts(g):
        out = []
        def walk_rings(rings):
            for ring in rings:
                for ai in ring:
                    out.extend(arcs[ai] if ai >= 0 else arcs[~ai])
        if g["type"] == "Polygon": walk_rings(g["arcs"])
        elif g["type"] == "MultiPolygon":
            for poly in g["arcs"]: walk_rings(poly)
        return out
    cent = {}
    for g in topo["objects"]["counties"]["geometries"]:
        pts = geom_pts(g)
        if not pts: continue
        fips = str(g["id"]).zfill(5)
        cent[fips] = (sum(q[1] for q in pts)/len(pts), sum(q[0] for q in pts)/len(pts))  # (lat, lon)
    return cent

def nearest_km(la, lo, sites):
    best = 1e9
    for sla, slo in sites:
        if abs(sla-la) > 9 or abs(slo-lo) > 11: continue
        d = hav(la, lo, sla, slo)
        if d < best: best = d
    if best > 1e8:
        for sla, slo in sites:
            d = hav(la, lo, sla, slo)
            if d < best: best = d
    return best

def main():
    cents = county_centroids()
    print(f"county centroids: {len(cents)}")

    od = load(p("data","staging","despair-overdoses.json"))
    rates = {str(r["key"]).zfill(5): r["value"] for r in od["regions"]}

    sf = load(p("data","staging","residue-superfund.json"))
    sf_sites = [(r["lat"], r["lon"]) for r in sf["records"]]

    f5 = load(p("data","staging","power-fortune500.json"))
    f5_sites = [(r["lat"], r["lon"]) for r in f5["records"]]

    ful = load(p("data","staging","motion-fulfillment.json"))
    ful_sites = [(r["lat"], r["lon"]) for r in ful["records"]]

    # ---- F1: overdose rate vs distance to nearest Superfund NPL site
    pairs = []
    for fips, rate in rates.items():
        c = cents.get(fips)
        if not c: continue
        pairs.append((rate, nearest_km(c[0], c[1], sf_sites)))
    close = [r for r, d in pairs if d <= 15]
    far   = [r for r, d in pairs if d >= 75]
    r_sf = pearson([r for r, d in pairs], [math.log1p(d) for r, d in pairs])
    print(f"\nF1 overdose vs superfund: n={len(pairs)}  mean(rate|<=15km)={sum(close)/len(close):.1f} (n={len(close)})  mean(rate|>=75km)={sum(far)/len(far):.1f} (n={len(far)})  pearson(rate, log dist)={r_sf:.3f}")

    # ---- F2: overdose rate vs distance to nearest Fortune 500 HQ
    pairs2 = []
    for fips, rate in rates.items():
        c = cents.get(fips)
        if not c: continue
        pairs2.append((rate, nearest_km(c[0], c[1], f5_sites)))
    near_money = [r for r, d in pairs2 if d <= 25]
    far_money  = [r for r, d in pairs2 if d >= 150]
    r_f5 = pearson([r for r, d in pairs2], [math.log1p(d) for r, d in pairs2])
    print(f"F2 overdose vs money: mean(rate|<=25km of F500)={sum(near_money)/len(near_money):.1f} (n={len(near_money)})  mean(rate|>=150km)={sum(far_money)/len(far_money):.1f} (n={len(far_money)})  pearson={r_f5:.3f}")

    # ---- F3: crashes near the fulfillment network
    cr = load(p("data","staging","loss-crashes.json"))
    ds = []
    for rrec in cr["records"]:
        ds.append(nearest_km(rrec["lat"], rrec["lon"], ful_sites))
    ds.sort()
    med = ds[len(ds)//2]
    w25 = sum(1 for d in ds if d <= 25)/len(ds)
    w50 = sum(1 for d in ds if d <= 50)/len(ds)
    # baseline proxy: county centroids' distance to the network
    cd = sorted(nearest_km(la, lo, ful_sites) for la, lo in cents.values())
    print(f"F3 crashes vs fulfillment: median crash->FC = {med:.1f} km | within 25km {w25*100:.1f}% | within 50km {w50*100:.1f}% | county-centroid median {cd[len(cd)//2]:.1f} km")

    # ---- F4: memory vs data centers on the 0.25 deg US grid (confounded, pair with F5)
    mem = load(p("data","staging","memory-births.json"))
    dc = load(p("data","staging","power-datacenters.json"))
    def cellkey(la, lo): return (math.floor(la/0.25), math.floor(lo/0.25))
    mcell = defaultdict(int)
    for c in mem["cells"]:
        if 24 <= c["lat"] <= 50 and -125 <= c["lon"] <= -66: mcell[cellkey(c["lat"], c["lon"])] += c["v"]
    dcell = defaultdict(int)
    for rrec in dc["records"]:
        if 24 <= rrec["lat"] <= 50 and -125 <= rrec["lon"] <= -66: dcell[cellkey(rrec["lat"], rrec["lon"])] += 1
    keys = set(mcell) | set(dcell)
    r_md = pearson([math.log1p(mcell[k]) for k in keys], [math.log1p(dcell[k]) for k in keys])
    dc_on_mem = sum(1 for k in dcell if mcell.get(k, 0) > 0)/len(dcell)
    print(f"F4 memory vs cloud: r={r_md:.3f} over {len(keys)} cells | {dc_on_mem*100:.1f}% of DC cells sit on remembered-birth cells")

    # ---- F5 (the spurious exhibit): UFO sightings vs data centers
    uf = load(p("data","staging","wonder-ufos.json"))
    ucell = defaultdict(int)
    for rrec in uf["records"]:
        if 24 <= rrec["lat"] <= 50 and -125 <= rrec["lon"] <= -66: ucell[cellkey(rrec["lat"], rrec["lon"])] += rrec.get("v", 1)
    keys2 = set(ucell) | set(dcell)
    r_ud = pearson([math.log1p(ucell[k]) for k in keys2], [math.log1p(dcell[k]) for k in keys2])
    print(f"F5 ufos vs cloud (spurious exhibit): r={r_ud:.3f} over {len(keys2)} cells")

    # ---- F6: devils sit west of angels
    om = load(p("data","staging","omen-names.json"))
    dark = sorted(r["lon"] for r in om["records"] if (r.get("meta") or {}).get("side") == "dark" and -130 <= r["lon"] <= -60)
    light = sorted(r["lon"] for r in om["records"] if (r.get("meta") or {}).get("side") != "dark" and -130 <= r["lon"] <= -60)
    print(f"F6 omen longitude: median dark {dark[len(dark)//2]:.2f} vs light {light[len(light)//2]:.2f}  (delta {abs(dark[len(dark)//2]-light[len(light)//2]):.2f} deg)")

    # ---- F7: the westward migration of memory (mean longitude per era, world)
    er = load(p("data","staging","memory-eras.json"))
    sums = [0.0]*5; ns = [0]*5
    for c in er["cells"]:
        for i, v in enumerate(c["e"]):
            if v: sums[i] += c["lon"]*v; ns[i] += v
    means = [sums[i]/ns[i] if ns[i] else 0 for i in range(5)]
    print("F7 memory mean lon per era:", [f"{m:.1f}" for m in means])

    # ---- F8: Appalachian concentration of the epidemic
    top = sorted(rates.items(), key=lambda kv: -kv[1])[:100]
    app_states = {"21", "54", "39", "51", "47"}  # KY WV OH VA TN
    share = sum(1 for f, _ in top if f[:2] in app_states)/100
    all_share = sum(1 for f in rates if f[:2] in app_states)/len(rates)
    print(f"F8 appalachia: {share*100:.0f}% of the 100 highest-rate counties are in KY/WV/OH/VA/TN vs {all_share*100:.1f}% baseline share of counties")

if __name__ == "__main__" and len(sys.argv) == 1:
    main()

# ---- v0.5 additions (run 2026-07-07) ----
# F9  EC vs overdose:      n=2897  r=-0.330  bottom-EC quintile 22.9 vs top 9.8 per 100k  -> SHIPPED as "The Empty Chair"
# F10 net migration vs OD: n=2768  gainers 22.2 vs losers 19.3, r=0.152                   -> REJECTED (too weak)
# F11 EC vs net migration: n=2816  r=0.045                                                -> REJECTED (null)
# Suicide data is excluded from the correlator entirely per the WANTLIST safe-messaging protocol.

# ======================================================================
# v0.6 — the never-correlated layers: faith, company, the sorting.
# Suicide stays out of the correlator entirely (WANTLIST protocol).
# Run: python3 pipeline/correlate.py v06
# ======================================================================
def spearman(xs, ys):
    def ranks(v):
        o = sorted(range(len(v)), key=lambda i: v[i]); r = [0.0]*len(v); i = 0
        while i < len(o):
            j = i
            while j+1 < len(o) and v[o[j+1]] == v[o[i]]: j += 1
            for k in range(i, j+1): r[o[k]] = (i+j)/2
            i = j+1
        return r
    return pearson(ranks(xs), ranks(ys))

def quintiles(pairs):
    """pairs of (x, y): mean y in the bottom and top fifth of x."""
    s = sorted(pairs); n = len(s); q = n//5
    lo = [y for _, y in s[:q]]; hi = [y for _, y in s[-q:]]
    return sum(lo)/len(lo), sum(hi)/len(hi), q

def v06():
    od = {str(r["key"]).zfill(5): r["value"] for r in load(p("data","staging","despair-overdoses.json"))["regions"]}
    fa_st = load(p("data","staging","faith-altar.json"))["regions"]
    fa = {str(r["key"]).zfill(5): r["value"] for r in fa_st}
    pop = {str(r["key"]).zfill(5): (r.get("meta") or {}).get("population_2020") for r in fa_st}
    trad = {str(r["key"]).zfill(5): (r.get("meta") or {}).get("largest_tradition_family") for r in fa_st}
    ec = {str(r["key"]).zfill(5): r["value"] for r in load(p("data","staging","company-socialcapital.json"))["regions"]}
    so = load(p("data","staging","motion-sorting.json"))
    net = {str(c["fips"]).zfill(5): c["net"] for c in so["counties"]}
    # net migration per 1,000 residents (households per 1k people — a rate, not a raw count)
    netr = {f: 1000.0*v/pop[f] for f, v in net.items() if pop.get(f)}
    capped = {f: v for f, v in fa.items() if v <= 1000}   # >1000/1k = cross-county worshipper draw (documented)

    def pair(a, b, name, la="", lb=""):
        ks = [k for k in a if k in b]
        xs = [a[k] for k in ks]; ys = [b[k] for k in ks]
        r = pearson(xs, ys); rs = spearman(xs, ys)
        lo, hi, q = quintiles(list(zip(xs, ys)))
        print(f"{name}: n={len(ks)} pearson={r:.3f} spearman={rs:.3f} | mean {lb} in bottom fifth of {la}={lo:.2f}, top fifth={hi:.2f} (n={q} each)")
        return ks

    print("\n--- v0.6 candidates ---")
    pair(capped, od, "F12 adherence x overdose", "adherence", "OD")
    pair(capped, ec, "F13 adherence x connectedness", "adherence", "EC")
    pair(netr, ec, "F14 net migration rate x connectedness", "netmig", "EC")
    pair(netr, capped, "F15 net migration rate x adherence", "netmig", "adherence")
    pair(netr, od, "F16 net migration rate x overdose", "netmig", "OD")
    # confound check for F12: does it survive within population bands?
    ks = [k for k in capped if k in od and pop.get(k)]
    bands = [(0, 10000), (10000, 50000), (50000, 250000), (250000, 1e9)]
    for lo_, hi_ in bands:
        sub = [k for k in ks if lo_ <= pop[k] < hi_]
        if len(sub) > 30:
            print(f"   F12 within pop {lo_:>7,}-{hi_:<11,.0f}: n={len(sub)} r={pearson([capped[k] for k in sub],[od[k] for k in sub]):.3f}")
    for lo_, hi_ in bands:
        sub = [k for k in capped if k in ec and pop.get(k) and lo_ <= pop[k] < hi_]
        if len(sub) > 30:
            print(f"   F13 within pop {lo_:>7,}-{hi_:<11,.0f}: n={len(sub)} r={pearson([capped[k] for k in sub],[ec[k] for k in sub]):.3f}")
    # tradition: overdose by largest tradition family (descriptive)
    from collections import defaultdict as dd
    g = dd(list)
    for k, t in trad.items():
        if k in od and t: g[t].append(od[k])
    print("   OD by largest tradition (n>=40):", ", ".join(f"{t} {sum(v)/len(v):.1f} (n={len(v)})" for t, v in sorted(g.items(), key=lambda kv: -sum(kv[1])/len(kv[1])) if len(v) >= 40))
    g2 = dd(list)
    for k, t in trad.items():
        if k in ec and t: g2[t].append(ec[k])
    print("   EC by largest tradition (n>=40):", ", ".join(f"{t} {sum(v)/len(v):.2f} (n={len(v)})" for t, v in sorted(g2.items(), key=lambda kv: -sum(kv[1])/len(kv[1])) if len(v) >= 40))

if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "v06":
    v06()

# ---- v0.6 review (run 2026-11-05, `python3 pipeline/correlate.py v06`) ----
# F12 adherence vs OD:          r=-0.186; within-state -0.103; ~0 in counties >50k   -> REJECTED (regional)
# F13 adherence vs EC:          r=-0.048 overall (-0.31 in big counties: subgroup)   -> REJECTED (forking paths)
# F14 net-migration rate vs EC: r=0.043                                              -> REJECTED (null, again)
# F15 net-migration rate vs adherence: r=-0.200, spearman -0.190, within-state -0.202 -> SHIPPED "The Sorting Leaves the Pews Behind"
# F16 net-migration rate vs OD: r=0.119                                              -> REJECTED (too weak)
# Tradition x OD: Lutheran 6.2 vs non-denominational 23.8 nationwide, 5.7 vs 7.4 within states
#                                                                                    -> SHIPPED as a confounding lesson

# ======================= v0.7 Phase 1 findings =======================
# Pre-stated before running (2026-11-05):
# H17 "The thrones are exhaling": counties holding a Fortune 500 headquarters lose
#     households on net more often than counties of the same size without one.
#     Matching: each HQ county vs the 10 non-HQ counties nearest in 2020 population
#     (log scale). SHIP only if the HQ share losing exceeds the matched share by >= 10
#     points AND the mean net-migration rate gap keeps its sign within states
#     (each HQ county vs matched controls from its own state, where >= 3 exist).
# H18 "The price per head": median Ledger theft per resident is higher in places
#     under 25,000 than in places of 25,000+. Descriptive, n is the Ledger itself;
#     SHIP only if every included entry has a verified denominator and the gap is
#     at least 5x between the medians.

def county_polygons():
    topo = load(p("data","ref","counties-10m.json"))
    sx, sy = topo["transform"]["scale"]; tx, ty = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        pts, x, y = [], 0, 0
        for dx, dy in arc:
            x += dx; y += dy
            pts.append((x*sx+tx, y*sy+ty))
        arcs.append(pts)
    def ring(r):
        out = []
        for ai in r:
            seg = arcs[ai] if ai >= 0 else arcs[~ai][::-1]
            out.extend(seg if not out else seg[1:])
        return out
    polys = {}
    for g in topo["objects"]["counties"]["geometries"]:
        fips = str(g["id"]).zfill(5)
        if g["type"] == "Polygon": rings = [[ring(r) for r in g["arcs"]]]
        elif g["type"] == "MultiPolygon": rings = [[ring(r) for r in poly] for poly in g["arcs"]]
        else: continue
        xs = [q[0] for poly in rings for q in poly[0]]; ys = [q[1] for poly in rings for q in poly[0]]
        polys[fips] = (min(xs), min(ys), max(xs), max(ys), rings)
    return polys

def _in_ring(x, y, r):
    inside = False
    j = len(r) - 1
    for i in range(len(r)):
        xi, yi = r[i]; xj, yj = r[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi: inside = not inside
        j = i
    return inside

def county_of(lat, lon, polys):
    for f, (x0, y0, x1, y1, rings) in polys.items():
        if not (x0 <= lon <= x1 and y0 <= lat <= y1): continue
        for poly in rings:
            if _in_ring(lon, lat, poly[0]) and not any(_in_ring(lon, lat, h) for h in poly[1:]): return f
    return None

def v07():
    import statistics
    fa_st = load(p("data","staging","faith-altar.json"))["regions"]
    pop = {str(r["key"]).zfill(5): (r.get("meta") or {}).get("population_2020") for r in fa_st}
    so = load(p("data","staging","motion-sorting.json"))
    netr = {str(c["fips"]).zfill(5): 1000.0*c["net"]/pop[str(c["fips"]).zfill(5)] for c in so["counties"] if pop.get(str(c["fips"]).zfill(5))}
    polys = county_polygons()
    hq = defaultdict(int)
    miss = 0
    for r in load(p("data","staging","power-fortune500.json"))["records"]:
        f = county_of(r["lat"], r["lon"], polys)
        if f: hq[f] += 1
        else: miss += 1
    H = [f for f in hq if f in netr]
    N = [f for f in netr if f not in hq]
    lp = lambda f: math.log(pop[f])
    def matched(f, pool, k=10):
        return sorted(pool, key=lambda g: abs(lp(g) - lp(f)))[:k]
    share = lambda fs: sum(1 for f in fs if netr[f] < 0) / len(fs)
    ctrl = [g for f in H for g in matched(f, N)]
    print(f"H17: {len(hq)} HQ counties ({miss} HQs unplaced); {len(H)} with migration data")
    print(f"  share losing households: HQ {share(H)*100:.0f}%  vs  size-matched controls {share(ctrl)*100:.0f}%  (unmatched non-HQ {share(N)*100:.0f}%)")
    print(f"  mean net per 1k: HQ {statistics.mean(netr[f] for f in H):+.2f}  vs  matched {statistics.mean(netr[g] for g in ctrl):+.2f}")
    gaps = []
    for f in H:
        pool = [g for g in N if g[:2] == f[:2]]
        if len(pool) < 3: continue
        m = matched(f, pool, 3)
        gaps.append(netr[f] - statistics.mean(netr[g] for g in m))
    neg = sum(1 for x in gaps if x < 0)
    print(f"  within-state (3 nearest-size controls each): n={len(gaps)} mean gap {statistics.mean(gaps):+.2f}/1k, HQ below its controls in {neg}/{len(gaps)}")
    ph = load(p("data","staging","betrayal-ledger-perhead.json"))["rows"]
    sm = [r["per_resident"] for r in ph if r["population_2020"] < 25000]
    bg = [r["per_resident"] for r in ph if r["population_2020"] >= 25000]
    print(f"H18: n={len(ph)}  median per resident under 25k ${statistics.median(sm):,.2f} (n={len(sm)}) vs 25k+ ${statistics.median(bg):,.2f} (n={len(bg)}); ratio {statistics.median(sm)/statistics.median(bg):.1f}x")

if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "v07":
    v07()
# H17 thrones exhaling:  HQ 65% losing vs size-matched 58% (raw non-HQ 48%); within-state
#                        HQ below its controls in 96/144, mean gap -1.25/1k
#                        -> REJECTED (7-point gap < the pre-stated 10; size explains most of
#                           the raw 64%-vs-48% contrast — the early number was a size effect)
# H18 price per head:    n=18 verified denominators (26 Ledger entries excluded: 13 bribery,
#                        8 special districts, 5 mixed victims); medians $270 (<25k, n=11) vs
#                        $141 (25k+, n=7), 1.9x -> REJECTED as a size contrast (< 5x). The
#                        early "$312 vs $4.27" did not survive careful denominators. The
#                        per-resident figure itself ships as a fact on each Ledger tooltip.

# ======================= v0.8 — PLAN_V07 Phase 4, findings round 2 =======================
# PRE-STATED 2026-11-15, before any of these pairs was run. Run: python3 pipeline/correlate.py v08
#
# THE COUNTY BAR (§8 Loop C), applied to every U.S. county pair unless a pair says otherwise:
#   (a) |Pearson r| >= 0.20 nationwide AND |Spearman| >= 0.20 (same sign);
#   (b) mean within-state r (states with >= 15 counties, weighted by n) keeps the sign at >= 0.15;
#   (c) n >= 500 counties;
#   (d) bottom vs top quintile means of the outcome differ by >= 20% (relative) — "reads in
#       plain numbers";
#   (e) confounds: the sign holds in at least 3 of the 4 population bands (<10k, 10–50k,
#       50–250k, 250k+; bands with n < 30 skipped), and the partial r controlling for log
#       income per return (IRS SOI 2022, AGI ÷ returns, from company-gifts) stays >= 0.15.
#   Any failure -> REJECTED. A pair that passes only partly may ship as a LESSON card only if
#   the failure itself teaches something the reader can use (as the Lutheran card did).
# THE WORLD BAR: >= 500 units (grid cells or points); |r| >= 0.20 and |Spearman| >= 0.20;
#   the sign holds within at least 4 of the 6 macro-areas that have >= 30 units; a named
#   confound tested. Country-level pairs (~170 units) can never reach n >= 500: they cannot
#   ship as finding cards; their result may only decide what an essay is allowed to say.
#
# H19 Evictions x the sorting. Counties with higher eviction-threat rates (Eviction Lab,
#     2014-18 mean, per 100 renting households) have lower net household migration per
#     1,000 residents (IRS 2022-23). Expected sign: negative. County bar.
# H20 Evictions x overdoses. Counties with higher eviction-threat rates have higher 2024
#     overdose death rates. Expected sign: positive. County bar.
# H21 What powers the cloud. For each country with >= 25 data centers: the fossil share
#     (coal+gas+oil) of power-plant capacity within 50 km of its data centers, against the
#     country's overall fossil share. Named confound: data centers sit in cities, and so do
#     gas peakers — the same measure is taken around the country's airports (OpenFlights
#     endpoints) as an urban baseline. SHIP only if pooled over >= 500 data centers, the
#     data-center fossil share departs from the national share by >= 10 points in the same
#     direction in >= 2/3 of those countries AND departs from the airport baseline by
#     >= 5 points in that direction in >= 2/3. Proximity is not supply; the card must say so.
# H22 The remembered and the many tongues. On 2-degree land cells holding at least one
#     remembered birth or one language: log(remembered births) vs log(languages) is negative
#     (memory pools where few languages are spoken). World bar; macro-areas from Glottolog;
#     named confound: Europe — the result must survive with Europe's cells removed.
# H23 COVID deaths x connectedness. Counties with higher economic connectedness had lower
#     COVID death rates 2020-23 (NYT, per 100k). Expected sign: negative. County bar; NYC's
#     five boroughs counted once.
# H24 COVID deaths x adherence. Congregational adherence (capped at 1,000 per 1,000) and
#     COVID death rates. Two-sided: no direction stated. County bar.
# H25 The Commons x connectedness. Public libraries, playgrounds and pools per 10,000
#     residents vs economic connectedness, positive. County bar. WAITS on The Commons layer
#     (PENDING): runs only if the layer ships this round.
# H26 Night lights x UFO sightings. Do sightings need dark skies or people? County UFO
#     reports per 100,000 residents vs mean night-light brightness: darker counties report
#     more per resident (negative). County bar. WAITS on The Banished Dark (PENDING).
# H27 Tables for One, Again (living alone x overdoses; the title "The Empty Chair" is taken).
#     Counties where more households are one person have higher 2024 overdose rates.
#     Expected sign: positive. County bar; handled gently — no suicide data, per protocol.
# H28 Police killings x living alone. Fatal police shootings per 100k (2015-24) vs share
#     living alone. Two-sided. County bar, with killings this rare the Spearman leg decides
#     ties; counties under 10,000 people are reported but not required for (e).
# H29 War x the languages going silent, by country (the World at War essay's open question).
#     Countries with higher organized-violence death rates since 1989 hold a larger share of
#     their languages at "shifting" or worse (AES >= 3). Country level: cannot ship as a card.
#     The essay may state the link only if Spearman >= 0.20 over countries with >= 5
#     languages, the top-vs-bottom quintile gap in that share is >= 10 points, and the sign
#     holds within at least 3 of the macro-areas with >= 10 such countries. Otherwise the
#     essay says plainly that the test did not find it.
# H30 Gifts x adherence, income controlled. Itemized gifts as a share of income track
#     congregational adherence once log income per return is controlled: partial r >= 0.20,
#     within-state partial >= 0.15. Rest of the county bar applies. Utah is reported with and
#     without (12 of the top 50 gift counties are there).
# H31 Same-sex couples x the sorting. Over the 763 counties with reliable estimates only:
#     same-sex couple households per 1,000 vs net household migration per 1,000. Two-sided.
#     County bar with n >= 500 required of the reliable counties that have migration data.
