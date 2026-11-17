export const forecastMethods = ['Prophet', 'ARIMA', 'Exponential Smoothing'];
const colors = ['#a89aff', '#28bfa5', '#efb34f'];

export function getSelectedCategoryForecast(category) {
  if (category.status !== 'ok' || !forecastMethods.includes(category.method)
      || !Number.isFinite(category.expected_reports) || category.expected_reports < 0) return null;
  const metric = category.metrics.find(row => row.method === category.method);
  if (metric?.forecast_status !== 'ok' || metric.forecast_month !== category.forecast_month
      || !Number.isFinite(metric.expected_reports) || metric.expected_reports < 0) return null;
  return { method: category.method, value: category.expected_reports };
}

export function buildCategoryTrendChart(category, { historyLabel = 'Recorded reports' } = {}) {
  const history = [...category.historical].sort((a, b) => a.ds.localeCompare(b.ds)).slice(-6);
  if (!history.length || !category.forecast_month) return null;
  const last = history.at(-1);
  return {
    months: [...history.map(row => row.ds), category.forecast_month],
    datasets: [
      { label: historyLabel, data: [...history.map(row => row.y), null], borderColor: '#8596b2', backgroundColor: '#8596b2', borderWidth: 2, pointRadius: 3, tension: 0, spanGaps: false },
      ...forecastMethods.map((method, index) => {
        const metric = category.metrics.find(row => row.method === method);
        const valid = metric?.forecast_status === 'ok' && Number.isFinite(metric.expected_reports);
        return { label: method, data: [...history.map((_, i) => valid && i === history.length - 1 ? last.y : null), valid ? metric.expected_reports : null],
          borderColor: colors[index], backgroundColor: colors[index], borderWidth: 2.5,
          borderDash: [[6, 4], [3, 3], [10, 4]][index], pointStyle: ['circle', 'rectRot', 'triangle'][index],
          pointRadius: [...history.map(() => 0), 5], pointHoverRadius: 7, tension: 0, spanGaps: false };
      }),
    ],
  };
}

export function buildCategoryForecastChart(categories) {
  return {
    labels: categories.map(row => row.category),
    datasets: forecastMethods.map((method, index) => ({
      label: method,
      data: categories.map(row => {
        const metric = row.metrics.find(value => value.method === method);
        return metric?.forecast_status === 'ok' && Number.isFinite(metric.expected_reports)
          ? metric.expected_reports : null;
      }),
      backgroundColor: colors[index], borderColor: colors[index], borderWidth: 1,
      borderRadius: 4, maxBarThickness: 18,
    })),
  };
}
