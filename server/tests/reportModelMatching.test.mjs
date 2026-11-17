import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { matchReportsWithModel as matchReports, warmReportModelFeatures } from '../services/reportModelMatching.js';
import { createReportFeatureStore } from '../services/reportFeatureStore.js';

const matchReportsWithModel = (lost, found, model, options = {}) => matchReports(lost, found, model, { featureStore: null, ...options });

test('selected models compute independent rankings and cache by content and model', async () => {
  const lost = [{ id: 101, description: 'query wallet pilot' }];
  const found = [{ id: 201, description: 'candidate wallet pilot' }, { id: 202, description: 'candidate cup pilot' }];
  const calls = [];
  const fetchAi = async (_url, options) => {
    const request = JSON.parse(options.body); calls.push(request);
    return new Response(JSON.stringify({ model: request.model, items: request.items.map(item => ({
      id: item.id, embedding: item.id.startsWith('lost:') ? [1, 0]
        : ((request.model === 'e5' ? item.id === 'found:201' : item.id === 'found:202') ? [1, 0] : [0, 1]),
    })) }));
  };
  const a = await matchReportsWithModel(lost, found, 'e5', { fetchAi });
  assert.equal(a.pairs[0].found.id, 201);
  await matchReportsWithModel(lost, found, 'e5', { fetchAi });
  assert.equal(calls.length, 1);
  const b = await matchReportsWithModel(lost, found, 'minilm', { fetchAi });
  assert.equal(b.pairs[0].found.id, 202);
  assert.equal(calls.length, 2);
  await matchReportsWithModel([{ ...lost[0], description: 'edited query' }], found, 'e5', { fetchAi });
  assert.equal(calls.length, 3);
  assert.equal(calls[2].items.length, 1);
});

test('missing modalities are excluded explicitly and malformed features fail visibly', async () => {
  const result = await matchReportsWithModel([{ id: 888 }], [{ id: 889 }], 'resnet50');
  assert.equal(result.skipped, 2); assert.equal(result.pairs.length, 0);
  await assert.rejects(() => matchReportsWithModel([{ id: 890, description: 'invalid features query' }], [{ id: 891, description: 'invalid features candidate' }], 'mpnet', {
    fetchAi: async () => new Response(JSON.stringify({ model: 'mpnet', items: [] })),
  }), /incomplete/);
  await assert.rejects(() => matchReportsWithModel([], [], 'toString'), /Unknown/);
});

test('refresh and report revisions invalidate features even when a photo URL is unchanged', async () => {
  const originalStorage = process.env.SUPABASE_URL;
  process.env.SUPABASE_URL = 'https://school.example';
  let revision = 0, calls = 0, photos = 0;
  const lost = [{ id: 9941, image: 'https://school.example/storage/v1/object/public/photos/query.jpg', last_updated: 'v1' }];
  const found = [{ id: 9942, image: 'https://school.example/storage/v1/object/public/photos/candidate.jpg', last_updated: 'v1' }];
  const options = {
    fetchPhoto: async () => { photos++; return new Response(String(revision), { headers: { 'content-type': 'image/jpeg' } }); },
    fetchAi: async (_url, request) => {
      calls++;
      return new Response(JSON.stringify({ model: 'clip', items: JSON.parse(request.body).items.map(item => ({
        id: item.id, embedding: item.id.startsWith('lost:') || revision === 0 ? [1, 0] : [0, 1],
      })) }));
    },
  };
  try {
    assert.equal((await matchReportsWithModel(lost, found, 'clip', options)).pairs[0].score, 1);
    revision = 1;
    await matchReportsWithModel(lost, found, 'clip', options);
    assert.equal(calls, 1);
    assert.equal(photos, 2);
    assert.equal((await matchReportsWithModel(lost, found, 'clip', { ...options, refresh: true })).pairs[0].score, 0);
    assert.equal(calls, 2);
    assert.equal(photos, 4);
    found[0].last_updated = 'v2';
    await matchReportsWithModel(lost, found, 'clip', options);
    assert.equal(calls, 3);
    assert.equal(photos, 5);
  } finally {
    if (originalStorage === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalStorage;
  }
});

test('saved E5 vectors rank immediately without calling AI, while other text models remain independent', async () => {
  const vector = [1, ...Array(767).fill(0)];
  const lost = [{ id: 3101, description: 'saved E5 lost wallet', text_embedding: vector }];
  const found = [{ id: 3102, description: 'saved E5 found wallet', text_embedding: vector }];
  let calls = 0;
  const fetchAi = async (_url, options) => {
    calls++;
    const body = JSON.parse(options.body);
    return new Response(JSON.stringify({ model: body.model, items: body.items.map(item => ({ id: item.id, embedding: vector })) }));
  };
  const options = { fetchAi, featureCache: new Map() };
  assert.equal((await matchReportsWithModel(lost, found, 'e5', options)).pairs[0].score, 1);
  assert.equal(calls, 0);
  await matchReportsWithModel(lost, found, 'minilm', options);
  assert.equal(calls, 1);
  lost[0] = { ...lost[0], description: 'edited E5 wallet', text_embedding: null };
  await matchReportsWithModel(lost, found, 'e5', options);
  assert.equal(calls, 2);
  await matchReportsWithModel(lost, found, 'e5', { ...options, refresh: true });
  assert.equal(calls, 3);
});

test('background image preparation survives a cold memory cache and status changes without new inference', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'lost-found-features-'));
  t.after(() => { assert.ok(directory.startsWith(join(tmpdir(), 'lost-found-features-'))); return rm(directory, { recursive: true, force: true }); });
  const featureStore = createReportFeatureStore(directory);
  const rawVector = [1, ...Array(511).fill(0)];
  const lost = [{ id: 3201, image: 'data:image/png;base64,lost-cache-test', image_embedding: rawVector, last_updated: 'pending' }];
  const found = [{ id: 3202, image: 'data:image/png;base64,found-cache-test', image_embedding: rawVector, last_updated: 'pending' }];
  let calls = 0;
  const options = { featureStore, featureCache: new Map(), fetchAi: async (_url, request) => {
    calls++;
    const body = JSON.parse(request.body);
    return new Response(JSON.stringify({ model: body.model, items: body.items.map(item => ({ id: item.id, embedding: item.id.startsWith('lost:') ? [1, 0] : [0, 1] })) }));
  } };
  await warmReportModelFeatures(lost[0], 'lost', options);
  await warmReportModelFeatures(found[0], 'found', options);
  assert.equal(calls, 2);
  found[0].last_updated = 'approved';
  const cold = { ...options, featureCache: new Map(), featureStore: createReportFeatureStore(directory) };
  assert.equal((await matchReportsWithModel(lost, found, 'clip', cold)).pairs[0].score, 0);
  assert.equal(calls, 2); // Saved raw CLIP vectors were never mixed with prepared-image vectors.
  await matchReportsWithModel(lost, found, 'resnet50', cold);
  assert.equal(calls, 3);
  found[0] = { ...found[0], image_embedding: null, last_updated: 'new photo' };
  await matchReportsWithModel(lost, found, 'clip', cold);
  assert.equal(calls, 4);
});

test('overlapping preparation shares inference and failed requests can retry', async () => {
  const lost = [{ id: 3301, description: 'overlapping lost report' }];
  const found = [{ id: 3302, description: 'overlapping found report' }];
  const featureCache = new Map();
  for (const fail of [true, false]) {
    let release, started, calls = 0;
    const gate = new Promise(resolve => { release = resolve; });
    const began = new Promise(resolve => { started = resolve; });
    const options = { featureCache, fetchAi: async (_url, request) => {
      calls++; started(); await gate;
      if (fail) throw new Error('Temporary inference failure');
      const body = JSON.parse(request.body);
      return new Response(JSON.stringify({ model: body.model, items: body.items.map(item => ({ id: item.id, embedding: [1, 0] })) }));
    } };
    const first = matchReportsWithModel(lost, found, 'mpnet', options);
    await began;
    const second = matchReportsWithModel(lost, found, 'mpnet', options);
    await new Promise(resolve => setImmediate(resolve)); release();
    const results = await Promise.allSettled([first, second]);
    assert.equal(calls, 1);
    assert.ok(results.every(result => result.status === (fail ? 'rejected' : 'fulfilled')));
    if (!fail) assert.ok(results.every(result => result.value.pairs[0].score === 1));
  }
});

test('large report photos are split by serialized bytes and every report is still ranked', async () => {
  const image = 'data:image/jpeg;base64,' + 'A'.repeat(1192300);
  const lost = Array.from({ length: 8 }, (_, id) => ({ id: 4000 + id, image, last_updated: String(id) }));
  const found = [{ id: 5000, image: image + 'AA' }];
  const requests = [];
  const result = await matchReportsWithModel(lost, found, 'clip', {
    featureCache: new Map(),
    fetchAi: async (_url, options) => {
      assert.ok(Buffer.byteLength(options.body) < 4200000);
      const body = JSON.parse(options.body); requests.push(body);
      return new Response(JSON.stringify({ model: body.model, items: body.items.map(row => ({ id: row.id, embedding: [1, 0] })) }));
    },
  });
  assert.ok(requests.length > 1);
  assert.equal(requests.flatMap(body => body.items).length, 9);
  assert.equal(result.query_count, 8);
  assert.equal(result.candidate_count, 1);
  assert.equal(result.pairs.length, 8);
});

test('plain-text hosting failures produce actionable errors and release pending features for retry', async () => {
  const lost = [{ id: 6001, description: 'hosting failure diagnostic' }];
  const options = { featureCache: new Map(), fetchAi: async () => new Response('Request Entity Too Large', { status: 413 }) };
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(() => matchReportsWithModel(lost, [], 'minilm', options), error => {
      assert.equal(error.code, 'AI_PAYLOAD_TOO_LARGE');
      assert.equal(error.status, 502);
      assert.match(error.message, /photo data/);
      assert.doesNotMatch(error.message, /Unexpected token/);
      return true;
    });
  }
});
