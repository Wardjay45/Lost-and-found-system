import { createClient } from '@supabase/supabase-js';
import { readAll } from './readAll.js';

export function createRecoveryRepository(client) {
  const check = result => { if (result.error) throw result.error; return result.data; };
  async function rows(table, owner) {
    const collected = [];
    for (let offset = 0; ; offset += 1000) {
      const columns = table === 'item_recoveries' ? 'id,lost_item_id,found_item_id,owner_id,verified_by_id,verified_by_name,item_description,reported_at,recovered_at,notes' : '*';
      let query = client.from(table).select(columns).order('id');
      if (owner !== undefined) query = query.eq(table === 'item_recoveries' ? 'owner_id' : 'user_id', owner);
      const data = check(await query.range(offset, offset + 999));
      collected.push(...data);
      if (data.length < 1000) return collected;
    }
  }
  async function recoveries(owner) {
    const records = await rows('item_recoveries', owner);
    const ids = [...new Set(records.map(record => record.found_item_id).filter(Boolean))];
    const foundDates = new Map();
    for (let start = 0; start < ids.length; start += 500) {
      const found = await readAll(client.from('found_items').select('id,date_found').in('id', ids.slice(start, start + 500)).order('id'));
      for (const item of found) foundDates.set(String(item.id), item.date_found);
    }
    return records.map(record => ({ ...record, found_at: foundDates.get(String(record.found_item_id)) || null }));
  }
  return {
    user: async id => check(await client.from('users').select('id,name,role,status,google_subject').eq('id', id).maybeSingle()),
    recovery: async id => check(await client.from('item_recoveries').select('*').eq('id', id).maybeSingle()),
    recoveries,
    feedback: owner => rows('feedback', owner),
    insertFeedback: async fields => check(await client.from('feedback').insert(fields).select('*').single()),
    trackingStart: async () => check(await client.from('recovery_tracking').select('started_at').eq('singleton', true).single()).started_at,
    completeRecovery: async (actor, lostId, fields) => check(await client.rpc('complete_item_recovery_with_evidence', { p_lost_id: lostId, p_found_id: fields.found_item_id, p_admin_id: actor.id, p_notes: fields.notes, p_handover_image: fields.handover_image, p_knowledge_answers: fields.knowledge_answers })),
  };
}

export function configuredRecoveryRepository() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Recovery storage is not configured');
  return createRecoveryRepository(createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }));
}
