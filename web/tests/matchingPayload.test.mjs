import test from 'node:test';
import assert from 'node:assert/strict';
import { createReportPhotoLoader } from '../src/services/reportPhotos.mjs';
import { readJsonResponse } from '../src/services/jsonResponse.mjs';

test('matching photos share pending work, clear on session changes and retry failures', async () => {
  let calls = 0, session = 'first', fail = false;
  const load = createReportPhotoLoader(async () => {
    calls++;
    if (fail) throw new Error('Photo unavailable');
    return { image: 'data:image/png;base64,AA==' };
  }, () => session);
  const endpoint = '/ai/report-photo/lost/1?v=revision';
  assert.deepEqual(await Promise.all([load(endpoint), load(endpoint)]), ['data:image/png;base64,AA==', 'data:image/png;base64,AA==']);
  assert.equal(calls, 1);
  session = 'second'; await load(endpoint); assert.equal(calls, 2);
  fail = true;
  await assert.rejects(() => load(endpoint + '2'), /unavailable/);
  fail = false;
  await load(endpoint + '2'); assert.equal(calls, 4);
  await assert.rejects(() => load('https://other.example/photo'), /Invalid/);
});

test('non-JSON HTTP failures and invalid successful bodies have readable errors', async () => {
  await assert.rejects(() => readJsonResponse(new Response('Request Entity Too Large', { status: 413 })), /too much photo data/);
  await assert.rejects(() => readJsonResponse(new Response('Bad Gateway', { status: 502 })), /HTTP 502/);
  await assert.rejects(() => readJsonResponse(new Response('<html>login</html>')), /invalid response/);
  await assert.rejects(() => readJsonResponse(new Response('{"error":"Model busy","code":"AI_SERVICE_ERROR"}', { status: 502 })), error => error.message === 'Model busy' && error.code === 'AI_SERVICE_ERROR');
  assert.deepEqual(await readJsonResponse(new Response('[]')), []);
});
