import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { loadReportLocations } from '../src/services/reporting.mjs';

const require = createRequire(import.meta.url);
const source = require('@babel/core').transformSync(readFileSync(new URL('../src/components/ReportLocationPicker.js', import.meta.url), 'utf8'), {
  babelrc: false, configFile: false,
  plugins: [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')],
}).code;
const library = { id: 1, name: 'Library', is_active: true };
const hall = { id: 2, name: 'New Hall', is_active: true };

function moduleView(fetchLocations) {
  const states = [];
  const refs = [];
  const effects = [];
  const effectDependencies = [];
  let stateIndex;
  let refIndex;
  let effectIndex;
  let focus;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useRef(initial) {
      const index = refIndex++;
      if (!refs[index]) refs[index] = { current: initial };
      return refs[index];
    },
    useCallback: callback => callback,
    useEffect(callback, dependencies) {
      const index = effectIndex++;
      if (!effectDependencies[index] || dependencies.some((value, position) => value !== effectDependencies[index][position])) effects.push(callback);
      effectDependencies[index] = dependencies;
    },
  };
  const client = { from: () => ({ select: () => ({ eq: () => ({ order: fetchLocations }) }) }) };
  const context = vm.createContext({ exports: {}, require(name) {
    if (name === 'react') return react;
    if (name === 'react-native') return { View: 'View', Text: 'Text', ScrollView: 'ScrollView', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: value => value } };
    if (name === '@react-navigation/native') return { useFocusEffect: callback => { focus = callback; } };
    if (name.includes('SpeechControls')) return { TouchableOpacity: 'TouchableOpacity' };
    if (name.includes('FormIcon')) return { default: 'FormIcon', __esModule: true };
    if (name.includes('config/supabase')) return { default: client, __esModule: true };
    if (name.includes('services/reporting')) return { loadReportLocations };
    if (name.includes('AccessibilityContext')) return { useThemedStyles: value => value, useAccessibility: () => ({ scaledFontSize: size => size * 1.5, themeColors: { accent: '#ffcc00' }, accessibilityStyles: { text: { color: '#fff' }, textMuted: { color: '#eee' }, touch: { minHeight: 56 } } }) };
    throw Error('Unexpected import: ' + name);
  } });
  vm.runInContext(source, context);
  function render(method, argument) {
    stateIndex = refIndex = effectIndex = 0;
    const result = context.exports[method](argument);
    effects.splice(0).forEach(effect => effect());
    return result;
  }
  return { hook: initial => render('useReportLocations', initial), picker: props => render('default', props), focus: () => focus() };
}

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}

const settle = () => new Promise(resolve => setImmediate(resolve));

test('focus and refresh load current admin locations, preserve valid choices, and clear removed choices', async () => {
  let rows = [library];
  const view = moduleView(async () => ({ data: rows, error: null }));
  view.hook('Library');
  const leave = view.focus();
  await settle();
  let state = view.hook('Library');
  assert.equal(state.location, 'Library');
  assert.equal(state.locationLocked, true);
  rows = [hall];
  await state.refreshLocations();
  state = view.hook('Library');
  assert.equal(state.locations[0].name, 'New Hall');
  assert.equal(state.location, '');
  assert.equal(state.locationLocked, false);
  state.setLocation('New Hall');
  state = view.hook('Library');
  await state.refreshLocations();
  state = view.hook('Library');
  assert.equal(state.location, 'New Hall');
  leave();
  rows = [library];
  view.focus();
  await settle();
  assert.equal(view.hook('Library').location, '');
});

test('invalid QR values cannot become approved dropdown selections', async () => {
  const view = moduleView(async () => ({ data: [library], error: null }));
  view.hook('Made up place');
  view.focus();
  await settle();
  const state = view.hook('Made up place');
  assert.equal(state.location, '');
  assert.equal(state.locationLocked, false);
});

test('refresh errors display a retry state and a later refresh recovers without fake locations', async () => {
  let fail = true;
  const view = moduleView(async () => ({ data: fail ? null : [library], error: fail ? Error('offline') : null }));
  view.hook();
  view.focus();
  await settle();
  const state = view.hook();
  assert.equal(state.locationsLoading, false);
  assert.equal(state.locations.length, 0);
  assert.match(state.locationsError, /Refresh/);
  fail = false;
  await state.refreshLocations();
  assert.equal(view.hook().locations.length, 1);
  assert.equal(view.hook().locationsError, '');
});

test('out-of-order refreshes and requests completing after blur cannot overwrite newer results', async () => {
  const pending = [];
  const view = moduleView(() => new Promise(resolve => pending.push(resolve)));
  const initial = view.hook();
  const first = initial.refreshLocations();
  const second = initial.refreshLocations();
  pending[1]({ data: [hall], error: null });
  await second;
  pending[0]({ data: [library], error: null });
  await first;
  assert.equal(view.hook().locations[0].name, 'New Hall');
  const leave = view.focus();
  leave();
  pending[2]({ data: [library], error: null });
  await settle();
  assert.equal(view.hook().locations[0].name, 'New Hall');
});

test('dropdown shows approved options, selects a name, and exposes Refresh at larger text sizes', () => {
  const view = moduleView();
  let selected;
  let refreshes = 0;
  const props = { value: '', locations: [library, hall], loading: false, error: '', disabled: false, locked: false, onChange: value => { selected = value; }, onRefresh: () => { refreshes++; } };
  let rendered = view.picker(props);
  nodes(rendered).find(node => node.props?.accessibilityLabel === 'Refresh locations').props.onPress();
  assert.equal(refreshes, 1);
  nodes(rendered).find(node => node.props?.accessibilityLabel === 'Select report location').props.onPress();
  rendered = view.picker(props);
  const options = nodes(rendered).filter(node => node.props?.accessibilityRole === 'radio');
  assert.deepEqual(options.map(node => node.props.accessibilityLabel), ['Library', 'New Hall']);
  options[1].props.onPress();
  assert.equal(selected, 'New Hall');
  assert.equal(nodes(view.picker(props)).filter(node => node.props?.accessibilityRole === 'radio').length, 0);
  for (const state of [{ loading: true }, { error: 'Unable to load' }, { locations: [] }, { locked: true }, { disabled: true }]) {
    rendered = view.picker({ ...props, ...state });
    assert.equal(nodes(rendered).find(node => node.props?.accessibilityLabel === 'Select report location').props.disabled, true);
  }
});
