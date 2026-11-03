import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { useAppSettings } from '../context/AppContext';
import useLiveRefresh from '../hooks/useLiveRefresh';
import { dashboardApi, lostItemsApi, foundItemsApi, categoriesApi } from '../services/api';
import { PageHeader, DataRegion, EmptyState } from '../components/common/UI';
import StatCard from '../components/common/StatCard';
import PredictiveAnalytics from '../components/analytics/PredictiveAnalytics';
import AppIcon from '../components/common/AppIcon';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);
const API_URL = import.meta.env.VITE_API_URL || '/api';
const lostColor = '#8b83f0', foundColor = '#16a89a';
const statuses = [['pending', 'Pending'], ['active', 'Active'], ['potential_match', 'Potential match'], ['claimed', 'Claimed'], ['cancelled', 'Cancelled']];

function LocationHeatmap({ title, rows, kind }) {
  const places = [...rows].sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...places.map(place => place.count));
  return <section className="ui-panel analytics-descriptive-panel" data-location-kind={kind}>
    <div className="section-header analytics-panel-heading"><div><h3><AppIcon name={kind === 'lost' ? 'search' : 'box'} />{title}</h3><p>{places.length ? `${places.length} ${places.length === 1 ? 'location' : 'locations'} · ${places.reduce((total, place) => total + place.count, 0)} reported items` : 'Locations from your recorded reports'}</p></div></div>
    {places.length ? <>
      <ul className="analytics-location-tiles" aria-label={title}>{places.map(place => <li key={place.location} style={{ '--tile-strength': `${8 + place.count / max * 28}%` }}>
        <span className="analytics-tile-location">{place.location || 'Not recorded'}</span>
        <strong>{place.count}</strong><span className="analytics-tile-unit">{place.count === 1 ? 'item' : 'items'} {kind}</span>
      </li>)}</ul>
      <div className="analytics-heatmap-legend" aria-hidden="true"><span>Fewer items</span>{[8, 15, 22, 29, 36].map(strength => <i key={strength} style={{ '--tile-strength': `${strength}%` }} />)}<span>More items</span></div>
    </> : <EmptyState icon="location" title="No locations yet" description="Locations will appear as items are reported." />}
  </section>;
}

export default function Analytics() {
  const { settings } = useAppSettings();
  const [pageError, setPageError] = useState(''), [pageLoading, setPageLoading] = useState(true);
  const [stats, setStats] = useState({}), [lostItems, setLostItems] = useState([]), [foundItems, setFoundItems] = useState([]);
  const [categories, setCategories] = useState([]), [heatmap, setHeatmap] = useState({ lost: [], found: [] });
  const [trendPeriod, setTrendPeriod] = useState('monthly');
  const requestVersion = useRef(0);
  const invalidateRequests = useCallback(() => { requestVersion.current++; }, []);
  const load = useCallback(async ({ background = false } = {}) => {
    const version = ++requestVersion.current;
    if (!background) setPageLoading(true);
    try {
      const [nextStats, lost, found, nextCategories, locations] = await Promise.all([
        dashboardApi.getStats(), lostItemsApi.getAll(), foundItemsApi.getAll(), categoriesApi.getAll(),
        fetch(API_URL + '/dashboard/location-heatmap', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('token') || '') } })
          .then(response => { if (!response.ok) throw new Error('Unable to load locations.'); return response.json(); }),
      ]);
      if (version !== requestVersion.current) return;
      setStats(nextStats); setLostItems(lost); setFoundItems(found); setCategories(nextCategories); setHeatmap(locations); setPageError('');
    } catch (error) { if (version === requestVersion.current) setPageError(error.message || 'Unable to load analytics.'); }
    finally { if (version === requestVersion.current) setPageLoading(false); }
  }, []);
  useEffect(() => { void load(); return invalidateRequests; }, [load, invalidateRequests]);
  useLiveRefresh(['lost_items', 'found_items', 'matches', 'categories', 'users', 'activity_logs', 'qr_locations'], load);

  const historicalData = useMemo(() => {
    const now = new Date(), monthly = trendPeriod === 'monthly', count = monthly ? 6 : 8;
    const buckets = Array.from({ length: count }, (_, index) => {
      const date = new Date(now); date.setHours(0, 0, 0, 0);
      if (monthly) date.setMonth(now.getMonth() - count + 1 + index, 1);
      else date.setDate(now.getDate() + 1 - (count - index) * 7);
      return { date, lost: 0, found: 0 };
    });
    const add = (items, key, field) => items.forEach(item => {
      const date = new Date(item[field]);
      if (!Number.isFinite(date.getTime())) return;
      const bucket = buckets.find(value => monthly
        ? value.date.getFullYear() === date.getFullYear() && value.date.getMonth() === date.getMonth()
        : date >= value.date && date < new Date(value.date.getTime() + 7 * 86400000));
      if (bucket) bucket[key]++;
    });
    add(lostItems, 'lost', 'date_reported'); add(foundItems, 'found', 'date_found');
    return {
      labels: buckets.map(bucket => bucket.date.toLocaleDateString('en', monthly ? { month: 'short', year: '2-digit' } : { month: 'short', day: 'numeric' })),
      datasets: [
        { label: 'Lost', data: buckets.map(bucket => bucket.lost), backgroundColor: lostColor, borderRadius: 4 },
        { label: 'Found', data: buckets.map(bucket => bucket.found), backgroundColor: foundColor, borderRadius: 4 },
      ],
    };
  }, [lostItems, foundItems, trendPeriod]);
  const activeCategories = categories.filter(category => category.auto_tagging !== false).map(category => ({
    name: category.name,
    lost: lostItems.filter(item => item.category_name === category.name).length,
    found: foundItems.filter(item => item.category_name === category.name).length,
  }));
  const categoryData = { labels: activeCategories.map(category => category.name), datasets: [
    { label: 'Lost', data: activeCategories.map(category => category.lost), backgroundColor: lostColor, borderRadius: 4 },
    { label: 'Found', data: activeCategories.map(category => category.found), backgroundColor: foundColor, borderRadius: 4 },
  ] };
  const shownStatuses = [...statuses, ...([...lostItems, ...foundItems].some(item => item.status === 'resolved') ? [['resolved', 'Resolved']] : [])];
  const statusData = { labels: shownStatuses.map(([, label]) => label.includes(' ') ? label.split(' ') : label), datasets: [
    { label: 'Lost', data: shownStatuses.map(([status]) => lostItems.filter(item => item.status === status).length), backgroundColor: lostColor, borderRadius: 4 },
    { label: 'Found', data: shownStatuses.map(([status]) => foundItems.filter(item => item.status === status).length), backgroundColor: foundColor, borderRadius: 4 },
  ] };
  const dark = settings.darkMode || settings.colorTheme === 'midnight';
  const text = settings.highContrast ? (dark ? '#ffffff' : '#111827') : dark ? '#b8c5dc' : '#526079';
  const grid = dark ? '#303d58' : '#e8edf5';
  const options = {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { position: 'top', labels: { color: text, usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 8, padding: 16 } } },
    scales: { x: { grid: { display: false }, ticks: { color: text, maxRotation: 35 } }, y: { beginAtZero: true, grid: { color: grid }, ticks: { color: text, precision: 0 } } },
  };
  const categoryOptions = { ...options, scales: { ...options.scales, x: { ...options.scales.x, ticks: { color: text, autoSkip: false, maxRotation: 35, minRotation: 0 } } } };

  return <div className="page page-analytics">
    <PageHeader title="Analytics" description="Your lost and found reports at a glance." />
    <DataRegion loading={pageLoading} error={pageError} onRetry={load}>
      <div className="metric-grid">
        <StatCard title="Lost reports" value={stats.totalLostItems || 0} icon="search" />
        <StatCard title="Found reports" value={stats.totalFoundItems || 0} icon="box" />
        <StatCard title="Potential matches" value={stats.lostPotentialMatch || 0} icon="matching" color="yellow" />
        <StatCard title="Claimed items" value={stats.lostClaimed || 0} icon="success" color="green" />
      </div>
    </DataRegion>
    <PredictiveAnalytics />
    {!pageLoading && !pageError && <section className="analytics-descriptive" aria-labelledby="descriptive-analytics-title">
      <header className="analytics-section-heading"><span><AppIcon name="chart" /></span><div><h2 id="descriptive-analytics-title">Descriptive analytics</h2><p>A summary of reports already recorded in your system.</p></div></header>
      <section className="ui-panel analytics-descriptive-panel analytics-history-panel">
          <div className="section-header analytics-panel-heading"><div><h3>Historical reporting trends</h3><p>Compare lost and found reports over time</p></div>
            <div className="segmented-control" role="group" aria-label="Report period">{['monthly', 'weekly'].map(period => <button type="button" key={period} aria-pressed={trendPeriod === period} onClick={() => setTrendPeriod(period)}>{period === 'monthly' ? 'Monthly' : 'Weekly'}</button>)}</div>
          </div>
          <div className="analytics-chart analytics-history-chart"><Bar data={historicalData} options={options} role="img" aria-label={`${trendPeriod === 'monthly' ? 'Monthly' : 'Weekly'} lost and found reports recorded in your system`} /></div>
      </section>

      <div className="analytics-subheading"><h3>Report overview</h3><span>Current item status and categories</span></div>
      <div className="analytics-grid">
        <section className="ui-panel analytics-descriptive-panel"><div className="section-header analytics-panel-heading"><div><h4>Items by status</h4><p>The current status of recorded reports</p></div></div>
          {lostItems.length || foundItems.length ? <div className="analytics-chart"><Bar data={statusData} options={options} role="img" aria-label="Lost and found reports by current status" /></div> : <EmptyState icon="box" title="No reports yet" description="Report status will appear here when items are added." />}
        </section>
        <section className="ui-panel analytics-descriptive-panel"><div className="section-header analytics-panel-heading"><div><h4>Items by category</h4><p>Lost and found reports in active categories</p></div></div>
          {activeCategories.some(category => category.lost + category.found > 0) ? <div className="analytics-category-scroll" role="region" aria-label="Category chart; scroll to see all categories" tabIndex={0}><div className="analytics-chart" style={{ minWidth: `${Math.max(300, activeCategories.length * 85)}px` }}><Bar data={categoryData} options={categoryOptions} role="img" aria-label="Lost and found report counts by category" /></div></div> : <EmptyState icon="tag" title="No category activity yet" description="Reported items will appear here by category." />}
        </section>
      </div>

      <div className="analytics-subheading"><h3>System totals</h3><span>Recorded recoveries and account totals</span></div>
      <dl className="analytics-system-totals">{[
        ['Claimed lost reports', stats.lostClaimed || 0, 'search'],
        ['Claimed found reports', stats.foundClaimed || 0, 'box'],
        ['Registered users', stats.totalUsers || 0, 'users'],
        ['Active categories', activeCategories.length, 'tag'],
      ].map(([label, value, icon]) => <div className="ui-panel" key={label}><dt><AppIcon name={icon} />{label}</dt><dd>{value}</dd></div>)}</dl>

      <div className="analytics-subheading"><h3>Location intelligence</h3><span>See where lost and found items are reported</span></div>
      <div className="analytics-grid">
        <LocationHeatmap title="Where items are lost" rows={heatmap.lost} kind="lost" />
        <LocationHeatmap title="Where items are found" rows={heatmap.found} kind="found" />
      </div>
    </section>}
  </div>;
}
