# Comfy Cloud runbook: real Stillshock clips for $0

Comfy Cloud gives every new account 5 free runs on real GPUs with a 30 minute runtime cap and no card. The Stillshock graph is Comfy's own LTX-2.5 Image to Video template, so a run in the Cloud editor is the exact workflow the app submits. This runbook turns those free runs into example clips. If the contest signup credits landed in the account, keep going past five.

## Taps (iPad, Safari)

1. Open https://cloud.comfy.org and sign in with the Comfy account used for the contest signup.
2. Check the credit balance in the top right. Note it; it tells us whether the signup credits arrived.
3. Left sidebar: Templates. Search "LTX-2.5". Open "LTX-2.5: Image to Video". If Cloud offers to download models, accept; they are pre-installed on Cloud.
4. In the Load Image node, tap Upload and pick one of your photos (portrait orientation).
5. In the prompt box, select all and paste the prompt for the effect from the table below.
6. Set width 704, height 1280 (portrait), duration 6 (or 5 for Confetti and Glitch), frame rate 24. Leave the prompt enhancer off.
7. Tap Run. Wait 1 to 4 minutes. Tap the output video to preview, then the download icon. Save to Files.
8. Repeat for the next effect. Spend the five free runs on the demo set first: Lightning Strike, Disintegrate, Golden Statue, Confetti Burst, Portal.
9. Upload the clips to the shared Drive folder `stillshock-photos` (a subfolder `outputs`), or to `examples/raw/` in the GitHub app.

Each clip costs nothing until the free runs are used up. If a run fails with a credits message, stop and tell me; do not add a card.

## Prompts (paste exactly; the app builds these from app/lib/effects.mjs)

### Disintegrate (6 s)

```
Use the provided start image as the first frame. The scene holds still for a beat, then the subject begins to disintegrate from the edges inward into thousands of glowing embers and fine ash that drift away on a slow wind, revealing the background behind. The camera pushes in slowly. Warm backlight catches the particles. Sound: a low rising wind, soft crackling embers, a final airy whoosh as the last particles scatter. Photorealistic, cinematic lighting, consistent subject identity, smooth motion. No text, no captions, no black frames, no watermarks.
```

### Liquid Metal (6 s)

```
Use the provided start image as the first frame. A ripple of liquid chrome spreads across the subject from the top down, turning every surface into flowing mirror-polished metal that reflects the surroundings, with slow dripping highlights. The camera orbits a few degrees to catch the reflections. Cool studio light with sharp specular highlights. Sound: a smooth metallic shimmer, slow viscous drips, a deep resonant hum. Photorealistic, cinematic lighting, consistent subject identity, smooth motion. No text, no captions, no black frames, no watermarks.
```

### Levitate (6 s)

```
Use the provided start image as the first frame. The subject slowly lifts off the ground and hovers, hair and loose fabric drifting upward as if gravity switched off, small objects nearby rising and turning gently in the air. The camera tilts up slightly and drifts around the subject. Soft dust motes glow in a beam of light. Sound: a soft ethereal hum, faint wind chimes, a gentle low pulse. Photorealistic, cinematic lighting, consistent subject identity, smooth motion. No text, no captions, no black frames, no watermarks.
```

### Confetti Burst (5 s)

```
Use the provided start image as the first frame. A sudden burst of colorful confetti and gold streamers explodes from both sides of the frame and rains down in slow motion over the subject, who reacts with a joyful smile and a small celebratory move. The camera gives a quick punch-in then settles. Bright festive lighting. Sound: two loud confetti cannon pops, a crowd cheering, upbeat party ambience. Photorealistic, cinematic lighting, consistent subject identity, smooth motion. No text, no captions, no black frames, no watermarks.
```

### Lightning Strike (6 s)

```
Use the provided start image as the first frame. The sky darkens as storm clouds roll in fast, wind whips through the scene, then a massive bolt of lightning strikes right behind the subject with a blinding white flash that lights everything for an instant, sparks and rain following. The camera shakes slightly on impact. Sound: rising wind and rain, a sharp electric crack, a deep rolling thunder that fades out. Photorealistic, cinematic lighting, consistent subject identity, smooth motion. No text, no captions, no black frames, no watermarks.
```

### Deep Freeze (6 s)

```
Use the provided start image as the first frame. Frost spreads across the scene in branching ice crystals, starting from the corners and creeping over every surface until the subject is coated in glittering ice, breath fogging in the cold, snowflakes beginning to fall. The camera pushes in slowly. Cold blue light with sparkling highlights. Sound: delicate crackling ice forming, a cold wind, a crystalline shimmer. Photorealistic, cinematic lighting, consistent subject identity, smooth motion. No text, no captions, no black frames, no watermarks.
```

### Inferno (6 s)

```
Use the provided start image as the first frame. Flames ignite at the bottom of the frame and climb upward around the subject, orange and gold fire with drifting sparks and heat shimmer, the subject lit by flickering firelight but unharmed, embers floating past the camera. The camera pulls back slightly as the fire grows. Sound: a deep roar of fire, crackling and popping, a rush of hot wind. Photorealistic, cinematic lighting, consistent subject identity, smooth motion. No text, no captions, no black frames, no watermarks.
```

### Glitch (5 s)

```
Use the provided start image as the first frame. The image begins to glitch: horizontal scanline tears, RGB color channels split and drift apart, blocks of pixels stutter and freeze, the subject jitters between positions like a corrupted video signal, then it snaps back clean with a flash. The camera stays locked. Sound: harsh digital static bursts, stuttering buffer clicks, an electric zap when it resolves. Photorealistic, cinematic lighting, consistent subject identity, smooth motion. No text, no captions, no black frames, no watermarks.
```

### Zero-G Blast (6 s)

```
Use the provided start image as the first frame. A silent shockwave ripples outward from the subject and everything loose in the scene bursts outward in extreme slow motion, debris, dust, fabric and small objects suspended and tumbling in the air while the subject stays calm at the center. The camera orbits slowly around the frozen explosion. Dramatic rim lighting. Sound: a muffled deep boom, a slow-motion whoosh, a tense low drone. Photorealistic, cinematic lighting, consistent subject identity, smooth motion. No text, no captions, no black frames, no watermarks.
```

### Golden Statue (6 s)

```
Use the provided start image as the first frame. A wave of shimmering gold sweeps over the subject from the feet up, turning skin, clothing and hair into polished solid gold with soft reflections, the background dimming to a dark museum gallery with a single spotlight. The camera slowly circles the golden figure. Sound: a rising magical chime, a resonant golden ring, hushed gallery ambience. Photorealistic, cinematic lighting, consistent subject identity, smooth motion. No text, no captions, no black frames, no watermarks.
```

### Cloud Dive (6 s)

```
Use the provided start image as the first frame. The camera pulls back and rises rapidly away from the subject, up through a layer of soft white clouds, the scene below shrinking as sunlight breaks through, ending high above the clouds in a bright golden sky. Smooth continuous camera motion. Sound: a rushing wind that builds then softens, airy high altitude ambience, a warm uplifting swell. Photorealistic, cinematic lighting, consistent subject identity, smooth motion. No text, no captions, no black frames, no watermarks.
```

### Portal (6 s)

```
Use the provided start image as the first frame. A glowing ring of blue-violet energy opens behind the subject, swirling light and sparks spinning inside it, wind pulling hair and loose objects toward the portal as its light washes over the scene, the subject glances back at it. The camera slowly pushes toward the portal. Sound: a deep swirling hum, crackling energy, a rising whoosh of suction. Photorealistic, cinematic lighting, consistent subject identity, smooth motion. No text, no captions, no black frames, no watermarks.
```

Optional: prefix any prompt with `The photo shows: <one line about your photo>. ` to help the model keep the subject.

Negative prompt stays as the template default: `pc game, console game, video game, cartoon, childish, ugly`.
