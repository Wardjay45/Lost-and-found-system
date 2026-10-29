import { useState, useEffect, useCallback, useRef } from 'react';
import AppIcon from './AppIcon';
let listeners = [];
let nextId = 0;
export function showToast(message, type = 'success', title = '') {
  listeners.forEach(listener => listener({ message, type, title, id: ++nextId }));
}
export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Set());
  const addToast = useCallback(toast => {
    setToasts(prev => [...prev.slice(-3), toast]);
    const timer = setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== toast.id)); timers.current.delete(timer); }, 6000);
    timers.current.add(timer);
  }, []);
  useEffect(() => {
    listeners.push(addToast); const pending = timers.current;
    return () => { listeners = listeners.filter(fn => fn !== addToast); pending.forEach(clearTimeout); pending.clear(); };
  }, [addToast]);
  return <div className="toast-stack">{toasts.map(toast => <div key={toast.id} className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
    <AppIcon name={toast.type === 'success' ? 'success' : toast.type === 'error' ? 'error' : toast.type === 'info' ? 'info' : 'warning'} />
    <div>{toast.title && <strong>{toast.title}</strong>}<p>{toast.message}</p></div>
    <button type="button" className="icon-button" aria-label="Dismiss notification" onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}><AppIcon name="close" /></button>
  </div>)}</div>;
}
