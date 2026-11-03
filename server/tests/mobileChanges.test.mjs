import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createMobileChangesRouter, mobileLiveTables } from '../services/mobileChanges.js';
import { createProductionAccess } from '../services/productionAccess.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function setup(t) {
  let current = { id: 9, role: 'student', status: 'active' }, removed = 0, subscriptions = 0;
  const callbacks = new Map(); let status;
  const db = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: current, error: null }) }) }) }),
    channel() { subscriptions++; return {
      on(_event, filter, callback) { callbacks.set(filter.table, callback); return this; },
      subscribe(callback) { status = callback; callback('SUBSCRIBED'); return this; },
    }; },
    async removeChannel() { removed++; },
  };
  const app = express(); app.use(createProductionAccess(db, { jwtSecret: 'live-test' }));
  app.use('/mobile/changes', createMobileChangesRouter(db, { waitMs: 100, idleMs: 500 }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const token = jwt.sign({ id: 9, role: 'student' }, 'live-test');
  const call = (cursor = '', options = {}) => fetch('http://127.0.0.1:' + server.address().port + '/mobile/changes?cursor=' + encodeURIComponent(cursor), { headers: { Authorization: 'Bearer ' + token }, ...options });
  return { call, callbacks, emit: table => callbacks.get(table)({ new: { text: 'PRIVATE', reporter_id: 99 } }), status: value => status(value), suspend: () => { current.status = 'suspended'; }, stats: () => ({ removed, subscriptions }) };
}
test('authenticated mobile long polls receive invalidations immediately without exposing any row data', async t => {
  const app = await setup(t);
  assert.equal((await app.call('', { headers: {} })).status, 401);
  const first = await (await app.call()).json();
  assert.deepEqual(first.tables, ['all']); assert.equal(first.realtime, true);
  assert.deepEqual([...app.callbacks.keys()], mobileLiveTables);
  const pending = app.call(first.cursor);
  await sleep(5); app.emit('messages'); app.emit('found_items');
  const next = await (await pending).json();
  assert.ok(next.tables.includes('messages'));
  assert.doesNotMatch(JSON.stringify(next), /PRIVATE|reporter_id|text/);
  assert.notEqual(next.cursor, first.cursor);
  const subsequent = await (await app.call(first.cursor)).json();
  assert.ok(subsequent.tables.includes('found_items'), 'Changes between polls are not dropped');
  app.suspend(); assert.equal((await app.call()).status, 403);
});
test('restarts, missing replication, reconnects and idle clients reconcile and release subscriptions', async t => {
  const app = await setup(t);
  const first = await (await app.call('old-instance:99')).json(); assert.deepEqual(first.tables, ['all']);
  app.status('CHANNEL_ERROR');
  const fallback = await (await app.call(first.cursor)).json(); assert.equal(fallback.realtime, false); assert.deepEqual(fallback.tables, ['all']);
  app.status('SUBSCRIBED');
  const restored = await (await app.call(fallback.cursor)).json(); assert.equal(restored.realtime, true); assert.deepEqual(restored.tables, ['all']);
  const heartbeat = await (await app.call(restored.cursor)).json(); assert.deepEqual(heartbeat.tables, []);
  await sleep(550); assert.equal(app.stats().removed, 1);
});
