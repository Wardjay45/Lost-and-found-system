import AppIcon from './AppIcon';
const legacy = { '🔍': 'search', '📦': 'box', '✅': 'success', '⏳': 'clock', '🎯': 'matching', '👥': 'users' };
export default function StatCard({ title, value, icon, color = 'indigo', subtitle, trend, onClick }) {
  const content = <><div className="metric-label"><span>{title}</span><AppIcon name={legacy[icon] || icon || 'chart'} /></div><div className="metric-value">{value ?? '—'}</div>{subtitle && <p className="metric-caption">{subtitle}</p>}{trend !== undefined && <p className={`metric-caption ${trend >= 0 ? 'tone-success' : 'tone-error'}`}>{trend >= 0 ? '+' : '-'}{Math.abs(trend)}% from last month</p>}</>;
  return onClick ? <button type="button" onClick={onClick} className={`metric-card metric-${color}`}>{content}</button> : <div className={`metric-card metric-${color}`}>{content}</div>;
}
