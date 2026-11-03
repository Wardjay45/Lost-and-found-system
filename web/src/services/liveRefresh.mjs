import { notificationEvent } from './liveNotifications.mjs';

// Batch bursts and wait for the current reload before starting another one.
export function subscribeTableChanges(tables, refresh, { target = window, document = window.document, delayMs = 150 } = {}) {
  let timer, running = false, queued = false, disposed = false;
  const selected = new Set(Array.isArray(tables) ? tables : [tables]);
  const reload = async () => {
    timer = undefined;
    if (disposed || document.visibilityState !== 'visible') return;
    if (running) { queued = true; return; }
    running = true;
    try { await refresh({ background: true }); }
    catch { /* The page owns its error state; future events retry automatically. */ }
    finally {
      running = false;
      if (queued && !disposed) { queued = false; schedule(); }
    }
  };
  const schedule = () => { if (timer === undefined) timer = setTimeout(reload, delayMs); };
  const update = event => {
    const table = event.detail?.table;
    if (document.visibilityState === 'visible' && (table === 'all' || selected.has(table))) schedule();
  };
  target.addEventListener(notificationEvent, update);
  return () => { disposed = true; clearTimeout(timer); target.removeEventListener(notificationEvent, update); };
}
