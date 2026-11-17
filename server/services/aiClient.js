// Keep the AI service credential exclusively on the two hosted servers.
export function aiFetch(url, options = {}) {
  const base = new URL(process.env.AI_SERVER_URL || 'http://localhost:8000');
  const target = new URL(url);
  if (target.origin !== base.origin) throw new Error('Unexpected AI service origin');
  const headers = new Headers(options.headers);
  if (process.env.AI_SERVICE_KEY) headers.set('Authorization', 'Bearer ' + process.env.AI_SERVICE_KEY);
  return fetch(url, { ...options, headers, signal: options.signal || AbortSignal.timeout(280000) });
}

// Hosting errors (including Vercel's 413) can be plain text rather than JSON.
export async function readAiJson(response) {
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const message = response.status === 413
      ? 'The matching request contains too much photo data. Please try again with smaller photo batches.'
      : !response.ok
        ? (typeof data?.detail === 'string' ? data.detail : `The AI service is unavailable (HTTP ${response.status}). Please try again.`)
        : 'The AI service returned an invalid response. Please try again.';
    const error = new Error(message);
    error.status = 502;
    error.code = response.status === 413 ? 'AI_PAYLOAD_TOO_LARGE' : 'AI_SERVICE_ERROR';
    throw error;
  }
  return data;
}
