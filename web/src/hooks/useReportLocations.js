import { useCallback, useEffect, useRef, useState } from 'react';
import { qrLocationsApi } from '../services/api';
import useLiveRefresh from './useLiveRefresh';

export default function useReportLocations(isOpen) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const cancelPending = useCallback(() => { requestId.current++; }, []);
  const refresh = useCallback(async ({ background = false } = {}) => {
    const id = ++requestId.current;
    if (!background) setLoading(true);
    try {
      const data = await qrLocationsApi.getAll();
      if (!Array.isArray(data)) throw new Error('Unable to load approved locations.');
      if (id !== requestId.current) return;
      setError('');
      setLocations(data.filter(place => place.is_active === true && typeof place.name === 'string' && place.name.trim())
        .map(place => ({ ...place, name: place.name.trim() })).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err.message || 'Unable to load approved locations.');
      setLocations([]);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (isOpen) refresh();
    return cancelPending;
  }, [isOpen, refresh, cancelPending]);
  useLiveRefresh('qr_locations', options => { if (isOpen) return refresh(options); });
  return { locations, loading, error, refresh };
}
