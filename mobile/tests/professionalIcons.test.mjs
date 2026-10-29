import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { palettes } from '../src/theme/palette.mjs';

const require = createRequire(import.meta.url);
const reports = {
  lost: [{ id: 1, description: 'Blue bag', category_name: 'Bags', status: 'active', location_lost: 'Library', date_reported: '2026-10-17' }],
  found: [{ id: 2, description: 'Keys', status: 'resolved', location_found: 'Hall', date_found: '2026-10-17' }],
};

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}

function view(path, { theme = 'dark', data = reports, accessibility = {} } = {}) {
  const states = [];
  const effects = [];
  let index = 0;
  let first = true;
  const navigation = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const current = index++;
      if (!(current in states)) states[current] = initial;
      return [states[current], value => { states[current] = typeof value === 'function' ? value(states[current]) : value; }];
    },
    useEffect(effect) { if (first) effects.push(effect); },
    useCallback: callback => callback,
    useRef: value => ({ current: value }),
  };
  const native = Object.fromEntries(['View', 'Text', 'ScrollView', 'SafeAreaView', 'ActivityIndicator', 'Modal', 'Image', 'RefreshControl'].map(name => [name, name]));
  const source = require('@babel/core').transformSync(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    babelrc: false, configFile: false,
    plugins: [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  const context = vm.createContext({ exports: {}, console, require(name) {
    if (name === 'react') return react;
    if (name === 'react-native') return { ...native, StyleSheet: { create: value => value }, Alert: { alert() {} }, Dimensions: { get: () => ({ height: 844 }) }, Animated: { View: 'AnimatedView', Value: class { setValue() {} } } };
    if (name === '@react-navigation/native') return { useFocusEffect: callback => { if (first) effects.push(callback); } };
    if (name === '@react-navigation/native-stack') return { createNativeStackNavigator: () => ({ Navigator: 'Stack', Screen: 'Screen' }) };
    if (name === '@react-navigation/bottom-tabs') return { createBottomTabNavigator: () => ({ Navigator: 'Tabs', Screen: 'Screen' }) };
    if (name.includes('SpeechControls')) return { TouchableOpacity: 'TouchableOpacity', TextInput: 'TextInput', Switch: 'Switch' };
    if (name.includes('AccessibilityContext')) return {
      useThemedStyles: value => value,
      useAccessibility: () => ({ speak() {}, readableColor: color => color, scaledFontSize: size => size * 1.5, themeColors: palettes[theme], themeMode: theme, accessibilityStyles: { text: { color: palettes[theme].text }, textMuted: { color: palettes[theme].muted }, touch: { minHeight: 56 } }, ...accessibility }),
    };
    if (name.includes('AuthContext')) return { useAuth: () => ({ user: { id: 42, name: 'Student' } }) };
    if (name.includes('FormIcon')) return { default: 'FormIcon', __esModule: true };
    if (name.includes('RecoveryFeedback')) return { useRecoveryFeedback: () => ({ recoveries: [], prompt: null, error: '', refreshFeedback() {}, dismissPrompt() {} }), RecoveryFeedbackPrompt: 'RecoveryFeedbackPrompt', RecoveryFeedbackButton: 'RecoveryFeedbackButton' };
    if (name.includes('VoiceAssistant')) return { default: 'VoiceAssistant', __esModule: true };
    if (name.includes('config/supabase')) return { default: {}, __esModule: true };
    if (name.includes('services/reporting')) return { loadUserReports: async () => data };
    if (name.includes('config/api')) return { getConfiguredServerUrl: async () => '' };
    if (name.includes('MessageBadgeContext')) return {};
    if (name === 'expo-av' || name === 'expo-file-system/next') return {};
    if (name.includes('/screens/')) return { default: name, __esModule: true };
    throw Error('Unexpected import: ' + name);
  } });
  vm.runInContext(source, context);
  function render(props = {}) {
    index = 0;
    const result = context.exports.default({ navigation: { navigate: target => navigation.push(target) }, ...props });
    first = false;
    return result;
  }
  async function ready() {
    render();
    effects.forEach(effect => effect());
    await new Promise(resolve => setImmediate(resolve));
  }
  return { render, ready, context, navigation };
}

test('home report actions and report summaries use outline icons while preserving navigation', async () => {
  const screen = view('../src/screens/HomeScreen.js');
  await screen.ready();
  const tree = screen.render();
  const names = nodes(tree).filter(node => node.type === 'FormIcon').map(node => node.props.name);
  for (const name of ['search', 'package', 'clipboard', 'clock', 'check-circle']) assert.ok(names.includes(name), `Missing ${name}`);
  for (const label of ['I lost something', 'I found something']) {
    nodes(tree).find(node => node.type === 'TouchableOpacity' && JSON.stringify(node.props.children).includes(label)).props.onPress();
  }
  assert.deepEqual(screen.navigation, ['ReportLost', 'ReportFound']);
});

test('claims and report details use professional type, refresh, empty, and close icons', async () => {
  const screen = view('../src/screens/MyClaimsScreen.js');
  await screen.ready();
  let tree = screen.render();
  const names = nodes(tree).filter(node => node.type === 'FormIcon').map(node => node.props.name);
  for (const name of ['refresh-cw', 'search', 'package']) assert.ok(names.includes(name), `Missing ${name}`);
  nodes(tree).find(node => node.type === 'TouchableOpacity' && JSON.stringify(node.props.children).includes('Blue bag')).props.onPress();
  tree = screen.render();
  const close = nodes(tree).find(node => node.props?.accessibilityLabel === 'Close report details');
  assert.ok(nodes(close).some(node => node.type === 'FormIcon' && node.props.name === 'x'));
  close.props.onPress();
  assert.doesNotMatch(JSON.stringify(screen.render()), /📦|🔍|🔄|📭|🏷|❌/u);
  const empty = view('../src/screens/MyClaimsScreen.js', { data: { lost: [], found: [] } });
  await empty.ready();
  assert.ok(nodes(empty.render()).some(node => node.type === 'FormIcon' && node.props.name === 'inbox'));
});

test('navigation tabs share outline icons with theme-aware selected colors and unchanged badges', () => {
  for (const theme of ['light', 'dark', 'contrast']) {
    const screen = view('../src/navigation/AppNavigator.js', { theme });
    const tabIcon = vm.runInContext('TabIcon', screen.context);
    for (const [label, name] of [['Home', 'home'], ['Claims', 'clipboard'], ['Messages', 'message-square']]) {
      for (const focused of [true, false]) {
        const tree = tabIcon({ label, focused, badgeCount: 101 });
        const icon = nodes(tree).find(node => node.type === 'FormIcon');
        assert.ok(icon);
        assert.equal(icon.props.name, name);
        assert.equal(icon.props.color, focused ? palettes[theme].accent : palettes[theme].muted);
        assert.match(JSON.stringify(tree), /99\+/);
      }
    }
  }
});

test('appearance settings use outline moon and contrast icons without changing their switches', async () => {
  const screen = view('../src/screens/SettingsScreen.js');
  await screen.ready();
  const tree = screen.render();
  const names = nodes(tree).filter(node => node.type === 'FormIcon').map(node => node.props.name);
  assert.ok(names.includes('moon'));
  assert.ok(names.includes('eye'));
  assert.equal(nodes(tree).find(node => node.type === 'Switch' && node.props.accessibilityLabel === 'Dark mode').props.value, true);
});

test('report microphones use theme-aware outline icons and preserve the recording action', () => {
  for (const theme of ['light', 'dark', 'contrast']) {
    const screen = view('../src/components/SpeechInputModal.js', { theme });
    let recordings = 0;
    const tree = screen.context.exports.MicButton({ active: false, onPress: () => recordings++ });
    const icon = nodes(tree).find(node => node.type === 'FormIcon');
    assert.ok(icon);
    assert.equal(icon.props.name, 'mic');
    assert.equal(icon.props.color, palettes[theme].accent);
    assert.equal(tree.props.speechFeedback, false);
    tree.props.onPress();
    assert.equal(recordings, 1);
  }
});

test('read-aloud icons preserve read, stop, and global stop controls', () => {
  const spoken = [];
  let stopped = 0;
  for (const reading of [false, true]) {
    const screen = view('../src/components/VoiceAssistant.js', { accessibility: { ttsEnabled: true, isSpeaking: reading, speechText: 'Report details', speak: text => spoken.push(text), stopSpeaking: () => stopped++ } });
    const tree = screen.render({ text: 'Report details' });
    const icon = nodes(tree).find(node => node.type === 'FormIcon');
    assert.ok(icon);
    assert.equal(icon.props.name, reading ? 'volume-x' : 'volume-2');
    tree.props.onPress();
    const stop = screen.context.exports.TTSStopButton();
    assert.equal(nodes(stop).find(node => node.type === 'FormIcon').props.name, 'volume-x');
    stop.props.onPress();
  }
  assert.deepEqual(spoken, ['Report details']);
  assert.equal(stopped, 3);
});
