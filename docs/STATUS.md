# Status log

## October 23 (session 1)
- Read the live contest page, every collapsed section, and the submit form fields. Notes in docs/CONTEST_RULES.md.
- Two sessions ran the mission in parallel. The other built Spellclip (LTX-2.3 video-to-video spells); it is preserved on the `spellclip` branch. Lando chose Stillshock to continue.
- Picked the app: Stillshock, photo to VFX clip with generated sound on LTX-2.5 image-to-video. Reasons: core Cloud template (no LoRA imports, no plan upgrade beyond API access), no existing entry does photo-to-VFX, sound in the same pass is the hook.
- Exported the LTX-2.5 I2V, FLF2V and T2V templates to API format from a real ComfyUI 0.42 and validated them (POST /prompt 200, no node errors).
- Built the server (Comfy API v2, byok by default), twelve effect recipes, the web UI, a mock Comfy API, and ran the full flow with Playwright on phone and desktop. Zero console errors. Byte-range video serving confirmed for iPhone playback.

## Waiting on
- COMFY_API_KEY in the cloud environment (expected around October 24) and confirmation that Cloud API access is active on the account.

## Next
- October 24 to 26: first real clip end to end, tune each recipe's prompt and strength, confirm asset upload and output download against Cloud.
- October 27: 10+ example clips in examples/, README check from a clean clone.
- October 28: demo video per DEMO.md. October 29: SUBMISSION.md final, Lando posts and submits.
