import test from 'node:test';
import assert from 'node:assert/strict';
import { reportForecastHistory } from '../services/reportForecastHistory.js';

test('campus reporting history excludes partial edges, fills intervening zeros and uses Manila submission months', () => {
  const result = reportForecastHistory([
    { created_at: '2026-06-15T00:00:00Z' },
    { created_at: '2026-07-31T16:00:00Z' },
    { created_at: '2026-09-01T00:00:00Z' },
    { created_at: '2026-11-01T00:00:00Z' },
  ], 'lost', new Date('2026-11-11T00:00:00Z'));
  assert.deepEqual(result.historical, [
    { ds: '2026-07-01', y: 0 }, { ds: '2026-08-01', y: 1 },
    { ds: '2026-09-01', y: 1 }, { ds: '2026-10-01', y: 0 },
  ]);
  assert.equal(result.dataset.record_type, 'lost_items');
  assert.equal(result.dataset.temporary, false);
});

test('empty history stays empty and malformed dates fail instead of manufacturing counts', () => {
  assert.deepEqual(reportForecastHistory([], 'found').historical, []);
  assert.throws(() => reportForecastHistory([{ created_at: null }], 'lost'));
  assert.throws(() => reportForecastHistory([], 'other'));
});
