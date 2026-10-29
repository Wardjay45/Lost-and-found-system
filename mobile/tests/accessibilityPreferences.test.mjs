import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreferenceStore } from '../src/services/accessibilityPreferences.mjs';

test('accessibility choices survive a new app session without reading them aloud', async () => {
  let saved = null;
  const storage = { getItem: async () => saved, setItem: async (_, value) => { saved = value; } };
  const first = createPreferenceStore(storage);
  await first.load();
  for (const [key, value] of Object.entries({ fontSize: 'xlarge', highContrast: true, ttsEnabled: true, largeTouchTargets: true, reduceMotion: true })) first.change(key, value);
  await first.flush();
  const second = createPreferenceStore(storage);
  const restored = await second.load();
  assert.deepEqual(restored, { fontSize: 'xlarge', highContrast: true, ttsEnabled: true, largeTouchTargets: true, reduceMotion: true });
});

test('slow hydration cannot overwrite a choice made after launch and preserves other saved choices', async () => {
  let finishRead, saved;
  const store = createPreferenceStore({ getItem: () => new Promise(resolve => { finishRead = resolve; }), setItem: async (_, value) => { saved = JSON.parse(value); } });
  const pending = store.load();
  store.change('fontSize', 'large');
  finishRead(JSON.stringify({ fontSize: 'small', highContrast: true }));
  assert.equal((await pending).fontSize, 'large');
  await store.flush();
  assert.equal(saved.fontSize, 'large');
  assert.equal(saved.highContrast, true);
});

test('corrupt preferences and storage errors fall back safely', async () => {
  const store = createPreferenceStore({ getItem: async () => '{broken', setItem: async () => { throw Error('disk'); } });
  assert.equal((await store.load()).fontSize, 'medium');
  store.change('fontSize', 'invalid');
  store.change('highContrast', 'false');
  store.change('reduceMotion', true);
  await store.flush();
  assert.equal(store.snapshot().fontSize, 'medium');
  assert.equal(store.snapshot().highContrast, false);
  assert.equal(store.snapshot().reduceMotion, true);
});
