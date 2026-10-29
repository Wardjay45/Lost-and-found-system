import { useEffect, useId, useRef, useState } from 'react';
import Modal from './Modal';
import AppIcon from './AppIcon';
import { exportCrop, getCropRect } from '../../utils/imageCrop';

const clamp = value => Math.max(-1, Math.min(1, value));

function CropEditor({ source, initial, onApply, onCancel }) {
  const image = useRef(null);
  const stage = useRef(null);
  const drag = useRef(null);
  const processing = useRef(false);
  const id = useId();
  const [dimensions, setDimensions] = useState(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [aspectChoice, setAspectChoice] = useState(initial?.aspectChoice || 'original');
  const [zoom, setZoom] = useState(initial?.zoom || 1);
  const [pan, setPan] = useState(initial?.pan || { x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);

  const aspect = aspectChoice === 'original' ? (dimensions ? dimensions.width / dimensions.height : 1) : Number(aspectChoice);
  const frameWidth = Math.min(stageSize.width, stageSize.height * aspect);
  const frameHeight = frameWidth / aspect;
  const scale = dimensions ? Math.max(frameWidth / dimensions.width, frameHeight / dimensions.height) * zoom : 1;
  const imageWidth = (dimensions?.width || 0) * scale;
  const imageHeight = (dimensions?.height || 0) * scale;
  const maxX = Math.max(0, (imageWidth - frameWidth) / 2);
  const maxY = Math.max(0, (imageHeight - frameHeight) / 2);

  const move = event => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const start = drag.current;
    setPan({ x: maxX ? clamp((start.x + event.clientX - start.clientX) / maxX) : 0, y: maxY ? clamp((start.y + event.clientY - start.clientY) / maxY) : 0 });
  };
  const finishDrag = event => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const save = async () => {
    if (!dimensions || processing.current) return;
    processing.current = true; setBusy(true); setError('');
    try {
      const crop = getCropRect(dimensions.width, dimensions.height, aspect, zoom, pan);
      const result = await exportCrop(image.current, crop);
      onApply(result, { aspectChoice, zoom, pan });
    } catch (err) { setError(err.message || 'Unable to save this crop.'); }
    finally { processing.current = false; setBusy(false); }
  };

  return <Modal isOpen onClose={() => { if (!processing.current) onCancel(); }} title="Adjust report image" size="lg">
    <div className="crop-editor">
      <p id={`${id}-instructions`} className="crop-instructions">Drag the photo and zoom in to focus on the item. Only the area inside the frame will be uploaded. You can also focus the frame and use the arrow keys.</p>
      <div ref={stage} className="crop-stage">
        <div className="crop-frame" style={{ width: frameWidth, height: frameHeight }} tabIndex={0} role="group" aria-label="Crop frame" aria-describedby={`${id}-instructions`}
          onPointerDown={event => {
            if (!dimensions || busy || event.button !== 0) return;
            event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: pan.x * maxX, y: pan.y * maxY };
          }} onPointerMove={move} onPointerUp={finishDrag} onPointerCancel={finishDrag}
          onKeyDown={event => {
            if (busy || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
            event.preventDefault();
            if (event.key === 'Home') { setPan({ x: 0, y: 0 }); return; }
            const step = event.shiftKey ? 30 : 10;
            setPan(current => ({ x: maxX ? clamp(current.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0) / maxX) : 0, y: maxY ? clamp(current.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0) / maxY) : 0 }));
          }}>
          <img ref={image} src={source} alt="Photo to crop" draggable={false} className="crop-source" style={{ width: imageWidth, height: imageHeight, left: (frameWidth - imageWidth) / 2 + pan.x * maxX, top: (frameHeight - imageHeight) / 2 + pan.y * maxY }}
            onLoad={event => { setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }); setError(''); }}
            onError={() => { setDimensions(null); setError('This image cannot be opened. Please choose a JPEG, PNG, or WebP photo.'); }} />
          <div className="crop-grid" aria-hidden="true"><span /><span /><span /><span /></div>
        </div>
        {!dimensions && !error && <span className="crop-loading" role="status">Loading photo...</span>}
      </div>
      <div className="crop-controls">
        <div><label htmlFor={`${id}-aspect`}>Frame shape</label><select id={`${id}-aspect`} className="ui-input" value={aspectChoice} disabled={busy} onChange={event => { setAspectChoice(event.target.value); setPan({ x: 0, y: 0 }); }}>
          <option value="original">Original shape</option><option value="1">Square</option><option value={4 / 3}>Landscape (4:3)</option><option value={3 / 4}>Portrait (3:4)</option>
        </select></div>
        <div><label htmlFor={`${id}-zoom`}>Zoom <span>{zoom.toFixed(1)}×</span></label><input id={`${id}-zoom`} type="range" min="1" max="4" step="0.01" value={zoom} disabled={busy || !dimensions} onChange={event => setZoom(Number(event.target.value))} /></div>
        <button type="button" className="ui-button ui-button-secondary" disabled={busy} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><AppIcon name="refresh" />Reset</button>
      </div>
      {error && <div className="ui-alert ui-alert-error" role="alert"><AppIcon name="error" /><p>{error}</p></div>}
      <div className="crop-actions">
        <button type="button" className="ui-button ui-button-secondary" disabled={busy || !dimensions} onClick={() => onApply(source, null)}>Use full image</button>
        <div><button type="button" className="ui-button ui-button-secondary" disabled={busy} onClick={onCancel}>Cancel</button><button type="button" className="ui-button ui-button-primary" disabled={busy || !dimensions} onClick={save}>{busy ? 'Saving crop...' : 'Use crop'}</button></div>
      </div>
    </div>
  </Modal>;
}

export default function ReportImageInput({ value, onChange }) {
  const id = useId();
  const fileInput = useRef(null);
  const reader = useRef(null);
  const [original, setOriginal] = useState(null);
  const [selection, setSelection] = useState(null);
  const [lastCrop, setLastCrop] = useState(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => { if (reader.current?.readyState === FileReader.LOADING) reader.current.abort(); }, []);
  useEffect(() => { if (!value) { setOriginal(null); setLastCrop(null); } }, [value]);

  const choose = event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setError('');
    if (file.type && !file.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    if (reader.current?.readyState === FileReader.LOADING) reader.current.abort();
    const nextReader = new FileReader(); reader.current = nextReader; setReading(true);
    nextReader.onload = () => { setReading(false); setSelection({ source: nextReader.result, name: file.name, initial: null }); };
    nextReader.onerror = () => { setReading(false); setError('Unable to read this photo. Please choose it again.'); };
    nextReader.readAsDataURL(file);
  };

  return <div className="report-image-input">
    <p className="report-image-label">Image <span>(optional)</span></p>
    <input ref={fileInput} id={id} type="file" accept="image/*" aria-label="Choose report image" className="hidden" onChange={choose} />
    <div className="report-image-buttons"><button type="button" className="ui-button ui-button-secondary" disabled={reading} onClick={() => fileInput.current.click()}><AppIcon name="image" />{reading ? 'Opening image...' : value ? 'Change image' : 'Choose image'}</button>
      {value && <><button type="button" className="ui-button ui-button-secondary" onClick={() => setSelection({ source: original?.source || value, name: original?.name || 'Report photo', initial: lastCrop })}><AppIcon name="edit" />Adjust image</button><button type="button" className="ui-button ui-button-danger" onClick={() => { onChange(null); setError(''); }}><AppIcon name="delete" />Remove</button></>}
    </div>
    {value ? <figure className="report-image-preview"><img src={value} alt="Image that will be uploaded with this report" /><figcaption>{original?.name || 'Report image'} · {lastCrop ? 'Cropped preview' : 'Full image'}</figcaption></figure> : <p className="report-image-hint">Choose a photo, then crop it to keep the item in focus.</p>}
    {error && <p className="ui-alert ui-alert-error" role="alert">{error}</p>}
    {selection && <CropEditor source={selection.source} initial={selection.initial} onCancel={() => setSelection(null)} onApply={(result, crop) => { setOriginal({ source: selection.source, name: selection.name }); setLastCrop(crop); onChange(result); setSelection(null); }} />}
  </div>;
}
