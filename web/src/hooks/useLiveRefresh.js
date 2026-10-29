import { useEffect, useRef } from 'react';
import { notificationEvent } from '../services/liveNotifications.mjs';
export default function useLiveRefresh(table, refresh) {
  const callback = useRef(refresh);
  callback.current = refresh;
  useEffect(() => {
    const update = event => {
      const changedTable = event.detail?.table;
      const matches = changedTable === 'all' || (Array.isArray(table) ? table.includes(changedTable) : changedTable === table);
      if (document.visibilityState === 'visible' && matches) callback.current();
    };
    window.addEventListener(notificationEvent, update);
    return () => window.removeEventListener(notificationEvent, update);
  }, [table]);
}
