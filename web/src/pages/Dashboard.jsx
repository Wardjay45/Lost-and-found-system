import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import { dashboardApi } from '../services/api';
import { timeAgo } from '../utils/formatters';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement);

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalLostItems: 0, totalFoundItems: 0, totalUsers: 0, totalCategories: 0,
    totalMatches: 0, lostPending: 0, lostActive: 0, lostResolved: 0,
    foundActive: 0, foundMatched: 0, foundResolved: 0,
    recentActivity: [],
  });

  useEffect(() => {
    dashboardApi.getStats().then(setStats).catch(console.error);
  }, []);

  const totalMatched = (stats.totalMatches || 0);
  // Match Success Rate = of all lost items, how many found their match (potential_match + claimed)
  const matchRate = (stats.totalLostItems > 0)
    ? Math.round((totalMatched / stats.totalLostItems) * 100)
    : 0;

  const recentActivity = (stats.recentActivity || []).slice(0, 8);

  const monthlyData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
    datasets: [
      { label: 'Lost', data: [stats.lostPending, stats.lostActive, stats.lostResolved, 0, 0, 0, 0], backgroundColor: '#4f46e5', borderRadius: 4 },
      { label: 'Found', data: [stats.foundActive, stats.foundMatched, stats.foundResolved, 0, 0, 0, 0], backgroundColor: '#0ea5e9', borderRadius: 4 },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top', labels: { color: '#9ca3af' } } },
    scales: { x: { grid: { display: false }, ticks: { color: '#9ca3af' } }, y: { beginAtZero: true, grid: { color: '#374151' }, ticks: { color: '#9ca3af' } } },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard Overview</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Welcome back, Admin! Here's what's happening.</p>
        </div>
        <div></div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Lost Items" value={stats.totalLostItems} icon="🔍" color="indigo" onClick={() => navigate('/items/lost')} />
        <StatCard title="Total Found Items" value={stats.totalFoundItems} icon="📦" color="blue" onClick={() => navigate('/items/found')} />
        <StatCard title="Successfully Matched" value={totalMatched} icon="✅" color="green" />
        <StatCard title="Pending Approval" value={stats.lostPending} icon="⏳" color="yellow" onClick={() => navigate('/items/lost')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <StatCard title="Match Success Rate" value={`${matchRate}%`} icon="🎯" color="indigo" subtitle={`${totalMatched} matched · ${stats.lostActive || 0} active lost`} />
        <StatCard title="Registered Users" value={stats.totalUsers} icon="👥" color="teal" subtitle="Total users in system" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Monthly Trends Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Monthly Trends</h3>
          <div className="h-72">
            <Bar data={monthlyData} options={chartOptions} />
          </div>
        </div>

        {/* System Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">System Overview</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Categories</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">{stats.totalCategories}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">Active Lost Items</span>
              <span className="text-sm font-bold text-indigo-600">{stats.lostActive}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">Active Found Items</span>
              <span className="text-sm font-bold text-blue-600">{stats.foundActive}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">Pending Lost (Approval)</span>
              <span className="text-sm font-bold text-yellow-600">{stats.lostPending}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">AI Matches Pending</span>
              <span className="text-sm font-bold text-green-600">{stats.foundMatched}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">Live feed</span>
        </div>
        <div className="space-y-0">
          {recentActivity.map((activity, idx) => (
            <div key={`${activity.id || idx}`} className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 bg-indigo-100 dark:bg-indigo-900/30">
                {activity.action === 'report' ? '📝' : activity.action === 'match' ? '🤝' : activity.action === 'approve' ? '✅' : '📦'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{activity.action}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{activity.details}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-400 dark:text-gray-500">{timeAgo(activity.timestamp || activity.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
