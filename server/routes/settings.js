import { Router } from 'express';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

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

// GET /api/settings
router.get('/', (req, res) => {
  res.json(loadSettings());
});

// PUT /api/settings
router.put('/', (req, res) => {
  const current = loadSettings();
  const updated = { ...current, ...req.body };
  if (saveSettings(updated)) {
    res.json(updated);
  } else {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

export default router;