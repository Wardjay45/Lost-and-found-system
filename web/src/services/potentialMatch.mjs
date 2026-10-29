import { reportId } from '../../../shared/potentialMatches.mjs';

export async function loadPotentialMatch(itemId, table, request, { signal } = {}) {
  const id = reportId(itemId);
  if (!id || !['lost_items', 'found_items'].includes(table)) throw new Error('Choose a valid lost or found report.');
  const result = await request('/activity-logs/match/' + table + '/' + id, { signal });
  if (!result || !Object.hasOwn(result, 'match')) throw new Error('Unable to load the saved item association.');
  return result.match;
}
