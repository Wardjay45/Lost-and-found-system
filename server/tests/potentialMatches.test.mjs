import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createActivityLogsRouter } from '../routes/activityLogs.js';
import { loadSavedPotentialMatch } from '../services/potentialMatches.js';

function fixture() {
  const rows = { users: [{ id: 7, name: 'QA Admin', role: 'admin', status: 'active' }], lost_items: [{ id: 11, item_id: 'L11', status: 'active', description: 'Lost cube', reporter_id: 8 }], found_items: [{ id: 22, item_id: 'F22', status: 'active', description: 'Found cube' }, { id: 23, item_id: 'F23', status: 'active', description: 'Other' }], matches: [], activity_logs: [] };
  const operations = []; let failure = '';
  const client = { from(table) {
    let filters = [], patch, inserted, sorted = false;
    const execute = async () => {
      const kind = inserted ? 'insert' : patch ? 'update' : 'read';
      if (failure === kind + ':' + table) return { data: null, error: Error('offline') };
      if (inserted) { const row = { id: rows[table].length + 1, ...inserted }; rows[table].push(row); operations.push('insert:' + table); return { data: [row], error: null }; }
      const selected = rows[table].filter(row => filters.every(fn => fn(row)));
      if (patch) { selected.forEach(row => Object.assign(row, patch)); operations.push('update:' + table + ':' + patch.status); }
      return { data: structuredClone(sorted ? [...selected].reverse() : selected), error: null };
    };
    const query = {
      select() { return this; }, eq(field, value) { filters.push(row => String(row[field]) === String(value)); return this; },
      in(field, values) { filters.push(row => values.includes(row[field])); return this; }, order() { sorted = true; return this; },
      update(fields) { patch = fields; return this; }, insert(fields) { inserted = fields; return this; },
      async range(a, b) { const result = await execute(); return { ...result, data: result.data?.slice(a, b + 1) }; },
      async single() { const result = await execute(); return { ...result, data: result.data?.[0] || null }; },
      async maybeSingle() { return this.single(); }, then(resolve, reject) { return execute().then(resolve, reject); },
    }; return query;
  } };
  return { rows, operations, client, fail: value => { failure = value; } };
}
const entry = (lost = 11, found = 22) => ({ id: 1, action: 'match', timestamp: '2026-10-29', details: { lost_item_id: String(lost), found_item_id: String(found), score: .86 } });

test('saved lookup reads correct-side object/string logs and legacy matches, never nearby timestamps', async () => {
  const f = fixture(); f.rows.activity_logs.push(entry());
  assert.equal((await loadSavedPotentialMatch(f.client, '11', 'lost_items')).found_item.id, 22);
  assert.equal((await loadSavedPotentialMatch(f.client, 22, 'found_items')).lost_item.id, 11);
  assert.equal(await loadSavedPotentialMatch(f.client, 11, 'found_items'), null);
  f.rows.activity_logs[0].details = JSON.stringify(f.rows.activity_logs[0].details);
  assert.equal((await loadSavedPotentialMatch(f.client, 11, 'lost_items')).score, .86);
  f.rows.activity_logs.length = 0; f.rows.matches.push({ id: 1, lost_item_id: 11, found_item_id: 22, status: 'potential_match', confidence: null });
  const legacy = await loadSavedPotentialMatch(f.client, 11, 'lost_items'); assert.equal(legacy.found_item.id, 22); assert.equal(legacy.score, undefined);
  f.rows.matches.length = 0; assert.equal(await loadSavedPotentialMatch(f.client, 11, 'lost_items'), null);
});
test('conflicting associations, unavailable reports and database errors cannot become a guessed pair', async () => {
  const f = fixture(); f.rows.activity_logs.push(entry(), { ...entry(11, 23), id: 2, timestamp: '2026-10-30' });
  await assert.rejects(loadSavedPotentialMatch(f.client, 22, 'found_items'), /association has changed/);
  f.rows.activity_logs.length = 0; f.rows.matches.push({ id: 1, lost_item_id: 11, found_item_id: 22, status: 'confirmed' }, { id: 2, lost_item_id: 11, found_item_id: 23, status: 'confirmed' });
  await assert.rejects(loadSavedPotentialMatch(f.client, 11, 'lost_items'), /conflicting/);
  f.rows.matches.pop(); f.rows.found_items.length = 0;
  await assert.rejects(loadSavedPotentialMatch(f.client, 11, 'lost_items'), /unavailable/);
  f.fail('read:activity_logs'); await assert.rejects(loadSavedPotentialMatch(f.client, 11, 'lost_items'), /offline/);
});
test('server saves the association before statuses, rejects failures safely, retries idempotently and protects paired lookups', async t => {
  const f = fixture(), secret = 'isolated-pair-test';
  const app = express(); app.use(express.json()); app.use('/', createActivityLogsRouter({ client: f.client, jwtSecret: secret }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const token = jwt.sign({ id: 7, role: 'admin' }, secret);
  const call = (body, path = '/', session = token) => fetch('http://127.0.0.1:' + server.address().port + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session }, body: body && JSON.stringify(body) });
  const body = { action: 'match', mark_potential: true, details: JSON.stringify({ lost_item_id: 11, found_item_id: 22, score: .86 }) };
  assert.equal((await call(null, '/match/lost_items/11', 'bad')).status, 401);
  f.fail('insert:activity_logs'); assert.equal((await call(body)).status, 503); assert.equal(f.rows.activity_logs.length, 0); assert.equal(f.rows.found_items[0].status, 'active');
  f.fail('update:lost_items'); assert.equal((await call(body)).status, 503);
  assert.equal(f.rows.activity_logs.length, 1); assert.equal(f.rows.found_items[0].status, 'active'); assert.equal(f.rows.lost_items[0].status, 'active');
  assert.equal(f.operations[0], 'insert:activity_logs');
  f.fail(''); assert.equal((await call(body)).status, 200); assert.equal(f.rows.activity_logs.length, 1);
  assert.equal(f.rows.lost_items[0].status, 'potential_match'); assert.equal(f.rows.found_items[0].status, 'potential_match');
  assert.equal((await (await call(null, '/match/lost_items/11')).json()).match.found_item.id, 22);
  assert.equal((await call(body)).status, 200); assert.equal(f.rows.activity_logs.length, 1);
  assert.equal((await call({ ...body, details: JSON.stringify({ lost_item_id: 11, found_item_id: 23, score: .9 }) })).status, 409);
  f.rows.lost_items[0].status = 'claimed'; assert.equal((await call(body)).status, 409);
  assert.equal((await call(null, '/match/users/11')).status, 400);
  // Cancel Approval returns reports to active. A historical matches row must not
  // prevent the administrator from selecting a new pair through Smart Matching.
  f.rows.lost_items[0].status = 'active'; f.rows.found_items[0].status = 'active';
  f.rows.matches.push({ id: 1, lost_item_id: 11, found_item_id: 22, status: 'potential_match' });
  const rematch = await call({ ...body, details: JSON.stringify({ lost_item_id: 11, found_item_id: 23, score: .9 }) });
  assert.equal(rematch.status, 201);
  assert.equal((await loadSavedPotentialMatch(f.client, 11, 'lost_items')).found_item.id, 23);

});
