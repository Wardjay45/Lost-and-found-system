import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import supabase from '../config/supabase';

const MessageBadgeContext = createContext();

// In-memory seen count (persists during app session)
let seenCount = 0;

export function MessageBadgeProvider({ children }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef(null);

  const getTotalMessages = useCallback(async () => {
    if (!user?.name) return 0;
    try {
      const { data: convs } = await supabase.from('conversations').select('*');
      const userConv = (convs || []).find(c => c.name === user.name);
      if (!userConv) return 0;

      const { data: msgs } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', userConv.id);
      return Array.isArray(msgs) ? msgs.length : 0;
    } catch {
      return 0;
    }
  }, [user?.name]);

  const markSeen = useCallback(async () => {
    const total = await getTotalMessages();
    seenCount = total;
    setUnreadCount(0);
  }, [getTotalMessages]);

  const refresh = useCallback(async () => {
    try {
      const total = await getTotalMessages();
      setUnreadCount(Math.max(0, total - seenCount));
    } catch {}
  }, [getTotalMessages]);

  // Initial fetch + polling every 10 seconds
  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, 10000);
    return () => clearInterval(intervalRef.current);
  }, [refresh]);

  return (
    <MessageBadgeContext.Provider value={{ unreadCount, markSeen, refresh }}>
      {children}
    </MessageBadgeContext.Provider>
  );
}

export function useMessageBadge() {
  return useContext(MessageBadgeContext);
}