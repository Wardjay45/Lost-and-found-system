// Reporting trends use submission dates, not the date an item was lost/found.
// Exclude the current partial month and the first (possibly partial) month.
export function reportForecastHistory(rows, itemType, now = new Date()) {
  if (!['lost', 'found'].includes(itemType)) throw new Error('Invalid report type.');
  const monthOf = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).formatToParts(date)
    .reduce((parts, part) => ({ ...parts, [part.type]: part.value }), {});
  const key = date => { const parts = monthOf(date); return `${parts.year}-${parts.month}-01`; };
  const current = key(now), counts = new Map();
  for (const row of rows) {
    const date = new Date(row.created_at);
    if (!row.created_at || !Number.isFinite(date.getTime())) throw new Error('Invalid report submission date.');
    const month = key(date);
    if (month < current) counts.set(month, (counts.get(month) || 0) + 1);
  }
  const first = [...counts.keys()].sort()[0];
  const historical = [];
  if (first) {
    const cursor = new Date(first + 'T00:00:00Z');
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    while (cursor.toISOString().slice(0, 10) < current) {
      const ds = cursor.toISOString().slice(0, 10);
      historical.push({ ds, y: counts.get(ds) || 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  return { historical, dataset: {
    name: `Campus ${itemType}-item reports`, source: `Campus ${itemType}_items submission records`,
    record_type: `${itemType}_items`, temporary: false,
    description: `Monthly ${itemType}-item report submissions in Asia/Manila time. The first recorded month and current partial month are excluded. Zero counts mean no retained submissions during intervening months; deleted records and earlier reporting gaps can affect coverage.`,
  } };
}
