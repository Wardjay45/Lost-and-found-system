import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { activityLogQuery, activityView, activityTypes, filterActivities, legacyCancellationActor } from '../../shared/activityLogs.mjs';

const rows = [
  { id: 1, action: 'Item Claimed', user_name: 'Verifier', role: 'admin', timestamp: '2026-10-21T10:20:00', details: JSON.stringify({ text: 'Verified handover completed.', lost_item_id: 11, found_item_id: 22, notes: 'Owner verified' }) },
  { id: 2, action: 'match', user_name: 'Admin', details: JSON.stringify({ lost_item_id: 11, found_item_id: 22, lost_item_name: 'Blue bag', found_item_name: 'Bag', score: .86 }) },
  { id: 3, action: 'cancel', details: 'Report cancelled: duplicate' },
];

test('actual activity client omits undefined filters and sends the signed-in session on reads and writes', async () => {
  const originalFetch = globalThis.fetch, originalStorage = globalThis.localStorage;
  const requests = [];
  globalThis.localStorage = { getItem: () => 'isolated-session' };
  globalThis.fetch = async (url, options) => { requests.push({ url, ...options }); return { ok: true, json: async () => [] }; };
  try {
    const sourceUrl = new URL('../src/services/api.js', import.meta.url);
    const source = readFileSync(sourceUrl, 'utf8').replace('import.meta.env.VITE_API_URL', 'undefined').replace("'../../../shared/activityLogs.mjs'", JSON.stringify(new URL('../../shared/activityLogs.mjs', import.meta.url).href)).replace("'./liveNotifications.mjs'", JSON.stringify(new URL('../src/services/liveNotifications.mjs', import.meta.url).href));
    const { activityLogsApi } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    await activityLogsApi.getAll({ action: undefined });
    await activityLogsApi.create({ action: 'match', details: '{}' });
    assert.equal(requests[0].url, '/api/activity-logs');
    for (const request of requests) assert.equal(request.headers.Authorization, 'Bearer isolated-session');
  } finally { globalThis.fetch = originalFetch; globalThis.localStorage = originalStorage; }
});

test('All activities never sends an undefined action filter', () => {
  assert.equal(activityLogQuery({ action: undefined }), '');
  assert.equal(activityLogQuery({ action: 'all', limit: 25 }), '?limit=25');
  assert.equal(activityLogQuery({ action: 'claim' }), '?action=claim');
});

test('legacy claim names and cancellations are functional filters without losing historical events', () => {
  assert.equal(filterActivities(rows, 'claim', '')[0].id, 1);
  assert.equal(filterActivities(rows, 'cancel', 'duplicate')[0].id, 3);
  assert.equal(activityView(rows[2]).label, 'Cancelled by unknown');
  assert.equal(activityView({ ...rows[2], role: 'superadmin' }).label, 'Cancelled by Admin');
  assert.equal(activityView({ ...rows[2], role: 'student' }).label, 'Cancelled by User');
  assert.deepEqual(activityTypes(rows).map(type => type.value).sort(), ['cancel', 'claim', 'match']);
  assert.equal(activityTypes(rows).some(type => type.value === 'message'), false);
});

test('legacy cancellation attribution needs the report, reason, time and a consistent actor', () => {
  const report = { id: 3, item_id: 'LOST-3', cancel_reason: 'Duplicate', last_updated: '2026-11-09T13:00:00' };
  const mobile = { action: 'cancel', details: 'Report LOST-3 cancelled. Reason: Duplicate', role: 'student',
    user_name: 'Campus User', timestamp: '2026-11-09T13:00:00Z' };
  const admin = { ...mobile, details: 'Lost report #3 cancelled (status: cancelled) Reason: Duplicate.',
    role: 'admin', user_name: 'Staff' };
  assert.deepEqual(legacyCancellationActor(report, 'Lost', [mobile]), { role: 'student', name: 'Campus User' });
  assert.deepEqual(legacyCancellationActor(report, 'Lost', [admin]), { role: 'admin', name: 'Staff' });
  assert.equal(legacyCancellationActor(report, 'Lost', [admin, mobile]), null);
  assert.equal(legacyCancellationActor(report, 'Found', [mobile]), null);
  assert.equal(legacyCancellationActor(report, 'Lost', [{ ...mobile, timestamp: '2026-11-09T12:57:00Z' }]), null);
  assert.equal(legacyCancellationActor({ ...report, cancel_reason: 'Changed' }, 'Lost', [mobile]), null);
});

test('search covers report names, IDs, notes, actors, roles and recorded similarity', () => {
  for (const query of ['Blue bag', '86%', '22', 'Owner verified', 'Verifier', 'admin']) assert.ok(filterActivities(rows, 'all', query).length, query);
  assert.equal(filterActivities(rows, 'cancel', 'Blue bag').length, 0);
});

test('JSON details without text remain readable and historical claims do not become pending matches', () => {
  const match = activityView(rows[1]);
  assert.match(match.summary, /Blue bag/);
  assert.equal(match.similarity, 86);
  assert.equal(activityView(rows[0]).action, 'claim');
  assert.equal(activityView(rows[0]).notes, 'Owner verified');
  assert.equal(activityView(rows[0]).timestamp, '2026-10-21T10:20:00.000Z');
  assert.equal(activityView({ action: 'update', details: '{broken', timestamp: 'bad' }).timestamp, null);
  assert.equal(activityView({ action: 'update', details: '{broken' }).summary, 'Record updated');
  assert.match(activityView({ action: 'custom event', details: '{"reason":"Reviewed"}' }).summary, /Reviewed/);
});


test('activity summaries never expose structured metadata or duplicate match text', () => {
  const match = activityView({ action: 'match', details: JSON.stringify({ text: 'Verbose internal event', lost_item_id: 1, found_item_id: 2, lost_item_name: 'Blue bag', found_item_name: 'Bag', score: .96, image_score: .94, text_score: 1 }) });
  assert.equal(match.summary, 'Lost: Blue bag → Found: Bag (96% similarity)');
  for (const details of ['{"internal_id":123,"image_embedding":[1,2]}', '[1,2,3]', '{broken']) {
    assert.equal(activityView({ action: 'update', details }).summary, 'Record updated');
  }
  assert.equal(activityView({ action: 'cancel', details: 'Cancelled duplicate report.' }).summary, 'Cancelled duplicate report.');
  assert.equal(activityView({ action: 'update', details: { message: 'Report details updated.' } }).summary, 'Report details updated.');
});
