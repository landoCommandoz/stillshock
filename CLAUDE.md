# Open Source Higgsfield entry: mission brief for Claude Code (cloud)

You're building my (Lando's) entry for Comfy's Open Source Higgsfield competition. Read this whole file before doing anything.

## Where you're running
You're a Claude Code cloud session on Anthropic's servers, with no GPU. I'm on an iPad: I can't run commands, edit files, or use a terminal. Anything I need to do has to be taps on a website or app, spelled out step by step.

## First move
Rename this file to `CLAUDE.md` in the repo root, then commit and push to `main`.

## The contest (checked October 22, 2026; reread the live page first, and the page wins any conflict)
- Page: https://comfy.org/open-source-higgsfield/
- Hard deadline: October 30, 9am PT. Our deadline: everything ready by October 29, 9am PT.
- Main prizes: Best Overall is $10,000 and every entry is considered. Most Innovative, Most Viral, and Open Weights Only each win a GeForce RTX 5090. Ten runner-ups get $250 in Comfy credits.
- Bonus prizes: a VFX workflow built with LTX wins $2,000 cash (LTX must be the core video model). FLUX 3 and MiniMax H3 bonuses pay in API credits.
- Each entry is eligible for one main category and one model-provider bonus.
- Must be built with ComfyUI. It can run locally, on Comfy Cloud, the Developer Platform, Router, the SDK, or any mix.
- The repo needs an open-source license and setup instructions good enough for a stranger to run it.
- An entry is a working app with a usable interface, example outputs, the repo, and a short demo video (confirm the required length on the page).
- Lawful, SFW, no unlicensed IP or likenesses. Keep Higgsfield's name, logos, and style names out of the app's name and UI.
- The page has collapsed sections (App requirements, Prepare your submission, Q&A). Open them with Playwright and read every word before building.
- I've already signed up. Submit form: https://form.typeform.com/to/V1dSQrkS

## Strategy
Aim for Best Overall plus the $2,000 LTX VFX bonus. If it costs no quality, keep the whole stack open weights so the entry also qualifies for Open Weights Only.

That means a VFX app with LTX as the core video model, simple enough that anyone makes something shareable in one click.

Don't rebuild what Comfy already showcases on comfy.org/hub/apps (Cinematic Studio, Reshoot, Openjutsu). Check recent public entries too, so we're not the fifth copy of anything.

Shortlist. Pick one in the first hour, based on what LTX does best right now:
1. Open Effects: drop in a photo or clip, pick an effect (disintegrate, liquid metal, levitate, confetti burst), get a 5 to 8 second vertical clip ready to post. Built for Most Viral.
2. Restyle Studio: turn your own video into a look (claymation, knitted yarn, toy CGI, anime) while keeping the motion.
3. Beat Video: upload a song clip and a selfie video, get a beat-synced stylized music video.

Pick the one with the best wow per click that you can make reliable by October 28.

## How we work
- Commit and push straight to `main` every day, so the public repo always shows the latest working version.
- In this session `gh pr` and `gh issue` don't work. Use `gh api` REST calls when you need GitHub.
- Don't ask permission for routine coding decisions. Stop only for spending money.
- `COMFY_API_KEY` will come from the cloud environment once I have one. Never print it, write it into files, or commit it. Never ask me to paste any key into chat.
- No em dashes in anything you write: README, video captions, form answers, messages to me.
- If we start late, compress the timeline but keep October 29 as submit day.

## Compute and money
- There's no GPU here, so generation runs through Comfy Cloud or Comfy Router using `COMFY_API_KEY`.
- I hear back about the contest's free signup credits around October 24. Until the key is in, build everything that doesn't need generation: rules, app choice, UI, workflow files, README, demo script.
- Never spend money without asking me first, and tell me the exact cost.

## Timeline
- Oct 22 to 23: read the rules, pick the app and an original name, scaffold the repo and UI, draft the ComfyUI workflow.
- Oct 24 to 26: once the key is in, get one output working end to end, then finish the app. Web UI: upload, pick, generate, preview, download. Phone-friendly. Plain-English errors and a progress indicator.
- Oct 27: polish. Generate 10+ strong example outputs for a gallery. README with setup steps that work from a clean clone in under 15 minutes. License (MIT or Apache 2.0). ComfyUI workflow JSON files in the repo.
- Oct 28: demo video. Install Playwright and ffmpeg in the session, write a tight script, drive the app with Playwright while recording the screen, add captions, and cut it with ffmpeg. Show the app working and explain why it's innovative (Most Innovative requires that). Save the script in DEMO.md in case I want to add a voiceover.
- Oct 29: write SUBMISSION.md with every form answer ready to paste. I submit from my iPad. Rest of the day is buffer for anything that broke.

## Repo layout
```
<app-name>/
  CLAUDE.md
  README.md
  LICENSE
  app/          (the web app)
  workflows/    (ComfyUI workflow JSON)
  examples/     (gallery of outputs)
  DEMO.md       (video script)
  SUBMISSION.md (form answers)
```
The public repo already exists under a placeholder name. Once you pick the app's name, give me the taps to rename the repo in its GitHub settings.

## Lando only (end every session with this list, short and plain)
- Add `COMFY_API_KEY` to the Claude Code cloud environment once I have one.
- Rename the repo when you give me the name.
- Optional: record a voiceover from DEMO.md.
- Press submit on the form on October 29.

## Done means
- Public repo with a license and a README that works from a clean clone.
- 10+ example outputs.
- Demo video file in the repo or linked from it.
- SUBMISSION.md complete, and the entry submitted by October 29.
