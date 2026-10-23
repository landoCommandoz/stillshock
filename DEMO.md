# Demo video script (two minutes max per the contest page; target 95 seconds)

Screen recording of the real app driven by Playwright, captions burned in with ffmpeg.
Lando can record a voiceover from the right-hand column. No Higgsfield branding anywhere.

| Time | On screen | Caption / voiceover |
|---|---|---|
| 0:00 | Phone frame. Stillshock hero. A photo gets dropped in and center-crops to 9:16. | "Stillshock. One still. One tap. A shock of VFX with sound." |
| 0:08 | Effect grid, Lightning Strike selected, Generate. | "Twelve effects. Each one is a recipe for LTX-2.5: the motion, the camera, the light, and the sound." |
| 0:16 | Progress bar, then the clip plays. Unmute. Thunder. | "The sound is not added afterwards. LTX-2.5 generates video and audio in the same pass, so every clip arrives scored." |
| 0:30 | Download, Copy caption, Share buttons. | "Download, caption, share. Vertical by default." |
| 0:36 | Fast montage of real outputs: Disintegrate, Confetti, Golden Statue, Portal, Cloud Dive. | "Same photo, five effects." |
| 0:52 | ComfyUI editor with the graph loaded. Point at the subgraph, the two-pass sampler, the audio VAE. | "How it is built: Comfy's own LTX-2.5 image-to-video template, exported to API format. Core nodes only, so it runs on Comfy Cloud or any local ComfyUI." |
| 1:05 | Code: effects.mjs with one recipe highlighted. | "Why it is innovative: effects are prompt recipes with sound design baked in, not LoRAs or custom nodes. Adding an effect is one JSON entry. The browser crops the photo to the model size, and visitors bring their own key, so a public copy never spends the owner's credits." |
| 1:22 | README, LICENSE, workflows folder on GitHub. | "MIT licensed. Workflows included. Node 22, zero dependencies, running in under ten minutes." |
| 1:30 | Logo card. | "Stillshock. Built with ComfyUI and LTX-2.5. #OpenSourceHiggsfield" |

## Production notes

- Record phone shots at 390x844 and desktop shots at 1440x900 with Playwright video recording.
- Use real outputs from `examples/` for the montage.
- Record against Comfy Cloud in server mode on this machine only (never deploy that mode).
- Captions: white Sora on a dark bar, bottom third, 24px at 1080p.
