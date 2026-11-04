import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateHandoverImage } from '../services/handoverImage.js';
import { createRecoveryRepository } from '../services/recoveryRepository.js';
import { createRecoveryFeedbackService } from '../services/recoveryFeedback.js';
import { createRecoveryClaimHandler } from '../routes/recoveryFeedback.js';
import { createActivityLogsRouter } from '../routes/activityLogs.js';
import { claimDetailsFixture } from './helpers/claimDetailsFixture.mjs';

const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZcAAAAASUVORK5CYII=';

test('handover photos reject missing, non-image, spoofed, malformed and oversized payloads', () => {
  assert.equal(validateHandoverImage(photo), true);
  for (const invalid of [undefined, null, '', {}, 'https://example.invalid/photo.jpg', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,dGV4dA==', photo.replace('png', 'jpeg'), photo + '!', 'data:image/png;base64,' + 'A'.repeat(1400000)]) assert.equal(validateHandoverImage(invalid), false);
});

test('photo is required by the API and saved atomically with release, retained on retry and returned in claim history', async t => {
  const f = await claimDetailsFixture(); t.after(f.close);
  await f.db.exec(await readFile(new URL('../add-handover-photo.sql', import.meta.url), 'utf8'));
  await f.db.exec(`UPDATE lost_items SET status='potential_match' WHERE id=10; UPDATE found_items SET status='potential_match' WHERE id=20;
    INSERT INTO activity_logs(action,details) VALUES('match','{"lost_item_id":10,"found_item_id":20,"score":0.9}');`);
  const service = createRecoveryFeedbackService({ repository: createRecoveryRepository(f.client), jwtSecret: 'isolated-category-test-session' });
  f.app.post('/api/lost-items/:id/claim', createRecoveryClaimHandler(() => service));
  f.app.use('/api/activity-logs', createActivityLogsRouter({ client: f.client, jwtSecret: 'isolated-category-test-session' }));
  const headers = { Authorization: 'Bearer ' + f.token, 'Content-Type': 'application/json' };
  const details = { found_item_id: 20, id_verified: true, knowledge_passed: true, knowledge_answers: 'Q: What is inside? A: Blue lining and a small key.', notes: 'Released to the owner.' };
  const claim = body => fetch(f.origin + '/api/lost-items/10/claim', { method: 'POST', headers, body: JSON.stringify(body) });
  for (const handover_image of [undefined, '', 'data:image/png;base64,dGV4dA==']) assert.equal((await claim({ ...details, handover_image })).status, 400);
  assert.equal((await f.db.query('SELECT count(*)::int AS n FROM item_recoveries')).rows[0].n, 0);
  assert.equal((await f.db.query('SELECT status FROM lost_items WHERE id=10')).rows[0].status, 'potential_match');
  for (const knowledge_answers of [undefined, '', '   ', 'N/A', 'a'.repeat(1001)]) assert.equal((await claim({ ...details, handover_image: photo, knowledge_answers })).status, 400);
  await assert.rejects(f.db.query('SELECT complete_item_recovery_with_evidence(10,20,7,$1,$2,$3)', ['', photo, '']), /questions and answers/);
  // A failure while saving evidence must roll back statuses, counters and history.
  await f.db.exec(`CREATE FUNCTION reject_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated evidence failure'; END; $$;
    CREATE TRIGGER reject_evidence BEFORE INSERT ON item_recoveries FOR EACH ROW EXECUTE FUNCTION reject_evidence();`);
  assert.equal((await claim({ ...details, handover_image: photo })).status, 409);
  assert.equal((await f.db.query('SELECT status FROM found_items WHERE id=20')).rows[0].status, 'potential_match');
  await f.db.exec('DROP TRIGGER reject_evidence ON item_recoveries');
  const success = await claim({ ...details, handover_image: photo }); assert.equal(success.status, 200);
  const first = (await success.json()).recovery; assert.equal(first.handover_image, photo);
  assert.equal(first.knowledge_answers, details.knowledge_answers);
  const stored = (await f.db.query('SELECT knowledge_answers,notes FROM item_recoveries WHERE id=$1', [first.id])).rows[0];
  assert.deepEqual(stored, { knowledge_answers: details.knowledge_answers, notes: details.notes });
  const retry = await claim({ ...details, handover_image: photo }); assert.equal(retry.status, 200);
  assert.equal((await retry.json()).recovery.id, first.id);
  assert.equal((await f.db.query('SELECT items_claimed FROM users WHERE id=1')).rows[0].items_claimed, 1);
  assert.equal((await f.db.query("SELECT count(*)::int AS n FROM activity_logs WHERE action='Item Claimed'")).rows[0].n, 1);
  for (const path of ['lost_items/10', 'found_items/20']) {
    const response = await fetch(f.origin + '/api/activity-logs/claim/' + path, { headers });
    assert.equal(response.status, 200);
    const verification = (await response.json()).verification;
    assert.equal(verification.handover_image, photo); assert.equal(verification.knowledge_answers, details.knowledge_answers);
  }
  for (const role of ['anon', 'authenticated']) {
    await f.db.exec('SET ROLE ' + role);
    try { await assert.rejects(f.db.query('SELECT complete_item_recovery_with_evidence(10,20,7,$1,$2,$3)', ['', photo, details.knowledge_answers]), /permission denied/); }
    finally { await f.db.exec('RESET ROLE'); }
  }
});
