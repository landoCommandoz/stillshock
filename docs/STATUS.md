# Status log

## October 23 (session 1)
- Read the live contest page, every collapsed section, and the submit form fields. Notes in docs/CONTEST_RULES.md.
- Two sessions ran the mission in parallel. The other built Spellclip (LTX-2.3 video-to-video spells); it is preserved on the `spellclip` branch. Lando chose Stillshock to continue.
- Picked the app: Stillshock, photo to VFX clip with generated sound on LTX-2.5 image-to-video. Reasons: core Cloud template (no LoRA imports, no plan upgrade beyond API access), no existing entry does photo-to-VFX, sound in the same pass is the hook.
- Exported the LTX-2.5 I2V, FLF2V and T2V templates to API format from a real ComfyUI 0.42 and validated them (POST /prompt 200, no node errors).
- Built the server (Comfy API v2, byok by default), twelve effect recipes, the web UI, a mock Comfy API, and ran the full flow with Playwright on phone and desktop. Zero console errors. Byte-range video serving confirmed for iPhone playback.

## October 23 (session 2, takeover)
- Lando: Stillshock is the entry. Spellclip is parked on the `spellclip` branch. This session owns the contest repo from here.
- Re-validated all three LTX-2.5 graphs on a fresh CPU ComfyUI (PASS). Re-ran the mock flow under Playwright at phone and desktop: zero console errors, byte-range output serving confirmed.
- Removed the stock portrait sample (a real person's face). Samples are now dog, strawberries, landscape. Lando shoots the example photos himself per docs/PHOTOLIST.md.
- README clone URL now points at the repo's current name so a clean clone works before the rename.

## October 25
- Hard rule from Lando: zero spend. No paid plans, no paid compute.
- Research: Comfy Cloud free tier is 5 GPU runs per new account, 30 minute cap, no card; API access needs a paid plan. Contest email campaign is tagged FreeCredit but no credit notice reached the inbox; balance to be checked in the Cloud UI. Kaggle (2x T4, about 30 GPU hours a week, no card) could run LTX-2.5 distilled GGUF Q4 with heavy risk on a 16 GB fp16-only card.
- Wrote docs/CLOUD_RUNBOOK.md: taps and the exact 12 prompts to run the app's own LTX-2.5 I2V template on Comfy Cloud's free runs.

## Waiting on
- COMFY_API_KEY in the cloud environment (expected around October 24) and confirmation that Cloud API access is active on the account.

## Next
- October 24 to 26: first real clip end to end, tune each recipe's prompt and strength, confirm asset upload and output download against Cloud.
- October 27: 10+ example clips in examples/, README check from a clean clone.
- October 28: demo video per DEMO.md. October 29: SUBMISSION.md final, Lando posts and submits.
