import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import { keyboardOverlap } from '../services/keyboardLayout.mjs';

// Measure in window coordinates: safe areas, stack headers and Android's native
// resize are already reflected here. Reserve only the remaining IME overlap.
export default function KeyboardViewport({ children, style, onVisibilityChange }) {
  const viewport = useRef(null), frame = useRef(null), alive = useRef(true);
  const timers = useRef([]), revision = useRef(0);
  const [overlap, setOverlap] = useState(0);
  const measure = useCallback(() => {
    const current = ++revision.current;
    viewport.current?.measureInWindow((_x, y, _width, height) => {
      if (alive.current && current === revision.current) setOverlap(keyboardOverlap(y, height, frame.current));
    });
  }, []);
  useEffect(() => {
    alive.current = true;
    const update = event => {
      timers.current.forEach(clearTimeout); timers.current = [];
      frame.current = event?.endCoordinates || null;
      onVisibilityChange?.(Boolean(frame.current?.height));
      if (!frame.current) { revision.current++; setOverlap(0); }
      measure();
      // Some Android keyboards finish resize after keyboardDidShow.
      timers.current = [setTimeout(measure, 50), setTimeout(measure, 250)];
    };
    const subscriptions = [Keyboard.addListener('keyboardDidShow', update), Keyboard.addListener('keyboardDidHide', () => update(null))];
    if (Platform.OS === 'ios') subscriptions.push(Keyboard.addListener('keyboardWillChangeFrame', update));
    if (Keyboard.isVisible?.()) update({ endCoordinates: Keyboard.metrics?.() });
    return () => { alive.current = false; revision.current++; timers.current.forEach(clearTimeout); subscriptions.forEach(item => item.remove()); };
  }, [measure, onVisibilityChange]);
  return <View ref={viewport} style={[{ flex: 1 }, style]} onLayout={measure} collapsable={false}>
    <View style={{ flex: 1, paddingBottom: overlap }}>{children}</View>
  </View>;
}
