import { useState, useEffect } from 'react';
import { qrLocationsApi, lostItemsApi, foundItemsApi } from '../services/api';
import { formatDate } from '../utils/formatters';
import Modal from '../components/common/Modal';

// The deep link / URL that the mobile app will handle
// When scanned, it opens the app and auto-fills the location
const APP_SCHEME = 'lostandfound://report';
const APP_STORE_LINK = 'https://play.google.com/store/apps/details?id=com.lostandfound';

export default function QRLocations() {
  const [locations, setLocations] = useState([]);
  const [reportCounts, setReportCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ name: '' });
  const [formError, setFormError] = useState('');
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
    }).catch(console.error).finally(() => setLoading(false));
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
    const name = formData.name.trim();
    if (!name) {
      setFormError('Location name is required.');
      return;
    }
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
    }
  };

  /* const downloadQR = (loc) => {
    const link = document.createElement('a');
    link.download = `qr-${loc.name.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = qrDataUrls[loc.id];
    link.click();
  }; */

  const toggleActive = async (loc) => {
    try {
      await qrLocationsApi.update(loc.id, { is_active: !loc.is_active });
      setLocations(prev => prev.map(l => l.id === loc.id ? { ...l, is_active: !l.is_active } : l));
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const downloadQR = () => {};
  const printQR = () => {};

  const deleteLocation = async (loc) => {
    if (!window.confirm(`Delete "${loc.name}" permanently? This cannot be undone.`)) return;
    try {
      await qrLocationsApi.delete(loc.id);
      setLocations(prev => prev.filter(l => l.id !== loc.id));
    } catch (err) {
      console.error('Failed to delete:', err);
    }
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Predefined Locations</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage approved locations users can select when reporting an item
          </p>
        </div>
        <button onClick={() => setShowAddForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Add Location
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5 mb-6">
        <div className="flex items-start gap-4">
          <span className="text-3xl">📱</span>
          <div>
            <h3 className="font-bold text-lg mb-1 text-indigo-900 dark:text-indigo-200">Keep reporting locations consistent</h3>
            <p className="text-indigo-700 dark:text-indigo-300 text-sm leading-relaxed">
              Add approved campus locations such as libraries, cafeterias, halls, and classrooms. Users can select these predefined options when submitting lost or found reports.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map(loc => (
            <div key={loc.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">{loc.name}</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${loc.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                  {loc.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="mb-4 flex items-center gap-3 rounded-lg bg-indigo-50 p-4 dark:bg-indigo-900/20">
                <span className="text-3xl">📍</span>
                <div><p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">Approved reporting location</p><p className="text-xs text-indigo-600 dark:text-indigo-300">Available for lost and found reports</p></div>
              </div>

              <div className="hidden">
                <button
                  onClick={() => downloadQR(loc)}
                  className="flex-1 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 py-2 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 font-medium"
                >
                  💾 Download
                </button>
                <button
                  onClick={() => printQR(loc)}
                  className="flex-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium"
                >
                  🖨️ Print
                </button>
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => toggleActive(loc)}
                  className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${
                    loc.is_active
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200'
                  }`}
                >
                  {loc.is_active ? '⏸️ Deactivate' : '▶️ Activate'}
                </button>
                <button
                  onClick={() => deleteLocation(loc)}
                  className="flex-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 py-1.5 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 font-medium"
                >
                  🗑️ Delete
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-700/50">
                <span className="text-xs text-gray-500 dark:text-gray-400">Reports using this location</span>
                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-300">{reportCounts[loc.id] || 0}</span>
              </div>
            </div>
          ))}
          {locations.length === 0 && (
            <div className="col-span-full text-center py-16 text-gray-500">
              <p className="text-3xl mb-3">📍</p>
              <p className="font-medium">No predefined locations yet</p>
              <p className="text-sm mt-1">Add approved campus locations for reporting</p>
            </div>
          )}
        </div>
      )}

      {/* Add Location Modal */}
      <Modal isOpen={showAddForm} onClose={() => { setShowAddForm(false); setFormError(''); }} title="Add Predefined Location" size="sm">
        <form onSubmit={handleAddLocation} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location Name</label>
            <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="e.g., Main Library - 2nd Floor" />
            <p className="text-xs text-gray-400 mt-1">Users will be able to select this location when reporting an item.</p>
            {formError && <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{formError}</p>}
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">Add Location</button>
            <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">Cancel</button>
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
              <p className="font-medium mb-1">📱 When scanned:</p>
              <ul className="space-y-1">
                <li>1. Opens Lost & Found app</li>
                <li>2. Location auto-filled: <strong>{qrModal.loc.name}</strong></li>
                <li>3. User describes item & submits</li>
              </ul>
            </div>
            <div className="flex gap-2 w-full">
              <button onClick={() => downloadQR(qrModal.loc)} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">💾 Download</button>
              <button onClick={() => { printQR(qrModal.loc); setQrModal(null); }} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">🖨️ Print</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
