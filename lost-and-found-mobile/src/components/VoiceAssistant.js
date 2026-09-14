import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';

export default function VoiceAssistant({ text, onSpeak, autoSpeak }) {
  const { ttsEnabled, speak, stopSpeaking, voiceNav, fontSize } = useAccessibility();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));
  const timerRef = useRef(null);

  useEffect(() => {
    if (autoSpeak && text && ttsEnabled) {
      handleSpeak();
    }
  }, [autoSpeak, text]);

  useEffect(() => {
    if (isSpeaking) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.7, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isSpeaking]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleSpeak = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    } else {
      const textToSpeak = onSpeak ? onSpeak() : text;
      if (textToSpeak) {
        speak(textToSpeak);
        setIsSpeaking(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setIsSpeaking(false), textToSpeak.length * 60 + 500);
      }
    }
  };

  if (!ttsEnabled && !voiceNav) return null;

  return (
    <TouchableOpacity
      style={[styles.button, isSpeaking && styles.speaking]}
      onPress={handleSpeak}
      activeOpacity={0.7}
      accessibilityLabel={isSpeaking ? 'Stop speaking' : 'Read aloud'}
      accessibilityRole="button"
    >
      <Animated.View style={[styles.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
        <Text style={styles.icon}>{isSpeaking ? '🔊' : '🔈'}</Text>
      </Animated.View>
      {voiceNav && <Text style={styles.label}>{isSpeaking ? 'Stop' : 'Listen'}</Text>}
    </TouchableOpacity>
  );
}

/**
 * Floating stop button shown when TTS is enabled.
 * Tap it anywhere to instantly stop speech.
 */
export function TTSStopButton() {
  const { ttsEnabled, stopSpeaking } = useAccessibility();
  if (!ttsEnabled) return null;

  return (
    <TouchableOpacity
      style={styles.stopButton}
      onPress={stopSpeaking}
      activeOpacity={0.8}
      accessibilityLabel="Stop text to speech"
      accessibilityRole="button"
    >
      <Text style={styles.stopIcon}>🔇</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 70, 229, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.2)',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  speaking: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  iconWrap: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 16,
  },
  label: {
    fontSize: 12,
    color: '#818cf8',
    fontWeight: '600',
  },
  stopButton: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
  },
  stopIcon: {
    fontSize: 20,
  },
});
