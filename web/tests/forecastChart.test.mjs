import test from 'node:test';
import assert from 'node:assert/strict';
import { buildForecastChart } from '../src/services/forecastChart.mjs';
import { validateForecastResponse, forecastTimeframeSummary } from '../../shared/forecast.mjs';

const missingMonths = Array.from({ length: 28 }, (_, index) => new Date(Date.UTC(2024, 6 + index, 1)).toISOString().slice(0, 10));

const result = {
  historical: [{ ds: '2024-05-01', y: 0 }, { ds: '2024-06-01', y: 6 }, { ds: '2026-11-01', y: 4 }],
  forecast: [{ ds: '2026-12-01', yhat: 8, yhat_lower: 0, yhat_upper: 19 }],
  dataset: { name: 'UBC found-item records', description: 'Temporary demonstration', source: 'Supplied CSV', temporary: true, observed_months: 3, total_records: 10, first_observed_month: '2024-05-01', last_observed_month: '2026-11-01', missing_month_count: 28, missing_months: missingMonths },
  warnings: ['Experimental'], model: { name: 'Prophet', horizon_months: 1, yearly_seasonality: false, interval_width: .8 },
};

test('timeframes prorate seven days, retain one month and total twelve projected months', () => {
  const month = forecastTimeframeSummary(result);
  assert.equal(month.yhat, 8); assert.equal(month.end, '2026-12-31');
  const weekly = { ...result, model: { ...result.model, timeframe: 'weekly' } };
  const week = forecastTimeframeSummary(weekly, 'weekly');
  assert.equal(week.end, '2026-12-07'); assert.equal(week.yhat, 8 * 7 / 31);
  const year = { ...result, model: { ...result.model, timeframe: 'yearly', horizon_months: 12 }, forecast: Array.from({ length: 12 }, (_, index) => ({ ...result.forecast[0], ds: new Date(Date.UTC(2026, 11 + index, 1)).toISOString().slice(0, 10), yhat: index + 1 })) };
  const annual = forecastTimeframeSummary(year, 'yearly');
  assert.equal(annual.yhat, 78); assert.equal(annual.end, '2027-11-30'); assert.equal(annual.yhat_lower, null);
  assert.equal(buildForecastChart(year, { recentMonths: 6 }).months.length, 18);
  assert.throws(() => validateForecastResponse(result, { timeframe: 'weekly' }), /invalid response/);
});
test('forecast chart preserves actual zeros, uses null for absent months, and distinguishes estimates and their range', () => {
  const chart = buildForecastChart(validateForecastResponse(result));
  assert.equal(chart.months.length, 32);
  assert.equal(chart.datasets[0].data[0], 0);
  assert.equal(chart.datasets[0].data[chart.months.indexOf('2025-01-01')], null);
  assert.equal(chart.datasets[0].spanGaps, false);
  assert.equal(chart.datasets[1].data[0], null);
  assert.deepEqual(chart.datasets[1].data.slice(-1), [8]);
  assert.deepEqual(chart.datasets[1].borderDash, [7, 5]);
  assert.deepEqual(chart.datasets[2].data.slice(-1), [0]);
  assert.equal(chart.datasets[3].fill, '-1');
});
test('invalid forecasts and missing metadata fail before they can render as zero predictions', () => {
  const invalid = [null, {}, { ...result, historical: [] }, { ...result, forecast: [] }, { ...result, dataset: {} },
    { ...result, dataset: { ...result.dataset, missing_months: [], missing_month_count: 0 } },
    { ...result, forecast: result.forecast.map(row => ({ ...row, yhat: '8' })) },
    { ...result, forecast: result.forecast.map(row => ({ ...row, yhat_lower: null })) },
    { ...result, forecast: result.forecast.map(row => ({ ...row, yhat_lower: 20 })) },
    { ...result, forecast: ['2026-12-01', '2027-01-01', '2027-02-01'].map(ds => ({ ...result.forecast[0], ds })) },
    { ...result, model: { ...result.model, horizon_months: 3 } }];
  for (const value of invalid) assert.throws(() => validateForecastResponse(value), /invalid response/);
  assert.equal(validateForecastResponse({ ...result, forecast: result.forecast.map(row => ({ ...row, yhat_lower: null, yhat_upper: null })) }).forecast.length, 1);
});

test('compact forecast shows recent calendar months without inventing history and can still reveal the full dataset', () => {
  const chart = buildForecastChart(result, { recentMonths: 6, includeRanges: false });
  assert.equal(chart.months[0], '2026-06-01');
  assert.equal(chart.months.at(-1), '2026-12-01');
  assert.equal(chart.months.length, 7);
  assert.equal(chart.datasets.length, 2);
  assert.deepEqual(chart.datasets[0].data.slice(0, 5), [null, null, null, null, null]);
  assert.equal(chart.forecastStartIndex, 6);
  assert.equal(chart.datasets[1].data[5], 4, 'The projection starts at the last recorded count');
  assert.deepEqual(chart.datasets[1].data.slice(6), [8]);
  assert.equal(chart.datasets[1].pointRadius[5], 0, 'The historical anchor is not shown as an estimated point');
  assert.equal(buildForecastChart(result, { includeRanges: false }).datasets[0].data[0], 0, 'The full view retains older real zeros');
});
