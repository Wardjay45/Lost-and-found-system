import { createHash } from 'node:crypto';
import { aiFetch } from './aiClient.js';

export const REPORT_MODELS = {
  clip: { name: 'CLIP ViT-B/32', mode: 'image' },
  resnet50: { name: 'ResNet50', mode: 'image' },
  'efficientnet-b0': { name: 'EfficientNet-B0', mode: 'image' },
  e5: { name: 'E5-base-v2', mode: 'text' },
  minilm: { name: 'all-MiniLM-L6-v2', mode: 'text' },
  mpnet: { name: 'all-mpnet-base-v2', mode: 'text' },
};

const cache = new Map();
const MAX_CACHE = 1024;
const TTL = 5 * 60 * 1000;

async function reportPhoto(value, fetchPhoto) {
  if (value.startsWith('data:image/')) {
    if (value.length > 4100000) throw new Error('Photo exceeds the matching size limit.');
    return value;
  }
  const url = new URL(value);
  const storage = new URL(process.env.SUPABASE_URL);
  if (url.protocol !== 'https:' || url.origin !== storage.origin) throw new Error('Photo is not in the configured school storage.');
  const response = await fetchPhoto(url, { redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!response.ok || Number(response.headers.get('content-length')) > 3000000) throw new Error('Photo unavailable or too large.');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 3000000) throw new Error('Photo exceeds the matching size limit.');
  const type = response.headers.get('content-type') || 'image/jpeg';
  if (!type.startsWith('image/')) throw new Error('Invalid report photo.');
  return `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
}

function normalize(vector) {
  if (!Array.isArray(vector) || !vector.length || vector.length > 4096 || !vector.every(Number.isFinite)) throw new Error('The AI service returned invalid features.');
  const norm = Math.hypot(...vector);
  if (!norm) throw new Error('The AI service returned empty features.');
  return Float32Array.from(vector, value => value / norm);
}

function cosine(a, b) {
  if (a.length !== b.length) throw new Error('The AI service returned inconsistent feature dimensions.');
  let score = 0;
  for (let i = 0; i < a.length; i++) score += a[i] * b[i];
  return Math.max(-1, Math.min(1, score));
}

export async function matchReportsWithModel(lostItems, foundItems, model, { fetchAi = aiFetch, fetchPhoto = fetch } = {}) {
  if (!Object.hasOwn(REPORT_MODELS, model)) throw new Error('Unknown matching model.');
  const spec = REPORT_MODELS[model];
  const prepared = [];
  let skipped = 0;
  for (const [kind, items] of [['lost', lostItems], ['found', foundItems]]) {
    for (const item of items) {
      const content = spec.mode === 'text' ? item.description?.trim() : item.image_url || item.image;
      if (!content) { skipped++; continue; }
      const key = `${model}:v1:${createHash('sha256').update(content).digest('hex')}`;
      const cached = cache.get(key);
      if (cached && cached.expires <= Date.now()) cache.delete(key);
      const row = { item, kind, id: `${kind}:${item.id}`, key, vector: cache.get(key)?.vector };
      if (!row.vector) {
        try {
          row.input = spec.mode === 'text' ? { id: row.id, text: content } : { id: row.id, image: await reportPhoto(content, fetchPhoto) };
        } catch { skipped++; continue; }
      }
      prepared.push(row);
    }
  }
  const pending = prepared.filter(row => !row.vector);
  for (let start = 0; start < pending.length; start += 8) {
    const batch = pending.slice(start, start + 8);
    const response = await fetchAi(`${process.env.AI_SERVER_URL || 'http://localhost:8000'}/comparison/embeddings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, items: batch.map(row => row.input) }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `${spec.name} could not process these reports.`);
    if (data.model !== model || !Array.isArray(data.items) || data.items.length !== batch.length || new Set(data.items.map(row => row.id)).size !== batch.length) throw new Error('The AI service returned incomplete report features.');
    for (const row of batch) {
      row.vector = normalize(data.items.find(result => result.id === row.id)?.embedding);
      cache.delete(row.key);
      cache.set(row.key, { vector: row.vector, expires: Date.now() + TTL });
      if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
    }
  }
  const queries = prepared.filter(row => row.kind === 'lost');
  const candidates = prepared.filter(row => row.kind === 'found');
  const pairs = [];
  for (const query of queries) {
    const ranked = candidates.map(candidate => ({ lost: query.item, found: candidate.item, score: cosine(query.vector, candidate.vector) }));
    ranked.sort((a, b) => b.score - a.score);
    pairs.push(...ranked.slice(0, 5));
  }
  pairs.sort((a, b) => b.score - a.score);
  return { pairs, skipped, query_count: queries.length, candidate_count: candidates.length, mode: spec.mode, model_name: spec.name };
}
