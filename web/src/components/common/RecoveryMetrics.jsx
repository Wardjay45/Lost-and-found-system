import { useCallback, useEffect, useState } from 'react';
import { feedbackApi } from '../../services/api';
import { DataRegion } from './UI';
import AppIcon from './AppIcon';
import useLiveRefresh from '../../hooks/useLiveRefresh';
import { recoveryTimeLabel as hoursLabel } from '../../utils/recoveryTime.mjs';


function Metric({ label, value, description, className = '' }) {
  return <div className={'recovery-metric ' + className}><dt>{label}</dt><dd className="recovery-metric-value">{value}</dd><dd className="recovery-metric-description">{description}</dd></div>;
}

export default function RecoveryMetrics() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async ({ background = false } = {}) => {
    if (!background) setLoading(true);
    try { setSummary(await feedbackApi.getSummary()); setError(''); }
    catch (failure) { setError(failure.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useLiveRefresh(['feedback', 'item_recoveries', 'found_items'], load);
  return <section className="recovery-performance" aria-labelledby="recovery-performance-title">
    <header className="recovery-performance-header">
      <div><h2 id="recovery-performance-title">Verified Recovery Performance</h2><p>Confirmed item handovers and feedback from their owners.</p></div>
    </header>
    <DataRegion loading={loading} error={error} onRetry={load}>
      {summary && <>
        <div className="recovery-overview">
          <section className="ui-panel recovery-group" aria-labelledby="recovery-results-title">
            <header className="recovery-group-heading"><span className="recovery-group-icon"><AppIcon name="box" /></span><div><h3 id="recovery-results-title">Recovery results</h3><p>How many items were returned and how long it took.</p></div></header>
            <dl className="recovery-result-stats">
              <Metric className="recovery-metric-total" label="Confirmed recoveries" value={summary.confirmed_recoveries} description="All verified handovers, including those without feedback." />
              <Metric label="Average time to find" value={hoursLabel(summary.average_hours)} description="From the lost-report date to the found-report date." />
            </dl>
            <div className="recovery-speed-section"><h4>Time to find</h4><p>Time between the lost-report date and the found-report date.</p>
              <dl className="recovery-speed-grid" aria-label="Measured recovery-speed distribution">{summary.speed_distribution.map(bucket => <div key={bucket.label}><dt>{bucket.label}</dt><dd>{bucket.count}<span>{bucket.count === 1 ? 'return' : 'returns'}</span></dd></div>)}</dl>
            </div>
            {!!summary.excluded_durations && <p className="ui-alert recovery-duration-note" role="status"><AppIcon name="info" />{summary.excluded_durations} {summary.excluded_durations === 1 ? 'return has' : 'returns have'} missing dates or a found date before the lost report, and {summary.excluded_durations === 1 ? 'is' : 'are'} excluded from timing figures.</p>}
          </section>
          <section className="ui-panel recovery-group" aria-labelledby="recovery-owner-feedback-title">
            <header className="recovery-group-heading"><span className="recovery-group-icon"><AppIcon name="star" /></span><div><h3 id="recovery-owner-feedback-title">Owner feedback</h3><p>Responses about completed recoveries.</p></div></header>
            <dl className="recovery-feedback-stats">
              <Metric label="Recovery satisfaction" value={summary.satisfaction_percent === null ? '—' : summary.satisfaction_percent + '%'} description="Share of recovery responses rated 4 or 5 out of 5." />
              <Metric label="Feedback response rate" value={summary.response_rate_percent === null ? '—' : summary.response_rate_percent + '%'} description="Share of confirmed recoveries that received owner feedback." />
              <Metric label="Recovery responses" value={summary.recovery_responses} description="Total saved feedback responses about recovered items." />
            </dl>
            <p className="recovery-group-note"><AppIcon name="info" /><span>General app feedback is listed below and is excluded from these figures. A dash means there is no data to calculate the measure yet.</span></p>
          </section>
        </div>
        <p className="recovery-tracking-note"><AppIcon name="shield" /><span>Tracking started {new Date(summary.tracking_started_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}. Only recorded, verified handovers are included.</span></p>
      </>}
    </DataRegion>
  </section>;
}
