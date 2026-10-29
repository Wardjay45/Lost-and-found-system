import test from 'node:test';
import assert from 'node:assert/strict';
import { loadMessageConversation } from '../src/services/messageNotifications.mjs';
import { incomingMessages, unreadRows, acknowledgeRows } from '../../shared/notifications.mjs';
function database({ conversation = { id: 7, name: 'Student' }, rows = [], failConversation = false, failPage = false } = {}) {
  const filters = [];
  return { filters, from(table) {
    const query = {
      select() { return this; }, eq(column, value) { filters.push([table, column, value]); return this; }, order() { return this; }, limit() { return this; },
      async maybeSingle() { return { data: conversation, error: failConversation ? Error('offline') : null }; },
      async range(start, end) { return { data: rows.slice(start, end + 1), error: failPage && start > 0 ? Error('page failed') : null }; },
    };
    return query;
  } };
}
test('mobile conversation lookup is scoped and loads admin replies beyond the first page', async () => {
  const rows = Array.from({ length: 1002 }, (_, i) => ({ id: i + 1, sender: i === 1001 ? 'admin' : 'user', conversation_id: '7' }));
  const db = database({ rows });
  const snapshot = await loadMessageConversation(db, 'Student');
  assert.equal(snapshot.messages.length, 1002);
  assert.deepEqual(db.filters[0], ['conversations', 'name', 'Student']);
  assert.ok(db.filters.slice(1).every(filter => filter[1] === 'conversation_id' && filter[2] === '7'));
  const incoming = incomingMessages(snapshot.messages, 'admin', snapshot.conversationId);
  assert.equal(unreadRows(incoming, []).length, 1);
  assert.equal(unreadRows(incoming, acknowledgeRows([], incoming)).length, 0);
});
test('a new user has no conversation and database errors never become empty successful snapshots', async () => {
  assert.deepEqual(await loadMessageConversation(database({ conversation: null }), 'New'), { conversationId: null, messages: [] });
  await assert.rejects(loadMessageConversation(database({ failConversation: true }), 'Student'), /offline/);
  await assert.rejects(loadMessageConversation(database({ rows: Array(1001).fill({ id: 1 }), failPage: true }), 'Student'), /page failed/);
});
