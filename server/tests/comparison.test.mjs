import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createComparisonRouter } from '../services/comparisonRouter.js';

test('comparison proxy preserves input, result and validation errors', async () => {
  const app = express(); app.use(express.json());
  app.use('/comparison', createComparisonRouter(async (url, options) => {
    assert.ok(url.endsWith('/comparison/run'));
    const input = JSON.parse(options.body);
    return input.model === 'e5'
      ? new Response(JSON.stringify({ model: 'e5', ranking: [{ id: 'a', score: .8 }] }))
      : new Response(JSON.stringify({ detail: [{ msg: 'invalid' }] }), { status: 422 });
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/comparison/run`;
    const request = model => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) });
    assert.equal((await (await request('e5')).json()).ranking[0].score, .8);
    assert.equal((await request('invalid')).status, 422);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
