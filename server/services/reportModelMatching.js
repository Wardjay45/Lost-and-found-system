import { createHash } from 'node:crypto';
import { aiFetch, readAiJson } from './aiClient.js';
import { reportFeatureStore } from './reportFeatureStore.js';

export const REPORT_MODELS = {
  clip: { name: 'CLIP ViT-B/32', mode: 'image' },
  resnet50: { name: 'ResNet50', mode: 'image' },
  'efficientnet-b0': { name: 'EfficientNet-B0', mode: 'image' },
  e5: { name: 'E5-base-v2', mode: 'text' },
  minilm: { name: 'all-MiniLM-L6-v2', mode: 'text' },
  mpnet: { name: 'all-mpnet-base-v2', mode: 'text' },
};

const cache = new Map();
const inFlightByCache = new WeakMap();
const MAX_CACHE = 1024;
const TTL = 5 * 60 * 1000;
// Leave headroom below Vercel's 4.5 MB limit, including JSON and UTF-8 bytes.
const MAX_REQUEST_BYTES = 4200000;

function* embeddingBatches(rows, model) {
  const envelopeBytes = Buffer.byteLength(JSON.stringify({ model, items: [] }));
  let batch = [], bytes = envelopeBytes;
  for (const row of rows) {
    const itemBytes = Buffer.byteLength(JSON.stringify(row.input));
    if (envelopeBytes + itemBytes > MAX_REQUEST_BYTES) throw new Error('A report photo exceeds the matching request size limit.');
    if (batch.length && (batch.length === 8 || bytes + 1 + itemBytes > MAX_REQUEST_BYTES)) {
      yield batch;
      batch = []; bytes = envelopeBytes;
    }
    bytes += itemBytes + (batch.length ? 1 : 0);
    batch.push(row);
  }
  if (batch.length) yield batch;
}

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

export async function matchReportsWithModel(lostItems, foundItems, model, {
  fetchAi = aiFetch, fetchPhoto = fetch, refresh = false,
  featureStore = reportFeatureStore, featureCache = cache,
} = {}) {
  if (!Object.hasOwn(REPORT_MODELS, model)) throw new Error('Unknown matching model.');
  const spec = REPORT_MODELS[model];
  const rows = [];
  let skipped = 0;
  for (const [kind, items] of [['lost', lostItems], ['found', foundItems]]) {
    for (const item of items) {
      const content = spec.mode === 'text' ? item.description?.trim() : item.image_url || item.image;
      if (!content) { skipped++; continue; }
      // Text depends on its content, not status timestamps. Photo revisions are
      // retained because bytes can be replaced at an unchanged Storage URL.
      const imageRevision = Array.isArray(item.image_embedding) && item.image_embedding.length === 512
        ? item.image_embedding : item.last_updated || '';
      const key = `${model}:report-image-v1:${createHash('sha256').update(JSON.stringify([content, spec.mode === 'image' ? imageRevision : ''])).digest('hex')}`;
      rows.push({ item, kind, id: `${kind}:${item.id}`, key, content });
    }
  }
  for (let start = 0; start < rows.length; start += 8) {
    await Promise.all(rows.slice(start, start + 8).map(async row => {
      const cached = featureCache.get(row.key);
      if (cached && cached.expires <= Date.now()) featureCache.delete(row.key);
      row.vector = refresh ? undefined : featureCache.get(row.key)?.vector;
      if (!refresh && !row.vector) {
        // E5 uses the same model and query prefix as /embedding/text. Other
        // models, including CLIP's report-photo preprocessing, stay isolated.
        const stored = model === 'e5' && row.item.text_embedding;
        if (Array.isArray(stored) && stored.length === 768) {
          try { row.vector = normalize(stored); } catch { /* Prepare invalid stored features again. */ }
        }
        if (!row.vector && featureStore) {
          const vector = await featureStore.get(row.key);
          if (vector) { try { row.vector = normalize(vector); } catch { /* Rebuild a corrupt cache entry. */ } }
        }
      }
      if (row.vector) {
        featureCache.set(row.key, { vector: row.vector, expires: Date.now() + TTL });
      } else {
        try {
          row.input = spec.mode === 'text' ? { id: row.id, text: row.content } : { id: row.id, image: await reportPhoto(row.content, fetchPhoto) };
        } catch { row.skipped = true; skipped++; }
      }
    }));
  }
  const prepared = rows.filter(row => !row.skipped);
  // Background report preparation and an open admin page can overlap. Share
  // unfinished features rather than sending the same photo to the AI twice.
  if (!refresh) for (const row of prepared) row.vector ||= featureCache.get(row.key)?.vector;
  const pending = prepared.filter(row => !row.vector);
  let inFlight = inFlightByCache.get(featureCache);
  if (!inFlight) { inFlight = new Map(); inFlightByCache.set(featureCache, inFlight); }
  const owned = [];
  for (const row of pending) {
    row.requestKey = refresh ? Symbol(row.key) : row.key;
    row.request = inFlight.get(row.requestKey);
    if (!row.request) {
      const request = {};
      request.promise = new Promise((resolve, reject) => { request.resolve = resolve; request.reject = reject; });
      request.promise.catch(() => {}); // A later batch can fail before this row is awaited.
      row.request = request; inFlight.set(row.requestKey, request); owned.push(row);
    }
  }
  try {
    for (const batch of embeddingBatches(owned, model)) {
      const response = await fetchAi(`${process.env.AI_SERVER_URL || 'http://localhost:8000'}/comparison/embeddings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, items: batch.map(row => row.input) }),
      });
      const data = await readAiJson(response);
      if (data.model !== model || !Array.isArray(data.items) || data.items.length !== batch.length || new Set(data.items.map(row => row.id)).size !== batch.length) throw new Error('The AI service returned incomplete report features.');
      for (const row of batch) {
        row.vector = normalize(data.items.find(result => result.id === row.id)?.embedding);
        featureCache.delete(row.key);
        featureCache.set(row.key, { vector: row.vector, expires: Date.now() + TTL });
      }
      if (featureStore) await Promise.all(batch.map(row => featureStore.set(row.key, row.vector)));
      for (const row of batch) { row.request.resolve(row.vector); inFlight.delete(row.requestKey); }
    }
  } catch (error) {
    for (const row of owned) {
      row.request.reject(error);
      if (inFlight.get(row.requestKey) === row.request) inFlight.delete(row.requestKey);
    }
    throw error;
  }
  await Promise.all(pending.map(async row => { row.vector = await row.request.promise; }));
  while (featureCache.size > MAX_CACHE) featureCache.delete(featureCache.keys().next().value);
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

// Run during report preparation, without creating or confirming a match.
export async function warmReportModelFeatures(item, kind, options = {}) {
  if (!item?.image && !item?.image_url) return;
  if (!['lost', 'found'].includes(kind)) throw new Error('Unknown report type.');
  await matchReportsWithModel(kind === 'lost' ? [item] : [], kind === 'found' ? [item] : [], 'clip', options);
}
