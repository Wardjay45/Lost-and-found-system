import { useCallback, useEffect, useState } from 'react';
import { feedbackApi } from '../../services/api';
import { DataRegion } from './UI';
import AppIcon from './AppIcon';

const hoursLabel = hours => hours === null ? '—' : hours < 24 ? hours.toFixed(1) + ' hours' : (hours / 24).toFixed(1) + ' days';

function Metric({ label, value, description, className = '' }) {
  return <div className={'recovery-metric ' + className}><dt>{label}</dt><dd className="recovery-metric-value">{value}</dd><dd className="recovery-metric-description">{description}</dd></div>;
}

export default function RecoveryMetrics() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setSummary(await feedbackApi.getSummary()); }
    catch (failure) { setError(failure.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return <section className="recovery-performance" aria-labelledby="recovery-performance-title">
    <header className="recovery-performance-header">
      <div><h2 id="recovery-performance-title">Verified Recovery Performance</h2><p>Confirmed item handovers and feedback from their owners.</p></div>
      <button type="button" className="ui-button ui-button-secondary" onClick={load} disabled={loading}><AppIcon name="refresh" />Refresh metrics</button>
    </header>
    <DataRegion loading={loading} error={error} onRetry={load}>
      {summary && <>
        <div className="recovery-overview">
          <section className="ui-panel recovery-group" aria-labelledby="recovery-results-title">
            <header className="recovery-group-heading"><span className="recovery-group-icon"><AppIcon name="box" /></span><div><h3 id="recovery-results-title">Recovery results</h3><p>How many items were returned and how long it took.</p></div></header>
            <dl className="recovery-result-stats">
              <Metric className="recovery-metric-total" label="Confirmed recoveries" value={summary.confirmed_recoveries} description="All verified handovers, including those without feedback." />
              <Metric label="Average recovery time" value={hoursLabel(summary.average_hours)} description="Average time from the lost report to handover." />
              <Metric label="Median recovery time" value={hoursLabel(summary.median_hours)} description="Half of measured returns took this time or less." />
            </dl>
            <div className="recovery-speed-section"><h4>Time to recover</h4><p>Number of items returned within each time range.</p>
              <dl className="recovery-speed-grid" aria-label="Measured recovery-speed distribution">{summary.speed_distribution.map(bucket => <div key={bucket.label}><dt>{bucket.label}</dt><dd>{bucket.count}<span>{bucket.count === 1 ? 'return' : 'returns'}</span></dd></div>)}</dl>
            </div>
            {!!summary.excluded_durations && <p className="ui-alert recovery-duration-note" role="status"><AppIcon name="info" />{summary.excluded_durations} {summary.excluded_durations === 1 ? 'return has' : 'returns have'} a missing or invalid report time and {summary.excluded_durations === 1 ? 'is' : 'are'} excluded from timing figures.</p>}
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
        <section className="ui-panel recovery-group recovery-trends" aria-labelledby="recovery-trends-title">
          <header className="recovery-group-heading"><span className="recovery-group-icon"><AppIcon name="chart" /></span><div><h3 id="recovery-trends-title">Monthly trends</h3><p>Returns and owner ratings grouped by the month of handover.</p></div></header>
          {summary.monthly.length > 0 ? <div className="recovery-trend-scroll" tabIndex={0} role="region" aria-label="Monthly recovery trends table"><table className="ui-table recovery-trend-table"><caption className="sr-only">Recovery and satisfaction trends by handover month</caption><thead><tr><th scope="col">Handover month</th><th scope="col">Confirmed recoveries</th><th scope="col">Average recovery time</th><th scope="col">Average owner rating</th><th scope="col">Recovery responses</th></tr></thead><tbody>{summary.monthly.map(month => <tr key={month.month}><th scope="row">{month.month}</th><td>{month.confirmed_recoveries}</td><td>{hoursLabel(month.average_hours)}</td><td>{month.average_rating === null ? '—' : month.average_rating.toFixed(1) + ' / 5'}</td><td>{month.responses}</td></tr>)}</tbody></table></div> : <p className="recovery-trends-empty">Monthly trends will appear after the first confirmed handover.</p>}
        </section>
        <p className="recovery-tracking-note"><AppIcon name="shield" /><span>Tracking started {new Date(summary.tracking_started_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}. Only recorded, verified handovers are included.</span></p>
      </>}
    </DataRegion>
  </section>;
}
