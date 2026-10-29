import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { lostItemsApi, foundItemsApi } from '../../services/api';
import { filterReportCollection, loadReportCollection } from '../../services/reportCollections.mjs';
import useLiveRefresh from '../../hooks/useLiveRefresh';
import useNotifications from '../../hooks/useNotifications';
import useMarkVisibleRead from '../../hooks/useMarkVisibleRead';
import { PageHeader, DataRegion } from '../common/UI';
import AppIcon from '../common/AppIcon';
import CategoryIcon from '../common/CategoryIcon';
import StatusBadge from '../common/StatusBadge';
import ReportReadState from '../common/ReportReadState';
import ItemDescription from '../common/ItemDescription';
import Modal from '../common/Modal';
import PotentialMatchReview from '../common/PotentialMatchReview';
import { formatDateTime } from '../../utils/formatters';

const reportTables = ['lost_items', 'found_items'];
const PAGE_SIZE = 20;
const labels = {
  potential: { title: 'Potential matches', description: 'Lost and found reports marked as a potential match, awaiting ownership verification.', empty: 'No potential matches yet', hint: 'Reports appear here when a potential match is recorded in Smart matching.', icon: 'link' },
  claimed: { title: 'Claimed items', description: 'Lost and found reports recorded as claimed after the matching and claim process.', empty: 'No claimed items yet', hint: 'Reports appear here after a claim is completed.', icon: 'success' },
};
const dateText = value => value && Number.isFinite(Date.parse(value)) ? formatDateTime(value) : 'Not recorded';

function ReportPhoto({ item }) {
  const [failed, setFailed] = useState(false);
  if (!item.image) return null;
  return failed ? <p className="collection-muted">Photo unavailable.</p> : <img className="collection-detail-photo" src={item.image} alt={item.description || 'Reported item'} onError={() => setFailed(true)} />;
}

export default function ReportCollection({ collection }) {
  const config = labels[collection];
  const { isUnread } = useNotifications();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [reportType, setReportType] = useState('all');
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState(null);
  const requestVersion = useRef(0);
  const invalidateRequests = useCallback(() => { requestVersion.current++; }, []);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setRefreshing(true);
    try {
      const next = await loadReportCollection(collection, { lostItemsApi, foundItemsApi });
      if (version === requestVersion.current) { setReports(next); setError(''); }
    } catch (err) {
      if (version === requestVersion.current) setError(err.message || 'Unable to load item reports.');
    } finally {
      if (version === requestVersion.current) { setLoading(false); setRefreshing(false); }
    }
  }, [collection]);
  useEffect(() => { void load(); return invalidateRequests; }, [load, invalidateRequests]);
  useLiveRefresh(reportTables, load);

  const filtered = useMemo(() => filterReportCollection(reports, { reportType, search }), [reports, reportType, search]);
  const selected = reports.find(item => item.collectionKey === selectedKey) || null;
  const viewedRows = useMemo(() => selected ? [selected] : [], [selected]);
  useMarkVisibleRead(selected?.reportType || 'lost', viewedRows);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(pageIndex, pageCount - 1);
  const pageRows = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const hasFilters = Boolean(search.trim() || reportType !== 'all');
  const totals = [
    ['Reports in this section', reports.length, config.icon],
    ['Lost reports', reports.filter(item => item.reportType === 'lost').length, 'search'],
    ['Found reports', reports.filter(item => item.reportType === 'found').length, 'box'],
  ];

  return <div className="page page-report-collection">
    <PageHeader title={config.title} description={config.description} actions={<>
      {collection === 'potential' && <Link to="/matching" className="ui-button ui-button-secondary"><AppIcon name="matching" />Smart matching</Link>}
      <button type="button" className="ui-button ui-button-secondary" onClick={load} disabled={refreshing}><AppIcon name="refresh" />{refreshing ? 'Refreshing...' : 'Refresh'}</button>
    </>} />
    <div className="collection-summary" aria-busy={loading}>{totals.map(([label, value, icon]) => <div className="ui-panel collection-summary-card" key={label}><span className="collection-summary-icon"><AppIcon name={icon} /></span><div><span>{label}</span><strong>{loading ? '...' : value}</strong></div></div>)}</div>
    <div className="ui-toolbar collection-toolbar">
      <div className="search-field"><AppIcon name="search" /><input className="ui-input" aria-label="Search item reports" placeholder="Search item, report ID, person or location" value={search} onChange={event => { setSearch(event.target.value); setPageIndex(0); }} /></div>
      <select className="ui-input" aria-label="Report type" value={reportType} onChange={event => { setReportType(event.target.value); setPageIndex(0); }}><option value="all">All report types</option><option value="lost">Lost reports</option><option value="found">Found reports</option></select>
      {hasFilters && <button type="button" className="ui-button ui-button-secondary" onClick={() => { setSearch(''); setReportType('all'); setPageIndex(0); }}>Clear filters</button>}
    </div>
    <DataRegion loading={loading} error={error} onRetry={load} empty={filtered.length === 0} emptyTitle={hasFilters ? 'No matching reports' : config.empty} emptyDescription={hasFilters ? 'Try another search or choose all report types.' : config.hint}>
      <div className="ui-panel collection-table-panel"><div className="collection-table-scroll"><table className="ui-table responsive-table collection-table"><thead><tr><th>Item / description</th><th>Report type</th><th>Category</th><th>Location</th><th>{collection === 'claimed' ? 'Claimed on' : 'Reported on'}</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {pageRows.map(item => <tr key={item.collectionKey} className="report-row" data-read-state={isUnread(item.reportType, item.id) ? 'unread' : 'viewed'}>
          <td data-label="Item"><div className="collection-item"><span className="collection-item-icon"><CategoryIcon icon={item.category_icon} categoryName={item.category_name} className="app-icon" /></span><div><p className="report-item-title">{item.description || 'No description provided.'}</p><div className="report-item-meta"><span className="report-item-id">{item.item_id || item.id}</span><ReportReadState unread={isUnread(item.reportType, item.id)} /></div></div></div></td>
          <td data-label="Report type"><span className="collection-type"><AppIcon name={item.reportType === 'lost' ? 'search' : 'box'} />{item.reportType === 'lost' ? 'Lost report' : 'Found report'}</span><span className="collection-person">{item.reportedBy || 'Not recorded'}</span></td>
          <td data-label="Category">{item.category_name || 'Not recorded'}</td><td data-label="Location">{item.reportLocation || 'Not recorded'}</td>
          <td data-label={collection === 'claimed' ? 'Claimed on' : 'Reported on'}>{dateText(collection === 'claimed' ? item.resolved_date : item.reportDate)}</td><td data-label="Status"><StatusBadge status={item.status} /></td>
          <td data-label="Actions"><button type="button" className="ui-button ui-button-link" aria-label={'View report ' + (item.item_id || item.id)} onClick={() => setSelectedKey(item.collectionKey)}>View details</button></td>
        </tr>)}
      </tbody></table></div><footer className="collection-pagination"><span>{currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} reports</span><div><button type="button" className="ui-button ui-button-secondary" aria-label="Previous page" disabled={currentPage === 0} onClick={() => setPageIndex(currentPage - 1)}><AppIcon name="back" /></button><span>Page {currentPage + 1} of {pageCount}</span><button type="button" className="ui-button ui-button-secondary" aria-label="Next page" disabled={currentPage + 1 >= pageCount} onClick={() => setPageIndex(currentPage + 1)}><AppIcon name="arrow" /></button></div></footer></div>
    </DataRegion>
    <Modal isOpen={Boolean(selected)} onClose={() => setSelectedKey(null)} title={selected ? 'Details - ' + (selected.item_id || selected.id) : 'Report details'} size={collection === 'potential' ? 'xl' : 'lg'}>
      {selected && <div className="collection-details"><div className="collection-detail-heading"><span className="collection-type"><AppIcon name={selected.reportType === 'lost' ? 'search' : 'box'} />{selected.reportType === 'lost' ? 'Lost report' : 'Found report'}</span><StatusBadge status={selected.status} /></div>
        <ReportPhoto key={selected.collectionKey} item={selected} /><ItemDescription description={selected.description} />
        <dl className="collection-detail-fields"><div><dt>Report ID</dt><dd>{selected.item_id || selected.id}</dd></div><div><dt>Category</dt><dd>{selected.category_name || 'Not recorded'}</dd></div><div><dt>{selected.reportType === 'lost' ? 'Reported by' : 'Found by'}</dt><dd>{selected.reportedBy || 'Not recorded'}</dd></div><div><dt>{selected.reportType === 'lost' ? 'Date reported' : 'Date found'}</dt><dd>{dateText(selected.reportDate)}</dd></div><div><dt>{selected.reportType === 'lost' ? 'Location lost' : 'Location found'}</dt><dd>{selected.reportLocation || 'Not recorded'}</dd></div>{selected.reportType === 'found' && <div><dt>Condition</dt><dd>{selected.condition || 'Not recorded'}</dd></div>}{collection === 'claimed' && <div><dt>Claimed on</dt><dd>{dateText(selected.resolved_date)}</dd></div>}<div className="collection-detail-wide"><dt>Additional information</dt><dd>{selected.location_details?.trim() || 'No additional information provided.'}</dd></div></dl>
        {collection === 'potential' && <PotentialMatchReview item={selected} table={selected.reportType + '_items'} onComplete={() => { setSelectedKey(null); void load(); }} />}
        <Link className="ui-button ui-button-secondary" to={selected.reportType === 'lost' ? '/items/lost' : '/items/found'}><AppIcon name="arrow" />{selected.reportType === 'lost' ? 'Open lost reports' : 'Open found reports'}</Link>
      </div>}
    </Modal>
  </div>;
}
