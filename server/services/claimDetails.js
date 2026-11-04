import { normalizeActivityAction } from '../../shared/activityLogs.mjs';
import { reportId } from '../../shared/potentialMatches.mjs';
import { parseStoredTimestamp } from '../../shared/timestamps.mjs';
import { readAll } from './readAll.js';
import { loadReportPair, loadSavedPotentialMatch } from './potentialMatches.js';

const timestamp = value => parseStoredTimestamp(value)?.getTime() || 0;
function payload(log) {
  try {
    const value = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

export async function loadClaimDetails(client, itemId, table) {
  const id = reportId(itemId);
  if (!id || !['lost_items', 'found_items'].includes(table)) throw Object.assign(new Error('Choose a valid lost or found report.'), { status: 400 });
  const field = table === 'lost_items' ? 'lost_item_id' : 'found_item_id';
  const [result, logs] = await Promise.all([
    // Evidence fields may be absent before an additive schema update is installed.
    client.from('item_recoveries').select('*').eq(field, Number(id)).maybeSingle(),
    readAll(client.from('activity_logs').select('*').order('timestamp', { ascending: false }).order('id', { ascending: false })),
  ]);
  if (result.error) throw result.error;
  const recovery = result.data;
  const entries = logs.map(log => ({ log, details: payload(log) }))
    .sort((a, b) => timestamp(b.log.timestamp) - timestamp(a.log.timestamp) || Number(b.log.id) - Number(a.log.id));
  const claim = entries.find(({ log, details }) => normalizeActivityAction(log.action) === 'claim' &&
    reportId(details[field]) === id && (!recovery ||
      reportId(details.lost_item_id) === reportId(recovery.lost_item_id) && reportId(details.found_item_id) === reportId(recovery.found_item_id)));
  const source = recovery || claim?.details;
  const lostId = reportId(source?.lost_item_id), foundId = reportId(source?.found_item_id);
  const claimedOn = recovery?.recovered_at || claim?.log.timestamp;
  let match = null;
  if (lostId && foundId) {
    const decision = entries.find(({ log, details }) => log.action === 'match' &&
      reportId(details.lost_item_id) === lostId && reportId(details.found_item_id) === foundId &&
      (!claimedOn || timestamp(log.timestamp) <= timestamp(claimedOn)));
    let scores = decision?.details;
    if (!scores) {
      const rows = await readAll(client.from('matches').select('id,confidence,date_created').eq('lost_item_id', Number(lostId)).eq('found_item_id', Number(foundId)).eq('status', 'claimed').order('date_created', { ascending: false }).order('id', { ascending: false }));
      scores = { score: typeof rows[0]?.confidence === 'number' ? rows[0].confidence / 100 : undefined };
    }
    match = await loadReportPair(client, { lostId, foundId, details: scores });
  } else if (!source) {
    // Older claimed reports can still have comparison data without a handover record.
    match = await loadSavedPotentialMatch(client, id, table, { includeClaimed: true });
  }
  const details = claim?.details || {};
  const text = typeof details.text === 'string' ? details.text : '';
  return { match, verification: source ? {
    recovery_id: recovery?.id || details.recovery_id || null,
    verified_by: recovery?.verified_by_name || details.verified_by || claim?.log.user_name || null,
    claimed_on: claimedOn || null,
    // A recovery is created only after both checks pass at the server boundary.
    id_verified: recovery ? true : typeof details.id_verified === 'boolean' ? details.id_verified : /ID Verified:\s*Yes\b/i.test(text) ? true : null,
    knowledge_passed: recovery ? true : typeof details.knowledge_passed === 'boolean' ? details.knowledge_passed : /Knowledge Check:\s*Passed\b/i.test(text) ? true : null,
    notes: recovery?.notes ?? details.notes ?? '',
    knowledge_answers: recovery?.knowledge_answers || details.knowledge_answers || null,
    handover_image: recovery?.handover_image || null,
  } : null };
}
