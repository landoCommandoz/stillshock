// Tiny job store: in memory, mirrored to .cache/jobs.json so a restart does not lose history.
// Only job metadata is stored here. API keys are never written.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE_DIR = path.join(APP_DIR, '.cache');
export const OUTPUTS_DIR = path.join(APP_DIR, 'outputs');
const FILE = path.join(CACHE_DIR, 'jobs.json');
const MAX_JOBS = 500;

const jobs = new Map();
let loaded = false;
let writing = Promise.resolve();

export async function init() {
    await mkdir(CACHE_DIR, { recursive: true });
    await mkdir(OUTPUTS_DIR, { recursive: true });
    try {
        const saved = JSON.parse(await readFile(FILE, 'utf8'));
        for (const job of saved) jobs.set(job.id, job);
    } catch { /* first run */ }
    loaded = true;
}

function persist() {
    writing = writing.then(async () => {
        const list = [...jobs.values()].slice(-MAX_JOBS);
        await writeFile(FILE, JSON.stringify(list, null, 1));
    }).catch((err) => console.error('[jobs] could not persist:', err.message));
    return writing;
}

export function get(id) {
    return jobs.get(id) || null;
}

export function put(job) {
    if (!loaded) throw new Error('job store not initialised');
    job.updatedAt = new Date().toISOString();
    jobs.set(job.id, job);
    if (jobs.size > MAX_JOBS) jobs.delete(jobs.keys().next().value);
    persist();
    return job;
}

export function recent(limit = 20) {
    return [...jobs.values()].slice(-limit).reverse();
}

export function outputPath(id) {
    return path.join(OUTPUTS_DIR, `${id}.mp4`);
}
