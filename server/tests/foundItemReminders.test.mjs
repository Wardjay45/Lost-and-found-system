import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createSettingsRouter } from '../routes/settings.js';
import { createProductionAccess } from '../services/productionAccess.js';
import { activityView } from '../../shared/activityLogs.mjs';

test('the scheduled job sends and logs only one reminder per eligible found report', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  const read = path => readFile(new URL(path, import.meta.url), 'utf8');
  const [schema, access, migration] = await Promise.all([
    read('../../supabase-schema.sql'),
    read('../secure-data-access.sql'),
    read('../../supabase/migrations/20261109125338_found_item_reminders.sql'),
  ]);
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  for (const table of ['categories', 'users', 'found_items', 'conversations', 'messages', 'activity_logs', 'qr_locations']) {
    const definition = schema.split('CREATE TABLE IF NOT EXISTS ' + table + ' (')[1].split(');')[0];
    await db.exec('CREATE TABLE ' + table + ' (' + definition + ');');
  }
  await db.exec(access);
  // PGlite provides Postgres without the pg_cron extension. Capture the real
  // migration's schedule registration and execute its registered command below.
  await db.exec(`CREATE SCHEMA cron;
    CREATE TABLE cron.test_schedule (name text, cadence text, command text);
    CREATE FUNCTION cron.schedule(text, text, text) RETURNS void LANGUAGE sql
      AS $$ INSERT INTO cron.test_schedule VALUES ($1, $2, $3) $$;`);
  await db.exec(migration.replace('CREATE EXTENSION IF NOT EXISTS pg_cron;', ''));
  const { rows: [job] } = await db.query('SELECT * FROM cron.test_schedule');
  assert.equal(job.name, 'found-item-turnover-reminders');
  assert.equal(job.cadence, '* * * * *');
  const run = async () => (await db.query(job.command)).rows[0].send_found_item_turnover_reminders;
  await db.exec(`INSERT INTO users (id, name, email, password, status) VALUES
    (20, 'Shared Name', 'finder@example.invalid', 'isolated', 'active'),
    (21, 'Shared Name', 'other@example.invalid', 'isolated', 'active'),
    (22, 'Inactive', 'inactive@example.invalid', 'isolated', 'inactive');
    INSERT INTO conversations (name, user_id) VALUES ('Shared Name', 21);
    INSERT INTO found_items (item_id, description, location_found, date_found, status, finder_id)
    SELECT code, 'Test', 'Campus', (now() AT TIME ZONE 'UTC') - age, status, finder
    FROM (VALUES
      ('DUE-1', interval '2 days', 'pending', 20), ('DUE-2', interval '3 days', 'pending', 20),
      ('RECENT', interval '1 minute', 'pending', 20), ('BETWEEN-DELAYS', interval '12 hours', 'pending', 20),
      ('RECEIVED', interval '2 days', 'active', 20),
      ('CANCELLED', interval '2 days', 'cancelled', 20), ('NO-FINDER', interval '2 days', 'pending', null),
      ('INACTIVE', interval '2 days', 'pending', 22)
    ) AS reports(code, age, status, finder);`);
  assert.equal(await run(), 0, 'disabled by default');
  for (const role of ['anon', 'authenticated']) {
    await db.exec('SET ROLE ' + role);
    await assert.rejects(db.query('UPDATE found_item_reminder_settings SET enabled = true'), { code: '42501' });
    await assert.rejects(db.query(job.command), { code: '42501' });
    await db.exec('RESET ROLE');
  }
  await db.exec(`SET ROLE service_role;
    UPDATE found_item_reminder_settings SET enabled = true, delay_hours = 48, message = 'Please bring it to OSDS.';
    RESET ROLE;
    ALTER TABLE activity_logs ADD CONSTRAINT simulate_log_failure CHECK (action <> 'turnover_reminder') NOT VALID;`);
  await assert.rejects(run(), { code: '23514' });
  assert.deepEqual((await db.query('SELECT id FROM messages')).rows, []);
  assert.deepEqual((await db.query('SELECT id FROM found_items WHERE turnover_reminded_at IS NOT NULL')).rows, []);
  await db.exec('ALTER TABLE activity_logs DROP CONSTRAINT simulate_log_failure');
  assert.equal(await run(), 2);
  assert.equal(await run(), 0, 'repeat invocations do not resend');
  const { rows: messages } = await db.query(`SELECT c.user_id, m.sender, m.text FROM messages m
    JOIN conversations c ON c.id::text = m.conversation_id ORDER BY m.id`);
  assert.deepEqual(messages, ['DUE-2', 'DUE-1'].map(code => ({
    user_id: 20, sender: 'admin', text: 'Please bring it to OSDS.\n\nFound report: ' + code,
  })));
  const { rows: logs } = await db.query('SELECT * FROM activity_logs ORDER BY id');
  assert.equal(logs.length, 2);
  assert.ok(logs.every(log => log.user_name === 'System' && log.role === 'system'));
  assert.equal(activityView(logs[0]).label, 'OSDS turnover reminder sent');
  assert.match(activityView(logs[0]).summary, /DUE-2/);
  await db.exec('UPDATE found_item_reminder_settings SET delay_hours = 8');
  assert.equal(await run(), 1, 'changing the delay makes the 12-hour pending report eligible');
  assert.deepEqual((await db.query("SELECT item_id FROM found_items WHERE turnover_reminded_at IS NOT NULL ORDER BY item_id")).rows,
    ['BETWEEN-DELAYS', 'DUE-1', 'DUE-2'].map(item_id => ({ item_id })));
  assert.equal(await run(), 0, 'changing the delay does not resend previous reminders');
});

test('reminder settings are administrator-only and validate a complete save', async t => {
  const secret = 'isolated-settings-test';
  let settings = { enabled: false, delay_hours: 24, message: 'Please bring it to OSDS.' };
  let failSave = false;
  let missingTable = false;
  const client = { from(table) {
    if (table === 'users') {
      return { select: () => ({ eq: (_key, id) => ({ maybeSingle: async () => ({
        data: { id, name: 'Fixture account', role: id === 1 ? 'admin' : 'student', status: 'active' },
      }) }) }) };
    }
    assert.equal(table, 'found_item_reminder_settings');
    let update;
    const query = {
      select: () => query,
      eq: (field, value) => { assert.equal(field, 'id'); assert.equal(value, 1); return query; },
      update: fields => { update = fields; return query; },
      single: async () => {
        if (missingTable) return { error: { code: 'PGRST205' } };
        if (update && failSave) return { error: new Error('Isolated save failure') };
        if (update) settings = update;
        return { data: settings };
      },
    };
    return query;
  } };
  const app = express();
  app.use(express.json());
  app.use('/api', createProductionAccess(client, { jwtSecret: secret }));
  app.use('/api/settings', createSettingsRouter(client));
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = 'http://127.0.0.1:' + server.address().port + '/api/settings/found-item-reminders';
  const token = (id, role) => jwt.sign({ id, role }, secret);
  const admin = { authorization: 'Bearer ' + token(1, 'admin') };
  const student = { authorization: 'Bearer ' + token(2, 'student') };
  const put = (data, headers = admin) => fetch(url, {
    method: 'PUT', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(data),
  });

  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: student })).status, 403);
  assert.equal((await put(settings, student)).status, 403);
  assert.deepEqual(await (await fetch(url, { headers: admin })).json(), settings);
  const replacement = { enabled: true, delay_hours: 72, message: '  Kindly bring it to OSDS.  ' };
  for (const invalid of [{ enabled: 'true' }, { delay_hours: 0 }, { delay_hours: 1.5 }, { message: ' ' }]) {
    assert.equal((await put({ ...replacement, ...invalid })).status, 400);
  }
  missingTable = true;
  const unavailable = await fetch(url, { headers: admin });
  assert.equal(unavailable.status, 503);
  assert.match((await unavailable.json()).error, /need database setup/);
  missingTable = false;
  failSave = true;
  assert.equal((await put(replacement)).status, 503);
  assert.equal(settings.enabled, false);
  failSave = false;
  assert.equal((await put(replacement)).status, 200);
  assert.deepEqual(await (await fetch(url, { headers: admin })).json(), {
    ...replacement, message: replacement.message.trim(),
  });
});
