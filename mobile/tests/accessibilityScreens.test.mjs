import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { palettes, themeStyleSheet } from '../src/theme/palette.mjs';
import * as matching from '../src/services/matching.mjs';

const require = createRequire(import.meta.url);
export function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];
}

export function screen(name, theme = 'contrast') {
  const states = [], requests = [], navigations = [];
  let cursor = 0;
  const scale = 1.5;
  const accessibility = { themeColors: palettes[theme], activeTheme: theme, fontSize: 'xlarge', highContrast: theme === 'contrast',
    accessibilityStyles: { fontScale: scale, touch: { minHeight: 56, minWidth: 56 }, reduceMotion: true },
    scaledFontSize: size => Math.round(size * scale), speak() {}, readableColor: color => color,
    setFontSize: value => navigations.push(value) };
  const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value; }]; },
    useEffect() {}, useCallback: callback => callback, useRef: value => ({ current: value }) };
  const native = Object.fromEntries(['View', 'Text', 'ScrollView', 'SafeAreaView', 'Image', 'Modal', 'ActivityIndicator', 'RefreshControl'].map(type => [type, type]));
  const source = require('@babel/core').transformSync(readFileSync(new URL(`../src/screens/${name}.js`, import.meta.url), 'utf8'), {
    babelrc: false, configFile: false, plugins: [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  const context = vm.createContext({ exports: {}, console, setTimeout, clearTimeout, AbortController,
    fetch: async (url, options) => { requests.push({ url, ...options }); return { ok: true, json: async () => ({ matches: [{ id: 'a', description: 'Blue bag', status: 'active', score: .86, image_score: .85, text_score: .88 }] }) }; },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react-native') return { ...native, StyleSheet: { create: value => value }, Alert: { alert() {} } };
      if (name === 'expo-image-picker') return { launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ base64: 'AA==', mimeType: 'image/png' }] }) };
      if (name.includes('SpeechControls')) return { TextInput: 'TextInput', TouchableOpacity: 'TouchableOpacity', Switch: 'Switch' };
      if (name.includes('AccessibilityContext')) return { useAccessibility: () => accessibility, useThemedStyles: styles => themeStyleSheet(styles, theme, scale) };
      if (name.includes('AuthContext')) return { useAuth: () => ({ user: { name: 'Student', email: 'student@example.test' }, token: 'session' }) };
      if (name.includes('VoiceAssistant')) return { default: 'VoiceAssistant', __esModule: true };
      if (name.includes('FormIcon')) return { default: 'FormIcon', __esModule: true };
      if (name.includes('config/api')) return { initApiUrl: async () => 'https://example.test/api' };
      if (name.includes('services/matching')) return { searchMatches: options => matching.searchMatches(options, context.fetch) };
      if (name.includes('config/supabase')) return { default: {}, __esModule: true };
      if (name.endsWith('.png')) return 'logo';
      throw Error('Unexpected import ' + name);
    } });
  vm.runInContext(source, context);
  return { states, requests, navigations, render() { cursor = 0; return context.exports.default({ navigation: { navigate: target => navigations.push(target) } }); } };
}

test('font choices expose checked states and an explicit selection mark in every theme at maximum text size', () => {
  for (const theme of ['light', 'dark', 'contrast']) {
    const view = screen('AccessibilityScreen', theme);
    const radios = nodes(view.render()).filter(node => node.props.accessibilityRole === 'radio');
    assert.equal(radios.length, 4);
    const selected = radios.find(node => node.props.accessibilityState.checked);
    assert.match(JSON.stringify(selected), /✓/);
    assert.match(selected.props.accessibilityLabel, /X-Large/);
    radios[0].props.onPress();
    assert.deepEqual(view.navigations, ['small']);
  }
});

test('actual mobile matching screen submits a photo to CLIP/E5 and labels numeric similarity', async () => {
  const view = screen('AIMatchesScreen');
  let tree = view.render();
  await nodes(tree).find(node => node.type === 'TouchableOpacity' && JSON.stringify(node).includes('Photo')).props.onPress();
  tree = view.render();
  await nodes(tree).find(node => node.props.accessibilityLabel === 'Search for possible matches').props.onPress();
  assert.equal(JSON.parse(view.requests[0].body).image_base64, 'data:image/png;base64,AA==');
  assert.equal(view.states[5], 'image');
  assert.match(JSON.stringify(view.render()), /86%/);
  assert.match(JSON.stringify(view.render()), /similarity/);
});

test('browsing keeps the entire description and labeled status at maximum text size', () => {
  const view = screen('BrowseItemsScreen');
  view.render();
  const description = 'A long identifying description '.repeat(12);
  view.states[1] = [{ id: 1, description, category: 'Bags', location: 'AB BUILDING', status: 'active', date: '2026-01-01' }];
  view.states[2] = false;
  const tree = view.render();
  const title = nodes(tree).find(node => node.type === 'Text' && node.props.children.includes(description));
  assert.equal(title.props.numberOfLines, undefined);
  const card = nodes(tree).find(node => node.props.accessibilityLabel?.includes(description));
  assert.match(card.props.accessibilityLabel, /Status: Active/);
  card.props.onPress();
  assert.deepEqual(view.navigations, ['Verification']);
});
