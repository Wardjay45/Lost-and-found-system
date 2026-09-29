import { useState, useEffect, useMemo } from 'react';
import { dashboardApi, lostItemsApi, foundItemsApi, categoriesApi } from '../services/api';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler } from 'chart.js';
const API_URL = 'http://localhost:3001/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler);

export default function Analytics() {
  const [stats, setStats] = useState({});
  const [lostItems, setLostItems] = useState([]);
  const [foundItems, setFoundItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [heatmap, setHeatmap] = useState({ lost: [], found: [] });
  const [trendPeriod, setTrendPeriod] = useState('monthly');

  useEffect(() => {
    dashboardApi.getStats().then(setStats).catch(console.error);
    lostItemsApi.getAll().then(setLostItems).catch(console.error);
    foundItemsApi.getAll().then(setFoundItems).catch(console.error);
    categoriesApi.getAll().then(setCategories).catch(console.error);
    fetch(`${API_URL}/dashboard/location-heatmap`)
      .then(res => res.json())
      .then(setHeatmap)
      .catch(console.error);
  }, []);

  const activeCategories = categories.filter(c => c.auto_tagging !== false);

  // Compute item_count per category from lost + found items
  const categoriesWithCounts = activeCategories.map(cat => {
    const lostCount = lostItems.filter(item => item.category_name === cat.name).length;
    const foundCount = foundItems.filter(item => item.category_name === cat.name).length;
    return { ...cat, item_count: lostCount + foundCount };
  });

  const barData = {
    labels: ['Pending', 'Active'],
    datasets: [
      { label: 'Lost Items', data: [stats.lostPending || 0, stats.lostActive || 0], backgroundColor: '#4f46e5' },
      { label: 'Found Items', data: [0, stats.foundActive || 0], backgroundColor: '#0ea5e9' },
    ],
  };

  // Grouped bar chart: Lost vs Found per category
  const categoryBarData = {
    labels: categoriesWithCounts.map(c => c.name),
    datasets: [
      {
        label: 'Lost Reports',
        data: categoriesWithCounts.map(c => lostItems.filter(item => item.category_name === c.name).length),
        backgroundColor: '#4f46e5',
        borderRadius: 4,
      },
      {
        label: 'Found Reports',
        data: categoriesWithCounts.map(c => foundItems.filter(item => item.category_name === c.name).length),
        backgroundColor: '#0ea5e9',
        borderRadius: 4,
      },
    ],
  };

  const categoryBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { color: '#9ca3af' } },
      tooltip: {
        callbacks: {
          footer: (items) => {
            const total = items.reduce((sum, item) => sum + (item.raw || 0), 0);
            return `Total: ${total} items`;
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#9ca3af', maxRotation: 45, minRotation: 0 } },
      y: { beginAtZero: true, grid: { color: '#374151' }, ticks: { stepSize: 1, color: '#9ca3af' } },
    },
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#9ca3af' } } },
    scales: { x: { grid: { display: false }, ticks: { color: '#9ca3af' } }, y: { beginAtZero: true, grid: { color: '#374151' }, ticks: { color: '#9ca3af' } } },
  };

  // GitHub-style contribution tile colors
  const getLostTileColor = (count, max) => {
    if (count === 0) return 'bg-gray-100 dark:bg-gray-700/40';
    const pct = count / max;
    if (pct >= 0.8) return 'bg-red-500 dark:bg-red-600';
    if (pct >= 0.6) return 'bg-red-400 dark:bg-red-500';
    if (pct >= 0.4) return 'bg-red-300 dark:bg-red-400/80';
    if (pct >= 0.2) return 'bg-red-200 dark:bg-red-400/50';
    return 'bg-red-100 dark:bg-red-400/30';
  };

  const getFoundTileColor = (count, max) => {
    if (count === 0) return 'bg-gray-100 dark:bg-gray-700/40';
    const pct = count / max;
    if (pct >= 0.8) return 'bg-green-500 dark:bg-green-600';
    if (pct >= 0.6) return 'bg-green-400 dark:bg-green-500';
    if (pct >= 0.4) return 'bg-green-300 dark:bg-green-400/80';
    if (pct >= 0.2) return 'bg-green-200 dark:bg-green-400/50';
    return 'bg-green-100 dark:bg-green-400/30';
  };

  const lostMax = Math.max(1, ...heatmap.lost.map(h => h.count));
  const foundMax = Math.max(1, ...heatmap.found.map(h => h.count));

  // Lightweight, explainable forecast: linear trend over the last six months.
  // It is intentionally labeled as an estimate so admins can distinguish it
  // from actual reports and replace it with a trained model later.
  const forecast = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString('en', { month: 'short' }), lost: 0, found: 0 };
    });
    const add = (items, field) => items.forEach(item => {
      const raw = item.date_reported || item.date_found || item.created_at;
      const d = raw && new Date(raw);
      if (!d || Number.isNaN(d.getTime())) return;
      const bucket = months.find(m => m.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (bucket) bucket[field] += 1;
    });
    add(lostItems, 'lost'); add(foundItems, 'found');
    const predict = (values) => {
      const n = values.length; const xMean = (n - 1) / 2;
      const yMean = values.reduce((a, b) => a + b, 0) / n;
      const slope = values.reduce((sum, y, x) => sum + (x - xMean) * (y - yMean), 0) /
        (values.reduce((sum, _, x) => sum + (x - xMean) ** 2, 0) || 1);
      return Math.max(0, Math.round(yMean + slope * n));
    };
    const next = { lost: predict(months.map(m => m.lost)), found: predict(months.map(m => m.found)) };
    return { months, next, total: next.lost + next.found };
  }, [lostItems, foundItems]);

  const forecastData = {
    labels: [...forecast.months.map(m => m.label), 'Next month'],
    datasets: [
      { label: 'Lost reports', data: [...forecast.months.map(m => m.lost), forecast.next.lost], borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,.10)', tension: .35, fill: true, pointRadius: 3 },
      { label: 'Found reports', data: [...forecast.months.map(m => m.found), forecast.next.found], borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.08)', tension: .35, fill: true, pointRadius: 3 },
    ],
  };
  const forecastOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: '#9ca3af' } }, tooltip: { callbacks: { footer: (items) => items[0]?.dataIndex === 6 ? 'Forecast estimate' : 'Historical reports' } } }, scales: { x: { grid: { display: false }, ticks: { color: '#9ca3af' } }, y: { beginAtZero: true, grid: { color: '#374151' }, ticks: { color: '#9ca3af', stepSize: 1 } } } };

  const historicalTrend = useMemo(() => {
    const now = new Date();
    const count = trendPeriod === 'monthly' ? 6 : 8;
    const buckets = Array.from({ length: count }, (_, i) => {
      const d = new Date(now);
      if (trendPeriod === 'monthly') d.setMonth(now.getMonth() - count + 1 + i, 1);
      else d.setDate(now.getDate() - (count - 1 - i) * 7);
      return { date: d, lost: 0, found: 0 };
    });
    const add = (items, key, dateField) => items.forEach(item => {
      const d = new Date(item[dateField] || item.created_at);
      if (Number.isNaN(d.getTime())) return;
      const bucket = buckets.find(b => trendPeriod === 'monthly'
        ? b.date.getFullYear() === d.getFullYear() && b.date.getMonth() === d.getMonth()
        : d >= b.date && d < new Date(b.date.getTime() + 7 * 86400000));
      if (bucket) bucket[key] += 1;
    });
    add(lostItems, 'lost', 'date_reported'); add(foundItems, 'found', 'date_found');
    return { labels: buckets.map(b => trendPeriod === 'monthly' ? b.date.toLocaleString('en', { month: 'short' }) : `${b.date.toLocaleString('en', { month: 'short' })} ${b.date.getDate()}`), lost: buckets.map(b => b.lost), found: buckets.map(b => b.found) };
  }, [lostItems, foundItems, trendPeriod]);

  const historicalData = { labels: historicalTrend.labels, datasets: [
    { label: 'Lost reports', data: historicalTrend.lost, backgroundColor: '#4f46e5', borderRadius: 5 },
    { label: 'Found reports', data: historicalTrend.found, backgroundColor: '#10b981', borderRadius: 5 },
  ] };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Understand what is happening now—and prepare for what comes next.</p>
        </div>
      </div>

      {/* Predictive Analytics */}
      <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">PREDICTIVE ANALYTICS</span><span className="text-xs text-gray-500 dark:text-gray-400">Trend estimate</span></div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Plan ahead with next-month reporting forecasts</h2>
            <p className="mt-1 max-w-xl text-sm text-gray-500 dark:text-gray-400">A six-month linear trend estimates how many lost and found reports you may receive next month.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 min-w-[250px]">
            <div className="rounded-xl bg-indigo-50 p-4 dark:bg-indigo-900/20"><p className="text-xs text-indigo-600 dark:text-indigo-300">Expected lost</p><p className="mt-1 text-2xl font-bold text-indigo-700 dark:text-indigo-200">{forecast.next.lost}</p><p className="text-xs text-gray-500 dark:text-gray-400">next month</p></div>
            <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-900/20"><p className="text-xs text-emerald-600 dark:text-emerald-300">Expected found</p><p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-200">{forecast.next.found}</p><p className="text-xs text-gray-500 dark:text-gray-400">next month</p></div>
          </div>
        </div>
        <div className="mt-6 h-64 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40"><Line data={forecastData} options={forecastOptions} /></div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">Forecasts are directional estimates based on available report dates; accuracy improves as more history is collected.</p>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[['Total reports', (stats.totalLostItems || 0) + (stats.totalFoundItems || 0), 'text-indigo-600', 'bg-indigo-100 dark:bg-indigo-900/30', '▥'], ['Lost reports', stats.totalLostItems || 0, 'text-indigo-600', 'bg-indigo-100 dark:bg-indigo-900/30', '⌕'], ['Found reports', stats.totalFoundItems || 0, 'text-emerald-600', 'bg-emerald-100 dark:bg-emerald-900/30', '□'], ['Match rate', `${stats.totalLostItems ? Math.round(((stats.totalMatches || 0) / stats.totalLostItems) * 100) : 0}%`, 'text-amber-600', 'bg-amber-100 dark:bg-amber-900/30', '✓']].map(([label, value, color, iconBg, icon]) => <div key={label} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div><p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p><p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p></div><div className={`flex h-11 w-11 items-center justify-center rounded-lg text-2xl font-bold ${iconBg} ${color}`}>{icon}</div></div>)}
      </div>

      <section className="mb-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div><h2 className="font-semibold text-gray-900 dark:text-white">Historical reporting trends</h2><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Actual report activity used to support the forecast</p></div>
          <div className="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-700"><button onClick={() => setTrendPeriod('monthly')} className={`rounded-md px-3 py-1.5 text-xs font-medium ${trendPeriod === 'monthly' ? 'bg-white text-indigo-700 shadow-sm dark:bg-gray-600 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-300'}`}>Monthly</button><button onClick={() => setTrendPeriod('weekly')} className={`rounded-md px-3 py-1.5 text-xs font-medium ${trendPeriod === 'weekly' ? 'bg-white text-indigo-700 shadow-sm dark:bg-gray-600 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-300'}`}>Weekly</button></div>
        </div>
        <div className="h-64"><Bar data={historicalData} options={chartOptions} /></div>
      </section>

      {/* Report overview */}
      <div className="flex items-center gap-3 mb-3"><div className="h-6 w-1 rounded-full bg-indigo-600" /><div><h2 className="text-lg font-bold text-gray-900 dark:text-white">Report overview</h2><p className="text-xs text-gray-500 dark:text-gray-400">Current workload across the lost-and-found system</p></div></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4"><div><h3 className="font-semibold text-gray-900 dark:text-white">Items by status</h3><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">How reports are moving through the workflow</p></div><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">Live totals</span></div>
          <div className="h-72">
            <Bar data={barData} options={chartOptions} />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <div className="mb-4"><h3 className="font-semibold text-gray-900 dark:text-white">Items by category</h3><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Most frequently reported item groups <span className="text-gray-400">(active categories only)</span></p></div>
          <div className="h-72">
            {categoriesWithCounts.length > 0 && categoriesWithCounts.some(c => c.item_count > 0) ? (
              <Bar data={categoryBarData} options={categoryBarOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                {categoriesWithCounts.length === 0 ? 'No active categories' : 'No items assigned to categories yet'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System totals */}
      <div className="flex items-center gap-3 mb-3"><div className="h-6 w-1 rounded-full bg-emerald-500" /><div><h2 className="text-lg font-bold text-gray-900 dark:text-white">System totals</h2><p className="text-xs text-gray-500 dark:text-gray-400">A quick snapshot of the data behind your reports</p></div></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500">Resolved lost</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.lostResolved || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500">Resolved found</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.foundResolved || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500">Registered users</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalUsers || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500">Active categories</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{categoriesWithCounts.length}</p>
        </div>
      </div>

      {/* Location intelligence */}
      <div className="flex items-center gap-3 mb-3"><div className="h-6 w-1 rounded-full bg-amber-500" /><div><h2 className="text-lg font-bold text-gray-900 dark:text-white">Location intelligence</h2><p className="text-xs text-gray-500 dark:text-gray-400">Identify places that need attention or stronger recovery coverage</p></div></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Lost Locations */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">🔍 Where Items Are Lost</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {heatmap.lost.length > 0 ? `${heatmap.lost.length} locations, ${heatmap.lost.reduce((s, h) => s + h.count, 0)} total` : 'No data yet'}
              </p>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <span>Less</span>
              <div className="w-3 h-3 rounded-sm bg-red-100 dark:bg-red-400/30" />
              <div className="w-3 h-3 rounded-sm bg-red-200 dark:bg-red-400/50" />
              <div className="w-3 h-3 rounded-sm bg-red-300 dark:bg-red-400/80" />
              <div className="w-3 h-3 rounded-sm bg-red-400 dark:bg-red-500" />
              <div className="w-3 h-3 rounded-sm bg-red-500 dark:bg-red-600" />
              <span>More</span>
            </div>
          </div>
          {heatmap.lost.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No lost items reported yet</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {heatmap.lost.map((item, i) => (
                <div
                  key={i}
                  className={`relative group ${getLostTileColor(item.count, lostMax)} rounded-lg px-3 py-2.5 min-w-[80px] text-center cursor-default transition-transform hover:scale-105 hover:z-10`}
                >
                  <span className="text-xs font-semibold text-gray-800 dark:text-white block truncate max-w-[140px]">
                    {item.location}
                  </span>
                  <span className="text-[10px] text-gray-600 dark:text-gray-300">{item.count}</span>
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                    {item.location}: {item.count} item{item.count !== 1 ? 's' : ''} lost
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-900 rotate-45" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Found Locations */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">📦 Where Items Are Found</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {heatmap.found.length > 0 ? `${heatmap.found.length} locations, ${heatmap.found.reduce((s, h) => s + h.count, 0)} total` : 'No data yet'}
              </p>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <span>Less</span>
              <div className="w-3 h-3 rounded-sm bg-green-100 dark:bg-green-400/30" />
              <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-400/50" />
              <div className="w-3 h-3 rounded-sm bg-green-300 dark:bg-green-400/80" />
              <div className="w-3 h-3 rounded-sm bg-green-400 dark:bg-green-500" />
              <div className="w-3 h-3 rounded-sm bg-green-500 dark:bg-green-600" />
              <span>More</span>
            </div>
          </div>
          {heatmap.found.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">No found items reported yet</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {heatmap.found.map((item, i) => (
                <div
                  key={i}
                  className={`relative group ${getFoundTileColor(item.count, foundMax)} rounded-lg px-3 py-2.5 min-w-[80px] text-center cursor-default transition-transform hover:scale-105 hover:z-10`}
                >
                  <span className="text-xs font-semibold text-gray-800 dark:text-white block truncate max-w-[140px]">
                    {item.location}
                  </span>
                  <span className="text-[10px] text-gray-600 dark:text-gray-300">{item.count}</span>
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                    {item.location}: {item.count} item{item.count !== 1 ? 's' : ''} found
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-900 rotate-45" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
