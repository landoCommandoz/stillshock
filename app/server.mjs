#!/usr/bin/env node
// Stillshock server: serves the web app and talks to Comfy Cloud (API v2) for generation.
//
// Key modes (see README):
//   byok     (default) The browser sends the visitor's own Comfy API key with every request.
//            The server never stores it. Safe to deploy publicly.
//   server   Uses COMFY_API_KEY from the environment. Only when ALLOW_SERVER_KEY=1 is also set,
//            because every visitor would spend your credits. Meant for local use and demos.
//   examples No generation at all; the gallery still works. Set KEY_MODE=examples.

import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as comfy from './lib/comfy.mjs';
import * as store from './lib/jobs.mjs';
import { buildWorkflow } from './lib/workflow.mjs';
import { EFFECTS, FORMATS, getEffect, getFormat, buildPrompt, shareCaption } from './lib/effects.mjs';

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(APP_DIR, 'public');
const EXAMPLES_DIR = path.join(APP_DIR, '..', 'examples');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_JOBS_PER_HOUR = Number(process.env.MAX_JOBS_PER_HOUR || 20);

const envKey = process.env.COMFY_API_KEY || '';
const allowServerKey = process.env.ALLOW_SERVER_KEY === '1';
let KEY_MODE = process.env.KEY_MODE || (envKey && allowServerKey ? 'server' : 'byok');
if (KEY_MODE === 'server' && !(envKey && allowServerKey)) {
    console.warn('[stillshock] KEY_MODE=server needs COMFY_API_KEY and ALLOW_SERVER_KEY=1. Falling back to byok.');
    KEY_MODE = 'byok';
}

const MIME = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4',
    '.webm': 'video/webm', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};

// ---------- helpers ----------
function send(res, status, body, headers = {}) {
    const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
    const data = isJson ? JSON.stringify(body) : body;
    res.writeHead(status, { 'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
    res.end(data);
}

function fail(res, status, message, extra = {}) {
    send(res, status, { error: { message, ...extra } });
}

async function readJson(req, limit = MAX_IMAGE_BYTES * 1.4) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
        size += chunk.length;
        if (size > limit) throw Object.assign(new Error('That photo is too large. Keep it under 8 MB.'), { status: 413 });
        chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw Object.assign(new Error('Bad JSON body.'), { status: 400 }); }
}

function clientIp(req) {
    return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

const buckets = new Map();
function rateLimited(ip) {
    const now = Date.now();
    const list = (buckets.get(ip) || []).filter((t) => now - t < 3600_000);
    if (list.length >= MAX_JOBS_PER_HOUR) { buckets.set(ip, list); return true; }
    list.push(now);
    buckets.set(ip, list);
    return false;
}

function resolveKey(req) {
    if (KEY_MODE === 'server') return envKey;
    if (KEY_MODE === 'byok') {
        const key = String(req.headers['x-comfy-key'] || '').trim();
        if (!key) throw Object.assign(new Error('Add your Comfy API key first (platform.comfy.org, API Keys). It stays in your browser.'), { status: 401 });
        return key;
    }
    throw Object.assign(new Error('This demo is examples only. Run Stillshock yourself to generate.'), { status: 403 });
}

function decodeDataUrl(dataUrl) {
    const m = /^data:(image\/(png|jpeg|webp));base64,(.+)$/s.exec(String(dataUrl || ''));
    if (!m) throw Object.assign(new Error('Upload a PNG, JPEG or WebP photo.'), { status: 400 });
    const bytes = Buffer.from(m[3], 'base64');
    if (bytes.length > MAX_IMAGE_BYTES) throw Object.assign(new Error('That photo is too large. Keep it under 8 MB.'), { status: 413 });
    return { bytes, contentType: m[1], ext: m[2] === 'jpeg' ? 'jpg' : m[2] };
}

function publicJob(job) {
    const { comfyJobId, ...rest } = job;
    return { ...rest, outputUrl: job.status === 'succeeded' && job.cached ? `/api/jobs/${job.id}/output` : null };
}

// ---------- API ----------
async function handleConfig(res) {
    let examplesCount = 0;
    try { examplesCount = JSON.parse(await readFile(path.join(EXAMPLES_DIR, 'manifest.json'), 'utf8')).items.length; } catch { /* none yet */ }
    send(res, 200, {
        app: 'Stillshock', keyMode: KEY_MODE, examplesCount,
        effects: EFFECTS.map(({ prompt, ...e }) => e),
        formats: Object.values(FORMATS),
        maxJobsPerHour: KEY_MODE === 'server' ? MAX_JOBS_PER_HOUR : null,
    });
}

async function handleExamples(res) {
    try { send(res, 200, JSON.parse(await readFile(path.join(EXAMPLES_DIR, 'manifest.json'), 'utf8'))); }
    catch { send(res, 200, { items: [] }); }
}

async function handleCreate(req, res) {
    const key = resolveKey(req);
    if (KEY_MODE === 'server' && rateLimited(clientIp(req))) return fail(res, 429, `Easy there. This demo allows ${MAX_JOBS_PER_HOUR} clips per hour per visitor.`);
    const body = await readJson(req);
    const effect = getEffect(body.effectId);
    if (!effect) return fail(res, 400, 'Pick an effect first.');
    const format = getFormat(body.formatId);
    const image = decodeDataUrl(body.image);
    const id = randomUUID().slice(0, 8);
    const fileName = `stillshock-${id}.${image.ext}`;

    const asset = await comfy.uploadAsset(key, { bytes: image.bytes, contentType: image.contentType, fileName });
    const prompt = buildPrompt(effect, body.subjectHint);
    const seed = Number.isFinite(Number(body.seed)) && body.seed !== '' ? Number(body.seed) : undefined;
    const workflow = await buildWorkflow({ assetId: asset.id, assetHash: asset.hash, fileName, prompt, width: format.width, height: format.height, durationSeconds: effect.duration, seed });
    const submitted = await comfy.submitJob(key, workflow, { metadata: { app: 'stillshock', effect: effect.id } });

    const job = store.put({
        id, comfyJobId: submitted.id, status: submitted.status || 'queued', effectId: effect.id, effectName: effect.name,
        formatId: format.id, width: format.width, height: format.height, duration: effect.duration, subjectHint: (body.subjectHint || '').slice(0, 200),
        createdAt: new Date().toISOString(), progress: 0, message: 'Queued', error: null, cached: false, caption: shareCaption(effect),
    });
    send(res, 201, publicJob(job));
}

async function cacheOutput(key, job, comfyJob) {
    const video = (comfyJob.outputs || []).find((o) => o.type === 'video' || /\.(mp4|webm|mov)$/i.test(o.name || ''));
    if (!video) throw new Error('The job finished but produced no video file.');
    const res = await comfy.fetchOutput(key, video);
    const bytes = Buffer.from(await res.arrayBuffer());
    await writeFile(store.outputPath(job.id), bytes);
    job.cached = true;
    job.outputBytes = bytes.length;
    job.outputName = video.name;
}

async function handleStatus(req, res, job) {
    if (comfy.isTerminal(job.status) && (job.cached || job.status !== 'succeeded')) return send(res, 200, publicJob(job));
    const key = resolveKey(req);
    const comfyJob = await comfy.getJob(key, job.comfyJobId);
    job.status = comfyJob.status;
    job.queuePosition = comfyJob.queue_position ?? null;
    if (comfyJob.progress) {
        job.progress = comfyJob.progress.value ?? job.progress;
        job.message = comfyJob.progress.message || comfyJob.progress.current_node_class || job.message;
    } else if (job.status === 'queued') {
        job.message = job.queuePosition != null ? `Queued (position ${job.queuePosition})` : 'Queued';
    }
    if (job.status === 'failed') job.error = comfyJob.error ? comfyJob.error.message : 'The job failed inside ComfyUI.';
    if (job.status === 'succeeded' && !job.cached) {
        try { await cacheOutput(key, job, comfyJob); job.progress = 1; job.message = 'Done'; }
        catch (err) { job.status = 'failed'; job.error = err.message; }
    }
    store.put(job);
    send(res, 200, publicJob(job));
}

async function handleOutput(req, res, job) {
    const file = store.outputPath(job.id);
    let info;
    try { info = await stat(file); } catch { return fail(res, 404, 'No video for this job yet.'); }
    const total = info.size;
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    const headers = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=86400', 'Content-Disposition': `inline; filename="stillshock-${job.effectId}-${job.id}.mp4"` };
    if (range) {
        const start = range[1] ? Number(range[1]) : 0;
        const end = range[2] ? Math.min(Number(range[2]), total - 1) : total - 1;
        if (start > end || start >= total) { res.writeHead(416, { 'Content-Range': `bytes */${total}` }); return res.end(); }
        res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Length': end - start + 1 });
        return createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...headers, 'Content-Length': total });
    createReadStream(file).pipe(res);
}

async function handleCancel(req, res, job) {
    if (comfy.isTerminal(job.status)) return send(res, 200, publicJob(job));
    const key = resolveKey(req);
    try { await comfy.cancelJob(key, job.comfyJobId); } catch (err) { console.warn('[cancel]', err.message); }
    job.status = 'canceled';
    job.message = 'Canceled';
    store.put(job);
    send(res, 200, publicJob(job));
}

async function serveStatic(req, res, pathname) {
    let rel = decodeURIComponent(pathname);
    if (rel === '/') rel = '/index.html';
    const roots = rel.startsWith('/examples/') ? [{ prefix: '/examples/', dir: EXAMPLES_DIR }] : [{ prefix: '/', dir: PUBLIC_DIR }];
    const { prefix, dir } = roots[0];
    const file = path.normalize(path.join(dir, rel.slice(prefix.length)));
    if (!file.startsWith(dir)) return fail(res, 403, 'Forbidden');
    try {
        const info = await stat(file);
        if (!info.isFile()) throw new Error('dir');
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': info.size, 'Cache-Control': rel.startsWith('/examples/') ? 'public, max-age=86400' : 'no-cache' });
        createReadStream(file).pipe(res);
    } catch {
        fail(res, 404, 'Not found');
    }
}

async function route(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    if (req.method === 'GET' && p === '/api/config') return handleConfig(res);
    if (req.method === 'GET' && p === '/api/examples') return handleExamples(res);
    if (req.method === 'GET' && p === '/api/jobs') return send(res, 200, { items: store.recent(20).map(publicJob) });
    if (req.method === 'POST' && p === '/api/jobs') return handleCreate(req, res);
    const m = /^\/api\/jobs\/([a-z0-9-]+)(?:\/(output|cancel))?$/.exec(p);
    if (m) {
        const job = store.get(m[1]);
        if (!job) return fail(res, 404, 'Unknown job. It may have been cleared after a restart.');
        if (req.method === 'GET' && !m[2]) return handleStatus(req, res, job);
        if (req.method === 'GET' && m[2] === 'output') return handleOutput(req, res, job);
        if (req.method === 'POST' && m[2] === 'cancel') return handleCancel(req, res, job);
    }
    if (p.startsWith('/api/')) return fail(res, 404, 'No such endpoint.');
    if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'Method not allowed');
    return serveStatic(req, res, p);
}

const server = http.createServer((req, res) => {
    route(req, res).catch((err) => {
        const status = err.status || (err instanceof comfy.ComfyError ? (err.status >= 400 && err.status < 600 ? err.status : 502) : 500);
        const message = err instanceof comfy.ComfyError ? comfy.explain(err) : err.message || 'Server error';
        if (status >= 500) console.error('[stillshock]', err);
        if (!res.headersSent) fail(res, status, message, err instanceof comfy.ComfyError ? { code: err.code } : {});
        else res.end();
    });
});

await store.init();
server.listen(PORT, HOST, () => {
    console.log(`Stillshock running at http://localhost:${PORT}  (key mode: ${KEY_MODE})`);
    if (KEY_MODE === 'byok') console.log('Visitors use their own Comfy API key. Set ALLOW_SERVER_KEY=1 with COMFY_API_KEY to use yours locally.');
});
