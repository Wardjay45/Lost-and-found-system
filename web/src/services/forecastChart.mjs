import { nextMonth } from '../../../shared/forecast.mjs';

export function buildForecastChart(data, { recentMonths = null, includeRanges = true } = {}) {
  const actual = new Map(data.historical.map(row => [row.ds, row.y]));
  const predicted = new Map(data.forecast.map(row => [row.ds, row]));
  const months = [];
  const end = data.forecast.at(-1).ds;
  let start = data.historical[0].ds;
  if (Number.isInteger(recentMonths) && recentMonths > 0) {
    const recentStart = new Date(data.historical.at(-1).ds + 'T00:00:00Z');
    recentStart.setUTCMonth(recentStart.getUTCMonth() - recentMonths + 1);
    start = [start, recentStart.toISOString().slice(0, 10)].sort().at(-1);
  }
  for (let month = start; month <= end; month = nextMonth(month)) months.push(month);
  const lastActual = data.historical.at(-1);
  const datasets = [
    { label: 'Recorded found items', data: months.map(month => actual.get(month) ?? null), borderColor: '#8b83f0', backgroundColor: '#8b83f0', pointRadius: 4, spanGaps: false, tension: 0, borderWidth: 2 },
    { label: 'Estimated found items', data: months.map(month => predicted.get(month)?.yhat ?? (month === lastActual.ds ? lastActual.y : null)), borderColor: '#16a89a', backgroundColor: '#16a89a', borderDash: [7, 5], pointStyle: 'rectRot', pointRadius: months.map(month => predicted.has(month) ? 5 : 0), spanGaps: false, tension: 0, borderWidth: 2 },
  ];
  if (includeRanges) datasets.push(
    { label: 'Lower prediction range', data: months.map(month => predicted.get(month)?.yhat_lower ?? null), borderColor: 'transparent', backgroundColor: 'transparent', pointRadius: 0, fill: false, borderWidth: 0 },
    { label: 'Upper prediction range', data: months.map(month => predicted.get(month)?.yhat_upper ?? null), borderColor: 'transparent', backgroundColor: 'rgba(22,168,154,.16)', pointRadius: 0, fill: '-1', borderWidth: 0 },
  );
  return {
    months,
    forecastStartIndex: months.indexOf(data.forecast[0].ds),
    datasets,
  };
}
