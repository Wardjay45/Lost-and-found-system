import React, { createContext, useState, useContext, useCallback, useRef, useMemo } from 'react';

const AccessibilityContext = createContext(null);

export function AccessibilityProvider({ children }) {
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState('medium'); // small, medium, large, xlarge
  const [largeTouchTargets, setLargeTouchTargets] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Prevent rapid repeated speech
  const lastSpokenRef = useRef('');
  const lastSpokenTimeRef = useRef(0);

  const speak = useCallback((text) => {
    if (ttsEnabled && text) {
      const now = Date.now();
      if (text === lastSpokenRef.current && now - lastSpokenTimeRef.current < 3000) return;
      lastSpokenRef.current = text;
      lastSpokenTimeRef.current = now;
      try {
        const Speech = require('expo-speech');
        Speech.speak(text, { rate: 0.85, pitch: 1.0 });
      } catch (e) {
        console.log('TTS not available');
      }
    }
  }, [ttsEnabled]);

  const stopSpeaking = useCallback(() => {
    try {
      const Speech = require('expo-speech');
      Speech.stop();
    } catch (e) {}
  }, []);

  const announceNavigation = useCallback((screenName) => {
    if (!ttsEnabled) return;
    try {
      const Speech = require('expo-speech');
      Speech.stop();
      setTimeout(() => speak(screenName), 100);
    } catch (e) {
      speak(screenName);
    }
  }, [ttsEnabled, speak]);

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

  // *** ACTUAL ACCESSIBILITY STYLES THAT SCREENS WILL USE ***
  // IMPORTANT: when high contrast is OFF, return empty object so it doesn't override defaults
  const accessibilityStyles = useMemo(() => ({
    container: highContrast ? { backgroundColor: '#000000' } : {},
    card: highContrast ? { backgroundColor: '#1a1a1a', borderColor: '#ffffff' } : {},
    text: highContrast ? { color: '#ffffff' } : {},
    textMuted: highContrast ? { color: '#cccccc' } : {},
    textAccent: highContrast ? { color: '#ffcc00' } : {},
    border: highContrast ? { borderColor: '#ffffff' } : {},
    touch: largeTouchTargets ? { minHeight: 56, minWidth: 56 } : {},
    fontScale,
    reduceMotion,
  }), [highContrast, largeTouchTargets, fontScale, reduceMotion]);

  const scaledFontSize = useCallback((size) => Math.round(size * fontScale), [fontScale]);

  return (
    <AccessibilityContext.Provider value={{
      ttsEnabled, setTtsEnabled,
      highContrast, setHighContrast,
      fontSize, setFontSize,
      voiceNav: false, setVoiceNav: () => {},
      largeTouchTargets, setLargeTouchTargets,
      reduceMotion, setReduceMotion,
      speak, stopSpeaking,
      announceNavigation,
      getFontScale, accessibilityStyles, scaledFontSize,
    }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export const useAccessibility = () => useContext(AccessibilityContext);