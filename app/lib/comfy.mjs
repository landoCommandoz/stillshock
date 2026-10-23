// Minimal Comfy API v2 client (Comfy Cloud, a Comfy API deployment, or comfy-api-proxy).
// Docs: https://docs.comfy.org/api-reference/v2/overview
// Zero dependencies. Every call takes the API key explicitly so the server never has to store it.

import { randomUUID } from 'node:crypto';

export const DEFAULT_BASE_URL = 'https://cloud.comfy.org';

export class ComfyError extends Error {
    constructor(message, { status = 0, code = '', details = null } = {}) {
        super(message);
        this.name = 'ComfyError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

function baseUrl() {
    return (process.env.COMFY_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

async function parseError(res) {
    let body = null;
    try { body = await res.json(); } catch { /* not json */ }
    const err = body && body.error ? body.error : {};
    const code = err.code || '';
    const message = err.message || `Comfy API returned HTTP ${res.status}`;
    return new ComfyError(message, { status: res.status, code, details: err.details || body });
}

async function request(apiKey, path, init = {}) {
    const url = path.startsWith('http') ? path : `${baseUrl()}${path}`;
    const headers = { Authorization: `Bearer ${apiKey}`, ...(init.headers || {}) };
    const res = await fetch(url, { ...init, headers });
    if (!res.ok) throw await parseError(res);
    return res;
}

// Upload bytes as an input asset. Returns the asset record ({ id, hash, file_path, ... }).
export async function uploadAsset(apiKey, { bytes, contentType, fileName, expiresIn = 86400 }) {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: contentType }), fileName);
    form.append('content_type', contentType);
    form.append('file_path', fileName);
    form.append('tags', JSON.stringify(['input']));
    form.append('expires_in', String(expiresIn));
    const res = await request(apiKey, '/api/v2/assets', { method: 'POST', body: form });
    return res.json();
}

// Submit an API-format workflow. Returns the job record ({ id, status, urls, ... }).
export async function submitJob(apiKey, workflow, { metadata, extraData } = {}) {
    const body = { workflow };
    if (metadata) body.metadata = metadata;
    if (extraData) body.extra_data = extraData;
    const res = await request(apiKey, '/api/v2/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() },
        body: JSON.stringify(body),
    });
    return res.json();
}

export async function getJob(apiKey, jobId) {
    const res = await request(apiKey, `/api/v2/jobs/${encodeURIComponent(jobId)}`);
    return res.json();
}

export async function cancelJob(apiKey, jobId) {
    const res = await request(apiKey, `/api/v2/jobs/${encodeURIComponent(jobId)}/cancel`, { method: 'POST' });
    return res.status;
}

// Returns a fetch Response for the output bytes. Output URLs need the key, and may be host-relative.
export async function fetchOutput(apiKey, output) {
    const url = output.url.startsWith('http') ? output.url : `${baseUrl()}${output.url}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, redirect: 'follow' });
    if (!res.ok) throw await parseError(res);
    return res;
}

export function isTerminal(status) {
    return ['succeeded', 'failed', 'canceled', 'expired'].includes(status);
}

// Plain-English explanations for the errors a user can actually do something about.
export function explain(err) {
    if (!(err instanceof ComfyError)) return err && err.message ? err.message : 'Something went wrong.';
    const code = err.code || '';
    if (err.status === 401 || err.status === 403) return 'That Comfy API key was rejected. Check the key on platform.comfy.org and paste it again.';
    if (err.status === 402 || code === 'insufficient_credits') return 'Your Comfy account is out of credits for this run. Add credits on cloud.comfy.org and try again.';
    if (err.status === 429 || code === 'queue_full' || code === 'rate_limited') return 'Comfy is busy right now. Wait a few seconds and tap Generate again.';
    if (code === 'workflow_format_ui') return 'The workflow file is in UI format, not API format. Re-export it from ComfyUI with Export (API).';
    if (code === 'missing_asset') return 'The uploaded photo expired before the job started. Upload it again.';
    if (code === 'invalid_workflow') return `Comfy rejected the workflow: ${err.message}`;
    if (err.status >= 500) return 'Comfy had a server hiccup. Try again in a minute.';
    return err.message || 'Something went wrong talking to Comfy.';
}
