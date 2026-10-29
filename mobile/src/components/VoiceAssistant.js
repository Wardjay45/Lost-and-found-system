import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useAccessibility, useThemedStyles } from '../context/AccessibilityContext';
import FormIcon from './FormIcon';

export default function VoiceAssistant({ text, onSpeak, autoSpeak }) {
  const styles = useThemedStyles(baseStyles);
  const { ttsEnabled, speak, stopSpeaking, isSpeaking, speechText, reduceMotion } = useAccessibility();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const requestedText = useRef(text);
  const reading = isSpeaking && speechText === requestedText.current;

  useEffect(() => {
    if (autoSpeak && text && ttsEnabled) {
      requestedText.current = text;
      speak(text);
    }
  }, [autoSpeak, text, ttsEnabled, speak]);

  useEffect(() => {
    if (!reading || reduceMotion) { pulseAnim.setValue(1); return; }
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.7, duration: 600, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => { pulse.stop(); pulseAnim.setValue(1); };
  }, [reading, reduceMotion, pulseAnim]);

  const handleSpeak = () => {
    if (reading) { stopSpeaking(); return; }
    const message = onSpeak ? onSpeak() : text;
    if (message) { requestedText.current = message; speak(message); }
  };

  if (!ttsEnabled) return null;
  return (
    <TouchableOpacity style={[styles.button, reading && styles.speaking]} onPress={handleSpeak} activeOpacity={0.7}
      accessibilityLabel={reading ? 'Stop speaking' : 'Read aloud'} accessibilityRole="button">
      <Animated.View style={[styles.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
        <FormIcon name={reading ? 'volume-x' : 'volume-2'} size={18} />
      </Animated.View>
    </TouchableOpacity>
  );
}

export function TTSStopButton() {
  const styles = useThemedStyles(baseStyles);
  const { ttsEnabled, stopSpeaking } = useAccessibility();
  if (!ttsEnabled) return null;
  return (
    <TouchableOpacity style={styles.stopButton} onPress={stopSpeaking} activeOpacity={0.8}
      accessibilityLabel="Stop text to speech" accessibilityRole="button">
      <FormIcon name="volume-x" size={20} color="#ffffff" />
    </TouchableOpacity>
  );
}

const baseStyles = StyleSheet.create({
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
});
