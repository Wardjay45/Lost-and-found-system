import { useState, useEffect } from 'react';
import { categoriesApi } from '../services/api';
import Modal from '../components/common/Modal';

export default function Categories() {
  const [showModal, setShowModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [categories, setCategories] = useState([]);
  const [saveMsg, setSaveMsg] = useState('');
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [formData, setFormData] = useState({ name: '', icon: '', color: '#78716c', description: '', keywords: '' });

  useEffect(() => {
    categoriesApi.getAll().then(data => {
      setCategories(data.map(c => ({ ...c, autoTagging: c.auto_tagging !== false })));
    }).catch(console.error);
  }, []);

  const handleToggle = (catId) => {
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, autoTagging: !c.autoTagging } : c));
    setDirty(true);
  };

  const handleEdit = (cat) => {
    setEditingCat(cat);
    setFormData({ name: cat.name, icon: cat.icon || '', color: cat.color || '#78716c', description: cat.description || '', keywords: cat.keywords || '' });
    setShowModal(true);
  };

  const handleDelete = async (catId) => {
    try {
      await categoriesApi.delete(catId);
      setCategories(prev => prev.filter(c => c.id !== catId));
      setSaveMsg('✅ Category deleted successfully!');
      setConfirmDelete(null);
    } catch (err) {
      setSaveMsg(`❌ ${err.message}`);
    }
    setTimeout(() => setSaveMsg(''), 4000);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCat) {
        await categoriesApi.update(editingCat.id, formData);
        setCategories(prev => prev.map(c => c.id === editingCat.id ? { ...c, ...formData } : c));
        setSaveMsg('✅ Category updated successfully!');
      } else {
        const newCat = await categoriesApi.create(formData);
        setCategories(prev => [...prev, { ...newCat, autoTagging: true }]);
        setSaveMsg('✅ Category added successfully!');
      }
      setShowModal(false);
    } catch (err) {
      setSaveMsg(`❌ ${err.message}`);
    }
    setTimeout(() => setSaveMsg(''), 4000);
  };

  const handleSaveAll = async () => {
    try {
      await categoriesApi.bulkUpdate(categories.map(c => ({ id: c.id, auto_tagging: c.autoTagging })));
      setSaveMsg('✅ All category changes saved successfully!');
      setDirty(false);
    } catch (err) {
      setSaveMsg(`❌ ${err.message}`);
    }
    setTimeout(() => setSaveMsg(''), 4000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Category Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage item categories and auto-tagging rules</p>
        </div>
        <div className="flex gap-2">
          {dirty && (
            <button onClick={handleSaveAll} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-sm flex items-center gap-1.5">
              💾 Save All Changes
            </button>
          )}
          <button onClick={() => { setEditingCat(null); setFormData({ name: '', icon: '', color: '#78716c', description: '', keywords: '' }); setShowModal(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            + Add Category
          </button>
        </div>
      </div>

      {saveMsg && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg mb-4 text-sm">{saveMsg}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map(cat => (
          <div key={cat.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: cat.color + '20' }}>
                  {cat.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{cat.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{cat.item_count || 0} items</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleEdit(cat)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Edit">✏️</button>
                <button onClick={() => setConfirmDelete(cat)} className="p-1.5 text-gray-400 hover:text-red-600" title="Delete">🗑️</button>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{cat.description}</p>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${cat.autoTagging ? 'text-green-600' : 'text-red-500'}`}>
                Status: {cat.autoTagging ? 'Active' : 'Not active'}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={cat.autoTagging} onChange={() => handleToggle(cat.id)} />
                <div className="w-9 h-5 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
              </label>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingCat ? 'Edit Category' : 'Add New Category'} size="md">
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category Name</label>
            <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., Electronics" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Icon</label>
            <input type="text" value={formData.icon} onChange={(e) => setFormData({...formData, icon: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g., 💻" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
            <input type="color" value={formData.color} onChange={(e) => setFormData({...formData, color: e.target.value})}
              className="w-full h-10 px-1 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 cursor-pointer" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" rows={3} placeholder="Describe what items belong here" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Auto-tagging Keywords</label>
            <input type="text" value={formData.keywords} onChange={(e) => setFormData({...formData, keywords: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="phone, smartphone, iphone, android" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Comma-separated keywords for automatic category assignment</p>
          </div>
          <div className="flex gap-2 pt-3">
            <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
              {editingCat ? 'Update Category' : 'Save Category'}
            </button>
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Category</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Are you sure you want to delete "{confirmDelete.name}"? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete.id)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}