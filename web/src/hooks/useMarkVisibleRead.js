import { useEffect } from 'react';
import useNotifications from './useNotifications';

// Acknowledge only after the selected detail/conversation has rendered.
export default function useMarkVisibleRead(kind, displayedRows) {
  const { markRead } = useNotifications();
  useEffect(() => {
    if (!displayedRows.length) return;
    const acknowledge = () => {
      if (document.visibilityState === 'visible') markRead(kind, displayedRows);
    };
    acknowledge();
    document.addEventListener('visibilitychange', acknowledge);
    return () => document.removeEventListener('visibilitychange', acknowledge);
  }, [kind, displayedRows, markRead]);
}
