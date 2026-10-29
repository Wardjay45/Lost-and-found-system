import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import supabase from '../config/supabase';
import { loadMessageConversation } from '../services/messageNotifications.mjs';
import { acknowledgeRows, incomingMessages, parseReadState, unreadRows } from '../../../shared/notifications.mjs';

const MessageBadgeContext = createContext();
export function MessageBadgeProvider({ children }) {
  const { user } = useAuth();
  return <AccountMessageBadge key={user?.id ?? user?.email ?? 'guest'} user={user}>{children}</AccountMessageBadge>;
}
function AccountMessageBadge({ children, user }) {
  const storageKey = 'lf-message-read-v2:' + (user?.id ?? user?.email ?? 'guest');
  const [snapshot, setSnapshot] = useState({ conversationId: null, messages: [] });
  const [seen, setSeen] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(Boolean(user));
  const [connected, setConnected] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const seenRef = useRef([]), alive = useRef(true), pending = useRef(null), rerun = useRef(false);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    alive.current = true;
    AsyncStorage.getItem(storageKey).then(value => {
      if (alive.current) { const ids = parseReadState(value).messages || []; seenRef.current = ids; setSeen(ids); }
    }).catch(() => {}).finally(() => { if (alive.current) setHydrated(true); });
    return () => { alive.current = false; };
  }, [storageKey]);
  const refresh = useCallback(() => {
    if (!user?.name) return Promise.resolve(null);
    if (pending.current) { rerun.current = true; return pending.current; }
    pending.current = (async () => {
      try {
        do {
          rerun.current = false;
          const next = await loadMessageConversation(supabase, user.name);
          if (alive.current) { setSnapshot(next); setConnected(true); }
        } while (alive.current && rerun.current);
      } catch {
        // Preserve the last successful unread count during a network failure.
        if (alive.current) setConnected(false);
      } finally {
        pending.current = null;
        if (alive.current) setLoading(false);
      }
    })();
    return pending.current;
  }, [user?.name]);
  const markSeen = useCallback(displayedMessages => {
    if (!hydrated || AppState.currentState !== 'active') return;
    const incoming = incomingMessages(displayedMessages, 'admin', snapshot.conversationId);
    const ids = acknowledgeRows(seenRef.current, incoming);
    if (ids.length === seenRef.current.length) return;
    seenRef.current = ids;
    setSeen(ids);
    writes.current = writes.current.catch(() => {}).then(() => AsyncStorage.setItem(storageKey, JSON.stringify({ messages: ids })));
    // Handle storage errors; the in-memory receipts still work for this session.
    writes.current.catch(() => {});
  }, [hydrated, snapshot.conversationId, storageKey]);
  useEffect(() => {
    if (!user?.name) return;
    void refresh();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 10000);
    const listener = AppState.addEventListener('change', state => {
      setAppActive(state === 'active');
      if (state === 'active') void refresh();
    });
    const channel = supabase.channel('message-conversations:' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: 'name=eq.' + user.name }, refresh)
      .subscribe(status => { if (status === 'SUBSCRIBED') void refresh(); });
    return () => { clearInterval(timer); listener.remove(); void supabase.removeChannel(channel); };
  }, [user?.id, user?.name, refresh]);
  useEffect(() => {
    if (snapshot.conversationId == null) return;
    const channel = supabase.channel('message-badge:' + snapshot.conversationId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + snapshot.conversationId }, refresh)
      .subscribe(status => { if (status === 'SUBSCRIBED') void refresh(); });
    return () => { void supabase.removeChannel(channel); };
  }, [snapshot.conversationId, refresh]);
  const unreadCount = hydrated ? unreadRows(incomingMessages(snapshot.messages, 'admin', snapshot.conversationId), seen).length : 0;
  return <MessageBadgeContext.Provider value={{ ...snapshot, unreadCount, markSeen, refresh, loading, connected, appActive }}>{children}</MessageBadgeContext.Provider>;
}
export function useMessageBadge() { return useContext(MessageBadgeContext); }
