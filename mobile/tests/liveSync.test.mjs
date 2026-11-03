import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveSync, createRefreshQueue } from '../src/services/liveSync.mjs';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('live sync authenticates, follows cursors, retries failures and pauses completely in background', async t => {
  const calls = [], changes = [], statuses = [];
  const sync = createLiveSync({ getApiUrl: async () => 'https://campus.test/api/', getToken: () => 'private-session',
    onChange: tables => changes.push(tables), onStatus: status => statuses.push(status), retryMs: 5, reconcileMs: 1000,
    fetcher: async (url, options) => { const request = deferred(); calls.push({ url, options, request }); return request.promise; } });
  t.after(() => sync.stop()); sync.start(); await sleep(1);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer private-session');
  calls[0].request.resolve({ ok: true, json: async () => ({ cursor: 'epoch:1', tables: ['messages'], realtime: true }) });
  await sleep(120);
  assert.match(calls[1].url, /cursor=epoch%3A1/); assert.ok(statuses.includes('live'));
  calls[1].request.resolve({ ok: false, json: async () => ({ error: 'offline' }) });
  await sleep(20); assert.ok(statuses.includes('reconnecting')); assert.equal(calls.length, 3);
  sync.stop(); assert.equal(calls[2].options.signal.aborted, true);
  const count = changes.length;
  calls[2].request.resolve({ ok: true, json: async () => ({ cursor: 'epoch:2', tables: ['lost_items'], realtime: true }) });
  await sleep(10); assert.equal(changes.length, count);
  sync.start(); await sleep(2); assert.equal(calls.length, 4); assert.match(calls[3].url, /cursor=$/);
});
test('a stopped session cannot publish old events after a rapid resume, and fallback updates need no button', async t => {
  const requests = [], changes = [];
  const sync = createLiveSync({ getApiUrl: async () => 'https://campus.test/api', getToken: () => 'token', onChange: value => changes.push(value), reconcileMs: 10,
    fetcher: async () => { const request = deferred(); requests.push(request); return request.promise; } });
  t.after(() => sync.stop()); sync.start(); await sleep(1); sync.stop(); sync.start(); await sleep(1);
  requests[0].resolve({ ok: true, json: async () => ({ cursor: 'stale', tables: ['messages'], realtime: true }) });
  await sleep(25); assert.equal(changes.some(tables => tables.includes('messages')), false);
  assert.ok(changes.filter(tables => tables.includes('all')).length >= 3);
});
test('burst updates serialize reads, coalesce pending refreshes and stop after unsubscription', async () => {
  const request = deferred(); let count = 0, active = 0, peak = 0;
  const queue = createRefreshQueue(async () => { count++; peak = Math.max(peak, ++active); if (count === 1) await request.promise; active--; });
  const pending = queue.run(); void queue.run(); void queue.run(); request.resolve(); await pending;
  assert.equal(count, 2); assert.equal(peak, 1); queue.stop(); await queue.run(); assert.equal(count, 2);
});
