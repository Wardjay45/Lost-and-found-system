import { useCallback, useEffect, useRef, useState } from 'react';
import { qrLocationsApi } from '../services/api';

export default function useReportLocations(isOpen) {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const cancelPending = useCallback(() => { requestId.current++; }, []);
  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const data = await qrLocationsApi.getAll();
      if (!Array.isArray(data)) throw new Error('Unable to load approved locations.');
      if (id !== requestId.current) return;
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
  return { locations, loading, error, refresh };
}
