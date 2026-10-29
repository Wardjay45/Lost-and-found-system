import test from 'node:test';
import assert from 'node:assert/strict';
import { aiFetch } from '../services/aiClient.js';

test('AI key stays on the configured server origin and preserves request data', async () => {
  const previous = { url: process.env.AI_SERVER_URL, key: process.env.AI_SERVICE_KEY, fetch: globalThis.fetch };
  process.env.AI_SERVER_URL = 'https://ai.example.invalid'; process.env.AI_SERVICE_KEY = 'isolated-ai-key'; let sent;
  globalThis.fetch = async (url, options) => { sent = { url, options }; return { ok: true }; };
  try {
    await aiFetch('https://ai.example.invalid/embedding/text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"text":"cube"}' });
    assert.equal(sent.options.headers.get('Authorization'), 'Bearer isolated-ai-key'); assert.equal(sent.options.body, '{"text":"cube"}');
    assert.throws(() => aiFetch('https://other.example.invalid/embedding/text'), /Unexpected/);
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [key, value] of [['AI_SERVER_URL', previous.url], ['AI_SERVICE_KEY', previous.key]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
