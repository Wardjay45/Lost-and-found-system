import { createClient } from '@supabase/supabase-js';

export function createRecoveryRepository(client) {
  const check = result => { if (result.error) throw result.error; return result.data; };
  async function rows(table, owner) {
    const collected = [];
    for (let offset = 0; ; offset += 1000) {
      let query = client.from(table).select('*').order('id');
      if (owner !== undefined) query = query.eq(table === 'item_recoveries' ? 'owner_id' : 'user_id', owner);
      const data = check(await query.range(offset, offset + 999));
      collected.push(...data);
      if (data.length < 1000) return collected;
    }
  }
  return {
    user: async id => check(await client.from('users').select('id,name,role,status,google_subject').eq('id', id).maybeSingle()),
    recovery: async id => check(await client.from('item_recoveries').select('*').eq('id', id).maybeSingle()),
    recoveries: owner => rows('item_recoveries', owner),
    feedback: owner => rows('feedback', owner),
    insertFeedback: async fields => check(await client.from('feedback').insert(fields).select('*').single()),
    trackingStart: async () => check(await client.from('recovery_tracking').select('started_at').eq('singleton', true).single()).started_at,
    completeRecovery: async (actor, lostId, fields) => check(await client.rpc('complete_item_recovery', { p_lost_id: lostId, p_found_id: fields.found_item_id, p_admin_id: actor.id, p_notes: fields.notes })),
  };
}

export function configuredRecoveryRepository() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Recovery storage is not configured');
  return createRecoveryRepository(createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }));
}
