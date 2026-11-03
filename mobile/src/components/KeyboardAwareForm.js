import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { Keyboard, ScrollView } from 'react-native';
import KeyboardViewport from './KeyboardViewport';
import { focusedFieldScroll } from '../services/keyboardLayout.mjs';

const KeyboardAwareForm = forwardRef(function KeyboardAwareForm({ children, ...props }, ref) {
  const scroll = useRef(null), focused = useRef(null), timer = useRef(null), offset = useRef(0), alive = useRef(true);
  const reveal = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const input = focused.current;
      if (!input?.measureInWindow || !scroll.current) return;
      const container = scroll.current;
      container.measureInWindow((_x, viewportTop, _width, viewportHeight) => {
        input.measureInWindow((_inputX, fieldTop, _inputWidth, fieldHeight) => {
          if (!alive.current || focused.current !== input) return;
          const y = focusedFieldScroll({ fieldTop, fieldHeight, viewportTop, viewportHeight, keyboardTop: Keyboard.metrics?.()?.screenY, offset: offset.current });
          if (y !== null) container.scrollTo({ y, animated: true });
        });
      });
    }, 120);
  }, []);
  useImperativeHandle(ref, () => ({
    focusInput(input) { focused.current = input; reveal(); },
    revealFocusedInput: reveal,
  }), [reveal]);
  useEffect(() => {
    alive.current = true;
    const shown = Keyboard.addListener('keyboardDidShow', reveal);
    return () => { alive.current = false; shown.remove(); clearTimeout(timer.current); };
  }, [reveal]);
  return <KeyboardViewport>
    <ScrollView {...props} ref={scroll} onLayout={reveal} onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; props.onScroll?.(event); }} scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentInsetAdjustmentBehavior="never">
      {children}
    </ScrollView>
  </KeyboardViewport>;
});
export default KeyboardAwareForm;
