const types = {
  report: ['Report created', 'Reports', 'document'], match: ['Potential match recorded', 'Potential matches', 'matching'],
  claim: ['Claim recorded', 'Claims & handovers', 'success'], cancel: ['Report cancelled', 'Cancellations', 'close'],
  update: ['Record updated', 'Updates', 'edit'], resolve: ['Report resolved', 'Resolutions', 'check'],
  approve: ['Item approved', 'Approvals', 'check'], reject: ['Item rejected', 'Rejections', 'error'],
  delete: ['Record deleted', 'Deletions', 'delete'], message: ['Message sent', 'Messages', 'email'],
};
export function normalizeActivityAction(value) {
  const action = typeof value === 'string' ? value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ') : '';
  return ({ 'item claimed': 'claim', claimed: 'claim', 'item reported': 'report', 'item updated': 'update',
    cancelled: 'cancel', 'item cancelled': 'cancel', 'potential match': 'match', 'item matched': 'match',
    resolved: 'resolve', 'item resolved': 'resolve', approved: 'approve', rejected: 'reject' })[action] || action || 'unknown';
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
  const label = types[action]?.[0] || (action === 'unknown' ? 'Activity recorded' : action.replace(/\b\w/g, letter => letter.toUpperCase()));
  const summary = text(payload?.text) || text(payload?.message) || text(payload?.description) ||
    (pair ? `${pair.lostName} → ${pair.foundName}` : payload ? JSON.stringify(payload, null, 2) : text(log.details)) || 'No details recorded.';
  let timestamp = null;
  if (typeof log.timestamp === 'string' && log.timestamp.trim()) {
    let value = log.timestamp.trim().replace(' ', 'T');
    if (/^\d{4}-\d{2}-\d{2}T/.test(value) && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) value += 'Z';
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) timestamp = date.toISOString();
  }
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
