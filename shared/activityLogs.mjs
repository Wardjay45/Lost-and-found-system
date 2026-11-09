import { parseStoredTimestamp } from './timestamps.mjs';
import { cancellationActorLabel, isAdminRole } from './roles.mjs';

const types = {
  unmatch: ['Potential match cancelled', 'Match cancellations', 'close'],
  create: ['Record created', 'New records', 'plus'],
  report: ['Report created', 'Reports', 'document'], match: ['Potential match recorded', 'Potential matches', 'matching'],
  claim: ['Claim recorded', 'Claims & handovers', 'success'], cancel: ['Report cancelled', 'Cancellations', 'close'],
  update: ['Record updated', 'Updates', 'edit'], resolve: ['Report resolved', 'Resolutions', 'check'],
  approve: ['Item approved', 'Approvals', 'check'], reject: ['Item rejected', 'Rejections', 'error'],
  delete: ['Record deleted', 'Deletions', 'delete'], message: ['Message sent', 'Messages', 'email'],
  'turnover reminder': ['OSDS turnover reminder sent', 'OSDS turnover reminders', 'email'],
};
export function normalizeActivityAction(value) {
  const action = typeof value === 'string' ? value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ') : '';
  return ({ 'item claimed': 'claim', claimed: 'claim', 'item reported': 'report', 'item updated': 'update',
    cancelled: 'cancel', 'item cancelled': 'cancel', 'potential match': 'match', 'item matched': 'match',
    resolved: 'resolve', 'item resolved': 'resolve', approved: 'approve', rejected: 'reject' })[action] || action || 'unknown';
}
export function legacyCancellationDetails(report, kind) {
  const reason = report.cancel_reason?.trim();
  if (!reason || !['Lost', 'Found'].includes(kind)) return {};
  return {
    adminDetails: `${kind} report #${report.id} cancelled (status: cancelled) Reason: ${reason}.`,
    mobileDetails: report.item_id?.startsWith(kind.toUpperCase() + '-')
      ? `Report ${report.item_id} cancelled. Reason: ${report.cancel_reason}` : null,
  };
}

export function legacyCancellationActor(report, kind, logs) {
  const updatedAt = parseStoredTimestamp(report.last_updated);
  const { adminDetails, mobileDetails } = legacyCancellationDetails(report, kind);
  if (!updatedAt || !adminDetails) return null;
  let actor = null;
  for (const log of logs) {
    if (normalizeActivityAction(log.action) !== 'cancel') continue;
    const admin = isAdminRole(log.role);
    const matches = (admin && log.details === adminDetails)
      || (mobileDetails && (admin || log.role === 'student') && log.details === mobileDetails);
    const recordedAt = matches && parseStoredTimestamp(log.timestamp);
    if (!recordedAt || Math.abs(recordedAt - updatedAt) > 120000) continue;

    const name = log.user_name || null;
    if (actor && (actor.role !== log.role || actor.name !== name)) return null;
    actor = { role: log.role, name };
  }
  return actor;
}

export function activityLogQuery(params = {}) {
  const entries = Object.entries(params).filter(([key, value]) => value !== undefined && value !== null && value !== '' && !(key === 'action' && value === 'all'));
  const query = new URLSearchParams(entries).toString();
  return query ? `?${query}` : '';
}
export function activityView(log) {
  const action = normalizeActivityAction(log.action);
  let payload = null;
  try { const value = typeof log.details === 'string' ? JSON.parse(log.details) : log.details; if (value && typeof value === 'object' && !Array.isArray(value)) payload = value; } catch { /* Legacy plain text. */ }
  const text = value => typeof value === 'string' ? value : '';
  const pair = payload?.lost_item_id && payload?.found_item_id ? {
    lostId: payload.lost_item_id, foundId: payload.found_item_id,
    lostName: text(payload.lost_item_name) || `Lost report #${payload.lost_item_id}`,
    foundName: text(payload.found_item_name) || `Found report #${payload.found_item_id}`,
  } : null;
  const score = payload?.score;
  const similarity = typeof score === 'number' && Number.isFinite(score) && score >= -1 && score <= 100 ? Math.round(score <= 1 ? score * 100 : score) : null;
  const label = action === 'cancel' ? cancellationActorLabel(log.role)
    : types[action]?.[0] || (action === 'unknown' ? 'Activity recorded' : action.replace(/\b\w/g, letter => letter.toUpperCase()));
  const details = text(log.details).trim();
  const plainDetails = /^[{[]/.test(details) ? '' : details;
  const summary = (action === 'match' && pair
    ? `Lost: ${pair.lostName} → Found: ${pair.foundName}${similarity === null ? '' : ` (${similarity}% similarity)`}`
    : text(payload?.text) || text(payload?.message) || text(payload?.description) || text(payload?.reason) ||
      (pair ? `${pair.lostName} → ${pair.foundName}` : payload ? '' : plainDetails)) || label;
  const timestamp = (parseStoredTimestamp(log.timestamp) || parseStoredTimestamp(log.created_at))?.toISOString() || null;
  return { ...log, action, originalAction: log.action, label, summary, pair, similarity, timestamp,
    icon: types[action]?.[2] || 'activity', notes: text(payload?.notes), recoveryId: text(payload?.recovery_id) };
}
export function activityTypes(logs) {
  const counts = new Map();
  for (const log of logs) { const value = normalizeActivityAction(log.action); counts.set(value, (counts.get(value) || 0) + 1); }
  return [...counts].map(([value, count]) => ({ value, label: types[value]?.[1] || activityView({ action: value }).label, count }))
    .sort((first, second) => first.label.localeCompare(second.label));
}
export function filterActivities(logs, action = 'all', search = '') {
  const query = search.trim().toLowerCase();
  return logs.filter(log => {
    const view = activityView(log);
    if (action !== 'all' && view.action !== normalizeActivityAction(action)) return false;
    return !query || [view.label, log.action, view.summary, view.notes, log.user_name, log.role,
      JSON.stringify(view.pair), view.similarity === null ? '' : `${view.similarity}%`].join(' ').toLowerCase().includes(query);
  });
}
