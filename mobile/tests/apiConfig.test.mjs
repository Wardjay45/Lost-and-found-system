import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);

test('Google auth initialization uses the latest server address after saving and resetting settings', async () => {
  const source = require('@babel/core').transformSync(readFileSync(new URL('../src/config/api.js', import.meta.url), 'utf8'), {
    babelrc: false, configFile: false, plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  const storage = new Map();
  const context = vm.createContext({ exports: {}, console, process: { env: {} }, require(name) {
    if (name === '@react-native-async-storage/async-storage') return {
      getItem: async key => storage.get(key) || null,
      setItem: async (key, value) => storage.set(key, value),
      removeItem: async key => storage.delete(key),
    };
    if (name === 'expo-constants') return { expoConfig: { hostUri: '192.0.2.1:8081' } };
    throw Error('Unexpected config import: ' + name);
  } });
  vm.runInContext(source, context);
  const api = context.exports;
  assert.equal(await api.initApiUrl(), 'http://192.0.2.1:3001/api');
  assert.equal(await api.saveServerUrl('https://school.example/api/'), true);
  assert.equal(await api.initApiUrl(), 'https://school.example/api');
  assert.equal(await api.resetServerUrl(), true);
  assert.equal(await api.initApiUrl(), 'http://192.0.2.1:3001/api');
});
