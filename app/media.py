"""ffmpeg helpers: probe, pre-size the clip, mux audio, build the before/after.

Uses the ffmpeg on PATH, or the binary bundled with the imageio-ffmpeg pip
package, so a clean install works without a system ffmpeg.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from typing import Any


def ffmpeg_bin() -> str:
    p = shutil.which("ffmpeg")
    if p:
        return p
    try:
        import imageio_ffmpeg  # type: ignore

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as e:  # pragma: no cover
        raise RuntimeError("ffmpeg not found. Install ffmpeg or `pip install imageio-ffmpeg`.") from e


def ffprobe_bin() -> str | None:
    return shutil.which("ffprobe")


def _run(args: list[str], timeout: int = 600) -> None:
    proc = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if proc.returncode != 0:
        tail = (proc.stderr or "")[-1200:]
        raise RuntimeError(f"ffmpeg failed: {tail}")


def probe(path: str) -> dict[str, Any]:
    """Return width, height, fps, duration, has_audio. Falls back to ffmpeg -i parsing."""
    fp = ffprobe_bin()
    info: dict[str, Any] = {"width": 0, "height": 0, "fps": 0.0, "duration": 0.0, "has_audio": False}
    if fp:
        proc = subprocess.run(
            [fp, "-v", "error", "-print_format", "json", "-show_streams", "-show_format", path],
            capture_output=True, text=True, timeout=60,
        )
        if proc.returncode == 0:
            data = json.loads(proc.stdout or "{}")
            for s in data.get("streams", []):
                if s.get("codec_type") == "video" and not info["width"]:
                    info["width"] = int(s.get("width") or 0)
                    info["height"] = int(s.get("height") or 0)
                    num, _, den = (s.get("avg_frame_rate") or "0/1").partition("/")
                    try:
                        info["fps"] = float(num) / float(den or 1)
                    except (ValueError, ZeroDivisionError):
                        info["fps"] = 0.0
                    rot = 0
                    for sd in s.get("side_data_list", []) or []:
                        if "rotation" in sd:
                            rot = int(abs(float(sd["rotation"])))
                    if rot in (90, 270):
                        info["width"], info["height"] = info["height"], info["width"]
                if s.get("codec_type") == "audio":
                    info["has_audio"] = True
            try:
                info["duration"] = float(data.get("format", {}).get("duration") or 0)
            except ValueError:
                pass
            return info
    # Fallback: parse `ffmpeg -i` output.
    proc = subprocess.run([ffmpeg_bin(), "-hide_banner", "-i", path], capture_output=True, text=True, timeout=60)
    text = proc.stderr or ""
    import re

    m = re.search(r"Video:.*? (\d{2,5})x(\d{2,5})", text)
    if m:
        info["width"], info["height"] = int(m.group(1)), int(m.group(2))
    m = re.search(r"(\d+(?:\.\d+)?) fps", text)
    if m:
        info["fps"] = float(m.group(1))
    m = re.search(r"Duration: (\d+):(\d+):(\d+(?:\.\d+)?)", text)
    if m:
        info["duration"] = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    info["has_audio"] = "Audio:" in text
    return info


def prepare(src: str, dst: str, width: int, height: int, frames: int, fps: int, pad: bool = False) -> None:
    """Re-encode src to exactly width x height, fps, and `frames` frames with an audio track.

    pad=False fills the canvas (scale up and center crop).
    pad=True fits the whole clip inside and pads with black (used by Go Vertical,
    where the outpainting LoRA paints the black bars).
    """
    duration = frames / float(fps)
    if pad:
        vf = (f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
              f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black")
    else:
        vf = f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height}"
    vf += f",fps={fps},format=yuv420p"
    args = [ffmpeg_bin(), "-y", "-loglevel", "error", "-i", src,
            "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
            "-filter_complex", f"[0:v]{vf}[v];[0:a?][1:a]amix=inputs=2:duration=first:dropout_transition=0[a]",
            "-map", "[v]", "-map", "[a]",
            "-t", f"{duration:.4f}", "-frames:v", str(frames),
            "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
            "-movflags", "+faststart", dst]
    try:
        _run(args)
    except RuntimeError:
        # Some sources make amix unhappy (no audio stream at all): plain silent track.
        args = [ffmpeg_bin(), "-y", "-loglevel", "error", "-i", src,
                "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
                "-vf", vf, "-map", "0:v:0", "-map", "1:a:0",
                "-t", f"{duration:.4f}", "-frames:v", str(frames),
                "-c:v", "libx264", "-preset", "fast", "-crf", "16", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", dst]
        _run(args)


def replace_audio(video: str, audio_from: str, dst: str) -> None:
    """Put the original clip's audio onto the generated video."""
    _run([ffmpeg_bin(), "-y", "-loglevel", "error", "-i", video, "-i", audio_from,
          "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
          "-shortest", "-movflags", "+faststart", dst])


def normalize_output(src: str, dst: str) -> None:
    """Make sure the result is a web-playable H.264 MP4 (phones and browsers)."""
    _run([ffmpeg_bin(), "-y", "-loglevel", "error", "-i", src,
          "-c:v", "libx264", "-preset", "fast", "-crf", "17", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", dst])


def before_after(before: str, after: str, dst: str, width: int, height: int) -> None:
    """Side by side share card: landscape clips stack vertically, portrait clips sit side by side."""
    if width >= height:
        fc = "[0:v]scale=960:-2[a];[1:v]scale=960:-2[b];[a][b]vstack=inputs=2[v]"
    else:
        fc = "[0:v]scale=-2:960[a];[1:v]scale=-2:960[b];[a][b]hstack=inputs=2[v]"
    _run([ffmpeg_bin(), "-y", "-loglevel", "error", "-i", before, "-i", after,
          "-filter_complex", fc, "-map", "[v]", "-map", "1:a?",
          "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-shortest", "-movflags", "+faststart", dst])


def poster(video: str, dst: str) -> None:
    _run([ffmpeg_bin(), "-y", "-loglevel", "error", "-i", video, "-frames:v", "1", "-q:v", "3", dst])


DEMO_FILTERS = {
    "splash": "hue=h=10:s=1.2,eq=brightness=-0.03:contrast=1.1",
    "nightfall": "eq=brightness=-0.35:contrast=1.25:saturation=0.7,colorbalance=bs=0.25:bm=0.12",
    "googly": "eq=saturation=1.4",
    "vanish": "gblur=sigma=6",
    "colorize": "eq=saturation=1.6",
    "restore": "unsharp=5:5:1.0,eq=contrast=1.15:saturation=1.2",
    "shave": "eq=brightness=0.04",
    "erase": "boxblur=4:1",
    "cleantext": "eq=contrast=1.05",
    "reframe": "eq=contrast=1.05",
}


def demo_render(src: str, dst: str, spell_id: str) -> None:
    """Demo mode stand-in (no model attached): a cheap color filter so the UI flow can be tested."""
    vf = DEMO_FILTERS.get(spell_id, "eq=contrast=1.05")
    _run([ffmpeg_bin(), "-y", "-loglevel", "error", "-i", src, "-vf", vf,
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
          "-c:a", "copy", "-movflags", "+faststart", dst])
