# Shot list for the five lead spells

All footage is Lando's own. Phone is fine. Record horizontal (16:9) unless the row says
otherwise, 1080p or 4K, 24 or 30 fps, 7 to 10 seconds each so there is room to trim to
the 5 to 7 seconds the app uses. Steady hands or lean on something. Good light, no
backlight. No music playing in the room. Shoot 3 takes per row and I pick the best.

Name files `spell_take.mp4` (for example `googly_1.mp4`) and put them in a Google
Drive folder called `spellclip-footage`, shared with view access, or upload them in the
GitHub app to `examples/raw/`. Keep each file under 25 MB if you use GitHub.

## 1. Googly Eyes (lead, viral)

| Take | Shot | Why |
|---|---|---|
| googly_1 | You, medium close-up, talking to camera for 8 s, slight head turns | Faces front and center is where the LoRA shines |
| googly_2 | Two or three people at a table, laughing, medium shot | Multiple faces at once is the share moment |
| googly_3 | A pet looking at camera, close, then it turns its head | Animals sell the effect too |

Rule: eyes clearly visible, no sunglasses, no hats shadowing the face, faces at least a
quarter of the frame height.

## 2. Go Vertical (lead, useful)

| Take | Shot | Why |
|---|---|---|
| vertical_1 | Wide landscape: beach, field or skyline, you walking across the frame | Sky above and ground below give the model easy things to extend |
| vertical_2 | City street, you walking toward camera, buildings on both sides | Shows it inventing more street above and below |
| vertical_3 | Slow pan across a scenic view, no people | Clean outpainting demo |

Rule: horizontal only. Keep the subject in the middle third. Avoid shots where the
missing top or bottom would need to invent a face or body.

## 3. Erase Object (lead, VFX)

| Take | Shot | Why |
|---|---|---|
| erase_1 | A table with one coffee cup in the foreground, you in the background doing something | One clear foreground object, simple background |
| erase_2 | A traffic cone or a bright bag on a sidewalk, slow walk past it | Moving camera, still object |
| erase_3 | A phone or a bottle on a desk, hands moving nearby but not touching it | Tests that the hands stay and the object goes |

Rule: the object must be clearly separate from people, not held, not covering a face,
and not filling the center of the frame. Name the object in plain words ("the coffee
cup").

## 4. Clean Text (lead, utility)

| Take | Shot | Why |
|---|---|---|
| text_1 | Any of your clips exported from your phone's editor with a caption burned in at the bottom | Subtitles removal |
| text_2 | Same clip with a fake watermark logo or text in a corner | Watermark removal |
| text_3 | A clip with big centered text over a face | Hard case, good for the demo |

Rule: if you would rather not add text yourself, send any clean clip and I burn in the
captions and watermark with ffmpeg in the session.

## 5. Restore (lead, VFX)

| Take | Shot | Why |
|---|---|---|
| restore_1 | Any sharp, colorful daytime clip of you or a place | I degrade it (grain, scratches, fade, blur, black and white) so Restore has something to fix, and the before/after is honest because the original is yours |
| restore_2 | A family video from an old phone or camera if you have one and everyone in it is fine with it | Real degraded footage |
| restore_3 | Optional: a public-domain clip from the Prelinger Archives on archive.org (public domain, reuse allowed) | Real archival look. Only if clearly marked public domain |

## Bonus, for the demo hero shot

One 10 second clip of you, medium shot, walking toward the camera on a street or in a
park, daylight. This single clip works for Googly Eyes, Go Vertical and Erase Object (put
a cup or cone in the foreground), so the demo can show spells stacking on one shot.
