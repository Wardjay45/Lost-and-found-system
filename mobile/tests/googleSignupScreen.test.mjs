import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { validateSignupFields, GENDER_OPTIONS } from '../src/services/signup.mjs';

const require = createRequire(import.meta.url);
const babel = require('@babel/core');

function screen({ screenName = 'SignUpScreen', selection = { idToken: 'verified-google-token' }, verification = { registrationRequired: true, email: 'student@dnsc.edu.ph', name: 'School Student' }, signup = async () => ({ user: { id: 7 }, token: 'session' }), googleRegistration } = {}) {
  const states = [];
  const refs = [];
  const alerts = [];
  let stateIndex = 0;
  let refIndex = 0;
  const react = {
    Fragment: 'Fragment',
    useEffect() {},
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
  };
  const native = Object.fromEntries(['View', 'Text', 'KeyboardAvoidingView', 'ScrollView', 'Modal', 'FlatList', 'ActivityIndicator', 'Image'].map(name => [name, name]));
  const source = babel.transformSync(readFileSync(new URL(`../src/screens/${screenName}.js`, import.meta.url), 'utf8'), {
    babelrc: false, configFile: false,
    plugins: [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  const context = vm.createContext({ exports: {}, console, require(name) {
    if (name === 'react') return react;
    if (name === 'react-native') return { ...native, StyleSheet: { create: value => value }, Platform: { OS: 'android' }, Alert: { alert: (...args) => alerts.push(args) } };
    if (name.includes('SpeechControls')) return { TextInput: 'TextInput', TouchableOpacity: 'TouchableOpacity' };
    if (name.includes('AuthContext')) return { useAuth: () => ({ signup, continueWithGoogle: async () => verification, isAuthenticated: false }) };
    if (name.includes('AccessibilityContext')) return {
      useThemedStyles: styles => styles,
      useAccessibility: () => ({ speak() {}, scaledFontSize: size => size * 1.5, themeColors: { text: '#fff', muted: '#ccc' }, accessibilityStyles: { touch: { minHeight: 56 }, reduceMotion: true } }),
    };
    if (name.includes('VoiceAssistant')) return { default: 'VoiceAssistant', __esModule: true };
    if (name.includes('FormIcon')) return { default: 'FormIcon', __esModule: true };
    if (name.endsWith('assets/logo.png')) return 'signature-logo';
    if (name.endsWith('assets/google-g.png')) return 'google-logo';
    if (name.includes('services/signup')) return { validateSignupFields, GENDER_OPTIONS };
    if (name.includes('services/googleSignIn')) return { selectSchoolGoogleAccount: async () => selection };
    throw Error('Unexpected screen import: ' + name);
  } });
  vm.runInContext(source, context);
  function render() {
    stateIndex = 0;
    refIndex = 0;
    return context.exports.default({ navigation: { navigate() {}, goBack() {} }, route: { params: { googleRegistration } } });
  }
  return { render, alerts };
}

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}

test('sign-in uses outline email, lock and visibility icons without replacing the signature logo', () => {
  const view = screen({ screenName: 'LoginScreen' });
  let rendered = view.render();
  assert.deepEqual(nodes(rendered).filter(node => node.type === 'FormIcon').map(node => node.props.name), ['mail', 'lock', 'eye']);
  const logos = nodes(rendered).filter(node => node.type === 'Image' && node.props.source === 'signature-logo');
  assert.equal(logos.length, 2);
  assert.ok(logos.every(node => node.props.source === 'signature-logo'));
  const password = () => nodes(rendered).find(node => node.type === 'TextInput' && node.props.accessibilityLabel === 'Password');
  password().props.onChangeText('unchanged-password');
  nodes(rendered).find(node => node.props?.accessibilityLabel === 'Show password').props.onPress();
  rendered = view.render();
  assert.equal(password().props.value, 'unchanged-password');
  assert.equal(password().props.secureTextEntry, false);
  const hide = nodes(rendered).find(node => node.props?.accessibilityLabel === 'Hide password');
  assert.equal(hide.props.accessibilityRole, 'button');
  assert.ok(nodes(hide).some(node => node.type === 'FormIcon' && node.props.name === 'eye-off'));
  hide.props.onPress();
  rendered = view.render();
  assert.equal(password().props.secureTextEntry, true);
});

test('profile details use consistent outline field icons and an accessible password toggle', () => {
  const view = screen({ googleRegistration: { idToken: 'verified-token', email: 'student@dnsc.edu.ph' } });
  let rendered = view.render();
  const iconNames = nodes(rendered).filter(node => node.type === 'FormIcon').map(node => node.props.name);
  for (const name of ['mail', 'lock', 'user', 'credit-card', 'briefcase', 'users', 'phone', 'chevron-down', 'eye']) {
    assert.ok(iconNames.includes(name), `Missing outline icon: ${name}`);
  }
  assert.doesNotMatch(JSON.stringify(rendered), /📧|🔒|👤|🎓|🏛|📱|🙈|👁/u);
  nodes(rendered).find(node => node.props?.accessibilityLabel === 'Show password').props.onPress();
  rendered = view.render();
  assert.equal(nodes(rendered).find(node => node.type === 'TextInput' && node.props.accessibilityLabel === 'PASSWORD').props.secureTextEntry, false);
  const hide = nodes(rendered).find(node => node.props?.accessibilityLabel === 'Hide password');
  assert.equal(hide.props.accessibilityRole, 'button');
  assert.ok(nodes(hide).some(node => node.type === 'FormIcon' && node.props.name === 'eye-off'));
});

test('Google verification unlocks the complete form with read-only email and gender selection at larger text sizes', async () => {
  const view = screen();
  let rendered = view.render();
  assert.equal(nodes(rendered).filter(node => node.type === 'TextInput').length, 0);
  await nodes(rendered).find(node => node.props?.accessibilityLabel === 'Continue with Google').props.onPress();
  rendered = view.render();
  const inputs = nodes(rendered).filter(node => node.type === 'TextInput');
  assert.deepEqual(inputs.map(node => node.props.accessibilityLabel), ['FULL NAME', 'VERIFIED SCHOOL EMAIL', 'STUDENT ID', 'PASSWORD', 'PHONE NUMBER']);
  const email = inputs.find(node => node.props.accessibilityLabel === 'VERIFIED SCHOOL EMAIL');
  assert.equal(email.props.value, 'student@dnsc.edu.ph');
  assert.equal(email.props.editable, false);
  assert.equal(inputs[0].props.value, 'School Student');
  assert.equal(inputs[0].props.style[1].fontSize, 22.5);
  const gender = nodes(rendered).find(node => node.props?.accessibilityLabel === 'Select gender');
  gender.props.onPress();
  rendered = view.render();
  const modal = nodes(rendered).find(node => node.type === 'Modal' && node.props.visible);
  assert.equal(modal.props.animationType, 'none');
  const list = nodes(modal).find(node => node.type === 'FlatList');
  const option = list.props.renderItem({ item: 'Prefer not to say' });
  option.props.onPress();
  rendered = view.render();
  const updated = nodes(rendered).find(node => node.props?.accessibilityLabel === 'Select gender');
  assert.ok(JSON.stringify(updated).includes('Prefer not to say'));
});

test('cancellation and rejected Google accounts cannot open the signup form', async () => {
  for (const options of [{ selection: { cancelled: true } }, { verification: { error: 'Use your school Google account (@dnsc.edu.ph).' } }]) {
    const view = screen(options);
    await nodes(view.render()).find(node => node.props?.accessibilityLabel === 'Continue with Google').props.onPress();
    assert.equal(nodes(view.render()).filter(node => node.type === 'TextInput').length, 0);
  }
});

test('completed form submits gender and verified proof once and disables repeated taps', async () => {
  let calls = 0;
  let submitted;
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const view = screen({ googleRegistration: { idToken: 'verified-google-token', email: 'student@dnsc.edu.ph', name: 'School Student' }, signup: async data => { calls++; submitted = data; return pending; } });
  let rendered = view.render();
  for (const [label, value] of [['STUDENT ID', '2026-001'], ['PASSWORD', 'student-password'], ['PHONE NUMBER', '09171234567']]) {
    nodes(rendered).find(node => node.type === 'TextInput' && node.props.accessibilityLabel === label).props.onChangeText(value);
  }
  const lists = nodes(rendered).filter(node => node.type === 'FlatList');
  lists[0].props.renderItem({ item: 'Institute of Computing (IC)' }).props.onPress();
  lists[1].props.renderItem({ item: 'Female' }).props.onPress();
  rendered = view.render();
  const submit = nodes(rendered).find(node => node.type === 'TouchableOpacity' && JSON.stringify(node.props.children).includes('Create Account'));
  const first = submit.props.onPress();
  await submit.props.onPress();
  assert.equal(calls, 1);
  assert.equal(submitted.gender, 'Female');
  assert.equal(submitted.google_id_token, 'verified-google-token');
  assert.equal(submitted.email, 'student@dnsc.edu.ph');
  assert.ok(nodes(view.render()).filter(node => node.type === 'TextInput').every(node => node.props.editable === false));
  finish({ user: { id: 7 }, token: 'session' });
  await first;
});

test('registration route is removed after authentication so the stack opens Main', () => {
  const source = babel.transformSync(readFileSync(new URL('../src/navigation/AppNavigator.js', import.meta.url), 'utf8'), {
    babelrc: false, configFile: false,
    plugins: [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  let authenticated = false;
  const react = { Fragment: 'Fragment', createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), useRef: value => ({ current: value }) };
  const context = vm.createContext({ exports: {}, console, require(name) {
    if (name === 'react') return react;
    if (name === 'react-native') return { View: 'View', Text: 'Text', StyleSheet: { create: value => value } };
    if (name === '@react-navigation/native') return { NavigationContainer: 'NavigationContainer', DefaultTheme: { colors: {} }, DarkTheme: { colors: {} } };
    if (name === '@react-navigation/native-stack') return { createNativeStackNavigator: () => ({ Navigator: 'Stack', Screen: 'Screen' }) };
    if (name === '@react-navigation/bottom-tabs') return { createBottomTabNavigator: () => ({ Navigator: 'Tabs', Screen: 'Screen' }) };
    if (name.includes('AuthContext')) return { useAuth: () => ({ isAuthenticated: authenticated }) };
    if (name.includes('AccessibilityContext')) return { useAccessibility: () => ({ themeColors: {}, activeTheme: 'light' }) };
    return { default: name, __esModule: true };
  } });
  vm.runInContext(source, context);
  const before = nodes(context.exports.default()).filter(node => node.type === 'Screen').map(node => node.props.name);
  assert.deepEqual(before, ['Login', 'SignUp']);
  const { StackRouter } = require('@react-navigation/routers');
  const router = StackRouter({ initialRouteName: 'Login' });
  const config = { routeNames: before, routeParamList: {}, routeGetIdList: {} };
  const initial = router.getInitialState(config);
  const signupState = router.getStateForAction(initial, { type: 'NAVIGATE', payload: { name: 'SignUp' } }, config);
  authenticated = true;
  const after = nodes(context.exports.default()).filter(node => node.type === 'Screen').map(node => node.props.name);
  assert.ok(!after.includes('SignUp'));
  const signedInState = router.getStateForRouteNamesChange(signupState, { ...config, routeNames: after, routeKeyChanges: [] });
  assert.equal(signedInState.routes[signedInState.index].name, 'Main');
});
