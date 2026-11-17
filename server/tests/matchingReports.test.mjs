import test from 'node:test';
import assert from 'node:assert/strict';
import { readMatchingReports } from '../services/matchingReports.js';

function database(rows, { failMetadata = false, failPhoto = () => false } = {}) {
  const calls = [];
  let activePhotos = 0, peakPhotos = 0;
  return { calls, get peakPhotos() { return peakPhotos; }, from(table) {
    return { select(columns) { return { eq(field, value) { return {
      order(column) { assert.equal(column, 'id'); return this; },
      async range(start, end) {
        assert.equal(field, 'status'); assert.equal(value, 'active');
        assert.ok(end - start < 25);
        calls.push({ table, columns, start, end });
        return failMetadata ? { error: { code: '57014', message: 'canceling statement due to statement timeout' } }
          : { data: rows[table].filter(row => row.status === value).sort((a, b) => a.id - b.id).slice(start, end + 1) };
      },
      async maybeSingle() {
        assert.equal(field, 'id'); assert.equal(columns, 'image');
        calls.push({ table, columns, id: value });
        activePhotos++; peakPhotos = Math.max(peakPhotos, activePhotos);
        await new Promise(resolve => setImmediate(resolve)); activePhotos--;
        return failPhoto(table, value) ? { error: { code: '57014', message: 'statement timeout' } }
          : { data: rows[table].find(row => row.id === value) };
      },
    }; } }; } };
  } };
}

test('text matching pages all active reports without reading any photos or unrelated features', async () => {
  const rows = {
    lost_items: Array.from({ length: 57 }, (_, index) => ({ id: index + 1, status: 'active', description: 'Lost wallet', image: 'A'.repeat(1000000), text_embedding: [1, 0], image_embedding: [0, 1] })),
    found_items: [{ id: 100, status: 'active', description: 'Found wallet', image: 'A'.repeat(1000000) }],
  };
  const db = database(rows);
  const result = await readMatchingReports(db, 'e5');
  assert.equal(result.lostItems.length, 57); assert.equal(result.foundItems.length, 1);
  assert.equal(Object.hasOwn(result.lostItems[0], 'image'), false);
  assert.equal(Object.hasOwn(result.lostItems[0], 'image_embedding'), false);
  assert.deepEqual(result.lostItems[0].text_embedding, [1, 0]);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) < 20000);
  assert.ok(db.calls.every(call => !call.columns.split(',').includes('image')));
  assert.deepEqual(db.calls.filter(call => call.table === 'lost_items').map(call => call.start), [0, 25, 50]);
  db.calls.length = 0;
  const alternate = await readMatchingReports(db, 'minilm');
  assert.equal(Object.hasOwn(alternate.lostItems[0], 'text_embedding'), false);
  assert.ok(db.calls.every(call => !call.columns.includes('embedding')));
});

test('image reads have bounded concurrency, share photos across models, and invalidate revisions and statuses', async () => {
  const rows = {
    lost_items: Array.from({ length: 6 }, (_, id) => ({ id: id + 1, status: 'active', image: `photo-${id}`, last_updated: 'v1' })),
    found_items: [{ id: 20, status: 'active', image: 'found-photo', last_updated: 'v1' }],
  };
  const db = database(rows);
  const result = await readMatchingReports(db, 'clip');
  assert.equal(result.lostItems[0].image, 'photo-0');
  assert.equal(db.peakPhotos, 2);
  assert.equal(db.calls.filter(call => call.id).length, 7);
  await readMatchingReports(db, 'resnet50');
  assert.equal(db.calls.filter(call => call.id).length, 7);
  rows.lost_items[0].last_updated = 'v2'; rows.lost_items[0].image = 'edited-photo';
  rows.lost_items[1].status = 'claimed';
  const edited = await readMatchingReports(db, 'clip');
  assert.equal(edited.lostItems.length, 5);
  assert.equal(edited.lostItems[0].image, 'edited-photo');
  assert.equal(db.calls.filter(call => call.id).length, 8);
});

test('failed metadata and photo reads stay failures and a later photo retry can succeed', async () => {
  const rows = { lost_items: [{ id: 1, status: 'active', image: 'lost' }], found_items: [{ id: 2, status: 'active', image: 'found' }] };
  await assert.rejects(() => readMatchingReports(database(rows, { failMetadata: true }), 'e5'), error => error.status === 503 && error.code === '57014');
  let failed = true;
  const db = database(rows, { failPhoto: () => failed });
  await assert.rejects(() => readMatchingReports(db, 'clip'), /database took too long/);
  await new Promise(resolve => setImmediate(resolve)); failed = false;
  const retried = await readMatchingReports(db, 'clip');
  assert.equal(retried.lostItems[0].image, 'lost');
  assert.equal(retried.foundItems[0].image, 'found');
});
