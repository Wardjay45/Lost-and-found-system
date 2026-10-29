import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareCandidateEmbeddings } from '../services/candidateEmbeddings.js';

test('native report candidates are prepared before matching; existing vectors are preserved and failures do not become zero scores', async () => {
 const updates = [], requests = [];
 const client = { from: table => ({ update: values => ({ eq: async (_field, id) => { updates.push({ table, values, id }); return { error: null }; } }) }) };
 const items = [{ id: 1, description: 'Cube', image: 'data:image/png;base64,AA==' }, { id: 2, description: 'Ready', text_embedding: [1], image_embedding: [2] }];
 await prepareCandidateEmbeddings(client, items, { fetcher: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return { ok: true, json: async () => ({ embedding: [1, 0] }) }; } });
 assert.equal(requests.length, 2); assert.equal(updates.length, 1); assert.deepEqual(items[1].text_embedding, [1]); assert.deepEqual(items[0].image_embedding, [1, 0]);
 await assert.rejects(prepareCandidateEmbeddings(client, [{ id: 3, description: 'Missing' }], { fetcher: async () => ({ ok: false }) }), /preparation failed/);
 assert.equal(updates.length, 1);
 await assert.rejects(prepareCandidateEmbeddings(client, [{ id: 3, description: 'Missing' }], { fetcher: async () => ({ ok: true, json: async () => ({}) }) }), /invalid text/);
});
