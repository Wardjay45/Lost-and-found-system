import { useEffect, useState } from 'react';
import { settingsApi } from '../../services/api';

const defaultSettings = {
  enabled: false,
  delay_hours: 24,
  message: 'Please bring the item you reported to the OSDS office so staff can verify ownership and return it to its rightful owner.',
};
const delayPresets = [8, 24];

export default function FoundItemRemindersSettings() {
  const [settings, setSettings] = useState(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const form = settings ?? defaultSettings;
  const preview = form.message.trim();

  useEffect(() => {
    const controller = new AbortController();
    settingsApi.getFoundItemReminders({ signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setSettings(data); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [loadAttempt]);

  function update(key, value) {
    setSettings(current => ({ ...current, [key]: value }));
    setSaved(false);
    setError('');
  }

  async function save(event) {
    event.preventDefault();
    if (!settings || saving) return;
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      setSettings(await settingsApi.saveFoundItemReminders({ ...settings, delay_hours: Number(settings.delay_hours) }));
      setSaved(true);
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="ui-panel settings-section" id="found-item-reminders" aria-labelledby="found-item-reminders-title">
      <h2 id="found-item-reminders-title">Found item reminders</h2>
      <p>Send one message to the finder in the mobile app if OSDS receipt is still pending.</p>
      {error && (
        <div className="ui-alert ui-alert-error mt-4">
          <span role="alert">{error}</span>
          {!settings && (
            <button type="button" className="ui-button ui-button-secondary shrink-0"
              onClick={() => { setError(''); setLoadAttempt(attempt => attempt + 1); }}>Try again</button>
          )}
        </div>
      )}
      {!settings && <p role="status">{error ? 'Showing defaults. Connect the reminder settings to make changes.' : 'Loading reminder settings…'}</p>}
      <form onSubmit={save}>
        <fieldset className="min-w-0 space-y-4 disabled:opacity-70" disabled={!settings || saving}>
          <legend className="sr-only">Automatic reminder settings</legend>
          <div className="setting-row">
            <div>
              <label htmlFor="found-reminders-enabled"><strong>Automatic reminders</strong></label>
              <p id="found-reminders-hint">Turning this on also includes pending reports that already meet the delay.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs lf-text-muted" aria-hidden="true">{form.enabled ? 'On' : 'Off'}</span>
              <input id="found-reminders-enabled" className="ui-switch" type="checkbox" role="switch"
                aria-describedby="found-reminders-hint" checked={form.enabled}
                onChange={event => update('enabled', event.target.checked)} />
            </div>
          </div>
          <div>
            <label htmlFor="found-reminders-delay" className="block text-sm font-medium mb-2">Custom delay (hours)</label>
            <div className="flex flex-wrap items-center gap-2">
              <input id="found-reminders-delay" className="ui-input w-28 max-w-full" type="number"
                min={1} max={720} step={1} required value={form.delay_hours} aria-describedby="found-reminders-delay-hint"
                onChange={event => update('delay_hours', event.target.value)} />
              <div className="segmented-control" role="group" aria-label="Common reminder delays">
                {delayPresets.map(hours => (
                  <button key={hours} type="button" aria-pressed={Number(form.delay_hours) === hours}
                    onClick={() => update('delay_hours', hours)}>{hours} hours</button>
                ))}
              </div>
            </div>
            <p id="found-reminders-delay-hint" className="mt-2 text-xs lf-text-muted">Count from the report submission time. Enter 1 to 720 hours.</p>
          </div>
          <div>
            <label htmlFor="found-reminders-message" className="block text-sm font-medium mb-2">Reminder message template</label>
            <textarea id="found-reminders-message" className="ui-input w-full" rows={5} required maxLength={1000}
              value={form.message} onChange={event => update('message', event.target.value)} />
          </div>
          <section className="rounded-lg border border-[var(--lf-30-border)] p-3" aria-labelledby="found-reminders-preview">
            <h3 id="found-reminders-preview" className="text-xs font-medium lf-text-muted">Message preview</h3>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{preview || 'Enter a reminder message to preview it.'}</p>
            {preview && <p className="mt-3 text-sm">Found report: FOUND-0001</p>}
          </section>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="ui-button ui-button-primary">{saving ? 'Saving…' : 'Save reminder settings'}</button>
            {saved && <span role="status" className="text-sm lf-text-muted">Reminder settings saved.</span>}
          </div>
        </fieldset>
      </form>
    </section>
  );
}
