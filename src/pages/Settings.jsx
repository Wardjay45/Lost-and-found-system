import { useAppSettings } from '../context/AppContext';

const COLOR_THEMES = [
  {
    key: 'lavender',
    label: 'Lavender',
    desc: 'Soft purple-tinted default',
    swatch60: '#EAE7F5',
    swatch30: '#DDD8EF',
    swatch10: '#F59E0B',
  },
  {
    key: 'midnight',
    label: 'Midnight',
    desc: 'Deep navy dark feel',
    swatch60: '#1C1F2E',
    swatch30: '#141622',
    swatch10: '#F59E0B',
  },
  {
    key: 'ocean',
    label: 'Ocean',
    desc: 'Cool teal-blue tones',
    swatch60: '#E6F3F7',
    swatch30: '#D2EAF0',
    swatch10: '#0EA5E9',
  },
  {
    key: 'forest',
    label: 'Forest',
    desc: 'Earthy green surfaces',
    swatch60: '#E6F3EC',
    swatch30: '#D1EAD9',
    swatch10: '#10B981',
  },
  {
    key: 'rose',
    label: 'Rose',
    desc: 'Warm pink blush',
    swatch60: '#F7EEF3',
    swatch30: '#EED9E6',
    swatch10: '#EC4899',
  },
  {
    key: 'slate',
    label: 'Slate',
    desc: 'Clean neutral minimal',
    swatch60: '#ECEEF2',
    swatch30: '#DDE0E8',
    swatch10: '#6366F1',
  },
];

export default function Settings() {
  const { settings, updateSetting, toggleHighContrast, setTextSize, setColorTheme } = useAppSettings();

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold lf-text-primary dark:text-white mb-2">Settings & Configuration</h1>
      <p className="lf-text-muted dark:text-gray-400 mb-6">Manage system settings and preferences</p>

      <div className="space-y-6">

        {/* ── Colour Theme ── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="font-semibold lf-text-primary dark:text-white mb-1">Colour Theme</h3>
          <p className="text-xs lf-text-muted dark:text-gray-400 mb-5">
            Choose a colour palette for the dashboard. Applies the 60/30/10 rule — background · surfaces · accent.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {COLOR_THEMES.map((theme) => {
              const isActive = (settings.colorTheme || 'lavender') === theme.key;
              return (
                <button
                  key={theme.key}
                  onClick={() => setColorTheme(theme.key)}
                  className={`relative flex flex-col gap-2 p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                    isActive
                      ? 'border-amber-400 shadow-md shadow-amber-200/40 dark:shadow-amber-900/30'
                      : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                  style={{
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))'
                      : 'var(--lf-30)',
                  }}
                >
                  {/* Colour swatches — 60 / 30 / 10 */}
                  <div className="flex gap-1.5 items-center">
                    <span
                      className="w-8 h-8 rounded-lg border border-black/10 flex-shrink-0"
                      style={{ background: theme.swatch60 }}
                      title="60%"
                    />
                    <span
                      className="w-5 h-8 rounded-lg border border-black/10 flex-shrink-0"
                      style={{ background: theme.swatch30 }}
                      title="30%"
                    />
                    <span
                      className="w-3 h-8 rounded-lg border border-black/10 flex-shrink-0"
                      style={{ background: theme.swatch10 }}
                      title="10%"
                    />
                  </div>

                  <div>
                    <p className="text-sm font-semibold lf-text-primary dark:text-white leading-tight">{theme.label}</p>
                    <p className="text-xs lf-text-muted dark:text-gray-400 leading-snug mt-0.5">{theme.desc}</p>
                  </div>

                  {/* Active check */}
                  {isActive && (
                    <span
                      className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ background: '#F59E0B' }}
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── System Settings ── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="font-semibold lf-text-primary dark:text-white mb-4">System Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium lf-text-primary dark:text-white">Unclaimed Items Threshold</p>
                <p className="text-xs lf-text-muted dark:text-gray-400">Found items older than this many days are marked as "Unclaimed"</p>
              </div>
              <select
                value={settings.unclaimedDays}
                onChange={(e) => updateSetting('unclaimedDays', Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 lf-text-primary dark:text-white focus:ring-2 focus:ring-amber-400 outline-none"
                style={{ background: 'var(--lf-60)' }}
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Notification Settings ── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="font-semibold lf-text-primary dark:text-white mb-4">Email & Notification Templates</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium lf-text-primary dark:text-white">Email Notifications</p>
                <p className="text-xs lf-text-muted dark:text-gray-400">Send email alerts for new matches and updates</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={settings.emailNotifications}
                  onChange={(e) => updateSetting('emailNotifications', e.target.checked)}
                />
                <div className="w-9 h-5 bg-gray-200 dark:bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
              </label>
            </div>
            <div className="p-4 rounded-lg" style={{ background: 'var(--lf-hover)' }}>
              <label className="block text-sm font-medium lf-text-primary dark:text-gray-300 mb-2">Match Notification Template</label>
              <p className="text-xs lf-text-muted dark:text-gray-400 mb-2">
                Available variables: {'{userName}'}, {'{itemDescription}'}, {'{similarity}'}
              </p>
              <textarea
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700 lf-text-primary dark:text-white focus:ring-2 focus:ring-amber-400 outline-none resize-none"
                style={{ background: 'var(--lf-60)', borderColor: 'var(--lf-30-border)' }}
                rows={3}
                value={settings.matchTemplate || 'Our system has found an item that may match your lost report ({similarity}% similarity). Please visit the Campus Lost and Found Office within three (3) days and bring a valid school ID. The administrator will verify ownership before the item is released.'}
                onChange={(e) => updateSetting('matchTemplate', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Accessibility Settings ── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="font-semibold lf-text-primary dark:text-white mb-4">Accessibility Features</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium lf-text-primary dark:text-white">High Contrast Mode</p>
                <p className="text-xs lf-text-muted dark:text-gray-400">Enhance visual contrast for better readability</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={settings.highContrast} onChange={toggleHighContrast} />
                <div className="w-9 h-5 bg-gray-200 dark:bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-amber-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium lf-text-primary dark:text-white">Text Size</p>
                <p className="text-xs lf-text-muted dark:text-gray-400">Adjust text size for better readability</p>
              </div>
              <div className="flex gap-2">
                {['normal', 'large', 'xlarge'].map(size => (
                  <button
                    key={size}
                    onClick={() => setTextSize(size)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      settings.textSize === size
                        ? 'text-white shadow-sm'
                        : 'dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                    style={
                      settings.textSize === size
                        ? { background: 'var(--lf-10)', color: settings.colorTheme === 'midnight' ? '#111' : '#fff' }
                        : { background: 'var(--lf-hover)', color: 'var(--lf-text-primary)' }
                    }
                  >
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex justify-end gap-3 pb-6">
          <button
            className="px-6 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--lf-hover)', color: 'var(--lf-text-primary)' }}
            onClick={() => {
              updateSetting('unclaimedDays', 60);
              updateSetting('emailNotifications', true);
              setColorTheme('lavender');
            }}
          >
            Reset to Defaults
          </button>
          <button
            className="px-6 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ background: 'var(--lf-10)', color: settings.colorTheme === 'midnight' ? '#111' : '#fff' }}
          >
            Save Settings
          </button>
        </div>

      </div>
    </div>
  );
}