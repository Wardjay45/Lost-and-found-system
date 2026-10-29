const defaults = { fontSize: 'medium', highContrast: false, ttsEnabled: false, largeTouchTargets: false, reduceMotion: false };
const storageKey = 'mobile-accessibility-v1';
function valid(key, value) {
  return key === 'fontSize' ? ['small', 'medium', 'large', 'xlarge'].includes(value) : key in defaults && typeof value === 'boolean';
}

// Serialize writes and merge hydration with choices made while storage is loading.
export function createPreferenceStore(storage) {
  let values = { ...defaults }, loading, writes = Promise.resolve();
  const edited = new Set();
  const snapshot = () => ({ ...values });
  const load = () => loading ||= (async () => {
    try {
      const saved = JSON.parse(await storage.getItem(storageKey));
      for (const key of Object.keys(defaults)) if (!edited.has(key) && valid(key, saved?.[key])) values[key] = saved[key];
    } catch { /* Storage unavailable or old/corrupt preferences: keep safe defaults. */ }
    return snapshot();
  })();
  return { load, snapshot,
    change(key, value) {
      if (!valid(key, value)) return;
      values[key] = value;
      edited.add(key);
      writes = writes.then(async () => { await load(); await storage.setItem(storageKey, JSON.stringify(values)); }).catch(() => {});
    },
    flush: () => writes,
  };
}
