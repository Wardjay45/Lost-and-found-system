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

test('standalone release always uses its bundled HTTPS API, even after upgrading an installation with a saved LAN server', async () => {
  const source = require('@babel/core').transformSync(readFileSync(new URL('../src/config/api.js', import.meta.url), 'utf8'), {
    babelrc: false, configFile: false, plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  let reads=0,writes=0;
  const context=vm.createContext({exports:{},console,__DEV__:false,process:{env:{EXPO_PUBLIC_API_URL:'https://campus.example/api/'}},require(name){
    if(name==='@react-native-async-storage/async-storage')return{getItem:async()=>{reads++;return 'http://192.168.2.11:3001/api';},setItem:async()=>writes++,removeItem:async()=>writes++};
    if(name==='expo-constants')return{expoConfig:{hostUri:'192.168.2.11:8081'}};
    throw Error('Unexpected config import '+name);
  }});vm.runInContext(source,context);const api=context.exports;
  assert.equal(api.API_URL,'https://campus.example/api'); assert.equal(api.isReleaseBuild,true);
  assert.equal(await api.initApiUrl(),'https://campus.example/api'); assert.equal(await api.getConfiguredServerUrl(),'https://campus.example/api');
  assert.equal(await api.saveServerUrl('http://192.168.2.11:3001/api'),false); assert.equal(await api.resetServerUrl(),false);
  assert.equal(await api.initApiUrl(),'https://campus.example/api');assert.equal(reads,0);assert.equal(writes,0);
});
