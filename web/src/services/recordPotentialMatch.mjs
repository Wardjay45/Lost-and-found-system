import { notifyChange } from './liveNotifications.mjs';

export async function recordPotentialMatch(match, { activityLogsApi }) {
  // One authenticated server action persists the association before either status.
  const saved = await activityLogsApi.create({ action: 'match', mark_potential: true, details: JSON.stringify({
    lost_item_id: match.lost_item.id, found_item_id: match.found_item.id,
    score: match.score, image_score: match.image_score ?? 0, text_score: match.text_score ?? 0,
  }) });
  if (typeof window !== 'undefined') { notifyChange('lost_items'); notifyChange('found_items'); }
  return saved;
}
