import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuid } from 'expo-modules-core';
import { TouchableOpacity, TextInput } from './SpeechControls';
import FormIcon from './FormIcon';
import { useAccessibility, useThemedStyles } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';
import VoiceAssistant from './VoiceAssistant';
import { initApiUrl } from '../config/api';
import { selectSchoolGoogleAccount } from '../services/googleSignIn';
import { requestFeedback, feedbackDraftKey, createFeedbackDraftStore, formatRecoveryTime } from '../services/feedback.mjs';

export default function FeedbackForm({ route, navigation }) {
  const styles = useThemedStyles(baseStyles);
  const { accessibilityStyles: HC, scaledFontSize, themeColors, speak } = useAccessibility();
  const { user, token, continueWithGoogle } = useAuth();
  const recoveryId = route?.params?.recoveryId;
  const kind = recoveryId ? 'recovery' : 'general';
  const key = feedbackDraftKey(user?.id, kind, recoveryId);
  const store = useMemo(() => createFeedbackDraftStore(AsyncStorage, key), [key]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [requestId, setRequestId] = useState('');
  const [recovery, setRecovery] = useState(null);
  const [saved, setSaved] = useState(null);
  const [loadedKey, setLoadedKey] = useState(null);
  const [error, setError] = useState('');
  const [needsGoogle, setNeedsGoogle] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState(false);
  const [reload, setReload] = useState(0);
  const scope = useMemo(() => ({ active: true, busy: false }), [key, token]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const isCurrent = () => scope.active && currentScope.current === scope;

  useEffect(() => {
    scope.active = true;
    setSubmitting(false);
    return () => { scope.active = false; };
  }, [scope]);

  useEffect(() => {
    let active = true;
    setLoadedKey(null); setError(''); setSaved(null); setRecovery(null); setNeedsGoogle(false);
    async function load() {
      try {
        const draft = await store.load();
        if (!active) return;
        setRating(Number.isInteger(draft?.rating) && draft.rating >= 0 && draft.rating <= 5 ? draft.rating : 0);
        setComment(typeof draft?.comment === 'string' ? draft.comment.slice(0, 1000) : '');
        setRequestId(draft?.request_id || uuid.v4());
        setPending(draft?.pending === true);
        const records = await requestFeedback(await initApiUrl(), '/recoveries', token);
        if (!Array.isArray(records)) throw new Error('Unable to load confirmed recoveries. Please retry.');
        const returned = recoveryId ? records.find(record => record.id === recoveryId) : null;
        if (recoveryId && !returned) throw new Error('This account has no confirmed handover for this item. A match alone does not unlock feedback.');
        if (!active) return;
        setRecovery(returned); setSaved(returned?.feedback || null); setLoadedKey(key);
      } catch (failure) {
        if (active) { setError(failure.message); setNeedsGoogle(failure.code === 'GOOGLE_REAUTH_REQUIRED' || failure.status === 401); }
      }
    }
    load();
    return () => { active = false; };
  }, [key, store, token, recoveryId, reload]);

  useEffect(() => {
    if (loadedKey !== key || saved || !requestId) return;
    let active = true;
    store.save({ rating, comment, request_id: requestId, pending }).catch(() => { if (active) setError('Unable to keep your draft on this phone. Free some storage and try again.'); });
    return () => { active = false; };
  }, [rating, comment, requestId, loadedKey, key, saved, store, pending]);

  const signIn = async () => {
    if (scope.busy || !isCurrent()) return;
    scope.busy = true; setSubmitting(true);
    try {
      const selection = await selectSchoolGoogleAccount();
      if (!isCurrent()) return;
      if (selection.cancelled) return;
      if (selection.error) throw new Error(selection.error);
      const result = await continueWithGoogle(selection.idToken);
      if (result.error) throw new Error(result.error);
      if (result.registrationRequired) throw new Error('Use your registered linked school account. Legacy accounts need administrator-assisted linking.');
      if (isCurrent()) setReload(value => value + 1);
    } catch (failure) { if (isCurrent()) setError(failure.message); }
    finally { scope.busy = false; if (isCurrent()) setSubmitting(false); }
  };

  const submit = async () => {
    if (scope.busy || !isCurrent() || saved || loadedKey !== key) return;
    if (!rating) { setError('Please choose a rating from 1 to 5.'); return; }
    scope.busy = true; setSubmitting(true); setError(''); setPending(true);
    try {
      const draft = { rating, comment, request_id: requestId };
      await store.save({ ...draft, pending: true });
      if (!isCurrent()) return;
      const result = await requestFeedback(await initApiUrl(), '', token, { method: 'POST', body: { ...draft, kind, recovery_id: recoveryId || null } });
      if (!result?.id) throw new Error('The server did not confirm your submission. Retry safely using this draft.');
      if (isCurrent()) { setSaved(result); speak('Thank you. Your feedback has been saved.'); }
      if (isCurrent()) {
        try { await store.clear(); } catch { if (isCurrent()) setError('Feedback saved, but the local draft could not be cleared.'); }
      }
    } catch (failure) { if (isCurrent()) { setError(failure.message); setNeedsGoogle(failure.code === 'GOOGLE_REAUTH_REQUIRED' || failure.status === 401); } }
    finally { scope.busy = false; if (isCurrent()) setSubmitting(false); }
  };

  return <SafeAreaView style={[styles.container, HC.container]}><ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
    <View style={styles.header}>
      <FormIcon name="star" size={30} color={themeColors.accent} />
      <Text style={[styles.title, HC.text, { fontSize: scaledFontSize(24) }]}>{kind === 'recovery' ? 'Recovery Feedback' : 'General App Feedback'}</Text>
      <Text style={[HC.textMuted, { fontSize: scaledFontSize(14) }]}>{kind === 'recovery' ? 'Rate your confirmed item return. Feedback is optional.' : 'Share suggestions about the app. This is separate from recovery ratings.'}</Text>
      <VoiceAssistant text="Choose a rating from one to five. Comments are optional." />
    </View>
    {!!error && <View style={[styles.card, HC.card]}><Text accessibilityRole="alert" style={[HC.text, { fontSize: scaledFontSize(14) }]}>{error}</Text>
      <TouchableOpacity accessibilityRole="button" disabled={submitting} onPress={needsGoogle ? signIn : () => setReload(value => value + 1)} style={[styles.action, HC.touch]}>
        <Text style={[HC.textAccent, { fontSize: scaledFontSize(15) }]}>{needsGoogle ? 'Continue with Google' : 'Retry loading feedback'}</Text>
      </TouchableOpacity>
    </View>}
    {loadedKey !== key && !error && <ActivityIndicator accessibilityLabel="Loading feedback" color={themeColors.accent} />}
    {loadedKey === key && <View style={[styles.card, HC.card]}>
      {recovery && <View style={styles.context}>
        <Text style={[HC.text, { fontSize: scaledFontSize(17), fontWeight: '700' }]}>{recovery.item_description}</Text>
        <Text style={[HC.textMuted, { fontSize: scaledFontSize(14) }]}>Report to confirmed handover: {formatRecoveryTime(recovery.recovery_hours)}</Text>
        <Text style={[HC.textMuted, { fontSize: scaledFontSize(12) }]}>Measured automatically from system timestamps.</Text>
      </View>}
      {saved ? <View style={styles.context}>
        <Text accessibilityRole="header" style={[HC.text, { fontSize: scaledFontSize(19), fontWeight: '700' }]}>Thank you — feedback saved</Text>
        <Text style={[HC.text, { fontSize: scaledFontSize(17) }]}>Your rating: {saved.rating} / 5</Text>
        <Text style={[HC.textMuted, { fontSize: scaledFontSize(15) }]}>{saved.comment || 'No additional comments.'}</Text>
      </View> : <>
        <Text style={[HC.text, { fontSize: scaledFontSize(17), fontWeight: '700' }]}>How was your experience?</Text>
        {pending && <Text accessibilityLiveRegion="polite" style={[HC.textMuted, { fontSize: scaledFontSize(14) }]}>Your submission may already be saved. Retry to confirm the original rating and comment before editing.</Text>}
        <View accessibilityRole="radiogroup" accessibilityLabel="Experience rating" style={styles.ratings}>
          {[1, 2, 3, 4, 5].map(value => <TouchableOpacity key={value} disabled={submitting || pending} accessibilityRole="radio" accessibilityLabel={`${value} out of 5 stars`}
            accessibilityState={{ checked: rating === value, disabled: submitting || pending }} onPress={() => { if (!scope.busy && !pending) setRating(value); }} style={[styles.rating, HC.touch, { borderColor: rating === value ? themeColors.accent : themeColors.border }]}>
            <FormIcon name="star" size={24} color={value <= rating ? themeColors.accent : themeColors.muted} /><Text style={[HC.text, { fontSize: scaledFontSize(13) }]}>{value}</Text>
          </TouchableOpacity>)}
        </View>
        <Text style={[HC.textMuted, { fontSize: scaledFontSize(12) }]}>1 = Very dissatisfied · 5 = Very satisfied</Text>
        <Text style={[styles.label, HC.text, { fontSize: scaledFontSize(14) }]}>Comments (optional)</Text>
        <TextInput accessibilityLabel="Feedback comments, optional" style={[styles.input, HC.input, { fontSize: scaledFontSize(15) }]} placeholder="What worked well, or what could be improved?"
          placeholderTextColor={themeColors.muted} value={comment} onChangeText={value => { if (!scope.busy && !pending) setComment(value); }} editable={!submitting && !pending} multiline maxLength={1000} textAlignVertical="top" />
        <Text style={[HC.textMuted, { fontSize: scaledFontSize(12) }]}>{comment.length} / 1000</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Submit feedback" accessibilityState={{ disabled: submitting, busy: submitting }} disabled={submitting} onPress={submit} style={[styles.submit, HC.touch]}>
          {submitting && <ActivityIndicator color="#fff" />}<Text style={{ color: '#fff', fontSize: scaledFontSize(16), fontWeight: '700' }}>{submitting ? 'Saving feedback…' : 'Submit Feedback'}</Text>
        </TouchableOpacity>
      </>}
    </View>}
    <TouchableOpacity accessibilityRole="button" disabled={submitting} onPress={() => navigation.goBack()} style={[styles.action, HC.touch]}><Text style={[HC.textAccent, { fontSize: scaledFontSize(15) }]}>{saved ? 'Back' : 'Back — feedback is optional'}</Text></TouchableOpacity>
  </ScrollView></SafeAreaView>;
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 20, paddingBottom: 60, gap: 18 },
  header: { gap: 12, alignItems: 'flex-start' },
  title: { fontWeight: '800', color: '#f1f5f9' },
  card: { padding: 20, borderRadius: 20, gap: 14, backgroundColor: '#1e293b' },
  context: { gap: 10, marginBottom: 12 },
  ratings: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rating: { minWidth: 44, minHeight: 64, padding: 8, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 5 },
  label: { fontWeight: '600', marginTop: 12 },
  input: { minHeight: 120, borderWidth: 1, borderRadius: 12, padding: 14, backgroundColor: '#0f172a', color: '#f1f5f9' },
  submit: { minHeight: 52, padding: 14, backgroundColor: '#4f46e5', borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 8 },
  action: { minHeight: 48, padding: 12, justifyContent: 'center' },
});
