import React, { useCallback, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { TouchableOpacity } from './SpeechControls';
import FormIcon from './FormIcon';
import { initApiUrl } from '../config/api';
import { requestFeedback, nextFeedbackPrompt } from '../services/feedback.mjs';

export function useRecoveryFeedback() {
  const { user, token } = useAuth();
  const [state, setState] = useState({ owner: null, recoveries: [], prompt: null, error: '' });
  const request = useRef(0);
  const prompted = useRef(new Set());
  const dismissKey = `feedback-dismissed:${user?.id}`;
  const refreshFeedback = useCallback(async () => {
    const current = ++request.current;
    if (!user?.id || !token || token === 'supabase-direct') {
      setState({ owner: user?.id, recoveries: [], prompt: null, error: '' });
      return;
    }
    try {
      const [records, stored] = await Promise.all([requestFeedback(await initApiUrl(), '/recoveries', token), AsyncStorage.getItem(dismissKey)]);
      if (!Array.isArray(records)) throw new Error('Invalid recovery response. Please refresh.');
      let dismissed = [];
      try { const parsed = JSON.parse(stored || '[]'); if (Array.isArray(parsed)) dismissed = parsed; } catch {}
      const prompt = prompted.current.has(user.id) ? null : nextFeedbackPrompt(records, dismissed);
      if (current === request.current) setState({ owner: user.id, recoveries: records, prompt, error: '' });
    } catch (error) {
      if (current === request.current) setState(previous => ({ owner: user.id, recoveries: previous.owner === user.id ? previous.recoveries : [], prompt: null, error: error.message }));
    }
  }, [user?.id, token, dismissKey]);
  useFocusEffect(useCallback(() => {
    refreshFeedback();
    return () => { request.current++; };
  }, [refreshFeedback]));
  const dismissPrompt = async () => {
    if (!state.prompt || state.owner !== user?.id) return;
    const id = state.prompt.id;
    prompted.current.add(user.id);
    setState(previous => ({ ...previous, prompt: null }));
    try {
      const stored = JSON.parse(await AsyncStorage.getItem(dismissKey) || '[]');
      await AsyncStorage.setItem(dismissKey, JSON.stringify([...new Set([...(Array.isArray(stored) ? stored : []), id])].slice(-200)));
    } catch {}
  };
  return state.owner === user?.id ? { ...state, refreshFeedback, dismissPrompt } : { recoveries: [], prompt: null, error: '', refreshFeedback, dismissPrompt };
}

export function RecoveryFeedbackPrompt({ recovery, onLater, onRate }) {
  const { accessibilityStyles: HC, scaledFontSize, themeColors } = useAccessibility();
  if (!recovery) return null;
  return <View style={[{ padding: 18, margin: 20, borderRadius: 16, gap: 12 }, HC.card]}>
    <Text style={[HC.text, { fontSize: scaledFontSize(17), fontWeight: '700' }]}>How was your recovery experience?</Text>
    <Text style={[HC.textMuted, { fontSize: scaledFontSize(14) }]}>{recovery.item_description}. Feedback is optional and helps us improve the return process.</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Rate recovery experience" onPress={onRate} style={[{ minHeight: 48, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, HC.touch]}>
        <FormIcon name="star" color={themeColors.accent} /><Text style={[HC.textAccent, { fontSize: scaledFontSize(15), fontWeight: '700' }]}>Rate experience</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Leave recovery feedback later" onPress={onLater} style={[{ minHeight: 48, padding: 12, justifyContent: 'center' }, HC.touch]}>
        <Text style={[HC.textMuted, { fontSize: scaledFontSize(15) }]}>Later</Text>
      </TouchableOpacity>
    </View>
  </View>;
}

export function RecoveryFeedbackButton({ recovery, onPress }) {
  const { accessibilityStyles: HC, scaledFontSize, themeColors } = useAccessibility();
  if (!recovery) return null;
  const label = recovery.feedback ? 'View feedback' : 'Leave feedback';
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label} for ${recovery.item_description}`} onPress={onPress}
    style={[{ minHeight: 44, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }, HC.touch]}>
    <FormIcon name={recovery.feedback ? 'check-circle' : 'star'} size={16} color={themeColors.accent} />
    <Text style={[HC.textAccent, { fontSize: scaledFontSize(13), fontWeight: '700', flexShrink: 1 }]}>{label}</Text>
  </TouchableOpacity>;
}
