export async function requestFeedback(apiUrl, path, token, options = {}, fetcher = fetch) {
  if (!token || token === 'supabase-direct') throw Object.assign(new Error('Sign in with your linked school Google account to leave feedback.'), { code: 'GOOGLE_REAUTH_REQUIRED' });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetcher(`${apiUrl.replace(/\/+$/, '')}/feedback${path}`, {
      method: options.method || 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}), signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error || 'Unable to save feedback. Try again.'), { status: response.status, code: data.code });
    return data;
  } catch (error) {
    if (error.status) throw error;
    throw new Error('Unable to reach the feedback server. Your draft is kept; check your connection and try again.');
  } finally { clearTimeout(timeout); }
}

export const feedbackDraftKey = (userId, kind, recoveryId) => `feedback-draft:${userId}:${kind}:${recoveryId || 'general'}`;

export function createFeedbackDraftStore(storage, key) {
  let queue = Promise.resolve();
  function run(action) { queue = queue.catch(() => {}).then(action); return queue; }
  return {
    load: () => run(async () => {
      const saved = await storage.getItem(key);
      if (!saved) return null;
      try { return JSON.parse(saved); } catch { return null; }
    }),
    save: draft => run(() => storage.setItem(key, JSON.stringify(draft))),
    clear: () => run(() => storage.removeItem(key)),
  };
}

export function nextFeedbackPrompt(recoveries, dismissed) {
  return [...recoveries].filter(record => !record.feedback && !dismissed.includes(record.id))
    .sort((first, second) => Date.parse(second.recovered_at) - Date.parse(first.recovered_at))[0] || null;
}

export function formatRecoveryTime(hours) {
  if (hours === null || hours === undefined || !Number.isFinite(hours) || hours < 0) return 'Not available';
  if (hours < 1) return 'Less than 1 hour';
  const value = Math.round((hours < 24 ? hours : hours / 24) * 10) / 10;
  return `${value} ${hours < 24 ? value === 1 ? 'hour' : 'hours' : value === 1 ? 'day' : 'days'}`;
}
