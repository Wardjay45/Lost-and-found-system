import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechController, cleanSpokenLabel, textFromChildren } from '../src/services/speech.mjs';

const flush = () => new Promise(resolve => setImmediate(resolve));
function harness({ stop = () => Promise.resolve() } = {}) {
  const calls = [];
  const statuses = [];
  const timers = new Map();
  let nextTimer = 0;
  let stops = 0;
  const native = { getAvailableVoicesAsync: () => Promise.resolve([]), stop: () => { stops++; return stop(); }, speak: (text, options) => { calls.push({ text, options }); options.onStart(); } };
  const controller = createSpeechController({
    getSpeech: () => native,
    onChange: value => statuses.push(value),
    setTimer: callback => { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimer: id => timers.delete(id),
  });
  return { controller, calls, statuses, timers, native, get stops() { return stops; }, runTimers() { for (const callback of [...timers.values()]) callback(); timers.clear(); } };
}

test('turning TTS off immediately stops native speech and ignores old speak callbacks', async () => {
  const h = harness();
  h.controller.setEnabled(true);
  const oldSpeak = h.controller.speak;
  oldSpeak('Reading a screen');
  await flush();
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.statuses.at(-1), { text: 'Reading a screen', isSpeaking: true });
  const before = h.stops;
  h.controller.setEnabled(false);
  assert.equal(h.stops, before + 1, 'native stop must be invoked during the toggle handler');
  assert.deepEqual(h.statuses.at(-1), { text: '', isSpeaking: false });
  assert.equal(oldSpeak('Stale delayed announcement'), false);
  h.calls[0].options.onStart();
  await flush();
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.statuses.at(-1), { text: '', isSpeaking: false });
});

test('off cancels pending navigation even if TTS is enabled again before the timer fires', async () => {
  const h = harness();
  h.controller.setEnabled(true);
  h.controller.announce('Old screen');
  assert.equal(h.timers.size, 1);
  h.controller.setEnabled(false);
  h.controller.setEnabled(true);
  h.runTimers();
  await flush();
  assert.equal(h.calls.length, 0);
  h.controller.announce('Current screen');
  h.runTimers();
  await flush();
  assert.equal(h.calls[0].text, 'Current screen');
});

test('turning off before an asynchronous native stop resolves cannot restart speech', async () => {
  let resolveStop;
  const h = harness({ stop: () => new Promise(resolve => { resolveStop = resolve; }) });
  h.controller.setEnabled(true);
  h.controller.speak('Never start');
  const firstStop = resolveStop;
  h.controller.setEnabled(false);
  firstStop();
  resolveStop();
  await flush();
  assert.equal(h.calls.length, 0);
});

test('rapid taps speak only the latest request instead of building a native queue', async () => {
  const h = harness();
  h.controller.setEnabled(true);
  h.controller.speak('First button');
  h.controller.speak('Second button');
  await flush();
  assert.deepEqual(h.calls.map(call => call.text), ['Second button']);
});

test('a later tap cancels the delayed announcement for an earlier navigation', async () => {
  const h = harness();
  h.controller.setEnabled(true);
  h.controller.announce('Earlier screen');
  h.controller.speak('Tapped switch');
  h.runTimers();
  await flush();
  assert.deepEqual(h.calls.map(call => call.text), ['Tapped switch']);
});

test('repeated taps on the same control are read aloud and stop does not disable TTS', async () => {
  const h = harness();
  h.controller.setEnabled(true);
  h.controller.speak('Refresh reports');
  await flush();
  h.controller.stop();
  h.controller.speak('Refresh reports');
  await flush();
  assert.equal(h.calls.length, 2);
});

test('callbacks from an interrupted utterance cannot clear the current read-aloud status', async () => {
  const h = harness();
  h.controller.setEnabled(true);
  h.controller.speak('First');
  await flush();
  const old = h.calls[0].options;
  h.controller.speak('Second');
  await flush();
  old.onDone(); old.onStopped(); old.onError();
  assert.deepEqual(h.statuses.at(-1), { text: 'Second', isSpeaking: true });
  h.calls[1].options.onDone();
  assert.deepEqual(h.statuses.at(-1), { text: '', isSpeaking: false });
});

test('native speech failures clear the reading indicator without rejecting the tap handler', async () => {
  const h = harness();
  h.native.speak = () => { throw Error('Speech unavailable'); };
  h.controller.setEnabled(true);
  h.controller.speak('Text');
  await flush();
  assert.deepEqual(h.statuses.at(-1), { text: '', isSpeaking: false });
});

test('button labels omit decorative glyphs and never use input values', () => {
  const children = [{ props: { children: '🔊' } }, { props: { children: ['Open ', { props: { children: 'Settings' } }, ' ›'] } }, { props: { value: 'private-password', secureTextEntry: true } }];
  assert.equal(cleanSpokenLabel(textFromChildren(children)), 'Open Settings');
  assert.equal(textFromChildren({ props: { value: 'private-email@example.edu' } }), '');
});

test('Android engine startup cannot enqueue speech that survives turning TTS off', async () => {
  let ready;
  const h = harness();
  h.native.getAvailableVoicesAsync = () => new Promise(resolve => { ready = resolve; });
  h.controller.setEnabled(true);
  h.controller.speak('Speech requested during startup');
  await flush();
  assert.equal(h.calls.length, 0, 'do not add speech to Android startup queue');
  h.controller.setEnabled(false);
  ready([]);
  await flush();
  assert.equal(h.calls.length, 0);
});

test('off/on while Android is starting speaks only the new request after readiness', async () => {
  let ready;
  const h = harness();
  h.native.getAvailableVoicesAsync = () => new Promise(resolve => { ready = resolve; });
  h.controller.setEnabled(true);
  h.controller.speak('Old request');
  h.controller.setEnabled(false);
  h.controller.setEnabled(true);
  h.controller.speak('New request');
  ready([]);
  await flush();
  assert.deepEqual(h.calls.map(call => call.text), ['New request']);
});
