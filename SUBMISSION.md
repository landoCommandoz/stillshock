# Submission answers (draft, fill in on October 29)

Form: https://form.typeform.com/to/V1dSQrkS
Deadline: October 30, 9am PT. Our target: October 29, 9am PT.

## Known form fields (from a dry run of the form on October 23)

1. Name, Comfy app email, Country (required)
2. Social handles (X, IG, LI, TT, YT), Discord username, Reddit username
3. The rest of the form was not visible without filling the required fields. Expected,
   from the contest page: GitHub repo link, demo video link, a link to try it (optional),
   social post link with #OpenSourceHiggsfield, category choice, bonus track choice.

## Answers

- **Project name:** Spellclip
- **One line:** Drop a clip, pick a spell, get a share-ready VFX video. Ten open-weights LTX-2.3 video-to-video effects on ComfyUI, stackable, with a before/after split for sharing.
- **Repo:** https://github.com/landoCommandoz/repo-for-the-contest (rename pending)
- **Demo video:** TODO (link after October 28)
- **Try it:** TODO (optional deployed link)
- **Social post:** TODO (post the demo with #OpenSourceHiggsfield and paste the link)
- **Main category:** Best Overall (automatic). If a category pick is required: Most Viral.
- **Bonus track:** VFX Workflow Built with LTX. LTX-2.3 is the core and only video model.
- **Open weights only:** Yes. LTX-2.3 fp8 checkpoints, Lightricks IC-LoRAs, community LoRAs, Gemma 3 text encoder. No partner nodes, no closed APIs in the graph.
- **How it was built:** FastAPI server plus a plain HTML/JS front end. One API-format ComfyUI graph (core nodes only) built per spell from a JSON registry: LTX-2.3 checkpoint, spell LoRA, LTXVAddGuide with the user's clip as the IC-LoRA reference, distilled 8-step sampler. ffmpeg pre-sizes clips to 24 fps and 8n+1 frames, encodes results, and renders the split. Runs on Comfy Cloud through comfy-sdk, or on a local ComfyUI through REST.
- **Why innovative:** A registry-driven effects engine on top of IC-LoRA: adding a new effect is one JSON entry, not a new workflow. Spells chain, so results compose. The whole thing is core nodes, so it runs anywhere ComfyUI runs.
- **License:** MIT
