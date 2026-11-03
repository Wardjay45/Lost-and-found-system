import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { keyboardOverlap, focusedFieldScroll } from '../src/services/keyboardLayout.mjs';
const require = createRequire(import.meta.url);
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
function harness(file, os) {
  const states = [], refs = [], effects = [], cleanups = [], listeners = new Map(); let si = 0, ri = 0, first = true;
  const react = { forwardRef: fn => fn, useCallback: fn => fn, useImperativeHandle(ref, factory) { if (ref) ref.current = factory(); }, createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(value) { const i = si++; if (!(i in states)) states[i] = value; return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
    useRef(value) { return refs[ri++] ||= { current: value }; }, useEffect(fn) { if (first) effects.push(fn); } };
  const native = Object.fromEntries(['View','Text','FlatList','KeyboardAvoidingView','SafeAreaView','ScrollView','ActivityIndicator'].map(key => [key,key]));
  const code = require('@babel/core').transformSync(readFileSync(new URL('../src/' + file, import.meta.url), 'utf8'), { babelrc: false, configFile: false,
    plugins: [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')] }).code;
  const context = vm.createContext({ exports: {}, console, setTimeout, clearTimeout, Map, require(name) {
    if (name === 'react') return react;
    if (name === 'react-native') return { ...native, Platform: { OS: os }, StyleSheet: { create: value => value }, Keyboard: { metrics: () => ({screenY: 500, height: 300}), isVisible: () => false, addListener(event, callback) { listeners.set(event, callback); return { remove() { listeners.delete(event); } }; } } };
    if (name.includes('KeyboardViewport')) return {default: 'KeyboardViewport', __esModule:true};
    if (name.includes('keyboardLayout')) return { keyboardOverlap, focusedFieldScroll };
    if (name === '@react-navigation/elements') return { useHeaderHeight: () => 64 };
    if (name === '@react-navigation/native') return { useIsFocused: () => true };
    if (name.includes('SpeechControls')) return { TextInput: 'TextInput', TouchableOpacity: 'TouchableOpacity' };
    if (name.includes('MessageBadgeContext')) return { useMessageBadge: () => ({ messages: [], loading: false, connected: true, refresh() {}, markSeen() {}, appActive: true }) };
    if (name.includes('AuthContext')) return { useAuth: () => ({ user: { id: 1, name: 'Student' } }) };
    if (name.includes('AccessibilityContext')) return { useThemedStyles: value => value, useAccessibility: () => ({ speak() {}, scaledFontSize: value => value * 1.5, accessibilityStyles: {}, themeColors: { muted: '#aaa' } }) };
    if (name.includes('config/supabase') || name.includes('VoiceAssistant')) return {};
    throw Error('Unexpected import ' + name);
  } }); vm.runInContext(code, context);
  return { listeners, render(props = {}, ref = null) { si = ri = 0; const tree = context.exports.default({ children: 'form', ...props }, ref); if (first) { first = false; for (const fn of effects) cleanups.push(fn()); } return tree; }, unmount() { cleanups.forEach(fn => fn?.()); } };
}
for (const os of ['android','ios']) {
  test(`${os}: report form scrolls the focused bottom field after keyboard/layout changes and cleans listeners`, async () => {
    const app = harness('components/KeyboardAwareForm.js', os), ref = {current:null};
    const tree = app.render({}, ref); assert.equal(tree.type, 'KeyboardViewport');
    const scroll = nodes(tree).find(node => node.type === 'ScrollView'); const calls = [];
    scroll.props.ref.current = {measureInWindow: callback => callback(0,80,400,320), scrollTo: value => calls.push(value)};
    ref.current.focusInput({measureInWindow: callback => callback(0,450,300,112)});
    app.listeners.get('keyboardDidShow')(); scroll.props.onLayout();
    await new Promise(resolve => setTimeout(resolve, 150)); assert.equal(calls[0].y,186);
    assert.equal(scroll.props.keyboardShouldPersistTaps, 'handled'); app.unmount(); assert.equal(app.listeners.size, 0);
  });
  test(`${os}: message composer follows keyboard, preserves draft text and scrolls long input`, () => {
    const app = harness('screens/MessagesScreen.js', os); let tree = app.render();
    let input = nodes(tree).find(node => node.type === 'TextInput'); input.props.onChangeText('My draft stays visible');
    tree.props.onVisibilityChange(true); tree = app.render(); input = nodes(tree).find(node => node.type === 'TextInput');
    assert.equal(input.props.value, 'My draft stays visible');
    const bar = nodes(tree).find(node => node.type === 'View' && Array.isArray(node.props.style) && node.props.style.at(-1)?.paddingBottom === 12); assert.ok(bar);
    assert.equal(tree.type, 'KeyboardViewport');
    input.props.onContentSizeChange({ nativeEvent: { contentSize: { height: 250 } } });
    input = nodes(app.render()).find(node => node.type === 'TextInput'); assert.equal(input.props.scrollEnabled, true);
    tree.props.onVisibilityChange(false); tree = app.render(); assert.equal(nodes(tree).find(node => node.type === 'TextInput').props.value, 'My draft stays visible');
    assert.equal(nodes(tree).some(node => node.props.accessibilityLabel === 'Refresh messages'), false); app.unmount();
  });
}

test('native resize is not applied twice; overlay keyboards reserve the actual obscured area', () => {
  assert.equal(keyboardOverlap(80,720,{screenY:500,height:300}),300);
  assert.equal(keyboardOverlap(80,420,{screenY:500,height:300}),0);
  assert.equal(keyboardOverlap(24,476,{screenY:500,height:300}),0);
  assert.equal(keyboardOverlap(80,720,null),0);
});
test('only the field outside the visible viewport scrolls; tall fields expose an internally scrollable area', () => {
  const base = {viewportTop:80,viewportHeight:320,keyboardTop:500,offset:100};
  assert.equal(focusedFieldScroll({...base,fieldTop:150,fieldHeight:112}),null);
  assert.equal(focusedFieldScroll({...base,fieldTop:450,fieldHeight:112}),286);
  assert.equal(focusedFieldScroll({...base,fieldTop:50,fieldHeight:112}),46);
  assert.equal(focusedFieldScroll({...base,fieldTop:150,fieldHeight:1000}),146);
});
for(const os of ['android','ios']) test(`${os}: measured viewport follows native resize and restores layout after keyboard dismissal`, () => {
  const app=harness('components/KeyboardViewport.js',os); let tree=app.render(); let height=720;
  tree.props.ref.current={measureInWindow: callback=>callback(0,80,400,height)};
  app.listeners.get('keyboardDidShow')({endCoordinates:{screenY:500,height:300}});
  tree=app.render(); assert.equal(tree.props.children[0].props.style.paddingBottom,300);
  height=420; tree.props.onLayout(); tree=app.render(); assert.equal(tree.props.children[0].props.style.paddingBottom,0);
  app.listeners.get('keyboardDidHide')(); tree=app.render(); assert.equal(tree.props.children[0].props.style.paddingBottom,0);
  app.unmount(); assert.equal(app.listeners.size,0);
});
