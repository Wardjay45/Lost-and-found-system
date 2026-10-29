import AppIcon from './AppIcon';

export default function ReportLocationFields({ kind, value, onChange, details, onDetailsChange, locations, loading, error, refresh, disabled }) {
  const id = `report-${kind}-location`;
  const available = locations.some(place => place.name === value);
  return <div className="col-span-full space-y-4">
    <div>
      <div className="flex items-center justify-between gap-3 mb-1">
        <label htmlFor={id} className="text-sm font-medium">Location {kind === 'lost' ? 'Lost' : 'Found'} *</label>
        <button type="button" className="ui-button ui-button-link" onClick={refresh} disabled={loading || disabled}><AppIcon name="refresh" />{loading ? 'Refreshing...' : 'Refresh locations'}</button>
      </div>
      <select id={id} className="ui-input w-full" value={available ? value : ''} onChange={event => onChange(event.target.value)} required disabled={loading || !!error || !locations.length || disabled} aria-describedby={`${id}-help`}>
        <option value="">{loading ? 'Loading locations...' : 'Select an approved location'}</option>
        {locations.map(place => <option key={place.id} value={place.name}>{place.name}</option>)}
      </select>
      <p id={`${id}-help`} className={`text-xs mt-2 ${error ? 'tone-error' : 'lf-text-muted'}`} role={error ? 'alert' : 'status'}>
        {error || (loading ? 'Loading active locations.' : !locations.length ? 'No active locations available. Add one in Locations, then refresh.' : value && !available ? 'This location is no longer active. Choose another location.' : 'Choose an active location added by the administrator.')}
      </p>
    </div>
    <div>
      <label htmlFor={`${id}-details`} className="block text-sm font-medium mb-1">Additional Info (optional)</label>
      <textarea id={`${id}-details`} className="ui-input w-full" rows={3} maxLength={500} value={details} onChange={event => onDetailsChange(event.target.value)} disabled={disabled}
        placeholder={`Where exactly did you ${kind === 'lost' ? 'lose' : 'find'} it? Add a nearby landmark or other detail.`} />
      <p className="text-xs lf-text-muted mt-1">{details.length}/500 characters</p>
    </div>
  </div>;
}
