import AppIcon from '../components/common/AppIcon';
import { PageHeader, DataRegion } from '../components/common/UI';
import { useState, useEffect } from 'react';
import { categoriesApi } from '../services/api';
import Modal from '../components/common/Modal';
import CategoryIcon, { CATEGORY_ICON_OPTIONS, getCategoryIconKey } from '../components/common/CategoryIcon';

export default function Categories() {
  const [pageError, setPageError] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [categories, setCategories] = useState([]);
  const [saveMsg, setSaveMsg] = useState('');
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [formData, setFormData] = useState({ name: '', icon: 'tag', color: '#78716c', description: '', keywords: '' });

  useEffect(() => {
    setPageLoading(true); setPageError('');
    Promise.all([categoriesApi.getAll().then(data => {
      setCategories(data.map(c => ({ ...c, autoTagging: c.auto_tagging !== false })));
    })]).catch(err => setPageError(err.message || 'Unable to load this section.')).finally(() => setPageLoading(false));
  }, []);

  const handleToggle = (catId) => {
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, autoTagging: !c.autoTagging } : c));
    setDirty(true);
  };

  const handleEdit = (cat) => {
    setEditingCat(cat);
    setFormData({ name: cat.name, icon: getCategoryIconKey(cat.icon, cat.name), color: cat.color || '#78716c', description: cat.description || '', keywords: cat.keywords || '' });
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
    <div className="page page-categories">
      <PageHeader title="Categories" description={"Organize item categories and automatic tagging rules."} actions={<><div className="flex gap-2">
          {dirty && (
            <button type="button" onClick={handleSaveAll} className="ui-button ui-button-success transition-colors flex items-center gap-1.5">
              <AppIcon name="download" /> Save All Changes
            </button>
          )}
          <button type="button" onClick={() => { setEditingCat(null); setFormData({ name: '', icon: 'tag', color: '#78716c', description: '', keywords: '' }); setShowModal(true); }} className="ui-button ui-button-primary transition-colors">
            <AppIcon name="plus" /> Add Category
          </button>
        </div></>} />

      {saveMsg && (
        <div className={`ui-alert ${saveMsg.startsWith('❌') ? 'ui-alert-error' : 'ui-alert-success'}`} role={saveMsg.startsWith('❌') ? 'alert' : 'status'}>
          <AppIcon name={saveMsg.startsWith('❌') ? 'error' : 'success'} />
          <p>{saveMsg.replace(/^[✅❌]\s*/u, '')}</p>
        </div>
      )}

      <DataRegion loading={pageLoading} error={pageError} onRetry={() => window.location.reload()} empty={categories.length === 0}><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map(cat => (
          <div key={cat.id} className="ui-panel p-5 transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: cat.color + '20' }}>
                  <CategoryIcon icon={cat.icon} categoryName={cat.name} className="h-7 w-7" style={{ color: cat.color }} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{cat.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{cat.item_count || 0} items</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => handleEdit(cat)} className="ui-button ui-button-secondary" title="Edit"><AppIcon name="edit" /></button>
                <button type="button" onClick={() => setConfirmDelete(cat)} className="ui-button ui-button-secondary" title="Delete"><AppIcon name="delete" /></button>
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
      </div></DataRegion>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingCat ? 'Edit Category' : 'Add New Category'} size="md">
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label htmlFor="field-categories-1" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category Name</label>
            <input id="field-categories-1" aria-label="Category Name" type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="ui-input w-full" placeholder="e.g., Electronics" />
          </div>
          <div>
            <label htmlFor="field-categories-2" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Icon</label>
            <select id="field-categories-2" aria-label="Icon" value={formData.icon} onChange={(e) => setFormData({...formData, icon: e.target.value})}
              className="ui-input w-full">
              {CATEGORY_ICON_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <CategoryIcon icon={formData.icon} categoryName={formData.name} className="h-5 w-5" style={{ color: formData.color }} />
              This icon will update existing items in this category too.
            </div>
          </div>
          <div>
            <label htmlFor="field-categories-3" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
            <input id="field-categories-3" aria-label="Color" type="color" value={formData.color} onChange={(e) => setFormData({...formData, color: e.target.value})}
              className="w-full h-10 px-1 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 cursor-pointer" />
          </div>
          <div>
            <label htmlFor="field-categories-4" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea id="field-categories-4" aria-label="Description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="ui-input w-full" rows={3} placeholder="Describe what items belong here" />
          </div>
          <div>
            <label htmlFor="field-categories-5" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Auto-tagging Keywords</label>
            <input id="field-categories-5" aria-label="Auto-tagging Keywords" type="text" value={formData.keywords} onChange={(e) => setFormData({...formData, keywords: e.target.value})}
              className="ui-input w-full" placeholder="phone, smartphone, iphone, android" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Comma-separated keywords for automatic category assignment</p>
          </div>
          <div className="flex gap-2 pt-3">
            <button type="submit" className="ui-button ui-button-primary flex-1">
              {editingCat ? 'Update Category' : 'Save Category'}
            </button>
            <button type="button" onClick={() => setShowModal(false)} className="ui-button ui-button-secondary flex-1">Cancel</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete category" size="sm">{confirmDelete && <>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Are you sure you want to delete "{confirmDelete.name}"? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmDelete(null)} className="ui-button ui-button-secondary">Cancel</button>
              <button type="button" onClick={() => handleDelete(confirmDelete.id)} className="ui-button ui-button-danger">Delete</button>
            </div>
          </>}</Modal>
    </div>
  );
}
