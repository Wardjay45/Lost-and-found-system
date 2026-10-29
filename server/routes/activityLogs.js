import { Router } from 'express';
import jwt from 'jsonwebtoken';
import supabase from '../db.js';
import { readAll } from '../services/readAll.js';
import { normalizeActivityAction } from '../../shared/activityLogs.mjs';
import { findRecordedPair } from '../../shared/potentialMatches.mjs';
import { loadSavedPotentialMatch } from '../services/potentialMatches.js';

function fail(status, message) { throw Object.assign(new Error(message), { status }); }

export function createActivityLogsRouter({ client = supabase, jwtSecret = () => process.env.JWT_SECRET } = {}) {
  const router = Router();
  async function authorize(req) {
    const secret = typeof jwtSecret === 'function' ? jwtSecret() : jwtSecret;
    if (!secret) fail(503, 'Activity log sessions are not configured.');
    const token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
    let claims;
    try { claims = jwt.verify(token || '', secret, { algorithms: ['HS256'] }); } catch { fail(401, 'Please sign in again to access the activity log.'); }
    if (!Number.isSafeInteger(Number(claims.id)) || Number(claims.id) <= 0) fail(401, 'Invalid session.');
    const { data: actor, error } = await client.from('users').select('id,name,role,status').eq('id', Number(claims.id)).maybeSingle();
    if (error) throw error;
    if (!actor || actor.status !== 'active' || !['admin', 'superadmin'].includes(actor.role) || claims.role !== actor.role) fail(403, 'Only active administrators can access the activity log.');
    return actor;
  }
  const handle = operation => async (req, res) => {
    try { await operation(req, res, await authorize(req)); }
    catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : 'Activity log unavailable. Please try again.' }); }
  };
  router.get('/', handle(async (req, res) => {
    const { action, limit } = req.query;
    if (action !== undefined && typeof action !== 'string') fail(400, 'Choose one activity type.');
    if (limit !== undefined && (typeof limit !== 'string' || !/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 1000)) fail(400, 'Limit must be an integer from 1 to 1000.');
    const selected = action && !['all', 'undefined', 'null'].includes(action) ? normalizeActivityAction(action) : null;
    const query = client.from('activity_logs').select('*').order('timestamp', { ascending: false }).order('id', { ascending: false });
    let rows;
    if (limit && !selected) {
      const { data, error } = await query.limit(Number(limit));
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('Invalid activity response');
      rows = data;
    } else rows = await readAll(query);
    if (selected) rows = rows.filter(log => normalizeActivityAction(log.action) === selected);
    res.json(limit ? rows.slice(0, Number(limit)) : rows);
  }));
  router.get('/match/:table/:id', handle(async (req, res) => {
    res.json({ match: await loadSavedPotentialMatch(client, req.params.id, req.params.table) });
  }));
  // Serialize decisions in this server so overlapping admin clicks cannot overwrite
  // one another between saving the association and changing report statuses.
  let decisionQueue = Promise.resolve();
  const serializeDecision = operation => (req, res) => {
    const pending = decisionQueue.then(() => operation(req, res));
    decisionQueue = pending.catch(() => {});
    return pending;
  };
  // Only match decisions are client-created; other events come from server workflows.
  router.post('/', serializeDecision(handle(async (req, res, actor) => {
    if (req.body.action !== 'match' || typeof req.body.details !== 'string' || req.body.details.length > 10000) fail(400, 'Only a valid potential-match decision can be recorded here.');
    let details;
    try { details = JSON.parse(req.body.details); } catch { fail(400, 'Match details must be valid JSON.'); }
    const validId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
    const validScore = value => typeof value === 'number' && Number.isFinite(value) && value >= -1 && value <= 1;
    if (!details || !validId(details.lost_item_id) || !validId(details.found_item_id) || !validScore(details.score) ||
        ['image_score', 'text_score'].some(key => details[key] !== undefined && !validScore(details[key]))) fail(400, 'Choose a valid report pair and similarity scores.');
    const getItem = async (table, id) => {
      const columns = table === 'lost_items' ? 'id,item_id,status,description,reporter_name,reporter_id,last_updated' : 'id,item_id,status,description,last_updated';
      const { data, error } = await client.from(table).select(columns).eq('id', Number(id)).maybeSingle();
      if (error) throw error;
      if (!data) fail(404, 'A report in this match no longer exists.');
      return data;
    };
    const [lost, found] = await Promise.all([getItem('lost_items', details.lost_item_id), getItem('found_items', details.found_item_id)]);
    const markPotential = req.body.mark_potential === true;
    const allowed = markPotential ? ['active', 'potential_match'] : ['potential_match'];
    if (!allowed.includes(lost.status) || !allowed.includes(found.status)) fail(409, 'These reports are no longer available for this potential match.');
    let existing;
    if (markPotential) {
      const history = await readAll(client.from('activity_logs').select('*').order('timestamp', { ascending: false }).order('id', { ascending: false }));
      const lostLink = findRecordedPair(history, lost.id, 'lost_items'), foundLink = findRecordedPair(history, found.id, 'found_items');
      if ((lost.status === 'potential_match' && lostLink && lostLink.foundId !== String(found.id)) || (found.status === 'potential_match' && foundLink && foundLink.lostId !== String(lost.id))) fail(409, 'One of these reports is already linked to a different potential match.');
      if (lostLink?.foundId === String(found.id) && foundLink?.lostId === String(lost.id)) existing = lostLink.log;
      // Existing confirmed rows are another supported source of release associations.
      const saved = await readAll(client.from('matches').select('lost_item_id,found_item_id,status').in('status', ['confirmed', 'matched', 'potential_match']));
      if (saved.some(row => ((lost.status === 'potential_match' && String(row.lost_item_id) === String(lost.id)) || (found.status === 'potential_match' && String(row.found_item_id) === String(found.id))) && (String(row.lost_item_id) !== String(lost.id) || String(row.found_item_id) !== String(found.id)))) fail(409, 'One of these reports already has a different saved match.');
    }
    const recorded = {
      text: `Potential match recorded (${Math.round(details.score * 100)}% similarity): Lost "${lost.description}" (${lost.item_id}) → Found "${found.description}" (${found.item_id}).`,
      lost_item_id: lost.id, found_item_id: found.id, lost_item_name: lost.description, found_item_name: found.description,
      lost_reporter_name: lost.reporter_name || '', lost_reporter_id: lost.reporter_id || '',
      score: details.score, image_score: details.image_score ?? 0, text_score: details.text_score ?? 0,
    };
    // Save the exact pair first: a failed log insert must never leave status-only
    // potential reports. Keep this association on a later failure so retries work.
    let data = existing;
    if (!data) {
      const saved = await client.from('activity_logs').insert({ action: 'match', details: JSON.stringify(recorded),
        user_name: actor.name, role: actor.role, timestamp: new Date().toISOString() }).select().single();
      if (saved.error) throw saved.error;
      data = saved.data;
      if (!data) throw new Error('Match was not saved.');
    }
    if (markPotential) {
      const changed = [], timestamp = new Date().toISOString();
      try {
        for (const [table, item] of [['found_items', found], ['lost_items', lost]]) {
          if (item.status === 'potential_match') continue;
          const update = await client.from(table).update({ status: 'potential_match', last_updated: timestamp }).eq('id', item.id).eq('status', item.status).select('id');
          if (update.error) throw update.error;
          if (update.data?.length !== 1) fail(409, 'A report changed while saving this match. Refresh before retrying.');
          changed.push([table, item]);
        }
      } catch (error) {
        // Best-effort compensation cannot undo a later handover or another edit.
        for (const [table, item] of changed.reverse()) {
          await client.from(table).update({ status: item.status, last_updated: item.last_updated ?? null }).eq('id', item.id).eq('status', 'potential_match').eq('last_updated', timestamp);
        }
        throw error;
      }
    }
    res.status(existing ? 200 : 201).json(data);
  })));
  return router;
}
export default createActivityLogsRouter();
