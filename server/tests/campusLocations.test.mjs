import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import express from 'express';
import { requireReportLocation } from '../services/reportLocations.js';
import { loadReportLocations, requireReportLocation as requireMobileLocation } from '../../mobile/src/services/reporting.mjs';

test('admin creates, deactivates and reactivates the same approved location consumed by web and mobile reporting', async t => {
  const rows = [{ id: 1, name: 'AB BUILDING', is_active: true }];
  const history = [{ id: 1, location_lost: 'AB BUILDING' }];
  let id = 1;
  const client = { from(table) {
    assert.equal(table, 'qr_locations');
    return {
      select: () => ({ order: async () => ({ data: [...rows], error: null }), eq: () => {
        const active = rows.filter(row => row.is_active);
        return { then: resolve => resolve({ data: active, error: null }), order: async () => ({ data: active, error: null }) };
      } }),
      insert: fields => ({ select: () => ({ single: async () => { const row = { id: ++id, is_active: true, ...fields }; rows.push(row); return { data: row, error: null }; } }) }),
      update: fields => ({ eq: (_, key) => ({ select: () => ({ single: async () => {
        const row = rows.find(row => row.id === Number(key)); Object.assign(row, fields); return { data: row, error: null };
      } }) }) }),
    };
  } };
  globalThis.campusLocationTestClient = client;
  const require = createRequire(import.meta.url);
  const sourceUrl = new URL('../routes/qrLocations.js', import.meta.url);
  const source = readFileSync(sourceUrl, 'utf8').replace(/from '([^']+)'/g, (_, specifier) => `from ${JSON.stringify(specifier === '../db.js' ? 'data:text/javascript,export default globalThis.campusLocationTestClient' : specifier.startsWith('.') ? new URL(specifier, sourceUrl).href : pathToFileURL(require.resolve(specifier)).href)}`);
  const app = express(); app.use(express.json()); app.use('/', (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { delete globalThis.campusLocationTestClient; await new Promise(resolve => server.close(resolve)); });
  const request = (path, method, body) => fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await request('/', 'POST', { name: '   ' })).status, 400);
  const created = await (await request('/', 'POST', { name: '  Test Hall  ' })).json();
  assert.equal(created.name, 'Test Hall');
  assert.equal((await request(`/${created.id}`, 'PUT', { is_active: 'false' })).status, 400);
  assert.equal((await loadReportLocations(client)).length, 2);
  await requireMobileLocation(client, created.name); await requireReportLocation(client, created.name);
  await request(`/${created.id}`, 'PUT', { is_active: false });
  assert.equal((await loadReportLocations(client)).length, 1);
  await assert.rejects(requireMobileLocation(client, created.name)); await assert.rejects(requireReportLocation(client, created.name));
  await request(`/${created.id}`, 'PUT', { is_active: true });
  assert.equal((await loadReportLocations(client)).length, 2);
  assert.deepEqual(history, [{ id: 1, location_lost: 'AB BUILDING' }]);
  assert.deepEqual(rows[0], { id: 1, name: 'AB BUILDING', is_active: true });
});
