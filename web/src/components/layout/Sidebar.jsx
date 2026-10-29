import { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import AppIcon from '../common/AppIcon';
import useNotifications from '../../hooks/useNotifications';
const groups = [
  { label: 'Workspace', items: [{path:'/',label:'Overview',icon:'dashboard'}, {path:'/analytics',label:'Analytics',icon:'chart'}] },
  { label: 'Item management', items: [{path:'/items/lost',label:'Lost items',icon:'search',badgeKey:'lost'}, {path:'/items/found',label:'Found items',icon:'box',badgeKey:'found'}, {path:'/matching',label:'Smart matching',icon:'matching'}, {path:'/items/potential-matches',label:'Potential matches',icon:'link'}, {path:'/items/claimed',label:'Claimed items',icon:'success'}, {path:'/unclaimed',label:'Unclaimed items',icon:'clock'}] },
  { label: 'Community', items: [{path:'/messaging',label:'Messages',icon:'messages',badgeKey:'messages'}, {path:'/users',label:'Users',icon:'users'}, {path:'/feedback',label:'Feedback',icon:'star'}] },
  { label: 'Administration', items: [{path:'/categories',label:'Categories',icon:'tag'}, {path:'/qr-locations',label:'Locations',icon:'location'}, {path:'/activity-logs',label:'Activity log',icon:'activity'}, {path:'/settings',label:'Settings',icon:'settings'}] },
];
export default function Sidebar({ isOpen, onClose }) {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  useEffect(() => { const media = window.matchMedia('(max-width: 1023px)'); const update = () => setMobile(media.matches); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  const { counts, error } = useNotifications();
  const getBadgeCount = item => counts[item.badgeKey] || 0;

  const panel = useRef(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    if (!isOpen || window.matchMedia('(min-width: 1024px)').matches) return;
    const before = document.activeElement;
    const timer = setTimeout(() => panel.current?.querySelector('button')?.focus(), 0);
    const keydown = event => {
      if (event.key === 'Escape') close.current();
      if (event.key === 'Tab') {
        const elements = [...panel.current.querySelectorAll('button, a')];
        const first = elements[0], last = elements[elements.length-1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', keydown); before?.focus(); };
  }, [isOpen]);
  return <>
    {isOpen && <button type="button" className="sidebar-scrim" onClick={onClose} aria-label="Close navigation" tabIndex={-1} />}
    <aside inert={mobile && !isOpen ? true : undefined} aria-hidden={mobile && !isOpen ? true : undefined} ref={panel} id="admin-navigation" className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand"><img src="/logo.png" alt="" /><div><strong>Lost & Found</strong><span>Campus management</span></div><button type="button" className="icon-button sidebar-close" onClick={onClose} aria-label="Close navigation"><AppIcon name="close" /></button></div>
      <nav aria-label="Main navigation" title={error ? 'Notifications temporarily unavailable; retrying automatically' : undefined}>{groups.map(group => <div className="nav-group" key={group.label}><p className="nav-group-label">{group.label}</p>{group.items.map(item => {
        const badge = getBadgeCount(item);
        return <NavLink key={item.path} to={item.path} end={item.path === '/'} onClick={onClose} className={({isActive}) => `nav-link ${isActive ? 'nav-link-active' : ''}`}><AppIcon name={item.icon} /><span>{item.label}</span>{badge > 0 && <span className="nav-badge" aria-label={badge + (item.badgeKey === 'messages' ? ' unread messages' : ' new reports')} aria-live="polite">{badge > 99 ? '99+' : badge}</span>}</NavLink>;
      })}</div>)}</nav>
      <div className="sidebar-footer"><AppIcon name="building" /><div><strong>Campus Lost & Found</strong><span>Admin workspace · v1.0</span></div></div>
    </aside>
  </>;
}
