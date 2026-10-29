import { useCallback, useEffect, useMemo, useState } from 'react';
import AppIcon from '../components/common/AppIcon';
import { DataRegion, PageHeader } from '../components/common/UI';
import RecoveryMetrics from '../components/common/RecoveryMetrics';
import { feedbackApi } from '../services/api';

const speeds = ['Under 24 hours', '1–3 days', '4–7 days', '8+ days'];

export default function Feedback() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kind, setKind] = useState('all');
  const [rating, setRating] = useState('all');
  const [speed, setSpeed] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setFeedback(await feedbackApi.getAll()); }
    catch (failure) { setError(failure.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => feedback.filter(row =>
    (kind === 'all' || row.kind === kind) && (rating === 'all' || row.rating === Number(rating)) &&
    (speed === 'all' || row.kind === 'recovery' && row.speed === speed) &&
    [row.user_name, row.item_description, row.comment].some(value => (value || '').toLowerCase().includes(search.trim().toLowerCase()))
  ).sort((first, second) => sort === 'rating-high' ? second.rating - first.rating : sort === 'rating-low' ? first.rating - second.rating :
    sort === 'oldest' ? Date.parse(first.created_at) - Date.parse(second.created_at) : Date.parse(second.created_at) - Date.parse(first.created_at)),
  [feedback, kind, rating, speed, search, sort]);
  return <div className="page page-feedback">
    <PageHeader title="Feedback" description="Read genuine student feedback. Recovery ratings are linked to confirmed item handovers."
      actions={<button type="button" className="ui-button ui-button-secondary" onClick={load} disabled={loading}><AppIcon name="refresh" />Refresh feedback</button>} />
    <RecoveryMetrics />
    <section className="ui-panel p-5 space-y-5" aria-label="Student feedback">
      <div><h2 className="font-semibold lf-text-primary">All Feedback</h2><p className="text-sm lf-text-muted mt-1">General suggestions stay separate from recovery performance. Admins cannot submit on students' behalf.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <input aria-label="Search feedback" className="ui-input" placeholder="Student, item, or comment" value={search} onChange={event => setSearch(event.target.value)} />
        <select aria-label="Feedback type" className="ui-input" value={kind} onChange={event => setKind(event.target.value)}><option value="all">All feedback types</option><option value="recovery">Recovery experience</option><option value="general">General app feedback</option></select>
        <select aria-label="Rating" className="ui-input" value={rating} onChange={event => setRating(event.target.value)}><option value="all">All ratings</option>{[5,4,3,2,1].map(value => <option key={value} value={value}>{value} stars</option>)}</select>
        <select aria-label="Recovery speed" className="ui-input" value={speed} onChange={event => setSpeed(event.target.value)}><option value="all">All recovery speeds</option>{speeds.map(value => <option key={value}>{value}</option>)}</select>
        <select aria-label="Sort feedback" className="ui-input" value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="rating-high">Highest rating</option><option value="rating-low">Lowest rating</option></select>
      </div>
      <DataRegion loading={loading} error={error} onRetry={load} empty={filtered.length === 0}
        emptyTitle={feedback.length ? 'No feedback matches your filters' : 'No feedback yet'} emptyDescription="Only saved student submissions appear here.">
        <div className="divide-y divide-[var(--lf-30-border)]">{filtered.map(row => <article key={row.id} className="py-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-3">
            <strong className="lf-text-primary">{row.user_name}</strong>
            <span role="img" aria-label={row.rating + ' out of 5 stars'} className="inline-flex gap-1">{[1,2,3,4,5].map(value => <AppIcon key={value} name="star" aria-hidden="true" style={{ width: 16, height: 16, color: '#b7791f', fill: value <= row.rating ? '#b7791f' : 'none' }} />)}</span>
            <span className="text-xs rounded-full px-3 py-1 border border-[var(--lf-30-border)] lf-text-muted">{row.kind === 'recovery' ? 'Recovery experience' : 'General app feedback'}</span>
          </div><time className="text-xs lf-text-muted" dateTime={row.created_at}>{new Date(row.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</time></div>
          {row.kind === 'recovery' && <p className="text-sm lf-text-muted"><strong className="lf-text-primary">{row.item_description || 'Recovered item'}</strong> · Measured return time: {row.speed || 'Not available'}</p>}
          <p className="text-sm lf-text-primary whitespace-pre-wrap break-words">{row.comment || 'No additional comments.'}</p>
        </article>)}</div>
      </DataRegion>
    </section>
  </div>;
}
