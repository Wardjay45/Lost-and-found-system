import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPotentialMatch } from '../src/services/potentialMatch.mjs';

test('comparison and release lookup use the same authenticated saved-pair endpoint', async () => {
  const match = { lost_item: { id: 11 }, found_item: { id: 22 }, score: .9 }, calls = [];
  assert.deepEqual(await loadPotentialMatch('11', 'lost_items', async (path, options) => { calls.push({ path, options }); return { match }; }), match);
  assert.equal(calls[0].path, '/activity-logs/match/lost_items/11'); assert.equal(calls[0].options.method, undefined);
  await loadPotentialMatch(22, 'found_items', async path => { assert.equal(path, '/activity-logs/match/found_items/22'); return { match }; });
});
test('missing saved association remains distinct from failed lookup and never guesses a pair', async () => {
  assert.equal(await loadPotentialMatch(11, 'lost_items', async () => ({ match: null })), null);
  await assert.rejects(loadPotentialMatch(11, 'lost_items', async () => { throw Error('offline'); }), /offline/);
  await assert.rejects(loadPotentialMatch(11, 'lost_items', async () => []), /association/);
});
test('invalid report inputs cannot query an arbitrary table', async () => {
  await assert.rejects(loadPotentialMatch('bad', 'users', async () => { throw Error('must not request'); }), /valid/);
});
