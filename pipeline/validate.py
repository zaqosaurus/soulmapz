#!/usr/bin/env python3
"""Acquisition-loop step 4 (PLAN_V07 §4): automated validation of a staging file.

  python3 pipeline/validate.py <layer-id> [--protocol] [--us]

Checks (each prints PASS/FAIL):
  * coordinates parse, lie in range, and are not (0,0)
  * every point lies on land (Natural Earth 1:50m, ±0.35° tolerance for coasts and
    islands) — catches swapped lat/lon and sign errors; with --us, inside the U.S. nation
  * no duplicate (lat, lon, name) records
  * --protocol: no record carries a name, age, address or person-like field
"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def topo_polys(fp, obj):
    topo = json.load(open(fp))
    tr = topo.get("transform")
    arcs = []
    for arc in topo["arcs"]:
        pts, x, y = [], 0, 0
        for dx, dy in arc:
            if tr: x += dx; y += dy; pts.append((x*tr["scale"][0]+tr["translate"][0], y*tr["scale"][1]+tr["translate"][1]))
            else: pts.append((dx, dy))
        arcs.append(pts)
    def ring(r):
        out = []
        for ai in r:
            seg = arcs[ai] if ai >= 0 else arcs[~ai][::-1]
            out.extend(seg if not out else seg[1:])
        return out
    polys = []
    def add(g):
        if g["type"] == "Polygon": polys.append([ring(r) for r in g["arcs"]])
        elif g["type"] == "MultiPolygon": polys.extend([[ring(r) for r in p] for p in g["arcs"]])
        elif g["type"] == "GeometryCollection":
            for gg in g["geometries"]: add(gg)
    add(topo["objects"][obj])
    boxed = []
    for p in polys:
        xs = [q[0] for q in p[0]]
        if max(xs) - min(xs) > 180:      # may cross the antimeridian: unwrap each ring continuously
            def unwrap(r):
                out, off, px = [], 0, None
                for x, y in r:
                    if px is not None and abs(x - px) > 180: off += 360 if px > x else -360
                    px = x; out.append((x + off, y))
                return out
            p = [unwrap(r) for r in p]
        xs = [q[0] for q in p[0]]; ys = [q[1] for q in p[0]]
        boxed.append((min(xs), min(ys), max(xs), max(ys), p))
    return boxed

def in_ring(x, y, r):
    inside, j = False, len(r) - 1
    for i in range(len(r)):
        xi, yi = r[i]; xj, yj = r[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi: inside = not inside
        j = i
    return inside

def on(polys, lat, lon, tol):
    for dx, dy in ((0, 0), (tol, 0), (-tol, 0), (0, tol), (0, -tol), (tol, tol), (-tol, -tol), (tol, -tol), (-tol, tol)):
        y = lat + dy
        for x in (lon + dx, lon + dx + 360, lon + dx - 360):
            for x0, y0, x1, y1, p in polys:
                if x0 <= x <= x1 and y0 <= y <= y1 and in_ring(x, y, p[0]) and not any(in_ring(x, y, h) for h in p[1:]): return True
    return False

def main():
    lid = sys.argv[1]; prot = "--protocol" in sys.argv; us = "--us" in sys.argv
    st = json.load(open(os.path.join(ROOT, "data", "staging", f"{lid}.json")))
    recs = st.get("records") or []
    ok = True
    def report(name, passed, detail=""):
        nonlocal ok
        ok &= bool(passed)
        print(("PASS " if passed else "FAIL ") + name + (f" — {detail}" if detail else ""))
    if recs:
        bad = [r for r in recs if not (-90 <= r["lat"] <= 90 and -180 <= r["lon"] <= 180) or (r["lat"] == 0 and r["lon"] == 0)]
        report("coordinates in range, none at (0,0)", not bad, f"{len(bad)} bad")
        polys = topo_polys(os.path.join(ROOT, "data", "ref", "nation-10m.json" if us else "land-50m.json"), "nation" if us else "land")
        off = [r for r in recs if not on(polys, r["lat"], r["lon"], 0.35)]
        far = [r for r in off if not on(polys, r["lat"], r["lon"], 1.5)]
        # near misses are small islands and coasts below the 1:50m map's resolution (listed for review);
        # far misses — more than ~1.5° from any land — are what swapped or wrong coordinates look like
        # a hand review may accept far points that are oceanic islands missing from the 1:50m
        # coastline: the sidecar names the countries reviewed and the exact count; nothing else passes
        rev = {}
        pv = os.path.join(ROOT, "data", "staging", f"{lid}.provenance.json")
        if os.path.exists(pv): rev = (json.load(open(pv)).get("validation") or {}).get("reviewed_offshore") or {}
        if far and rev and rev.get("count") == len(far) and all((r.get("meta") or {}).get("countries", "").split(";")[0] in rev.get("countries", []) for r in far):
            print(f"NOTE {len(far)} far-offshore points match the hand review in the sidecar ({rev.get('reason','')})")
            far = []
        report(f"points on {'U.S. ' if us else ''}land (±0.35°), or near a coast (±1.5°)", not far,
               f"{len(off)} near-coast (e.g. " + "; ".join(r.get('name','') for r in off[:8]) + f"); {len(far)} far offshore" + (": " + "; ".join(f"{r.get('name','')} {r['lat']},{r['lon']}" for r in far[:8]) if far else ""))
        keys = [(r["lat"], r["lon"], r.get("name")) for r in recs]
        report("no duplicate (lat, lon, name)", len(set(keys)) == len(keys), f"{len(keys) - len(set(keys))} duplicates")
    if prot:
        BAD = {"name", "age", "address", "victim", "person", "dob", "first_name", "last_name"}
        hits = set()
        for r in recs:
            if r.get("name"): hits.add("name")
            for k in (r.get("meta") or {}): 
                if k.lower() in BAD: hits.add("meta." + k)
        for r in st.get("regions") or []:
            for k in (r.get("meta") or {}):
                if k.lower() in BAD: hits.add("meta." + k)
        report("protocol: no person-level fields", not hits, ", ".join(sorted(hits)))
    print("VALID" if ok else "INVALID")
    sys.exit(0 if ok else 1)

if __name__ == "__main__":
    main()
