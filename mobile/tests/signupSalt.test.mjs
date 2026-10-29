import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { signupSaltBytes } from '../src/services/signupSalt.mjs';
import { createAccount, hashSignupPassword } from '../src/services/signup.mjs';
import bcrypt from 'bcryptjs';

test('builds a 128-bit salt from two native UUIDs without fixed version or variant bits', () => {
  const values = ['00112233-4455-4677-8899-aabbccddeeff', '10213243-5465-4768-9a9b-bacbdcedfe0f'];
  let calls = 0;
  const salt = signupSaltBytes(() => values[calls++]);
  assert.equal(calls, 2);
  assert.deepEqual([...salt], [0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0xaa, 0xbb, 0x10, 0x21, 0x32, 0x43, 0x54, 0x65, 0xba, 0xcb]);
});

test('rejects missing, malformed, and non-random UUID sources', () => {
  assert.throws(() => signupSaltBytes(undefined), /salt unavailable/);
  for (const value of [undefined, '', 'garbage', '00112233-4455-1677-8899-aabbccddeeff', '00112233-4455-4677-0899-aabbccddeeff']) {
    assert.throws(() => signupSaltBytes(() => value), /salt unavailable/);
  }
});

test('Expo Core salt path produces different hashes that verify with existing bcrypt login', async () => {
  const randomSource = async () => signupSaltBytes(randomUUID);
  const first = await hashSignupPassword('student-password', randomSource);
  const second = await hashSignupPassword('student-password', randomSource);
  assert.notEqual(first, second);
  assert.equal(await bcrypt.compare('student-password', first), true);
  assert.equal(await bcrypt.compare('wrong-password', first), false);
});

test('a missing native UUID generator stops signup before writing and gives useful feedback', async t => {
  t.mock.method(console, 'error', () => {});
  let writes = 0;
  const client = { from: () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    insert: async () => { writes++; return { error: null }; },
  }) };
  const fields = { name: 'Student', email: 'student@university.edu', password: 'student-password', student_id: 'TEST-1', department: 'IC', gender: 'Prefer not to say' };
  const result = await createAccount(client, fields, () => signupSaltBytes(undefined));
  assert.match(result.error, /latest app build/);
  assert.equal(writes, 0);
});
