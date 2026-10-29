import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Keyboard, PanResponder, StyleSheet, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccessibility } from '../context/AccessibilityContext';
import FormIcon from './FormIcon';
import { buttonBounds, clampButtonPosition, normalizeButtonPosition, restoreButtonPosition, parseButtonPosition, isButtonDrag, THEME_POSITION_KEY } from '../theme/floatingButton.mjs';

export default function FloatingThemeButton() {
  const { themeMode, setThemeMode, highContrast, setHighContrast, themeColors, largeTouchTargets, scaledFontSize, ttsEnabled, speak } = useAccessibility();
  const insets = useSafeAreaInsets();
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [loaded, setLoaded] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const size = Math.max(largeTouchTargets ? 56 : 48, scaledFontSize(22) + 16);
  const bounds = useMemo(() => buttonBounds(layout.width, layout.height, size, insets), [layout, size, insets]);
  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;
  const animation = useRef(new Animated.ValueXY()).current;
  const pointRef = useRef({ x: 0, y: 0 });
  const startRef = useRef(pointRef.current);
  const savedRef = useRef(null);
  const draggingRef = useRef(false);
  const suppressTapUntil = useRef(0);
  const saveQueue = useRef(Promise.resolve());
  const actionLabel = highContrast ? 'Exit high contrast mode' : 'Switch to ' + (themeMode === 'dark' ? 'light' : 'dark') + ' mode';

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_POSITION_KEY).then(saved => {
      if (active) savedRef.current = parseButtonPosition(saved);
    }).catch(() => {}).finally(() => { if (active) setLoaded(true); });
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { active = false; show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (!loaded || !layout.width || !layout.height) return;
    // Store fractions so the control stays reachable after rotation or font changes.
    const next = savedRef.current
      ? restoreButtonPosition(savedRef.current, bounds)
      : clampButtonPosition({ x: bounds.maxX, y: layout.height - Math.max(16, insets.bottom) - (ttsEnabled ? 148 : 84) - size }, bounds);
    pointRef.current = next;
    startRef.current = next;
    animation.setValue(next);
  }, [loaded, layout, bounds, animation, size, insets.bottom, ttsEnabled]);

  const responder = useMemo(() => {
    const finishDrag = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      suppressTapUntil.current = Date.now() + 250;
      const point = clampButtonPosition(pointRef.current, boundsRef.current);
      pointRef.current = point;
      animation.setValue(point);
      savedRef.current = normalizeButtonPosition(point, boundsRef.current);
      const saved = JSON.stringify(savedRef.current);
      saveQueue.current = saveQueue.current.catch(() => {}).then(() => AsyncStorage.setItem(THEME_POSITION_KEY, saved)).catch(() => {});
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => isButtonDrag(gesture),
      onMoveShouldSetPanResponderCapture: (_, gesture) => isButtonDrag(gesture),
      onPanResponderGrant: () => { draggingRef.current = true; startRef.current = pointRef.current; },
      onPanResponderMove: (_, { dx, dy }) => {
        const point = clampButtonPosition({ x: startRef.current.x + dx, y: startRef.current.y + dy }, boundsRef.current);
        pointRef.current = point;
        animation.setValue(point);
      },
      onPanResponderRelease: finishDrag,
      onPanResponderTerminate: finishDrag,
      onPanResponderTerminationRequest: () => true,
    });
  }, [animation]);

  const toggleTheme = () => {
    if (draggingRef.current || Date.now() < suppressTapUntil.current) return;
    if (highContrast) {
      setHighContrast(false);
      speak('High contrast disabled');
      return;
    }
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    speak(next === 'light' ? 'Light mode enabled' : 'Dark mode enabled');
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={({ nativeEvent }) => {
      const { width, height } = nativeEvent.layout;
      setLayout(previous => previous.width === width && previous.height === height ? previous : { width, height });
    }}>
      {loaded && layout.width > 0 && !keyboardVisible && (
        <Animated.View {...responder.panHandlers} style={[styles.floating, { transform: animation.getTranslateTransform() }]}>
          <TouchableOpacity
            style={[styles.button, { width: size, minHeight: size, borderRadius: size / 2, backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
            onPress={toggleTheme}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            accessibilityHint="Tap to change appearance. Drag to move this button."
          >
            <FormIcon name={highContrast ? 'circle' : themeMode === 'dark' ? 'sun' : 'moon'} size={22} color={themeColors.accent} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  floating: { position: 'absolute', top: 0, left: 0, zIndex: 100, elevation: 8 },
  button: {
    borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
  },
});
