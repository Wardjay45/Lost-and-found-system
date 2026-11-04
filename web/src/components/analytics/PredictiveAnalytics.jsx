import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend, Filler } from 'chart.js';
import { analyticsApi } from '../../services/api';
import { validateForecastResponse, forecastTimeframeSummary } from '../../../../shared/forecast.mjs';
import { buildForecastChart } from '../../services/forecastChart.mjs';
import useLiveRefresh from '../../hooks/useLiveRefresh';
import { useAppSettings } from '../../context/AppContext';
import { ErrorState, LoadingState } from '../common/UI';
import AppIcon from '../common/AppIcon';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend, Filler);
const monthLabel = month => new Date(month + 'T00:00:00Z').toLocaleDateString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const countLabel = value => value === null ? 'Unavailable' : new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value);
const wholeCount = value => new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(value);
const periods = { weekly: '1 week', monthly: '1 month', yearly: '1 year' };
const dateLabel = date => new Date(date + 'T00:00:00Z').toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export default function PredictiveAnalytics() {
  const { settings } = useAppSettings();
  const [timeframe, setTimeframe] = useState('monthly');
  const [response, setResponse] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const data = response && (response.model.timeframe || 'monthly') === timeframe ? response : null;
  const pending = useRef(null);
  const requestVersion = useRef(0);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const load = useCallback(({ background = false } = {}) => {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    const version = ++requestVersion.current;
    if (!background) setLoading(true);
    setError('');
    return analyticsApi.getForecast({ timeframe, signal: controller.signal }).then(result => validateForecastResponse(result, { timeframe })).then(result => { if (version === requestVersion.current) { setResponse(result); setError(''); } })
      .catch(failure => { if (!controller.signal.aborted && version === requestVersion.current) setError(failure.message || 'Unable to load the forecast.'); })
      .finally(() => { if (version === requestVersion.current) { pending.current = null; setLoading(false); } });
  }, [timeframe]);
  const invalidateRequests = useCallback(() => { requestVersion.current++; pending.current?.abort(); }, []);
  useEffect(() => { void load(); return invalidateRequests; }, [load, invalidateRequests]);
  useLiveRefresh('analytics_forecast', load);
  const chart = useMemo(() => data ? buildForecastChart(data, { recentMonths: showAllHistory ? null : 6, includeRanges: false }) : null, [data, showAllHistory]);
  const dark = settings.darkMode || settings.colorTheme === 'midnight';
  const color = settings.highContrast ? (dark ? '#ffffff' : '#111827') : dark ? '#b8c5dc' : '#526079';
  const interval = data ? Math.round(data.model.interval_width * 100) : 80;
  const estimate = data ? forecastTimeframeSummary(data, timeframe) : null;
  const options = {
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { filter: item => item.datasetIndex === 0 || item.dataIndex >= chart?.forecastStartIndex, callbacks: { label: item => `${item.datasetIndex === 0 ? 'Recorded' : 'Estimated'}: ${countLabel(item.raw)} found items per month`, footer: items => {
        const row = data?.forecast.find(value => value.ds === chart?.months[items[0]?.dataIndex]);
        return row && row.yhat_lower !== null ? `Estimated range: ${wholeCount(Math.floor(row.yhat_lower))}–${wholeCount(Math.ceil(row.yhat_upper))}` : 'Recorded in the UBC sample';
      } } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color, maxTicksLimit: 6, maxRotation: 45 } },
      y: { beginAtZero: true, ticks: { color, precision: 0 }, grid: { color: dark ? '#303d58' : '#e8edf5' } },
    },
  };
  return <section className="predictive-analytics ui-panel" aria-labelledby="predictive-analytics-title" aria-busy={loading}>
    <header className="predictive-heading"><div><h2 id="predictive-analytics-title">Expected found items</h2><p className="lf-text-muted">An estimate for {periods[timeframe]} after the latest recorded month.</p></div><span className="predictive-demo-label">UBC sample data</span></header>
    <div className="predictive-timeframe"><span>Time frame</span><div className="segmented-control" role="group" aria-label="Forecast time frame">{Object.entries(periods).map(([value, label]) => <button type="button" key={value} aria-pressed={timeframe === value} onClick={() => setTimeframe(value)}>{label}</button>)}</div></div>
    {loading && !data && <LoadingState label="Loading estimates..." />}
    {error && <ErrorState message={error} onRetry={load} />}
    {data && <>
      {error && <p className="text-sm lf-text-muted mb-4">Showing the last available estimates.</p>}
      <div className="predictive-body">
      <ol className="predictive-months" aria-label={periods[timeframe] + ' estimate'}><li className="predictive-month-next">
        <h3>{timeframe === 'monthly' ? monthLabel(estimate.start) : `${dateLabel(estimate.start)} – ${dateLabel(estimate.end)}`}</h3>
        <p className="predictive-month-count"><span aria-hidden="true">≈ </span>{wholeCount(Math.round(estimate.yhat))}<small>found items in {periods[timeframe]}</small></p>
        <p className="predictive-month-range">{timeframe === 'yearly' ? 'Total of 12 monthly projections.' : estimate.yhat_lower === null ? 'Range unavailable' : `Estimated range: ${wholeCount(Math.floor(estimate.yhat_lower))}–${wholeCount(Math.ceil(estimate.yhat_upper))}`}</p>
        {timeframe === 'weekly' && <p className="predictive-month-range">7-day estimate based on the monthly rate.</p>}
      </li></ol>
      <div className="predictive-plot">
      <div className="predictive-legend" aria-label="Chart legend"><span><i className="predictive-actual-key" />Recorded per month</span><span><i className="predictive-forecast-key" />Estimated per month</span><span className="predictive-history-label">{showAllHistory ? 'All available history' : 'Recent months'}</span></div>
      <div className="predictive-chart" role="img" aria-label={'Monthly UBC found-item history and monthly projections used for the ' + periods[timeframe] + ' estimate. Missing months are left blank.'}>
        <Line data={{ labels: chart.months.map(monthLabel), datasets: chart.datasets }} options={options} />
      </div>
      </div>
      </div>
      <p className="predictive-caution"><AppIcon name="info" />Sample forecast based on UBC found-item records. Estimates are not guaranteed.</p>
      <details className="predictive-method"><summary>About this forecast</summary>
        <p>{data.dataset.description} The sample contains {data.dataset.total_records} records across {data.dataset.observed_months} recorded months, with {data.dataset.missing_month_count} months unavailable. Missing months stay blank; they are not counted as zero.</p>
        <p>Forecasts start after {monthLabel(data.dataset.last_observed_month)}. The weekly view prorates the next monthly estimate over seven days; the yearly view totals twelve monthly projections. The chart uses monthly counts in every view.</p>
        <p>Monthly prediction ranges use an {interval}% model interval, not an accuracy score. The yearly total does not have a combined prediction range. Limited history and incomplete months can affect these estimates.</p>
        <button type="button" className="ui-button ui-button-link" aria-pressed={showAllHistory} onClick={() => setShowAllHistory(value => !value)}>{showAllHistory ? 'Show recent months' : 'Show all history'}</button>
      </details>
    </>}
  </section>;
}
