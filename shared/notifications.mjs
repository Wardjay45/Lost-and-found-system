// Remember IDs actually displayed; changing totals are not read receipts.
export function unreadRows(rows = [], seen = []) {
  const ids = new Set(seen.map(String));
  return rows.filter(row => !ids.has(String(row.id)));
}
export function acknowledgeRows(seen = [], rows = []) {
  return [...new Set([...seen.map(String), ...rows.map(row => String(row.id))])];
}
export function incomingMessages(rows = [], sender, conversationId) {
  return rows.filter(row => row.sender === sender &&
    (conversationId == null || String(row.conversation_id) === String(conversationId)));
}
export function parseReadState(value) {
  try {
    const state = JSON.parse(value);
    return state && typeof state === 'object' && !Array.isArray(state)
      ? Object.fromEntries(Object.entries(state).filter(([, ids]) => Array.isArray(ids)).map(([key, ids]) => [key, ids.map(String)]))
      : {};
  } catch { return {}; }
}
