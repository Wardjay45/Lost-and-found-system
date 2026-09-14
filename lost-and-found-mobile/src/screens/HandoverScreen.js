import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Alert } from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import VoiceAssistant from '../components/VoiceAssistant';

const timeSlots = ['9:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:00 AM - 12:00 PM', '1:00 PM - 2:00 PM', '2:00 PM - 3:00 PM', '3:00 PM - 4:00 PM'];

export default function HandoverScreen({ navigation }) {
  const { speak, accessibilityStyles, scaledFontSize } = useAccessibility();
  const [selectedDate, setSelectedDate] = useState('Tomorrow');
  const [selectedTime, setSelectedTime] = useState('');
  const [step, setStep] = useState('schedule');
  const HC = accessibilityStyles;

  const handleSchedule = () => {
    if (!selectedTime) { speak('Please select a time slot.'); Alert.alert('Required', 'Please select a time slot'); return; }
    speak(`Pickup scheduled for ${selectedDate} at ${selectedTime}.`);
    setStep('qr');
  };
  const handleConfirmPickup = () => {
    speak('Item claimed successfully!');
    Alert.alert('✅ Item Claimed', 'Your item has been successfully claimed.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
  };

  if (step === 'qr') return (
    <SafeAreaView style={[styles.container, HC.container]}>
      <View style={styles.center}>
        <View style={styles.qrBox}><Text style={{ fontSize: scaledFontSize(80) }}>📱</Text><View style={styles.qrPlaceholder}>{['▀▄▀▄▀▄▀▄','▄▀▄▀▄▀▄▀','▀▄▀▄▀▄▀▄','▄▀▄▀▄▀▄▀','▀▄▀▄▀▄▀▄'].map((r,i)=><Text key={i} style={styles.qrPattern}>{r}</Text>)}</View></View>
        <Text style={[styles.qrTitle, HC.text, { fontSize: scaledFontSize(22) }]}>Handover QR Code</Text>
        <Text style={[styles.qrSub, HC.textMuted, { fontSize: scaledFontSize(14) }]}>Show this code at the Lost & Found desk to claim your item</Text>
        <Text style={[styles.qrTimer, { fontSize: scaledFontSize(14) }]}>⏱ Expires in 30 minutes</Text>
        <Text style={[styles.qrInfo, HC.textMuted, { fontSize: scaledFontSize(13) }]}>📍 Admin Building - Lost & Found Desk</Text>
        <TouchableOpacity style={[styles.claimBtn, HC.touch]} onPress={handleConfirmPickup} activeOpacity={0.8}><Text style={{ color: '#fff', fontSize: scaledFontSize(16), fontWeight: '700' }}>✓ I've Received My Item</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.backBtn, HC.touch]} onPress={() => setStep('schedule')}><Text style={[styles.backBtnText, HC.textAccent, { fontSize: scaledFontSize(15) }]}>← Reschedule</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={[styles.container, HC.container]}>
      <View style={styles.headerSection}>
        <Text style={[styles.title, HC.text, { fontSize: scaledFontSize(24) }]}>Schedule Pickup</Text>
        <Text style={[styles.subtitle, HC.textMuted, { fontSize: scaledFontSize(14) }]}>Choose when to claim your item</Text>
        <VoiceAssistant text="Schedule your item pickup. Select a date and time slot." />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, HC.card]}>
          <Text style={[styles.cardTitle, HC.text, { fontSize: scaledFontSize(15) }]}>Item Ready For Pickup</Text>
          <View style={styles.itemInfo}><View style={[styles.itemIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}><Text style={{ fontSize: scaledFontSize(24) }}>🔍</Text></View><View><Text style={[styles.itemName, HC.text, { fontSize: scaledFontSize(15) }]}>Black Leather Wallet</Text><Text style={[styles.itemLocation, HC.textMuted, { fontSize: scaledFontSize(12) }]}>📍 Library - Main Entrance</Text></View></View>
        </View>
        <Text style={[styles.sectionTitle, HC.text, { fontSize: scaledFontSize(15) }]}>Select Date</Text>
        <View style={styles.dateRow}>{['Today','Tomorrow','Jan 22','Jan 23'].map(d => (<TouchableOpacity key={d} style={[styles.dateChip, selectedDate === d && styles.dateChipActive, HC.touch]} onPress={() => { setSelectedDate(d); speak(`Selected date: ${d}`); }}><Text style={[styles.dateText, { fontSize: scaledFontSize(13) }, selectedDate === d && styles.dateTextActive]}>{d}</Text></TouchableOpacity>))}</View>
        <Text style={[styles.sectionTitle, HC.text, { fontSize: scaledFontSize(15) }]}>Select Time</Text>
        {timeSlots.map(t => (<TouchableOpacity key={t} style={[styles.timeSlot, selectedTime === t && styles.timeSlotActive, HC.touch]} onPress={() => { setSelectedTime(t); speak(`Selected time: ${t}`); }}><Text style={[styles.timeText, HC.text, { fontSize: scaledFontSize(15) }, selectedTime === t && { color: '#34d399' }]}>{t}</Text>{selectedTime === t && <Text style={{ fontSize: scaledFontSize(18), color: '#34d399', fontWeight: '700' }}>✓</Text>}</TouchableOpacity>))}
        <TouchableOpacity style={[styles.scheduleBtn, HC.touch]} onPress={handleSchedule} activeOpacity={0.8}><Text style={{ color: '#fff', fontSize: scaledFontSize(16), fontWeight: '700' }}>Generate Handover Code</Text></TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' }, headerSection: { paddingHorizontal: 20, paddingTop: 16 }, title: { fontSize: 24, fontWeight: '800', color: '#f1f5f9', letterSpacing: -0.3 }, subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 }, scroll: { padding: 20, paddingBottom: 40 }, card: { backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.06)' }, cardTitle: { fontSize: 15, fontWeight: '700', color: '#f1f5f9', marginBottom: 12 }, itemInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 }, itemIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }, itemName: { fontSize: 15, fontWeight: '600', color: '#e2e8f0' }, itemLocation: { fontSize: 12, color: '#64748b', marginTop: 2 }, sectionTitle: { fontSize: 15, fontWeight: '700', color: '#cbd5e1', marginBottom: 12, marginTop: 8 }, dateRow: { flexDirection: 'row', gap: 8, marginBottom: 20 }, dateChip: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(30, 41, 59, 0.6)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.1)' }, dateChipActive: { borderColor: '#4f46e5', backgroundColor: 'rgba(79, 70, 229, 0.1)' }, dateText: { fontSize: 13, color: '#94a3b8', fontWeight: '500' }, dateTextActive: { color: '#818cf8', fontWeight: '700' }, timeSlot: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.1)' }, timeSlotActive: { borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)' }, timeText: { flex: 1, fontSize: 15, color: '#e2e8f0' }, scheduleBtn: { backgroundColor: '#4f46e5', borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 16, shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }, qrBox: { alignItems: 'center', marginBottom: 24 }, qrPlaceholder: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginTop: 16 }, qrPattern: { fontSize: 16, fontFamily: 'monospace', letterSpacing: 4, color: '#0f172a' }, qrTitle: { fontSize: 22, fontWeight: '700', color: '#f1f5f9' }, qrSub: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 8, lineHeight: 20 }, qrTimer: { fontSize: 14, color: '#f59e0b', fontWeight: '600', marginTop: 16 }, qrInfo: { fontSize: 13, color: '#64748b', marginTop: 4 }, claimBtn: { backgroundColor: '#10b981', borderRadius: 16, padding: 18, alignItems: 'center', width: '100%', marginTop: 24, shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 }, backBtn: { marginTop: 16, padding: 12 }, backBtnText: { color: '#818cf8', fontSize: 15, fontWeight: '500' },
});