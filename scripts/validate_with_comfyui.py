"""Submit every workflows/*_api.json to a running ComfyUI and report validation.

Usage: python scripts/validate_with_comfyui.py [http://127.0.0.1:8188]
A structural pass means every node class exists and every input name, type
and combo value is accepted. Execution itself needs real model files.
"""
import glob
import json
import os
import sys
import urllib.request

base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8188"
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ok = True
for path in sorted(glob.glob(os.path.join(root, "workflows", "*_api.json"))):
    with open(path, "r", encoding="utf-8") as f:
        prompt = json.load(f)
    body = json.dumps({"prompt": prompt, "client_id": "spellclip-validate"}).encode()
    req = urllib.request.Request(base + "/prompt", data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read().decode())
        errs = data.get("node_errors") or {}
        if errs:
            ok = False
            print("FAIL", os.path.basename(path), json.dumps(errs, indent=1)[:2000])
        else:
            print("PASS", os.path.basename(path), "prompt_id", data.get("prompt_id"))
    except urllib.error.HTTPError as e:
        ok = False
        print("FAIL", os.path.basename(path), e.code, e.read().decode()[:2000])
print("ALL PASS" if ok else "SOME FAILED")
sys.exit(0 if ok else 1)
