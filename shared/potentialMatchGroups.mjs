import { reportId } from './potentialMatches.mjs';
import { parseStoredTimestamp } from './timestamps.mjs';

export function potentialMatchGroups(lost, found, logs = [], matches = []) {
  const pending = rows => new Map(rows.filter(row => row.status === 'potential_match').map(row => [String(row.id), row]));
  const left = pending(lost), right = pending(found);
  const latestLost = new Map(), latestFound = new Map(), groups = [], usedLost = new Set(), usedFound = new Set();
  const ordered = [...logs].sort((a, b) => (parseStoredTimestamp(b.timestamp)?.getTime() || 0) - (parseStoredTimestamp(a.timestamp)?.getTime() || 0) || Number(b.id) - Number(a.id));
  for (const log of ordered) {
    if (!['match', 'unmatch'].includes(log.action)) continue;
    let details; try { details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details; } catch { continue; }
    const lostId = reportId(details?.lost_item_id), foundId = reportId(details?.found_item_id);
    if (!lostId || !foundId) continue;
    const event = { log, lostId, foundId };
    if (!latestLost.has(lostId)) latestLost.set(lostId, event);
    if (!latestFound.has(foundId)) latestFound.set(foundId, event);
  }
  const add = (lostId, foundId, version) => {
    if (!left.has(lostId) || !right.has(foundId) || usedLost.has(lostId) || usedFound.has(foundId)) return;
    groups.push({ id: `pair:${lostId}:${foundId}:${version}`, lost_item_id: lostId, found_item_id: foundId });
    usedLost.add(lostId); usedFound.add(foundId);
  };
  for (const event of latestLost.values()) {
    if (event.log.action === 'match' && latestFound.get(event.foundId) === event) add(event.lostId, event.foundId, 'log:' + event.log.id);
  }
  const saved = matches.filter(row => ['confirmed', 'matched', 'potential_match'].includes(row.status) && left.has(String(row.lost_item_id)) && right.has(String(row.found_item_id)));
  for (const row of saved) {
    const lostId = String(row.lost_item_id), foundId = String(row.found_item_id);
    if (latestLost.has(lostId) || latestFound.has(foundId)) continue;
    if (saved.some(other => String(other.lost_item_id) === lostId && String(other.found_item_id) !== foundId || String(other.found_item_id) === foundId && String(other.lost_item_id) !== lostId)) continue;
    add(lostId, foundId, 'saved:' + row.id);
  }
  for (const id of left.keys()) if (!usedLost.has(id)) groups.push({ id: 'lost:' + id, lost_item_id: id, found_item_id: null });
  for (const id of right.keys()) if (!usedFound.has(id)) groups.push({ id: 'found:' + id, lost_item_id: null, found_item_id: id });
  return groups;
}

// Migrate existing detail-view receipts once. Later match decisions have their
// own receipts, so viewing a report before it is matched cannot hide a new match.
export function potentialReadReceipts(read, groups) {
  if (Object.hasOwn(read, 'potential')) return read.potential;
  const lost = new Set((read.lost || []).map(String)), found = new Set((read.found || []).map(String));
  return groups.filter(pair => lost.has(String(pair.lost_item_id)) || found.has(String(pair.found_item_id))).map(pair => pair.id);
}

export function groupPotentialReports(reports, pairs) {
  const indexed = new Map(reports.map(row => [row.collectionKey, row]));
  const used = new Set(), groups = [];
  for (const pair of pairs) {
    const lost = indexed.get('lost:' + pair.lost_item_id), found = indexed.get('found:' + pair.found_item_id);
    if (!lost && !found) continue;
    const primary = lost || found;
    groups.push({ ...primary, collectionKey: pair.id, lostReport: lost, foundReport: found, pairedItem: lost && found ? found : null });
    if (lost) used.add(lost.collectionKey);
    if (found) used.add(found.collectionKey);
  }
  return [...groups, ...reports.filter(row => !used.has(row.collectionKey))];
}
