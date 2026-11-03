import { parseStoredTimestamp } from './timestamps.mjs';

export function unclaimedReports(rows, days = 60, now = Date.now()) {
  const threshold = now - days * 86400000;
  return rows.filter(row => {
    const date = parseStoredTimestamp(row.date_found || row.created_at);
    return row.status === 'active' && date && date.getTime() < threshold;
  }).sort((a, b) => parseStoredTimestamp(b.date_found || b.created_at) - parseStoredTimestamp(a.date_found || a.created_at));
}
