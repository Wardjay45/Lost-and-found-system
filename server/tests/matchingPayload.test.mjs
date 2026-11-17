import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

test('compact matching keeps large inline photos out of results and serves one protected photo at a time', async t => {
  const image = 'data:image/jpeg;base64,' + 'A'.repeat(1200000);
  const lost = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, image, description: 'wallet', text_embedding: [1, ...Array(767).fill(0)], last_updated: '2026-11-17' }));
  const found = [{ ...lost[0], id: 20 }];
  let fail = false;
  globalThis.matchingPayloadDb = { from(table) { return { select(columns) { return { eq(field, value) {
    const rows = table === 'lost_items' ? lost : found;
    return {
      limit: async () => ({ data: rows, error: null }),
      order() { return this; },
      range: async (start, end) => {
        assert.ok(!columns.split(',').includes('image'));
        return { data: rows.slice(start, end + 1), error: null };
      },
      maybeSingle: async () => {
        assert.equal(columns, 'image'); assert.equal(field, 'id');
        return { data: rows.find(row => row.id === value), error: fail ? new Error('Database unavailable') : null };
      },
    };
  } }; } }; } };
  const require = createRequire(import.meta.url);
  const sourceUrl = new URL('../routes/ai.js', import.meta.url);
  const source = readFileSync(sourceUrl, 'utf8').replace(/from '([^']+)'/g, (_, specifier) => `from ${JSON.stringify(
    specifier === '../db.js' ? 'data:text/javascript,export default globalThis.matchingPayloadDb'
      : specifier.startsWith('.') ? new URL(specifier, sourceUrl).href : pathToFileURL(require.resolve(specifier)).href)}`);
  const app = express(); app.use(express.json());
  app.use('/api/ai', (req, res, next) => req.headers.authorization === 'Bearer test-admin' ? next() : res.sendStatus(401));
  app.use('/api/ai', (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { delete globalThis.matchingPayloadDb; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const headers = { Authorization: 'Bearer test-admin', 'Content-Type': 'application/json' };
  const response = await fetch(base + '/ai/auto-match', { method: 'POST', headers, body: JSON.stringify({ model: 'e5', compact: true }) });
  assert.equal(response.status, 200);
  const body = await response.text(); assert.ok(Buffer.byteLength(body) < 20000);
  const result = JSON.parse(body); assert.equal(result.matches.length, 8);
  const report = result.matches[0].lost_item;
  assert.equal(report.image, null); assert.match(report.image_endpoint, /^\/ai\/report-photo\/lost\/1\?v=/);
  assert.equal((await fetch(base + report.image_endpoint)).status, 401);
  const photo = await fetch(base + report.image_endpoint, { headers });
  assert.equal(photo.status, 200); assert.equal(photo.headers.get('cache-control'), 'private, no-store');
  assert.equal((await photo.json()).image, image);
  assert.equal((await fetch(base + '/ai/report-photo/users/1', { headers })).status, 400);
  assert.equal((await fetch(base + '/ai/report-photo/lost/999', { headers })).status, 404);
  fail = true;
  assert.equal((await fetch(base + report.image_endpoint, { headers })).status, 503);
});
