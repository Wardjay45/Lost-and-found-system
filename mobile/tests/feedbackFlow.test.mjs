import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as feedback from '../src/services/feedback.mjs';

const require = createRequire(import.meta.url);
const returned = { id: '00000000-0000-4000-8000-000000000010', lost_item_id: 10, item_description: 'Blue bag', recovery_hours: 48, recovered_at: '2026-10-17T00:00:00Z', feedback: null };
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];

function harness({ records = [returned], values = new Map(), onPost = async body => ({ id: 'saved', ...body }), token = 'google-server-session', hook = false } = {}) {
  const state = [], refs = [], effects = [], dependencies = [], memo = [], cleanups = [];
  let stateIndex, refIndex, effectIndex, memoIndex;
  const posts = [];
  const route = { params: hook ? {} : { recoveryId: returned.id } };
  const react = {
    Fragment: 'Fragment', createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) { const index = stateIndex++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }]; },
    useRef(initial) { const index = refIndex++; if (!refs[index]) refs[index] = { current: initial }; return refs[index]; },
    useMemo(factory, deps) { const index = memoIndex++; if (!memo[index] || deps.some((value, position) => memo[index].deps[position] !== value)) memo[index] = { deps, value: factory() }; return memo[index].value; },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
    useEffect(effect, deps) { const index = effectIndex++; if (!dependencies[index] || deps.some((value, position) => dependencies[index][position] !== value)) { dependencies[index] = deps; effects.push(() => { cleanups[index]?.(); cleanups[index] = effect(); }); } },
  };
  const storage = { getItem: async key => values.get(key) || null, setItem: async (key, value) => values.set(key, value), removeItem: async key => values.delete(key) };
  const source = require('@babel/core').transformSync(readFileSync(new URL(hook ? '../src/components/RecoveryFeedback.js' : '../src/components/FeedbackForm.js', import.meta.url), 'utf8'), {
    babelrc: false, configFile: false, plugins: [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  const context = vm.createContext({ exports: {}, console, Set, require(name) {
    if (name === 'react') return react;
    if (name === 'react-native') return { View: 'View', Text: 'Text', ScrollView: 'ScrollView', SafeAreaView: 'SafeAreaView', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value } };
    if (name === '@react-navigation/native') return { useFocusEffect: callback => react.useEffect(callback, [callback]) };
    if (name.includes('async-storage')) return storage;
    if (name === 'expo-modules-core') return { uuid: { v4: () => '00000000-0000-4000-8000-000000000020' } };
    if (name.includes('SpeechControls')) return { TextInput: 'TextInput', TouchableOpacity: 'TouchableOpacity' };
    if (name.includes('FormIcon')) return { default: 'FormIcon', __esModule: true };
    if (name.includes('VoiceAssistant')) return { default: 'VoiceAssistant', __esModule: true };
    if (name.includes('AuthContext')) return { useAuth: () => ({ user: { id: 1 }, token, continueWithGoogle: async () => ({}) }) };
    if (name.includes('AccessibilityContext')) return { useThemedStyles: styles => styles, useAccessibility: () => ({ speak() {}, scaledFontSize: size => size * 1.5, themeColors: { text: '#fff', muted: '#ddd', accent: '#ffcc00', border: '#fff' }, accessibilityStyles: { touch: { minHeight: 56, minWidth: 56 } } }) };
    if (name.includes('config/api')) return { initApiUrl: async () => 'https://school.example/api' };
    if (name.includes('googleSignIn')) return { selectSchoolGoogleAccount: async () => ({ cancelled: true }) };
    if (name.includes('services/feedback')) return { ...feedback, requestFeedback: (api, path, session, options) => feedback.requestFeedback(api, path, session, options, async (url, request) => {
      if (request.method === 'POST') { const body = JSON.parse(request.body); posts.push(body); return { ok: true, json: async () => onPost(body) }; }
      return { ok: true, json: async () => records };
    }) };
    throw Error('Unexpected feedback import: ' + name);
  } });
  vm.runInContext(source, context);
  function render() {
    stateIndex = refIndex = effectIndex = memoIndex = 0;
    return hook ? context.exports.useRecoveryFeedback() : context.exports.default({ route, navigation: { goBack() {} } });
  }
  async function settle() {
    for (let pass = 0; pass < 5; pass++) { render(); effects.splice(0).forEach(effect => effect()); await new Promise(resolve => setImmediate(resolve)); }
    return render();
  }
  return { render, settle, posts, route, values, unmount: () => cleanups.forEach(cleanup => cleanup?.()), exports: context.exports };
}

test('recovery form shows real context, five accessible ratings and keeps failed submissions for a safe retry', async () => {
  const values = new Map();
  const screen = harness({ values, onPost: async () => { throw Error('network failed'); } });
  let tree = await screen.settle();
  assert.match(JSON.stringify(tree), /Blue bag/);
  assert.match(JSON.stringify(tree), /2 days/);
  const ratings = nodes(tree).filter(node => node.props?.accessibilityRole === 'radio');
  assert.equal(ratings.length, 5);
  ratings[3].props.onPress();
  nodes(tree).find(node => node.type === 'TextInput').props.onChangeText('Helpful staff');
  tree = await screen.settle();
  const submit = nodes(tree).find(node => node.props?.accessibilityLabel === 'Submit feedback');
  await Promise.all([submit.props.onPress(), submit.props.onPress()]);
  tree = await screen.settle();
  assert.equal(screen.posts.length, 1);
  assert.equal(nodes(tree).find(node => node.type === 'TextInput').props.value, 'Helpful staff');
  assert.match(JSON.stringify(tree), /Your draft is kept/);
  const retry = harness({ values });
  tree = await retry.settle();
  assert.equal(nodes(tree).find(node => node.type === 'TextInput').props.value, 'Helpful staff');
  assert.equal(nodes(tree).filter(node => node.props?.accessibilityRole === 'radio')[3].props.accessibilityState.checked, true);
  await nodes(tree).find(node => node.props?.accessibilityLabel === 'Submit feedback').props.onPress();
  tree = await retry.settle();
  assert.equal(retry.posts[0].request_id, screen.posts[0].request_id);
  assert.equal(values.size, 0);
  assert.match(JSON.stringify(tree), /feedback saved/);
  assert.equal(nodes(tree).filter(node => node.props?.accessibilityLabel === 'Submit feedback').length, 0);
});

test('saved feedback is read-only and unknown recoveries or local-only sessions cannot submit', async () => {
  const saved = harness({ records: [{ ...returned, feedback: { rating: 5, comment: 'Already saved' } }] });
  let tree = await saved.settle();
  assert.match(JSON.stringify(tree), /Already saved/);
  assert.equal(nodes(tree).filter(node => node.type === 'TextInput').length, 0);
  for (const options of [{ records: [] }, { token: 'supabase-direct' }]) {
    const screen = harness(options);
    tree = await screen.settle();
    assert.equal(nodes(tree).filter(node => node.props?.accessibilityLabel === 'Submit feedback').length, 0);
    assert.equal(screen.posts.length, 0);
    assert.ok(nodes(tree).some(node => node.props?.accessibilityRole === 'alert'));
  }
});

test('general app feedback does not include a recovery ID or measured recovery context', async () => {
  const screen = harness();
  screen.route.params = {};
  let tree = await screen.settle();
  assert.match(JSON.stringify(tree), /General App Feedback/);
  assert.doesNotMatch(JSON.stringify(tree), /Blue bag/);
  nodes(tree).find(node => node.props?.accessibilityRole === 'radio').props.onPress();
  tree = await screen.settle();
  await nodes(tree).find(node => node.props?.accessibilityLabel === 'Submit feedback').props.onPress();
  assert.equal(screen.posts[0].kind, 'general');
  assert.equal(screen.posts[0].recovery_id, null);
});

test('Later dismisses only the optional prompt and the recovery remains available for its persistent button', async () => {
  const screen = harness({ hook: true });
  let state = await screen.settle();
  assert.equal(state.prompt.id, returned.id);
  await state.dismissPrompt();
  state = await screen.settle();
  assert.equal(state.prompt, null);
  assert.equal(state.recoveries.length, 1);
  const button = screen.exports.RecoveryFeedbackButton({ recovery: returned, onPress() {} });
  assert.match(JSON.stringify(button), /Leave feedback/);
  const view = screen.exports.RecoveryFeedbackButton({ recovery: { ...returned, feedback: { rating: 5 } }, onPress() {} });
  assert.match(JSON.stringify(view), /View feedback/);
});

test('a delayed submission cannot replace a different feedback form', async () => {
  let finish;
  const screen = harness({ onPost: body => new Promise(resolve => { finish = () => resolve({ id: 'saved', ...body }); }) });
  let tree = await screen.settle();
  nodes(tree).find(node => node.props?.accessibilityRole === 'radio').props.onPress();
  tree = await screen.settle();
  const pending = nodes(tree).find(node => node.props?.accessibilityLabel === 'Submit feedback').props.onPress();
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  screen.route.params = {};
  await screen.settle();
  finish();
  await pending;
  tree = await screen.settle();
  assert.match(JSON.stringify(tree), /General App Feedback/);
  assert.doesNotMatch(JSON.stringify(tree), /feedback saved/);
  assert.ok(nodes(tree).some(node => node.props?.accessibilityLabel === 'Submit feedback' && !node.props.disabled));
});

test('an ambiguous general submission keeps an immutable pending payload across reloads until safely confirmed', async () => {
  const values = new Map();
  const screen = harness({ values, onPost: async () => { throw Error('response lost after server saved'); } });
  screen.route.params = {};
  let tree = await screen.settle();
  nodes(tree).find(node => node.props?.accessibilityRole === 'radio').props.onPress();
  nodes(tree).find(node => node.type === 'TextInput').props.onChangeText('Original comment');
  tree = await screen.settle();
  await nodes(tree).find(node => node.props?.accessibilityLabel === 'Submit feedback').props.onPress();
  const retry = harness({ values });
  retry.route.params = {};
  tree = await retry.settle();
  assert.equal(nodes(tree).find(node => node.type === 'TextInput').props.editable, false);
  assert.ok(nodes(tree).filter(node => node.props?.accessibilityRole === 'radio').every(node => node.props.disabled));
  assert.match(JSON.stringify(tree), /Retry to confirm/);
  await nodes(tree).find(node => node.props?.accessibilityLabel === 'Submit feedback').props.onPress();
  tree = await retry.settle();
  assert.deepEqual(retry.posts[0], screen.posts[0]);
  assert.match(JSON.stringify(tree), /feedback saved/);
  assert.equal(values.size, 0);
});

test('a stale successful submission cannot erase a newer general feedback draft', async () => {
  const values = new Map();
  let finish;
  const old = harness({ values, onPost: body => new Promise(resolve => { finish = () => resolve({ id: 'saved', ...body }); }) });
  old.route.params = {};
  let tree = await old.settle();
  nodes(tree).find(node => node.props?.accessibilityRole === 'radio').props.onPress();
  tree = await old.settle();
  const pending = nodes(tree).find(node => node.props?.accessibilityLabel === 'Submit feedback').props.onPress();
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  await old.settle();
  old.unmount();
  const retry = harness({ values });
  retry.route.params = {};
  tree = await retry.settle();
  await nodes(tree).find(node => node.props?.accessibilityLabel === 'Submit feedback').props.onPress();
  await retry.settle();
  retry.unmount();
  const fresh = harness({ values });
  fresh.route.params = {};
  tree = await fresh.settle();
  nodes(tree).find(node => node.type === 'TextInput').props.onChangeText('A different suggestion');
  await fresh.settle();
  finish();
  await pending;
  assert.equal(JSON.parse([...values.values()][0]).comment, 'A different suggestion');
});
