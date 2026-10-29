import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import express from 'express';
import { createRecoveryFeedbackService, summarizeRecoveries } from '../services/recoveryFeedback.js';
import { createRecoveryFeedbackRouter, createRecoveryClaimHandler } from '../routes/recoveryFeedback.js';

const secret = 'isolated-recovery-feedback-test-secret';
const student = { id: 1, name: 'Student', role: 'student', status: 'active', google_subject: 'verified-subject' };
const admin = { id: 2, name: 'Verifier', role: 'admin', status: 'active' };
const recovery = { id: '00000000-0000-4000-8000-000000000010', lost_item_id: 10, found_item_id: 20, owner_id: 1, item_description: 'Blue bag', reported_at: '2026-10-01T00:00:00Z', recovered_at: '2026-10-03T00:00:00Z' };
const fields = { kind: 'recovery', recovery_id: recovery.id, rating: 5, comment: ' Helpful ', request_id: '00000000-0000-4000-8000-000000000020' };
const token = (user = student, extra = {}) => jwt.sign({ id: user.id, role: user.role, auth_method: 'google', google_subject: user.google_subject, ...extra }, secret);

function setup() {
  const feedback = [];
  const recoveries = [structuredClone(recovery)];
  const users = [structuredClone(student), structuredClone(admin), { ...student, id: 3, google_subject: 'other' }];
  const repository = {
    user: async id => users.find(user => user.id === id),
    recovery: async id => recoveries.find(record => record.id === id),
    recoveries: async owner => recoveries.filter(record => owner === undefined || record.owner_id === owner),
    feedback: async owner => feedback.filter(record => owner === undefined || record.user_id === owner),
    trackingStart: async () => '2026-10-01T00:00:00Z',
    async insertFeedback(record) {
      if (feedback.some(saved => saved.user_id === record.user_id && (saved.request_id === record.request_id || record.recovery_id && saved.recovery_id === record.recovery_id))) throw { code: '23505' };
      const saved = { id: String(feedback.length + 1), created_at: '2026-10-10T00:00:00Z', ...record };
      feedback.push(saved);
      return saved;
    },
    completeRecovery: async () => recovery,
  };
  return { service: createRecoveryFeedbackService({ repository, jwtSecret: secret }), repository, feedback, recoveries, users };
}

test('student feedback requires a current Google-bound server session; admin access rechecks role and status', async () => {
  const { service, users } = setup();
  assert.equal((await service.authorize(token(), 'student')).id, 1);
  for (const invalid of ['supabase-direct', token(student, { auth_method: 'password' }), token(student, { google_subject: 'wrong' }), token(admin)]) {
    await assert.rejects(service.authorize(invalid, 'student'), error => [401, 403].includes(error.status));
  }
  assert.equal((await service.authorize(token(admin), 'admin')).id, 2);
  await assert.rejects(service.authorize(token(), 'admin'), error => error.status === 403);
  users[0].status = 'suspended';
  await assert.rejects(service.authorize(token(), 'student'), error => error.status === 403);
  const unconfigured = createRecoveryFeedbackService({ repository: {}, jwtSecret: '' });
  await assert.rejects(unconfigured.authorize(token(), 'student'), error => error.status === 503);
});

test('feedback is owner-only, uses server-derived metadata, and never invents a recovery from a status', async () => {
  const { service, feedback } = setup();
  const result = await service.submit(student, { ...fields, user_id: 99, recovery_hours: 0, created_at: '2000-01-01' });
  assert.equal(result.user_id, 1);
  assert.equal(result.comment, 'Helpful');
  assert.equal(result.created_at, '2026-10-10T00:00:00Z');
  assert.equal(feedback[0].recovery_hours, undefined);
  assert.equal((await service.mine(student))[0].feedback.rating, 5);
  await assert.rejects(service.submit({ ...student, id: 3 }, fields), error => error.status === 403);
  await assert.rejects(service.submit(student, { ...fields, recovery_id: '00000000-0000-4000-8000-000000000099' }), error => error.status === 404);
  assert.equal((await service.mine({ ...student, id: 3 })).length, 0);
});

test('active superadmins retain admin recovery access without gaining student submission rights', async () => {
  const { service, users } = setup();
  users[1].role = 'superadmin';
  const actor = users[1];
  assert.equal((await service.authorize(token(actor), 'admin')).id, actor.id);
  assert.equal((await service.claim(actor, 10, { found_item_id: 20, id_verified: true, knowledge_passed: true })).recovery.id, recovery.id);
  await assert.rejects(service.authorize(token(actor, { role: 'admin' }), 'admin'), error => error.status === 403);
  await assert.rejects(service.authorize(token(actor), 'student'), error => error.status === 403);
  await assert.rejects(service.submit(actor, fields), error => error.status === 403);
  actor.status = 'suspended';
  await assert.rejects(service.authorize(token(actor), 'admin'), error => error.status === 403);
});

test('submission retries are idempotent and distinct second recovery feedback is rejected', async () => {
  const { service, feedback } = setup();
  const first = await service.submit(student, fields);
  assert.equal((await service.submit(student, fields)).id, first.id);
  await assert.rejects(service.submit(student, { ...fields, request_id: '00000000-0000-4000-8000-000000000021' }), error => error.status === 409);
  await assert.rejects(service.submit(student, { ...fields, rating: 1 }), error => error.status === 409);
  assert.equal(feedback.length, 1);
});

test('general feedback is stored separately; invalid ratings, comments, IDs and kinds never write', async () => {
  const { service, feedback } = setup();
  for (const invalid of [{ rating: 0 }, { rating: 6 }, { rating: 2.5 }, { comment: 'x'.repeat(1001) }, { request_id: '' }, { kind: 'admin' }, { kind: 'general' }]) {
    await assert.rejects(service.submit(student, { ...fields, ...invalid }), error => error.status === 400);
  }
  const result = await service.submit(student, { ...fields, kind: 'general', recovery_id: null });
  assert.equal(result.recovery_id, null);
  assert.equal(feedback.length, 1);
});

test('metrics include unrated returns once, exclude invalid durations and all general ratings, and report missing data as null', () => {
  const records = [recovery, { ...recovery, id: 'second', recovered_at: '2026-10-01T12:00:00Z' }, { ...recovery, id: 'bad', reported_at: null }];
  const ratings = [{ kind: 'recovery', recovery_id: recovery.id, rating: 5 }, { kind: 'general', rating: 1 }];
  const summary = summarizeRecoveries(records, ratings, '2026-10-01T00:00:00Z');
  assert.equal(summary.confirmed_recoveries, 3);
  assert.equal(summary.valid_durations, 2);
  assert.equal(summary.excluded_durations, 1);
  assert.equal(summary.average_hours, 30);
  assert.equal(summary.median_hours, 30);
  assert.equal(summary.satisfaction_percent, 100);
  assert.equal(summary.response_rate_percent, 33.3);
  assert.equal(summary.recovery_responses, 1);
  assert.equal(summary.general_responses, 1);
  assert.equal(summarizeRecoveries([], [], null).average_hours, null);
  assert.equal(summarizeRecoveries([], [], null).satisfaction_percent, null);
  assert.equal(summarizeRecoveries([], [], null).response_rate_percent, null);
});

test('handover validates admin, IDs and verification fields before invoking the atomic database operation', async () => {
  const { service, repository } = setup();
  let calls = 0;
  repository.completeRecovery = async (actor, lostId, details) => { calls++; assert.equal(actor.id, admin.id); assert.equal(lostId, 10); assert.equal(details.found_item_id, 20); return recovery; };
  const details = { found_item_id: 20, id_verified: true, knowledge_passed: true, verified_by: 'Forged name' };
  await assert.rejects(service.claim(student, 10, details), error => error.status === 403);
  for (const invalid of [{ found_item_id: 'bad' }, { id_verified: false }, { knowledge_passed: 'true' }]) await assert.rejects(service.claim(admin, 10, { ...details, ...invalid }), error => error.status === 400);
  assert.equal(calls, 0);
  assert.equal((await service.claim(admin, 10, details)).recovery.id, recovery.id);
  assert.equal(calls, 1);
});

test('real HTTP routes enforce sessions, preserve owner privacy, and expose admin-only summaries', async t => {
  const { service } = setup();
  const app = express();
  app.use(express.json());
  app.use('/api/feedback', createRecoveryFeedbackRouter(() => service));
  app.post('/api/lost-items/:id/claim', createRecoveryClaimHandler(() => service));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  assert.equal((await fetch(base + '/feedback/recoveries')).status, 401);
  assert.equal((await fetch(base + '/feedback/summary', { headers: { Authorization: 'Bearer ' + token() } })).status, 403);
  const submitted = await fetch(base + '/feedback', { method: 'POST', headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' }, body: JSON.stringify(fields) });
  assert.equal(submitted.status, 201);
  const summary = await fetch(base + '/feedback/summary', { headers: { Authorization: 'Bearer ' + token(admin) } });
  assert.equal(summary.status, 200);
  assert.equal((await summary.json()).recovery_responses, 1);
  assert.equal((await fetch(base + '/lost-items/10/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
});
