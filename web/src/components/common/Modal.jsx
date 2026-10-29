import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import AppIcon from './AppIcon';
let openDialogs = 0;
let previousOverflow = '';
export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const id = useId();
  const panel = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement;
    if (openDialogs++ === 0) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; }
    const focusables = () => [...(panel.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]') || [])].filter(el => el.getClientRects().length);
    const timer = setTimeout(() => (focusables()[0] || panel.current)?.focus(), 0);
    const handleKey = event => {
      const dialogs = document.querySelectorAll('[data-dialog-panel]');
      if (dialogs[dialogs.length - 1] !== panel.current) return;
      if (event.key === 'Escape') { event.preventDefault(); close.current?.(); }
      if (event.key === 'Tab') {
        const elements = focusables(); const first = elements[0]; const last = elements[elements.length - 1];
        if (!first) { event.preventDefault(); panel.current?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || !panel.current.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !panel.current.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', handleKey); if (--openDialogs === 0) document.body.style.overflow = previousOverflow; if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [isOpen]);
  if (!isOpen) return null;
  return createPortal(<div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
    <section ref={panel} data-dialog-panel className={`dialog-panel dialog-${size}`} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
      <header className="dialog-header"><h2 id={id}>{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><AppIcon name="close" /></button></header>
      <div className="dialog-body">{children}</div>
    </section>
  </div>, document.body);
}
