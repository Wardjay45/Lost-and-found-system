import test from 'node:test';
import assert from 'node:assert/strict';
import { forecastReports, predictTrend } from '../src/utils/forecast.mjs';

test('linear forecast uses the fitted intercept and clamps declining trends', () => {
  assert.equal(predictTrend([1, 2, 3, 4, 5, 6]), 7);
  assert.equal(predictTrend([6, 5, 4]), 3);
  assert.equal(predictTrend([4, 2, 0]), 0);
  assert.equal(predictTrend([0, 0, 0]), 0);
  assert.equal(predictTrend([8, 8, 8]), 8);
});

function reports(counts, startMonth = 0) {
  return [ { date_reported: '2025-12-15' }, ...counts.flatMap((count, index) =>
    Array.from({ length: count }, () => ({ date_reported: new Date(2026, startMonth + index, 10).toISOString() }))) ];
}

test('excludes first activity month, current month, invalid and future dates', () => {
  const data = reports([1, 2, 3]);
  data.push({ date_reported: '2026-04-01' }, { date_reported: 'bad' }, { date_reported: '2027-01-01' });
  const result = forecastReports(data, [], new Date(2026, 3, 21));
  assert.deepEqual(result.months.map(m => m.lost), [1, 2, 3]);
  assert.equal(result.next.lost, 5, 'Next calendar month skips the incomplete current month');
  assert.equal(result.targetMonth, '2026-05');
  assert.equal(result.next.found, 0);
  assert.equal(result.months[0].key, '2026-01');
});

test('requires three complete months and leaves estimates unavailable, including empty history', () => {
  assert.equal(forecastReports([], [], new Date(2026, 9, 21)).next, null);
  const result = forecastReports(reports([2, 3]), [], new Date(2026, 2, 1));
  assert.equal(result.next, null);
  assert.equal(result.completeMonths, 2);
});

test('keeps zero-report months and uses only six recent months for the prediction', () => {
  const result = forecastReports(reports([99, 1, 2, 3, 4, 5, 6]), [], new Date(2026, 7, 1));
  assert.equal(result.months.length, 6);
  assert.deepEqual(result.months.map(m => m.lost), [1, 2, 3, 4, 5, 6]);
  assert.equal(result.next.lost, 8);
  const gaps = forecastReports(reports([2, 0, 3]), [], new Date(2026, 3, 1));
  assert.deepEqual(gaps.months.map(m => m.lost), [2, 0, 3]);
});

test('backtesting uses earlier months only and returns MAE plus evaluation count', () => {
  const result = forecastReports(reports([1, 2, 3, 4, 5]), [], new Date(2026, 5, 1));
  assert.equal(result.backtest.months, 1);
  assert.equal(result.backtest.lostMae, 0);
  assert.equal(result.backtest.foundMae, 0);
  assert.equal(forecastReports(reports([1, 2, 3]), [], new Date(2026, 3, 1)).backtest, null);
});

test('uses found date for found reports and campus timezone at month boundaries', () => {
  const result = forecastReports([{ date_reported: '2025-12-31T15:59:00Z' }], [
    { date_found: '2026-03-31T16:00:00Z' },
    { date_found: '2026-03-31T15:59:00Z' },
  ], new Date('2026-03-31T16:00:00Z'));
  assert.equal(result.completeMonths, 3);
  assert.equal(result.months.at(-1).found, 1);
});
