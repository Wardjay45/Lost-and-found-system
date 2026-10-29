import test from 'node:test';
import assert from 'node:assert/strict';
import { readAll } from '../services/readAll.js';

test('report history reads past the database page limit and stops on the final page', async () => {
  const rows = Array.from({ length: 2001 }, (_, id) => ({ id }));
  const ranges = [];
  const result = await readAll({ range: async (start, end) => { ranges.push([start, end]); return { data: rows.slice(start, end + 1), error: null }; } });
  assert.equal(result.length, 2001);
  assert.deepEqual(ranges, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test('a failed history page never becomes a successful partial history', async () => {
  let page = 0;
  await assert.rejects(readAll({ range: async () => ++page === 1 ? { data: Array(1000).fill({}), error: null } : { data: null, error: Error('database unavailable') } }), /database unavailable/);
});
