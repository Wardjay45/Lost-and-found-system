import test from 'node:test';
import assert from 'node:assert/strict';
import { palettes, themeStyleSheet, themeStyleColor } from '../src/theme/palette.mjs';

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(part => parseInt(part, 16) / 255);
  const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test('primary and muted text meet normal-text contrast on every theme surface', () => {
  for (const [name, colors] of Object.entries(palettes)) {
    assert.ok(contrast(colors.text, colors.surface) >= 4.5, name + ' primary text');
    assert.ok(contrast(colors.muted, colors.surface) >= 4.5, name + ' muted text');
    assert.ok(contrast(colors.accent, colors.surface) >= 4.5, name + ' accent text');
    assert.ok(contrast(colors.text, colors.input) >= 4.5, name + ' input text');
    assert.ok(contrast(colors.muted, colors.input) >= 4.5, name + ' placeholder text');
  }
});

test('theme typography scales font size and line height without fixing text container heights', () => {
  const style = themeStyleSheet({ label: { fontSize: 16, lineHeight: 20, padding: 8 } }, 'dark', 1.5).label;
  assert.equal(style.fontSize, 24);
  assert.equal(style.lineHeight, 30);
  assert.equal(style.padding, 8);
});

test('legacy screen surfaces and text resolve in both themes', () => {
  const base = {
    container: { flex: 1, backgroundColor: '#0f172a' },
    card: { backgroundColor: 'rgba(30, 41, 59, 0.6)', borderColor: 'rgba(148, 163, 184, 0.12)' },
    heading: { color: '#f1f5f9' },
  };
  for (const mode of ['dark', 'light', 'contrast']) {
    const styles = themeStyleSheet(base, mode);
    assert.equal(styles.container.backgroundColor, palettes[mode].background);
    assert.equal(styles.card.backgroundColor, palettes[mode].surface);
    assert.equal(styles.card.borderColor, palettes[mode].border);
    assert.equal(styles.heading.color, palettes[mode].text);
    assert.equal(styles.container.flex, 1);
  }
});

test('status labels remain readable on cards in every theme', () => {
  const statusColors = ['#f59e0b', '#fbbf24', '#34d399', '#10b981', '#ef4444', '#f87171', '#fecaca', '#8b5cf6', '#3b82f6'];
  for (const [mode, palette] of Object.entries(palettes)) {
    for (const sourceColor of statusColors) {
      const color = themeStyleColor('color', sourceColor, mode);
      assert.ok(contrast(color, palette.surface) >= 4.5, mode + ' ' + sourceColor + ' on card');
    }
  }
});

test('found report button keeps readable white text in both modes', () => {
  for (const mode of ['dark', 'light']) {
    const buttonColor = themeStyleColor('backgroundColor', '#10b981', mode);
    assert.ok(contrast('#ffffff', buttonColor) >= 4.5, mode + ' submit button');
  }
});

test('disabled speech action still has a readable label in light mode', () => {
  for (const mode of ['dark', 'light', 'contrast']) {
    assert.ok(contrast('#ffffff', themeStyleColor('backgroundColor', '#475569', mode)) >= 4.5, mode + ' disabled action');
  }
});
