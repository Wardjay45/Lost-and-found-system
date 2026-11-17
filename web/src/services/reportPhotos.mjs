// Deduplicate repeated cards within a signed-in session. Never persist photos
// in browser storage, and discard failed requests so a remount can retry.
export function createReportPhotoLoader(request, getSession = () => localStorage.getItem('token') || '') {
  const cache = new Map();
  let session;
  return endpoint => {
    if (!/^\/ai\/report-photo\/(lost|found)\/[1-9]\d*\?v=/.test(endpoint)) return Promise.reject(new Error('Invalid report photo endpoint.'));
    const current = getSession();
    if (session !== current) { cache.clear(); session = current; }
    const existing = cache.get(endpoint);
    if (existing && existing.expires > Date.now()) return existing.promise;
    const entry = { expires: Date.now() + 5 * 60 * 1000 };
    entry.promise = request(endpoint).then(data => data.image || '').catch(error => {
      if (cache.get(endpoint) === entry) cache.delete(endpoint);
      throw error;
    });
    cache.set(endpoint, entry);
    while (cache.size > 64) cache.delete(cache.keys().next().value);
    return entry.promise;
  };
}
