import { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const API_URL = '/api';
const STORAGE_KEY = 'lf-admin-seen-counts';

/* ─── Crisp SVG Icons (20×20, stroke-based, uniform weight) ─── */
const Icons = {
  Dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  LostItems: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M11 8v3l2 2" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  ),
  FoundItems: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h7" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <circle cx="18" cy="18" r="3" />
      <path d="M20.5 20.5L22 22" />
    </svg>
  ),
  SmartMatching: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  ActivityLogs: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12h6M9 8h6M9 16h4" />
      <path d="M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
    </svg>
  ),
  Analytics: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 16l4-4 4 4 4-6" />
    </svg>
  ),
  Categories: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h8M4 18h12" />
      <circle cx="19" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  ),
  Users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3" />
      <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" />
      <path d="M16 3.13a4 4 0 010 7.75" />
      <path d="M21 21v-2a4 4 0 00-3-3.85" />
    </svg>
  ),
  Locations: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  Messaging: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  Unclaimed: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  ),
  Feedback: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  Settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
};

const navItems = [
  { path: '/',               label: 'Dashboard',          icon: Icons.Dashboard,      badgeKey: null },
  { path: '/items/lost',     label: 'Lost Items',          icon: Icons.LostItems,      badgeKey: null },
  { path: '/items/found',    label: 'Found Items',         icon: Icons.FoundItems,     badgeKey: 'foundNew' },
  { path: '/matching',       label: 'Smart Matching',      icon: Icons.SmartMatching,  badgeKey: null },
  { path: '/activity-logs',  label: 'Activity Logs',       icon: Icons.ActivityLogs,   badgeKey: null },
  { path: '/analytics',      label: 'Analytics',           icon: Icons.Analytics,      badgeKey: null },
  { path: '/categories',     label: 'Categories',          icon: Icons.Categories,     badgeKey: null },
  { path: '/users',          label: 'Users',               icon: Icons.Users,          badgeKey: null },
  { path: '/qr-locations',   label: 'Predefined Locations',icon: Icons.Locations,      badgeKey: null },
  { path: '/messaging',      label: 'Messaging',           icon: Icons.Messaging,      badgeKey: 'messages' },
  { path: '/unclaimed',      label: 'Unclaimed Items',     icon: Icons.Unclaimed,      badgeKey: null },
  { path: '/feedback',       label: 'Feedback',            icon: Icons.Feedback,       badgeKey: null },
  { path: '/settings',       label: 'Settings',            icon: Icons.Settings,       badgeKey: null },
];

const loadSeenCounts = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { lostPending: 0, foundNew: 0, messages: 0 };
  } catch { return { lostPending: 0, foundNew: 0, messages: 0 }; }
};

const saveSeenCounts = (counts) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(counts)); } catch {}
};

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const [totalCounts, setTotalCounts] = useState({ lostPending: 0, foundNew: 0, messages: 0 });
  const [seenCounts,  setSeenCounts]  = useState(loadSeenCounts);

  const fetchCounts = useCallback(async () => {
    try {
      const [lostRes, foundRes, msgRes] = await Promise.all([
        fetch(`${API_URL}/lost-items?status=pending`),
        fetch(`${API_URL}/found-items?status=pending`),
        fetch(`${API_URL}/messages/count`),
      ]);
      const lostData = await lostRes.json();
      const foundData = await foundRes.json();
      const msgData   = await msgRes.json();
      setTotalCounts({
        lostPending: Array.isArray(lostData)  ? lostData.length  : 0,
        foundNew:    Array.isArray(foundData) ? foundData.length : 0,
        messages:    typeof msgData?.count === 'number' ? msgData.count : 0,
      });
    } catch {}
  }, []);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 15000);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  useEffect(() => {
    const path    = location.pathname;
    const updated = { ...seenCounts };
    if (path.startsWith('/items/lost'))   updated.lostPending = totalCounts.lostPending;
    else if (path.startsWith('/items/found')) updated.foundNew = totalCounts.foundNew;
    else if (path.startsWith('/messaging'))   updated.messages = totalCounts.messages;
    if (JSON.stringify(updated) !== JSON.stringify(seenCounts)) {
      setSeenCounts(updated);
      saveSeenCounts(updated);
    }
  }, [location.pathname, totalCounts]); // eslint-disable-line react-hooks/exhaustive-deps

  const getBadgeCount = (item) => {
    if (!item.badgeKey) return 0;
    const total = totalCounts[item.badgeKey] || 0;
    const seen  = seenCounts[item.badgeKey]  || 0;
    const isOnThisPage = item.path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.path);
    if (isOnThisPage) return 0;
    return Math.max(0, total - seen);
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`lf-sidebar fixed lg:static inset-y-0 left-0 z-30 w-64 border-r lf-sidebar-border
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          overflow-y-auto dark:bg-gray-800 dark:border-gray-700 flex flex-col`}
      >
        {/* ── Logo header ── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b lf-sidebar-border dark:border-gray-700 flex-shrink-0">
          <img
            src="/logo.png"
            alt="Lost & Found"
            className="w-9 h-9 rounded-xl object-contain flex-shrink-0"
            style={{ boxShadow: '0 0 0 1.5px rgba(245,158,11,0.35), 0 4px 14px rgba(245,158,11,0.18)' }}
          />
          <div className="min-w-0">
            <h1 className="text-sm font-bold lf-text-primary dark:text-white leading-tight tracking-tight">
              Lost & Found
            </h1>
            <p className="text-[11px] lf-text-muted dark:text-gray-400 tracking-wide uppercase font-medium mt-0.5">
              Admin Dashboard
            </p>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav
          className="flex-1 mt-2 px-2.5 pb-4 space-y-0.5"
          role="navigation"
          aria-label="Main navigation"
        >
          {navItems.map((item) => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            const badgeCount = getBadgeCount(item);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-150 ${
                    isActive
                      ? 'lf-nav-active'
                      : 'lf-nav-default dark:text-gray-400 dark:hover:bg-gray-700/70 dark:hover:text-gray-100'
                  }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Icon — inherits text colour from nav class */}
                <span className={`flex-shrink-0 transition-transform duration-150 ${
                  isActive ? '' : 'group-hover:scale-110'
                }`}>
                  {item.icon}
                </span>

                <span className="flex-1 truncate">{item.label}</span>

                {badgeCount > 0 && (
                  <span className="flex-shrink-0 bg-red-500 text-white text-[10px] font-bold
                    rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* ── Footer version stamp ── */}
        <div className="px-5 py-3 border-t lf-sidebar-border dark:border-gray-700 flex-shrink-0">
          <p className="text-[10px] lf-text-muted dark:text-gray-500 font-medium tracking-wide">
            v1.0 · Lost & Found System
          </p>
        </div>
      </aside>
    </>
  );
}
