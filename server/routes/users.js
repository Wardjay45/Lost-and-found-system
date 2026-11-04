import { Router } from 'express';
import supabase from '../db.js';
import { createProductionAccess } from '../services/productionAccess.js';
import { readAll } from '../services/readAll.js';

export const publicUserColumns = 'id,name,email,student_id,phone,department,gender,role,status,avatar,items_reported,items_claimed,join_date,last_active';
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const userId = value => { if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) fail(400, 'Choose a valid account.'); return Number(value); };

export function createUsersRouter({ client = supabase, jwtSecret = () => process.env.JWT_SECRET } = {}) {
  const router = Router();
  router.use(createProductionAccess(client, { jwtSecret }));
  const handle = operation => async (req, res) => {
    try { await operation(req, res); }
    catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : 'Unable to update or load accounts. Please try again.' }); }
  };
  const getUser = async id => {
    const { data, error } = await client.from('users').select(publicUserColumns).eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) fail(404, 'Account not found.');
    return data;
  };
  function canManage(actor, target) {
    if (Number(actor.id) === Number(target.id)) fail(403, 'You cannot change your own account access here.');
    if (target.role !== 'student') fail(403, 'Admin accounts are protected.');
  }
  const save = async (id, target, updates) => {
    const { data, error } = await client.from('users').update(updates).eq('id', id)
      .eq('role', target.role).eq('status', target.status).select(publicUserColumns).maybeSingle();
    if (error) throw error;
    if (!data) fail(409, 'This account changed while you were saving. Reopen it and try again.');
    return data;
  };
  router.get('/', handle(async (req, res) => {
    let query = client.from('users').select(publicUserColumns).order('id');
    if (req.query.status && req.query.status !== 'all') {
      if (!['active', 'archived', 'suspended'].includes(req.query.status)) fail(400, 'Choose a valid account status.');
      query = query.eq('status', req.query.status);
    }
    const rows = await readAll(query);
    if (req.query.search !== undefined && typeof req.query.search !== 'string') fail(400, 'Enter a valid account search.');
    const search = (req.query.search || '').trim().toLowerCase();
    res.json(search ? rows.filter(row => [row.name, row.email, row.student_id].some(value => String(value || '').toLowerCase().includes(search))) : rows);
  }));
  router.get('/:id', handle(async (req, res) => res.json(await getUser(userId(req.params.id)))));
  router.put('/:id/status', handle(async (req, res) => {
    const id = userId(req.params.id), target = await getUser(id);
    canManage(req.actor, target);
    if (!['active', 'archived', 'suspended'].includes(req.body?.status)) fail(400, 'Choose active, archived, or suspended.');
    res.json(await save(id, target, { status: req.body.status }));
  }));
  router.put('/:id/role', handle(async (req, res) => {
    res.status(405).json({ error: 'Account roles are fixed. Role changes are not available.' });
  }));
  router.put('/:id', handle(async (req, res) => {
    const id = userId(req.params.id), target = await getUser(id);
    canManage(req.actor, target);
    if (req.body.role !== undefined) fail(400, 'Account roles are fixed and cannot be changed.');
    if (req.body.status !== undefined) fail(400, 'Use the account status action to change access.');
    const updates = {};
    for (const key of ['name','email','phone','department','student_id']) {
      if (req.body[key] !== undefined) {
        if (typeof req.body[key] !== 'string' || req.body[key].trim().length > 200) fail(400, 'Enter valid account details.');
        updates[key] = req.body[key].trim();
      }
    }
    if (!Object.keys(updates).length || updates.name === '') fail(400, 'Enter valid account changes.');
    res.json(await save(id, target, updates));
  }));
  return router;
}
export default createUsersRouter();
