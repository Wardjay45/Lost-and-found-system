import ReportReadState from '../components/common/ReportReadState';
import useMarkVisibleRead from '../hooks/useMarkVisibleRead';
import useNotifications from '../hooks/useNotifications';
import useLiveRefresh from '../hooks/useLiveRefresh';
import AppIcon from '../components/common/AppIcon';
import { PageHeader, DataRegion } from '../components/common/UI';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { foundItemsApi, categoriesApi } from '../services/api';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import ReportImageInput from '../components/common/ReportImageInput';
import ItemDescription from '../components/common/ItemDescription';
import ReportLocationFields from '../components/common/ReportLocationFields';
import useReportLocations from '../hooks/useReportLocations';
import PotentialMatchReview from '../components/common/PotentialMatchReview';
import { formatDate, formatDateTime } from '../utils/formatters';
import CategoryIcon from '../components/common/CategoryIcon';

export default function FoundItems() {
  const { isUnread } = useNotifications();
  const liveRequest = useRef(0);
  const invalidateRequests = useCallback(() => { liveRequest.current++; }, []);
  const [pageError, setPageError] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const displayedReports = useMemo(() => selectedItem ? [selectedItem] : [], [selectedItem]);
  useMarkVisibleRead('found', displayedReports);
  const [imageLightbox, setImageLightbox] = useState(null);
  const [sortBy, setSortBy] = useState('date');
  const [showReportForm, setShowReportForm] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    category: '',
    locationFound: '',
    locationDetails: '',
    finderName: '',
    condition: 'Good',
  });
  const reportLocations = useReportLocations(showReportForm);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [formError, setFormError] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [formSuccess, setFormSuccess] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelSuccess, setCancelSuccess] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelItem, setCancelItem] = useState(null);

  const loadReports = useCallback(async () => {
    const version = ++liveRequest.current;
    try {
      const [data, categories] = await Promise.all([foundItemsApi.getAll(), categoriesApi.getAll()]);
      if (version !== liveRequest.current) return;
      setItems(data); setCategories(categories); setPageError('');
    } catch (err) {
      if (version === liveRequest.current) setPageError(err.message || 'Unable to load this section.');
    } finally {
      if (version === liveRequest.current) setPageLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadReports();
    return invalidateRequests;
  }, [loadReports, invalidateRequests]);
  useLiveRefresh('found_items', loadReports);

  const filtered = useMemo(() => {
    return items
      .filter(item => {
        if (filterStatus !== 'all' && item.status !== filterStatus) return false;
        if (filterCategory !== 'all' && (item.category_name || item.categoryName) !== filterCategory) return false;
        if (search) {
          const q = search.toLowerCase();
          const desc = (item.description || '').toLowerCase();
          const id = (item.item_id || item.id || '').toLowerCase();
          const finder = (item.finder_name || item.finderName || '').toLowerCase();
          const loc = (item.location_found || item.locationFound || '').toLowerCase();
          return desc.includes(q) || id.includes(q) || finder.includes(q) || loc.includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date') return new Date(b.date_found || b.dateFound) - new Date(a.date_found || a.dateFound);
        if (sortBy === 'status') return a.status.localeCompare(b.status);
        return 0;
      });
  }, [items, search, filterStatus, filterCategory, sortBy]);


  const [approveMsg, setApproveMsg] = useState('');

  const handleApproveFound = async (itemId) => {
    try {
      await foundItemsApi.updateStatus(itemId, 'active');
      setItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, status: 'active' } : item
      ));
      setSelectedItem(null);
      setApproveMsg('✅ Found item approved and activated!');
    } catch (err) {
      setApproveMsg(`❌ ${err.message}`);
    }
    setTimeout(() => setApproveMsg(''), 4000);
  };

  const handleCancelFound = async () => {
    if (!cancelReason.trim() || !cancelItem) return;
    setCancelling(true);
    setCancelError('');
    try {
      await foundItemsApi.updateStatus(cancelItem.id, 'cancelled', cancelReason.trim());
      setItems(prev => prev.map(item =>
        item.id === cancelItem.id ? { ...item, status: 'cancelled', cancel_reason: cancelReason.trim() } : item
      ));
      setShowCancelModal(false);
      setCancelReason('');
      setCancelItem(null);
      setSelectedItem(null);
      setCancelSuccess('✅ Report cancelled successfully.');
      setTimeout(() => setCancelSuccess(''), 4000);
    } catch (err) {
      setCancelError(err.message || 'Failed to cancel. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const canCancel = (item) => item && !['resolved', 'claimed', 'cancelled', 'potential_match'].includes(item.status);

  const openCancel = (item) => { setCancelItem(item); setCancelReason(''); setCancelError(''); setShowCancelModal(true); setSelectedItem(null); };

  const handleDeleteFound = async (itemId) => {
    try {
      await foundItemsApi.delete(itemId);
      setItems(prev => prev.filter(i => i.id !== itemId));
      setSelectedItem(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReportFound = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (reportLocations.loading || reportLocations.error || !reportLocations.locations.some(place => place.name === formData.locationFound)) {
      setFormError('Refresh the approved locations and choose an active location before submitting.');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setFormError('');
    const cat = categories.find(c => c.id === parseInt(formData.category));
    try {
      const newItem = await foundItemsApi.create({
        description: formData.description,
        category_id: parseInt(formData.category),
        category_name: cat?.name || 'Miscellaneous',
        category_icon: cat?.icon || 'tag',
        location_found: formData.locationFound,
        location_details: formData.locationDetails.trim() || null,
        finder_name: formData.finderName,
        condition: formData.condition,
        image: imagePreview,
      });
      setItems(prev => [newItem, ...prev]);
      setFormData({ description: '', category: '', locationFound: '', locationDetails: '', finderName: '', condition: 'Good' });
      setImagePreview(null);
      setShowReportForm(false);
      setFormSuccess(`✅ Found item reported successfully!`);
    } catch (err) {
      setFormError(err.message || 'Unable to submit your report. Please try again.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
    setTimeout(() => setFormSuccess(''), 4000);
  };

  return (
    <div className="page page-founditems">
      <PageHeader title="Found items" description={"Manage found reports and help items reach their owners."} actions={<><button type="button" onClick={() => setShowReportForm(true)} className="ui-button ui-button-primary transition-colors">
          <AppIcon name="plus" /> Report Found Item
        </button></>} />

      {cancelSuccess && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg mb-4 text-sm font-medium">{cancelSuccess}</div>
      )}
      {formSuccess && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg mb-4 text-sm">{formSuccess}</div>
      )}
      {approveMsg && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg mb-4 text-sm">{approveMsg}</div>
      )}

      <div className="ui-panel p-4 mb-6 ui-toolbar">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <input aria-label="Search..." type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="ui-input w-full placeholder-gray-400" />
          </div>
          <select aria-label="filter Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="ui-input">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="potential_match">Potential Match</option>
            <option value="claimed">Claimed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select aria-label="filter Category" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="ui-input">
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select aria-label="sort By" value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="ui-input">
            <option value="date">Sort by Date</option>
            <option value="status">Sort by Status</option>
          </select>
        </div>
      </div>

      <DataRegion loading={pageLoading} error={pageError} onRetry={() => window.location.reload()} empty={filtered.length === 0}><div className="ui-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="ui-table responsive-table w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Item / Description</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</th>

                <th>Reported</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Location</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Condition</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="report-row" data-read-state={isUnread('found', item.id) ? 'unread' : 'viewed'}>
                  <td data-label="Item" className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-green-100 dark:opacity-80">
                        <CategoryIcon icon={item.category_icon} categoryName={item.category_name || item.categoryName} className="h-6 w-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className="report-item-title text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words">{item.description || 'No description provided.'}</p>
                        <div className="report-item-meta"><span className="report-item-id">{item.item_id || item.id}</span><ReportReadState unread={isUnread('found', item.id)} /></div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Category" className="px-4 py-3"><span className="text-sm text-gray-600 dark:text-gray-400">{item.category_name || item.categoryName}</span></td>

                  <td data-label="Reported" className="px-4 py-3"><span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDateTime(item.date_found || item.dateFound)}</span></td>
                  <td data-label="Location" className="px-4 py-3"><span className="text-sm text-gray-600 dark:text-gray-400">{item.location_found || item.locationFound}</span></td>
                  <td data-label="Condition" className="px-4 py-3"><StatusBadge status={item.condition || 'Good'} /></td>
                  <td data-label="Status" className="px-4 py-3"><StatusBadge status={item.status} /></td>
                  <td data-label="Actions" className="px-4 py-3 text-right">
                    <button type="button" aria-label={'View report ' + (item.item_id || item.id)} onClick={() => setSelectedItem(item)} className="ui-button ui-button-link">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400 ui-empty">
            <p className="text-2xl mb-2"><AppIcon name="box" /></p>
            <p>No found items found matching your filters.</p>
          </div>
        )}
      </div></DataRegion>

      <Modal isOpen={showReportForm} onClose={() => { if (!submitting) setShowReportForm(false); }} title="Report Found Item" size="lg">
        <form onSubmit={handleReportFound} className="space-y-4">
          <fieldset disabled={submitting} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-full">
              <label htmlFor="field-founditems-1" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description *</label>
              <textarea id="field-founditems-1" aria-label="Description *" required value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="ui-input w-full" rows={2}
                placeholder="Describe the found item" />
            </div>
            <div>
              <label htmlFor="field-founditems-2" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category *</label>
              <select id="field-founditems-2" aria-label="Category *" required value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="ui-input w-full">
                <option value="">Select category</option>
                {categories.filter(c => c.auto_tagging !== false).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="field-founditems-4" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Finder Name *</label>
              <input id="field-founditems-4" aria-label="Finder Name *" required value={formData.finderName} onChange={(e) => setFormData({...formData, finderName: e.target.value})}
                className="ui-input w-full"
                placeholder="e.g., Maria Santos" />
            </div>
            <div>
              <label htmlFor="field-founditems-5" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Condition</label>
              <select id="field-founditems-5" aria-label="Condition" value={formData.condition} onChange={(e) => setFormData({...formData, condition: e.target.value})}
                className="ui-input w-full">
                <option value="Good">Good</option>
                <option value="Damaged">Damaged</option>
              </select>
            </div>
            <ReportLocationFields kind="found" value={formData.locationFound} onChange={value => setFormData(prev => ({...prev, locationFound: value}))}
              details={formData.locationDetails} onDetailsChange={value => setFormData(prev => ({...prev, locationDetails: value}))}
              {...reportLocations} disabled={submitting} />
            <div className="col-span-full"><ReportImageInput value={imagePreview} onChange={setImagePreview} /></div>
          </fieldset>
          {formError && <p role="alert" className="ui-alert ui-alert-error">{formError}</p>}
          <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button type="submit" disabled={submitting || reportLocations.loading || !!reportLocations.error || !reportLocations.locations.some(place => place.name === formData.locationFound)} className="ui-button ui-button-primary flex-1">{submitting ? 'Submitting...' : 'Submit Report'}</button>
            <button type="button" disabled={submitting} onClick={() => { setShowReportForm(false); setImagePreview(null); setFormError(''); }} className="ui-button ui-button-secondary flex-1">Cancel</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!selectedItem} onClose={() => setSelectedItem(null)} title={`Details - ${selectedItem?.item_id || selectedItem?.id}`} size="xl">
        {selectedItem && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl bg-green-100 dark:opacity-80">
                <CategoryIcon icon={selectedItem.category_icon} categoryName={selectedItem.category_name || selectedItem.categoryName} className="h-9 w-9 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Found item report</h4>
                <p className="text-sm text-gray-500">{selectedItem.item_id || selectedItem.id}</p>
              </div>
            </div>
            {selectedItem.image && (
              <div className="flex justify-center my-3">
                <img
                  src={selectedItem.image}
                  alt="Found item"
                  onClick={() => setImageLightbox(selectedItem.image)}
                  className="max-h-48 rounded-xl object-cover border border-gray-200 dark:border-gray-700 shadow-sm cursor-zoom-in hover:opacity-90"
                />
              </div>
            )}
            <ItemDescription description={selectedItem.description} />
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-500">Category</p><p className="text-sm font-medium text-gray-900 dark:text-white">{selectedItem.category_name || selectedItem.categoryName}</p></div>
              <div><p className="text-xs text-gray-500">Status</p><StatusBadge status={selectedItem.status} /></div>
              <div><p className="text-xs text-gray-500">Condition</p><StatusBadge status={selectedItem.condition || 'Good'} /></div>
              <div><p className="text-xs text-gray-500">Date Found</p><p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(selectedItem.date_found || selectedItem.dateFound)}</p></div>
              <div><p className="text-xs text-gray-500">Found At</p><p className="text-sm font-medium text-gray-900 dark:text-white">{selectedItem.location_found || selectedItem.locationFound}</p></div>
              <div><p className="text-xs text-gray-500">Found By</p><p className="text-sm font-medium text-gray-900 dark:text-white">{selectedItem.finder_name || selectedItem.finderName}</p></div>
              <div><p className="text-xs text-gray-500">Last Updated</p><p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(selectedItem.last_updated || selectedItem.lastUpdated)}</p></div>
              <div className="col-span-full"><p className="text-xs text-gray-500">Additional Info</p><p className="text-sm font-medium lf-text-primary whitespace-pre-wrap break-words">{selectedItem.location_details?.trim() || 'No additional information provided.'}</p></div>
            </div>
            {selectedItem.status === 'cancelled' && selectedItem.cancel_reason && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg">
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-0.5">Cancellation Reason</p>
                <p className="text-sm text-red-700 dark:text-red-300">{selectedItem.cancel_reason}</p>
              </div>
            )}
            {(selectedItem.resolved_date || selectedItem.resolvedDate) && (
              <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-400"><AppIcon name="success" /> Resolved on {formatDate(selectedItem.resolved_date || selectedItem.resolvedDate)}</p>
              </div>
            )}
            {selectedItem.status === 'potential_match' && (
              <PotentialMatchReview item={selectedItem} table="found_items" onComplete={() => { setSelectedItem(null); void loadReports(); }} />
            )}
            {canCancel(selectedItem) && (
              <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => openCancel(selectedItem)} className="ui-button ui-button-warning flex-1"><AppIcon name="close" /> Cancel Report</button>
              </div>
            )}
            {selectedItem.status === 'pending' && (
              <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => handleApproveFound(selectedItem.id)} className="ui-button ui-button-success flex-1"><AppIcon name="success" /> Approve</button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={!!imageLightbox} onClose={() => setImageLightbox(null)} title="Image preview" size="xl"><img src={imageLightbox || undefined} alt="Reported item" className="image-preview" /></Modal>

      {/* Cancel Reason Modal */}
      <Modal isOpen={showCancelModal} onClose={() => setShowCancelModal(false)} title="Cancel Report" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">Please state the reason for cancelling:</p>
          {cancelItem && (
            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg">{cancelItem.description}</p>
          )}
          <textarea aria-label="e.g. Item already returned to owner, wrong report, duplicate..."
            value={cancelReason}
            onChange={(e) => { setCancelReason(e.target.value); setCancelError(''); }}
            placeholder="e.g. Item already returned to owner, wrong report, duplicate..."
            className="ui-input w-full placeholder-gray-400"
            rows={3}
          />
          {cancelError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs px-3 py-2 rounded-lg font-medium">
              <AppIcon name="info" /> {cancelError}
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowCancelModal(false)} className="ui-button ui-button-secondary flex-1">Keep Report</button>
            <button type="button" onClick={handleCancelFound} disabled={cancelling || !cancelReason.trim()} className="ui-button ui-button-danger flex-1 disabled:opacity-50 disabled:cursor-not-allowed">
              {cancelling ? 'Cancelling...' : !cancelReason.trim() ? 'Enter a reason first' : 'Confirm Cancel'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
