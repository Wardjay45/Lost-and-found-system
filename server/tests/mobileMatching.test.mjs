import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

test('search excludes returned and cancelled items before ranking and preserves stored image URLs', async t => {
  const records = Array.from({ length: 12 }, (_, id) => ({ id: id + 1, status: id < 10 ? 'claimed' : 'active', image_url: 'https://example.test/item.jpg' }));
  let eligible;
  const client = { from() { return { select() {
    return { in(_column, statuses) { eligible = records.filter(row => statuses.includes(row.status)); return { limit: async () => ({ data: eligible, error: null }) }; },
      limit: async () => ({ data: records, error: null }) };
  } }; } };
  globalThis.mobileMatchingClient = client;
  const require = createRequire(import.meta.url), sourceUrl = new URL('../routes/ai.js', import.meta.url);
  const source = readFileSync(sourceUrl, 'utf8').replace(/from '([^']+)'/g, (_, specifier) => `from ${JSON.stringify(specifier === '../db.js' ? 'data:text/javascript,export default globalThis.mobileMatchingClient' : specifier.startsWith('.') ? new URL(specifier, sourceUrl).href : pathToFileURL(require.resolve(specifier)).href)}`);
  const app = express(); app.use(express.json()); app.use('/', (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const httpFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.deepEqual(body.stored_items.map(item => item.id), [11, 12]);
    return { ok: true, json: async () => ({ matches: [{ id: 11, score: .86, image_score: .9, text_score: .76 }] }) };
  };
  t.after(async () => { globalThis.fetch = httpFetch; delete globalThis.mobileMatchingClient; await new Promise(resolve => server.close(resolve)); });
  const response = await httpFetch(`http://127.0.0.1:${server.address().port}/match`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_type: 'lost', description: 'bag' }) });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.matches[0].id, 11);
  assert.equal(data.matches[0].image, 'https://example.test/item.jpg');
});
