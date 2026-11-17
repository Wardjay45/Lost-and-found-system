import { useEffect, useState } from 'react';
import request from '../services/api';
import { createReportPhotoLoader } from '../services/reportPhotos.mjs';

const loadPhoto = createReportPhotoLoader(request);

export default function useReportPhoto(item) {
  const direct = item?.image || item?.image_url;
  const endpoint = item?.image_endpoint;
  const [loaded, setLoaded] = useState(null);
  useEffect(() => {
    if (direct || !endpoint) return;
    let active = true;
    loadPhoto(endpoint).then(source => {
      if (active) setLoaded({ endpoint, source });
    }).catch(() => {
      if (active) setLoaded({ endpoint, source: '', failed: true });
    });
    return () => { active = false; };
  }, [direct, endpoint]);
  return {
    source: direct || (loaded?.endpoint === endpoint ? loaded?.source : ''),
    loading: !direct && !!endpoint && loaded?.endpoint !== endpoint,
    hasPhoto: !!direct || (!!endpoint && (loaded?.endpoint !== endpoint || !!loaded?.source || loaded?.failed)),
  };
}
