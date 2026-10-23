// Effect recipes for Stillshock.
// Each recipe is a prompt engineered for LTX-2.5 image-to-video with joint audio.
// The start image is always the user's photo. "sound" becomes part of the prompt so the
// model scores the clip itself. Keep prompts concrete: motion, camera, light, sound, ending.

const COMMON_TAIL = 'Photorealistic, cinematic lighting, consistent subject identity, smooth motion. No text, no captions, no black frames, no watermarks.';

export const EFFECTS = [
    {
        id: 'disintegrate',
        name: 'Disintegrate',
        tagline: 'Turn to ash and blow away',
        emoji: '🌪️',
        duration: 6,
        prompt: 'Use the provided start image as the first frame. The scene holds still for a beat, then the subject begins to disintegrate from the edges inward into thousands of glowing embers and fine ash that drift away on a slow wind, revealing the background behind. The camera pushes in slowly. Warm backlight catches the particles. Sound: a low rising wind, soft crackling embers, a final airy whoosh as the last particles scatter.',
    },
    {
        id: 'liquid-metal',
        name: 'Liquid Metal',
        tagline: 'Chrome melt with mirror reflections',
        emoji: '🪞',
        duration: 6,
        prompt: 'Use the provided start image as the first frame. A ripple of liquid chrome spreads across the subject from the top down, turning every surface into flowing mirror-polished metal that reflects the surroundings, with slow dripping highlights. The camera orbits a few degrees to catch the reflections. Cool studio light with sharp specular highlights. Sound: a smooth metallic shimmer, slow viscous drips, a deep resonant hum.',
    },
    {
        id: 'levitate',
        name: 'Levitate',
        tagline: 'Float up, hair and objects rising',
        emoji: '🪐',
        duration: 6,
        prompt: 'Use the provided start image as the first frame. The subject slowly lifts off the ground and hovers, hair and loose fabric drifting upward as if gravity switched off, small objects nearby rising and turning gently in the air. The camera tilts up slightly and drifts around the subject. Soft dust motes glow in a beam of light. Sound: a soft ethereal hum, faint wind chimes, a gentle low pulse.',
    },
    {
        id: 'confetti',
        name: 'Confetti Burst',
        tagline: 'Party cannon, cheer, celebration',
        emoji: '🎉',
        duration: 5,
        prompt: 'Use the provided start image as the first frame. A sudden burst of colorful confetti and gold streamers explodes from both sides of the frame and rains down in slow motion over the subject, who reacts with a joyful smile and a small celebratory move. The camera gives a quick punch-in then settles. Bright festive lighting. Sound: two loud confetti cannon pops, a crowd cheering, upbeat party ambience.',
    },
    {
        id: 'lightning',
        name: 'Lightning Strike',
        tagline: 'Storm rolls in, thunder cracks',
        emoji: '⚡',
        duration: 6,
        prompt: 'Use the provided start image as the first frame. The sky darkens as storm clouds roll in fast, wind whips through the scene, then a massive bolt of lightning strikes right behind the subject with a blinding white flash that lights everything for an instant, sparks and rain following. The camera shakes slightly on impact. Sound: rising wind and rain, a sharp electric crack, a deep rolling thunder that fades out.',
    },
    {
        id: 'freeze',
        name: 'Deep Freeze',
        tagline: 'Ice crystals spread, breath fogs',
        emoji: '❄️',
        duration: 6,
        prompt: 'Use the provided start image as the first frame. Frost spreads across the scene in branching ice crystals, starting from the corners and creeping over every surface until the subject is coated in glittering ice, breath fogging in the cold, snowflakes beginning to fall. The camera pushes in slowly. Cold blue light with sparkling highlights. Sound: delicate crackling ice forming, a cold wind, a crystalline shimmer.',
    },
    {
        id: 'inferno',
        name: 'Inferno',
        tagline: 'Flames rise from the ground up',
        emoji: '🔥',
        duration: 6,
        prompt: 'Use the provided start image as the first frame. Flames ignite at the bottom of the frame and climb upward around the subject, orange and gold fire with drifting sparks and heat shimmer, the subject lit by flickering firelight but unharmed, embers floating past the camera. The camera pulls back slightly as the fire grows. Sound: a deep roar of fire, crackling and popping, a rush of hot wind.',
    },
    {
        id: 'glitch',
        name: 'Glitch',
        tagline: 'Digital tear, RGB split, static',
        emoji: '📺',
        duration: 5,
        prompt: 'Use the provided start image as the first frame. The image begins to glitch: horizontal scanline tears, RGB color channels split and drift apart, blocks of pixels stutter and freeze, the subject jitters between positions like a corrupted video signal, then it snaps back clean with a flash. The camera stays locked. Sound: harsh digital static bursts, stuttering buffer clicks, an electric zap when it resolves.',
    },
    {
        id: 'zero-g-blast',
        name: 'Zero-G Blast',
        tagline: 'Slow-motion explosion outward',
        emoji: '💥',
        duration: 6,
        prompt: 'Use the provided start image as the first frame. A silent shockwave ripples outward from the subject and everything loose in the scene bursts outward in extreme slow motion, debris, dust, fabric and small objects suspended and tumbling in the air while the subject stays calm at the center. The camera orbits slowly around the frozen explosion. Dramatic rim lighting. Sound: a muffled deep boom, a slow-motion whoosh, a tense low drone.',
    },
    {
        id: 'golden-statue',
        name: 'Golden Statue',
        tagline: 'Turn to solid gold, museum spotlight',
        emoji: '🏆',
        duration: 6,
        prompt: 'Use the provided start image as the first frame. A wave of shimmering gold sweeps over the subject from the feet up, turning skin, clothing and hair into polished solid gold with soft reflections, the background dimming to a dark museum gallery with a single spotlight. The camera slowly circles the golden figure. Sound: a rising magical chime, a resonant golden ring, hushed gallery ambience.',
    },
    {
        id: 'cloud-dive',
        name: 'Cloud Dive',
        tagline: 'Camera pulls back up into the sky',
        emoji: '☁️',
        duration: 6,
        prompt: 'Use the provided start image as the first frame. The camera pulls back and rises rapidly away from the subject, up through a layer of soft white clouds, the scene below shrinking as sunlight breaks through, ending high above the clouds in a bright golden sky. Smooth continuous camera motion. Sound: a rushing wind that builds then softens, airy high altitude ambience, a warm uplifting swell.',
    },
    {
        id: 'portal',
        name: 'Portal',
        tagline: 'Ring of light opens and pulls in',
        emoji: '🌀',
        duration: 6,
        prompt: 'Use the provided start image as the first frame. A glowing ring of blue-violet energy opens behind the subject, swirling light and sparks spinning inside it, wind pulling hair and loose objects toward the portal as its light washes over the scene, the subject glances back at it. The camera slowly pushes toward the portal. Sound: a deep swirling hum, crackling energy, a rising whoosh of suction.',
    },
];

export const FORMATS = {
    vertical: { id: 'vertical', label: 'Vertical 9:16', width: 704, height: 1280 },
    square: { id: 'square', label: 'Square 1:1', width: 960, height: 960 },
    wide: { id: 'wide', label: 'Wide 16:9', width: 1280, height: 704 },
};

export const FPS = 24;

export function getEffect(id) {
    return EFFECTS.find((e) => e.id === id) || null;
}

export function getFormat(id) {
    return FORMATS[id] || FORMATS.vertical;
}

// LTX wants frame counts of the form 8k + 1.
export function framesFor(durationSeconds, fps = FPS) {
    const raw = Math.max(1, Math.round(durationSeconds * fps));
    return Math.floor(raw / 8) * 8 + 1;
}

export function buildPrompt(effect, subjectHint) {
    const hint = (subjectHint || '').trim().replace(/\s+/g, ' ').slice(0, 200);
    const subject = hint ? `The photo shows: ${hint}. ` : '';
    return `${subject}${effect.prompt} ${COMMON_TAIL}`;
}

export function shareCaption(effect) {
    return `I turned one photo into a ${effect.name.toLowerCase()} shot with sound in one tap. Built with ComfyUI and LTX-2.5, fully open weights. #OpenSourceHiggsfield`;
}
