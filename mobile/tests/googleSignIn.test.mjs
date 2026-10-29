import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const source = require('@babel/core').transformSync(readFileSync(new URL('../src/services/googleSignIn.js', import.meta.url), 'utf8'), {
  babelrc: false, configFile: false, plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
}).code;

function selection({ code, stage = 'signIn', response = { type: 'success', data: { idToken: 'verified-token' } }, moduleError } = {}) {
  const native = {
    configure() {},
    async hasPlayServices() { if (stage === 'playServices') throw { code }; },
    async signOut() {},
    async signIn() { if (code) throw { code }; return response; },
  };
  const context = vm.createContext({ exports: {}, process: { env: { EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'web-client' } }, require(name) {
    if (name === 'react-native') return { Platform: { OS: 'android' } };
    if (name === '@react-native-google-signin/google-signin') {
      if (moduleError) throw moduleError;
      return { GoogleSignin: native, isSuccessResponse: value => value.type === 'success', statusCodes: { SIGN_IN_CANCELLED: '12501', IN_PROGRESS: 'ASYNC_OP_IN_PROGRESS', PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE' } };
    }
    throw Error('Unexpected import: ' + name);
  } });
  vm.runInContext(source, context);
  return context.exports.selectSchoolGoogleAccount();
}

test('Google OAuth configuration errors identify code 10 instead of blaming Play services', async () => {
  for (const code of ['10', 10, 'DEVELOPER_ERROR']) {
    const result = await selection({ code });
    assert.match(result.error, /configuration/i);
    assert.match(result.error, /SHA-1/);
    assert.doesNotMatch(result.error, /Play services/);
  }
});

test('unavailable Play services gets a specific recovery message', async () => {
  const result = await selection({ code: 'PLAY_SERVICES_NOT_AVAILABLE', stage: 'playServices' });
  assert.match(result.error, /update or enable Google Play services/i);
});

test('unclassified native failures preserve the error code without exposing raw messages', async () => {
  const result = await selection({ code: '7' });
  assert.match(result.error, /code: 7/);
  assert.doesNotMatch(result.error, /Play services/);
});

test('parallel Google operations show retry guidance', async () => {
  const result = await selection({ code: 'ASYNC_OP_IN_PROGRESS' });
  assert.match(result.error, /already in progress/i);
});

test('cancelled selections remain silent and successful selections return proof', async () => {
  assert.equal((await selection({ code: '12501' })).cancelled, true);
  assert.equal((await selection({ response: { type: 'cancelled' } })).cancelled, true);
  assert.equal((await selection()).idToken, 'verified-token');
});

test('missing native module still instructs installation of the correct build', async () => {
  const result = await selection({ moduleError: Error('RNGoogleSignin native module is missing') });
  assert.match(result.error, /Install the latest mobile app build/);
});
