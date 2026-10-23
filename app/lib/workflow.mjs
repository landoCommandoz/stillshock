// Builds a ready-to-submit API-format workflow from the LTX-2.5 image-to-video template in
// ../workflows and a small "map" file that says which node inputs to set.
//
// The map format (workflows/ltx25_i2v.map.json):
// {
//   "image":   { "node": "395", "input": "image" },          // LoadImage filename -> core/ASSET object
//   "prompt":  { "node": "12",  "input": "text" },
//   "seed":    { "node": "20",  "input": "seed" },
//   "width":   { "node": "20",  "input": "width" },
//   "height":  { "node": "20",  "input": "height" },
//   "frames":  { "node": "20",  "input": "length" },         // or "duration" (seconds) if the graph uses it
//   "fps":     { "node": "30",  "input": "frame_rate" },
//   "prefix":  { "node": "75",  "input": "filename_prefix" }
// }
// Any key may be missing; it is then simply not set.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { framesFor, FPS } from './effects.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const WORKFLOWS_DIR = path.join(ROOT, 'workflows');

let cache = null;

export async function loadTemplate(name = 'ltx25_i2v') {
    if (cache && cache.name === name) return cache;
    const graph = JSON.parse(await readFile(path.join(WORKFLOWS_DIR, `${name}.api.json`), 'utf8'));
    const map = JSON.parse(await readFile(path.join(WORKFLOWS_DIR, `${name}.map.json`), 'utf8'));
    cache = { name, graph, map };
    return cache;
}

function setInput(graph, target, value) {
    if (!target) return false;
    const node = graph[target.node];
    if (!node) throw new Error(`Workflow map points at node ${target.node}, which is not in the graph`);
    if (!node.inputs) node.inputs = {};
    node.inputs[target.input] = value;
    return true;
}

export async function buildWorkflow({ assetId, assetHash, fileName, prompt, width, height, durationSeconds, seed, prefix = 'stillshock' }) {
    const { graph: template, map } = await loadTemplate();
    const graph = structuredClone(template);

    setInput(graph, map.image, { __type: 'core/ASSET', info: { id: assetId, hash: assetHash || undefined, file_path: fileName } });
    setInput(graph, map.prompt, prompt);
    if (map.seed) setInput(graph, map.seed, seed ?? Math.floor(Math.random() * 2 ** 48));
    setInput(graph, map.width, width);
    setInput(graph, map.height, height);
    if (map.duration) setInput(graph, map.duration, durationSeconds);
    if (map.frames) setInput(graph, map.frames, framesFor(durationSeconds, FPS));
    if (map.fps) setInput(graph, map.fps, FPS);
    if (map.prefix) setInput(graph, map.prefix, prefix);
    return graph;
}
