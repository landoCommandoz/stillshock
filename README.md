# Stillshock

**One still. One tap. A shock of VFX with sound.**

Stillshock turns a single photo into a 5 to 6 second vertical VFX clip with its own
generated sound. Pick one of twelve effects (Disintegrate, Liquid Metal, Levitate,
Confetti Burst, Lightning Strike, Deep Freeze, Inferno, Glitch, Zero-G Blast, Golden
Statue, Cloud Dive, Portal), tap Generate, download, post.

Built for Comfy's Open Source Higgsfield competition. Core video model: **LTX-2.5**
(open weights) running on ComfyUI. The whole stack is open weights: LTX-2.5 distilled
transformer, LTX video and audio VAEs, the Gemma 4 text encoder Lightricks ships with it,
and the LTX latent upscaler. No partner nodes, no closed APIs in the graph.

## What makes it different

- **Sound is generated in the same pass.** LTX-2.5 produces video and audio together, so
  every effect recipe describes its sound (thunder, confetti pops, crackling ice) and the
  clip arrives scored. Nothing is added in post.
- **Photo in, not video in.** Anyone has a photo. The input is center-cropped in the
  browser to the exact model size, so there is no upload of raw camera files and no
  distortion.
- **Core nodes only.** The graph is Comfy's own LTX-2.5 image-to-video template, exported
  to API format and validated on a stock ComfyUI. It runs on Comfy Cloud as is, and on any
  local ComfyUI with the six model files.
- **Bring your own key by default.** A deployed copy never spends the owner's credits.
  Visitors paste their own Comfy API key, which stays in their browser.

## How it works

```
photo  ->  browser center-crop to 704x1280 (or 960x960, 1280x704), JPEG
       ->  POST /api/jobs  ->  Comfy API v2: upload asset, submit workflow, poll
       ->  ComfyUI graph: LTX-2.5 I2V template, two-pass (half-res 8 steps, x2 latent
           upscale, 3 refine steps), joint audio, CreateVideo + SaveVideo (mp4, h264)
       ->  server caches the mp4 and serves it with byte ranges (plays on iPhone)
```

Files:

| Path | What |
|---|---|
| `app/server.mjs` | Node 22 HTTP server, zero dependencies. Static files plus the `/api` routes. |
| `app/lib/comfy.mjs` | Comfy API v2 client: assets, jobs, outputs, plain-English error mapping. |
| `app/lib/effects.mjs` | The twelve effect recipes (prompt, sound, duration) and output formats. |
| `app/lib/workflow.mjs` | Fills the API-format graph from `workflows/ltx25_i2v.map.json`. |
| `app/public/` | The web app: HTML, CSS, vanilla JS. Phone first. |
| `app/dev/mock-comfy.mjs` | A fake Comfy API so you can click through with no key and no GPU. |
| `workflows/ltx25_i2v.api.json` | The LTX-2.5 image-to-video graph in API format (49 nodes). |
| `workflows/ltx25_i2v.map.json` | Which node inputs the app sets: image, prompt, seed, size, duration. |
| `workflows/ltx25_flf2v.api.json`, `ltx25_t2v.api.json` | First+last frame and text-to-video exports, for extending the app. |
| `examples/` | Gallery clips and the manifest that feeds the Gallery tab. |
| `DEMO.md`, `SUBMISSION.md` | Demo video script and the contest form answers. |

## Quick start (under 10 minutes)

You need Node 22 or newer and git. Nothing else: there are no npm dependencies.

```bash
git clone https://github.com/landoCommandoz/stillshock
cd stillshock/app
npm start
```

Open http://localhost:3000. The app starts in **bring-your-own-key** mode: paste a Comfy
API key from https://platform.comfy.org (API Keys) into the key panel. Generations then
run on Comfy Cloud under your account. The key is stored in your browser only and is sent
with each request; the server never writes it anywhere.

To use one key for everyone on a private machine (your own laptop, a demo):

```bash
export COMFY_API_KEY=comfyui-...
export ALLOW_SERVER_KEY=1
npm start
```

Both flags are required on purpose. Without `ALLOW_SERVER_KEY=1` the server ignores
`COMFY_API_KEY`, so a public deploy can never spend the owner's credits by accident.

Gallery-only deploy (no generation at all): `KEY_MODE=examples npm start`.

### Try it with no key and no GPU

```bash
cd app
npm run mock          # fake Comfy API on http://127.0.0.1:8189
# in a second terminal
COMFY_BASE_URL=http://127.0.0.1:8189 KEY_MODE=server ALLOW_SERVER_KEY=1 COMFY_API_KEY=mock npm start
```

The full flow runs (upload, queue, progress, result, download) and returns a placeholder
clip from `app/dev/mock-output.mp4`. Set `MOCK_FAIL=1` on the mock to see the error state.

### Run on your own GPU instead of Comfy Cloud

Any ComfyUI that speaks API v2 works: a Comfy API deployment
(`https://<deployment>.run.comfy.app`) or a local ComfyUI behind
[comfy-api-proxy](https://docs.comfy.org/development/run-workflows/overview). Set
`COMFY_BASE_URL` to it. The six model files the graph needs:

| File | Folder |
|---|---|
| ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors | models/diffusion_models |
| gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot.safetensors | models/text_encoders |
| gemma4_e2b_it_int8_convrot.safetensors (optional, prompt enhancer, off by default) | models/text_encoders |
| ltx-2.5-video-vae-bf16.safetensors | models/vae |
| ltx-2.5-audio-vae-bf16.safetensors | models/vae |
| ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors | models/latent_upscale_models |

Downloads: https://huggingface.co/Lightricks/LTX-2.5 (accept the LTX-2.x Community
License first) and https://huggingface.co/Comfy-Org/gemma-4. Comfy's tutorial for this
template: https://docs.comfy.org/tutorials/video/ltx/ltx-2-5

To run the graph by hand: open ComfyUI, load `workflows/ltx25_i2v.api.json` (or the
`video_ltx2_5_i2v` template it came from), put your photo in `input/`, set the prompt from
`app/lib/effects.mjs`, and queue.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `KEY_MODE` | `byok` | `byok`, `server`, or `examples`. |
| `COMFY_API_KEY` | | Used only when `KEY_MODE=server` and `ALLOW_SERVER_KEY=1`. |
| `ALLOW_SERVER_KEY` | `0` | Must be `1` to let the server spend its own key. |
| `COMFY_BASE_URL` | `https://cloud.comfy.org` | Comfy Cloud, a deployment, or a local proxy. |
| `MAX_JOBS_PER_HOUR` | `20` | Per-visitor cap in server mode. |
| `PORT` | `3000` | |

## Adding an effect

Add one object to `EFFECTS` in `app/lib/effects.mjs`: an id, a name, a tagline, an
emoji, a duration in whole seconds, and a prompt that describes the motion, the camera,
the light, and the sound. That is the whole change. The app picks it up on restart.

## Limits and honest notes

- Comfy Cloud API access needs a Cloud subscription and credits on your own account.
- Each clip takes roughly 1 to 3 minutes on Cloud. The app polls and shows progress.
- Width and height are multiples of 64 (704x1280, 960x960, 1280x704) because the graph
  renders at half resolution and upsamples x2.
- Output assets on Comfy expire; the server keeps its own copy in `app/outputs/`.
- Sample photos in `app/public/samples/` come from picsum.photos (Unsplash license).

## License

MIT. See LICENSE. LTX-2.5 weights are under the LTX-2.x Community License from Lightricks.
