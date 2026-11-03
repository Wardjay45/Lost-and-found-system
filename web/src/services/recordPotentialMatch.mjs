import { notifyChange } from './liveNotifications.mjs';
import { normalizeMatchScore } from '../../../shared/matchingScores.mjs';

export async function recordPotentialMatch(match, { activityLogsApi }) {
  const scores = Object.fromEntries(['score', 'image_score', 'text_score'].map(key => [key,
    normalizeMatchScore(match[key] ?? (key === 'score' ? null : 0)),
  ]));
  if (Object.values(scores).some(score => score === null)) throw new Error('Unable to save invalid similarity scores.');
  // One authenticated server action persists the association before either status.
  const saved = await activityLogsApi.create({ action: 'match', mark_potential: true, details: JSON.stringify({
    lost_item_id: match.lost_item.id, found_item_id: match.found_item.id,
    ...scores,
  }) });
  if (typeof window !== 'undefined') { notifyChange('lost_items'); notifyChange('found_items'); }
  return saved;
}
