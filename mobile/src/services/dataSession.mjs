let sessionToken = null;
export function setDataSession(token) { sessionToken = typeof token === 'string' ? token : null; }
export function getDataSession() { return sessionToken; }

export function createAuthenticatedDataFetch({ getToken = getDataSession, getApiUrl, fetcher = (...args) => fetch(...args) }) {
  return async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (!url.pathname.startsWith('/rest/v1/')) return fetcher(input, options);
    const token = getToken();
    if (!token) return new Response(JSON.stringify({ code: 'SESSION_REQUIRED', message: 'Sign in again to access your records.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    const table = url.pathname.slice('/rest/v1/'.length);
    const headers = new Headers(options.headers || (typeof input === 'object' ? input.headers : undefined));
    headers.set('Authorization', 'Bearer ' + token);
    headers.delete('apikey');
    return fetcher((await getApiUrl()).replace(/\/$/, '') + '/mobile/data/' + table + url.search, { ...options, headers });
  };
}
