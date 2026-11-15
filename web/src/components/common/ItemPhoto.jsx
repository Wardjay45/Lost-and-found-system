import { useState } from 'react';

export default function ItemPhoto({ item, size = 'small', kind }) {
  const [failed, setFailed] = useState(null);
  const source = item?.image || item?.image_url;
  return <span className={'item-photo item-photo-' + size}>
    {source && failed !== source
      ? <img src={source} alt={(kind ? kind + ' item: ' : '') + (item?.description || 'Reported item')} loading="lazy" onError={() => setFailed(source)} />
      : <span className="item-photo-placeholder">{source ? 'Photo unavailable' : 'No photo'}</span>}
  </span>;
}
