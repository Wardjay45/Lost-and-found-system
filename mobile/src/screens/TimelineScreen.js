import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { useAccessibility, useThemedStyles } from '../context/AccessibilityContext';
import VoiceAssistant from '../components/VoiceAssistant';

const activityData = [];

export default function TimelineScreen() {
  const styles = useThemedStyles(baseStyles);
  const { speak, accessibilityStyles, scaledFontSize } = useAccessibility();
  const HC = accessibilityStyles;
  const activityText = `Activity Timeline. ${activityData.length} events.`;

  return (
    <SafeAreaView style={[styles.container, HC.container]}>
      <View style={styles.headerSection}>
        <Text style={[styles.title, HC.text, { fontSize: scaledFontSize(24) }]}>Activity Timeline</Text>
        <Text style={[styles.subtitle, HC.textMuted, { fontSize: scaledFontSize(14) }]}>Track every step of your reports</Text>
        <VoiceAssistant text={activityText} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {activityData.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>📋</Text>
            <Text style={[styles.emptyText, HC.textMuted, { fontSize: scaledFontSize(15) }]}>No activity yet</Text>
            <Text style={[styles.emptySubtext, HC.textMuted, { fontSize: scaledFontSize(13) }]}>Your reported items and their progress will appear here</Text>
          </View>
        ) : activityData.map((item, idx) => (
          <View key={item.id} style={styles.activityItem}>
            <View style={styles.activityLeft}>
              <View style={styles.dotWrap}>
                <View style={styles.dot}><Text style={{ fontSize: scaledFontSize(16) }}>{item.icon}</Text></View>
                {idx < activityData.length - 1 && <View style={styles.line} />}
              </View>
            </View>
            <View style={styles.activityContent}>
              <Text style={[styles.action, HC.text, { fontSize: scaledFontSize(15) }]}>{item.action}</Text>
              <Text style={[styles.description, HC.textMuted, { fontSize: scaledFontSize(13) }]}>{item.description}</Text>
              <Text style={[styles.date, HC.textMuted, { fontSize: scaledFontSize(11) }]}>{item.date} · {item.time}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  headerSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: '#f1f5f9', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  scroll: { padding: 20, paddingBottom: 40 },
  activityItem: { flexDirection: 'row', marginBottom: 8 },
  activityLeft: { width: 48, alignItems: 'center' },
  dotWrap: { alignItems: 'center' },
  dot: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(79, 70, 229, 0.15)', justifyContent: 'center', alignItems: 'center' },
  line: { width: 2, flex: 1, backgroundColor: 'rgba(148, 163, 184, 0.1)', marginVertical: 4 },
  activityContent: { flex: 1, paddingLeft: 12, paddingBottom: 20 },
  action: { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },
  description: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  date: { fontSize: 11, color: '#475569', marginTop: 6 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 15, color: '#94a3b8', fontWeight: '600' },
  emptySubtext: { fontSize: 13, color: '#475569', marginTop: 4, textAlign: 'center', paddingHorizontal: 20 },
});