"""Generation backends.

- CloudBackend: Comfy Cloud (or any Comfy API deployment) through the official comfy-sdk.
  Needs COMFY_API_KEY. Set COMFY_BASE_URL to point at a Comfy API deployment or a
  self-hosted comfy-api-proxy instead of Comfy Cloud.
- LocalBackend: a plain ComfyUI on your own GPU, through its REST API. Set COMFYUI_URL
  (default http://127.0.0.1:8188).
- DemoBackend: no model at all. Returns a color-filtered copy so the app can be
  clicked through end to end. The UI shows a clear DEMO MODE banner.

Choose with SPELLCLIP_BACKEND=cloud|local|demo, or let pick_backend() decide from
which environment variables are set.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from typing import Any, Callable

from graph import NODE_OUTPUT, NODE_VIDEO_IN
import media

Progress = Callable[[str, float, str], None]  # stage, 0..1, message


class GenerationError(Exception):
    """A plain-English error the UI can show as is."""


class DemoBackend:
    name = "demo"

    def run(self, graph: dict[str, Any], video_path: str, out_path: str, progress: Progress, spell_id: str) -> str:
        progress("uploading", 0.1, "Demo mode: no model attached, simulating a run")
        for i in range(1, 9):
            time.sleep(0.5)
            progress("generating", 0.1 + 0.8 * i / 8, f"Demo step {i} of 8")
        media.demo_render(video_path, out_path, spell_id)
        progress("finishing", 0.98, "Finishing")
        return out_path


class CloudBackend:
    name = "cloud"

    def __init__(self, api_key: str | None = None):
        try:
            from comfy_sdk import Comfy  # type: ignore
        except ImportError as e:
            raise GenerationError("The comfy-sdk package is not installed. Run: pip install -r app/requirements.txt") from e
        self._Comfy = Comfy
        self.api_key = api_key or os.environ.get("COMFY_API_KEY")
        if not self.api_key and not os.environ.get("COMFY_BASE_URL"):
            raise GenerationError("COMFY_API_KEY is not set.")

    def run(self, graph: dict[str, Any], video_path: str, out_path: str, progress: Progress, spell_id: str) -> str:
        from comfy_sdk import exceptions as sdk_exc  # type: ignore

        client = self._Comfy(api_key=self.api_key) if self.api_key else self._Comfy()
        try:
            progress("uploading", 0.03, "Uploading your clip")
            wf = client.workflows.from_json(graph)
            asset = client.assets.from_file(video_path)
            wf.set_input(NODE_VIDEO_IN, "file", asset)
            progress("queued", 0.06, "Waiting for a GPU")
            job = client.submit(wf)
            last = 0.06
            try:
                for event in job.events():
                    kind = getattr(event, "kind", None) or type(event).__name__.lower()
                    if "progress" in kind:
                        value = float(getattr(event, "value", 0) or 0)
                        last = max(last, 0.08 + 0.85 * min(max(value, 0.0), 1.0))
                        progress("generating", last, getattr(event, "message", "") or "Generating")
                    elif "statuschange" in kind or "status" in kind:
                        status = str(getattr(event, "status", "")).lower()
                        if status in ("succeeded", "failed", "cancelled", "canceled"):
                            break
                        if status in ("running", "in_progress"):
                            progress("generating", max(last, 0.1), "Generating")
            except Exception:
                pass  # the event stream is cosmetic; result() below is authoritative
            job = job.result()
            outputs = job.get_outputs(NODE_OUTPUT) or job.outputs
            if not outputs:
                raise GenerationError("The job finished but produced no video file.")
            progress("finishing", 0.95, "Downloading the result")
            outputs[0].to_file(out_path)
            return out_path
        except GenerationError:
            raise
        except Exception as e:  # map SDK errors to plain English
            name = type(e).__name__
            msg = str(e)
            if name == "Unauthorized" or "401" in msg:
                raise GenerationError("Comfy Cloud rejected the API key. Check COMFY_API_KEY.") from e
            if name == "InsufficientCredits" or "402" in msg:
                raise GenerationError("Your Comfy Cloud account is out of credits.") from e
            if name == "QueueFull" or "429" in msg:
                raise GenerationError("Comfy Cloud is busy right now. Try again in a minute.") from e
            if name == "JobFailed":
                raise GenerationError(f"The generation failed on the server: {msg[:300]}") from e
            if "model" in msg.lower() and ("not found" in msg.lower() or "missing" in msg.lower()):
                raise GenerationError("A model file for this spell is missing on the server. See the README section 'Models'.") from e
            raise GenerationError(f"{name}: {msg[:300]}") from e
        finally:
            try:
                client.close()
            except Exception:
                pass


class LocalBackend:
    name = "local"

    def __init__(self, url: str | None = None):
        self.url = (url or os.environ.get("COMFYUI_URL") or "http://127.0.0.1:8188").rstrip("/")

    def _post(self, path: str, data: bytes, content_type: str) -> dict[str, Any]:
        req = urllib.request.Request(self.url + path, data=data, headers={"Content-Type": content_type})
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read().decode() or "{}")

    def _get(self, path: str) -> Any:
        with urllib.request.urlopen(self.url + path, timeout=120) as r:
            return r.read()

    def run(self, graph: dict[str, Any], video_path: str, out_path: str, progress: Progress, spell_id: str) -> str:
        progress("uploading", 0.03, "Sending your clip to ComfyUI")
        name = f"spellclip_{uuid.uuid4().hex}.mp4"
        boundary = uuid.uuid4().hex
        with open(video_path, "rb") as f:
            payload = f.read()
        body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"{name}\"\r\n"
                f"Content-Type: video/mp4\r\n\r\n").encode() + payload + f"\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"type\"\r\n\r\ninput\r\n--{boundary}--\r\n".encode()
        try:
            up = self._post("/upload/image", body, f"multipart/form-data; boundary={boundary}")
        except (urllib.error.URLError, OSError) as e:
            raise GenerationError(f"Cannot reach ComfyUI at {self.url}. Is it running?") from e
        graph[NODE_VIDEO_IN]["inputs"]["file"] = up.get("name", name)
        try:
            res = self._post("/prompt", json.dumps({"prompt": graph, "client_id": "spellclip"}).encode(), "application/json")
        except urllib.error.HTTPError as e:
            detail = e.read().decode()[:800]
            if "not in list" in detail or "Value not in list" in detail:
                raise GenerationError("ComfyUI is missing a model file for this spell. Download it into models/ (see README, Models).") from e
            raise GenerationError(f"ComfyUI rejected the workflow: {detail}") from e
        pid = res.get("prompt_id")
        if not pid:
            raise GenerationError(f"ComfyUI did not return a prompt id: {res}")
        progress("queued", 0.06, "Queued on your ComfyUI")
        started = time.time()
        while True:
            time.sleep(2)
            hist = json.loads(self._get(f"/history/{pid}").decode() or "{}")
            entry = hist.get(pid)
            if entry:
                st = entry.get("status", {})
                if st.get("status_str") == "error":
                    msgs = [m[1].get("exception_message", "") for m in st.get("messages", []) if m[0] == "execution_error"]
                    raise GenerationError("ComfyUI hit an error: " + (msgs[0] if msgs else "unknown")[:400])
                outs = entry.get("outputs", {}).get(NODE_OUTPUT, {})
                files = outs.get("images") or outs.get("video") or outs.get("gifs") or []
                if not files:
                    for v in entry.get("outputs", {}).values():
                        for key in ("images", "video", "gifs"):
                            if v.get(key):
                                files = v[key]
                if not files:
                    raise GenerationError("ComfyUI finished but no output video was found.")
                fo = files[0]
                q = urllib.parse.urlencode({"filename": fo["filename"], "subfolder": fo.get("subfolder", ""), "type": fo.get("type", "output")})
                progress("finishing", 0.95, "Downloading the result")
                with open(out_path, "wb") as f:
                    f.write(self._get("/view?" + q))
                return out_path
            elapsed = time.time() - started
            progress("generating", min(0.9, 0.1 + elapsed / 240.0), f"Generating ({int(elapsed)}s)")


def pick_backend() -> Any:
    mode = (os.environ.get("SPELLCLIP_BACKEND") or "").lower()
    if mode == "demo":
        return DemoBackend()
    if mode == "local" or (not mode and os.environ.get("COMFYUI_URL")):
        return LocalBackend()
    if mode == "cloud" or (not mode and (os.environ.get("COMFY_API_KEY") or os.environ.get("COMFY_BASE_URL"))):
        return CloudBackend()
    return DemoBackend()
