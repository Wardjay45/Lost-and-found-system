import test from 'node:test';
import assert from 'node:assert/strict';
import { searchMatches } from '../src/services/matching.mjs';

test('mobile search sends description and photo to the existing multimodal API and preserves real scores', async () => {
  let request;
  const result = await searchMatches({ apiUrl: 'https://example.test/api/', token: 'session', description: ' Blue bag ', image: 'data:image/png;base64,AA==' }, async (url, options) => {
    request = { url, ...options };
    return { ok: true, json: async () => ({ matches: [{ id: 1, score: .86, image_score: .9, text_score: .76, status: 'active' }, { id: 2, status: 'claimed' }] }) };
  });
  assert.equal(request.url, 'https://example.test/api/ai/match');
  assert.equal(request.headers.Authorization, 'Bearer session');
  assert.deepEqual(JSON.parse(request.body), { item_type: 'lost', description: 'Blue bag', image_base64: 'data:image/png;base64,AA==' });
  assert.equal(result.length, 1);
  assert.equal(result[0].score, .86);
  assert.equal(result[0].image_score, .9);
});

test('empty search and failed AI calls stay distinct from a successful empty result', async () => {
  await assert.rejects(searchMatches({ apiUrl: 'https://example.test' }), /description or photo/);
  await assert.rejects(searchMatches({ apiUrl: 'https://example.test', description: 'bag' }, async () => ({ ok: false, json: async () => ({ error: 'AI unavailable' }) })), /AI unavailable/);
  assert.deepEqual(await searchMatches({ apiUrl: 'https://example.test', description: 'bag' }, async () => ({ ok: true, json: async () => ({ matches: [] }) })), []);
});
