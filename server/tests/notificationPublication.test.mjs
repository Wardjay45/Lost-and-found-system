import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { adminPublicationTables as adminLiveTables } from '../../shared/adminLiveTables.mjs';
const migration = readFileSync(new URL('../enable-realtime-notifications.sql', import.meta.url), 'utf8');
test('notification publication migration can run twice and preserves existing publication tables', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  for (const name of [...adminLiveTables.filter(name => !['feedback', 'item_recoveries'].includes(name)), 'existing_table']) await db.exec('CREATE TABLE ' + name + ' (id serial primary key);');
  await db.exec('CREATE PUBLICATION supabase_realtime; ALTER PUBLICATION supabase_realtime ADD TABLE existing_table;');
  await db.exec(migration);
  await db.exec(migration);
  const { rows } = await db.query("SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename");
  assert.deepEqual(rows.map(row => row.tablename), [...adminLiveTables.filter(name => !['feedback', 'item_recoveries'].includes(name)), 'existing_table'].sort());
  // An older database can enable the optional tables after installing feedback.
  await db.exec('CREATE TABLE feedback (id serial primary key); CREATE TABLE item_recoveries (id serial primary key);');
  await db.exec(migration);
  const added = await db.query("SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename");
  assert.deepEqual(added.rows.map(row => row.tablename), [...adminLiveTables, 'existing_table'].sort());
});
