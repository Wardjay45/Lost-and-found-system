import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createGoogleAuthService } from '../../server/services/googleAuth.js';
import jwt from '../../server/node_modules/jsonwebtoken/index.js';
import express from '../../server/node_modules/express/index.js';
import { createGoogleAuthRouter } from '../../server/routes/googleAuth.js';
import { requestGoogleAuth } from '../src/services/googleAuth.mjs';

const identity = { sub: 'google-student-1', email: 'student@dnsc.edu.ph', email_verified: true, hd: 'dnsc.edu.ph', name: 'School Student' };
const fields = { google_id_token: 'signed-google-token', name: ' Student Name ', student_id: '2026-001', department: 'Institute of Computing (IC)', password: 'student-password', phone: '09171234567', gender: 'Female' };
const jwtSecret = 'isolated-test-secret-for-google-registration';

function setup({ payload = identity, rows = [], verificationError = false, databaseError = null, secret = jwtSecret } = {}) {
  const stored = structuredClone(rows);
  const client = { from(table) {
    assert.equal(table, 'users');
    return {
      select() { return { eq(column, value) { return { maybeSingle: async () => ({ data: stored.find(row => row[column] === value) || null, error: databaseError }) }; } }; },
      insert(row) { return { select() { return { single: async () => {
        if (databaseError) return { error: databaseError };
        const saved = { id: stored.length + 1, ...row };
        stored.push(saved);
        return { data: saved, error: null };
      } }; } }; },
    };
  } };
  const service = createGoogleAuthService({ client, clientId: 'school-client-id', jwtSecret: secret, allowedDomains: ['dnsc.edu.ph'], verifyIdToken: async options => {
    assert.equal(options.idToken, 'signed-google-token');
    assert.equal(options.audience, 'school-client-id');
    if (verificationError) throw Error('Invalid signature');
    return { getPayload: () => payload };
  } });
  return { service, stored };
}

test('Google verification returns a profile form without creating an account', async () => {
  const { service, stored } = setup();
  assert.deepEqual(await service.continueWithGoogle(fields), { registrationRequired: true, email: 'student@dnsc.edu.ph', name: 'School Student' });
  assert.equal(stored.length, 0);
});

test('rejects personal, other-school, unverified, missing-domain, and forged identities before writing', async () => {
  for (const payload of [
    { ...identity, email: 'student@gmail.com', hd: 'gmail.com' },
    { ...identity, email: 'student@other.edu.ph', hd: 'other.edu.ph' },
    { ...identity, email: 'student@dnsc.edu.ph.attacker.com' },
    { ...identity, email_verified: false },
    { ...identity, hd: undefined },
    { ...identity, sub: '' },
  ]) {
    const { service, stored } = setup({ payload });
    await assert.rejects(service.completeSignup(fields), error => error.status === 403);
    assert.equal(stored.length, 0);
  }
  const { service, stored } = setup({ verificationError: true });
  await assert.rejects(service.completeSignup(fields), error => error.status === 401);
  assert.equal(stored.length, 0);
});

test('stores verified Google identity and all required details, hashes password, and returns a safe session', async () => {
  const { service, stored } = setup();
  const result = await service.completeSignup({ ...fields, email: 'attacker@gmail.com', role: 'admin', google_subject: 'forged' });
  assert.equal(stored.length, 1);
  assert.equal(stored[0].email, 'student@dnsc.edu.ph');
  assert.equal(stored[0].google_subject, 'google-student-1');
  assert.equal(stored[0].name, 'Student Name');
  assert.equal(stored[0].gender, 'Female');
  assert.equal(stored[0].department, 'Institute of Computing (IC)');
  assert.equal(stored[0].phone, '09171234567');
  assert.equal(stored[0].role, 'student');
  assert.equal(await bcrypt.compare('student-password', stored[0].password), true);
  assert.equal(result.user.password, undefined);
  assert.equal(result.user.google_subject, undefined);
  assert.equal(jwt.verify(result.token, jwtSecret).id, 1);
  assert.equal(result.user.gender, 'Female');
});

test('missing details, invalid gender, weak password, and malformed phone create no profile', async () => {
  for (const invalid of [{ name: ' ' }, { student_id: '' }, { department: '' }, { gender: '' }, { gender: 'invalid' }, { password: 'short' }, { password: '🔒'.repeat(20) }, { phone: '123' }]) {
    const { service, stored } = setup();
    await assert.rejects(service.completeSignup({ ...fields, ...invalid }), error => error.status === 400);
    assert.equal(stored.length, 0);
  }
});

test('existing verified students can continue with Google; duplicate registration never overwrites details', async () => {
  const { service, stored } = setup({ rows: [{ id: 9, email: identity.email, google_subject: identity.sub, role: 'student', status: 'active', name: 'Existing Student' }] });
  const result = await service.continueWithGoogle(fields);
  assert.equal(result.user.id, 9);
  assert.equal(jwt.verify(result.token, jwtSecret).id, 9);
  await assert.rejects(service.completeSignup(fields), error => error.status === 409);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].name, 'Existing Student');
});

test('does not auto-link legacy accounts, mismatched Google subjects, admins, or suspended students', async () => {
  for (const overrides of [{ google_subject: null }, { google_subject: 'another-subject' }, { role: 'admin' }, { status: 'suspended' }, { status: 'archived' }]) {
    const { service } = setup({ rows: [{ id: 9, email: identity.email, google_subject: identity.sub, role: 'student', status: 'active', ...overrides }] });
    await assert.rejects(service.continueWithGoogle(fields), error => [403, 409].includes(error.status));
  }
});

test('fails closed for missing configuration and database failures', async () => {
  const { service, stored } = setup({ secret: '' });
  await assert.rejects(service.completeSignup(fields), error => error.status === 503);
  assert.equal(stored.length, 0);
  const unavailable = setup({ databaseError: { code: '42501', message: 'private database detail' } });
  await assert.rejects(unavailable.service.completeSignup(fields), error => error.status === 503 && !error.message.includes('private database detail'));
});

test('mobile-to-HTTP registration requires Google proof on both signup routes and returns a completed session', async t => {
  const { service, stored } = setup();
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createGoogleAuthRouter(() => service));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const beforeSignup = await requestGoogleAuth(base, 'google', { google_id_token: 'signed-google-token' });
  assert.equal(beforeSignup.registrationRequired, true);
  assert.equal(stored.length, 0);
  for (const endpoint of ['signup', 'google/signup']) {
    const response = await fetch(`${base}/auth/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fields, google_id_token: undefined }) });
    assert.equal(response.status, 401);
    assert.equal(stored.length, 0);
  }
  const completed = await requestGoogleAuth(base, 'google/signup', fields);
  assert.equal(completed.user.gender, 'Female');
  assert.equal(completed.user.email, 'student@dnsc.edu.ph');
  assert.equal(stored.length, 1);
  const signedIn = await requestGoogleAuth(base, 'google', { google_id_token: 'signed-google-token' });
  assert.equal(signedIn.user.id, completed.user.id);
});

test('mobile reports unreachable servers and rejects malformed success responses', async () => {
  assert.match((await requestGoogleAuth('https://school.example/api', 'google', {}, async () => { throw Error('offline'); })).error, /school server/);
  assert.match((await requestGoogleAuth('https://school.example/api', 'google', {}, async () => ({ ok: true, json: async () => ({}) }))).error, /Invalid sign-in response/);
});
