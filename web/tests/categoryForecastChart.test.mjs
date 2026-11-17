import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCategoryForecastChart, buildCategoryTrendChart, forecastMethods } from '../src/services/categoryForecastChart.mjs';

test('category graph aligns three algorithms and preserves zero estimates without fabricating missing forecasts', () => {
  const chart = buildCategoryForecastChart([
    { category: 'Keys', metrics: [{ method: 'ARIMA', expected_reports: 5.739, forecast_status: 'ok' }, { method: 'Prophet', expected_reports: 0, forecast_status: 'ok' }] },
    { category: 'Wallet', metrics: [{ method: 'Exponential Smoothing', expected_reports: 2, forecast_status: 'convergence_warning' }] },
  ]);
  assert.deepEqual(chart.labels, ['Keys', 'Wallet']);
  assert.deepEqual(chart.datasets.map(row => row.label), forecastMethods);
  assert.deepEqual(chart.datasets.map(row => row.data), [[0, null], [5.739, null], [null, null]]);
});

test('category line chart shows observed history then one forecast step without inventing earlier predictions', () => {
  const chart = buildCategoryTrendChart({
    historical: Array.from({ length: 8 }, (_, index) => ({ ds: `2026-${String(index + 1).padStart(2, '0')}-01`, y: index })),
    forecast_month: '2026-09-01',
    metrics: [{ method: 'ARIMA', forecast_status: 'ok', expected_reports: 9.5 }, { method: 'Prophet', forecast_status: 'ok', expected_reports: 0 }],
  });
  assert.equal(chart.months.length, 7);
  assert.equal(chart.months[0], '2026-03-01');
  assert.deepEqual(chart.datasets[0].data, [2, 3, 4, 5, 6, 7, null]);
  assert.deepEqual(chart.datasets[1].data, [null, null, null, null, null, 7, 0]);
  assert.deepEqual(chart.datasets[2].data, [null, null, null, null, null, 7, 9.5]);
  assert.ok(chart.datasets[3].data.every(value => value === null));
  assert.equal(buildCategoryTrendChart({ historical: [] }), null);
});

test('all seven historical category charts retain six input counts and only forecast the seventh point', () => {
  const source = JSON.parse(readFileSync(new URL('../../ai-server/analytics/historical_category_monthly.json', import.meta.url), 'utf8')).lost;
  assert.equal(source.categories.length, 7);
  const totals = Array(6).fill(0);
  for (const category of source.categories) {
    const history = source.historical.filter(row => row.category === category);
    assert.equal(history.length, 29);
    const chart = buildCategoryTrendChart({ historical: history, forecast_month: '2026-11-01', metrics: [
      { method: 'ARIMA', forecast_status: 'ok', expected_reports: 2.5 },
    ] }, { historyLabel: 'Historical counts', simulatedMonths: source.dataset.simulated_months });
    assert.deepEqual(chart.months, ['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01']);
    assert.equal(chart.datasets[0].label, 'Historical counts');
    assert.deepEqual(chart.datasets[0].data, [...history.slice(-6).map(row => row.y), null]);
    assert.deepEqual(chart.datasets[0].simulatedMonths, [true, false, false, false, false, false, false]);
    assert(chart.datasets[0].data.slice(0, 6).every(value => Number.isInteger(value) && value >= 0));
    assert.deepEqual(chart.datasets[2].data, [null, null, null, null, null, history.at(-1).y, 2.5]);
    chart.datasets[0].data.slice(0, 6).forEach((value, index) => { totals[index] += value; });
  }
  assert.deepEqual(totals, [32, 2, 3, 2, 20, 5]);
});
