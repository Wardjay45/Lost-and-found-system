import { useEffect, useId, useRef, useState } from 'react';
import AppIcon from './AppIcon';

export default function HandoverPhotoInput({ value, onChange, disabled = false, onBusyChange }) {
  const id = useId();
  const fileInput = useRef(null);
  const version = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => () => { version.current++; }, []);

  const choose = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Choose a JPEG, PNG or WebP photo.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Choose a photo smaller than 10 MB.'); return; }
    const current = ++version.current;
    setBusy(true); onBusyChange?.(true);
    const url = URL.createObjectURL(file);
    try {
      const photo = new Image(); photo.src = url; await photo.decode();
      const scale = Math.min(1, 1280 / Math.max(photo.naturalWidth, photo.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image processing is unavailable in this browser.');
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(photo, 0, 0, canvas.width, canvas.height);
      const result = canvas.toDataURL('image/jpeg', .82);
      if (result.length > 1398144) throw new Error('This photo is too large. Please choose a smaller photo.');
      if (current === version.current) onChange(result);
    } catch (err) {
      if (current === version.current) setError(err.message || 'Unable to open this photo. Please choose another image.');
    } finally {
      URL.revokeObjectURL(url);
      if (current === version.current) { setBusy(false); onBusyChange?.(false); }
    }
  };

  return <div className="handover-photo-input" aria-busy={busy}>
    <label htmlFor={id}>Handover photo <span aria-hidden="true">*</span></label>
    <p id={id + '-hint'}>Upload a photo showing the item being handed to its owner. Required before release.</p>
    <input ref={fileInput} id={id} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload handover photo" aria-required="true" aria-describedby={id + '-hint'} className="hidden" disabled={disabled || busy} onChange={choose} />
    <div className="handover-photo-actions">
      <button type="button" className="ui-button ui-button-secondary" disabled={disabled || busy} onClick={() => fileInput.current.click()}><AppIcon name="upload" />{busy ? 'Preparing photo...' : value ? 'Replace photo' : 'Upload photo'}</button>
      {value && <button type="button" className="ui-button ui-button-danger" disabled={disabled || busy} onClick={() => { version.current++; onChange(null); setError(''); }}><AppIcon name="delete" />Remove photo</button>}
    </div>
    {value && <img className="handover-photo-preview" src={value} alt="Handover photo ready to save with this release" />}
    <p className="collection-muted">JPEG, PNG or WebP, up to 10 MB. The photo is resized for saving.</p>
    {error && <p className="ui-alert ui-alert-error" role="alert">{error}</p>}
  </div>;
}
