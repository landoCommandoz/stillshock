# Submission answers (draft; finalize October 29)

Form: https://form.typeform.com/to/V1dSQrkS
Deadline: October 30, 9am PT. Our target: October 29, 9am PT.

## Form fields and answers

- **Name:** Landon Brewington
- **Comfy app email:** the email on the Comfy account (Lando fills in)
- **Country:** United States
- **Social handles / Discord / Reddit:** Lando fills in
- **How familiar were you with ComfyUI before this challenge:** Lando picks
- **Project name:** Stillshock
- **One-line description (100 characters max):** One photo, one tap: a vertical VFX clip with generated sound, on open-weights LTX-2.5.
- **GitHub repo URL:** https://github.com/landoCommandoz/stillshock (after the rename; currently repo-for-the-contest)
- **Demo video URL:** TODO after October 28
- **Live link to try it (optional, judges expect 5 to 10 runs):** TODO. If deployed, it runs in bring-your-own-key mode or examples-only mode. Judges would need their own Comfy key, so the README's 10-minute local setup is the primary way to try it.
- **Social post link (#OpenSourceHiggsfield):** TODO. Lando posts the demo video and pastes the link.
- **Which parts of ComfyUI did you use:** Comfy API (API v2 jobs and assets), Comfy Cloud
- **List all generative models used:** LTX-2.5 22B distilled (Lightricks, open weights), with its video VAE, audio VAE, latent spatial upscaler, and Gemma 4 12B text encoder
- **Other tools or techniques used:** Comfy's core LTX-2.5 image-to-video template exported to API format and validated on a stock ComfyUI; two-pass sampling with x2 latent upscale; joint audio generation; effect recipes with sound design in the prompt; browser-side center crop to model size; bring-your-own-key server design; Node 22 server with zero dependencies; mock Comfy API for development.
- **Category:** VFX Built with LTX Bonus, plus Most Viral as the main category pick (Best Overall is automatic). Also eligible for Open Weights Only.
- **Is your stack fully open:** Yes. Every model, node and dependency is open weights or open source. Rented GPU through Comfy Cloud.
- **Agreements:** repo public with MIT license; lawful, SFW, no unlicensed IP or real likenesses without permission (every example photo was shot by Lando himself; the three placeholder samples in the app show a dog, strawberries and a landscape, no people); permission to feature with credit; only submission.
- **Anything else:** The sound is generated in the same pass as the video. Adding an effect is one JSON entry. The deployed copy cannot spend the owner's credits by design.

## Social post caption (Lando posts before submitting)

> One photo. One tap. A VFX clip with its own sound. Stillshock is open source, built on ComfyUI and open-weights LTX-2.5, and runs in ten minutes from a clean clone. Demo and repo below. #OpenSourceHiggsfield #ComfyUI #LTX

Attach the demo video. Add the repo link in the first reply if the platform truncates.
