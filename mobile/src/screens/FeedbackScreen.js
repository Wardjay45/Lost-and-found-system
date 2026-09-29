import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, TextInput, Alert } from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import VoiceAssistant from '../components/VoiceAssistant';

export default function FeedbackScreen() {
  const { speak, accessibilityStyles, scaledFontSize } = useAccessibility();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const HC = accessibilityStyles;

  const handleSubmit = () => {
    if (rating === 0) { Alert.alert('Required', 'Please select a rating'); return; }
    Alert.alert('Thank You!', 'Your feedback helps us improve the Lost & Found system.');
    setRating(0); setComment('');
  };

  return (
    <SafeAreaView style={[styles.container, HC.container]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <View style={styles.headerIcon}><Text style={{ fontSize: scaledFontSize(28) }}>⭐</Text></View>
          <Text style={[styles.title, HC.text, { fontSize: scaledFontSize(24) }]}>Rate Your Experience</Text>
          <Text style={[styles.subtitle, HC.textMuted, { fontSize: scaledFontSize(14) }]}>Help us improve our service</Text>
          <VoiceAssistant text="Feedback. Rate your experience and leave additional comments." />
        </View>
        <View style={[styles.card, HC.card]}>
          <Text style={[styles.cardTitle, HC.text, { fontSize: scaledFontSize(17) }]}>How was your experience?</Text>
          <View style={styles.emojisRow}>
            {[].map(opt => (
              <TouchableOpacity key={opt.value} style={[styles.emojiBtn, rating === opt.value && styles.emojiActive, HC.touch]} onPress={() => setRating(opt.value)}>
                <Text style={[styles.emoji, { fontSize: scaledFontSize(28) }, rating === opt.value && styles.emojiActiveText]}>{opt.emoji}</Text>
                <Text style={[styles.emojiLabel, { fontSize: scaledFontSize(10) }, rating === opt.value && styles.emojiLabelActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.label, HC.text, { fontSize: scaledFontSize(13) }]}>Additional Comments</Text>
          <TextInput style={[styles.input, { fontSize: scaledFontSize(15) }]} placeholder="Share your thoughts..." placeholderTextColor="#64748b" value={comment} onChangeText={setComment} multiline numberOfLines={4} textAlignVertical="top" />
          <TouchableOpacity style={[styles.submitBtn, HC.touch]} onPress={handleSubmit} activeOpacity={0.8}><Text style={[styles.submitText, { fontSize: scaledFontSize(16) }]}>Submit Feedback</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' }, scroll: { padding: 20, paddingBottom: 40 }, headerSection: { alignItems: 'center', marginBottom: 24 }, headerIcon: { width: 60, height: 60, borderRadius: 18, backgroundColor: 'rgba(245, 158, 11, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }, title: { fontSize: 24, fontWeight: '800', color: '#f1f5f9', letterSpacing: -0.3 }, subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 }, card: { backgroundColor: 'rgba(30, 41, 59, 0.8)', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.08)' }, cardTitle: { fontSize: 17, fontWeight: '700', color: '#f1f5f9', marginBottom: 20, textAlign: 'center' }, emojisRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }, emojiBtn: { alignItems: 'center', padding: 8, borderRadius: 12, width: 60 }, emojiActive: { backgroundColor: 'rgba(79, 70, 229, 0.15)' }, emoji: { fontSize: 28, marginBottom: 4 }, emojiActiveText: { transform: [{ scale: 1.2 }] }, emojiLabel: { fontSize: 10, color: '#64748b', fontWeight: '500' }, emojiLabelActive: { color: '#818cf8' }, label: { fontSize: 13, fontWeight: '700', color: '#cbd5e1', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.3 }, input: { backgroundColor: 'rgba(15, 23, 42, 0.6)', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.12)', borderRadius: 14, padding: 16, fontSize: 15, color: '#f1f5f9', minHeight: 100 }, submitBtn: { backgroundColor: '#4f46e5', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 20, shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 }, submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});