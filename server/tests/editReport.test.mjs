import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditReportHandler } from '../services/editReport.js';

function fixture(kind, { conflict = false, dbError = false } = {}) {
  const current = { id: 1, item_id: 'REPORT-1', status: 'active', description: 'Old description', category_id: 2,
    last_updated: '2026-11-15T00:00:00Z', reporter_id: 5, finder_id: 5, location_lost: 'Library', location_found: 'Library', image: 'https://example.test/old.png' };
  let updates;
  const client = { from(table) {
    let writing = false;
    const query = { select: () => query, eq: () => query, is: () => query,
      update(value) { updates = value; writing = true; return query; },
      async maybeSingle() {
        if (dbError) return { error: new Error('private db info') };
        if (table === 'categories') return { data: { id: 3, name: 'Electronics', icon: 'phone', auto_tagging: true } };
        return { data: writing ? conflict ? null : { ...current, ...updates } : current };
      },
      then(resolve) { resolve({ data: [{ name: 'Office', is_active: true }] }); },
    };
    return query;
  } };
  const handler = createEditReportHandler({ client, kind, uploadImage: async () => 'https://example.test/new.png' });
  return { current, async call(body, role = 'admin') {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    await handler({ params: { id: '1' }, body, actor: { id: 7, role } }, res);
    return res;
  }, get updates() { return updates; } };
}

for (const kind of ['lost', 'found']) {
  test(`${kind} report details update preserves ownership/status and clears changed embeddings`, async () => {
    const f = fixture(kind);
    const result = await f.call({ description: '  New description ', category_id: 3, location_details: 'Near door',
      [kind === 'lost' ? 'location_lost' : 'location_found']: 'Office',
      [kind === 'lost' ? 'reporter_name' : 'finder_name']: 'Updated name', image: 'data:image/png;base64,YQ==',
      expected_last_updated: f.current.last_updated, ...(kind === 'found' ? { condition: 'Damaged', current_location: 'Security office' } : {}) });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.description, 'New description');
    assert.equal(result.body.category_name, 'Electronics');
    assert.equal(result.body.status, 'active');
    assert.equal(result.body.reporter_id, 5);
    assert.equal(result.body.text_embedding, null);
    assert.equal(result.body.image_embedding, null);
    assert.equal(result.body.image, 'https://example.test/new.png');
    assert.equal(result.body[kind === 'lost' ? 'location_lost' : 'location_found'], 'Office');
    if (kind === 'found') assert.equal(result.body.current_location, 'Security office');
  });
  test(`${kind} report rejects unauthorized, protected, invalid and stale updates`, async () => {
    assert.equal((await fixture(kind).call({ description: 'valid' }, 'student')).statusCode, 403);
    for (const body of [{ status: 'claimed' }, { reporter_id: 9 }, { description: ' ' }, { image: 'file:///private' }, { category_id: -1 }]) {
      assert.equal((await fixture(kind).call(body)).statusCode, 400);
    }
    assert.equal((await fixture(kind).call({ expected_last_updated: 'old' })).statusCode, 409);
    assert.equal((await fixture(kind, { conflict: true }).call({ description: 'valid' })).statusCode, 409);
    const failed = await fixture(kind, { dbError: true }).call({ description: 'valid' });
    assert.equal(failed.statusCode, 500);
    assert.doesNotMatch(failed.body.error, /private db info/);
  });
}
