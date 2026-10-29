import test from 'node:test';
import assert from 'node:assert/strict';
import { requestFeedback, feedbackDraftKey, createFeedbackDraftStore, nextFeedbackPrompt, formatRecoveryTime } from '../src/services/feedback.mjs';

test('feedback requests send the verified session and preserve actionable API errors', async () => {
  let request;
  const result = await requestFeedback('https://school.example/api/', '/recoveries', 'server-session', {}, async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => [] };
  });
  assert.deepEqual(result, []);
  assert.equal(request.url, 'https://school.example/api/feedback/recoveries');
  assert.equal(request.options.headers.Authorization, 'Bearer server-session');
  await assert.rejects(requestFeedback('https://school.example/api', '', 'supabase-direct'), error => error.code === 'GOOGLE_REAUTH_REQUIRED');
  await assert.rejects(requestFeedback('https://school.example/api', '', 'session', {}, async () => ({ ok: false, status: 403, json: async () => ({ error: 'Sign in with Google', code: 'GOOGLE_REAUTH_REQUIRED' }) })), error => error.code === 'GOOGLE_REAUTH_REQUIRED');
});

test('drafts are separated by owner and recovery; queued saves cannot resurrect a submitted draft', async () => {
  const values = new Map();
  const storage = { getItem: async key => values.get(key) || null, setItem: async (key, value) => { await new Promise(resolve => setImmediate(resolve)); values.set(key, value); }, removeItem: async key => values.delete(key) };
  const key = feedbackDraftKey(1, 'recovery', 'one');
  assert.notEqual(key, feedbackDraftKey(2, 'recovery', 'one'));
  assert.notEqual(key, feedbackDraftKey(1, 'general'));
  const draft = createFeedbackDraftStore(storage, key);
  const content = { rating: 4, comment: 'Helpful', request_id: 'same-retry-id' };
  await draft.save(content);
  assert.deepEqual(await draft.load(), content);
  const save = draft.save({ ...content, comment: 'Latest' });
  const clear = draft.clear();
  await Promise.all([save, clear]);
  assert.equal(await draft.load(), null);
});

test('optional prompts skip submitted or dismissed recoveries and do not rely on item status alone', () => {
  const returns = [{ id: 'old', recovered_at: '2026-10-01', feedback: null }, { id: 'new', recovered_at: '2026-10-02', feedback: null }];
  assert.equal(nextFeedbackPrompt(returns, []).id, 'new');
  assert.equal(nextFeedbackPrompt(returns, ['new']).id, 'old');
  assert.equal(nextFeedbackPrompt(returns.map(record => ({ ...record, feedback: { rating: 5 } })), []), null);
  assert.equal(nextFeedbackPrompt([], []), null);
  assert.equal(formatRecoveryTime(null), 'Not available');
  assert.equal(formatRecoveryTime(48), '2 days');
});
