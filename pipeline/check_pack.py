#!/usr/bin/env python3
"""Packed-payload equivalence (Phase 0 QC loop).

Compares every data/layers/*.json against the version at a git ref (default HEAD),
field by field after decoding. Keys that only exist in the new payload (e.g. `codes`,
`time`) are listed as additions, not failures; any changed or missing value fails.

  python3 pipeline/check_pack.py [ref]
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ref = sys.argv[1] if len(sys.argv) > 1 else "HEAD"
bad = 0
for fn in sorted(os.listdir(os.path.join(ROOT, "data", "layers"))):
    new = json.load(open(os.path.join(ROOT, "data", "layers", fn)))
    try:
        old = json.loads(subprocess.run(["git", "show", f"{ref}:data/layers/{fn}"], cwd=ROOT,
                                        capture_output=True, text=True, check=True).stdout)
    except subprocess.CalledProcessError:
        print(f"NEW   {fn} (not at {ref})"); continue
    diffs = [k for k in old if k not in new or new[k] != old[k]]
    added = [k for k in new if k not in old]
    if diffs:
        bad += 1
        for k in diffs[:6]:
            o, n = old.get(k), new.get(k)
            detail = ""
            if isinstance(o, list) and isinstance(n, list):
                i = next((i for i, (a, b) in enumerate(zip(o, n)) if a != b), min(len(o), len(n)))
                detail = f" first difference at [{i}] {o[i] if i < len(o) else '∅'!r} → {n[i] if i < len(n) else '∅'!r} (len {len(o)} → {len(n)})"
            elif isinstance(o, dict) and isinstance(n, dict):
                kk = next((x for x in o if o[x] != n.get(x)), None)
                detail = f" e.g. [{kk}] {o.get(kk)!r} → {n.get(kk)!r}" if kk else f" keys {len(o)} → {len(n)}"
            else:
                detail = f" {str(o)[:60]!r} → {str(n)[:60]!r}"
            print(f"DIFF  {fn} :: {k}{detail}")
    else:
        print(f"SAME  {fn}" + (f"  (+ {', '.join(added)})" if added else ""))
print(f"\n{'all payloads equivalent' if not bad else str(bad) + ' payload(s) differ'} vs {ref}")
sys.exit(1 if bad else 0)
