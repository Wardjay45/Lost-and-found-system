import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createAnalyticsRouter } from '../routes/analytics.js';

test('category endpoint authenticates, separates sources and handles database and AI failures', async t => {
  const secret = 'category-forecast-isolated';
  let failDb = false, failAi = false;
  const calls = [];
  const client = { from(table) { return { select(columns) {
    if (table === 'users') return { eq: () => ({ maybeSingle: async () => ({ data: { id: 7, role: 'admin', status: 'active' } }) }) };
    if (table !== 'categories') assert.match(columns, /category_id,category_name,created_at:date_(reported|found)/);
    return { order: () => ({ range: async () => ({ data: table === 'categories' ? [{ id: 1, name: 'Keys' }] : [], error: failDb ? new Error('private db detail') : null }) }) };
  } }; } };
  const app = express();
  app.use('/api/analytics', createAnalyticsRouter({ client, jwtSecret: secret, fetcher: async (url, options) => {
    calls.push({ url, options });
    return { ok: !failAi, status: failAi ? 500 : 200, json: async () => ({ categories: [], dataset: {}, protocol: {} }) };
  } }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = 'http://127.0.0.1:' + server.address().port + '/api/analytics/category-forecast';
  const headers = { Authorization: 'Bearer ' + jwt.sign({ id: 7, role: 'admin' }, secret) };
  assert.equal((await fetch(base)).status, 401);
  assert.equal(calls.length, 0);
  assert.equal((await fetch(base + '?source=invalid', { headers })).status, 400);
  assert.equal((await fetch(base + '?source=historical&itemType=lost', { headers })).status, 200);
  assert.equal(calls.at(-1).options.method, undefined);
  assert.match(calls.at(-1).url, /category-forecast\?itemType=lost$/);
  for (const itemType of ['lost', 'found']) {
    const response = await fetch(base + '?source=current&itemType=' + itemType, { headers });
    assert.equal(response.status, 200);
    const payload = JSON.parse(calls.at(-1).options.body);
    assert.equal(payload.dataset.record_type, itemType + '_items');
    assert.deepEqual(payload.historical, []);
    assert.deepEqual(payload.categories, ['Keys']);
  }
  failDb = true;
  assert.equal((await fetch(base + '?source=current', { headers })).status, 503);
  failDb = false; failAi = true;
  const response = await fetch(base + '?source=historical', { headers });
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private db detail/);
});
