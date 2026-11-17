import { useCallback, useEffect, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend } from 'chart.js';
import { analyticsApi } from '../../services/api';
import { buildCategoryTrendChart, forecastMethods, getSelectedCategoryForecast } from '../../services/categoryForecastChart.mjs';
import useLiveRefresh from '../../hooks/useLiveRefresh';
import { useAppSettings } from '../../context/AppContext';
import { EmptyState, ErrorState, LoadingState } from '../common/UI';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend);
const month = value => value ? new Date(value + 'T00:00:00Z').toLocaleDateString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';

export default function CategoryForecastAnalytics() {
  const { settings } = useAppSettings();
  const [source, setSource] = useState('current'), [itemType, setItemType] = useState('lost');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const pending = useRef(null), version = useRef(0);
  const selection = source + ':' + itemType;
  const data = response?.selection === selection ? response.data : null;
  const load = useCallback(({ background = false } = {}) => {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    const request = ++version.current;
    if (!background) setLoading(true);
    setError('');
    return analyticsApi.getCategoryForecast({ source, itemType, signal: controller.signal }).then(result => {
      if (request === version.current) setResponse({ selection, data: result });
    }).catch(failure => {
      if (!controller.signal.aborted && request === version.current) setError(failure.message || 'Unable to load category forecasts.');
    }).finally(() => { if (request === version.current) setLoading(false); });
  }, [source, itemType, selection]);
  const cancel = useCallback(() => { version.current++; pending.current?.abort(); }, []);
  useEffect(() => { void load(); return cancel; }, [load, cancel]);
  useLiveRefresh(['analytics_forecast', 'lost_items', 'found_items', 'categories'], load);
  const hasForecast = data?.categories.some(row => row.metrics.some(metric => metric.forecast_status === 'ok' && Number.isFinite(metric.expected_reports)));
  const isSimulatedHistory = source === 'historical' && data?.dataset.dataset_kind === 'synthetic_gap_scenario';
  const historyLabel = isSimulatedHistory ? 'Historical reports (includes simulated months)' : 'Recorded reports';
  const dark = settings.darkMode || settings.colorTheme === 'midnight';
  const text = settings.highContrast ? (dark ? '#ffffff' : '#111827') : dark ? '#c5d0e5' : '#526079';
  const font = { size: settings.textSize === 'xlarge' ? 15 : settings.textSize === 'large' ? 14 : 12 };
  const options = {
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { filter: item => item.raw !== null && (item.datasetIndex === 0 || item.dataIndex === item.dataset.data.length - 1), callbacks: { label: item => item.dataset.label + ': ' + new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(item.raw) + (item.datasetIndex === 0 ? ' recorded reports' : ' expected reports') } },
    },
    scales: {
      x: { ticks: { color: text, maxRotation: 0, maxTicksLimit: 7, font }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color: text, font, precision: 0, maxTicksLimit: 5 }, grid: { color: dark ? '#303d58' : '#e8edf5' } },
    },
  };
  const download = () => {
    const fields = ['category', 'method', 'selected_by_validation', 'status', 'forecast_month', 'expected_reports', 'forecast_status', 'validation_MAE', 'validation_RMSE', 'validation_MASE', 'validation_RMSSE', 'validation_scale_note', 'test_MAE', 'test_RMSE', 'test_MASE', 'test_RMSSE', 'test_scale_note', 'dataset_kind', 'data_source', 'report_type', 'evaluation_basis'];
    const rows = data.categories.flatMap(row => row.metrics.map(metric => ({ category: row.category, ...metric, selected_by_validation: metric.method === row.method, dataset_kind: data.dataset.dataset_kind || 'recorded', data_source: source, report_type: itemType, evaluation_basis: data.dataset.evaluation_basis || '' })));
    const csv = [fields, ...rows.map(row => fields.map(field => row[field] ?? (field.endsWith('_MASE') || field.endsWith('_RMSSE') ? 'N/A' : '')))].map(row => row.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = source + '_' + itemType + '_model_comparison.csv'; link.click(); URL.revokeObjectURL(url);
  };
  return <section className="predictive-analytics ui-panel" aria-labelledby="predictive-analytics-title" aria-busy={loading}>
    <header className="predictive-heading"><div><h2 id="predictive-analytics-title">Category forecasts</h2><p className="lf-text-muted">Recent reporting trends and next-month estimates for every category.</p></div></header>
    <div className="predictive-controls">
      <label className="predictive-source">Data source <select className="ui-input" value={source} onChange={event => setSource(event.target.value)}><option value="current">Current Data</option><option value="historical">Historical Data</option></select></label>
      <label className="predictive-source">Report type <select className="ui-input" value={itemType} onChange={event => setItemType(event.target.value)}><option value="lost">Lost reports</option><option value="found">Found reports</option></select></label>
    </div>
    {loading && !data && <LoadingState label="Preparing category forecasts..." />}
    {error && <ErrorState message={error} onRetry={() => load()} />}
    {data && <>
      {isSimulatedHistory && <p className="lf-text-muted" role="note">Synthetic practice scenario: missing months include generated Lost records. Original records are retained. These forecasts are exploratory and do not establish real-world accuracy.</p>}
      {data.dataset.dataset_kind === 'practice' && <p className="lf-text-muted" role="note">Practice dataset: includes generated fields. These results are for testing and do not establish real-world forecasting accuracy.</p>}
      {source === 'historical' && itemType === 'found' ? <EmptyState icon="chart" title="No confirmed Found records" description="Select Lost reports to view the uploaded history, or Current Data for campus reports." /> : data.categories.length ? <>
        <div className="forecast-shared-legend" aria-label="Chart legend">{[historyLabel, ...forecastMethods].map((label, index) => <span key={label}><i className={'forecast-line-key forecast-line-' + index} />{label}</span>)}</div>
        <div className="category-trend-grid">{data.categories.map(row => {
          const chart = buildCategoryTrendChart(row, { historyLabel });
          const available = row.metrics.some(metric => metric.forecast_status === 'ok' && Number.isFinite(metric.expected_reports));
          const selected = getSelectedCategoryForecast(row);
          return <article className="category-trend-card" key={row.category}>
            <header className="category-trend-header"><div><h3>{row.category}</h3><p>{itemType === 'lost' ? 'Lost' : 'Found'} reports per month</p></div>
              <div className="category-trend-summary">
                <span className="category-trend-badge">{available ? month(row.forecast_month) : 'Awaiting history'}</span>
                <div className="category-trend-expected"><span>Expected {itemType === 'lost' ? 'lost' : 'found'}:</span><strong>{selected ? new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(selected.value) : 'Unavailable'}</strong></div>
                {selected && <span className="category-trend-model">{selected.method}</span>}
              </div>
            </header>
            {chart && available ? <>
              <div className="category-trend-plot"><Line data={{ labels: chart.months.map((value, index) => new Date(value + 'T00:00:00Z').toLocaleDateString('en', { month: 'short', timeZone: 'UTC' }) + (index === chart.months.length - 1 ? ' *' : '')), datasets: chart.datasets }} options={options} role="img" aria-label={row.category + ': six historical months followed by forecasts for ' + month(row.forecast_month) + ' from Prophet, ARIMA and Exponential Smoothing.'} /></div>
              <footer className="category-trend-footer"><span>* Next-month forecast</span><span>Dashed lines show estimates</span></footer>
            </> : <div className="category-trend-empty"><p>{row.metrics.length ? 'Forecast unavailable' : 'Not enough history to forecast'}</p><small>{row.metrics.length ? 'The methods could not produce reliable estimates for this category.' : 'At least ' + data.protocol.minimum_months + ' complete months are needed.'}</small></div>}
          </article>;
        })}</div>
        <p className="lf-text-muted forecast-graph-caption">{source === 'historical' ? 'Based on uploaded historical data, separate from DNSC campus records.' : 'Based on your recorded campus data.'} Estimates may include fractions. A zero forecast does not guarantee zero reports.</p>
      </> : <EmptyState icon="chart" title="Not enough history to forecast yet" description={'At least ' + data.protocol.minimum_months + ' complete months are needed. Forecasts appear when enough history is available.'} />}
      {hasForecast && <details className="predictive-method"><summary>About these forecasts</summary><p>Each chart shows the six most recent historical months. Dashed lines connect the final historical count to each method's next-month estimate. The expected count below the date uses the model selected on validation data. Missing or failed selected estimates show Unavailable; final fits with convergence warnings are excluded.</p><p>{data.dataset.description}</p><button type="button" className="ui-button ui-button-link" onClick={download}>Download evaluation results for documentation</button></details>}
    </>}
  </section>;
}
