#!/usr/bin/env node
// A fake Comfy API v2 for local development and UI testing. No GPU, no key, no cost.
// Run: node dev/mock-comfy.mjs   then in another shell: COMFY_BASE_URL=http://127.0.0.1:8189 KEY_MODE=server ALLOW_SERVER_KEY=1 COMFY_API_KEY=mock npm start
// Jobs "run" for MOCK_SECONDS (default 8) and return the sample clip at dev/mock-output.mp4 (any small mp4 works).

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8189);
const SECONDS = Number(process.env.MOCK_SECONDS || 8);
const FAIL = process.env.MOCK_FAIL === '1';
const jobs = new Map();
const assets = new Map();

function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); }
function auth(req, res) {
    if (!/^Bearer \S+/.test(req.headers.authorization || '')) { json(res, 401, { error: { code: 'unauthorized', message: 'missing key' } }); return false; }
    return true;
}
async function drain(req) { const c = []; for await (const x of req) c.push(x); return Buffer.concat(c); }

function snapshot(job) {
    const t = (Date.now() - job.started) / 1000;
    const value = Math.min(1, t / SECONDS);
    if (value < 1) return { ...job.base, status: t < 1 ? 'queued' : 'running', queue_position: t < 1 ? 1 : null, progress: { value, nodes_done: Math.round(value * 12), nodes_total: 12, message: `Sampler ${Math.round(value * 8)}/8`, current_node_class: 'LTXVSampler' }, outputs: [] };
    if (FAIL) return { ...job.base, status: 'failed', progress: null, outputs: [], error: { code: 'node_execution_error', message: 'Mock failure for testing the error state.' } };
    return { ...job.base, status: 'succeeded', progress: { value: 1, nodes_done: 12, nodes_total: 12, message: 'Done' }, outputs: [{ node_id: '75', name: 'stillshock_00001_.mp4', type: 'video', content_type: 'video/mp4', size_bytes: 1, id: job.base.id, hash: null, url: `/mock/output/${job.base.id}.mp4`, url_expires_at: new Date(Date.now() + 3600e3).toISOString() }] };
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST' && url.pathname === '/api/v2/assets') {
        if (!auth(req, res)) return;
        await drain(req);
        const id = randomUUID();
        assets.set(id, true);
        return json(res, 201, { id, hash: 'blake3:mock', size_bytes: 1, content_type: 'image/jpeg', file_path: 'mock.jpg', created_new: true, created_at: new Date().toISOString(), url: `/mock/asset/${id}`, url_expires_at: new Date(Date.now() + 3600e3).toISOString() });
    }
    if (req.method === 'POST' && url.pathname === '/api/v2/jobs') {
        if (!auth(req, res)) return;
        let body;
        try { body = JSON.parse((await drain(req)).toString()); } catch { return json(res, 400, { error: { code: 'invalid_body', message: 'bad json' } }); }
        if (!body.workflow || body.workflow.nodes) return json(res, 422, { error: { code: 'workflow_format_ui', message: 'UI format rejected' } });
        for (const node of Object.values(body.workflow)) {
            for (const v of Object.values(node.inputs || {})) {
                if (v && typeof v === 'object' && v.__type === 'core/ASSET' && !assets.has(v.info?.id)) return json(res, 422, { error: { code: 'missing_asset', message: `asset ${v.info?.id} not found` } });
            }
        }
        const id = randomUUID();
        const base = { id, created_at: new Date().toISOString(), started_at: null, completed_at: null, expires_at: new Date(Date.now() + 86400e3).toISOString(), error: null, urls: { self: `/api/v2/jobs/${id}`, events: `/api/v2/jobs/${id}/events`, cancel: `/api/v2/jobs/${id}/cancel` } };
        jobs.set(id, { base, started: Date.now() });
        console.log(`[mock] job ${id} queued (${Object.keys(body.workflow).length} nodes)`);
        return json(res, 201, { ...base, status: 'queued', queue_position: 1, progress: null, outputs: [] });
    }
    let m = /^\/api\/v2\/jobs\/([^/]+)$/.exec(url.pathname);
    if (m && req.method === 'GET') {
        if (!auth(req, res)) return;
        const job = jobs.get(m[1]);
        return job ? json(res, 200, snapshot(job)) : json(res, 404, { error: { code: 'not_found', message: 'no such job' } });
    }
    m = /^\/api\/v2\/jobs\/([^/]+)\/cancel$/.exec(url.pathname);
    if (m && req.method === 'POST') { jobs.delete(m[1]); res.writeHead(202); return res.end(); }
    m = /^\/mock\/output\/([^/]+)\.mp4$/.exec(url.pathname);
    if (m) {
        if (!auth(req, res)) return;
        try { const bytes = await readFile(path.join(DIR, 'mock-output.mp4')); res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': bytes.length }); return res.end(bytes); }
        catch { return json(res, 500, { error: { code: 'mock_missing_video', message: 'Put a small mp4 at app/dev/mock-output.mp4' } }); }
    }
    json(res, 404, { error: { code: 'not_found', message: url.pathname } });
});
server.listen(PORT, '127.0.0.1', () => console.log(`Mock Comfy API v2 on http://127.0.0.1:${PORT} (jobs take ${SECONDS}s${FAIL ? ', always fail' : ''})`));
