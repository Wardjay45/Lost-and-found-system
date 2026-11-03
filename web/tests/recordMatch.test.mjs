import test from 'node:test';
import assert from 'node:assert/strict';
import { recordPotentialMatch } from '../src/services/recordPotentialMatch.mjs';

test('marking a potential match is one server decision; client cannot update statuses before the pair is saved', async () => {
  const calls = [], match = { lost_item: { id: 11 }, found_item: { id: 22 }, score: .86, image_score: .85, text_score: .88 };
  const activityLogsApi = { create: async body => { calls.push(body); return { id: 7 }; } };
  assert.deepEqual(await recordPotentialMatch(match, { activityLogsApi }), { id: 7 });
  assert.equal(calls.length, 1); assert.equal(calls[0].mark_potential, true);
  assert.deepEqual(JSON.parse(calls[0].details), { lost_item_id: 11, found_item_id: 22, score: .86, image_score: .85, text_score: .88 });
  activityLogsApi.create = async () => { throw Error('Connection could not be saved'); };
  await assert.rejects(recordPotentialMatch(match, { activityLogsApi }), /could not be saved/);
});

test('float32 scores displayed as 100% are bounded before saving; invalid scores never send a write', async () => {
  const calls = [];
  const activityLogsApi = { create: async body => { calls.push(JSON.parse(body.details)); } };
  const match = { lost_item: { id: 11 }, found_item: { id: 22 }, score: .958, image_score: .94, text_score: 1.0000001192092896 };
  await recordPotentialMatch(match, { activityLogsApi });
  assert.equal(calls[0].text_score, 1);
  for (const score of [1.1, -1.1, NaN, Infinity, '0.9', null]) {
    await assert.rejects(recordPotentialMatch({ ...match, score }, { activityLogsApi }), /invalid similarity/);
  }
  assert.equal(calls.length, 1);
});
