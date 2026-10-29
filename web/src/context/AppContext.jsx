import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const SETTINGS_KEY = 'lost-found-admin-settings';

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

const defaultSettings = {
  unclaimedDays: 60,
  autoDelete: false,
  highContrast: false,
  darkMode: false,
  textSize: 'normal',
  emailNotifications: true,
  privacyMasking: true,
  colorTheme: 'lavender',   // NEW: colour theme key
};

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const saved = loadSettings();
    return { ...defaultSettings, ...(saved || {}) };
  });

  const toggleHighContrast = useCallback(() => {
    setSettings(prev => {
      const next = { ...prev, highContrast: !prev.highContrast };
      saveSettings(next);
      return next;
    });
  }, []);

  const toggleDarkMode = useCallback(() => {
    setSettings(prev => {
      const next = { ...prev, darkMode: !prev.darkMode };
      saveSettings(next);
      return next;
    });
  }, []);

  const setTextSize = useCallback((size) => {
    setSettings(prev => {
      const next = { ...prev, textSize: size };
      saveSettings(next);
      return next;
    });
  }, []);

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      return next;
    });
  }, []);

  const setColorTheme = useCallback((theme) => {
    setSettings(prev => {
      const next = { ...prev, colorTheme: theme };
      saveSettings(next);
      return next;
    });
  }, []);

  // Apply dark mode class to <html>
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  // Apply colour theme as a data-attribute on <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.colorTheme || 'lavender');
  }, [settings.colorTheme]);

  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', Boolean(settings.highContrast));
    document.documentElement.setAttribute('data-text-size', settings.textSize || 'normal');
  }, [settings.highContrast, settings.textSize]);

  return (
    <AppContext.Provider value={{ settings, toggleHighContrast, toggleDarkMode, setTextSize, updateSetting, setColorTheme }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppSettings() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppSettings must be used within AppProvider');
  return ctx;
}