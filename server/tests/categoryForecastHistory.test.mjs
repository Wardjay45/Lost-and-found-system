import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryForecastHistory } from '../services/reportForecastHistory.js';

test('category counts preserve current categories, zero months and date boundaries', () => {
  const history = categoryForecastHistory([
    { category_id: 1, category_name: 'Old name', created_at: '2025-01-20T00:00:00Z' },
    { category_id: 1, created_at: '2025-02-28T16:00:00Z' },
    { category_name: '', created_at: '2025-02-01T00:00:00Z' },
    { category_id: 1, created_at: '2025-05-03T00:00:00Z' },
  ], 'lost', [{ id: 1, name: 'Keys' }, { id: 2, name: 'Wallet' }], new Date('2025-05-15T00:00:00Z'));
  assert.deepEqual(history.categories, ['Keys', 'Uncategorized', 'Wallet']);
  assert.equal(history.historical.length, 9);
  assert.equal(history.historical.find(row => row.category === 'Keys' && row.ds === '2025-03-01').y, 1);
  assert.equal(history.historical.filter(row => row.category === 'Wallet').reduce((sum, row) => sum + row.y, 0), 0);
  assert.equal(history.historical.reduce((sum, row) => sum + row.y, 0), 2);
});
