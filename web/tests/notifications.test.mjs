import test from 'node:test';
import assert from 'node:assert/strict';
import { acknowledgeRows, incomingMessages, parseReadState, unreadRows } from '../../shared/notifications.mjs';
import { subscribeNotifications } from '../src/services/liveNotifications.mjs';

test('incoming chat badges exclude own messages and keep other conversations unread', () => {
  const rows = [{ id: 1, sender: 'user', conversation_id: 1 }, { id: 2, sender: 'admin', conversation_id: 1 }, { id: 3, sender: 'user', conversation_id: 2 }, { id: 4, sender: 'admin', conversation_id: 2 }];
  const adminInbox = incomingMessages(rows, 'user');
  const read = acknowledgeRows([], incomingMessages(rows, 'user', '1'));
  assert.deepEqual(unreadRows(adminInbox, read).map(row => row.id), [3]);
  assert.deepEqual(incomingMessages(rows, 'admin', '1').map(row => row.id), [2]);
  assert.deepEqual(unreadRows(incomingMessages(rows, 'admin', '1'), []).map(row => row.id), [2]);
});
test('report badges survive deletions, ID type changes, and new reports at the same total', () => {
  const seen = acknowledgeRows([], [{ id: 10 }, { id: 11 }]);
  assert.deepEqual(unreadRows([{ id: '11' }, { id: 12 }], seen), [{ id: 12 }]);
  assert.deepEqual(acknowledgeRows(seen, [{ id: '11' }]), ['10', '11']);
  assert.deepEqual(unreadRows([{ id: 9 }], seen), [{ id: 9 }]);
});
test('saved read state restores safely and separate account keys do not share receipts', () => {
  const accountA = JSON.stringify({ messages: acknowledgeRows([], [{ id: 2 }]) });
  assert.equal(unreadRows([{ id: 2 }], parseReadState(accountA).messages).length, 0);
  assert.equal(unreadRows([{ id: 2 }], parseReadState(null).messages).length, 1);
  assert.deepEqual(parseReadState('{broken'), {});
  assert.deepEqual(parseReadState('{"messages":4,"lost":[1]}'), { lost: ['1'] });
});
test('authenticated live stream handles split chunks, ignores heartbeats, and cancels on cleanup', async () => {
  const chunks = [': keepalive\n\nda', 'ta: {"table":"messages"}\r\n\n', 'data: invalid\n', 'data: {"table":"found_items"}\n\n'];
  const events = [];
  let options, stop;
  const done = new Promise(resolve => {
    stop = subscribeNotifications(table => { events.push(table); if (events.length === 2) resolve(); }, {
      url: '/api/notifications/stream', token: 'test-token', retryMs: 10000,
      fetcher: async (_url, init) => {
        options = init;
        return { ok: true, body: new ReadableStream({ start(controller) { for (const text of chunks) controller.enqueue(new TextEncoder().encode(text)); controller.close(); } }) };
      },
    });
  });
  await done;
  stop();
  assert.deepEqual(events, ['messages', 'found_items']);
  assert.equal(options.headers.Authorization, 'Bearer test-token');
  assert.equal(options.signal.aborted, true);
});
test('stream failures reconnect and cleanup prevents further attempts', async () => {
  let attempts = 0;
  let resolve;
  const reconnected = new Promise(done => { resolve = done; });
  const stop = subscribeNotifications(() => {}, { url: '/stream', token: 'x', retryMs: 1, fetcher: async () => {
    if (++attempts === 2) resolve();
    return { ok: false };
  } });
  await reconnected;
  stop();
  await new Promise(done => setTimeout(done, 10));
  assert.equal(attempts, 2);
});
