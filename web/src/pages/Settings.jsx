import { useAppSettings } from '../context/AppContext';
import AppIcon from '../components/common/AppIcon';
import { PageHeader } from '../components/common/UI';
const themes = [
  {key:'lavender', label:'Lavender'},
  {key:'midnight', label:'Midnight'},
  {key:'ocean', label:'Ocean'},
  {key:'forest', label:'Forest'},
  {key:'rose', label:'Rose'},
  {key:'slate', label:'Slate'},
];
function SettingRow({ title, description, children }) {
  return <div className="setting-row"><div><strong>{title}</strong><p>{description}</p></div>{children}</div>;
}
export default function Settings() {
  const { settings, updateSetting, toggleHighContrast, toggleDarkMode, setTextSize, setColorTheme } = useAppSettings();
  return <div className="page page-settings"><PageHeader title="Settings" description="Make the workspace work for you. Preferences are saved automatically in this browser." />
    <div className="settings-layout"><nav className="settings-nav" aria-label="Settings sections"><a href="#appearance">Appearance</a><a href="#reporting">Reporting</a><a href="#notifications">Notifications</a><a href="#accessibility">Accessibility</a></nav>
      <div className="settings-sections">
        <section className="ui-panel settings-section" id="appearance"><h2>Appearance</h2><p>Choose a color theme for your background, navigation, and accents. Use dark mode below for darker surfaces.</p><div className="theme-options" role="group" aria-label="Color theme">{themes.map(theme => <button type="button" className="theme-option" key={theme.key} onClick={() => setColorTheme(theme.key)} aria-pressed={settings.colorTheme === theme.key}><div aria-hidden="true" data-theme={theme.key} className={`theme-preview${settings.darkMode ? ' dark' : ''}`}><span className="theme-preview-sidebar" /><span className="theme-preview-content"><span className="theme-preview-accent" /><span className="theme-preview-line" /><span className="theme-preview-line" /></span></div><strong>{theme.label}</strong>{settings.colorTheme === theme.key && <AppIcon name="check" />}</button>)}</div>
          <SettingRow title="Dark mode" description="Use darker surfaces for comfortable viewing."><input className="ui-switch" type="checkbox" role="switch" aria-label="Dark mode" checked={settings.darkMode} onChange={toggleDarkMode} /></SettingRow>
        </section>
        <section className="ui-panel settings-section" id="reporting"><h2>Reporting</h2><SettingRow title="Unclaimed item threshold" description="Include found reports older than this period in the unclaimed list."><select className="ui-input" aria-label="Unclaimed item threshold" value={settings.unclaimedDays} onChange={e => updateSetting('unclaimedDays', Number(e.target.value))}><option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option></select></SettingRow></section>
        <section className="ui-panel settings-section" id="notifications"><h2>Notifications</h2><SettingRow title="Email notifications" description="Your preference for match and report updates."><input className="ui-switch" type="checkbox" role="switch" aria-label="Email notifications" checked={settings.emailNotifications} onChange={e => updateSetting('emailNotifications',e.target.checked)} /></SettingRow><div className="mt-5"><label htmlFor="match-template" className="block text-sm font-medium mb-2">Match notification template</label><p className="text-xs lf-text-muted mb-3">Available variables: {'{userName}'}, {'{itemDescription}'}, {'{similarity}'}</p><textarea id="match-template" className="ui-input w-full" rows={5} value={settings.matchTemplate || 'Our system has found an item that may match your lost report ({similarity}% similarity). Please visit the Campus Lost and Found Office within three (3) days and bring a valid school ID. The administrator will verify ownership before the item is released.'} onChange={e => updateSetting('matchTemplate',e.target.value)} /></div></section>
        <section className="ui-panel settings-section" id="accessibility"><h2>Accessibility</h2><SettingRow title="High contrast" description="Increase contrast for text, borders, and controls."><input className="ui-switch" type="checkbox" role="switch" aria-label="High contrast" checked={settings.highContrast} onChange={toggleHighContrast} /></SettingRow><SettingRow title="Text size" description="Adjust text across the workspace."><div className="segmented-control" role="group" aria-label="Text size">{['normal','large','xlarge'].map(size => <button type="button" key={size} aria-pressed={settings.textSize === size} onClick={() => setTextSize(size)}>{size === 'xlarge' ? 'Extra large' : size === 'large' ? 'Large' : 'Normal'}</button>)}</div></SettingRow></section>
        <div className="flex items-center justify-between gap-4"><span className="text-xs lf-text-muted"><AppIcon name="check" /> Changes save automatically</span><button type="button" className="ui-button ui-button-secondary" onClick={() => { updateSetting('unclaimedDays',60); updateSetting('emailNotifications',true); setColorTheme('lavender'); }}>Reset defaults</button></div>
      </div>
    </div>
  </div>;
}
