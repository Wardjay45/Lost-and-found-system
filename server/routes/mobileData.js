import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import supabase from '../db.js';
import { createConversationAccess } from '../services/conversationAccess.js';
import { createProductionAccess } from '../services/productionAccess.js';
import { requireReportLocation, parseLocationDetails } from '../services/reportLocations.js';
import { cancelItemReport, getReportCancellationActor } from '../services/reportStatus.js';
import { readAll } from '../services/readAll.js';
import { isValidProfilePhoto } from '../services/profilePhoto.js';

const fields = {
  users: 'id,name,email,student_id,phone,department,gender,role,status,avatar,items_reported,items_claimed,join_date,last_active',
  categories: 'id,name,icon,color,description,keywords,auto_tagging,item_count',
  qr_locations: 'id,name,is_active,scan_count,last_scanned',
  lost_items: 'id,item_id,description,category_id,category_name,category_icon,location_lost,location_details,date_reported,last_updated,status,reporter_id,reporter_name,image,resolved_date,cancel_reason',
  found_items: 'id,item_id,description,category_id,category_name,category_icon,location_found,location_details,current_location,date_found,last_updated,status,finder_id,finder_name,condition,image,resolved_date,cancel_reason',
  matches: 'id,lost_item_id,found_item_id,confidence,status,date_created',
  conversations: 'id,name,avatar,created_at',
  messages: 'id,conversation_id,sender,text,time,created_at',
  settings: 'unclaimed_days',
};
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const check = result => { if (result.error) throw result.error; return result.data; };
const numberId = value => {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) fail(400, 'Choose a valid record.');
  return Number(value);
};
const text = (value, maximum = 5000) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) fail(400, 'Enter valid record details.');
  return value.trim();
};

export function createMobileDataRouter({ client = supabase, jwtSecret = () => process.env.JWT_SECRET } = {}) {
  const router = Router(), conversations = createConversationAccess(client);
  // Also protect this router when mounted independently.
  router.use(createProductionAccess(client, { jwtSecret, mobileData: true }));
  async function scope(query, table, actor) {
    if (table === 'users') return { query: query.eq('id', actor.id) };
    if (table === 'lost_items' || table === 'found_items' || table === 'matches') {
      const ownLost = (await readAll(client.from('lost_items').select('id').eq('reporter_id', actor.id).order('id'))).map(row => numberId(row.id));
      const ownFound = (await readAll(client.from('found_items').select('id').eq('finder_id', actor.id).order('id'))).map(row => numberId(row.id));
      if (table === 'matches') {
        const conditions = [ownLost.length ? 'lost_item_id.in.(' + ownLost.join(',') + ')' : '', ownFound.length ? 'found_item_id.in.(' + ownFound.join(',') + ')' : ''].filter(Boolean);
        return { query: conditions.length ? query.or(conditions.join(',')) : null };
      }
      const oppositeIds = table === 'lost_items' ? ownFound : ownLost;
      let linked = [];
      if (oppositeIds.length) {
        const oppositeKey = table === 'lost_items' ? 'found_item_id' : 'lost_item_id';
        const linkedKey = table === 'lost_items' ? 'lost_item_id' : 'found_item_id';
        linked = (await readAll(client.from('matches').select(linkedKey).in(oppositeKey, oppositeIds).in('status', ['confirmed','matched','potential_match','claimed']).order('id'))).map(row => row[linkedKey]).filter(value => Number.isSafeInteger(Number(value)) && Number(value) > 0).map(Number);
      }
      const owner = table === 'lost_items' ? 'reporter_id' : 'finder_id';
      const conditions = [owner + '.eq.' + numberId(actor.id), ...(table === 'found_items' ? ['status.eq.active'] : []), ...(linked.length ? ['id.in.(' + linked.join(',') + ')'] : [])];
      return { query: query.or(conditions.join(',')) };
    }
    return { query };
  }
  router.all('/:table', async (req, res) => {
    try {
      const table = req.params.table, actor = req.actor;
      if (!fields[table]) fail(404, 'This data source is not available.');
      const selected = req.query.select || '*';
      const available = new Set(fields[table].split(','));
      const cancellationLookup = req.method === 'GET' && selected === 'cancellation_actor' && ['lost_items','found_items'].includes(table);
      if (!cancellationLookup && (typeof selected !== 'string' || selected !== '*' && selected.split(',').some(key => !available.has(key)))) fail(400, 'Choose valid record fields.');
      const shape = row => selected === '*' ? row : Object.fromEntries(selected.split(',').filter(key => key in row).map(key => [key,row[key]]));
      const send = (rows, status = 200) => {
        const data = rows.map(shape);
        if (req.headers.accept?.includes('application/vnd.pgrst.object+json')) {
          if (data.length !== 1) return res.status(406).json({ code: 'PGRST116', message: 'The requested record is unavailable.' });
          return res.status(status).json(data[0]);
        }
        return res.status(status).json(data);
      };
      const queryId = () => {
        if (typeof req.query.id !== 'string' || !req.query.id.startsWith('eq.')) fail(400, 'Choose a record to update.');
        return numberId(req.query.id.slice(3));
      };
      if (req.method === 'GET') {
        if (cancellationLookup) {
          const cancellation_actor = await getReportCancellationActor(client, { table, id: queryId(), ownerId: actor.id });
          return send([{ cancellation_actor }]);
        }
        if (table === 'settings') return send([{ unclaimed_days: 60 }]);
        if (table === 'conversations') {
          const conversation = await conversations.forUser(actor, false);
          return send(conversation ? [conversation] : []);
        }
        let query = client.from(table).select(fields[table]);
        if (table === 'messages') {
          const conversation = await conversations.forUser(actor, false);
          if (!conversation) return send([]);
          query = query.eq('conversation_id', String(conversation.id));
        }
        query = (await scope(query, table, actor)).query;
        if (!query) return send([]);
        for (const [key, value] of Object.entries(req.query)) {
          if (['select','order','limit','offset'].includes(key)) continue;
          if (!available.has(key) || typeof value !== 'string' || !value.startsWith('eq.')) fail(400, 'Unsupported record filter.');
          const raw = value.slice(3);
          const parsed = ['id','reporter_id','finder_id','lost_item_id','found_item_id'].includes(key) ? numberId(raw) : key === 'is_active' ? raw === 'true' : raw;
          query = query.eq(key, parsed);
        }
        if (req.query.order) {
          if (typeof req.query.order !== 'string') fail(400, 'Choose a valid record order.');
          for (const order of req.query.order.split(',')) {
            const [key, direction] = order.split('.');
            if (!available.has(key) || direction && !['asc','desc'].includes(direction)) fail(400, 'Choose a valid record order.');
            query = query.order(key, { ascending: direction !== 'desc' });
          }
        } else query = query.order('id');
        const limit = req.query.limit === undefined ? 1000 : Number(req.query.limit);
        const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000 || !Number.isSafeInteger(offset) || offset < 0) fail(400, 'Choose a valid record page.');
        const rows = check(await query.range(offset, offset + limit - 1));
        for (const row of rows) {
          if (table === 'found_items' && Number(row.finder_id) !== Number(actor.id)) { delete row.finder_id; delete row.finder_name; }
          if (table === 'lost_items' && Number(row.reporter_id) !== Number(actor.id)) { delete row.reporter_id; delete row.reporter_name; }
        }
        return send(rows);
      }
      if (req.method === 'POST' && table === 'conversations') return send([await conversations.forUser(actor, true)], 201);
      if (req.method === 'POST' && table === 'messages') {
        const conversation = await conversations.forUser(actor, true);
        if (req.body.conversation_id !== undefined && String(req.body.conversation_id) !== String(conversation.id)) fail(403, 'You can only message your own office conversation.');
        const saved = check(await client.from('messages').insert({ conversation_id: String(conversation.id), sender: 'user', text: text(req.body.text), time: new Date().toISOString() }).select(fields.messages).single());
        return send([saved], 201);
      }
      if (req.method === 'POST' && ['lost_items','found_items'].includes(table)) {
        const lost = table === 'lost_items', placeKey = lost ? 'location_lost' : 'location_found';
        const place = await requireReportLocation(client, req.body[placeKey]);
        const categoryQuery = client.from('categories').select('id,name,icon,auto_tagging');
        const category = check(await (req.body.category_id ? categoryQuery.eq('id', numberId(req.body.category_id)) : categoryQuery.eq('name', text(req.body.category_name, 100))).maybeSingle());
        if (!category || category.auto_tagging === false) fail(400, 'Choose an active category.');
        const now = new Date().toISOString();
        const record = {
          item_id: (lost ? 'LOST-' : 'FOUND-') + randomUUID(), description: text(req.body.description),
          category_id: category.id, category_name: category.name, category_icon: category.icon,
          [placeKey]: place, location_details: parseLocationDetails(req.body.location_details),
          [lost ? 'reporter_id' : 'finder_id']: actor.id, [lost ? 'reporter_name' : 'finder_name']: actor.name,
          status: lost ? 'active' : 'pending', [lost ? 'date_reported' : 'date_found']: now, last_updated: now,
        };
        if (!lost) record.condition = typeof req.body.condition === 'string' ? req.body.condition.slice(0,100) : 'Good';
        if (req.body.image !== undefined) {
          if (typeof req.body.image !== 'string' || !/^(data:image\/(png|jpe?g|webp|heic);base64,|https:\/\/)/i.test(req.body.image)) fail(400, 'Choose a valid item photo.');
          record.image = req.body.image;
        }
        const saved = check(await client.from(table).insert(record).select(fields[table]).single());
        const logged = await client.from('activity_logs').insert({ action: 'report', details: (lost ? 'Lost' : 'Found') + ' report ' + saved.item_id + ' created.', user_name: actor.name, role: actor.role, timestamp: now });
        if (logged.error) res.set('X-Activity-Warning', 'Report saved, but its activity log could not be recorded.');
        return send([saved], 201);
      }
      if (req.method === 'PATCH' && ['lost_items','found_items'].includes(table)) {
        if (Object.keys(req.body).some(key => !['status','cancel_reason'].includes(key)) || req.body.status !== 'cancelled') fail(403, 'Use your report cancellation action.');
        const saved = await cancelItemReport(client, {
          table, id: queryId(), actorId: actor.id, reason: req.body.cancel_reason, ownerOnly: true,
        });
        const report = Object.fromEntries([...available].map(key => [key, saved[key]]));
        return send([report]);
      }
      if (req.method === 'PATCH' && table === 'users') {
        if (queryId() !== Number(actor.id)) fail(403, 'Only your own profile can be updated.');
        const allowed = ['name','phone','department','gender','avatar'];
        if (!Object.keys(req.body).length || Object.keys(req.body).some(key => !allowed.includes(key))) fail(400, 'Only personal profile details can be updated.');
        const updates = {};
        for (const [key,value] of Object.entries(req.body)) {
          if (key === 'avatar') {
            if (value !== '' && !isValidProfilePhoto(value)) fail(400, 'Choose a valid profile photo.');
            updates.avatar = value;
          } else {
            if (typeof value !== 'string' || value.length > 200) fail(400, 'Enter valid profile details.');
            updates[key] = value.trim();
          }
        }
        if (updates.name === '') fail(400, 'Your name is required.');
        const existingConversation = updates.name && updates.name !== actor.name ? await conversations.forUser(actor, false) : null;
        if (existingConversation && !await conversations.ownerColumn()) fail(409, 'Ask the administrator to finish conversation-owner setup before changing your name.');
        const row = check(await client.from('users').update(updates).eq('id', actor.id).select(fields.users).single());
        return send([row]);
      }
      if (req.method === 'PATCH' && table === 'qr_locations') {
        const id = queryId();
        if (Object.keys(req.body).some(key => !['scan_count','last_scanned'].includes(key))) fail(403, 'Location management requires an administrator.');
        for (let attempt = 0; attempt < 3; attempt++) {
          const current = check(await client.from('qr_locations').select('id,scan_count').eq('id', id).eq('is_active', true).maybeSingle());
          if (!current) fail(404, 'Active location not found.');
          const saved = check(await client.from('qr_locations').update({ scan_count: (current.scan_count || 0) + 1, last_scanned: new Date().toISOString() }).eq('id', id).eq('scan_count', current.scan_count).select(fields.qr_locations).maybeSingle());
          if (saved) return send([saved]);
        }
        fail(409, 'The scan could not be recorded. Try again.');
      }
      fail(403, 'This action is not available for your account.');
    } catch (error) {
      res.status(error.status || 503).json({ code: error.status ? 'DATA_REQUEST_REJECTED' : 'DATA_UNAVAILABLE', message: error.status ? error.message : 'Your records are temporarily unavailable. Please try again.' });
    }
  });
  return router;
}
export default createMobileDataRouter();
