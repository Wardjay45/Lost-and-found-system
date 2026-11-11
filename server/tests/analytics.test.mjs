import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createAnalyticsRouter } from '../routes/analytics.js';
import { readFileSync } from 'node:fs';

const secret = 'isolated-forecast-test';
const history = [{ ds: '2026-08-01', y: 2 }, { ds: '2026-09-01', y: 20 }, { ds: '2026-11-01', y: 4 }];
const result = {
  historical: history,
  forecast: [{ ds: '2026-12-01', yhat: 6, yhat_lower: 0, yhat_upper: 15 }],
  dataset: { name: 'UBC found-item records', description: 'Temporary found-item demonstration', source: 'Supplied CSV', temporary: true, observed_months: 3, total_records: 26, first_observed_month: '2026-08-01', last_observed_month: '2026-11-01', missing_month_count: 1, missing_months: ['2026-10-01'] },
  warnings: ['Experimental demonstration'], model: { name: 'Prophet', horizon_months: 1, yearly_seasonality: false, interval_width: .8 },
};
test('forecast proxy requires an active admin, forwards to Python, validates responses, and sanitizes failures', async t => {
  const actor = { id: 7, role: 'admin', status: 'active' };
  let status = 200, body = result, calls = 0, unavailable = false;
  const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: actor, error: null }) }) }) }) };
  const app = express(); app.use('/api/analytics', createAnalyticsRouter({ client, jwtSecret: secret, fetcher: async (url, options) => {
    calls++; assert.ok(url.endsWith('/api/analytics/forecast')); assert.ok(options.signal);
    if (unavailable) throw Error('private backend path');
    return { status, ok: status === 200, json: async () => body };
  } }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = 'http://127.0.0.1:' + server.address().port + '/api/analytics/forecast';
  const call = (role = 'admin', token = jwt.sign({ id: 7, role }, secret)) => fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  assert.equal((await call('admin', 'bad')).status, 401); assert.equal(calls, 0);
  actor.role = 'student'; assert.equal((await call('student')).status, 403); assert.equal(calls, 0);
  actor.role = 'admin'; actor.status = 'suspended'; assert.equal((await call()).status, 403);
  actor.status = 'active'; let response = await call(); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.deepEqual(await response.json(), result);
  actor.role = 'superadmin'; assert.equal((await call('superadmin')).status, 200); actor.role = 'admin';
  body = { ...result, forecast: [] }; assert.equal((await call()).status, 503);
  body = { ...result, forecast: ['2026-12-01', '2027-01-01', '2027-02-01'].map(ds => ({ ...result.forecast[0], ds })) }; assert.equal((await call()).status, 503);
  body = { ...result, model: { ...result.model, horizon_months: 3 } }; assert.equal((await call()).status, 503);
  body = { ...result, forecast: [{ ...result.forecast[0], yhat: NaN }, ...result.forecast.slice(1)] }; assert.equal((await call()).status, 503);
  status = 422; assert.equal((await call()).status, 422);
  status = 500; body = { detail: 'private backend path' }; response = await call(); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('private backend path'));
  unavailable = true; response = await call(); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('private backend path'));
});

test('both local and public server entry points mount the forecast API', () => {
  for (const entry of ['app.js', 'start-public.js']) assert.match(readFileSync(new URL('../' + entry, import.meta.url), 'utf8'), /app\.use\('\/api\/analytics', analyticsRouter\)/);
});

test('forecast timeframes forward to Python and reject unsupported or mismatched horizons', async t => {
  const actor = { id: 7, role: 'admin', status: 'active' };
  const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: actor, error: null }) }) }) }) };
  let wrongHorizon = false;
  const app = express();
  app.use('/api/analytics', createAnalyticsRouter({ client, jwtSecret: secret, fetcher: async url => {
    const timeframe = new URL(url).searchParams.get('timeframe') || 'monthly';
    const horizon = timeframe === 'yearly' && !wrongHorizon ? 12 : 1;
    return { ok: true, status: 200, json: async () => ({ ...result,
      model: { ...result.model, timeframe, horizon_months: horizon },
      forecast: Array.from({ length: horizon }, (_, index) => ({ ...result.forecast[0], ds: new Date(Date.UTC(2026, 11 + index, 1)).toISOString().slice(0, 10) })),
    }) };
  } }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = 'http://127.0.0.1:' + server.address().port + '/api/analytics/forecast?timeframe=';
  const headers = { Authorization: 'Bearer ' + jwt.sign({ id: 7, role: 'admin' }, secret) };
  for (const timeframe of ['weekly', 'monthly', 'yearly']) {
    const response = await fetch(base + timeframe, { headers }); assert.equal(response.status, 200);
    assert.equal((await response.json()).forecast.length, timeframe === 'yearly' ? 12 : 1);
  }
  assert.equal((await fetch(base + 'daily', { headers })).status, 400);
  wrongHorizon = true; assert.equal((await fetch(base + 'yearly', { headers })).status, 503);
});

test('campus route forwards separate aggregated lost and found histories and never substitutes sample data', async t => {
  const actor = { id: 7, role: 'admin', status: 'active' };
  const now = new Date();
  const dates = Array.from({length: 6}, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 7 + i, 15)).toISOString());
  let empty = false;
  const requested = [];
  const client = { from(table) { return { select() {
    if (table === 'users') return { eq: () => ({ maybeSingle: async () => ({data:actor}) }) };
    return { order: () => ({ range: async () => ({ data: empty ? [] : dates.map((created_at,id) => ({id,created_at})) }) }) };
  } }; } };
  const app = express();
  app.use('/api/analytics', createAnalyticsRouter({client, jwtSecret:secret, fetcher:async (_url, options) => {
    assert.equal(options.method, 'POST');
    const payload = JSON.parse(options.body); requested.push(payload.dataset.record_type);
    const historical = payload.historical;
    const last = new Date(historical.at(-1).ds + 'T00:00:00Z'); last.setUTCMonth(last.getUTCMonth()+1);
    return {ok:true,status:200,json:async () => ({...result,historical,
      forecast:[{...result.forecast[0],ds:last.toISOString().slice(0,10)}],
      dataset:{...payload.dataset,observed_months:historical.length,total_records:historical.reduce((n,r)=>n+r.y,0),first_observed_month:historical[0].ds,last_observed_month:historical.at(-1).ds,missing_months:[],missing_month_count:0}})};
  }}));
  const server = app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>{server.closeAllConnections();server.close();});
  const base = `http://127.0.0.1:${server.address().port}/api/analytics/forecast`;
  const headers = {Authorization:'Bearer '+jwt.sign({id:7,role:'admin'},secret)};
  for (const type of ['lost','found']) assert.equal((await fetch(base+`?source=campus&itemType=${type}`,{headers})).status,200);
  assert.deepEqual(requested,['lost_items','found_items']);
  empty = true;
  for (const source of ['campus', 'sample']) {
    const response = await fetch(base+`?source=${source}&itemType=lost`,{headers});
    assert.equal(response.status,422);
    const body = await response.json();
    assert.equal(body.code, 'FORECAST_HISTORY_UNAVAILABLE');
    assert.equal(body.forecast, undefined);
    assert.match(body.error, source === 'sample' ? /UBC.*found-item records only/ : /Not enough campus lost-report history/);
  }
  assert.equal(requested.length,2);
});
