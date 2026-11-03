import test from 'node:test';
import assert from 'node:assert/strict';
import { subscribeTableChanges } from '../src/services/liveRefresh.mjs';
import { notificationEvent } from '../src/services/liveNotifications.mjs';

const wait = () => new Promise(resolve => setTimeout(resolve, 15));
const emit = (target, table) => target.dispatchEvent(new CustomEvent(notificationEvent, { detail: { table } }));

test('live data batches changes, filters tables, catches up on all, and stops on cleanup', async () => {
  const target = new EventTarget(), document = { visibilityState: 'visible' }, calls = [];
  const stop = subscribeTableChanges(['lost_items', 'found_items'], options => calls.push(options), { target, document, delayMs: 1 });
  emit(target, 'messages'); await wait(); assert.equal(calls.length, 0);
  emit(target, 'lost_items'); emit(target, 'found_items'); emit(target, 'lost_items');
  await wait(); assert.deepEqual(calls, [{ background: true }]);
  document.visibilityState = 'hidden'; emit(target, 'all'); await wait(); assert.equal(calls.length, 1);
  document.visibilityState = 'visible'; emit(target, 'all'); await wait(); assert.equal(calls.length, 2);
  emit(target, 'all'); stop(); await wait(); assert.equal(calls.length, 2);
  emit(target, 'lost_items'); await wait(); assert.equal(calls.length, 2);
});

test('a change during a pending reload queues one follow-up without overlapping requests', async () => {
  const target = new EventTarget(), document = { visibilityState: 'visible' };
  let calls = 0, finish;
  const stop = subscribeTableChanges('feedback', async () => {
    calls++;
    if (calls === 1) await new Promise(resolve => { finish = resolve; });
  }, { target, document, delayMs: 1 });
  try {
    emit(target, 'feedback'); await wait(); assert.equal(calls, 1);
    emit(target, 'all'); emit(target, 'feedback'); await wait(); assert.equal(calls, 1);
    finish(); await wait(); assert.equal(calls, 2);
  } finally { stop(); }
});

test('failed reloads can recover on the next automatic event', async () => {
  const target = new EventTarget(), document = { visibilityState: 'visible' };
  let calls = 0;
  const stop = subscribeTableChanges('users', () => { if (++calls === 1) throw Error('offline'); }, { target, document, delayMs: 1 });
  try {
    emit(target, 'all'); await wait(); emit(target, 'users'); await wait(); assert.equal(calls, 2);
  } finally { stop(); }
});
