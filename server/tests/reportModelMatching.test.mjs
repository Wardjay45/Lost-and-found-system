import test from 'node:test';
import assert from 'node:assert/strict';
import { matchReportsWithModel } from '../services/reportModelMatching.js';

test('selected models compute independent rankings and cache by content and model', async () => {
  const lost = [{ id: 101, description: 'query wallet pilot' }];
  const found = [{ id: 201, description: 'candidate wallet pilot' }, { id: 202, description: 'candidate cup pilot' }];
  const calls = [];
  const fetchAi = async (_url, options) => {
    const request = JSON.parse(options.body); calls.push(request);
    return new Response(JSON.stringify({ model: request.model, items: request.items.map(item => ({
      id: item.id, embedding: item.id.startsWith('lost:') ? [1, 0]
        : ((request.model === 'e5' ? item.id === 'found:201' : item.id === 'found:202') ? [1, 0] : [0, 1]),
    })) }));
  };
  const a = await matchReportsWithModel(lost, found, 'e5', { fetchAi });
  assert.equal(a.pairs[0].found.id, 201);
  await matchReportsWithModel(lost, found, 'e5', { fetchAi });
  assert.equal(calls.length, 1);
  const b = await matchReportsWithModel(lost, found, 'minilm', { fetchAi });
  assert.equal(b.pairs[0].found.id, 202);
  assert.equal(calls.length, 2);
  await matchReportsWithModel([{ ...lost[0], description: 'edited query' }], found, 'e5', { fetchAi });
  assert.equal(calls.length, 3);
  assert.equal(calls[2].items.length, 1);
});

test('missing modalities are excluded explicitly and malformed features fail visibly', async () => {
  const result = await matchReportsWithModel([{ id: 888 }], [{ id: 889 }], 'resnet50');
  assert.equal(result.skipped, 2); assert.equal(result.pairs.length, 0);
  await assert.rejects(() => matchReportsWithModel([{ id: 890, description: 'invalid features query' }], [{ id: 891, description: 'invalid features candidate' }], 'mpnet', {
    fetchAi: async () => new Response(JSON.stringify({ model: 'mpnet', items: [] })),
  }), /incomplete/);
  await assert.rejects(() => matchReportsWithModel([], [], 'toString'), /Unknown/);
});
