import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { palettes } from '../src/theme/palette.mjs';

const require = createRequire(import.meta.url);

test('form icons follow every theme and text scale without becoming screen-reader content', () => {
  const source = require('@babel/core').transformSync(readFileSync(new URL('../src/components/FormIcon.js', import.meta.url), 'utf8'), {
    babelrc: false, configFile: false,
    plugins: [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')],
  }).code;
  for (const palette of Object.values(palettes)) {
    for (const scale of [1, 1.5]) {
      const context = vm.createContext({ exports: {}, require(name) {
        if (name === 'react') return { createElement: (type, props) => ({ type, props }) };
        if (name === '@expo/vector-icons/Feather') return { default: 'Feather', __esModule: true };
        if (name.includes('AccessibilityContext')) return { useAccessibility: () => ({ themeColors: palette, scaledFontSize: size => size * scale }) };
        throw Error('Unexpected icon import: ' + name);
      } });
      vm.runInContext(source, context);
      const icon = context.exports.default({ name: 'mail' });
      assert.equal(icon.type, 'Feather');
      assert.equal(icon.props.name, 'mail');
      assert.equal(icon.props.color, palette.muted);
      assert.equal(icon.props.size, 20 * scale);
      assert.equal(icon.props.accessible, false);
      assert.equal(icon.props.accessibilityElementsHidden, true);
      assert.equal(icon.props.importantForAccessibility, 'no-hide-descendants');
      assert.equal(icon.props.pointerEvents, 'none');
      const accent = context.exports.default({ name: 'check', size: 28, color: palette.accent });
      assert.equal(accent.props.size, 28 * scale);
      assert.equal(accent.props.color, palette.accent);
    }
  }
});
