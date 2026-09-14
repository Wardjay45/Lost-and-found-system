import { useState, useMemo, useEffect } from 'react';
import { lostItemsApi, foundItemsApi, categoriesApi } from '../services/api';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import { formatDate, formatDateTime } from '../utils/formatters';
import FTFVerificationForm from '../components/common/FTFVerificationForm';
import MatchDetails from '../components/common/MatchDetails';

export default function LostItems() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [imageLightbox, setImageLightbox] = useState(null);
  const [sortBy, setSortBy] = useState('date');
  const [showReportForm, setShowReportForm] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    category: '',
    locationLost: '',
    reporterName: '',
    contactInfo: '',
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [formSuccess, setFormSuccess] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelSuccess, setCancelSuccess] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelItem, setCancelItem] = useState(null);

  useEffect(() => {
    lostItemsApi.getAll().then(setItems).catch(console.error);
    categoriesApi.getAll().then(setCategories).catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    return items
      .filter(item => {
        if (filterStatus !== 'all' && item.status !== filterStatus) return false;
        if (filterCategory !== 'all' && (item.category_name || item.categoryName) !== filterCategory) return false;
        if (search) {
          const q = search.toLowerCase();
          const desc = (item.description || '').toLowerCase();
          const id = (item.item_id || item.id || '').toLowerCase();
          const rep = (item.reporter_name || item.reporterName || '').toLowerCase();
          const loc = (item.location_lost || item.locationLost || '').toLowerCase();
          return desc.includes(q) || id.includes(q) || rep.includes(q) || loc.includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date') return new Date(b.date_reported || b.dateReported) - new Date(a.date_reported || a.dateReported);
        if (sortBy === 'status') return a.status.localeCompare(b.status);
        return 0;
      });
  }, [items, search, filterStatus, filterCategory, sortBy]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleReportLost = async (e) => {
    e.preventDefault();
    const cat = categories.find(c => c.id === parseInt(formData.category));
    try {
      const newItem = await lostItemsApi.create({
        description: formData.description,
        category_id: parseInt(formData.category),
        category_name: cat?.name || 'Miscellaneous',
        category_icon: cat?.icon || '📦',
        location_lost: formData.locationLost,
        reporter_name: formData.reporterName,
        image: imagePreview,
      });
      setItems(prev => [newItem, ...prev]);
      setFormData({ description: '', category: '', locationLost: '', reporterName: '', contactInfo: '' });
      setImagePreview(null);
      setShowReportForm(false);
      setFormSuccess(`✅ Item reported successfully!`);
    } catch (err) {
      setFormSuccess(`❌ ${err.message}`);
    }
    setTimeout(() => setFormSuccess(''), 4000);
  };

  const handleResolve = async (itemId) => {
    try {
      await lostItemsApi.updateStatus(itemId, 'resolved');
      setItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, status: 'resolved' } : item
      ));
      setSelectedItem(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelApproval = async (itemId, foundItemId) => {
    try {
      await lostItemsApi.updateStatus(itemId, 'active');
      if (foundItemId) {
        await foundItemsApi.updateStatus(foundItemId, 'active');
      }
      setItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, status: 'active' } : item
      ));
      setSelectedItem(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim() || !cancelItem) return;
    setCancelling(true);
    setCancelError('');
    try {
      await lostItemsApi.updateStatus(cancelItem.id, 'cancelled', cancelReason.trim());
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

  const handleDelete = async (itemId) => {
    try {
      await lostItemsApi.delete(itemId);
      setItems(prev => prev.filter(i => i.id !== itemId));
      setSelectedItem(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lost Items</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{filtered.length} items found</p>
        </div>
        <button onClick={() => setShowReportForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm">
          + Report Lost Item
        </button>
      </div>

      {cancelSuccess && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg mb-4 text-sm font-medium">{cancelSuccess}</div>
      )}
      {formSuccess && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg mb-4 text-sm">{formSuccess}</div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400" />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="potential_match">Potential Match</option>
            <option value="claimed">Claimed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none">
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none">
            <option value="date">Sort by Date</option>
            <option value="status">Sort by Status</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Item</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Timestamp</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Location</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Reporter</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-blue-100 dark:opacity-80">
                        {item.category_icon || item.imageIcon || '🔍'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{item.description}</p>
                        <p className="text-xs text-gray-400">{item.item_id || item.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="text-sm text-gray-600 dark:text-gray-400">{item.category_name || item.categoryName}</span></td>
                  <td className="px-4 py-3"><span className="text-sm text-gray-600 dark:text-gray-400">{formatDate(item.date_reported || item.dateReported)}</span></td>
                  <td className="px-4 py-3"><span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDateTime(item.date_reported || item.dateReported)}</span></td>
                  <td className="px-4 py-3"><span className="text-sm text-gray-600 dark:text-gray-400">{item.location_lost || item.locationLost}</span></td>
                  <td className="px-4 py-3"><span className="text-sm text-gray-600 dark:text-gray-400">{item.reporter_name || item.reporterName}</span></td>
                  <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setSelectedItem(item)} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 text-sm font-medium">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-2xl mb-2">🔍</p>
            <p>No lost items found matching your filters.</p>
          </div>
        )}
      </div>

      <Modal isOpen={showReportForm} onClose={() => setShowReportForm(false)} title="Report Lost Item" size="lg">
        <form onSubmit={handleReportLost} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description *</label>
              <textarea required value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" rows={2}
                placeholder="Describe the lost item" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category *</label>
              <select required value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none">
                <option value="">Select category</option>
                {categories.filter(c => c.auto_tagging !== false).map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location *</label>
              <input type="text" required value={formData.locationLost} onChange={(e) => setFormData({...formData, locationLost: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="e.g., Main Library - 2nd Floor" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reporter Name *</label>
              <input required value={formData.reporterName} onChange={(e) => setFormData({...formData, reporterName: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="e.g., Juan Dela Cruz" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact Info</label>
              <input value={formData.contactInfo} onChange={(e) => setFormData({...formData, contactInfo: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Email or phone" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Image (optional)</label>
              <label className="cursor-pointer px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                📷 Choose Image
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
              {imagePreview && (
                <div className="relative inline-block ml-2">
                  <img src={imagePreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover border" />
                  <button onClick={() => setImagePreview(null)} className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs">✕</button>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button type="submit" className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700">Submit Report</button>
            <button type="button" onClick={() => { setShowReportForm(false); setImagePreview(null); }} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!selectedItem} onClose={() => setSelectedItem(null)} title={`Details - ${selectedItem?.item_id || selectedItem?.id}`} size="xl">
        {selectedItem && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl bg-blue-100 dark:opacity-80">
                {selectedItem.category_icon || selectedItem.imageIcon || '🔍'}
              </div>
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedItem.description}</h4>
                <p className="text-sm text-gray-500">{selectedItem.item_id || selectedItem.id}</p>
              </div>
            </div>
            {selectedItem.image && (
              <div className="flex justify-center my-3">
                <img
                  src={selectedItem.image}
                  alt="Lost item"
                  onClick={() => setImageLightbox(selectedItem.image)}
                  className="max-h-48 rounded-xl object-cover border border-gray-200 dark:border-gray-700 shadow-sm cursor-zoom-in hover:opacity-90"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-gray-500">Category</p><p className="text-sm font-medium text-gray-900 dark:text-white">{selectedItem.category_name || selectedItem.categoryName}</p></div>
              <div><p className="text-xs text-gray-500">Status</p><StatusBadge status={selectedItem.status} /></div>
              <div><p className="text-xs text-gray-500">Date Reported</p><p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(selectedItem.date_reported || selectedItem.dateReported)}</p></div>
              <div><p className="text-xs text-gray-500">Location</p><p className="text-sm font-medium text-gray-900 dark:text-white">{selectedItem.location_lost || selectedItem.locationLost}</p></div>
              <div><p className="text-xs text-gray-500">Reported By</p><p className="text-sm font-medium text-gray-900 dark:text-white">{selectedItem.reporter_name || selectedItem.reporterName}</p></div>
              <div><p className="text-xs text-gray-500">Last Updated</p><p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(selectedItem.last_updated || selectedItem.lastUpdated)}</p></div>
            </div>
            {selectedItem.status === 'cancelled' && selectedItem.cancel_reason && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-lg">
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-0.5">Cancellation Reason</p>
                <p className="text-sm text-red-700 dark:text-red-300">{selectedItem.cancel_reason}</p>
              </div>
            )}
            {(selectedItem.resolved_date || selectedItem.resolvedDate) && (
              <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-400">✅ Resolved on {formatDate(selectedItem.resolved_date || selectedItem.resolvedDate)}</p>
              </div>
            )}
            {selectedItem.status === 'potential_match' && (
              <>
                <MatchDetails itemId={selectedItem.id} table="lost_items" />
                <FTFVerificationForm lostItem={selectedItem} onComplete={() => { setSelectedItem(null); lostItemsApi.getAll().then(setItems).catch(console.error); }} onCancel={(foundItemId) => handleCancelApproval(selectedItem.id, foundItemId)} />
              </>
            )}
            {canCancel(selectedItem) && (
              <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                <button onClick={() => openCancel(selectedItem)} className="flex-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 py-2 rounded-lg text-sm font-medium hover:bg-amber-200">❌ Cancel Report</button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {imageLightbox && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4" onClick={() => setImageLightbox(null)} role="dialog" aria-modal="true" aria-label="Expanded lost item image">
          <button type="button" onClick={() => setImageLightbox(null)} className="absolute right-5 top-5 rounded-full bg-white/15 px-4 py-2 text-2xl text-white hover:bg-white/25" aria-label="Close image preview">×</button>
          <img src={imageLightbox} alt="Expanded lost item" className="max-h-[90vh] max-w-[95vw] rounded-xl object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Cancel Reason Modal */}
      <Modal isOpen={showCancelModal} onClose={() => setShowCancelModal(false)} title="Cancel Report" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">Please state the reason for cancelling:</p>
          {cancelItem && (
            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded-lg">{cancelItem.description}</p>
          )}
          <textarea
            value={cancelReason}
            onChange={(e) => { setCancelReason(e.target.value); setCancelError(''); }}
            placeholder="e.g. Found the item at home, wrong report, duplicate..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
            rows={3}
          />
          {cancelError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs px-3 py-2 rounded-lg font-medium">
              ⚠ {cancelError}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setShowCancelModal(false)} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">Keep Report</button>
            <button onClick={handleCancel} disabled={cancelling || !cancelReason.trim()} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {cancelling ? 'Cancelling...' : !cancelReason.trim() ? 'Enter a reason first' : 'Confirm Cancel'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
