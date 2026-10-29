// All reporting months use the campus timezone, regardless of the viewer's device.
const campusMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' });
function monthIndex(value) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(campusMonth.formatToParts(date).map(part => [part.type, part.value]));
  return Number(parts.year) * 12 + Number(parts.month) - 1;
}

export function predictTrend(values, horizon = 1) {
  if (values.length < 3) return null;
  const n = values.length, xMean = (n - 1) / 2;
  const yMean = values.reduce((sum, value) => sum + value, 0) / n;
  const slope = values.reduce((sum, value, x) => sum + (x - xMean) * (value - yMean), 0) /
    values.reduce((sum, _, x) => sum + (x - xMean) ** 2, 0);
  return Math.max(0, Math.round(yMean + slope * (n - 1 + horizon - xMean)));
}

export function forecastReports(lostItems, foundItems, now = new Date()) {
  const current = monthIndex(now);
  if (current === null) throw new Error('A valid forecast date is required.');
  const rows = [
    ...lostItems.map(item => ({ month: monthIndex(item.date_reported), kind: 'lost' })),
    ...foundItems.map(item => ({ month: monthIndex(item.date_found), kind: 'found' })),
  ].filter(row => row.month !== null && row.month <= current);
  // No claim of complete coverage is made for the first recorded month.
  const first = rows.length ? rows.reduce((minimum, row) => Math.min(minimum, row.month), current) + 1 : current;
  const history = Array.from({ length: Math.max(0, current - first) }, (_, index) => {
    const month = first + index, year = Math.floor(month / 12), number = month % 12;
    return { index: month, key: `${year}-${String(number + 1).padStart(2, '0')}`,
      label: new Date(Date.UTC(year, number, 1)).toLocaleString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }), lost: 0, found: 0 };
  });
  for (const row of rows) if (row.month >= first && row.month < current) history[row.month - first][row.kind]++;
  const months = history.slice(-6);
  // Last training month is last month; next calendar month is two steps ahead.
  const next = months.length >= 3 ? { lost: predictTrend(months.map(m => m.lost), 2), found: predictTrend(months.map(m => m.found), 2) } : null;
  const errors = history.slice(4).map((actual, offset) => {
    const training = history.slice(Math.max(0, offset + 3 - 6), offset + 3);
    return { lost: Math.abs(actual.lost - predictTrend(training.map(m => m.lost), 2)), found: Math.abs(actual.found - predictTrend(training.map(m => m.found), 2)) };
  });
  const backtest = errors.length ? { months: errors.length, lostMae: errors.reduce((sum, e) => sum + e.lost, 0) / errors.length,
    foundMae: errors.reduce((sum, e) => sum + e.found, 0) / errors.length } : null;
  const target = new Date(Date.UTC(Math.floor((current + 1) / 12), (current + 1) % 12, 1));
  return { months, completeMonths: history.length, next, backtest,
    targetMonth: `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}`,
    targetLabel: target.toLocaleString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }) };
}
