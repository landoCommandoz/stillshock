/* Spellclip front end. Plain JS, no build step.
   States: empty -> preview -> progress -> result | error. See README for the map. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode or blocked: ignore */ } },
  };

  const state = {
    config: null, view: 'empty',
    file: null, fileUrl: null,
    spell: null, variant: null, scene: '', object: '',
    orientation: 'auto', quality: 'fast', duration: 'short', audio: 'generated',
    strength: null, seed: '',
    stackFrom: null,       // job id whose result the next cast runs on
    job: null, pollTimer: null, submitting: false, lastParams: null,
    compareView: 'after', recent: [],
  };

  // ---------- helpers ----------
  function show(id, on) { const el = $(id); if (el) el.classList.toggle('hidden', !on); }
  function setView(view) {
    state.view = view;
    show('stage-empty', view === 'empty');
    show('stage-preview', view === 'preview');
    show('stage-progress', view === 'progress');
    show('stage-result', view === 'result');
    show('stage-error', view === 'error');
    renderDebug();
    if (window.innerWidth <= 900 && view !== 'empty') {
      const stage = document.querySelector('.stage');
      if (stage && stage.scrollIntoView) stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  function spellById(id) { return (state.config && state.config.spells.find((s) => s.id === id)) || null; }
  function chipGroup(groupId, onPick) {
    const g = $(groupId);
    if (!g) return;
    g.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-value]');
      if (!b) return;
      g.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      onPick(b.dataset.value);
    });
  }
  function setChip(groupId, value) {
    const g = $(groupId);
    if (!g) return;
    g.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x.dataset.value === value));
  }
  function fmtErr(e) { return (e && e.message) ? e.message : String(e || 'Unknown error'); }

  async function api(path, opts) {
    const r = await fetch(path, opts);
    let data = null;
    try { data = await r.json(); } catch (e) { data = null; }
    if (!r.ok) {
      const msg = (data && (data.detail || data.error)) || ('Server error ' + r.status);
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    return data;
  }

  // ---------- rendering ----------
  function renderSpells() {
    const host = $('spell-groups');
    host.innerHTML = '';
    const ready = state.config.spells.filter((s) => s.available !== false);
    const gpuOnly = state.config.spells.filter((s) => s.available === false);
    const section = (title, spells, disabled) => {
      if (!spells.length) return;
      const t = document.createElement('div');
      t.className = 'spell-group-title';
      t.textContent = title;
      host.appendChild(t);
      const grid = document.createElement('div');
      grid.className = 'spell-grid';
      spells.forEach((s) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'spell-card' + (disabled ? ' disabled' : '');
        b.dataset.spell = s.id;
        b.disabled = !!disabled;
        if (disabled) b.title = s.availability_note || 'Needs a local GPU';
        const badge = disabled ? 'local gpu' : (s.cloud_ready ? 'cloud ready' : 'ready');
        b.innerHTML = '<span class="spell-icon">' + s.icon + '</span><span class="spell-name"></span><span class="spell-tag"></span>'
          + '<span class="spell-badge ' + (disabled ? '' : 'ready') + '">' + badge + '</span>';
        b.querySelector('.spell-name').textContent = s.name;
        b.querySelector('.spell-tag').textContent = s.tagline;
        if (!disabled) b.addEventListener('click', () => pickSpell(s.id));
        grid.appendChild(b);
      });
      host.appendChild(grid);
    };
    section(gpuOnly.length ? 'Ready now' : 'Spells', ready, false);
    section('Needs your own GPU (not on Comfy Cloud yet)', gpuOnly, true);
  }

  function pickSpell(id) {
    const s = spellById(id);
    if (!s) return;
    state.spell = id;
    state.variant = (s.variants && s.variants.length) ? s.variants[0].id : null;
    state.strength = s.lora_strength;
    document.querySelectorAll('.spell-card').forEach((c) => c.classList.toggle('active', c.dataset.spell === id));
    // variants
    const vr = $('variant-chips');
    vr.innerHTML = '';
    (s.variants || []).forEach((v, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.value = v.id; b.textContent = v.name;
      if (i === 0) b.classList.add('active');
      vr.appendChild(b);
    });
    show('variant-row', !!(s.variants && s.variants.length));
    show('scene-row', !!s.scene_field);
    show('object-row', !!s.object_field);
    $('strength-input').value = s.lora_strength;
    $('strength-value').textContent = '(' + Number(s.lora_strength).toFixed(2) + ')';
    if (s.pad_to === 'portrait') { state.orientation = 'portrait'; setChip('orientation-chips', 'portrait'); }
    updateCast();
  }

  function updateCast() {
    const btn = $('cast-btn');
    const sub = $('cast-sub');
    const s = spellById(state.spell);
    const hasSource = !!state.file || !!state.stackFrom;
    const needsObject = s && s.object_field && !state.object.trim();
    const ready = hasSource && !!s && !needsObject && !state.submitting;
    btn.disabled = !ready;
    if (state.submitting) sub.textContent = 'Sending';
    else if (!hasSource) sub.textContent = 'Drop a clip first';
    else if (!s) sub.textContent = 'Now pick a spell';
    else if (needsObject) sub.textContent = 'Say what should disappear';
    else if (state.stackFrom) sub.textContent = s.name + ' on top of your last result';
    else sub.textContent = s.name + ' on your clip';
    renderDebug();
  }

  function renderDebug() {
    const el = $('debug-json');
    if (!el || $('debug-panel').classList.contains('hidden')) return;
    const j = state.job || {};
    el.textContent = JSON.stringify({
      view: state.view, backend: state.config && state.config.backend, file: state.file ? state.file.name : null,
      spell: state.spell, variant: state.variant, orientation: state.orientation, quality: state.quality,
      duration: state.duration, audio: state.audio, strength: state.strength, stackFrom: state.stackFrom,
      job: { id: j.id, status: j.status, stage: j.stage, progress: j.progress, message: j.message, error: j.error, chain: j.chain },
    }, null, 2);
  }

  function renderRecent() {
    const host = $('recent-list');
    host.innerHTML = '';
    if (!state.recent.length) { host.innerHTML = '<p class="muted">Nothing yet. Your results show up here, even after a refresh.</p>'; return; }
    state.recent.slice(0, 12).forEach((j) => {
      const s = spellById(j.spell);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'recent-item';
      const img = document.createElement('img');
      img.className = 'recent-thumb'; img.alt = '';
      if (j.urls && j.urls.poster) img.src = j.urls.poster;
      const text = document.createElement('div'); text.className = 'recent-text';
      const name = document.createElement('div'); name.className = 'recent-name';
      name.textContent = (s ? s.icon + ' ' + s.name : j.spell) + ((j.chain && j.chain.length) ? ' (stacked)' : '');
      const sub = document.createElement('div'); sub.className = 'recent-sub';
      sub.textContent = new Date((j.created_at || 0) * 1000).toLocaleString() + (j.width ? ' · ' + j.width + 'x' + j.height : '');
      const st = document.createElement('div'); st.className = 'recent-status ' + (j.status || '');
      st.textContent = j.status;
      text.appendChild(name); text.appendChild(sub);
      b.appendChild(img); b.appendChild(text); b.appendChild(st);
      b.addEventListener('click', () => openJob(j));
      host.appendChild(b);
    });
  }

  async function refreshRecent() {
    try { state.recent = await api('/api/jobs?limit=12'); renderRecent(); } catch (e) { /* non-blocking */ }
  }

  // ---------- file ----------
  function setFile(file) {
    if (!file) return;
    if (!/^video\//.test(file.type) && !/\.(mp4|mov|m4v|webm)$/i.test(file.name)) {
      showFormError('That does not look like a video. Try an MP4 or MOV.'); return;
    }
    const maxMb = (state.config && state.config.max_upload_mb) || 300;
    if (file.size > maxMb * 1024 * 1024) { showFormError('That file is over ' + maxMb + ' MB. Trim it first.'); return; }
    showFormError('');
    if (state.fileUrl) { try { URL.revokeObjectURL(state.fileUrl); } catch (e) { /* ignore */ } }
    state.file = file;
    state.stackFrom = null;
    state.fileUrl = URL.createObjectURL(file);
    $('dropzone').classList.add('has-file');
    $('clip-name').textContent = file.name + ' (' + (file.size / 1048576).toFixed(1) + ' MB)';
    show('clip-meta', true);
    const v = $('preview-video');
    v.src = state.fileUrl;
    v.play().catch(() => {});
    setView('preview');
    updateCast();
  }
  function clearFile() {
    state.file = null;
    if (state.fileUrl) { try { URL.revokeObjectURL(state.fileUrl); } catch (e) { /* ignore */ } }
    state.fileUrl = null;
    $('file-input').value = '';
    $('dropzone').classList.remove('has-file');
    show('clip-meta', false);
    if (!state.stackFrom) setView('empty');
    updateCast();
  }
  function showFormError(msg) {
    const el = $('form-error');
    el.textContent = msg || '';
    el.classList.toggle('hidden', !msg);
  }

  // ---------- casting ----------
  function collectParams() {
    return {
      spell: state.spell, variant: state.variant || '', scene: state.scene, object: state.object,
      orientation: state.orientation, quality: state.quality, duration: state.duration,
      keep_audio: state.audio === 'original' ? 'true' : 'false',
      strength: state.strength != null ? String(state.strength) : '',
      seed: state.seed !== '' ? String(state.seed) : '',
    };
  }

  async function cast(params, source, force) {
    if (state.submitting) return;
    state.submitting = true; updateCast(); showFormError('');
    const fd = new FormData();
    Object.keys(params).forEach((k) => { if (params[k] !== '' && params[k] != null) fd.append(k, params[k]); });
    if (force) fd.append('force', 'true');
    if (source.jobId) { fd.append('source_job', source.jobId); fd.append('source_kind', source.kind || 'result'); }
    else if (source.file) fd.append('file', source.file, source.file.name);
    else { state.submitting = false; updateCast(); showFormError('Drop a clip first.'); return; }
    state.lastParams = { params: params, source: source };
    const s = spellById(params.spell);
    $('progress-spell').textContent = 'Casting ' + (s ? s.name : params.spell);
    $('progress-fill').style.width = '2%';
    $('progress-pct').textContent = '0%';
    $('progress-stage').textContent = 'uploading';
    $('progress-msg').textContent = 'Uploading your clip';
    const pv = $('progress-video');
    pv.src = source.file ? state.fileUrl : (source.jobId ? '/api/jobs/' + source.jobId + '/file/' + (source.kind === 'input' ? 'input' : 'result') : '');
    setView('progress');
    try {
      const job = await api('/api/jobs', { method: 'POST', body: fd });
      state.job = job;
      store.set('spellclip.lastJob', job.id);
      state.submitting = false; updateCast();
      if (job.deduped) {
        showFormError('You already cast this spell on this clip with these settings. Showing that result. Use "Same spell, new seed" for another take.');
        if (job.status === 'done') { showResult(job); return; }
        if (job.status === 'error') { showError(job.error || 'The job failed.'); return; }
        renderProgress(job);
      }
      poll();
    } catch (e) {
      state.submitting = false; updateCast();
      showError(fmtErr(e));
    }
  }

  function poll() {
    clearTimeout(state.pollTimer);
    if (!state.job) return;
    state.pollTimer = setTimeout(async () => {
      try {
        const j = await api('/api/jobs/' + state.job.id);
        state.job = j;
        renderProgress(j);
        if (j.status === 'done') { showResult(j); refreshRecent(); return; }
        if (j.status === 'error') { showError(j.error || 'The job failed.'); refreshRecent(); return; }
        poll();
      } catch (e) {
        // network blip: keep polling a few more times before giving up
        state.job._misses = (state.job._misses || 0) + 1;
        if (state.job._misses > 20) { showError('Lost contact with the server. ' + fmtErr(e)); return; }
        poll();
      }
    }, 1500);
  }

  function renderProgress(j) {
    const pct = Math.round((j.progress || 0) * 100);
    $('progress-fill').style.width = Math.max(2, pct) + '%';
    $('progress-pct').textContent = pct + '%';
    $('progress-stage').textContent = j.stage || j.status;
    $('progress-msg').textContent = j.message || '';
    renderDebug();
  }

  function showResult(j) {
    state.job = j;
    const s = spellById(j.spell);
    $('result-spell').textContent = (s ? s.icon + ' ' + s.name : j.spell) + ' · ' + (j.width || '') + 'x' + (j.height || '');
    $('result-prompt').textContent = j.prompt ? 'Prompt: ' + j.prompt : '';
    $('download-btn').href = j.urls.result;
    $('download-compare-btn').href = j.urls.compare || '#';
    show('download-compare-btn', !!j.urls.compare);
    const chain = (j.chain || []).concat([j.spell]);
    $('chain-line').textContent = chain.length > 1 ? 'Stack: ' + chain.map((id) => { const x = spellById(id); return x ? x.name : id; }).join(' → ') : '';
    show('chain-line', chain.length > 1);
    state.compareView = 'after';
    setChip('compare-chips', 'after');
    applyCompareView();
    setView('result');
  }

  function applyCompareView() {
    const j = state.job; if (!j || !j.urls) return;
    const v = $('result-video');
    const src = state.compareView === 'before' ? j.urls.input : (state.compareView === 'split' ? (j.urls.compare || j.urls.result) : j.urls.result);
    if (v.getAttribute('src') !== src) { v.src = src; v.play().catch(() => {}); }
    show('hold-hint', state.compareView === 'after' && !!j.urls.input);
  }

  function showError(msg) {
    $('error-msg').textContent = msg;
    setView('error');
    renderDebug();
  }

  function openJob(j) {
    state.job = j;
    if (j.status === 'done') showResult(j);
    else if (j.status === 'error') showError(j.error || 'The job failed.');
    else { renderProgress(j); setView('progress'); poll(); }
  }

  // ---------- wire up ----------
  function wire() {
    const fi = $('file-input');
    fi.addEventListener('change', () => setFile(fi.files && fi.files[0]));
    const dz = $('dropzone');
    ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
    dz.addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) setFile(f); });
    $('clip-clear').addEventListener('click', clearFile);

    chipGroup('variant-chips', (v) => { state.variant = v; renderDebug(); });
    chipGroup('orientation-chips', (v) => { state.orientation = v; renderDebug(); });
    chipGroup('quality-chips', (v) => { state.quality = v; renderDebug(); });
    chipGroup('duration-chips', (v) => { state.duration = v; renderDebug(); });
    chipGroup('audio-chips', (v) => { state.audio = v; renderDebug(); });
    $('scene-input').addEventListener('input', (e) => { state.scene = e.target.value; });
    $('object-input').addEventListener('input', (e) => { state.object = e.target.value; updateCast(); });
    $('strength-input').addEventListener('input', (e) => { state.strength = parseFloat(e.target.value); $('strength-value').textContent = '(' + state.strength.toFixed(2) + ')'; });
    $('seed-input').addEventListener('input', (e) => { state.seed = e.target.value.trim(); });

    $('cast-btn').addEventListener('click', () => {
      const params = collectParams();
      if (state.stackFrom) cast(params, { jobId: state.stackFrom, kind: 'result' });
      else cast(params, { file: state.file });
    });

    chipGroup('compare-chips', (v) => { state.compareView = v; applyCompareView(); });
    const rv = $('result-video');
    let holding = false;
    const holdStart = (e) => { if (state.compareView !== 'after' || !state.job || !state.job.urls.input) return; holding = true; rv.src = state.job.urls.input; rv.play().catch(() => {}); };
    const holdEnd = () => { if (!holding) return; holding = false; rv.src = state.job.urls.result; rv.play().catch(() => {}); };
    rv.addEventListener('pointerdown', holdStart);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => rv.addEventListener(ev, holdEnd));

    $('stack-btn').addEventListener('click', () => {
      if (!state.job || state.job.status !== 'done') return;
      state.stackFrom = state.job.id;
      state.spell = null;
      document.querySelectorAll('.spell-card').forEach((c) => c.classList.remove('active'));
      show('variant-row', false); show('scene-row', false); show('object-row', false);
      updateCast();
      const el = $('step-spell'); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('again-btn').addEventListener('click', () => {
      if (!state.job) return;
      const p = Object.assign({}, state.lastParams ? state.lastParams.params : collectParams(), { seed: '' });
      p.spell = state.job.spell; p.variant = state.job.variant || ''; p.scene = state.job.scene || ''; p.object = state.job.object || '';
      p.orientation = state.job.orientation || 'auto'; p.quality = state.job.quality || 'fast'; p.duration = state.job.duration || 'short';
      p.keep_audio = state.job.keep_audio ? 'true' : 'false';
      if (state.job.source_job) cast(p, { jobId: state.job.source_job, kind: 'result' }, true);
      else cast(p, { jobId: state.job.id, kind: 'input' }, true);
    });
    const reset = () => {
      clearTimeout(state.pollTimer);
      state.job = null; state.stackFrom = null;
      clearFile();
      setView('empty');
      updateCast();
    };
    $('reset-btn').addEventListener('click', reset);
    $('error-reset-btn').addEventListener('click', reset);
    $('retry-btn').addEventListener('click', () => {
      if (state.lastParams) {
        const src = state.lastParams.source;
        if (src.file && !state.file) { showFormError('Drop the clip again to retry.'); setView('preview'); return; }
        cast(state.lastParams.params, src.file ? { file: state.file } : src, true);
      } else reset();
    });

    $('debug-toggle').addEventListener('click', () => { $('debug-panel').classList.toggle('hidden'); renderDebug(); });
    $('debug-close').addEventListener('click', () => $('debug-panel').classList.add('hidden'));

    const bar = $('device-preview-bar');
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.id === 'dp-hide') { bar.classList.add('hidden'); return; }
      bar.querySelectorAll('button[data-width]').forEach((x) => x.classList.toggle('active', x === b));
      document.documentElement.style.setProperty('--frame-width', b.dataset.width);
    });
  }

  async function init() {
    wire();
    try {
      state.config = await api('/api/config');
    } catch (e) {
      $('mode-pill').textContent = 'offline';
      showError('The Spellclip server is not responding. Start it with: uvicorn app.server:app --port 8787');
      return;
    }
    const pill = $('mode-pill');
    pill.textContent = state.config.backend === 'cloud' ? 'Comfy Cloud' : (state.config.backend === 'local' ? 'Local ComfyUI' : 'Demo mode');
    pill.className = 'pill ' + state.config.backend;
    show('demo-banner', !!state.config.demo_mode);
    renderSpells();
    updateCast();
    await refreshRecent();
    const last = store.get('spellclip.lastJob');
    if (last) {
      const j = state.recent.find((x) => x.id === last);
      if (j && j.status === 'done') showResult(j);
      else if (j && (j.status === 'queued' || j.status === 'running')) openJob(j);
    }
  }

  try { init(); } catch (e) { showError('The app failed to start: ' + fmtErr(e)); }
})();
