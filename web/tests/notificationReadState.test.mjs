import test from 'node:test';
import assert from 'node:assert/strict';
import { loadNotificationReadState, notificationReadKey } from '../src/services/notificationReadState.mjs';
import { acknowledgeRows, unreadRows } from '../../shared/notifications.mjs';
const storage = entries => { const values = new Map(entries); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }; };

test('old list-visit report receipts cannot clear detail-view badges; existing message receipts survive', () => {
  const saved = storage([['lf-notifications-v2:1', JSON.stringify({ lost: ['10'], found: ['20'], messages: ['30'] })]]);
  const restored = loadNotificationReadState(saved, 1);
  assert.equal(unreadRows([{ id: 10 }], restored.lost).length, 1);
  assert.equal(unreadRows([{ id: 20 }], restored.found).length, 1);
  assert.equal(unreadRows([{ id: 30 }], restored.messages).length, 0);
});
test('viewing one report persists only that report, leaves the other unread, and stays separate from other admins', () => {
  const saved = storage([]);
  const read = loadNotificationReadState(saved, 1);
  read.lost = acknowledgeRows(read.lost, [{ id: 10 }]);
  saved.setItem(notificationReadKey(1), JSON.stringify(read));
  const restored = loadNotificationReadState(saved, 1);
  assert.deepEqual(unreadRows([{ id: 10 }, { id: 11 }], restored.lost), [{ id: 11 }]);
  assert.equal(unreadRows([{ id: 10 }], loadNotificationReadState(saved, 2).lost).length, 1);
});
test('new detail-view receipts take precedence over legacy state and failed/corrupt storage keeps reports unread', () => {
  const saved = storage([['lf-notifications-v2:1', '{"lost":[10],"messages":[30]}'], [notificationReadKey(1), '{"lost":[11],"messages":[31]}']]);
  assert.deepEqual(loadNotificationReadState(saved, 1), { lost: ['11'], messages: ['31'] });
  saved.setItem(notificationReadKey(1), 'broken');
  assert.deepEqual(loadNotificationReadState(saved, 1), {});
  assert.deepEqual(loadNotificationReadState({ getItem() { throw Error('blocked'); } }, 1), {});
});
