import { findRecordedPair, reportId } from '../../shared/potentialMatches.mjs';
import { readAll } from './readAll.js';
const fail = message => { throw Object.assign(new Error(message), { status: 409 }); };
const score = value => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const storedStatuses = ['confirmed', 'matched', 'potential_match'];

// Read explicit associations only. A report status or a nearby timestamp cannot
// identify which opposite report the administrator selected.
export async function loadSavedPotentialMatch(client, itemId, table) {
  const id = reportId(itemId);
  if (!id || !['lost_items', 'found_items'].includes(table)) throw Object.assign(new Error('Choose a valid lost or found report.'), { status: 400 });
  const logs = await readAll(client.from('activity_logs').select('*').eq('action', 'match').order('timestamp', { ascending: false }).order('id', { ascending: false }));
  const recorded = findRecordedPair(logs, id, table);
  let pair = recorded;
  if (!pair) {
    const rows = await readAll(client.from('matches').select('id,lost_item_id,found_item_id,confidence,status,date_created').in('status', storedStatuses));
    const field = table === 'lost_items' ? 'lost_item_id' : 'found_item_id';
    const candidates = rows.filter(row => reportId(row[field]) === id && reportId(row.lost_item_id) && reportId(row.found_item_id));
    if (!candidates.length) return null;
    const distinct = new Set(candidates.map(row => row.lost_item_id + ':' + row.found_item_id));
    if (distinct.size !== 1) fail('This report has conflicting saved matches. Refresh before releasing the item.');
    const row = candidates.sort((a, b) => (Date.parse(b.date_created) || 0) - (Date.parse(a.date_created) || 0) || b.id - a.id)[0];
    pair = { lostId: reportId(row.lost_item_id), foundId: reportId(row.found_item_id), details: { score: typeof row.confidence === 'number' ? row.confidence / 100 : undefined } };
    if (rows.some(other => (reportId(other.lost_item_id) === pair.lostId || reportId(other.found_item_id) === pair.foundId) && (reportId(other.lost_item_id) !== pair.lostId || reportId(other.found_item_id) !== pair.foundId))) fail('This report has conflicting saved matches. Refresh before releasing the item.');
  }
  const lostLink = findRecordedPair(logs, pair.lostId, 'lost_items');
  const foundLink = findRecordedPair(logs, pair.foundId, 'found_items');
  if ((lostLink && lostLink.foundId !== pair.foundId) || (foundLink && foundLink.lostId !== pair.lostId)) fail('The saved item association has changed. Refresh before releasing the item.');
  const fetchReport = async (source, report) => {
    const columns = source === 'lost_items'
      ? 'id,item_id,status,description,category_name,location_lost,location_details,reporter_name,reporter_id,image,date_reported,last_updated'
      : 'id,item_id,status,description,category_name,location_found,location_details,finder_name,condition,image,date_found,last_updated';
    const { data, error } = await client.from(source).select(columns).eq('id', Number(report)).maybeSingle();
    if (error) throw error;
    if (!data || reportId(data.id) !== report) fail('A report in this saved match is unavailable.');
    return { ...data, location: source === 'lost_items' ? data.location_lost : data.location_found };
  };
  const [lost, found] = await Promise.all([fetchReport('lost_items', pair.lostId), fetchReport('found_items', pair.foundId)]);
  return { lost_item: lost, found_item: found, score: score(pair.details.score), image_score: score(pair.details.image_score), text_score: score(pair.details.text_score) };
}
