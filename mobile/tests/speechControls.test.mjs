import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as speech from '../src/services/speech.mjs';
import * as preferences from '../src/services/accessibilityPreferences.mjs';

const require = createRequire(import.meta.url);
const babel = require('@babel/core');
function compile(path) {
  return babel.transformSync(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    babelrc: false, configFile: false,
    plugins: [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
}
function controls(contextValue) {
  const react = { forwardRef: render => render, createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
  const context = vm.createContext({ exports: {}, require: name => {
    if (name === 'react') return react;
    if (name === 'react-native') return { TouchableOpacity: 'TouchableOpacity', Switch: 'Switch', TextInput: 'TextInput' };
    if (name.includes('AccessibilityContext')) return { useAccessibility: () => contextValue };
    if (name.includes('speech.mjs')) return speech;
    if (name.includes('accessibilityPreferences.mjs')) return preferences;
    throw Error('Unexpected control import: ' + name);
  } });
  vm.runInContext(compile('../src/components/SpeechControls.js'), context);
  return context.exports;
}

test('a button reads its visible label and preserves the original event and action', () => {
  const messages = [];
  const actions = [];
  const { TouchableOpacity } = controls({ speak: text => messages.push(text) });
  const event = { nativeEvent: { target: 1 } };
  const button = TouchableOpacity({ children: { props: { children: '🔤 Font Size ›' } }, onPress: value => { actions.push(value); return 'result'; } }, null);
  assert.equal(button.props.onPress(event), 'result');
  assert.deepEqual(messages, ['Font Size']);
  assert.deepEqual(actions, [event]);
});

test('controls expose roles, disabled state and minimum touch targets without losing selected state', () => {
  const { TouchableOpacity } = controls({ speak() {}, accessibilityStyles: { touch: { minHeight: 56, minWidth: 56 } } });
  const button = TouchableOpacity({ disabled: true, accessibilityState: { selected: true }, children: 'Save' }, null);
  assert.equal(button.props.accessibilityRole, 'button');
  assert.equal(button.props.accessibilityState.disabled, true);
  assert.equal(button.props.accessibilityState.selected, true);
  assert.equal(Object.assign({}, ...button.props.style).minHeight, 56);
});

test('icon-only buttons prefer explicit labels and disabled buttons do nothing', () => {
  const messages = [];
  let actions = 0;
  const { TouchableOpacity } = controls({ speak: text => messages.push(text) });
  const args = { accessibilityLabel: 'Show password', children: { props: { children: '👁️' } }, onPress: () => actions++ };
  TouchableOpacity(args, null).props.onPress({});
  TouchableOpacity({ ...args, disabled: true }, null).props.onPress({});
  assert.deepEqual(messages, ['Show password']);
  assert.equal(actions, 1);
});

test('input focus speaks the field name without reading entered passwords and preserves its ref', () => {
  const messages = [];
  let focused = 0;
  const ref = { current: null };
  const { TextInput } = controls({ speak: text => messages.push(text) });
  const field = TextInput({ accessibilityLabel: 'Password', value: 'secret-value', secureTextEntry: true, onFocus: () => focused++ }, ref);
  field.props.onFocus({});
  assert.deepEqual(messages, ['Password field']);
  assert.equal(focused, 1);
  assert.equal(field.props.value, 'secret-value');
  assert.equal(field.props.ref, ref);
});

test('a switch applies its new value before announcing, so turning TTS off stays silent', () => {
  const messages = [];
  let enabled = true;
  const { Switch } = controls({ speak: text => { if (enabled) messages.push(text); } });
  const toggle = Switch({ accessibilityLabel: 'Text to speech', onValueChange: value => { enabled = value; } }, null);
  toggle.props.onValueChange(false);
  assert.deepEqual(messages, []);
  toggle.props.onValueChange(true);
  assert.deepEqual(messages, ['Text to speech on']);
});

test('the actual accessibility provider stops speech immediately and old callbacks use the current flag', async () => {
  const calls = [];
  let stops = 0;
  const states = [];
  let stateIndex = 0;
  const react = {
    createElement: (type, props) => ({ type, props }), createContext: () => ({ Provider: 'Provider' }),
    useState: initial => { const index = stateIndex++; states[index] = initial; return [initial, value => { states[index] = value; }]; },
    useRef: value => ({ current: value }), useCallback: callback => callback, useMemo: factory => factory(), useEffect() {},
  };
  const context = vm.createContext({ exports: {}, require: name => {
    if (name === 'react') return react;
    if (name.includes('async-storage')) return {};
    if (name.includes('palette.mjs')) return { palettes: { dark: {} } };
    if (name.includes('speech.mjs')) return speech;
    if (name.includes('accessibilityPreferences.mjs')) return preferences;
    if (name === 'expo-speech') return { getAvailableVoicesAsync: () => Promise.resolve([]), stop: () => { stops++; return Promise.resolve(); }, speak: (text, options) => { calls.push(text); options.onStart(); } };
    throw Error('Unexpected provider import: ' + name);
  } });
  vm.runInContext(compile('../src/context/AccessibilityContext.js'), context);
  const provider = context.exports.AccessibilityProvider({ children: null });
  const { speak, setTtsEnabled } = provider.props.value;
  setTtsEnabled(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(states[0], true);
  assert.deepEqual(calls, ['Text to speech enabled']);
  const before = stops;
  setTtsEnabled(false);
  assert.equal(stops, before + 1);
  assert.equal(states[0], false);
  speak('An old timer retained this callback');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['Text to speech enabled']);
});
test('voice input controls preserve their action without reading into the microphone', () => {
  const messages = [];
  let actions = 0;
  const { TouchableOpacity } = controls({ speak: text => messages.push(text) });
  TouchableOpacity({ accessibilityLabel: 'Use voice input', speechFeedback: false, onPress: () => actions++ }, null).props.onPress({});
  assert.deepEqual(messages, []);
  assert.equal(actions, 1);
});
