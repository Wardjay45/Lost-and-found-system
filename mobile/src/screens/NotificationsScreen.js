import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import VoiceAssistant from '../components/VoiceAssistant';

const typeIcons = { match: '🤝', pickup: '📦', status: '📋', message: '💬', reminder: '⏰' };

export default function NotificationsScreen() {
  const { speak, accessibilityStyles, scaledFontSize } = useAccessibility();
  const HC = accessibilityStyles;
  const unreadCount = [].filter(n => !n.read).length;

  return (
    <SafeAreaView style={[styles.container, HC.container]}>
      <View style={styles.headerSection}>
        <Text style={[styles.title, HC.text, { fontSize: scaledFontSize(24) }]}>Notifications</Text>
        <Text style={[styles.subtitle, HC.textMuted, { fontSize: scaledFontSize(14) }]}>Stay updated on your items</Text>
        <VoiceAssistant text={`Notifications. You have ${unreadCount} unread [] out of ${[].length} total.`} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.filterRow}>
          <TouchableOpacity style={[styles.filterChip, styles.filterChipActive, HC.touch]}><Text style={[styles.filterText, styles.filterTextActive, { fontSize: scaledFontSize(13) }]}>All</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.filterChip, HC.touch]}><Text style={[styles.filterText, { fontSize: scaledFontSize(13) }]}>Unread</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.filterChip, HC.touch]}><Text style={[styles.filterText, { fontSize: scaledFontSize(13) }]}>Matches</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.filterChip, HC.touch]}><Text style={[styles.filterText, { fontSize: scaledFontSize(13) }]}>Pickups</Text></TouchableOpacity>
        </View>
        {[].map(n => (
          <TouchableOpacity key={n.id} style={[styles.card, !n.read && styles.unread, HC.card, HC.touch]} activeOpacity={0.7}
            onLongPress={() => speak(`${n.title}. ${n.message}. ${n.time}`)}
          >
            <View style={styles.cardRow}>
              <View style={styles.iconWrap}><Text style={{ fontSize: scaledFontSize(22) }}>{typeIcons[n.type] || '🔔'}</Text></View>
              <View style={styles.cardInfo}>
                <View style={styles.cardTop}><Text style={[styles.cardTitle, HC.text, { fontSize: scaledFontSize(15) }]}>{n.title}</Text>{!n.read && <View style={styles.unreadDot} />}</View>
                <Text style={[styles.cardMsg, HC.textMuted, { fontSize: scaledFontSize(13) }]}>{n.message}</Text>
                <Text style={[styles.cardTime, HC.textMuted, { fontSize: scaledFontSize(11) }]}>{n.time}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' }, headerSection: { paddingHorizontal: 20, paddingTop: 16 }, title: { fontSize: 24, fontWeight: '800', color: '#f1f5f9', letterSpacing: -0.3 }, subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 }, filterRow: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 16, marginBottom: 8, gap: 8 }, filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(30, 41, 59, 0.6)' }, filterChipActive: { backgroundColor: '#4f46e5' }, filterText: { fontSize: 13, color: '#94a3b8', fontWeight: '500' }, filterTextActive: { color: '#fff' }, scroll: { padding: 20, paddingBottom: 100 }, card: { backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.06)' }, unread: { borderColor: 'rgba(79, 70, 229, 0.3)', backgroundColor: 'rgba(79, 70, 229, 0.05)' }, cardRow: { flexDirection: 'row', gap: 12 }, iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(79, 70, 229, 0.1)', justifyContent: 'center', alignItems: 'center' }, cardInfo: { flex: 1 }, cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 }, cardTitle: { fontSize: 15, fontWeight: '600', color: '#f1f5f9' }, unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4f46e5' }, cardMsg: { fontSize: 13, color: '#94a3b8', marginTop: 4 }, cardTime: { fontSize: 11, color: '#475569', marginTop: 6 },
});