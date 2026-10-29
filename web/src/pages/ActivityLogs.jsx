import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../components/common/AppIcon';
import { PageHeader, DataRegion } from '../components/common/UI';
import { activityLogsApi } from '../services/api';
import { activityView, activityTypes, filterActivities } from '../../../shared/activityLogs.mjs';

const PAGE_SIZE = 25;
const campusTime = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

export default function ActivityLogs() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const [logs, setLogs] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [page, setPage] = useState(1);
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const current = ++requestId.current;
    setLoading(true); setError('');
    try {
      const data = await activityLogsApi.getAll();
      if (!Array.isArray(data)) throw new Error('The activity log returned an invalid response.');
      if (current === requestId.current) setLogs(data);
    } catch (err) {
      if (current === requestId.current) setError(err.message || 'Unable to load the activity log.');
    } finally { if (current === requestId.current) setLoading(false); }
  }, []);
  const cancelPending = useCallback(() => { requestId.current++; }, []);
  useEffect(() => { load(); return cancelPending; }, [load, cancelPending]);
  const types = activityTypes(logs);
  const filtered = filterActivities(logs, filterType, search);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const clear = () => { setFilterType('all'); setSearch(''); setPage(1); setExpanded(null); };

  return <div className="page page-activitylogs">
    <PageHeader title="Activity log" description="Recorded report updates, match decisions, and handovers." actions={
      <button type="button" className="ui-button ui-button-secondary" disabled={loading} onClick={load}><AppIcon name="refresh" />{loading ? 'Refreshing…' : 'Refresh'}</button>
    } />
    <p className="mb-5 text-sm lf-text-muted">This is a record of past events. Verify ownership and release items from <Link className="underline" to="/items/lost">Lost items</Link>.</p>
    <div className="ui-panel p-4 mb-5 flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1 sm:min-w-[180px]">
        <label htmlFor="activity-type" className="block text-xs font-medium lf-text-muted mb-1">Activity type</label>
        <select id="activity-type" className="ui-input w-full" value={filterType} onChange={event => { setFilterType(event.target.value); setPage(1); setExpanded(null); }}>
          <option value="all">All activities ({logs.length})</option>
          {types.map(type => <option key={type.value} value={type.value}>{type.label} ({type.count})</option>)}
          {filterType !== 'all' && !types.some(type => type.value === filterType) && <option value={filterType}>{activityView({ action: filterType }).label} (0)</option>}
        </select>
      </div>
      <div className="w-full sm:flex-[2] sm:w-auto min-w-0">
        <label htmlFor="activity-search" className="block text-xs font-medium lf-text-muted mb-1">Search activity</label>
        <input id="activity-search" className="ui-input w-full" type="search" placeholder="Action, report, administrator, or details…" value={search} onChange={event => { setSearch(event.target.value); setPage(1); setExpanded(null); }} />
      </div>
      <button type="button" className="ui-button ui-button-secondary" disabled={filterType === 'all' && !search} onClick={clear}>Clear filters</button>
    </div>
    <DataRegion loading={loading} error={error} onRetry={load} empty={filtered.length === 0}
      emptyTitle={logs.length ? 'No matching activity' : 'No activity recorded yet'}
      emptyDescription={logs.length ? 'Clear your search or choose another activity type.' : 'Recorded report changes and match decisions will appear here.'}>
      <div className="ui-panel overflow-hidden">
        <p role="status" aria-live="polite" className="p-4 text-sm lf-text-muted border-b border-[var(--lf-30-border)]">Showing {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length} activities</p>
        <ol className="divide-y divide-[var(--lf-30-border)]">
          {filtered.slice(start, start + PAGE_SIZE).map(log => {
            const view = activityView(log), open = expanded === log.id;
            const hasDetails = Boolean(view.pair || view.notes || view.recoveryId);
            return <li key={log.id} className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="shrink-0 rounded-xl p-2.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"><AppIcon name={view.icon} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold lf-text-primary">{view.label}</h2>
                    {view.action === 'match' && view.similarity !== null && <span className="text-xs lf-text-muted">{view.similarity}% recorded similarity</span>}
                  </div>
                  <p className="mt-1 text-sm lf-text-primary whitespace-pre-wrap break-words">{view.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs lf-text-muted">
                    <span>By {log.user_name || 'Not recorded'}{log.role ? ` · ${log.role}` : ''}</span>
                    <time dateTime={view.timestamp || undefined}>{view.timestamp ? campusTime.format(new Date(view.timestamp)) : 'Time not recorded'}</time>
                  </div>
                  {hasDetails && <button type="button" className="ui-button ui-button-secondary mt-3" aria-expanded={open} aria-controls={`activity-details-${log.id}`} onClick={() => setExpanded(open ? null : log.id)}>
                    {open ? 'Hide details' : 'View details'}<AppIcon name={open ? 'close' : 'down'} />
                  </button>}
                </div>
              </div>
              {hasDetails && open && <section id={`activity-details-${log.id}`} aria-label="Recorded event details" className="mt-4 rounded-xl border border-[var(--lf-30-border)] p-4 space-y-3">
                <p className="text-xs lf-text-muted">Historical snapshot — current report status may differ.</p>
                {view.pair && <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="min-w-0"><dt className="lf-text-muted">Lost report #{view.pair.lostId}</dt><dd className="lf-text-primary break-words whitespace-pre-wrap">{view.pair.lostName}</dd></div>
                  <div className="min-w-0"><dt className="lf-text-muted">Found report #{view.pair.foundId}</dt><dd className="lf-text-primary break-words whitespace-pre-wrap">{view.pair.foundName}</dd></div>
                </dl>}
                {view.notes && <div><p className="text-xs lf-text-muted">Recorded notes</p><p className="text-sm lf-text-primary break-words whitespace-pre-wrap">{view.notes}</p></div>}
                {view.recoveryId && <p className="text-xs lf-text-muted break-all">Recovery reference: {view.recoveryId}</p>}
                <p className="text-xs lf-text-muted">Recorded action: {view.originalAction}</p>
              </section>}
            </li>;
          })}
        </ol>
        {pages > 1 && <nav aria-label="Activity log pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--lf-30-border)] p-4">
          <button type="button" className="ui-button ui-button-secondary" disabled={currentPage === 1} onClick={() => { setPage(currentPage - 1); setExpanded(null); }}><AppIcon name="back" />Previous</button>
          <span className="text-sm lf-text-muted">Page {currentPage} of {pages}</span>
          <button type="button" className="ui-button ui-button-secondary" disabled={currentPage === pages} onClick={() => { setPage(currentPage + 1); setExpanded(null); }}>Next<AppIcon name="arrow" /></button>
        </nav>}
      </div>
    </DataRegion>
  </div>;
}
