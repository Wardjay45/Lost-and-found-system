import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/AppContext';
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../common/AppIcon';
import { accountRoleLabel } from '../../../../shared/roles.mjs';
export default function Header({ onToggleSidebar, sidebarOpen }) {
  const { user, logout } = useAuth();
  const accountName = user?.name?.trim();
  const displayName = !accountName || accountName.toLowerCase() === 'admin user' ? 'Administrator' : accountName;
  const { settings, toggleHighContrast, toggleDarkMode } = useAppSettings();
  const [showProfile, setShowProfile] = useState(false);
  const menuRef = useRef(null);
  const trigger = useRef(null);
  useEffect(() => {
    if (!showProfile) return;
    const dismiss = event => { if (!menuRef.current?.contains(event.target)) setShowProfile(false); };
    const escape = event => { if (event.key === 'Escape') { setShowProfile(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
  }, [showProfile]);
  return <header className="workspace-header">
    <div className="header-context"><button type="button" className="icon-button mobile-menu-toggle" onClick={onToggleSidebar} aria-label="Open navigation" aria-expanded={sidebarOpen} aria-controls="admin-navigation"><AppIcon name="menu" /></button><AppIcon name="building" /><span>Campus workspace</span><span className="header-divider" /><span className="header-caption">Administration</span></div>
    <div className="header-actions">
      <button type="button" className="icon-button" onClick={toggleDarkMode} aria-label={settings.darkMode ? 'Switch to light mode' : 'Switch to dark mode'} title={settings.darkMode ? 'Light mode' : 'Dark mode'}><AppIcon name={settings.darkMode ? 'sun' : 'moon'} /></button>
      <button type="button" className={`icon-button ${settings.highContrast ? 'is-active' : ''}`} onClick={toggleHighContrast} aria-label="High contrast" aria-pressed={settings.highContrast} title="High contrast"><AppIcon name="contrast" /></button>
      <span className="header-divider" />
      <div className="profile-control" ref={menuRef}>
        <button type="button" ref={trigger} onClick={() => setShowProfile(open => !open)} className="profile-trigger" aria-label="Open account options" aria-expanded={showProfile} aria-controls="account-options"><span className="avatar">{displayName.charAt(0)}</span><span className="profile-label"><strong>{displayName}</strong><small>{accountRoleLabel(user?.role)}</small></span><AppIcon name="down" /></button>
        {showProfile && <div id="account-options" className="profile-dropdown"><div><strong>{displayName}</strong><p>{user?.email}</p></div><Link to="/settings" onClick={() => setShowProfile(false)}><AppIcon name="settings" />Preferences</Link><button type="button" onClick={() => { setShowProfile(false); logout(); }}><AppIcon name="logout" />Sign out</button></div>}
      </div>
    </div>
  </header>;
}
