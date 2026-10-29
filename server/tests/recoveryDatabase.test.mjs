import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createRecoveryFeedbackService } from '../services/recoveryFeedback.js';
import { createRecoveryFeedbackRouter, createRecoveryClaimHandler } from '../routes/recoveryFeedback.js';

const migration = readFileSync(new URL('../add-recovery-feedback.sql', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../../supabase-schema.sql', import.meta.url), 'utf8');

async function database(t) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  for (const table of ['categories', 'users', 'lost_items', 'found_items', 'matches', 'activity_logs']) {
    const columns = schema.split('CREATE TABLE IF NOT EXISTS ' + table + ' (')[1].split(');')[0];
    await db.exec(`CREATE TABLE ${table} (${columns});`);
  }
  await db.exec(migration);
  await db.exec('GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role; GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;');
  await db.exec(`INSERT INTO users(id,name,email,password,role,status) VALUES (1,'Owner','owner@dnsc.edu.ph','isolated-test-only','student','active'), (2,'Admin','admin@dnsc.edu.ph','isolated-test-only','admin','active');
    INSERT INTO lost_items(id,item_id,description,location_lost,reporter_id,status,date_reported) VALUES (10,'L10','Blue bag','Library',1,'potential_match','2026-10-01T00:00:00');
    INSERT INTO found_items(id,item_id,description,location_found,status) VALUES (20,'F20','Blue bag','Library','potential_match');
    INSERT INTO activity_logs(action,details) VALUES ('match','{"lost_item_id":10,"found_item_id":20}');`);
  return db;
}

test('migration is repeatable and records no historical recoveries or ratings', async t => {
  const db = await database(t);
  const before = (await db.query('SELECT started_at FROM recovery_tracking')).rows[0].started_at;
  await db.exec(migration);
  assert.equal((await db.query('SELECT started_at FROM recovery_tracking')).rows[0].started_at.getTime(), before.getTime());
  assert.equal((await db.query('SELECT count(*)::int AS count FROM item_recoveries')).rows[0].count, 0);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM feedback')).rows[0].count, 0);
});

test('anonymous and authenticated clients cannot inspect feedback, write returns, or execute the handover function', async t => {
  const db = await database(t);
  for (const role of ['anon', 'authenticated']) {
    for (const sql of ['SELECT * FROM feedback', 'SELECT * FROM item_recoveries', "SELECT complete_item_recovery(10,20,2,'')", "INSERT INTO item_recoveries(verified_by_name,item_description) VALUES ('Fake','Fake')"]) {
      await db.exec('SET ROLE ' + role);
      try { await assert.rejects(db.query(sql), /permission denied/); }
      finally { await db.exec('RESET ROLE'); }
    }
  }
});

test('verified handover is atomic and repeatable without changing its time, activity or owner count', async t => {
  const db = await database(t);
  await db.exec('SET ROLE service_role');
  const first = (await db.query("SELECT complete_item_recovery(10,20,2,'Checked school ID') AS recovery")).rows[0].recovery;
  const second = (await db.query("SELECT complete_item_recovery(10,20,2,'Repeated request') AS recovery")).rows[0].recovery;
  assert.equal(first.id, second.id);
  assert.equal(first.recovered_at, second.recovered_at);
  assert.equal(first.owner_id, 1);
  assert.equal(first.verified_by_name, 'Admin');
  assert.equal((await db.query('SELECT items_claimed FROM users WHERE id=1')).rows[0].items_claimed, 1);
  assert.equal((await db.query("SELECT count(*)::int AS count FROM activity_logs WHERE action='Item Claimed'")).rows[0].count, 1);
  assert.equal((await db.query('SELECT status FROM found_items WHERE id=20')).rows[0].status, 'claimed');
  assert.equal((await db.query('SELECT status FROM lost_items WHERE id=10')).rows[0].status, 'claimed');
});

test('unmatched, cancelled, ordinary resolved reports and non-admin actors cannot create recovery events', async t => {
  const db = await database(t);
  await assert.rejects(db.query("SELECT complete_item_recovery(10,20,1,'')"), /administrator/);
  await db.exec('DELETE FROM activity_logs');
  await assert.rejects(db.query("SELECT complete_item_recovery(10,20,2,'')"), /association/);
  await db.exec("INSERT INTO activity_logs(action,details) VALUES ('match','{\"lost_item_id\":10,\"found_item_id\":20}')");
  for (const status of ['cancelled', 'resolved', 'claimed', 'pending']) {
    await db.query('UPDATE lost_items SET status=$1 WHERE id=10', [status]);
    await assert.rejects(db.query("SELECT complete_item_recovery(10,20,2,'')"), /not eligible/);
  }
  assert.equal((await db.query('SELECT count(*)::int AS count FROM item_recoveries')).rows[0].count, 0);
});

test('active superadmins can verify handovers while suspended superadmins cannot', async t => {
  const db = await database(t);
  await db.exec("UPDATE users SET role='superadmin', status='suspended' WHERE id=2");
  await assert.rejects(db.query("SELECT complete_item_recovery(10,20,2,'')"), /administrator/);
  await db.exec("UPDATE users SET status='active' WHERE id=2");
  const recovered = (await db.query("SELECT complete_item_recovery(10,20,2,'') AS recovery")).rows[0].recovery;
  assert.equal(recovered.verified_by_id, 2);
  assert.equal(recovered.owner_id, 1);
});

test('a failed item update rolls back the recovery, both item states, counters and log', async t => {
  const db = await database(t);
  await db.exec(`CREATE FUNCTION reject_return() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated failure'; END; $$;
    CREATE TRIGGER reject_return BEFORE UPDATE ON found_items FOR EACH ROW EXECUTE FUNCTION reject_return();`);
  await assert.rejects(db.query("SELECT complete_item_recovery(10,20,2,'')"), /isolated failure/);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM item_recoveries')).rows[0].count, 0);
  assert.equal((await db.query('SELECT status FROM lost_items WHERE id=10')).rows[0].status, 'potential_match');
  assert.equal((await db.query('SELECT items_claimed FROM users WHERE id=1')).rows[0].items_claimed, 0);
  assert.equal((await db.query("SELECT count(*)::int AS count FROM activity_logs WHERE action='Item Claimed'")).rows[0].count, 0);
});

test('database feedback constraints reject duplicates, wrong kinds, ratings and oversized comments', async t => {
  const db = await database(t);
  const recovered = (await db.query("SELECT complete_item_recovery(10,20,2,'') AS recovery")).rows[0].recovery;
  const insert = "INSERT INTO feedback(user_id,user_name,kind,recovery_id,rating,request_id,comment) VALUES (1,'Owner',$1,$2,$3,$4,$5)";
  const id = '00000000-0000-4000-8000-000000000001';
  await db.query(insert, ['recovery', recovered.id, 5, id, 'Helpful']);
  await assert.rejects(db.query(insert, ['recovery', recovered.id, 4, '00000000-0000-4000-8000-000000000002', 'Again']), /unique/);
  for (const values of [['general', recovered.id, 5, id, ''], ['general', null, 6, id, ''], ['general', null, 5, id, 'x'.repeat(1001)]]) {
    await assert.rejects(db.query(insert, values), /constraint|unique/);
  }
});

test('end-to-end isolated flow persists a handover, student feedback and admin metrics through HTTP and real Postgres', async t => {
  const db = await database(t);
  await db.exec("UPDATE users SET google_subject='verified-owner' WHERE id=1");
  const repository = {
    user: async id => (await db.query('SELECT * FROM users WHERE id=$1', [id])).rows[0],
    recovery: async id => (await db.query('SELECT * FROM item_recoveries WHERE id=$1', [id])).rows[0],
    recoveries: async owner => (await db.query('SELECT * FROM item_recoveries' + (owner === undefined ? '' : ' WHERE owner_id=$1'), owner === undefined ? [] : [owner])).rows,
    feedback: async owner => (await db.query('SELECT * FROM feedback' + (owner === undefined ? '' : ' WHERE user_id=$1'), owner === undefined ? [] : [owner])).rows,
    trackingStart: async () => (await db.query('SELECT started_at FROM recovery_tracking')).rows[0].started_at,
    insertFeedback: async row => (await db.query('INSERT INTO feedback(user_id,user_name,kind,recovery_id,rating,comment,request_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *', [row.user_id,row.user_name,row.kind,row.recovery_id,row.rating,row.comment,row.request_id])).rows[0],
    completeRecovery: async (actor, lostId, details) => (await db.query('SELECT complete_item_recovery($1,$2,$3,$4) AS recovery', [lostId, details.found_item_id, actor.id, details.notes])).rows[0].recovery,
  };
  const secret = 'isolated-e2e-server-secret';
  const service = createRecoveryFeedbackService({ repository, jwtSecret: secret });
  const app = express();
  app.use(express.json());
  app.use('/api/feedback', createRecoveryFeedbackRouter(() => service));
  app.post('/api/lost-items/:id/claim', createRecoveryClaimHandler(() => service));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const admin = jwt.sign({ id: 2, role: 'admin' }, secret);
  const owner = jwt.sign({ id: 1, role: 'student', auth_method: 'google', google_subject: 'verified-owner' }, secret);
  async function call(path, session, body) {
    const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + session, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    assert.ok(response.ok, JSON.stringify(data));
    return data;
  }
  const claimed = await call('/lost-items/10/claim', admin, { found_item_id: 20, id_verified: true, knowledge_passed: true });
  assert.equal((await call('/feedback/recoveries', owner))[0].feedback, null);
  await call('/feedback', owner, { kind: 'recovery', recovery_id: claimed.recovery.id, rating: 5, comment: 'Helpful', request_id: '00000000-0000-4000-8000-000000000001' });
  await call('/feedback', owner, { kind: 'general', rating: 1, comment: 'Please improve search', request_id: '00000000-0000-4000-8000-000000000002' });
  assert.equal((await call('/feedback/recoveries', owner))[0].feedback.rating, 5);
  const summary = await call('/feedback/summary', admin);
  assert.equal(summary.confirmed_recoveries, 1);
  assert.equal(summary.satisfaction_percent, 100);
  assert.equal(summary.response_rate_percent, 100);
  assert.equal(summary.general_responses, 1);
  assert.equal((await call('/feedback', admin)).length, 2);
  const replay = await call('/lost-items/10/claim', admin, { found_item_id: 20, id_verified: true, knowledge_passed: true });
  assert.equal(replay.recovery.recovered_at, claimed.recovery.recovered_at);
});
