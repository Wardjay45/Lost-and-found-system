// Keep the AI service credential exclusively on the two hosted servers.
export function aiFetch(url, options = {}) {
  const base = new URL(process.env.AI_SERVER_URL || 'http://localhost:8000');
  const target = new URL(url);
  if (target.origin !== base.origin) throw new Error('Unexpected AI service origin');
  const headers = new Headers(options.headers);
  if (process.env.AI_SERVICE_KEY) headers.set('Authorization', 'Bearer ' + process.env.AI_SERVICE_KEY);
  return fetch(url, { ...options, headers, signal: options.signal || AbortSignal.timeout(280000) });
}
