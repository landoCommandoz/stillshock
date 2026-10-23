"""Spellclip server: upload a clip, pick a spell, get a share-ready video.

Run from the repo root:
    uvicorn app.server:app --host 0.0.0.0 --port 8787
or   python app/server.py
"""
from __future__ import annotations

import json
import os
import random
import shutil
import sys
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile  # noqa: E402
from fastapi.responses import FileResponse, JSONResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

import media  # noqa: E402
from backend import GenerationError, pick_backend  # noqa: E402
from graph import NODE_OUTPUT, build_graph, get_spell, load_registry, render_prompt  # noqa: E402

DATA_DIR = os.environ.get("SPELLCLIP_DATA", os.path.join(HERE, "data"))
JOBS_DIR = os.path.join(DATA_DIR, "jobs")
MAX_UPLOAD_MB = int(os.environ.get("SPELLCLIP_MAX_UPLOAD_MB", "300"))
os.makedirs(JOBS_DIR, exist_ok=True)

REGISTRY = load_registry()
BACKEND = pick_backend()
EXECUTOR = ThreadPoolExecutor(max_workers=int(os.environ.get("SPELLCLIP_WORKERS", "1")))
JOBS: dict[str, dict[str, Any]] = {}
LOCK = threading.Lock()

app = FastAPI(title="Spellclip", version="0.1.0")


# ---------- helpers ----------

def _job_dir(job_id: str) -> str:
    return os.path.join(JOBS_DIR, job_id)


def _save(job: dict[str, Any]) -> None:
    with LOCK:
        JOBS[job["id"]] = job
        path = os.path.join(_job_dir(job["id"]), "job.json")
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(job, f, indent=2)
        os.replace(tmp, path)


def _public(job: dict[str, Any]) -> dict[str, Any]:
    out = {k: v for k, v in job.items() if not k.startswith("_")}
    jid = job["id"]
    out["urls"] = {
        "input": f"/api/jobs/{jid}/file/input" if job.get("has_input") else None,
        "result": f"/api/jobs/{jid}/file/result" if job["status"] == "done" else None,
        "compare": f"/api/jobs/{jid}/file/compare" if job.get("has_compare") else None,
        "poster": f"/api/jobs/{jid}/file/poster" if job.get("has_poster") else None,
    }
    return out


def _load_jobs_from_disk() -> None:
    for jid in os.listdir(JOBS_DIR):
        p = os.path.join(JOBS_DIR, jid, "job.json")
        if os.path.isfile(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    job = json.load(f)
                if job.get("status") in ("queued", "running"):
                    job["status"] = "error"
                    job["error"] = "The server restarted while this job was running. Please run it again."
                JOBS[jid] = job
            except Exception:
                continue


_load_jobs_from_disk()


def _pick_size(orientation: str, quality: str, src_w: int, src_h: int) -> tuple[int, int, str]:
    sizes = REGISTRY["sizes"].get(quality) or REGISTRY["sizes"]["fast"]
    if orientation == "auto":
        if src_w and src_h:
            ratio = src_w / src_h
            orientation = "square" if 0.9 <= ratio <= 1.1 else ("landscape" if ratio > 1 else "portrait")
        else:
            orientation = "landscape"
    w, h = sizes.get(orientation, sizes["landscape"])
    return int(w), int(h), orientation


# ---------- the pipeline ----------

def _run_job(job_id: str) -> None:
    job = JOBS[job_id]
    jd = _job_dir(job_id)

    def progress(stage: str, value: float, message: str) -> None:
        job["stage"] = stage
        job["progress"] = round(max(job.get("progress", 0.0), min(value, 1.0)), 3)
        job["message"] = message
        job["updated_at"] = time.time()
        _save(job)

    try:
        job["status"] = "running"
        job["started_at"] = time.time()
        progress("preparing", 0.01, "Preparing your clip (24 fps, fitted to the canvas)")
        spell = get_spell(REGISTRY, job["spell"])
        src = job["_source"]
        info = media.probe(src)
        job["source_info"] = info
        w, h, orientation = _pick_size(job["orientation"], job["quality"], info["width"], info["height"])
        if spell.get("pad_to") == "portrait":
            w, h = REGISTRY["sizes"][job["quality"]]["portrait"]
            orientation = "portrait"
        job["width"], job["height"], job["orientation_used"] = w, h, orientation
        fps = int(REGISTRY.get("fps", 24))
        wanted = int(REGISTRY["durations"].get(job["duration"], REGISTRY["durations"]["short"]))
        available = int(info["duration"] * fps) if info.get("duration") else wanted
        frames = min(wanted, available)
        frames = ((frames - 1) // 8) * 8 + 1  # LTX needs 8n+1 frames
        if frames < 33:
            raise GenerationError("That clip is too short. Spellclip needs at least 1.5 seconds of video.")
        job["frames"] = frames
        prepared = os.path.join(jd, "input.mp4")
        media.prepare(src, prepared, w, h, frames, fps, pad=bool(spell.get("pad_to")))
        job["has_input"] = True
        try:
            media.poster(prepared, os.path.join(jd, "poster.jpg"))
            job["has_poster"] = True
        except Exception:
            pass
        _save(job)

        positive = render_prompt(spell, job.get("variant"), job.get("scene", ""), job.get("object", ""))
        job["prompt"] = positive
        g = build_graph(
            REGISTRY, spell["id"], width=w, height=h, frames=frames, seed=job["seed"],
            positive=positive, video_file="input.mp4",
            lora_strength=job.get("strength"), filename_prefix=f"spellclip/{job_id}",
        )
        job["output_node"] = NODE_OUTPUT
        with open(os.path.join(jd, "workflow_api.json"), "w", encoding="utf-8") as f:
            json.dump(g, f, indent=2)

        raw = os.path.join(jd, "raw_output.mp4")
        BACKEND.run(g, prepared, raw, progress, spell["id"])
        progress("finishing", 0.96, "Encoding for phones and browsers")
        result = os.path.join(jd, "result.mp4")
        if job.get("keep_audio"):
            tmp = os.path.join(jd, "result_tmp.mp4")
            media.normalize_output(raw, tmp)
            media.replace_audio(tmp, prepared, result)
        else:
            media.normalize_output(raw, result)
        try:
            media.before_after(prepared, result, os.path.join(jd, "compare.mp4"), w, h)
            job["has_compare"] = True
        except Exception as e:
            job["compare_error"] = str(e)[:300]
        job["status"] = "done"
        job["finished_at"] = time.time()
        progress("done", 1.0, "Done")
    except GenerationError as e:
        job["status"] = "error"
        job["error"] = str(e)
        job["finished_at"] = time.time()
        _save(job)
    except Exception as e:  # anything else: still a plain message, details in job.json
        job["status"] = "error"
        job["error"] = "Something went wrong while processing this clip. " + (str(e)[:240] or type(e).__name__)
        job["error_detail"] = repr(e)[:1000]
        job["finished_at"] = time.time()
        _save(job)


# ---------- API ----------

@app.get("/api/config")
def get_config() -> dict[str, Any]:
    return {
        "app": "Spellclip",
        "backend": BACKEND.name,
        "demo_mode": BACKEND.name == "demo",
        "spells": REGISTRY["spells"],
        "sizes": REGISTRY["sizes"],
        "durations": REGISTRY["durations"],
        "fps": REGISTRY.get("fps", 24),
        "max_upload_mb": MAX_UPLOAD_MB,
    }


@app.post("/api/jobs")
async def create_job(
    background: BackgroundTasks,
    file: UploadFile | None = File(default=None),
    source_job: str | None = Form(default=None),
    source_kind: str = Form(default="result"),
    spell: str = Form(...),
    variant: str | None = Form(default=None),
    scene: str = Form(default=""),
    object: str = Form(default=""),
    orientation: str = Form(default="auto"),
    quality: str = Form(default="fast"),
    duration: str = Form(default="short"),
    seed: int | None = Form(default=None),
    strength: float | None = Form(default=None),
    keep_audio: bool = Form(default=False),
) -> JSONResponse:
    try:
        spell_def = get_spell(REGISTRY, spell)
    except KeyError:
        raise HTTPException(400, "Unknown spell.")
    if spell_def.get("object_field") and not object.strip():
        raise HTTPException(400, "Tell the spell what should disappear (the object field is empty).")
    if orientation not in ("auto", "landscape", "portrait", "square"):
        raise HTTPException(400, "orientation must be auto, landscape, portrait or square.")
    if quality not in REGISTRY["sizes"]:
        raise HTTPException(400, "Unknown quality.")
    if duration not in REGISTRY["durations"]:
        raise HTTPException(400, "Unknown duration.")
    if strength is not None and not (0.0 <= strength <= 3.0):
        raise HTTPException(400, "strength must be between 0 and 3.")

    job_id = time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:6]
    jd = _job_dir(job_id)
    os.makedirs(jd, exist_ok=True)
    source = os.path.join(jd, "source.mp4")

    if source_job:
        prev = JOBS.get(source_job)
        if not prev or prev.get("status") != "done":
            raise HTTPException(400, "The previous result is not available to stack on.")
        if source_kind not in ("result", "input"):
            raise HTTPException(400, "source_kind must be result or input.")
        src_name = "result.mp4" if source_kind == "result" else "input.mp4"
        src_path = os.path.join(_job_dir(source_job), src_name)
        if not os.path.isfile(src_path):
            raise HTTPException(400, "The previous clip is no longer on disk.")
        shutil.copyfile(src_path, source)
        chain = (list(prev.get("chain", [])) + [prev["spell"]]) if source_kind == "result" else list(prev.get("chain", []))
    elif file is not None:
        size = 0
        with open(source, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_UPLOAD_MB * 1024 * 1024:
                    out.close()
                    shutil.rmtree(jd, ignore_errors=True)
                    raise HTTPException(413, f"That file is bigger than {MAX_UPLOAD_MB} MB. Trim it first.")
                out.write(chunk)
        if size == 0:
            shutil.rmtree(jd, ignore_errors=True)
            raise HTTPException(400, "The upload was empty.")
        chain = []
    else:
        shutil.rmtree(jd, ignore_errors=True)
        raise HTTPException(400, "Upload a clip or pick a previous result to stack on.")

    job: dict[str, Any] = {
        "id": job_id, "status": "queued", "stage": "queued", "progress": 0.0,
        "message": "Waiting in line", "spell": spell, "variant": variant, "scene": scene[:500],
        "object": object[:200], "orientation": orientation, "quality": quality, "duration": duration,
        "seed": seed if seed is not None else random.randint(0, 2**31 - 1), "strength": strength,
        "keep_audio": bool(keep_audio), "chain": chain, "source_job": source_job,
        "backend": BACKEND.name, "created_at": time.time(), "updated_at": time.time(),
        "_source": source,
    }
    _save(job)
    EXECUTOR.submit(_run_job, job_id)
    return JSONResponse(_public(job), status_code=202)


@app.get("/api/jobs")
def list_jobs(limit: int = 30) -> list[dict[str, Any]]:
    jobs = sorted(JOBS.values(), key=lambda j: j.get("created_at", 0), reverse=True)
    return [_public(j) for j in jobs[: max(1, min(limit, 200))]]


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str) -> dict[str, Any]:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "No such job.")
    return _public(job)


@app.get("/api/jobs/{job_id}/file/{kind}")
def get_file(job_id: str, kind: str) -> FileResponse:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "No such job.")
    names = {"input": "input.mp4", "result": "result.mp4", "compare": "compare.mp4",
             "poster": "poster.jpg", "workflow": "workflow_api.json"}
    if kind not in names:
        raise HTTPException(404, "No such file.")
    path = os.path.join(_job_dir(job_id), names[kind])
    if not os.path.isfile(path):
        raise HTTPException(404, "That file is not ready yet.")
    media_type = "video/mp4" if path.endswith(".mp4") else ("image/jpeg" if path.endswith(".jpg") else "application/json")
    spell = job.get("spell", "spell")
    fname = f"spellclip-{spell}-{job_id}.{path.rsplit('.', 1)[-1]}"
    return FileResponse(path, media_type=media_type, filename=fname if kind in ("result", "compare") else None)


@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: str) -> dict[str, str]:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "No such job.")
    if job["status"] in ("queued", "running"):
        raise HTTPException(409, "That job is still running.")
    with LOCK:
        JOBS.pop(job_id, None)
    shutil.rmtree(_job_dir(job_id), ignore_errors=True)
    return {"ok": "deleted"}


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    return {"ok": True, "backend": BACKEND.name, "jobs": len(JOBS)}


app.mount("/", StaticFiles(directory=os.path.join(HERE, "static"), html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=os.environ.get("HOST", "0.0.0.0"), port=int(os.environ.get("PORT", "8787")))
