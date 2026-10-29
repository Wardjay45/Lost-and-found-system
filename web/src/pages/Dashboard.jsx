import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StatCard from '../components/common/StatCard';
import AppIcon from '../components/common/AppIcon';
import { PageHeader, EmptyState, LoadingState, ErrorState } from '../components/common/UI';
import { dashboardApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useAppSettings } from '../context/AppContext';
import { timeAgo } from '../utils/formatters';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
export default function Dashboard() {
  const navigate = useNavigate(); const { user } = useAuth(); const { settings } = useAppSettings();
  const [stats, setStats] = useState({}); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { setStats(await dashboardApi.getStats()); } catch (err) { setError(err.message); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const totalMatched = stats.totalMatches || 0;
  const matchRate = stats.totalLostItems > 0 ? Math.round(totalMatched / stats.totalLostItems * 100) : 0;
  const dark = settings.darkMode || settings.colorTheme === 'midnight';
  const chartData = { labels: ['Active', 'Potential match', 'Claimed'], datasets: [
    {label:'Lost items',data:[stats.lostActive||0,stats.lostPotentialMatch||0,stats.lostClaimed||0],backgroundColor:'#6b63df',borderRadius:4,maxBarThickness:26},
    {label:'Found items',data:[stats.foundActive||0,stats.foundPotentialMatch||0,stats.foundClaimed||0],backgroundColor:'#a8b9dd',borderRadius:4,maxBarThickness:26},
  ]};
  const chartOptions = { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom',labels:{usePointStyle:true,pointStyle:'rectRounded',padding:24,boxWidth:7,color:dark?'#a2afc8':'#64718b',font:{size:11}}}},scales:{x:{grid:{display:false},border:{display:false},ticks:{color:dark?'#a2afc8':'#64718b',font:{size:11}}},y:{beginAtZero:true,grid:{color:dark?'#2c3750':'#eef0f6'},border:{display:false},ticks:{precision:0,color:dark?'#a2afc8':'#64718b',font:{size:11}}}} };
  return <div className="page page-dashboard"><PageHeader title="Overview" description={`Welcome back, ${user?.name?.split(' ')[0] || 'Admin'}. Here's your campus at a glance.`} actions={<button className="ui-button ui-button-secondary" onClick={load} disabled={loading}><AppIcon name="refresh" />Refresh</button>} />
    {error ? <ErrorState message={error} onRetry={load} /> : loading ? <LoadingState label="Loading campus overview..." /> : <>
      <div className="metric-grid"><StatCard title="Lost items" value={stats.totalLostItems||0} icon="search" onClick={() => navigate('/items/lost')} /><StatCard title="Found items" value={stats.totalFoundItems||0} icon="box" onClick={() => navigate('/items/found')} /><StatCard title="Successfully matched" value={totalMatched} icon="success" color="green" subtitle={`${matchRate}% match success rate`} /><StatCard title="Pending approval" value={stats.lostPending||0} icon="clock" color="yellow" onClick={() => navigate('/items/lost')} /></div>
      <div className="overview-grid"><section className="ui-panel p-6"><div className="section-header"><div><h2>Report workload</h2><p>Current items by status</p></div><Link className="ui-button ui-button-link" to="/analytics">Analytics<AppIcon name="arrow" /></Link></div><div className="overview-chart"><Bar data={chartData} options={chartOptions} /></div></section>
        <section className="ui-panel p-6"><div className="section-header"><div><h2>Workspace summary</h2><p>People, categories, and open reports</p></div></div>{[['Registered users',stats.totalUsers||0],['Item categories',stats.totalCategories||0],['Active lost items',stats.lostActive||0],['Active found items',stats.foundActive||0],['Matches to review',stats.foundPotentialMatch||0]].map(([label,value]) => <div className="workload-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}<Link className="ui-button ui-button-secondary w-full mt-5" to="/matching"><AppIcon name="matching" />Review matches</Link></section>
      </div>
      <section className="ui-panel p-6"><div className="section-header"><div><h2>Recent activity</h2><p>The latest updates across your campus</p></div><Link className="ui-button ui-button-link" to="/activity-logs">View all<AppIcon name="arrow" /></Link></div>{!(stats.recentActivity||[]).length ? <EmptyState icon="activity" title="No activity yet" description="New reports and updates will appear here." /> : stats.recentActivity.slice(0,8).map((activity,index) => <div className="activity-row" key={activity.id||index}><span className="activity-row-icon"><AppIcon name={activity.action === 'match' ? 'matching' : activity.action === 'approve' || activity.action === 'claim' ? 'success' : 'document'} /></span><div><strong>{activity.action}</strong><p>{activity.details}</p></div><time>{timeAgo(activity.timestamp||activity.created_at)}</time></div>)}</section>
    </>}
  </div>;
}
