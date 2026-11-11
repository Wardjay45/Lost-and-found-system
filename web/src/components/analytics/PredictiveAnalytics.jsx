import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend, Filler } from 'chart.js';
import { analyticsApi } from '../../services/api';
import { validateForecastResponse, forecastTimeframeSummary } from '../../../../shared/forecast.mjs';
import { buildForecastChart } from '../../services/forecastChart.mjs';
import useLiveRefresh from '../../hooks/useLiveRefresh';
import { useAppSettings } from '../../context/AppContext';
import { EmptyState, ErrorState, LoadingState } from '../common/UI';
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
  const [source, setSource] = useState('campus');
  const [itemType, setItemType] = useState('found');
  const reportLabel = `${itemType}-item reports`;
  const sourceLabel = source === 'sample' ? 'UBC sample data' : 'Campus records';
  const selectionKey = `${source}:${itemType}:${timeframe}`;
  const [unavailable, setUnavailable] = useState(null);
  const empty = unavailable?.key === selectionKey;
  const [response, setResponse] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const data = response && response.dataset.record_type === `${itemType}_items` && response.dataset.temporary === (source === 'sample') && (response.model.timeframe || 'monthly') === timeframe ? response : null;
  const pending = useRef(null);
  const requestVersion = useRef(0);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const load = useCallback(({ background = false } = {}) => {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    const version = ++requestVersion.current;
    if (!background) setLoading(true);
    setError('');
    return analyticsApi.getForecast({ timeframe, source, itemType, signal: controller.signal }).then(result => validateForecastResponse(result, { timeframe })).then(result => { if (version === requestVersion.current) { setResponse(result); setUnavailable(null); setError(''); } })
      .catch(failure => {
        if (controller.signal.aborted || version !== requestVersion.current) return;
        if (failure.code === 'FORECAST_HISTORY_UNAVAILABLE') {
          setResponse(null);
          setUnavailable({ key: selectionKey, message: failure.message });
        } else setError(failure.message || 'Unable to load the forecast.');
      })
      .finally(() => { if (version === requestVersion.current) { pending.current = null; setLoading(false); } });
  }, [timeframe, source, itemType, selectionKey]);
  const invalidateRequests = useCallback(() => { requestVersion.current++; pending.current?.abort(); }, []);
  useEffect(() => { void load(); return invalidateRequests; }, [load, invalidateRequests]);
  useLiveRefresh(['analytics_forecast', 'lost_items', 'found_items'], load);
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
      tooltip: { filter: item => item.datasetIndex === 0 || item.dataIndex >= chart?.forecastStartIndex, callbacks: { label: item => `${item.datasetIndex === 0 ? 'Recorded' : 'Estimated'}: ${countLabel(item.raw)} ${reportLabel} per month`, footer: items => {
        const row = data?.forecast.find(value => value.ds === chart?.months[items[0]?.dataIndex]);
        return row && row.yhat_lower !== null ? `Estimated range: ${wholeCount(Math.floor(row.yhat_lower))}–${wholeCount(Math.ceil(row.yhat_upper))}` : `Recorded in ${sourceLabel}`;
      } } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color, maxTicksLimit: 6, maxRotation: 45 } },
      y: { beginAtZero: true, ticks: { color, precision: 0 }, grid: { color: dark ? '#303d58' : '#e8edf5' } },
    },
  };
  return <section className="predictive-analytics ui-panel" aria-labelledby="predictive-analytics-title" aria-busy={loading}>
    <header className="predictive-heading"><div><h2 id="predictive-analytics-title">Expected {itemType} items</h2><p className="lf-text-muted">An estimate for {periods[timeframe]} after the latest recorded month.</p></div><span className="predictive-demo-label">{sourceLabel}</span></header>
    <div className="predictive-controls">
    <div className="predictive-timeframe"><span>Show</span><div className="segmented-control" role="group" aria-label="Forecast report type">{['found', 'lost'].map(type => <button type="button" key={type} aria-pressed={itemType === type} onClick={() => setItemType(type)}>{type === 'lost' ? 'Expected lost' : 'Expected found'}</button>)}</div></div>
    <div className="predictive-timeframe"><label className="predictive-source">Data source <select className="ui-input" value={source} onChange={event => setSource(event.target.value)}><option value="campus">Campus records</option><option value="sample">UBC sample data</option></select></label></div>
    <div className="predictive-timeframe"><span>Time frame</span><div className="segmented-control" role="group" aria-label="Forecast time frame">{Object.entries(periods).map(([value, label]) => <button type="button" key={value} aria-pressed={timeframe === value} onClick={() => setTimeframe(value)}>{label}</button>)}</div></div>
    </div>
    {loading && !data && !empty && <LoadingState label="Loading estimates..." />}
    {error && <ErrorState message={error} onRetry={load} />}
    {empty && <div className="predictive-body" role="status">
      <ol className="predictive-months" aria-label={periods[timeframe] + ' estimate'}><li className="predictive-month-next">
        <h3>Expected {itemType} items</h3>
        <p className="predictive-month-count"><span aria-hidden="true">—</span><span className="sr-only">Estimate unavailable</span><small>{reportLabel} in {periods[timeframe]}</small></p>
        <p className="predictive-month-range">Waiting for historical data</p>
      </li></ol>
      <EmptyState icon="chart" title={`Not enough ${itemType}-item history to forecast yet`} description={unavailable.message} />
    </div>}
    {data && <>
      {error && <p className="text-sm lf-text-muted mb-4">Showing the last available estimates.</p>}
      <div className="predictive-body">
      <ol className="predictive-months" aria-label={periods[timeframe] + ' estimate'}><li className="predictive-month-next">
        <h3>{timeframe === 'monthly' ? monthLabel(estimate.start) : `${dateLabel(estimate.start)} – ${dateLabel(estimate.end)}`}</h3>
        <p className="predictive-month-count"><span aria-hidden="true">≈ </span>{wholeCount(Math.round(estimate.yhat))}<small>{reportLabel} in {periods[timeframe]}</small></p>
        <p className="predictive-month-range">{timeframe === 'yearly' ? 'Total of 12 monthly projections.' : estimate.yhat_lower === null ? 'Range unavailable' : `Estimated range: ${wholeCount(Math.floor(estimate.yhat_lower))}–${wholeCount(Math.ceil(estimate.yhat_upper))}`}</p>
        {timeframe === 'weekly' && <p className="predictive-month-range">7-day estimate based on the monthly rate.</p>}
      </li></ol>
      <div className="predictive-plot">
      <div className="predictive-legend" aria-label="Chart legend"><span><i className="predictive-actual-key" />Recorded per month</span><span><i className="predictive-forecast-key" />Estimated per month</span><span className="predictive-history-label">{showAllHistory ? 'All available history' : 'Recent months'}</span></div>
      <div className="predictive-chart" role="img" aria-label={`Monthly ${reportLabel} history and monthly projections used for the ` + periods[timeframe] + ' estimate. Missing months are left blank.'}>
        <Line data={{ labels: chart.months.map(monthLabel), datasets: chart.datasets }} options={options} />
      </div>
      </div>
      </div>
      <p className="predictive-caution"><AppIcon name="info" />{source === 'sample' ? 'Sample forecast based on UBC found-item records.' : `Forecast based on retained campus ${reportLabel}.`} Estimates are not guaranteed.</p>
      <details className="predictive-method"><summary>About this forecast</summary>
        <p>{data.dataset.description} The dataset contains {data.dataset.total_records} records across {data.dataset.observed_months} recorded months, with {data.dataset.missing_month_count} months unavailable. Missing months stay blank; they are not counted as zero.</p>
        <p>Forecasts start after {monthLabel(data.dataset.last_observed_month)}. The weekly view prorates the next monthly estimate over seven days; the yearly view totals twelve monthly projections. The chart uses monthly counts in every view.</p>
        <p>Monthly prediction ranges use an {interval}% model interval, not an accuracy score. The yearly total does not have a combined prediction range. Limited history and incomplete months can affect these estimates.</p>
        <button type="button" className="ui-button ui-button-link" aria-pressed={showAllHistory} onClick={() => setShowAllHistory(value => !value)}>{showAllHistory ? 'Show recent months' : 'Show all history'}</button>
      </details>
    </>}
  </section>;
}
