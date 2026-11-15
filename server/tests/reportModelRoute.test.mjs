import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

test('click-selected model matches saved active reports and returns model-specific cards without database writes', async t => {
  const rows = {
    lost_items: [{ id: 8701, status: 'active', description: 'route test lost wallet', location_lost: 'Library' }],
    found_items: [{ id: 8702, status: 'active', description: 'route test found wallet', location_found: 'Office' }],
  };
  globalThis.reportModelRouteDb = { from(table) { return { select() { return { eq(column, value) {
    assert.equal(column, 'status'); assert.equal(value, 'active');
    return { limit: async () => ({ data: rows[table], error: null }) };
  } }; } }; } };
  const sourceUrl = new URL('../routes/ai.js', import.meta.url);
  const require = createRequire(import.meta.url);
  const source = readFileSync(sourceUrl, 'utf8').replace(/from '([^']+)'/g, (_, specifier) => `from ${JSON.stringify(
    specifier === '../db.js' ? 'data:text/javascript,export default globalThis.reportModelRouteDb'
      : specifier.startsWith('.') ? new URL(specifier, sourceUrl).href : pathToFileURL(require.resolve(specifier)).href)}`);
  const app = express(); app.use(express.json()); app.use((await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.ok(String(url).endsWith('/comparison/embeddings'));
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'minilm');
    assert.deepEqual(body.items.map(row => row.id), ['lost:8701', 'found:8702']);
    return new Response(JSON.stringify({ model: body.model, items: body.items.map(item => ({ id: item.id, embedding: [1, 0] })) }));
  };
  t.after(async () => { globalThis.fetch = originalFetch; delete globalThis.reportModelRouteDb; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const url = `http://127.0.0.1:${server.address().port}/auto-match`;
  const response = await originalFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'minilm' }) });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.matches[0].model_name, 'all-MiniLM-L6-v2');
  assert.equal(data.matches[0].matching_mode, 'text');
  assert.equal(data.matches[0].image_score, null);
  assert.equal(data.matches[0].text_score, 1);
  assert.equal(data.matches[0].found_item.location, 'Office');
  assert.equal(Object.hasOwn(data.matches[0].found_item, 'text_embedding'), false);
  const invalid = await originalFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'toString' }) });
  assert.equal(invalid.status, 400);
  rows.lost_items = [];
  const empty = await originalFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'minilm' }) });
  const emptyData = await empty.json();
  assert.equal(emptyData.model, 'minilm');
  assert.deepEqual(emptyData.matches, []);
});
