import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/AppContext';
import { useState, useEffect } from 'react';

export default function Header({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const { settings, toggleHighContrast, toggleDarkMode } = useAppSettings();
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    const handleClick = () => setShowProfile(false);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  return (
    <header className="lf-header border-b lf-header-border px-4 lg:px-6 py-3 shadow-sm dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-center justify-between">

        {/* Left — hamburger + page title */}
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSidebar(); }}
            className="lg:hidden p-2 rounded-lg lf-text-muted hover:lf-bg-hover transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <h2 className="text-base font-semibold lf-text-primary dark:text-white">
              {window.location.pathname === '/' ? 'Dashboard Overview' : ''}
            </h2>
          </div>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-1.5">

          {/* Dark mode toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleDarkMode(); }}
            className={`p-2 rounded-lg transition-colors ${
              settings.darkMode
                ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                : 'lf-text-muted hover:lf-bg-hover dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
            aria-label={settings.darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            title={settings.darkMode ? 'Light Mode' : 'Dark Mode'}
          >
            {settings.darkMode ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* High contrast toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleHighContrast(); }}
            className={`p-2 rounded-lg transition-colors ${
              settings.highContrast
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'lf-text-muted hover:lf-bg-hover dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
            aria-label="Toggle high contrast mode"
            title="High Contrast Mode"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>

          {/* Profile */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowProfile(!showProfile); }}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:lf-bg-hover dark:hover:bg-gray-700 transition-colors"
              aria-label="User menu"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
              >
                {user?.name?.charAt(0) || 'A'}
              </div>
              <span className="text-sm font-medium lf-text-primary dark:text-gray-300 hidden sm:block">{user?.name}</span>
            </button>

            {showProfile && (
              <div
                className="absolute right-0 mt-2 w-48 lf-dropdown rounded-xl shadow-xl border lf-dropdown-border z-50"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-3 border-b lf-dropdown-border">
                  <p className="text-sm font-semibold lf-text-primary dark:text-white">{user?.name}</p>
                  <p className="text-xs lf-text-muted dark:text-gray-400 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { setShowProfile(false); logout(); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-xl transition-colors font-medium"
                >
                  Logout
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
