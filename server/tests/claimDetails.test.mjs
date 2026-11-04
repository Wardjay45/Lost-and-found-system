import test from 'node:test';
import assert from 'node:assert/strict';
import { claimDetailsFixture } from './helpers/claimDetailsFixture.mjs';
import { loadClaimDetails } from '../services/claimDetails.js';
import { createActivityLogsRouter } from '../routes/activityLogs.js';
import { notificationSnapshot } from '../services/notifications.js';

test('saved claim loads comparison, Q&A and verified handover from either report through the protected API', async t => {
  const f = await claimDetailsFixture(); t.after(f.close);
  f.app.use('/api/activity-logs', createActivityLogsRouter({ client: f.client, jwtSecret: 'isolated-category-test-session' }));
  const base = f.origin + '/api/activity-logs';
  assert.equal((await fetch(base + '/claim/lost_items/10')).status, 401);
  const headers = { Authorization: 'Bearer ' + f.token, 'Content-Type': 'application/json' };
  const saved = await fetch(base, { method: 'POST', headers, body: JSON.stringify({ action: 'match', mark_potential: true, details: JSON.stringify({ lost_item_id: 10, found_item_id: 20, score: .92, image_score: .94, text_score: .87 }) }) });
  assert.equal(saved.status, 201);
  const pending = await notificationSnapshot(f.client);
  assert.equal([...pending.lost, ...pending.found].filter(row => row.status === 'potential_match').length, 2);
  const recovery = await f.complete();
  // A later unrelated association must not replace the completed handover.
  await f.db.exec(`INSERT INTO activity_logs(action,details,timestamp) VALUES('match','{"lost_item_id":10,"found_item_id":99,"score":0.1}',now()+interval '1 day');`);
  for (const path of ['/claim/lost_items/10', '/claim/found_items/20']) {
    const response = await fetch(base + path, { headers });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.match.lost_item.id, 10); assert.equal(data.match.found_item.id, 20);
    assert.equal(data.match.score, .92); assert.equal(data.match.image_score, .94); assert.equal(data.match.text_score, .87);
    assert.equal(data.match.lost_item.location_details, 'Second floor'); assert.equal(data.match.found_item.condition, 'Good');
    assert.equal(data.verification.recovery_id, recovery.id); assert.equal(data.verification.verified_by, 'Admin');
    assert.equal(data.verification.id_verified, true); assert.equal(data.verification.knowledge_passed, true);
    assert.match(data.verification.notes, /Blue lining/); assert.ok(data.verification.claimed_on);
    assert.equal(Object.hasOwn(data.match.lost_item, 'text_embedding'), false);
  }
  const completed = await notificationSnapshot(f.client);
  assert.equal([...completed.lost, ...completed.found].filter(row => row.status === 'potential_match').length, 0);
  assert.equal((await fetch(base + '/claim/users/10', { headers })).status, 400);
  f.fault.table = 'activity_logs'; f.fault.action = 'select';
  assert.equal((await fetch(base + '/claim/lost_items/10', { headers })).status, 503);
});

test('legacy claim logs preserve notes and do not invent verification or similarity values', async t => {
  const f = await claimDetailsFixture(); t.after(f.close);
  await f.db.exec(`UPDATE lost_items SET status='claimed' WHERE id=10; UPDATE found_items SET status='claimed' WHERE id=20;
    INSERT INTO activity_logs(action,details,user_name) VALUES('Item Claimed','{"lost_item_id":10,"found_item_id":20,"notes":"Q&A: Owner described the lining"}','Earlier admin');`);
  const details = await loadClaimDetails(f.client, 20, 'found_items');
  assert.equal(details.match.lost_item.id, 10); assert.equal(details.match.score, undefined);
  assert.equal(details.verification.verified_by, 'Earlier admin'); assert.match(details.verification.notes, /lining/);
  assert.equal(details.verification.id_verified, null); assert.equal(details.verification.knowledge_passed, null);
  assert.deepEqual(await loadClaimDetails(f.client, 999, 'lost_items'), { match: null, verification: null });
  await f.db.exec(`DELETE FROM activity_logs; INSERT INTO matches(lost_item_id,found_item_id,status,confidence) VALUES(10,20,'claimed',84);`);
  const oldMatch = await loadClaimDetails(f.client, 10, 'lost_items');
  assert.equal(oldMatch.match.score, .84); assert.equal(oldMatch.verification, null);
});

test('historical details still load when new evidence columns have not been installed', async t => {
  const f = await claimDetailsFixture(); t.after(f.close);
  await f.db.exec(`UPDATE lost_items SET status='potential_match' WHERE id=10; UPDATE found_items SET status='potential_match' WHERE id=20;
    INSERT INTO activity_logs(action,details,timestamp) VALUES('match','{"lost_item_id":10,"found_item_id":20,"score":0.91}','2026-10-01T00:00:00');`);
  await f.complete('Q&A: Described the blue lining.');
  await f.db.exec('ALTER TABLE item_recoveries DROP COLUMN handover_image; ALTER TABLE item_recoveries DROP COLUMN knowledge_answers;');
  const details = await loadClaimDetails(f.client, 20, 'found_items');
  assert.equal(details.match.score, .91);
  assert.equal(details.verification.notes, 'Q&A: Described the blue lining.');
  assert.equal(details.verification.handover_image, null);
  assert.equal(details.verification.knowledge_answers, null);
});
