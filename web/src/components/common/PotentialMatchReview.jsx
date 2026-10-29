import { useState } from 'react';
import { lostItemsApi, foundItemsApi } from '../../services/api';
import MatchDetails from './MatchDetails';
import FTFVerificationForm from './FTFVerificationForm';

export default function PotentialMatchReview({ item, table, onComplete, onCancel }) {
  const [match, setMatch] = useState(null);
  const sourceId = table === 'lost_items' ? match?.lost_item?.id : match?.found_item?.id;
  const currentMatch = String(sourceId) === String(item.id) ? match : null;
  // Ownership always belongs to the lost reporter, even when opened from Found.
  const lostItem = table === 'lost_items' ? item : currentMatch?.lost_item;
  const cancelApproval = async foundItemId => {
    if (onCancel) return onCancel(foundItemId, lostItem.id);
    await lostItemsApi.updateStatus(lostItem.id, 'active');
    if (foundItemId) await foundItemsApi.updateStatus(foundItemId, 'active');
    onComplete?.();
  };
  return <div className="potential-match-review">
    <MatchDetails key={table + ':' + item.id} itemId={item.id} table={table} onMatchLoaded={setMatch} />
    {lostItem && <FTFVerificationForm key={table + ':' + item.id + ':' + lostItem.id} lostItem={lostItem} onComplete={onComplete} onCancel={cancelApproval} />}
  </div>;
}
