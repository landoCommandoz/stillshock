"""Builds the ComfyUI API-format graph for one spell.

Every spell is the same LTX-2.3 video-to-video IC-LoRA graph with a different
LoRA file, strength, prompt and base checkpoint. Only core ComfyUI nodes are
used, so the graph runs on Comfy Cloud and on a stock local ComfyUI with no
custom node packs.

Node ids are fixed strings so the server (and the Comfy SDK) can set inputs
by id: "1" is the video input, "27" is the output node.
"""
from __future__ import annotations

import json
import os
from typing import Any

HERE = os.path.dirname(os.path.abspath(__file__))

# Distilled 8-step schedule published by Lightricks for LTX-2.3.
DISTILLED_SIGMAS = "1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0"

NODE_VIDEO_IN = "1"
NODE_LORA = "7"
NODE_POSITIVE = "9"
NODE_NEGATIVE = "10"
NODE_LATENT = "12"
NODE_SEED = "17"
NODE_OUTPUT = "27"


def load_registry(path: str | None = None) -> dict[str, Any]:
    with open(path or os.path.join(HERE, "spells.json"), "r", encoding="utf-8") as f:
        return json.load(f)


def get_spell(registry: dict[str, Any], spell_id: str) -> dict[str, Any]:
    for s in registry["spells"]:
        if s["id"] == spell_id:
            return s
    raise KeyError(f"unknown spell: {spell_id}")


def render_prompt(spell: dict[str, Any], variant_id: str | None, scene: str, obj: str) -> str:
    """Fill the spell's prompt template. Missing fields fall back to neutral text."""
    fields = {"scene": scene.strip() or "the scene", "object": obj.strip() or "object"}
    variant = None
    if spell.get("variants"):
        variant = next((v for v in spell["variants"] if v["id"] == variant_id), spell["variants"][0])
        for k, v in variant.items():
            if k not in ("id", "name"):
                fields[k] = v
    text = spell["prompt"]
    for k, v in fields.items():
        text = text.replace("{" + k + "}", v)
    return text.strip()


def build_graph(
    registry: dict[str, Any],
    spell_id: str,
    *,
    width: int,
    height: int,
    frames: int,
    seed: int,
    positive: str,
    negative: str | None = None,
    video_file: str = "input.mp4",
    lora_strength: float | None = None,
    filename_prefix: str = "spellclip/clip",
) -> dict[str, Any]:
    """Return the API-format prompt dict for one spell."""
    spell = get_spell(registry, spell_id)
    bases = registry["base_models"]
    base = bases[spell.get("base", "distilled")]
    fps = registry.get("fps", 24)
    if width % 32 or height % 32:
        raise ValueError("width and height must be multiples of 32")
    if (frames - 1) % 8:
        raise ValueError("frames must be 8n+1 (97, 121, 169 ...)")

    g: dict[str, Any] = {}

    def node(nid: str, cls: str, title: str, **inputs: Any) -> None:
        g[nid] = {"class_type": cls, "inputs": inputs, "_meta": {"title": title}}

    node(NODE_VIDEO_IN, "LoadVideo", "Your clip", file=video_file)
    node("2", "GetVideoComponents", "Frames + audio", video=["1", 0])
    node("3", "CheckpointLoaderSimple", "LTX-2.3 checkpoint", ckpt_name=base["checkpoint"])
    node("4", "LTXAVTextEncoderLoader", "Gemma text encoder",
         text_encoder=bases["text_encoder"], ckpt_name=base["checkpoint"], device="default")
    node("5", "LTXVAudioVAELoader", "Audio VAE", ckpt_name=base["checkpoint"])

    model_ref = ["3", 0]
    if base.get("distilled_lora"):
        node("6", "LoraLoaderModelOnly", "Distilled LoRA (dev base)",
             model=model_ref, lora_name=base["distilled_lora"],
             strength_model=float(spell.get("distilled_lora_strength", base.get("distilled_lora_strength", 0.5))))
        model_ref = ["6", 0]

    node(NODE_LORA, "LoraLoaderModelOnly", f"Spell LoRA: {spell['name']}",
         model=model_ref, lora_name=spell["lora"],
         strength_model=float(lora_strength if lora_strength is not None else spell["lora_strength"]))
    node("8", "GetICLoRAParameters", "IC-LoRA parameters", iclora_model=[NODE_LORA, 0])

    node(NODE_POSITIVE, "CLIPTextEncode", "Positive prompt", text=positive, clip=["4", 0])
    node(NODE_NEGATIVE, "CLIPTextEncode", "Negative prompt",
         text=(negative if negative is not None else spell.get("negative", "")), clip=["4", 0])
    node("11", "LTXVConditioning", "Frame rate conditioning",
         positive=[NODE_POSITIVE, 0], negative=[NODE_NEGATIVE, 0], frame_rate=float(fps))

    node(NODE_LATENT, "EmptyLTXVLatentVideo", "Empty video latent",
         width=width, height=height, length=frames, batch_size=1)
    node("13", "LTXVEmptyLatentAudio", "Empty audio latent",
         frames_number=frames, frame_rate=float(fps), batch_size=1, audio_vae=["5", 0])

    node("14", "ImageScale", "Fit frames to canvas",
         image=["2", 0], upscale_method="lanczos", width=width, height=height, crop="center")
    node("15", "LTXVAddGuide", "Reference video guide (IC-LoRA)",
         positive=["11", 0], negative=["11", 1], vae=["3", 2], latent=[NODE_LATENT, 0],
         image=["14", 0], frame_idx=0, strength=1.0, iclora_parameters=["8", 0])
    node("16", "LTXVConcatAVLatent", "Join video + audio latent",
         video_latent=["15", 2], audio_latent=["13", 0])

    node(NODE_SEED, "RandomNoise", "Seed", noise_seed=int(seed))
    node("18", "KSamplerSelect", "Sampler", sampler_name="euler_ancestral")
    node("19", "ManualSigmas", "Distilled sigmas", sigmas=DISTILLED_SIGMAS)
    node("20", "CFGGuider", "Guider", model=[NODE_LORA, 0], positive=["15", 0], negative=["15", 1], cfg=1.0)
    node("21", "SamplerCustomAdvanced", "Sample",
         noise=[NODE_SEED, 0], guider=["20", 0], sampler=["18", 0], sigmas=["19", 0], latent_image=["16", 0])

    node("22", "LTXVSeparateAVLatent", "Split video + audio latent", av_latent=["21", 0])
    node("23", "LTXVCropGuides", "Drop guide frames", positive=["15", 0], negative=["15", 1], latent=["22", 0])
    node("24", "VAEDecodeTiled", "Decode video", samples=["23", 2], vae=["3", 2],
         tile_size=768, overlap=64, temporal_size=4096, temporal_overlap=64)
    node("25", "LTXVAudioVAEDecode", "Decode audio", samples=["22", 1], audio_vae=["5", 0])
    node("26", "CreateVideo", "Assemble video", images=["24", 0], fps=float(fps), audio=["25", 0])
    node(NODE_OUTPUT, "SaveVideo", "Save result", video=["26", 0], filename_prefix=filename_prefix,
         format="mp4", **{"format.codec": "h264"})
    return g


def required_models(registry: dict[str, Any], spell_id: str) -> list[dict[str, str]]:
    """Model files this spell needs, with folder and download link."""
    spell = get_spell(registry, spell_id)
    bases = registry["base_models"]
    base = bases[spell.get("base", "distilled")]
    out = [
        {"file": base["checkpoint"], "folder": "models/checkpoints", "url": base["checkpoint_url"]},
        {"file": bases["text_encoder"], "folder": "models/text_encoders", "url": bases["text_encoder_url"]},
    ]
    if base.get("distilled_lora"):
        out.append({"file": base["distilled_lora"], "folder": "models/loras", "url": base["distilled_lora_url"]})
    out.append({"file": spell["lora"], "folder": "models/loras", "url": spell["lora_url"]})
    return out
