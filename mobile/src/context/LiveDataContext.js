import { useIsFocused } from '@react-navigation/native';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { initApiUrl } from '../config/api';
import { createLiveSync, createRefreshQueue } from '../services/liveSync.mjs';

const LiveDataContext = createContext(null);
export function LiveDataProvider({ children }) {
  const { user, token } = useAuth();
  const listeners = useRef(new Set());
  const [status, setStatus] = useState('connecting');
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    if (!user?.id || !token) return;
    const sync = createLiveSync({ getApiUrl: initApiUrl, getToken: () => token, onStatus: setStatus,
      onChange: tables => { for (const listener of listeners.current) listener(tables); } });
    if (AppState.currentState === 'active') sync.start();
    const subscription = AppState.addEventListener('change', state => {
      setAppActive(state === 'active');
      if (state === 'active') sync.start(); else sync.stop();
    });
    return () => { subscription.remove(); sync.stop(); };
  }, [user?.id, token]);
  return <LiveDataContext.Provider value={{ listeners: listeners.current, status, appActive }}>{children}</LiveDataContext.Provider>;
}

export function useLiveSubscription(refresh, tables, enabled = true) {
  const live = useContext(LiveDataContext);
  const callback = useRef(refresh); callback.current = refresh;
  const key = [...tables].sort().join(',');
  useEffect(() => {
    if (!enabled || !live?.listeners) return;
    const queue = createRefreshQueue(() => callback.current());
    const wanted = key.split(',');
    const update = changed => { if (changed.includes('all') || changed.some(table => wanted.includes(table))) void queue.run(); };
    live.listeners.add(update);
    return () => { live.listeners.delete(update); queue.stop(); };
  }, [live?.listeners, key, enabled]);
  return { status: live?.status || 'connecting', appActive: live?.appActive ?? true };
}

export function useLiveRefresh(refresh, tables) {
  const focused = useIsFocused();
  return useLiveSubscription(refresh, tables, focused);
}
