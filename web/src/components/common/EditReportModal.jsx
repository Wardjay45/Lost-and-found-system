import { useRef, useState } from 'react';
import Modal from './Modal';
import ReportImageInput from './ReportImageInput';
import { foundItemsApi, lostItemsApi } from '../../services/api';
import useReportLocations from '../../hooks/useReportLocations';
import { showToast } from './Toast';

export default function EditReportModal({ item, kind, categories, onClose, onSaved }) {
  const locationField = kind === 'lost' ? 'location_lost' : 'location_found';
  const personField = kind === 'lost' ? 'reporter_name' : 'finder_name';
  const [form, setForm] = useState(() => ({ description: item.description || '', category_id: item.category_id ? String(item.category_id) : '',
    [locationField]: item[locationField] || '', location_details: item.location_details || '', [personField]: item[personField] || '',
    condition: item.condition || 'Good', image: item.image || null }));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const saving = useRef(false);
  const locations = useReportLocations(true);
  const set = (field, value) => setForm(previous => ({ ...previous, [field]: value }));
  const save = async event => {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const payload = { description: form.description.trim(), [personField]: form[personField].trim(), location_details: form.location_details,
        image: form.image, expected_last_updated: item.last_updated };
      if (form.category_id !== String(item.category_id || '')) payload.category_id = Number(form.category_id);
      if (form[locationField] !== item[locationField]) payload[locationField] = form[locationField];
      if (kind === 'found') payload.condition = form.condition;
      const updated = await (kind === 'lost' ? lostItemsApi : foundItemsApi).update(item.id, payload);
      onSaved(updated);
      showToast(`${kind === 'lost' ? 'Lost' : 'Found'} item updated successfully.`, 'success', 'Item updated');
    } catch (failure) {
      const message = failure.message || 'Unable to save changes.';
      setError(message);
      showToast(message, 'error', 'Update failed');
    }
    finally { saving.current = false; setBusy(false); }
  };
  const choices = categories.filter(category => category.auto_tagging !== false || String(category.id) === String(item.category_id));
  return <Modal isOpen onClose={() => { if (!saving.current) onClose(); }} title={'Edit ' + kind + ' item report'} size="lg">
    <form onSubmit={save} className="space-y-4">
      <fieldset disabled={busy} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="col-span-full text-sm font-medium">Description *<textarea className="ui-input w-full mt-1" required maxLength={10000} rows={3} value={form.description} onChange={event => set('description', event.target.value)} /></label>
        <label className="text-sm font-medium">Category<select className="ui-input w-full mt-1" value={form.category_id} onChange={event => set('category_id', event.target.value)}>
          <option value="" disabled>{item.category_name || 'Select category'}</option>{choices.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select></label>
        <label className="text-sm font-medium">{kind === 'lost' ? 'Reporter name' : 'Finder name'}<input className="ui-input w-full mt-1" maxLength={200} value={form[personField]} onChange={event => set(personField, event.target.value)} /></label>
        <label className="col-span-full text-sm font-medium">Location {kind === 'lost' ? 'lost' : 'found'}<select className="ui-input w-full mt-1" value={form[locationField]} disabled={busy || locations.loading || !!locations.error} onChange={event => set(locationField, event.target.value)}>
          {!locations.locations.some(place => place.name === item[locationField]) && <option value={item[locationField] || ''}>{item[locationField] || 'Location not recorded'} (current)</option>}
          {locations.locations.map(place => <option key={place.id} value={place.name}>{place.name}</option>)}
        </select>{locations.error && <small role="status" className="block lf-text-muted mt-1">{locations.error} You can still save other details.</small>}</label>
        <label className="col-span-full text-sm font-medium">Additional info<textarea className="ui-input w-full mt-1" maxLength={500} rows={3} value={form.location_details} onChange={event => set('location_details', event.target.value)} /></label>
        {kind === 'found' && <label className="col-span-full text-sm font-medium">Condition<select className="ui-input w-full mt-1" value={form.condition} onChange={event => set('condition', event.target.value)}>{[...new Set(['Good', 'Damaged', form.condition])].map(value => <option key={value}>{value}</option>)}</select></label>}
        <div className="col-span-full"><ReportImageInput value={form.image} onChange={value => set('image', value)} /></div>
      </fieldset>
      {error && <p role="alert" className="ui-alert ui-alert-error">{error}</p>}
      <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        <button type="submit" disabled={busy || !form.description.trim()} className="ui-button ui-button-primary flex-1">{busy ? 'Saving...' : 'Save changes'}</button>
        <button type="button" disabled={busy} onClick={onClose} className="ui-button ui-button-secondary flex-1">Cancel</button>
      </div>
    </form>
  </Modal>;
}
