import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const recovery = { id: 'return', kind: 'recovery', rating: 5, user_name: 'Owner', item_description: 'Blue bag', speed: '1–3 days', comment: 'Helpful staff', created_at: '2026-10-17T00:00:00Z' };
const general = { id: 'general', kind: 'general', rating: 2, user_name: 'Finder', comment: 'Improve search', created_at: '2026-10-16T00:00:00Z' };

test('recovery performance belongs only on Feedback while Analytics keeps report forecasting', () => {
  const analytics = readFileSync(new URL('../../web/src/pages/Analytics.jsx', import.meta.url), 'utf8');
  const feedback = readFileSync(new URL('../../web/src/pages/Feedback.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(analytics, /RecoveryMetrics/);
  assert.match(feedback, /<RecoveryMetrics\s*\/>/);
  assert.match(analytics, /const forecast = useMemo/);
});

function harness(file, api) {
  const state = [], dependencies = [], memo = [], effects = [];
  let cursor, effectCursor, memoCursor;
  const react = {
    Fragment: 'Fragment', createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }]; },
    useMemo(factory, deps) { const index = memoCursor++; if (!memo[index] || deps.some((value, position) => memo[index].deps[position] !== value)) memo[index] = { deps, value: factory() }; return memo[index].value; },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
    useEffect(effect, deps) { const index = effectCursor++; if (!dependencies[index] || deps.some((value, position) => dependencies[index][position] !== value)) { dependencies[index] = deps; effects.push(effect); } },
  };
  function compile(relative) {
    const source = require('@babel/core').transformSync("import React from 'react';\n" + readFileSync(new URL('../../web/src/' + relative, import.meta.url), 'utf8'), {
      babelrc: false, configFile: false, plugins: [require.resolve('@babel/plugin-transform-react-jsx'), require.resolve('@babel/plugin-transform-modules-commonjs')],
    }).code;
    const context = vm.createContext({ exports: {}, require(name) {
      if (name === 'react') return react;
      if (name.includes('services/api')) return { feedbackApi: api };
      if (name.endsWith('/UI') || name === './UI') return ui;
      if (name.includes('RecoveryMetrics')) return { default: 'RecoveryMetrics', __esModule: true };
      if (name.includes('AppIcon')) return { default: 'AppIcon', __esModule: true };
      throw Error('Unexpected admin import: ' + name);
    } });
    vm.runInContext(source, context);
    return context.exports;
  }
  const ui = compile('components/common/UI.jsx');
  const component = compile(file).default;
  function expand(tree) {
    if (Array.isArray(tree)) return tree.map(expand);
    if (!tree || typeof tree !== 'object') return tree;
    if (typeof tree.type === 'function') return expand(tree.type({ ...tree.props, children: tree.props.children }));
    return { ...tree, props: { ...tree.props, children: expand(tree.props.children) } };
  }
  function render() { cursor = effectCursor = memoCursor = 0; return expand(component()); }
  async function settle() {
    for (let pass = 0; pass < 4; pass++) { render(); effects.splice(0).forEach(effect => effect()); await new Promise(resolve => setImmediate(resolve)); }
    return render();
  }
  return { settle, render };
}

test('admin feedback filters real recovery/general responses without providing a submission form', async () => {
  const screen = harness('pages/Feedback.jsx', { getAll: async () => [recovery, general] });
  let tree = await screen.settle();
  assert.equal(nodes(tree).filter(node => node.type === 'article').length, 2);
  assert.equal(nodes(tree).filter(node => node.type === 'form' || node.type === 'textarea').length, 0);
  const change = async (label, value) => { nodes(tree).find(node => node.props?.['aria-label'] === label).props.onChange({ target: { value } }); tree = await screen.settle(); };
  await change('Feedback type', 'general');
  assert.equal(nodes(tree).filter(node => node.type === 'article').length, 1);
  assert.match(JSON.stringify(nodes(tree).find(node => node.type === 'article')), /Improve search/);
  await change('Feedback type', 'all');
  await change('Recovery speed', '1–3 days');
  assert.equal(nodes(tree).filter(node => node.type === 'article').length, 1);
  assert.match(JSON.stringify(nodes(tree).find(node => node.type === 'article')), /Blue bag/);
  await change('Rating', '1');
  assert.match(JSON.stringify(tree), /No feedback matches your filters/);
});

test('admin feedback loading, empty, failure and retry states do not invent submissions', async () => {
  let fail = true;
  const screen = harness('pages/Feedback.jsx', { getAll: async () => { if (fail) throw Error('Server unavailable'); return []; } });
  assert.match(JSON.stringify(screen.render()), /Loading your workspace/);
  let tree = await screen.settle();
  assert.match(JSON.stringify(tree), /Server unavailable/);
  assert.equal(nodes(tree).filter(node => node.type === 'article').length, 0);
  fail = false;
  const retry = nodes(tree).find(node => node.type === 'button' && JSON.stringify(node).includes('Try again'));
  await retry.props.onClick();
  tree = await screen.settle();
  assert.match(JSON.stringify(tree), /No feedback yet/);
});

test('admin recovery metrics distinguish missing ratings from zero and explain their independent denominator', async () => {
  const summary = { tracking_started_at: '2026-10-17T00:00:00Z', confirmed_recoveries: 2, average_hours: 48, median_hours: 48, satisfaction_percent: null, response_rate_percent: 0, recovery_responses: 0, excluded_durations: 1, speed_distribution: [{ label: '1–3 days', count: 1 }], monthly: [] };
  const screen = harness('components/common/RecoveryMetrics.jsx', { getSummary: async () => summary });
  const tree = await screen.settle();
  assert.match(JSON.stringify(tree), /2.0 days/);
  assert.match(JSON.stringify(tree), /Share of confirmed recoveries that received owner feedback/);
  assert.match(JSON.stringify(tree), /General app feedback is listed below and is excluded/);
  assert.match(JSON.stringify(tree), /Only recorded, verified handovers are included/);
  assert.match(JSON.stringify(tree), /excluded from timing figures/);
  for (const heading of ['Recovery results', 'Owner feedback', 'Monthly trends']) assert.ok(nodes(tree).some(node => node.type === 'h3' && node.props.children?.includes(heading)));
  assert.doesNotMatch(JSON.stringify(tree), /NaN|Invalid Date/);
  const satisfaction = nodes(tree).find(node => node.type === 'div' && node.props.children?.[0]?.props?.children?.[0] === 'Recovery satisfaction');
  assert.equal(satisfaction.props.children[1].props.children[0], '—');
});
