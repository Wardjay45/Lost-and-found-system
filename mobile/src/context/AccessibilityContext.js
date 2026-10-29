import React, { createContext, useState, useContext, useCallback, useRef, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palettes, themeStyleSheet, themeStyleColor } from '../theme/palette.mjs';
import { createSpeechController } from '../services/speech.mjs';
import { createPreferenceStore } from '../services/accessibilityPreferences.mjs';

const AccessibilityContext = createContext(null);

export function AccessibilityProvider({ children }) {
  const [ttsEnabled, setTtsEnabledState] = useState(false);
  const [speechState, setSpeechState] = useState({ text: '', isSpeaking: false });
  const speechControllerRef = useRef(null);
  if (!speechControllerRef.current) {
    speechControllerRef.current = createSpeechController({ getSpeech: () => require('expo-speech'), onChange: setSpeechState });
  }
  const speechController = speechControllerRef.current;
  const preferencesRef = useRef(null);
  if (!preferencesRef.current) preferencesRef.current = createPreferenceStore(AsyncStorage);
  const preferences = preferencesRef.current;
  const setTtsEnabled = useCallback(value => {
    const enabled = Boolean(value);
    speechController.setEnabled(enabled);
    setTtsEnabledState(enabled);
    preferences.change('ttsEnabled', enabled);
    if (enabled) speechController.speak('Text to speech enabled');
  }, [speechController, preferences]);
  useEffect(() => () => speechController.setEnabled(false), [speechController]);
  const [highContrast, setHighContrastState] = useState(false);
  const [fontSize, setFontSizeState] = useState('medium');
  const [largeTouchTargets, setLargeTouchTargetsState] = useState(false);
  const [reduceMotion, setReduceMotionState] = useState(false);
  const setHighContrast = useCallback(value => { setHighContrastState(value); preferences.change('highContrast', value); }, [preferences]);
  const setFontSize = useCallback(value => { if (!['small', 'medium', 'large', 'xlarge'].includes(value)) return; setFontSizeState(value); preferences.change('fontSize', value); }, [preferences]);
  const setLargeTouchTargets = useCallback(value => { setLargeTouchTargetsState(value); preferences.change('largeTouchTargets', value); }, [preferences]);
  const setReduceMotion = useCallback(value => { setReduceMotionState(value); preferences.change('reduceMotion', value); }, [preferences]);
  useEffect(() => {
    let mounted = true;
    preferences.load().then(() => {
      if (!mounted) return;
      const saved = preferences.snapshot();
      setHighContrastState(saved.highContrast); setFontSizeState(saved.fontSize);
      setLargeTouchTargetsState(saved.largeTouchTargets); setReduceMotionState(saved.reduceMotion);
      setTtsEnabledState(saved.ttsEnabled); speechController.setEnabled(saved.ttsEnabled);
    });
    return () => { mounted = false; };
  }, [preferences, speechController]);
  const [themeMode, setThemeModeState] = useState('dark');
  useEffect(() => {
    AsyncStorage.getItem('mobile-theme').then(saved => {
      if (saved === 'light' || saved === 'dark') setThemeModeState(saved);
    }).catch(() => {});
  }, []);
  const setThemeMode = useCallback(mode => {
    if (mode !== 'light' && mode !== 'dark') return;
    setThemeModeState(mode);
    AsyncStorage.setItem('mobile-theme', mode).catch(() => {});
  }, []);
  const activeTheme = highContrast ? 'contrast' : themeMode;
  const themeColors = palettes[activeTheme];
  const readableColor = useCallback(color => themeStyleColor('color', color, activeTheme), [activeTheme]);


  // Stable callbacks read the controller's current enabled state, including old timers.
  const speak = useCallback(text => speechController.speak(text), [speechController]);
  const stopSpeaking = useCallback(() => speechController.stop(), [speechController]);
  const announceNavigation = useCallback(screenName => speechController.announce(screenName), [speechController]);

  const getFontScale = useCallback(() => {
    switch (fontSize) {
      case 'small': return 0.85;
      case 'medium': return 1.0;
      case 'large': return 1.2;
      case 'xlarge': return 1.5;
      default: return 1.0;
    }
  }, [fontSize]);

  const fontScale = getFontScale();

  const accessibilityStyles = useMemo(() => ({
    container: { backgroundColor: themeColors.background },
    card: { backgroundColor: themeColors.surface, borderColor: themeColors.border },
    input: { backgroundColor: themeColors.input, borderColor: themeColors.border, color: themeColors.text },
    text: { color: themeColors.text },
    textMuted: { color: themeColors.muted },
    textAccent: { color: themeColors.accent },
    border: { borderColor: themeColors.border },
    touch: largeTouchTargets ? { minHeight: 56, minWidth: 56 } : {},
    fontScale,
    reduceMotion,
  }), [themeColors, largeTouchTargets, fontScale, reduceMotion]);

  const scaledFontSize = useCallback((size) => Math.round(size * fontScale), [fontScale]);

  return (
    <AccessibilityContext.Provider value={{
      ttsEnabled, setTtsEnabled,
      highContrast, setHighContrast,
      themeMode, setThemeMode, activeTheme, themeColors, readableColor,
      fontSize, setFontSize,
      voiceNav: false, setVoiceNav: () => {},
      largeTouchTargets, setLargeTouchTargets,
      reduceMotion, setReduceMotion,
      speak, stopSpeaking,
      speechText: speechState.text, isSpeaking: speechState.isSpeaking,
      announceNavigation,
      getFontScale, accessibilityStyles, scaledFontSize,
    }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export const useAccessibility = () => useContext(AccessibilityContext);
export function useThemedStyles(baseStyles) {
  const { activeTheme, accessibilityStyles } = useAccessibility();
  const fontScale = accessibilityStyles.fontScale;
  return useMemo(() => themeStyleSheet(baseStyles, activeTheme, fontScale), [baseStyles, activeTheme, fontScale]);
}
