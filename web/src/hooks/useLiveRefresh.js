import { useEffect, useRef } from 'react';
import { subscribeTableChanges } from '../services/liveRefresh.mjs';
export default function useLiveRefresh(table, refresh) {
  const callback = useRef(refresh);
  callback.current = refresh;
  const tableKey = JSON.stringify(Array.isArray(table) ? [...table].sort() : [table]);
  useEffect(() => {
    return subscribeTableChanges(JSON.parse(tableKey), options => callback.current(options));
  }, [tableKey]);
}
