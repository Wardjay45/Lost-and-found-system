import { parseStoredTimestamp } from './timestamps.mjs';

export function reportId(value) {
  if (!['number', 'string'].includes(typeof value) || !/^\d+$/.test(String(value))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? String(id) : null;
}
export function latestPairEvent(logs, itemId, table) {
  if (!['lost_items', 'found_items'].includes(table) || !reportId(itemId)) throw new Error('Choose a valid lost or found report.');
  const field = table === 'lost_items' ? 'lost_item_id' : 'found_item_id';
  const ordered = [...logs].sort((a, b) => (parseStoredTimestamp(b.timestamp)?.getTime() || 0) - (parseStoredTimestamp(a.timestamp)?.getTime() || 0) || Number(b.id || 0) - Number(a.id || 0));
  for (const log of ordered) {
    // The handover transaction recognizes canonical saved match decisions.
    if (!['match', 'unmatch'].includes(log.action)) continue;
    let details;
    try { details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details; } catch { continue; }
    if (!details || Array.isArray(details) || reportId(details[field]) !== reportId(itemId)) continue;
    const lostId = reportId(details.lost_item_id), foundId = reportId(details.found_item_id);
    if (lostId && foundId) return { log, details, lostId, foundId };
  }
  return null;
}

export function findRecordedPair(logs, itemId, table) {
  const event = latestPairEvent(logs, itemId, table);
  return event?.log.action === 'match' ? event : null;
}
