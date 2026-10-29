import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const migration = readFileSync(new URL('../enable-realtime-notifications.sql', import.meta.url), 'utf8');
test('notification publication migration can run twice and preserves existing publication tables', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  for (const name of ['lost_items', 'found_items', 'messages', 'conversations', 'existing_table']) await db.exec('CREATE TABLE ' + name + ' (id serial primary key);');
  await db.exec('CREATE PUBLICATION supabase_realtime; ALTER PUBLICATION supabase_realtime ADD TABLE existing_table;');
  await db.exec(migration);
  await db.exec(migration);
  const { rows } = await db.query("SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename");
  assert.deepEqual(rows.map(row => row.tablename), ['conversations', 'existing_table', 'found_items', 'lost_items', 'messages']);
});
