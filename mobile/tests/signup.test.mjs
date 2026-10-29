import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { signupSaltBytes } from '../src/services/signupSalt.mjs';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import bcrypt from 'bcryptjs';
import { createAccount, validateSignupFields, hashSignupPassword } from '../src/services/signup.mjs';

const fields = { name: ' Test Student ', email: ' TEST@University.EDU.PH ', password: 'correct-password', student_id: ' 2026-TEST ', phone: '09171234567', department: 'Institute of Computing (IC)', gender: 'Female' };
const secureBytes = async size => new Uint8Array(randomBytes(size));
function fakeClient({ existing = null, lookupError = null, insertError = null } = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      assert.equal(table, 'users');
      return {
        select(columns) {
          assert.equal(columns, 'id');
          return { eq(column, value) {
            calls.push({ type: 'lookup', column, value });
            return { maybeSingle: async () => ({ data: existing, error: lookupError }) };
          } };
        },
        async insert(row) {
          calls.push({ type: 'insert', row });
          return { error: insertError };
        },
      };
    },
  };
}

test('normalizes university email and trims fields without changing the password', () => {
  const { data } = validateSignupFields(fields);
  assert.equal(data.email, 'test@university.edu.ph');
  assert.equal(data.name, 'Test Student');
  assert.equal(data.student_id, '2026-TEST');
  assert.equal(data.password, fields.password);
  assert.ok(validateSignupFields({ ...fields, email: 'student@school.edu', phone: '' }).data);
});

test('invalid signup fields never reach the database or random source', async () => {
  const client = fakeClient();
  for (const invalid of [{ name: '   ' }, { email: 'not-an-email.edu' }, { email: 'test@gmail.com' }, { password: 'short' }, { password: '🔒'.repeat(20) }, { student_id: ' ' }, { department: '' }, { phone: '123' }]) {
    const result = await createAccount(client, { ...fields, ...invalid }, () => { throw Error('must not hash'); });
    assert.ok(result.error, JSON.stringify(invalid));
  }
  assert.equal(client.calls.length, 0);
});

test('requires a supported gender and preserves the selection in the stored profile', async () => {
  for (const gender of ['', 'invalid']) {
    assert.ok(validateSignupFields({ ...fields, gender }).error);
  }
  const client = fakeClient();
  assert.deepEqual(await createAccount(client, { ...fields, gender: 'Prefer not to say' }, secureBytes), { success: true });
  assert.equal(client.calls[1].row.gender, 'Prefer not to say');
});

test('hashes successfully when both Web Crypto and Node crypto are absent', async () => {
  const context = vm.createContext({ module: { exports: {} }, exports: {}, require: () => ({}), setTimeout, clearTimeout, setImmediate, Uint8Array });
  vm.runInContext(readFileSync(new URL('../node_modules/bcryptjs/umd/index.js', import.meta.url), 'utf8'), context);
  context.bcrypt = context.module.exports;
  assert.throws(() => context.bcrypt.hashSync(fields.password, 10), /Neither WebCryptoAPI nor a crypto module/);
  const service = readFileSync(new URL('../src/services/signup.mjs', import.meta.url), 'utf8').replace("import bcrypt from 'bcryptjs';", '').replaceAll('export ', '');
  vm.runInContext(service + '\nglobalThis.hashSignupPassword = hashSignupPassword;', context);
  let requestedSize;
  const hash = await context.hashSignupPassword(fields.password, async size => { requestedSize = size; return signupSaltBytes(randomUUID); });
  assert.equal(requestedSize, 16);
  assert.match(hash, /^\$2b\$10\$/);
  assert.equal(await bcrypt.compare(fields.password, hash), true);
  assert.equal(await bcrypt.compare('wrong-password', hash), false);
});

test('uses a different salt for each password and rejects invalid random output', async () => {
  assert.notEqual(await hashSignupPassword(fields.password, secureBytes), await hashSignupPassword(fields.password, secureBytes));
  await assert.rejects(hashSignupPassword(fields.password, async () => new Uint8Array(4)), /salt unavailable/);
});

test('creates a student with a verifiable hash and returns success without selecting a user row', async () => {
  const client = fakeClient();
  assert.deepEqual(await createAccount(client, fields, secureBytes), { success: true });
  assert.deepEqual(client.calls[0], { type: 'lookup', column: 'email', value: 'test@university.edu.ph' });
  const { row } = client.calls[1];
  assert.equal(row.role, 'student');
  assert.equal(row.status, 'active');
  assert.equal(row.email, 'test@university.edu.ph');
  assert.equal(row.student_id, '2026-TEST');
  assert.equal(await bcrypt.compare(fields.password, row.password), true);
});

test('duplicate accounts stop before hashing or inserting', async () => {
  const client = fakeClient({ existing: { id: 1 } });
  assert.match((await createAccount(client, fields, () => { throw Error('must not hash'); })).error, /already exists/);
  assert.equal(client.calls.length, 1);
});

test('lookup failures stop before writing and permission errors have actionable feedback', async t => {
  t.mock.method(console, 'error', () => {});
  const client = fakeClient({ lookupError: { code: '42501' } });
  assert.match((await createAccount(client, fields, secureBytes)).error, /administrator/);
  assert.equal(client.calls.length, 1);
});

test('handles duplicate races, database errors, network failures, and crypto failures', async t => {
  t.mock.method(console, 'error', () => {});
  for (const [error, expected] of [[{ code: '23505', details: 'Key (email) already exists' }, /email already exists/], [{ code: '23505', details: 'Key (student_id) already exists' }, /student ID/], [{ code: 'PGRST204', message: 'internal schema details' }, /administrator/], [{ message: 'Failed to fetch' }, /internet connection/], [{ message: "Cannot find native module 'ExpoCrypto'" }, /latest app build/]]) {
    assert.match((await createAccount(fakeClient({ insertError: error }), fields, secureBytes)).error, expected);
  }
  const client = fakeClient();
  assert.match((await createAccount(client, fields, async () => { throw Error('native module unavailable'); })).error, /Unable to create/);
  assert.equal(client.calls.length, 1);
});

test('Google registration blocks concurrent requests and updates the session only after a complete profile', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const babel = require('@babel/core');
  const providerSource = babel.transformSync(readFileSync(new URL('../src/context/AuthContext.js', import.meta.url), 'utf8'), {
    babelrc: false, configFile: false,
    plugins: [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  for (const initialUser of [null, { id: 88, name: 'Existing User' }]) {
    const states = [initialUser, initialUser ? 'existing-session' : null, false];
    let stateIndex = 0;
    let resolveSignup;
    let calls = 0;
    const pending = new Promise(resolve => { resolveSignup = resolve; });
    const react = {
      createContext: () => ({ Provider: 'Provider' }),
      createElement: (type, props) => ({ type, props }),
      useState: () => { const index = stateIndex++; return [states[index], value => { states[index] = value; }]; },
      useRef: value => ({ current: value }),
      useContext: () => null,
    };
    const context = vm.createContext({ exports: {}, console, require: name => {
      if (name === 'react') return react;
      if (name === 'bcryptjs') return bcrypt;
      if (name.includes('config/api')) return { initApiUrl: async () => 'https://school.example/api' };
      if (name.includes('services/googleAuth')) return { requestGoogleAuth: async (url, endpoint, data) => {
        calls++;
        assert.equal(url, 'https://school.example/api');
        assert.equal(endpoint, 'google/signup');
        assert.equal(data.google_id_token, 'signed-token');
        return pending;
      } };
      if (name.includes('config/supabase')) return {};
      throw Error('Unexpected provider import: ' + name);
    } });
    vm.runInContext(providerSource, context);
    const provider = context.exports.AuthProvider({ children: null });
    const signup = provider.props.value.signup;
    const first = signup({ ...fields, google_id_token: 'signed-token' });
    assert.equal(states[2], true);
    assert.match((await signup({ ...fields, google_id_token: 'signed-token' })).error, /already in progress/);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 1);
    const result = { token: 'verified-session', user: { id: 99, gender: 'Female' } };
    resolveSignup(result);
    assert.deepEqual(await first, result);
    assert.equal(states[0], result.user);
    assert.equal(states[1], 'verified-session');
    assert.equal(states[2], false);
    await signup({ ...fields, google_id_token: 'signed-token' });
    assert.equal(calls, 2);
  }
});
