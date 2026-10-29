import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createNotificationRouter, notificationSnapshot } from '../services/notifications.js';
const secret = 'isolated-notification-test-secret';
function database() {
  const state = { user: { role: 'admin', status: 'active' }, fail: false, callbacks: {}, removed: 0, subscriptions: 0,
    rows: { lost_items: [{ id: 1 }], found_items: [{ id: 2 }], messages: [{ id: 3, conversation_id: '7', sender: 'user' }, { id: 4, conversation_id: '7', sender: 'admin' }] } };
  const db = { from(table) {
    let filter;
    return {
      select() { return this; }, order() { return this; }, eq(column, value) { filter = [column, value]; return this; },
      async single() { return { data: state.user, error: null }; },
      async range(start, end) {
        if (state.fail) return { data: null, error: Error('offline') };
        const rows = state.rows[table].filter(row => !filter || row[filter[0]] === filter[1]);
        return { data: rows.slice(start, end + 1), error: null };
      },
    };
  }, channel() { state.subscriptions++;
    return { on(_event, filter, callback) { state.callbacks[filter.table] = callback; return this; }, subscribe(callback) { callback('SUBSCRIBED'); return this; } };
  }, async removeChannel() { state.removed++; } };
  return { db, state };
}
async function appFor(t) {
  const { db, state } = database();
  const app = express();
  app.use('/api/notifications', createNotificationRouter(db, { jwtSecret: secret }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const url = 'http://127.0.0.1:' + server.address().port + '/api/notifications';
  const headers = { Authorization: 'Bearer ' + jwt.sign({ id: 1 }, secret) };
  return { state, url, headers };
}
test('snapshot includes all report statuses, incoming messages only, and every database page', async () => {
  const { db, state } = database();
  state.rows.lost_items = Array.from({ length: 1001 }, (_, id) => ({ id }));
  const snapshot = await notificationSnapshot(db);
  assert.equal(snapshot.lost.length, 1001);
  assert.deepEqual(snapshot.found, [{ id: 2 }]);
  assert.deepEqual(snapshot.messages.map(row => row.id), [3]);
  state.fail = true;
  await assert.rejects(notificationSnapshot(db), /offline/);
});
test('snapshot API enforces current admin status and returns failure instead of zero counts', async t => {
  const { state, url, headers } = await appFor(t);
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: { Authorization: 'Bearer invalid' } })).status, 401);
  assert.equal((await fetch(url + '/stream')).status, 401);
  state.user.role = 'student';
  assert.equal((await fetch(url, { headers })).status, 403);
  state.user.role = 'superadmin';
  assert.equal((await fetch(url, { headers })).status, 200);
  state.user.status = 'suspended';
  assert.equal((await fetch(url, { headers })).status, 403);
  state.user.status = 'active';
  state.fail = true;
  assert.equal((await fetch(url, { headers })).status, 503);
});
test('live stream forwards database changes and removes the channel after the browser disconnects', async t => {
  const { state, url, headers } = await appFor(t);
  const controller = new AbortController();
  const response = await fetch(url + '/stream', { headers, signal: controller.signal });
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const reader = response.body.getReader();
  await reader.read();
  state.callbacks.messages({ new: { text: 'private text' } });
  const { value } = await reader.read();
  const event = new TextDecoder().decode(value);
  assert.match(event, /"table":"messages"/);
  assert.ok(!event.includes('private text'));
  assert.deepEqual(Object.keys(state.callbacks).sort(), ['conversations', 'found_items', 'lost_items', 'messages']);
  controller.abort();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(state.removed, 1);
});
