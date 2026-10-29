import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createProductionAccess } from '../services/productionAccess.js';
import { createAuthRouter } from '../routes/auth.js';

test('hosted API requires current signed sessions and keeps student access separate from administrator writes', async t => {
  const secret = 'isolated-hosting-test-secret'; let actor = { id: 7, role: 'student', status: 'active' }, databaseError = false;
  const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: actor, error: databaseError ? Error('offline') : null }) }) }) }) };
  const app = express(); app.use(createProductionAccess(client, { jwtSecret: secret })); app.use((_req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); t.after(() => { server.closeAllConnections(); server.close(); });
  const token = role => jwt.sign({ id: 7, role }, secret);
  const call = (path, method = 'GET', session = token(actor.role)) => fetch('http://127.0.0.1:' + server.address().port + path, { method, headers: { Authorization: 'Bearer ' + session } });
  assert.equal((await call('/users', 'GET', 'bad')).status, 401);
  assert.equal((await call('/lost-items')).status, 200); assert.equal((await call('/qr-locations')).status, 200);
  assert.equal((await call('/ai/match', 'POST')).status, 200); assert.equal((await call('/speech-to-text', 'POST')).status, 200);
  assert.equal((await call('/users')).status, 403); assert.equal((await call('/messages')).status, 403);
  assert.equal((await call('/ai/embed', 'POST')).status, 403); assert.equal((await call('/lost-items/11/status', 'PUT')).status, 403);
  actor.role = 'admin'; assert.equal((await call('/users')).status, 200); assert.equal((await call('/lost-items/11/status', 'PUT')).status, 200);
  actor.status = 'suspended'; assert.equal((await call('/users')).status, 403); actor.status = 'active';
  assert.equal((await call('/users', 'GET', token('student'))).status, 403);
  databaseError = true; assert.equal((await call('/users')).status, 503);
});

test('password login verifies the stored bcrypt password, rejects the old bypass and issues signed sessions for mobile and web', async t => {
  const secret = 'isolated-password-test-secret'; const user = { id: 7, email: 'qa@example.invalid', name: 'QA Admin', role: 'admin', status: 'active', password: await bcrypt.hash('correct-fixture-password', 4), phone: 'QA phone', gender: 'Prefer not to say' };
  let updated = 0;
  const client = { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: structuredClone(user), error: null }) }) }), update: () => ({ eq: async () => { updated++; return { error: null }; } }) }) };
  const app = express(); app.use(express.json()); app.use('/', createAuthRouter({ client, jwtSecret: secret }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); t.after(() => { server.closeAllConnections(); server.close(); });
  const call = password => fetch('http://127.0.0.1:' + server.address().port + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, password }) });
  assert.equal((await call('admin123')).status, 401); assert.equal(updated, 0);
  const success = await call('correct-fixture-password'); assert.equal(success.status, 200); const result = await success.json();
  assert.equal(jwt.verify(result.token, secret).id, 7); assert.equal(result.user.phone, 'QA phone'); assert.equal('password' in result.user, false);
  user.status = 'suspended'; assert.equal((await call('correct-fixture-password')).status, 403); assert.equal(updated, 1);
});
