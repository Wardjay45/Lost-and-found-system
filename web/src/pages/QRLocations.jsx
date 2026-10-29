import AppIcon from '../components/common/AppIcon';
import { PageHeader, DataRegion } from '../components/common/UI';
import { useState, useEffect, useRef } from 'react';
import { qrLocationsApi, lostItemsApi, foundItemsApi } from '../services/api';
import { formatDate } from '../utils/formatters';
import Modal from '../components/common/Modal';

// The deep link / URL that the mobile app will handle
// When scanned, it opens the app and auto-fills the location
const APP_SCHEME = 'lostandfound://report';
const APP_STORE_LINK = 'https://play.google.com/store/apps/details?id=com.lostandfound';

export default function QRLocations() {
  const [pageError, setPageError] = useState('');
  const [locations, setLocations] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [reportCounts, setReportCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ name: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(null);
  const savePending = useRef(false);
  const togglePending = useRef(false);
  const [qrDataUrls] = useState({});
  const [qrModal, setQrModal] = useState(null);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = () => {
    setLoading(true);
    Promise.all([qrLocationsApi.getAll(), lostItemsApi.getAll(), foundItemsApi.getAll()]).then(([data, lost, found]) => {
      setLocations(data);
      const counts = {};
      data.forEach(loc => {
        const sameLocation = (item, field) => (item[field] || item[field === 'location_lost' ? 'locationLost' : 'locationFound'] || '').trim().toLowerCase() === loc.name.trim().toLowerCase();
        counts[loc.id] = lost.filter(item => sameLocation(item, 'location_lost')).length + found.filter(item => sameLocation(item, 'location_found')).length;
      });
      setReportCounts(counts);
    }).catch(err => setPageError(err.message || 'Unable to load this section.')).finally(() => setLoading(false));
  };

  /* QR generation removed: locations are now reusable predefined options. */
  const generateQR = async (loc) => {
    return loc;
  /*
    try {
      const urlData = `${APP_SCHEME}?location=${encodeURIComponent(loc.name)}&id=${loc.id}`;

      const dataUrl = await QRCode.toDataURL(urlData, {
        width: 300,
        margin: 2,
        color: { dark: '#1e293b', light: '#ffffff' },
      });

      setQrDataUrls(prev => ({ ...prev, [loc.id]: dataUrl }));
    } catch (err) {
      console.error('QR generation failed:', err);
    }
  */
  };

  const handleAddLocation = async (e) => {
    e.preventDefault();
    if (savePending.current) return;
    const name = formData.name.trim();
    if (!name) {
      setFormError('Location name is required.');
      return;
    }
    savePending.current = true; setSaving(true);
    try {
      setFormError('');
      const newLoc = await qrLocationsApi.create({
        name,
      });
      setLocations(prev => [...prev, newLoc]);
      setShowAddForm(false);
      setFormData({ name: '' });
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Unable to save this location. Please try again.');
    } finally { savePending.current = false; setSaving(false); }
  };

  /* const downloadQR = (loc) => {
    const link = document.createElement('a');
    link.download = `qr-${loc.name.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = qrDataUrls[loc.id];
    link.click();
  }; */

  const toggleActive = async (loc) => {
    if (togglePending.current) return;
    togglePending.current = true; setToggling(loc.id); setPageError('');
    try {
      await qrLocationsApi.update(loc.id, { is_active: !loc.is_active });
      setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, is_active: !l.is_active } : l));
    } catch (err) {
      setPageError(err.message || 'Unable to change location status. Try again.');
    } finally { togglePending.current = false; setToggling(null); }
  };

  const downloadQR = () => {};
  const printQR = () => {};

  const deleteLocation = async (loc) => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await qrLocationsApi.delete(loc.id);
      setLocations(prev => prev.filter(l => l.id !== loc.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err.message || 'Unable to delete this location. Please try again.');
    } finally { setDeleting(false); }
  };

  /* const printQR = (loc) => {
    const win = window.open('', '_blank');
    win.document.write(`
      <html>
        <head><title>QR Code - ${loc.name}</title></head>
        <body style="text-align:center;font-family:Arial;padding:40px;">
          <h2>${loc.name}</h2>
          <img src="${qrDataUrls[loc.id]}" style="width:300px;height:300px;" />
          <p style="color:#999;margin-top:20px;font-size:12px;">
            Scan this QR code to auto-fill location in Lost & Found app<br/>
            Download the app: ${APP_STORE_LINK}
          </p>
          <script>window.print();<\/script>
        </body>
      </html>
    `);
    win.document.close();
  }; */

  return (
    <div className="page page-qrlocations">
      <PageHeader title="Locations" description={"Manage approved places for consistent campus reporting."} actions={<><button type="button" onClick={() => setShowAddForm(true)} className="ui-button ui-button-primary">
          <AppIcon name="plus" /> Add Location
        </button></>} />

      {/* Info Banner */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5 mb-6">
        <div className="flex items-start gap-4">
          <span className="text-3xl"><AppIcon name="location" /></span>
          <div>
            <h3 className="font-bold text-lg mb-1 text-indigo-900 dark:text-indigo-200">Keep reporting locations consistent</h3>
            <p className="text-indigo-700 dark:text-indigo-300 text-sm leading-relaxed">
              Add approved campus locations such as libraries, cafeterias, halls, and classrooms. Users can select these predefined options when submitting lost or found reports.
            </p>
          </div>
        </div>
      </div>

      <DataRegion loading={loading} error={pageError} onRetry={() => window.location.reload()}>{loading ? (
        <div className="text-center py-12 text-gray-500 ui-empty">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map(loc => (
            <div key={loc.id} className="ui-panel p-5 transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">{loc.name}</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${loc.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                  {loc.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <p className="text-sm lf-text-muted mb-4">Campus reporting location</p>

              <div className="hidden">
                <button type="button"
                  onClick={() => downloadQR(loc)}
                  className="ui-button ui-button-link flex-1"
                >
                  <AppIcon name="download" /> Download
                </button>
                <button type="button"
                  onClick={() => printQR(loc)}
                  className="ui-button ui-button-secondary flex-1"
                >
                  <AppIcon name="print" /> Print
                </button>
              </div>

              <div className="flex gap-2 mt-2">
                <button type="button"
                  disabled={toggling !== null}
                  aria-busy={toggling === loc.id}
                  onClick={() => toggleActive(loc)}
                  className={`ui-button flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${
                    loc.is_active
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200'
                  }`}
                >
                  {loc.is_active ? "Deactivate" : "Activate"}
                </button>
                <button type="button"
                  onClick={() => { setDeleteError(''); setDeleteTarget(loc); }}
                  className="ui-button ui-button-danger flex-1"
                >
                  <AppIcon name="delete" /> Delete
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-700/50">
                <span className="text-xs text-gray-500 dark:text-gray-400">Reports using this location</span>
                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-300">{reportCounts[loc.id] || 0}</span>
              </div>
            </div>
          ))}
          {locations.length === 0 && (
            <div className="col-span-full text-center py-16 text-gray-500 ui-empty">
              <p className="text-3xl mb-3"><AppIcon name="location" /></p>
              <p className="font-medium">No predefined locations yet</p>
              <p className="text-sm mt-1">Add approved campus locations for reporting</p>
            </div>
          )}
        </div>
      )}</DataRegion>

      <Modal isOpen={!!deleteTarget} onClose={() => { if (!deleting) setDeleteTarget(null); }} title="Delete location" size="sm">
        <p className="text-sm lf-text-muted">Delete {deleteTarget?.name}? This action cannot be undone.</p>
        {deleteError && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-300">{deleteError}</p>}
        <div className="flex justify-end gap-2 mt-6"><button type="button" className="ui-button ui-button-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Keep location</button><button type="button" className="ui-button ui-button-danger" onClick={() => deleteLocation(deleteTarget)} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete location'}</button></div>
      </Modal>

      {/* Add Location Modal */}
      <Modal isOpen={showAddForm} onClose={() => { if (!saving) { setShowAddForm(false); setFormError(''); } }} title="Add Predefined Location" size="sm">
        <form onSubmit={handleAddLocation} className="space-y-4">
          <div>
            <label htmlFor="field-qrlocations-1" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location Name</label>
            <input id="field-qrlocations-1" aria-label="Location Name" type="text" required maxLength={100} disabled={saving} value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="ui-input w-full"
              placeholder="e.g., Main Library - 2nd Floor" />
            <p className="text-xs text-gray-400 mt-1">Users will be able to select this location when reporting an item.</p>
            {formError && <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{formError}</p>}
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="ui-button ui-button-primary flex-1">{saving ? "Adding…" : "Add Location"}</button>
            <button type="button" disabled={saving} onClick={() => setShowAddForm(false)} className="ui-button ui-button-secondary flex-1">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* QR Code Preview Modal */}
      <Modal isOpen={!!qrModal} onClose={() => setQrModal(null)} title={qrModal?.loc?.name || 'QR Code'} size="sm">
        {qrModal && (
          <div className="flex flex-col items-center space-y-4">
            <img src={qrModal.qr} alt="QR Code" className="w-64 h-64 border border-gray-200 dark:border-gray-600 rounded-xl p-2" />
            <div className="text-center">
              <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{qrModal.loc.name}</p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 text-xs text-indigo-700 dark:text-indigo-300 w-full">
              <p className="font-medium mb-1"><AppIcon name="location" /> When scanned:</p>
              <ul className="space-y-1">
                <li>1. Opens Lost & Found app</li>
                <li>2. Location auto-filled: <strong>{qrModal.loc.name}</strong></li>
                <li>3. User describes item & submits</li>
              </ul>
            </div>
            <div className="flex gap-2 w-full">
              <button type="button" onClick={() => downloadQR(qrModal.loc)} className="ui-button ui-button-primary flex-1"><AppIcon name="download" /> Download</button>
              <button type="button" onClick={() => { printQR(qrModal.loc); setQrModal(null); }} className="ui-button ui-button-secondary flex-1"><AppIcon name="print" /> Print</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
