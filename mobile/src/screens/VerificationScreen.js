import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Alert } from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import VoiceAssistant from '../components/VoiceAssistant';

export default function VerificationScreen({ navigation }) {
  const { speak, accessibilityStyles, scaledFontSize } = useAccessibility();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [completed, setCompleted] = useState(false);
  const HC = accessibilityStyles;

  const handleAnswer = (optionIndex) => {
    setAnswers(prev => ({ ...prev, [currentQ]: optionIndex }));
    speak(`Answer selected: ${[][currentQ].options[optionIndex]}`);
    if (currentQ < [].length - 1) setCurrentQ(currentQ + 1);
    else setCompleted(true);
  };
  const handleSubmit = () => {
    const correct = [].filter(q => answers[q.id - 1] === q.answer).length;
    const passed = correct >= 2;
    speak(passed ? 'Verification passed.' : `Verification failed. ${correct} out of ${[].length} correct.`);
    Alert.alert(passed ? '✅ Verification Passed' : '❌ Verification Failed', `You answered ${correct}/${[].length} correctly.${passed ? '\n\nProceed to claim your item.' : '\n\nPlease try again.'}`, [{ text: 'OK', onPress: () => passed ? navigation.goBack() : setCurrentQ(0) }]);
  };

  if (completed) return (
    <SafeAreaView style={[styles.container, HC.container]}>
      <View style={styles.center}><Text style={{ fontSize: scaledFontSize(64) }}>✅</Text><Text style={[styles.completeTitle, HC.text, { fontSize: scaledFontSize(22) }]}>All Questions Answered</Text><Text style={[styles.completeSub, HC.textMuted, { fontSize: scaledFontSize(14) }]}>Review your answers before submitting</Text><TouchableOpacity style={[styles.submitBtn, HC.touch]} onPress={handleSubmit} activeOpacity={0.8}><Text style={{ color: '#fff', fontSize: scaledFontSize(16), fontWeight: '700' }}>Submit Verification</Text></TouchableOpacity></View>
    </SafeAreaView>
  );

  const q = [][currentQ];
  return (
    <SafeAreaView style={[styles.container, HC.container]}>
      <View style={styles.headerSection}>
        <Text style={[styles.title, HC.text, { fontSize: scaledFontSize(24) }]}>Ownership Verification</Text>
        <Text style={[styles.subtitle, HC.textMuted, { fontSize: scaledFontSize(14) }]}>Answer questions to verify ownership</Text>
        <VoiceAssistant text={`Verification question ${currentQ + 1} of ${[].length}. ${q.question}`} />
      </View>
      <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${((currentQ + 1) / [].length) * 100}%` }]} /></View>
      <View style={styles.content}>
        <Text style={[styles.questionNum, HC.textMuted, { fontSize: scaledFontSize(13) }]}>Question {currentQ + 1} of {[].length}</Text>
        <Text style={[styles.question, HC.text, { fontSize: scaledFontSize(20) }]}>{q.question}</Text>
        <TouchableOpacity onPress={() => speak(q.question)} style={[styles.readBtn, HC.touch]}><Text style={[styles.readBtnText, HC.textAccent, { fontSize: scaledFontSize(13) }]}>🔊 Read aloud</Text></TouchableOpacity>
        <View style={styles.options}>
          {q.options.map((opt, idx) => (
            <TouchableOpacity key={idx} style={[styles.option, HC.card, answers[currentQ] === idx && styles.optionSelected, HC.touch]} onPress={() => handleAnswer(idx)} activeOpacity={0.7}>
              <Text style={[styles.optionText, HC.text, { fontSize: scaledFontSize(16) }, answers[currentQ] === idx && { color: '#818cf8' }]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' }, headerSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }, title: { fontSize: 24, fontWeight: '800', color: '#f1f5f9', letterSpacing: -0.3 }, subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 }, progressBar: { height: 4, backgroundColor: 'rgba(30, 41, 59, 0.6)', marginHorizontal: 20, borderRadius: 2, marginTop: 16 }, progressFill: { height: '100%', backgroundColor: '#4f46e5', borderRadius: 2 }, content: { flex: 1, padding: 20 }, questionNum: { fontSize: 13, color: '#64748b', fontWeight: '600', marginBottom: 8 }, question: { fontSize: 20, fontWeight: '700', color: '#f1f5f9', marginBottom: 28, lineHeight: 28 }, options: { gap: 12 }, readBtn: { alignSelf: 'flex-start', marginBottom: 12, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(79,70,229,0.1)', borderRadius: 10 }, readBtnText: { fontSize: 13, color: '#818cf8', fontWeight: '600' }, option: { backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.1)' }, optionSelected: { borderColor: '#4f46e5', backgroundColor: 'rgba(79, 70, 229, 0.1)' }, optionText: { fontSize: 16, color: '#e2e8f0', fontWeight: '500' }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }, completeTitle: { fontSize: 22, fontWeight: '700', color: '#f1f5f9' }, completeSub: { fontSize: 14, color: '#64748b', marginTop: 4, marginBottom: 32 }, submitBtn: { backgroundColor: '#4f46e5', borderRadius: 16, padding: 18, paddingHorizontal: 40, alignItems: 'center', shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
});