// One authenticated long poll per active app, shared by all visible consumers.
export function createLiveSync({ getApiUrl, getToken, fetcher = fetch, onChange, onStatus = () => {}, retryMs = 3000, reconcileMs = 15000 }) {
  let stopped = true, controller, retry, reconcile, generation = 0;
  async function poll(cursor = '', session = generation) {
    if (stopped || session !== generation) return;
    const request = new AbortController(); controller = request;
    const timeout = setTimeout(() => request.abort(), 28000);
    let next = cursor;
    const current = () => !stopped && session === generation;
    try {
      const token = getToken();
      if (!token) throw new Error('Sign in required');
      const base = (await getApiUrl()).replace(/\/$/, '');
      if (!current()) return;
      const response = await fetcher(base + '/mobile/changes?cursor=' + encodeURIComponent(cursor), { headers: { Authorization: 'Bearer ' + token }, signal: request.signal });
      const data = await response.json();
      if (!response.ok || typeof data.cursor !== 'string' || !Array.isArray(data.tables)) throw new Error('Synchronization unavailable');
      if (!current()) return;
      next = data.cursor; onStatus(data.realtime ? 'live' : 'reconnecting');
      if (data.tables.length) onChange(data.tables);
      retry = setTimeout(() => poll(next, session), data.realtime ? 100 : retryMs);
    } catch {
      if (current()) { onStatus('reconnecting'); retry = setTimeout(() => poll(next, session), retryMs); }
    } finally { clearTimeout(timeout); }
  }
  return {
    start() {
      if (!stopped) return;
      stopped = false; generation++; onStatus('connecting'); onChange(['all']); void poll();
      reconcile = setInterval(() => { if (!stopped) onChange(['all']); }, reconcileMs);
    },
    stop() { stopped = true; generation++; controller?.abort(); clearTimeout(retry); clearInterval(reconcile); onStatus('paused'); },
  };
}

// Coalesce bursts and serialize snapshot reads so older responses cannot win.
export function createRefreshQueue(refresh) {
  let stopped = false, pending = false, again = false;
  async function run() {
    if (stopped) return;
    if (pending) { again = true; return; }
    pending = true;
    try { do { again = false; await refresh(); } while (again && !stopped); }
    catch { /* The data owner presents its existing error state. */ }
    finally { pending = false; }
  }
  return { run, stop() { stopped = true; again = false; } };
}
