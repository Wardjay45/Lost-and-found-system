import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import express from 'express';

const require = createRequire(import.meta.url);
test('matching endpoints keep additional info, category, dates, and found condition in the compared reports', async t => {
  const lost = { id: 11, item_id: 'LOST-11', description: 'Black tumbler', location_lost: 'AB BUILDING', location_details: 'Beside the stairs\nSecond floor', category_name: 'Accessories', reporter_name: 'Owner', status: 'active', date_reported: '2026-10-21', last_updated: '2026-10-21', text_embedding: [1] };
  const found = { id: 22, item_id: 'FOUND-22', description: 'Black water bottle', location_found: 'Library', location_details: 'Near the front desk', category_name: 'Accessories', finder_name: 'Finder', status: 'active', date_found: '2026-10-20', condition: 'Good', text_embedding: [1] };
  const client = { from(table) { return { select() { return { eq() { return {
    single: async () => ({ data: table === 'lost_items' ? lost : found, error: null }),
    limit: async () => ({ data: [table === 'lost_items' ? lost : found], error: null }),
    order: () => ({ limit: async () => ({ data: [{ details: JSON.stringify({ lost_item_id: 11, found_item_id: 22 }) }], error: null }) }),
  }; } }; } }; } };
  globalThis.matchDetailsTestClient = client;
  const sourceUrl = new URL('../routes/ai.js', import.meta.url);
  const source = readFileSync(sourceUrl, 'utf8').replace(/from '([^']+)'/g, (_match, specifier) => {
    const url = specifier === '../db.js' ? 'data:text/javascript,export default globalThis.matchDetailsTestClient' : specifier.startsWith('.') ? new URL(specifier, sourceUrl).href : pathToFileURL(require.resolve(specifier)).href;
    return `from ${JSON.stringify(url)}`;
  });
  const router = (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default;
  const app = express(); app.use(express.json()); app.use('/', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const httpFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ matches: [{ id: 22, score: .86, image_score: .85, text_score: .88 }] }) });
  t.after(async () => { globalThis.fetch = httpFetch; delete globalThis.matchDetailsTestClient; await new Promise(resolve => server.close(resolve)); });
  for (const endpoint of ['/auto-match', '/match-for-item/11/lost_items', '/match-for-item/22/found_items']) {
    const response = await httpFetch(`http://127.0.0.1:${server.address().port}${endpoint}`, { method: endpoint === '/auto-match' ? 'POST' : 'GET' });
    assert.equal(response.status, 200);
    const data = await response.json(), pair = data.match || data.matches[0];
    assert.equal(pair.lost_item.location_details, 'Beside the stairs\nSecond floor');
    assert.equal(pair.found_item.location_details, 'Near the front desk');
    assert.equal(pair.found_item.condition, 'Good');
    assert.equal(pair.lost_item.date_reported, '2026-10-21');
    assert.equal(pair.found_item.date_found, '2026-10-20');
    assert.equal(pair.found_item.finder_name, 'Finder');
    assert.equal(pair.found_item.category_name, 'Accessories');
    assert.equal(Object.hasOwn(pair.lost_item, 'text_embedding'), false);
  }
});
