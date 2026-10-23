"""Write one API-format workflow JSON per spell into workflows/.

Run from the repo root:  python scripts/export_workflows.py
These files are what the app submits (with the video, size, seed and prompt
filled in per job). You can also load them in ComfyUI's Developer mode or
submit them with the Comfy SDK directly.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "app"))

from graph import build_graph, load_registry, render_prompt, required_models  # noqa: E402

registry = load_registry()
out_dir = os.path.join(ROOT, "workflows")
os.makedirs(out_dir, exist_ok=True)
index = []
for spell in registry["spells"]:
    w, h = registry["sizes"]["hd"]["landscape"]
    g = build_graph(
        registry, spell["id"], width=w, height=h, frames=registry["durations"]["short"],
        seed=1212, positive=render_prompt(spell, None, "a person in a city street", "object"),
        video_file="input.mp4",
    )
    path = os.path.join(out_dir, f"spellclip_{spell['id']}_api.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(g, f, indent=2)
    index.append({"spell": spell["id"], "file": os.path.basename(path), "models": required_models(registry, spell["id"])})
    print("wrote", path)
with open(os.path.join(out_dir, "index.json"), "w", encoding="utf-8") as f:
    json.dump(index, f, indent=2)
print("wrote workflows/index.json")
