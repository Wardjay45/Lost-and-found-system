import test from 'node:test';
import assert from 'node:assert/strict';
import { buttonBounds, clampButtonPosition, normalizeButtonPosition, restoreButtonPosition, parseButtonPosition, isButtonDrag } from '../src/theme/floatingButton.mjs';

test('dragging stays inside safe areas even far beyond the phone edges', () => {
  const bounds = buttonBounds(390, 844, 48, { top: 44, bottom: 34, left: 0, right: 0 });
  assert.deepEqual(clampButtonPosition({ x: -1000, y: -1000 }, bounds), { x: 12, y: 56 });
  assert.deepEqual(clampButtonPosition({ x: 1000, y: 1000 }, bounds), { x: 330, y: 750 });
});

test('saved placement remains reachable after rotation and larger touch targets', () => {
  const portrait = buttonBounds(390, 844, 48, { top: 44, bottom: 34 });
  const chosen = { x: 250, y: 600 };
  const saved = normalizeButtonPosition(chosen, portrait);
  const original = restoreButtonPosition(saved, portrait);
  assert.ok(Math.abs(original.x - chosen.x) < 0.001);
  assert.ok(Math.abs(original.y - chosen.y) < 0.001);
  const landscape = buttonBounds(844, 390, 56, { left: 44, right: 44, bottom: 21 });
  const restored = restoreButtonPosition(saved, landscape);
  assert.ok(restored.x >= landscape.minX && restored.x <= landscape.maxX);
  assert.ok(restored.y >= landscape.minY && restored.y <= landscape.maxY);
  assert.ok(restored.x > restored.y);
});

test('tiny layouts do not produce negative movement ranges or invalid saved fractions', () => {
  const bounds = buttonBounds(60, 60, 56, { top: 40, bottom: 30 });
  const position = clampButtonPosition({ x: 999, y: 999 }, bounds);
  assert.deepEqual(normalizeButtonPosition(position, bounds), { x: 0, y: 0 });
});

test('invalid saved data falls back to the default position', () => {
  for (const value of [null, '', '{broken', '{}', 'null', '{"x":-1,"y":0}', '{"x":0,"y":2}', '{"x":"1","y":0}']) {
    assert.equal(parseButtonPosition(value), null);
  }
  assert.deepEqual(parseButtonPosition('{"x":0.2,"y":0.7}'), { x: 0.2, y: 0.7 });
});

test('a steady tap does not claim a drag gesture', () => {
  assert.equal(isButtonDrag({ dx: 0, dy: 0 }), false);
  assert.equal(isButtonDrag({ dx: 5, dy: -5 }), false);
  assert.equal(isButtonDrag({ dx: 7, dy: 0 }), true);
  assert.equal(isButtonDrag({ dx: 0, dy: -7 }), true);
});

test('the floating control saves a drag without switching themes and restores its position', async () => {
  const { readFileSync } = await import('node:fs');
  const { createRequire } = await import('node:module');
  const vm = await import('node:vm');
  const geometry = await import('../src/theme/floatingButton.mjs');
  const require = createRequire(import.meta.url);
  const babel = require('@babel/core');
  const source = babel.transformSync(readFileSync(new URL('../src/components/FloatingThemeButton.js', import.meta.url), 'utf8'), {
    babelrc: false, configFile: false,
    plugins: [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  let saved = null;
  let changes = 0;
  let clock = 1000;
  function mount({ themeMode = 'dark', highContrast = false } = {}) {
    let stateIndex = 0;
    const states = [{ width: 390, height: 844 }, true, false];
    const effects = [];
    const vectors = [];
    let handlers;
    const react = {
      createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
      useState: () => { const index = stateIndex++; return [states[index], value => { states[index] = value; }]; },
      useRef: value => ({ current: value }),
      useMemo: factory => factory(),
      useEffect: effect => { effects.push(effect); },
    };
    const native = {
      View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity',
      StyleSheet: { create: value => value, absoluteFill: {} },
      Keyboard: { addListener: () => ({ remove() {} }) },
      Animated: {
        View: 'AnimatedView',
        ValueXY: class { constructor() { vectors.push(this); } setValue(point) { this.point = point; } getTranslateTransform() { return []; } },
      },
      PanResponder: { create: callbacks => { handlers = callbacks; return { panHandlers: {} }; } },
    };
    const context = vm.createContext({ Date: { now: () => clock }, require: name => {
      if (name === 'react') return react;
      if (name === 'react-native') return native;
      if (name.includes('async-storage')) return { getItem: async () => saved, setItem: async (key, value) => { assert.equal(key, geometry.THEME_POSITION_KEY); saved = value; } };
      if (name.includes('safe-area-context')) return { useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }) };
      if (name.includes('AccessibilityContext')) return { useAccessibility: () => ({ themeMode, highContrast, themeColors: {}, scaledFontSize: size => size, setThemeMode: () => { changes++; }, setHighContrast() {}, speak() {} }) };
      if (name.includes('FormIcon')) return { default: 'FormIcon', __esModule: true };
      if (name.includes('floatingButton.mjs')) return geometry;
      throw Error('Unexpected component import: ' + name);
    }, exports: {} });
    vm.runInContext(source, context);
    const tree = context.exports.default();
    const press = tree.props.children[0].props.children[0].props.onPress;
    const button = tree.props.children[0].props.children[0];
    return { effects, vector: vectors[0], handlers, press, icon: button.props.children[0], label: button.props.accessibilityLabel };
  }
  const first = mount();
  assert.equal(first.icon.type, 'FormIcon');
  assert.equal(first.icon.props.name, 'sun');
  assert.equal(first.label, 'Switch to light mode');
  const light = mount({ themeMode: 'light' });
  assert.equal(light.icon.props.name, 'moon');
  assert.equal(light.label, 'Switch to dark mode');
  const contrast = mount({ highContrast: true });
  assert.equal(contrast.icon.props.name, 'circle');
  assert.equal(contrast.label, 'Exit high contrast mode');
  first.effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  first.effects[1]();
  first.press();
  assert.equal(changes, 1);
  const start = { ...first.vector.point };
  first.handlers.onPanResponderGrant();
  first.handlers.onPanResponderMove(null, { dx: -150, dy: -250 });
  first.handlers.onPanResponderRelease();
  first.press();
  assert.equal(changes, 1, 'releasing a drag must not toggle the theme');
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(saved, 'drag should persist');
  assert.ok(Math.abs(first.vector.point.x - (start.x - 150)) < 0.001);
  assert.ok(Math.abs(first.vector.point.y - (start.y - 250)) < 0.001);
  const second = mount();
  second.effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  second.effects[1]();
  assert.ok(Math.abs(second.vector.point.x - first.vector.point.x) < 0.001);
  assert.ok(Math.abs(second.vector.point.y - first.vector.point.y) < 0.001);
  clock += 300;
  first.press();
  assert.equal(changes, 2, 'normal tap should work again after dragging');
});
