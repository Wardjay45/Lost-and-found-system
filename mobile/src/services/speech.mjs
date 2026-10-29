// Own the native speech queue and pending announcements in one place.
export function createSpeechController({ getSpeech, onChange = () => {}, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let enabled = false;
  let generation = 0;
  let pendingTimer = null;
  let stopped = Promise.resolve();
  let ready = null;
  const idle = () => onChange({ text: '', isSpeaking: false });
  const cancelTimer = () => {
    if (pendingTimer !== null) clearTimer(pendingTimer);
    pendingTimer = null;
  };
  const stopNative = () => {
    try {
      // Call immediately, but wait for every outstanding stop before new speech.
      const result = getSpeech().stop();
      stopped = Promise.all([stopped, Promise.resolve(result)]).then(() => {}).catch(() => {});
    } catch { stopped = stopped.catch(() => {}); }
    return stopped;
  };
  const stop = () => {
    generation++;
    cancelTimer();
    idle();
    return stopNative();
  };
  const speak = text => {
    if (!enabled || typeof text !== 'string' || !text.trim()) return false;
    const message = text.trim();
    const request = ++generation;
    cancelTimer();
    idle();
    const afterStop = stopNative();
    const finish = () => { if (request === generation) idle(); };
    try {
      const native = getSpeech();
      if (!ready) {
        // Android stop() does not clear utterances waiting for engine startup.
        // getAvailableVoicesAsync() resolves after startup without queuing speech.
        ready = Promise.resolve(native.getAvailableVoicesAsync()).catch(error => { ready = null; throw error; });
      }
      Promise.all([afterStop, ready]).then(() => {
        if (!enabled || request !== generation) return;
        try {
          native.speak(message, {
            rate: 0.85, pitch: 1.0,
            onStart: () => { if (enabled && request === generation) onChange({ text: message, isSpeaking: true }); },
            onDone: finish, onStopped: finish, onError: finish,
          });
        } catch { finish(); }
      }).catch(finish);
    } catch { finish(); }
    return true;
  };
  const announce = (text, delay = 400) => {
    if (!enabled) return false;
    stop();
    const request = generation;
    pendingTimer = setTimer(() => {
      pendingTimer = null;
      if (enabled && request === generation) speak(text);
    }, delay);
    return true;
  };
  return {
    speak, stop, announce,
    setEnabled(value) { enabled = Boolean(value); if (!enabled) stop(); },
  };
}

export function cleanSpokenLabel(text) {
  return String(text || '').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/[‹›←→▼▲✕✓◐☀☾]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Inspect rendered child text only. Never read TextInput values or props.
export function textFromChildren(children) {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(textFromChildren).filter(Boolean).join(' ');
  if (!children || typeof children !== 'object' || children.props?.secureTextEntry) return '';
  return textFromChildren(children.props?.children);
}
