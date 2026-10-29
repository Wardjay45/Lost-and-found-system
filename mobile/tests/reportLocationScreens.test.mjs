import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as reporting from '../src/services/reporting.mjs';

const require = createRequire(import.meta.url);
const babel = require('@babel/core');
const approved = [{ id: 1, name: 'Library', is_active: true }];

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}

function reportScreen(screenName, { currentLocations = approved, selected = 'Library' } = {}) {
  const states = [];
  let cursor = 0;
  let refreshes = 0;
  const inserts = [];
  const effects = [];
  const alerts = [];
  const refs = [];
  let refIndex = 0;
  let firstRender = true;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useEffect(effect) { if (firstRender) effects.push(effect); },
    useRef(initial) {
      const index = refIndex++;
      if (!refs[index]) refs[index] = { current: initial };
      return refs[index];
    },
  };
  const native = Object.fromEntries(['View', 'Text', 'ScrollView', 'SafeAreaView', 'Image', 'ActivityIndicator', 'RefreshControl'].map(name => [name, name]));
  const client = { from(table) {
    if (table === 'categories') return { select: async () => ({ data: [{ id: 7, name: 'Bags', icon: 'bag' }], error: null }) };
    if (table === 'qr_locations') return { select: () => ({ eq: () => ({ order: async () => ({ data: currentLocations, error: null }) }) }) };
    return { insert(data) { inserts.push({ table, data }); return { select: () => ({ single: async () => ({ data: { id: 5 }, error: null }) }) }; } };
  } };
  const source = babel.transformSync(readFileSync(new URL(`../src/screens/${screenName}.js`, import.meta.url), 'utf8'), {
    babelrc: false, configFile: false,
    plugins: [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  const context = vm.createContext({ exports: {}, console: { log() {}, error() {} }, require(name) {
    if (name === 'react') return react;
    if (name === 'react-native') return { ...native, StyleSheet: { create: value => value }, Alert: { alert: (...args) => alerts.push(args) } };
    if (name === '@react-navigation/native') return { useRoute: () => ({ params: {} }) };
    if (name === 'expo-image-picker') return {};
    if (name.includes('SpeechControls')) return { TextInput: 'TextInput', TouchableOpacity: 'TouchableOpacity' };
    if (name.includes('SpeechInputModal')) return { default: 'SpeechInputModal', MicButton: 'MicButton', __esModule: true };
    if (name.includes('ReportLocationPicker')) return {
      default: 'ReportLocationPicker', __esModule: true,
      useReportLocations: () => ({ location: selected, setLocation() {}, locations: approved, locationsLoading: false, locationsError: '', refreshLocations: async () => { refreshes++; }, locationLocked: false }),
    };
    if (name.includes('AuthContext')) return { useAuth: () => ({ user: { id: 42, name: 'Student' } }) };
    if (name.includes('AccessibilityContext')) return {
      useThemedStyles: value => value,
      useAccessibility: () => ({ speak() {}, highContrast: true, scaledFontSize: size => size * 1.5, themeColors: { text: '#fff', muted: '#eee', accent: '#ffcc00' }, accessibilityStyles: { touch: { minHeight: 56 } } }),
    };
    if (name.includes('VoiceAssistant')) return { default: 'VoiceAssistant', __esModule: true };
    if (name.includes('FormIcon')) return { default: 'FormIcon', __esModule: true };
    if (name.includes('config/supabase')) return { default: client, __esModule: true };
    if (name.includes('services/reporting')) return reporting;
    throw Error('Unexpected import: ' + name);
  } });
  vm.runInContext(source, context);
  function render() {
    cursor = 0;
    refIndex = 0;
    const result = context.exports.default({ navigation: { goBack() {} } });
    firstRender = false;
    return result;
  }
  async function ready() {
    render();
    effects.forEach(effect => effect());
    await new Promise(resolve => setImmediate(resolve));
  }
  return { render, ready, inserts, alerts, refreshes: () => refreshes };
}

for (const screenName of ['ReportLostScreen', 'ReportFoundScreen']) {
  test(`${screenName}: admin dropdown and refresh preserve additional details and microphone transcription`, async () => {
    const view = reportScreen(screenName);
    let rendered = view.render();
    const picker = nodes(rendered).find(node => node.type === 'ReportLocationPicker');
    assert.ok(picker, 'Location must use the admin dropdown, not a free-text field');
    const icons = nodes(rendered).filter(node => node.type === 'FormIcon').map(node => node.props.name);
    for (const icon of [screenName === 'ReportLostScreen' ? 'search' : 'package', 'camera', 'mic', 'chevron-down']) assert.ok(icons.includes(icon), `Missing outline icon: ${icon}`);
    assert.equal(nodes(rendered).some(node => node.type === 'TextInput' && node.props.placeholder === 'Full name'), false, 'Account details must not be requested again');
    assert.doesNotMatch(JSON.stringify(rendered), /About you|Your Name/);
    assert.doesNotMatch(JSON.stringify(rendered), /📷|🎤|🔍|📦|🔒|▼/u);
    assert.equal(picker.props.value, 'Library');
    const refresh = nodes(rendered).find(node => node.type === 'ScrollView').props.refreshControl;
    assert.equal(refresh.type, 'RefreshControl');
    await refresh.props.onRefresh();
    assert.equal(view.refreshes(), 1);
    const detailsMic = nodes(rendered).filter(node => node.type === 'MicButton').find(node => {
      node.props.onPress();
      const modal = nodes(view.render()).find(item => item.type === 'SpeechInputModal');
      return modal.props.fieldName === 'Additional Info';
    });
    assert.ok(detailsMic, 'Additional Info must have a mic');
    rendered = view.render();
    nodes(rendered).find(node => node.type === 'SpeechInputModal').props.onResult('Near the west stairs');
    rendered = view.render();
    const details = nodes(rendered).find(node => node.type === 'TextInput' && node.props.accessibilityLabel?.startsWith('Additional information'));
    assert.equal(details.props.value, 'Near the west stairs');
    assert.equal(details.props.multiline, true);
    assert.equal(details.props.maxLength, 500);
    await refresh.props.onRefresh();
    assert.equal(nodes(view.render()).find(node => node.type === 'TextInput' && node.props.accessibilityLabel?.startsWith('Additional information')).props.value, 'Near the west stairs');
    assert.equal(nodes(rendered).filter(node => node.type === 'MicButton').length, 2);
  });

  test(`${screenName}: saves chosen location and spoken details, but rejects deactivated locations before insertion`, async () => {
    for (const currentLocations of [approved, []]) {
      const view = reportScreen(screenName, { currentLocations });
      await view.ready();
      let rendered = view.render();
      nodes(rendered).find(node => node.type === 'TextInput' && node.props.placeholder.startsWith('Describe')).props.onChangeText('Blue bag');
      const category = nodes(rendered).find(node => node.type === 'TouchableOpacity' && JSON.stringify(node.props.children).includes('Select category'));
      category.props.onPress();
      rendered = view.render();
      nodes(rendered).find(node => node.type === 'TouchableOpacity' && JSON.stringify(node.props.children).includes('Bags')).props.onPress();
      rendered = view.render();
      const details = nodes(rendered).find(node => node.type === 'TextInput' && node.props.accessibilityLabel?.startsWith('Additional information'));
      details.props.onChangeText('Near the stairs');
      rendered = view.render();
      const submit = nodes(rendered).find(node => node.type === 'TouchableOpacity' && JSON.stringify(node.props.children).includes('Submit Report'));
      await Promise.all([submit.props.onPress(), submit.props.onPress()]);
      if (currentLocations.length) {
        assert.equal(view.inserts.length, 1);
        const report = view.inserts[0];
        assert.equal(report.table, screenName === 'ReportLostScreen' ? 'lost_items' : 'found_items');
        assert.equal(report.data[screenName === 'ReportLostScreen' ? 'location_lost' : 'location_found'], 'Library');
        assert.equal(report.data.location_details, 'Near the stairs');
        assert.equal(report.data[screenName === 'ReportLostScreen' ? 'reporter_id' : 'finder_id'], 42);
        assert.equal(report.data[screenName === 'ReportLostScreen' ? 'reporter_name' : 'finder_name'], 'Student');
      } else {
        assert.equal(view.inserts.length, 0);
        assert.match(JSON.stringify(view.alerts), /Select an active location/);
      }
    }
  });
}
