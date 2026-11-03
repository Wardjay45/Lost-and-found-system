import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryFixture } from './helpers/categoriesFixture.mjs';

test('category CRUD works through authenticated server storage while anonymous RLS remains read-only', async t => {
  const f = await categoryFixture();
  t.after(f.close);
  // Reproduce the original error without weakening the public policy.
  const blocked = await f.reader.from('categories').insert({ name: 'Unauthorized' }).select().single();
  assert.match(blocked.error.message, /row-level security/);
  assert.equal((await f.call('POST', '', { name: 'Unauthorized' }, '')).status, 401);
  assert.equal((await f.call('POST', '', { name: 'Unauthorized' }, 'forged')).status, 401);
  await f.db.exec("UPDATE users SET role='student' WHERE id=7");
  assert.equal((await f.call('POST', '', { name: 'Unauthorized' })).status, 403);
  await f.db.exec("UPDATE users SET role='admin', status='suspended' WHERE id=7");
  assert.equal((await f.call('DELETE', '/1')).status, 403);
  assert.equal(f.storageCalls, 0, 'Denied requests must never obtain privileged storage');
  await f.db.exec("UPDATE users SET status='active' WHERE id=7");

  for (const body of [{ name: '   ' }, { name: 'Bag', color: 'red' }, { name: 4 }, { name: 'Bag', auto_tagging: 'false' }]) {
    assert.equal((await f.call('POST', '', body)).status, 400);
  }
  assert.equal(f.storageCalls, 0, 'Invalid creates must not touch storage');
  const response = await f.call('POST', '', { name: '  Test Bags  ', icon: 'tag', color: '#123456', description: 'Test only', keywords: 'bag' });
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal(created.name, 'Test Bags');
  assert.equal(created.auto_tagging, true);
  assert.equal((await (await f.call('GET', '', undefined, '')).json()).length, 1);
  // Public writes still affect no rows.
  assert.deepEqual((await f.reader.from('categories').update({ name: 'Blocked' }).eq('id', created.id).select()).data, []);
  assert.deepEqual((await f.reader.from('categories').delete().eq('id', created.id).select()).data, []);

  await f.db.query("INSERT INTO lost_items(item_id,description,location_lost,category_id,category_name,category_icon) VALUES ('TEST-L','Test bag','Test campus',$1,'Test Bags','tag')", [created.id]);
  await f.db.query("INSERT INTO found_items(item_id,description,location_found,category_name,category_icon) VALUES ('TEST-F','Test bag','Test campus','Test Bags','tag')");
  const edited = await f.call('PUT', '/' + created.id, { name: 'Updated Bags', icon: 'bag', color: '#abcdef', description: 'Updated', keywords: 'bags' });
  assert.equal(edited.status, 200);
  assert.equal((await edited.json()).name, 'Updated Bags');
  assert.equal((await f.db.query('SELECT category_icon FROM lost_items')).rows[0].category_icon, 'bag');
  assert.equal((await f.db.query('SELECT category_icon FROM found_items')).rows[0].category_icon, 'bag');
  assert.equal((await (await f.call('GET', '/' + created.id)).json()).description, 'Updated');
  assert.equal((await f.call('PUT', '', { categories: [{ id: created.id, auto_tagging: false }] })).status, 200);
  assert.equal((await (await f.call('GET', '/' + created.id)).json()).auto_tagging, false);

  const referenced = await f.call('DELETE', '/' + created.id);
  assert.equal(referenced.status, 409);
  assert.match((await referenced.json()).error, /existing reports/);
  assert.equal((await f.db.query('SELECT count(*)::int AS n FROM lost_items')).rows[0].n, 1);
  await f.db.exec('DELETE FROM lost_items');
  assert.equal((await f.call('DELETE', '/' + created.id)).status, 200);
  assert.equal((await f.call('DELETE', '/' + created.id)).status, 404, 'Deleting no rows must not report success');
  assert.equal((await f.call('PUT', '/' + created.id, { name: 'Missing' })).status, 404);
  assert.equal((await f.call('GET', '/' + created.id)).status, 404);
  assert.equal((await f.call('DELETE', '/bad')).status, 400);
});

test('bulk and individual category database errors are not reported as successful saves', async t => {
  const f = await categoryFixture();
  t.after(f.close);
  const row = await (await f.call('POST', '', { name: 'Isolated test' })).json();
  assert.equal((await f.call('PUT', '', { categories: [{ id: row.id, auto_tagging: false }, { id: 999, auto_tagging: true }] })).status, 404);
  assert.equal((await (await f.call('GET', '/' + row.id)).json()).auto_tagging, true, 'Missing rows must be caught before any update');
  assert.equal((await f.call('PUT', '', { categories: [{ id: row.id, auto_tagging: 'false' }] })).status, 400);
  assert.equal((await f.call('PUT', '', { categories: [{ id: row.id, auto_tagging: true }, { id: row.id, auto_tagging: false }] })).status, 400);
  f.fault.table = 'categories'; f.fault.action = 'update';
  assert.equal((await f.call('PUT', '/' + row.id, { name: 'Failed' })).status, 503);
  const bulk = await f.call('PUT', '', { categories: [{ id: row.id, auto_tagging: false }] });
  assert.equal(bulk.status, 503);
  assert.match((await bulk.json()).error, /Unable to save all/);
  f.fault.action = 'delete';
  assert.equal((await f.call('DELETE', '/' + row.id)).status, 503);
  assert.equal((await (await f.call('GET', '/' + row.id)).json()).name, 'Isolated test');
  f.fault.table = 'lost_items'; f.fault.action = 'update';
  const icon = await f.call('PUT', '/' + row.id, { icon: 'bag' });
  assert.equal(icon.status, 503);
  assert.match((await icon.json()).error, /Category saved, but report icons/);
  f.fault.table = null;
  assert.equal((await f.call('PUT', '/' + row.id, { icon: 'bag' })).status, 200, 'A retry must repeat snapshot updates');
});
