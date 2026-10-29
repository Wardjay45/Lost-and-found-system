import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadUserReports, validateReportFields, optionalLocationDetails, loadReportLocations, requireReportLocation } from '../src/services/reporting.mjs';

const schema = readFileSync(new URL('../../supabase-schema.sql', import.meta.url), 'utf8');
function tableColumns(table) {
  const definition = schema.split('CREATE TABLE IF NOT EXISTS ' + table + ' (')[1]?.split(');')[0];
  assert.ok(definition, 'Table must exist in the application schema: ' + table);
  return new Set(definition.trim().split('\n').map(line => line.trim().split(/\s+/)[0]));
}

function fakeClient(results) {
  const calls = [];
  return {
    calls,
    from(table) {
      return {
        select(fields) {
          return {
            eq(column, value) {
              calls.push({ table, fields, column, value });
              const columns = tableColumns(table);
              const missing = fields === '*' ? undefined : fields.split(',').map(field => field.trim()).find(field => !columns.has(field));
              if (missing) return Promise.resolve({ data: null, error: { code: '42703', message: 'column ' + table + '.' + missing + ' does not exist' } });
              return Promise.resolve(results[table]);
            },
          };
        },
      };
    },
  };
}

test('loads only the signed-in user reports and omits large fields in summary mode', async () => {
  const client = fakeClient({
    lost_items: { data: [{ id: 1 }], error: null },
    found_items: { data: [{ id: 2 }], error: null },
  });

  const reports = await loadUserReports(client, 42, { summary: true });

  assert.deepEqual(reports, { lost: [{ id: 1 }], found: [{ id: 2 }] });
  assert.deepEqual(client.calls.map(({ table, column, value }) => ({ table, column, value })), [
    { table: 'lost_items', column: 'reporter_id', value: 42 },
    { table: 'found_items', column: 'finder_id', value: 42 },
  ]);
  assert.ok(client.calls.every(({ fields }) => !fields.includes('image')));
});

test('reports backend errors instead of showing an empty list', async () => {
  const failure = new Error('database unavailable');
  const client = fakeClient({
    lost_items: { data: null, error: failure },
    found_items: { data: [], error: null },
  });
  await assert.rejects(loadUserReports(client, 42), failure);
});

test('rejects a missing user before querying reports', async () => {
  const client = fakeClient({});
  await assert.rejects(loadUserReports(client, null), /signed-in user/);
  assert.equal(client.calls.length, 0);
});
test('rejects whitespace-only fields and trims valid report details', () => {
  const base = { category: ' Keys ', location: ' Library ', name: ' Ada ', userId: 42 };
  assert.match(validateReportFields({ ...base, description: '   ' }).error, /Complete/);
  assert.doesNotMatch(validateReportFields({ ...base, description: '   ' }).error, /your name/);
  assert.match(validateReportFields({ ...base, description: 'Blue keys', name: '   ' }).error, /sign in again/i);
  assert.match(validateReportFields({ ...base, description: 'Blue keys', userId: null }).error, /sign in again/i);
  assert.deepEqual(validateReportFields({ ...base, description: ' Blue keys ' }), {
    error: null,
    cleanDescription: 'Blue keys',
    cleanCategory: 'Keys',
    cleanLocation: 'Library',
    cleanName: 'Ada',
  });
});

test('optional location details are trimmed and omitted when blank', () => {
  assert.deepEqual(optionalLocationDetails('  Near the west stairs  '), {
    location_details: 'Near the west stairs',
  });
  assert.deepEqual(optionalLocationDetails('   '), {});
  assert.deepEqual(optionalLocationDetails(undefined), {});
});

function locationClient(result) {
  const calls = [];
  return { calls, from(table) {
    assert.equal(table, 'qr_locations');
    return { select(fields) {
      calls.push(fields);
      assert.ok(fields.split(',').every(column => tableColumns(table).has(column)));
      return { eq(column, value) {
        assert.equal(column, 'is_active');
        assert.equal(value, true);
        return { order: async column => {
          assert.equal(column, 'name');
          return typeof result === 'function' ? result() : result;
        } };
      } };
    } };
  } };
}

test('report locations read the same active admin locations and reload additions without sample fallbacks', async () => {
  let rows = [{ id: 1, name: ' Library ', is_active: true }, { id: 2, name: 'Old Hall', is_active: false }, { id: 3, name: ' ', is_active: true }];
  const client = locationClient(() => ({ data: rows, error: null }));
  assert.deepEqual(await loadReportLocations(client), [{ id: 1, name: 'Library', is_active: true }]);
  rows = [{ id: 4, name: 'New Building', is_active: true }];
  assert.equal((await loadReportLocations(client))[0].name, 'New Building');
  rows = [];
  assert.deepEqual(await loadReportLocations(client), []);
  assert.equal(client.calls.length, 3);
});

test('locations fail closed on database errors and malformed responses', async () => {
  for (const result of [{ data: null, error: Error('private database failure') }, { data: null, error: null }]) {
    await assert.rejects(loadReportLocations(locationClient(result)), /Unable to load approved locations/);
  }
});

test('submission rechecks that the chosen or QR-prefilled location is still approved', async () => {
  let rows = [{ id: 1, name: 'Library', is_active: true }];
  const client = locationClient(() => ({ data: rows, error: null }));
  assert.equal(await requireReportLocation(client, ' Library '), 'Library');
  await assert.rejects(requireReportLocation(client, 'Arbitrary place'), /Select an active location/);
  rows = [];
  await assert.rejects(requireReportLocation(client, 'Library'), /Select an active location/);
});


test('Home summaries load both report dates from tables without created_at', async () => {
  assert.equal(tableColumns('lost_items').has('created_at'), false);
  assert.equal(tableColumns('found_items').has('created_at'), false);
  const lost = { id: 1, description: 'Keys', date_reported: '2026-10-03T01:00:00Z', location_lost: 'Library', status: 'pending' };
  const found = { id: 2, description: 'Wallet', date_found: '2026-10-02T02:00:00Z', location_found: 'Lobby', status: 'active' };
  const client = fakeClient({ lost_items: { data: [lost], error: null }, found_items: { data: [found], error: null } });
  const result = await loadUserReports(client, 42, { summary: true });
  assert.deepEqual(result, { lost: [lost], found: [found] });
  for (const { table, fields } of client.calls) {
    assert.ok(fields.split(',').map(field => field.trim()).includes(table === 'lost_items' ? 'date_reported' : 'date_found'));
  }
});
