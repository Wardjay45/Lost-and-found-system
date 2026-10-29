import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import request from '../services/api';
import { notificationEvent, notifyChange, subscribeNotifications } from '../services/liveNotifications.mjs';
import { acknowledgeRows, parseReadState, unreadRows } from '../../../shared/notifications.mjs';

import Context from './notificationState';
import { loadNotificationReadState, notificationReadKey } from '../services/notificationReadState.mjs';
const empty = { lost: [], found: [], messages: [] };
export function NotificationProvider({ children }) {
  const { user } = useAuth();
  // A new provider instance on account changes prevents old requests/read state leaking.
  return <AccountNotifications key={notificationReadKey(user?.id ?? user?.email ?? 'guest')} user={user}>{children}</AccountNotifications>;
}
function AccountNotifications({ user, children }) {
  const account = user?.id ?? user?.email ?? 'guest';
  const key = notificationReadKey(account);
  const [read, setRead] = useState(() => {
    try { return loadNotificationReadState(localStorage, account); } catch { return {}; }
  });
  const readRef = useRef(read);
  const [snapshot, setSnapshot] = useState(empty);
  const [error, setError] = useState('');
  const markRead = useCallback((kind, rows) => {
    if (document.visibilityState !== 'visible' || !rows?.length) return;
    const before = readRef.current;
    const ids = acknowledgeRows(before[kind], rows);
    if (ids.length === (before[kind]?.length || 0)) return;
    const next = { ...before, [kind]: ids };
    readRef.current = next;
    setRead(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Keep session receipts. */ }
  }, [key]);
  useEffect(() => {
    let alive = true, running = false, queued = false;
    const refresh = async () => {
      if (running) { queued = true; return; }
      running = true;
      do {
        queued = false;
        try {
          const next = await request('/notifications');
          if (alive) { setSnapshot(next); setError(''); }
        } catch (err) { if (alive) setError(err.message); }
      } while (alive && queued);
      running = false;
    };
    const onVisible = () => { if (document.visibilityState === 'visible') notifyChange(); };
    const onStorage = event => {
      if (event.key === key) { const next = parseReadState(event.newValue); readRef.current = next; setRead(next); }
    };
    window.addEventListener(notificationEvent, refresh);
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', onVisible);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    const stop = subscribeNotifications(notifyChange, {
      url: (import.meta.env.VITE_API_URL || '/api') + '/notifications/stream',
      token: localStorage.getItem('token'),
    });
    void refresh();
    const timer = setInterval(onVisible, 10000);
    return () => {
      alive = false; stop(); clearInterval(timer);
      window.removeEventListener(notificationEvent, refresh);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', onVisible);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [key]);
  const unreadMessages = unreadRows(snapshot.messages, read.messages);
  const unreadReports = {
    lost: new Set(unreadRows(snapshot.lost, read.lost).map(row => String(row.id))),
    found: new Set(unreadRows(snapshot.found, read.found).map(row => String(row.id))),
  };
  const counts = { lost: unreadReports.lost.size, found: unreadReports.found.size, messages: unreadMessages.length };
  // A report row may load before the notification snapshot. Its saved receipt
  // determines whether it was viewed; a pending snapshot must not label it viewed.
  const viewedReports = { lost: new Set(read.lost || []), found: new Set(read.found || []) };
  const isUnread = (kind, id) => Boolean(viewedReports[kind] && id != null && !viewedReports[kind].has(String(id)));
  const conversationUnread = id => unreadMessages.filter(row => String(row.conversation_id) === String(id)).length;
  return <Context.Provider value={{ counts, markRead, conversationUnread, isUnread, error }}>{children}</Context.Provider>;
}
