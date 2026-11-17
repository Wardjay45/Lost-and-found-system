import { useState } from 'react';
import useReportPhoto from '../../hooks/useReportPhoto';

export default function ItemPhoto({ item, size = 'small', kind }) {
  const [failed, setFailed] = useState(null);
  const { source, loading, hasPhoto } = useReportPhoto(item);
  return <span className={'item-photo item-photo-' + size}>
    {source && failed !== source
      ? <img src={source} alt={(kind ? kind + ' item: ' : '') + (item?.description || 'Reported item')} loading="lazy" onError={() => setFailed(source)} />
      : <span className="item-photo-placeholder">{loading ? 'Loading photo…' : hasPhoto ? 'Photo unavailable' : 'No photo'}</span>}
  </span>;
}
