import test from 'node:test';
import assert from 'node:assert/strict';
import { claimDetailsFixture } from './helpers/claimDetailsFixture.mjs';
import { createRecoveryRepository } from '../services/recoveryRepository.js';
import { recoveryHours } from '../services/recoveryFeedback.js';

test('repository reads the linked found-report date and preserves handover date separately', async t => {
  const f = await claimDetailsFixture(); t.after(f.close);
  await f.db.exec(`UPDATE lost_items SET status='potential_match',date_reported='2026-10-01T00:00:00' WHERE id=10;
    UPDATE found_items SET status='potential_match',date_found='2026-10-01T06:00:00' WHERE id=20;
    INSERT INTO activity_logs(action,details) VALUES('match','{"lost_item_id":10,"found_item_id":20}');`);
  await f.complete();
  const repository = createRecoveryRepository(f.client);
  const [record] = await repository.recoveries(1);
  assert.equal(recoveryHours(record), 6);
  assert.notEqual(record.found_at, record.recovered_at);
  assert.equal((await repository.recoveries(99)).length, 0);
  assert.equal(Object.hasOwn(record, 'handover_image'), false);
});
