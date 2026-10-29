export const notificationEvent = 'lf-notifications-changed';
export function notifyChange(table = 'all') {
  window.dispatchEvent(new CustomEvent(notificationEvent, { detail: { table } }));
}

// Fetch streaming allows the existing bearer header without putting tokens in URLs.
export function subscribeNotifications(onChange, { url, token, fetcher = fetch, retryMs = 3000 }) {
  const controller = new AbortController();
  let timer;
  const connect = async () => {
    let reader;
    try {
      const response = await fetcher(url, { headers: { Authorization: 'Bearer ' + token }, signal: controller.signal });
      if (!response.ok || !response.body) throw new Error('Notification stream unavailable');
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      while (!controller.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        let newline;
        while ((newline = pending.indexOf('\n')) !== -1) {
          const line = pending.slice(0, newline).trimEnd();
          pending = pending.slice(newline + 1);
          if (line.startsWith('data: ')) {
            try { onChange(JSON.parse(line.slice(6)).table); } catch { /* Ignore malformed events. */ }
          }
        }
      }
    } catch { /* Snapshot polling remains available during reconnects. */ }
    finally { reader?.releaseLock(); }
    if (!controller.signal.aborted) timer = setTimeout(connect, retryMs);
  };
  void connect();
  return () => { controller.abort(); clearTimeout(timer); };
}
