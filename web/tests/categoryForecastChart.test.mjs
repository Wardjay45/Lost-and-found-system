import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCategoryForecastChart, buildCategoryTrendChart, forecastMethods, getSelectedCategoryForecast } from '../src/services/categoryForecastChart.mjs';

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

test('expected count uses the validation-selected model, preserves zero, and rejects unavailable fits', () => {
  const category = { status: 'ok', method: 'ARIMA', expected_reports: 0, forecast_month: '2026-11-01', metrics: [
    { method: 'Prophet', forecast_status: 'ok', expected_reports: 12, forecast_month: '2026-11-01' },
    { method: 'ARIMA', forecast_status: 'ok', expected_reports: 0, forecast_month: '2026-11-01' },
  ] };
  assert.deepEqual(getSelectedCategoryForecast(category), { method: 'ARIMA', value: 0 });
  assert.equal(getSelectedCategoryForecast({ ...category, status: 'convergence_warning' }), null);
  assert.equal(getSelectedCategoryForecast({ ...category, expected_reports: null }), null);
  assert.equal(getSelectedCategoryForecast({ ...category, expected_reports: -1 }), null);
  assert.equal(getSelectedCategoryForecast({ ...category, method: null }), null);
  assert.equal(getSelectedCategoryForecast({ ...category, metrics: [category.metrics[0]] }), null);
  assert.equal(getSelectedCategoryForecast({ ...category, metrics: [{ ...category.metrics[1], forecast_status: 'convergence_warning' }] }), null);
  assert.equal(getSelectedCategoryForecast({ ...category, metrics: [{ ...category.metrics[1], forecast_month: '2026-12-01' }] }), null);
});

test('a synthetic historical series is not labelled as wholly recorded reports', () => {
  const chart = buildCategoryTrendChart({ historical: [{ ds: '2026-10-01', y: 3 }], forecast_month: '2026-11-01', metrics: [] }, { historyLabel: 'Historical reports (includes simulated months)' });
  assert.equal(chart.datasets[0].label, 'Historical reports (includes simulated months)');
});
