import test from 'node:test';
import assert from 'node:assert/strict';
import { potentialMatchGroups, potentialReadReceipts, groupPotentialReports } from '../../shared/potentialMatchGroups.mjs';
import { acknowledgeRows, unreadRows } from '../../shared/notifications.mjs';
import { filterReportCollection } from '../src/services/reportCollections.mjs';

const lost = [{ id: 1, status: 'potential_match' }, { id: 2, status: 'potential_match' }];
const found = [{ id: 3, status: 'potential_match' }, { id: 4, status: 'potential_match' }];
const event = (id, lostId, foundId, action = 'match') => ({ id, action, timestamp: `2026-11-04T00:00:0${id}Z`, details: JSON.stringify({ lost_item_id: lostId, found_item_id: foundId }) });

test('two saved lost/found pairs are two notifications, and opening either side acknowledges one pair only', () => {
  const pairs = potentialMatchGroups(lost, found, [event(1, 1, 3), event(2, 2, 4)]);
  assert.equal(pairs.length, 2);
  const seen = acknowledgeRows([], [pairs.find(pair => pair.found_item_id === '3')]);
  assert.equal(unreadRows(pairs, seen).length, 1);
  assert.equal(unreadRows(pairs, acknowledgeRows(seen, pairs)).length, 0);
  assert.equal(potentialReadReceipts({ lost: ['1'] }, pairs).length, 1);
  assert.equal(potentialReadReceipts({ found: ['3'] }, pairs).length, 1);
});

test('a new match decision for the same reports is unread again, while old report views cannot clear it', () => {
  const before = potentialMatchGroups(lost, found, [event(1, 1, 3)]);
  const after = potentialMatchGroups(lost, found, [event(1, 1, 3), event(2, 1, 3, 'unmatch'), event(3, 1, 3)]);
  const pair = after.find(row => row.found_item_id === '3');
  assert.ok(!acknowledgeRows([], before).includes(pair.id));
  assert.deepEqual(potentialReadReceipts({ potential: [], lost: ['1'], found: ['3'] }, after), []);
});

test('similar text alone is never merged; explicit pair rows search/filter both reports without duplication', () => {
  const reports = [{ ...lost[0], reportType: 'lost', collectionKey: 'lost:1', description: 'Bag', reportedBy: 'Owner' }, { ...found[0], reportType: 'found', collectionKey: 'found:3', description: 'Bag', reportedBy: 'Finder', item_id: 'F3' }];
  const singles = potentialMatchGroups([lost[0]], [found[0]]);
  assert.equal(groupPotentialReports(reports, singles).length, 2);
  const grouped = groupPotentialReports(reports, potentialMatchGroups([lost[0]], [found[0]], [event(1, 1, 3)]));
  assert.equal(grouped.length, 1);
  for (const reportType of ['lost', 'found']) assert.equal(filterReportCollection(grouped, { reportType, search: 'Finder' }).length, 1);
  assert.equal(filterReportCollection(grouped, { search: 'F3' }).length, 1);
});
