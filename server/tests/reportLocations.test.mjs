import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import express from 'express';

const require = createRequire(import.meta.url);
const httpFetch = globalThis.fetch;

for (const kind of ['lost', 'found']) {
  test(`${kind} reports preserve approved location names and additional info across JSON, upload, and update`, async t => {
    const rows = [];
    let locations = [{ name: 'AB BUILDING', is_active: true }];
    const client = { from(table) {
      if (table === 'qr_locations') return { select: () => ({ eq: async () => ({ data: locations, error: null }) }) };
      if (table === 'activity_logs') return { insert: async () => ({ error: null }) };
      return {
        select: (_fields, options) => options?.head ? Promise.resolve({ count: rows.length }) : {
          order: async () => ({ data: rows, error: null }),
          eq: (_key, id) => ({ single: async () => ({ data: rows.find(row => row.id === Number(id)), error: null }) }),
        },
        insert: data => ({ select: () => ({ single: async () => {
          const row = { id: rows.length + 1, ...data }; rows.push(row); return { data: row, error: null };
        } }) }),
        update: data => ({ eq: (_key, id) => ({ select: () => ({ single: async () => {
          const row = rows.find(row => row.id === Number(id)); Object.assign(row, data); return { data: row, error: null };
        } }) }) }),
      };
    } };
    const key = `report-test-${kind}`;
    globalThis[key] = client;
    // Replace only the external database dependency; exercise the real Express routes.
    const sourceUrl = new URL(`../routes/${kind}Items.js`, import.meta.url);
    const source = readFileSync(sourceUrl, 'utf8').replace(/from '([^']+)'/g, (_match, specifier) => {
      const resolved = specifier === '../db.js'
        ? `data:text/javascript,export default globalThis[${JSON.stringify(key)}]`
        : specifier.startsWith('.') ? new URL(specifier, sourceUrl).href : pathToFileURL(require.resolve(specifier)).href;
      return `from ${JSON.stringify(resolved)}`;
    });
    const router = (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default;
    const app = express(); app.use(express.json()); app.use('/', router);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    globalThis.fetch = async () => ({ ok: false, status: 503 });
    t.after(async () => { globalThis.fetch = httpFetch; delete globalThis[key]; await new Promise(resolve => server.close(resolve)); });
    const locationKey = kind === 'lost' ? 'location_lost' : 'location_found';
    const call = async (url, body, method = 'POST') => {
      const response = await httpFetch(`http://127.0.0.1:${server.address().port}${url}`, {
        method, headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
        body: body instanceof FormData ? body : JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    };
    const fields = { description: 'Blue bag', [locationKey]: 'AB BUILDING', location_details: '  Near the west stairs\nSecond floor  ' };
    for (const multipart of [false, true]) {
      const body = multipart ? new FormData() : fields;
      if (multipart) for (const [name, value] of Object.entries(fields)) body.set(name, value);
      const result = await call(multipart ? '/upload' : '/', body);
      assert.equal(result.status, 201);
      assert.equal(result.body[locationKey], 'AB BUILDING');
      assert.equal(result.body.location_details, 'Near the west stairs\nSecond floor');
    }
    const updated = await call('/1', { location_details: '  At the entrance  ' }, 'PUT');
    assert.equal(updated.status, 200);
    assert.equal(updated.body.location_details, 'At the entrance');
    const cleared = await call('/1', { location_details: '   ' }, 'PUT');
    assert.equal(cleared.body.location_details, null);
    const count = rows.length;
    locations = [];
    assert.equal((await call('/', fields)).status, 400, 'Removed locations must be rejected');
    assert.equal(rows.length, count);
    locations = null;
    assert.equal((await call('/', fields)).status, 503, 'Location lookup failures must stop submission');
    locations = [{ name: 'AB BUILDING', is_active: true }];
    for (const details of ['x'.repeat(501), { invalid: true }]) {
      assert.equal((await call('/', { ...fields, location_details: details })).status, 400);
    }
    assert.equal(rows.length, count);
    const blank = await call('/', { ...fields, location_details: '' });
    assert.equal(blank.status, 201);
    assert.equal(blank.body.location_details, null);
  });
}
