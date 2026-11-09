import { Router } from 'express';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SETTINGS_FILE = join(__dirname, '..', 'system-settings.json');

const defaultSettings = {
  unclaimedDays: 60,
  autoDelete: false,
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return { ...defaultSettings, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Settings load error:', e.message);
  }
  return { ...defaultSettings };
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    return true;
  } catch (e) {
    console.error('Settings save error:', e.message);
    return false;
  }
}

export function createSettingsRouter(client) {
  const router = Router();
  const reminderSettings = () => client.from('found_item_reminder_settings');
  const columns = 'enabled,delay_hours,message';
  const sendReminderError = (res, error, operation) => {
    const needsMigration = ['PGRST205', '42P01'].includes(error?.code);
    return res.status(503).json({
      error: needsMigration
        ? 'Found item reminders need database setup. Apply the reminder migration and try again.'
        : `Unable to ${operation} found item reminder settings. Please try again.`,
    });
  };

  router.get('/found-item-reminders', async (_req, res) => {
    try {
      const { data, error } = await reminderSettings().select(columns).eq('id', 1).single();
      if (error) throw error;
      res.set('Cache-Control', 'no-store').json(data);
    } catch (error) {
      sendReminderError(res, error, 'load');
    }
  });

  router.put('/found-item-reminders', async (req, res) => {
    const { enabled, delay_hours, message: input } = req.body || {};
    const message = typeof input === 'string' ? input.trim() : '';
    if (typeof enabled !== 'boolean' || !Number.isInteger(delay_hours) || delay_hours < 1 || delay_hours > 720) {
      return res.status(400).json({ error: 'Choose whether to enable reminders and enter a delay of 1 to 720 hours.' });
    }
    if (!message || message.length > 1000) {
      return res.status(400).json({ error: 'Enter a reminder message of 1 to 1,000 characters.' });
    }
    try {
      const { data, error } = await reminderSettings().update({ enabled, delay_hours, message })
        .eq('id', 1).select(columns).single();
      if (error) throw error;
      res.json(data);
    } catch (error) {
      sendReminderError(res, error, 'save');
    }
  });

  router.get('/', (_req, res) => {
    res.json(loadSettings());
  });

  router.put('/', (req, res) => {
    const current = loadSettings();
    const updated = { ...current, ...req.body };
    if (saveSettings(updated)) {
      res.json(updated);
    } else {
      res.status(500).json({ error: 'Failed to save settings' });
    }
  });

  return router;
}