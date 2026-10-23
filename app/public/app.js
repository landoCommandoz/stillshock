// Stillshock front end. No framework, no build step.
// States: idle -> photo -> ready -> generating -> done | error. Everything visible in the state panel.

const $ = (id) => document.getElementById(id);
const state = {
    keyMode: 'byok', hasKey: false, effects: [], formats: [], formatId: 'vertical', effectId: null,
    photo: null, photoName: null, phase: 'idle', job: null, elapsed: 0, lastError: null, view: 'make',
};
let sourceBitmap = null;
let pollTimer = null;
let tickTimer = null;

// ---------- storage (null-safe) ----------
const storage = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('is-on'), 2600);
}

function debug() {
    const panel = $('debug-body');
    if (!panel) return;
    const { effects, formats, photo, ...rest } = state;
    panel.textContent = JSON.stringify({ ...rest, photo: photo ? `${Math.round(photo.length / 1024)} KB data URL` : null, job: state.job ? { id: state.job.id, status: state.job.status, progress: state.job.progress, message: state.job.message } : null }, null, 1);
}

async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (state.keyMode === 'byok') {
        const key = storage.get('stillshock.key');
        if (key) headers['x-comfy-key'] = key;
    }
    const res = await fetch(path, { ...opts, headers });
    let body = null;
    try { body = await res.json(); } catch { /* no body */ }
    if (!res.ok) throw new Error((body && body.error && body.error.message) || `Request failed (${res.status})`);
    return body;
}

// ---------- setup ----------
async function init() {
    try {
        const cfg = await api('/api/config');
        state.keyMode = cfg.keyMode;
        state.effects = cfg.effects;
        state.formats = cfg.formats;
    } catch (err) {
        toast('Could not reach the server. Is it running?');
        state.lastError = err.message;
    }
    state.hasKey = Boolean(storage.get('stillshock.key'));
    state.formatId = storage.get('stillshock.format') || 'vertical';
    renderFormats();
    renderEffects();
    renderSamples();
    bindKeyPanel();
    bindPhoto();
    bindActions();
    bindTabs();
    bindDevBar();
    loadRecent();
    loadGallery();
    updateCta();
    debug();
}

function renderFormats() {
    const row = $('format-row');
    row.innerHTML = '';
    for (const f of state.formats) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `chip${f.id === state.formatId ? ' is-active' : ''}`;
        b.textContent = f.label;
        b.setAttribute('role', 'radio');
        b.onclick = () => { state.formatId = f.id; storage.set('stillshock.format', f.id); renderFormats(); drawCrop(); debug(); };
        row.appendChild(b);
    }
}

function renderEffects() {
    const grid = $('effects');
    grid.innerHTML = '';
    state.effects.forEach((e, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `effect${e.id === state.effectId ? ' is-active' : ''}`;
        b.style.animationDelay = `${i * 40}ms`;
        b.setAttribute('role', 'radio');
        b.innerHTML = `<span class="effect-emoji">${e.emoji}</span><span class="effect-name">${e.name}</span><span class="effect-tag">${e.tagline}</span><span class="effect-dur">${e.duration}s</span>`;
        b.onclick = () => { state.effectId = e.id; renderEffects(); updateCta(); debug(); };
        grid.appendChild(b);
    });
}

// Sample photos: no real people. Lando's own photos replace these before submission.
const SAMPLES = ['samples/dog.jpg', 'samples/sneaker.jpg', 'samples/city.jpg'];
function renderSamples() {
    const wrap = $('samples');
    wrap.innerHTML = '';
    for (const src of SAMPLES) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'sample';
        b.title = 'Use this sample photo';
        b.innerHTML = `<img src="${src}" alt="Sample photo" loading="lazy">`;
        b.onclick = async () => {
            try {
                const blob = await (await fetch(src)).blob();
                await usePhoto(blob, src.split('/').pop());
            } catch { toast('Sample photo missing.'); }
        };
        wrap.appendChild(b);
    }
}

function bindKeyPanel() {
    const panel = $('key-panel');
    if (state.keyMode === 'examples') { $('examples-only').hidden = false; return; }
    if (state.keyMode !== 'byok') return;
    panel.hidden = false;
    const input = $('key-input');
    const status = $('key-status');
    const refresh = () => { status.textContent = state.hasKey ? 'Key saved in this browser. Clear the field and press Save to forget it.' : 'No key saved yet.'; };
    refresh();
    $('key-save').onclick = () => {
        const v = input.value.trim();
        if (v) { storage.set('stillshock.key', v); state.hasKey = true; input.value = ''; toast('Key saved'); }
        else { storage.del('stillshock.key'); state.hasKey = false; toast('Key cleared'); }
        refresh(); updateCta(); debug();
    };
}

// ---------- photo ----------
function bindPhoto() {
    const drop = $('drop');
    const input = $('file-input');
    input.onchange = () => { if (input.files && input.files[0]) usePhoto(input.files[0], input.files[0].name); input.value = ''; };
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
    drop.addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) usePhoto(f, f.name); });
}

async function usePhoto(blob, name) {
    if (!/^image\/(png|jpeg|webp)$/.test(blob.type)) { toast('Use a PNG, JPEG or WebP photo.'); return; }
    try {
        sourceBitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(blob));
    } catch {
        toast('Could not read that image.'); return;
    }
    state.photoName = name;
    drawCrop();
    $('drop').classList.add('has-image');
    $('drop-empty').hidden = true;
    $('crop-canvas').hidden = false;
    if (state.phase === 'done' || state.phase === 'error') resetResult();
    updateCta();
    debug();
}

// Center-crop the photo to the chosen format and downscale to the model size, client side.
function drawCrop() {
    if (!sourceBitmap) return;
    const fmt = state.formats.find((f) => f.id === state.formatId) || { width: 720, height: 1280 };
    const canvas = $('crop-canvas');
    canvas.width = fmt.width;
    canvas.height = fmt.height;
    const ctx = canvas.getContext('2d');
    const sw = sourceBitmap.width, sh = sourceBitmap.height;
    const scale = Math.max(fmt.width / sw, fmt.height / sh);
    const dw = sw * scale, dh = sh * scale;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, fmt.width, fmt.height);
    ctx.drawImage(sourceBitmap, (fmt.width - dw) / 2, (fmt.height - dh) / 2, dw, dh);
    state.photo = canvas.toDataURL('image/jpeg', 0.92);
}

// ---------- generate ----------
function updateCta() {
    const btn = $('generate');
    const needKey = state.keyMode === 'byok' && !state.hasKey;
    const busy = state.phase === 'generating';
    btn.disabled = busy || !state.photo || !state.effectId || needKey || state.keyMode === 'examples';
    if (state.keyMode === 'examples') btn.textContent = 'Examples only on this demo';
    else if (busy) btn.textContent = 'Generating';
    else if (needKey) btn.textContent = 'Add your Comfy API key above';
    else if (!state.photo) btn.textContent = 'Pick a photo and an effect';
    else if (!state.effectId) btn.textContent = 'Now pick an effect';
    else btn.textContent = `Generate ${state.effects.find((e) => e.id === state.effectId).name}`;
}

function bindActions() {
    $('generate').onclick = generate;
    $('cancel-btn').onclick = cancel;
    $('retry').onclick = generate;
    $('error-back').onclick = resetResult;
    $('remix').onclick = () => { resetResult(); $('effects').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    $('copy-caption').onclick = async () => {
        try { await navigator.clipboard.writeText($('caption').textContent); toast('Caption copied'); }
        catch { toast('Select the caption text to copy it.'); }
    };
    $('unmute').onclick = () => { const v = $('player'); v.muted = false; v.volume = 1; v.play().catch(() => {}); $('unmute').hidden = true; };
    $('debug-toggle').onclick = () => { const p = $('debug-panel'); p.hidden = !p.hidden; $('debug-toggle').classList.toggle('is-on', !p.hidden); debug(); };
    $('brand').onclick = (e) => { e.preventDefault(); showView('make'); };
    window.addEventListener('beforeunload', (e) => { if (state.phase === 'generating') { e.preventDefault(); e.returnValue = ''; } });
}

async function generate() {
    if (state.phase === 'generating') return;
    const effect = state.effects.find((e) => e.id === state.effectId);
    if (!state.photo || !effect) { toast('Pick a photo and an effect first.'); return; }
    state.phase = 'generating';
    state.lastError = null;
    state.elapsed = 0;
    state.job = null;
    showResultPanel('progress');
    $('result-title').textContent = `Generating ${effect.name}`;
    setProgress(0.02, 'Uploading photo');
    updateCta();
    debug();
    startTick();
    try {
        const job = await api('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ effectId: effect.id, formatId: state.formatId, subjectHint: $('subject-hint').value, image: state.photo }) });
        state.job = job;
        setProgress(0.05, job.message || 'Queued');
        poll();
    } catch (err) {
        failWith(err.message);
    }
    debug();
}

function poll() {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(async () => {
        if (state.phase !== 'generating' || !state.job) return;
        try {
            const job = await api(`/api/jobs/${state.job.id}`);
            state.job = job;
            if (job.status === 'succeeded' && job.outputUrl) return finish(job);
            if (job.status === 'failed' || job.status === 'expired') return failWith(job.error || 'The job did not finish.');
            if (job.status === 'canceled') { resetResult(); return; }
            const p = job.status === 'queued' ? 0.05 : Math.max(0.08, Math.min(0.97, job.progress || 0.08));
            setProgress(p, job.message || job.status);
            poll();
        } catch (err) {
            // Transient network hiccup: keep polling a few times before giving up.
            state.pollErrors = (state.pollErrors || 0) + 1;
            if (state.pollErrors > 8) return failWith(err.message);
            setProgress(null, 'Reconnecting');
            poll();
        }
        debug();
    }, 2500);
}

function setProgress(value, message) {
    if (value != null) $('progress-fill').style.width = `${Math.round(value * 100)}%`;
    if (message) $('progress-msg').textContent = message;
}

function startTick() {
    clearInterval(tickTimer);
    const started = Date.now();
    tickTimer = setInterval(() => {
        state.elapsed = Math.round((Date.now() - started) / 1000);
        $('progress-time').textContent = `${state.elapsed}s`;
        if (state.phase !== 'generating') clearInterval(tickTimer);
    }, 1000);
}

function finish(job) {
    state.phase = 'done';
    clearInterval(tickTimer);
    showResultPanel('result');
    $('result-title').textContent = `${job.effectName} is ready`;
    const v = $('player');
    v.src = job.outputUrl;
    v.muted = true;
    v.play().then(() => { $('unmute').hidden = false; }).catch(() => { $('unmute').hidden = false; });
    $('download').href = job.outputUrl;
    $('download').download = `stillshock-${job.effectId}-${job.id}.mp4`;
    $('caption').textContent = job.caption || '';
    if (navigator.share) { $('share').hidden = false; $('share').onclick = shareClip; }
    updateCta();
    loadRecent();
    toast('Done. Tap for sound.');
    debug();
}

async function shareClip() {
    try {
        const blob = await (await fetch(state.job.outputUrl)).blob();
        const file = new File([blob], `stillshock-${state.job.effectId}.mp4`, { type: 'video/mp4' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text: state.job.caption });
        else await navigator.share({ text: state.job.caption, url: location.href });
    } catch { /* user dismissed */ }
}

function failWith(message) {
    state.phase = 'error';
    state.lastError = message;
    clearInterval(tickTimer);
    clearTimeout(pollTimer);
    showResultPanel('error');
    $('result-title').textContent = 'That did not work';
    $('error-text').textContent = message;
    updateCta();
    debug();
}

async function cancel() {
    if (state.job) { try { await api(`/api/jobs/${state.job.id}/cancel`, { method: 'POST' }); } catch { /* already done */ } }
    clearTimeout(pollTimer);
    resetResult();
    toast('Canceled');
}

function resetResult() {
    state.phase = state.photo ? 'photo' : 'idle';
    state.job = null;
    state.pollErrors = 0;
    clearTimeout(pollTimer);
    clearInterval(tickTimer);
    const v = $('player');
    v.pause();
    v.removeAttribute('src');
    v.load();
    $('result-panel').hidden = true;
    updateCta();
    debug();
}

function showResultPanel(which) {
    $('result-panel').hidden = false;
    $('progress').hidden = which !== 'progress';
    $('result').hidden = which !== 'result';
    $('result-error').hidden = which !== 'error';
    if (which === 'progress') $('progress-fill').style.width = '2%';
    $('result-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- recent + gallery ----------
async function loadRecent() {
    try {
        const { items } = await api('/api/jobs');
        const done = items.filter((j) => j.outputUrl);
        $('recent-panel').hidden = done.length === 0;
        const wrap = $('recent');
        wrap.innerHTML = '';
        for (const j of done.slice(0, 12)) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'recent-item';
            b.innerHTML = `<video src="${j.outputUrl}#t=0.5" muted playsinline preload="metadata"></video><span>${j.effectName}</span>`;
            b.onclick = () => { state.job = j; finish(j); };
            wrap.appendChild(b);
        }
    } catch { /* server not reachable */ }
}

async function loadGallery() {
    try {
        const { items } = await api('/api/examples');
        const grid = $('gallery');
        grid.innerHTML = '';
        $('gallery-empty').hidden = items.length > 0;
        items.forEach((it, i) => {
            const fig = document.createElement('figure');
            fig.className = 'gallery-item';
            fig.style.setProperty('--i', i);
            fig.style.margin = 0;
            fig.innerHTML = `<video src="/examples/${it.file}" controls playsinline loop muted preload="metadata" poster="${it.poster ? '/examples/' + it.poster : ''}"></video><figcaption><b>${it.effect}</b><span class="muted">${it.note || ''}</span></figcaption>`;
            grid.appendChild(fig);
        });
    } catch { $('gallery-empty').hidden = false; }
}

// ---------- views, dev bar ----------
function showView(name) {
    state.view = name;
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('is-active', v.dataset.view === name));
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t.dataset.view === name));
    debug();
}
function bindTabs() { document.querySelectorAll('.tab').forEach((t) => { t.onclick = () => showView(t.dataset.view); }); }

function bindDevBar() {
    const body = $('devbar-body');
    $('devbar-toggle').onclick = () => { body.hidden = !body.hidden; };
    body.querySelectorAll('button[data-width]').forEach((b) => {
        b.onclick = () => {
            const w = b.dataset.width;
            const app = $('app');
            app.style.maxWidth = w === '100%' ? '' : w;
            $('frame').classList.toggle('preview', w !== '100%');
        };
    });
}

init();
