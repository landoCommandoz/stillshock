# Status log

## October 23 (session 1)
- Read the live contest page including every collapsed section. Notes in docs/CONTEST_RULES.md.
- Picked the app: Spellclip, one-tap VFX spells on LTX-2.3 video-to-video IC-LoRAs. Shortlist option 1 (Open Effects) won because LTX ships purpose-built VFX adapters (water, day-to-night, clean plate, outpaint), which makes the LTX VFX bonus a straight fit and keeps every result reliable.
- Checked the field: public entries so far rebuild Openjutsu and Cinematic Studio. Nothing does stackable one-tap VFX effects.
- Built the registry (10 spells), the graph builder, exported 10 API-format workflows, and validated all of them against a CPU-only ComfyUI (every node and input accepted).
- Built the server (Cloud, local, demo backends), the web UI, and tested the full flow with Playwright at phone, tablet and desktop widths.

## October 23 (session 1, part 2)
- Lando's calls: identity first (strengths as hard as the model cards allow without warping faces), exact duplicates collapse into the existing job, lead with the five cloud-ready spells, other five ship as local-GPU spells, own footage only.
- Implemented: availability per backend, duplicate collapsing by clip hash plus settings, UI groups, shot list in docs/SHOTLIST.md.

## Waiting on
- COMFY_API_KEY in the cloud environment (expected around October 24).
- Confirmation of which plan the Cloud account is on (LoRA import needs Creator or above).

## Next
- October 24 to 26: first real output end to end, check LoadVideo asset upload through the SDK, import the Lightricks LoRAs into Cloud, tune strengths per spell, example gallery.
- October 27: polish, 10+ examples, README check from a clean clone.
- October 28: demo video. October 29: SUBMISSION.md final, Lando submits.
