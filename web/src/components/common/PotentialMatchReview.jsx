import { useState } from 'react';
import { activityLogsApi } from '../../services/api';
import { showToast } from './Toast';
import MatchDetails from './MatchDetails';
import FTFVerificationForm from './FTFVerificationForm';

export default function PotentialMatchReview({ item, table, onComplete }) {
  const [match, setMatch] = useState(null);
  const sourceId = table === 'lost_items' ? match?.lost_item?.id : match?.found_item?.id;
  const currentMatch = String(sourceId) === String(item.id) ? match : null;
  // Ownership always belongs to the lost reporter, even when opened from Found.
  const lostItem = table === 'lost_items' ? item : currentMatch?.lost_item;
  const cancelApproval = async foundItemId => {
    const result = await activityLogsApi.cancelMatch(lostItem.id, foundItemId);
    if (result?.success !== true) throw new Error('The server did not confirm cancellation. Please try again.');
    showToast('Both reports are available for matching again.', 'success', 'Potential match cancelled');
    onComplete?.();
  };
  return <div className="potential-match-review">
    <MatchDetails key={table + ':' + item.id} itemId={item.id} table={table} onMatchLoaded={setMatch} />
    {lostItem && <FTFVerificationForm key={table + ':' + item.id + ':' + lostItem.id} lostItem={lostItem} onComplete={onComplete} onCancel={cancelApproval} />}
  </div>;
}
