"""Edit registry/registry.json by text, keeping its hand formatting (a json.dump rewrite
reformats the whole file). Use from Python, run from the repo root:

    import sys; sys.path.insert(0, "pipeline")
    from regedit import set_key, add_layer
    set_key("loss-covid", "tintMax", 0.62)              # insert or replace one top-level key
    add_layer("loss-crashes", {"id": "...", ...})        # insert a new layer after another

Every write is checked: the file must parse and contain no duplicate keys (JSON silently
keeps the last duplicate — that bug once emptied two atlas plates)."""
import json, os, re

REG = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "registry", "registry.json")

def _check(s):
    def hook(pairs):
        seen = set()
        for k, _ in pairs:
            if k in seen:
                raise SystemExit(f"regedit: duplicate key '{k}' — nothing written")
            seen.add(k)
        return dict(pairs)
    json.loads(s, object_pairs_hook=hook)

def _block(s, lid):
    i = s.index(f'"id": "{lid}",')
    j = s.index('\n    }', i)          # layer objects close at four-space indent
    return i, j

def _fmt(k, v):
    """One top-level key as the registry writes it: essays and plate stats span lines, the rest is one line."""
    if k == "essay" and isinstance(v, dict):
        return f'"{k}": ' + json.dumps(v, ensure_ascii=False, indent=2).replace('\n', '\n      ')
    if k == "plateStats" and v:
        return f'"{k}": [\n' + ",\n".join("        " + json.dumps(x, ensure_ascii=False, separators=(", ", ": ")) for x in v) + "\n      ]"
    return f'"{k}": ' + json.dumps(v, ensure_ascii=False, separators=(", ", ": "))

def set_key(lid, key, value, after="forms"):
    """Replace `key` in layer `lid` (wherever it sits, including the last line), or insert it after `after`."""
    s = open(REG, encoding="utf-8").read()
    i, j = _block(s, lid)
    block = s[i:j]
    text = _fmt(key, value)
    lines = block.split("\n")
    hit = [n for n, l in enumerate(lines) if l.startswith(f'      "{key}": ')]
    if hit:
        n = hit[0]
        # the old value may span several lines: it ends where the next top-level key starts
        end = next((m for m in range(n + 1, len(lines)) if lines[m].startswith('      "')), len(lines))
        is_last = end == len(lines)
        lines[n:end] = ("      " + text + ("" if is_last else ",")).split("\n")
    else:
        n = next(k for k, l in enumerate(lines) if l.startswith(f'      "{after}": '))
        end = next((m for m in range(n + 1, len(lines)) if lines[m].startswith('      "')), len(lines))
        lines[end:end] = ("      " + text + ",").split("\n")
    s = s[:i] + "\n".join(lines) + s[j:]
    _check(s)
    open(REG, "w", encoding="utf-8").write(s)

def add_layer(after_id, obj):
    """Insert a new layer object after another layer's block, formatted like its neighbours."""
    s = open(REG, encoding="utf-8").read()
    if f'"id": "{obj["id"]}",' in s:
        raise SystemExit(obj["id"] + " exists")
    i, j = _block(s, after_id)
    j += len('\n    }')
    out = ['    {']
    keys = list(obj)
    for n, k in enumerate(keys):
        txt = "      " + _fmt(k, obj[k])
        out.append(txt + ("," if n < len(keys) - 1 else ""))
    out.append('    }')
    s = s[:j] + ',\n' + '\n'.join(out) + s[j:]
    _check(s)
    open(REG, "w", encoding="utf-8").write(s)
