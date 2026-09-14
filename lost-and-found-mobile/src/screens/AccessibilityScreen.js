import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Switch } from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import VoiceAssistant from '../components/VoiceAssistant';

const fontSizeOptions = [
  { key: 'small', label: 'Small', preview: 'Aa' },
  { key: 'medium', label: 'Medium', preview: 'Aa' },
  { key: 'large', label: 'Large', preview: 'Aa' },
  { key: 'xlarge', label: 'X-Large', preview: 'Aa' },
];

export default function AccessibilityScreen({ navigation }) {
  const {
    ttsEnabled, setTtsEnabled,
    highContrast, setHighContrast,
    fontSize, setFontSize,
    largeTouchTargets, setLargeTouchTargets,
    reduceMotion, setReduceMotion,
    speak,
    accessibilityStyles,
  } = useAccessibility();

  const features = [
    { section: 'Vision', items: [
      { icon: '🔊', label: 'Text-to-Speech', desc: 'Read screen names aloud when you navigate', value: ttsEnabled, toggle: setTtsEnabled },
      { icon: '🎨', label: 'High Contrast Mode', desc: 'Black background with white text for better readability', value: highContrast, toggle: setHighContrast },
      { icon: '🔤', label: 'Font Size', desc: `Current: ${fontSize}`, value: null, toggle: null, isFont: true },
    ]},
    { section: 'Motor', items: [
      { icon: '👆', label: 'Large Touch Targets', desc: 'Bigger buttons and tap areas for easier navigation', value: largeTouchTargets, toggle: setLargeTouchTargets },
      { icon: '🎬', label: 'Reduce Motion', desc: 'Minimize animations for users with motion sensitivity', value: reduceMotion, toggle: setReduceMotion },
    ]},
  ];

  useEffect(() => {
    if (ttsEnabled) {
      setTimeout(() => speak('Accessibility settings.'), 500);
    }
  }, [ttsEnabled]);

  return (
    <SafeAreaView style={[styles.container, accessibilityStyles.container]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <View style={styles.headerIcon}><Text style={{ fontSize: 28 }}>♿</Text></View>
          <Text style={[styles.title, accessibilityStyles.text]}>Accessibility</Text>
          <Text style={[styles.subtitle, accessibilityStyles.textMuted]}>Making Lost & Found accessible for everyone</Text>
          <VoiceAssistant text="Accessibility settings." />
        </View>

        {features.map(section => (
          <View key={section.section}>
            <Text style={[styles.sectionTitle, accessibilityStyles.textMuted]}>{section.section}</Text>
            <View style={[styles.card, accessibilityStyles.card]}>
              {section.items.map((item, idx) => (
                <React.Fragment key={item.label}>
                  {idx > 0 && <View style={[styles.divider, accessibilityStyles.border]} />}
                  {item.isFont ? (
                    <View style={styles.fontRow}>
                      <View style={styles.rowLeft}>
                        <View style={styles.iconWrap}><Text style={{ fontSize: 18 }}>{item.icon}</Text></View>
                        <View style={styles.rowText}>
                          <Text style={[styles.rowLabel, accessibilityStyles.text]}>{item.label}</Text>
                          <Text style={[styles.rowDesc, accessibilityStyles.textMuted]}>{item.desc}</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.row}>
                      <View style={styles.rowLeft}>
                        <View style={styles.iconWrap}><Text style={{ fontSize: 18 }}>{item.icon}</Text></View>
                        <View style={styles.rowText}>
                          <Text style={[styles.rowLabel, accessibilityStyles.text]}>{item.label}</Text>
                          <Text style={[styles.rowDesc, accessibilityStyles.textMuted]}>{item.desc}</Text>
                        </View>
                      </View>
                      <Switch
                        value={item.value}
                        onValueChange={item.toggle}
                        trackColor={{ false: '#334155', true: 'rgba(79, 70, 229, 0.5)' }}
                        thumbColor={item.value ? '#818cf8' : '#475569'}
                      />
                    </View>
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}

        <Text style={[styles.sectionTitle, styles.textMuted]}>Text Size</Text>
        <View style={[styles.card, accessibilityStyles.card]}>
          <View style={styles.fontSizeRow}>
            {fontSizeOptions.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.fontOption, fontSize === opt.key && styles.fontOptionActive]}
                onPress={() => setFontSize(opt.key)}
                accessibilityLabel={`Set font size to ${opt.label}`}
              >
                <Text style={[
                  styles.fontPreview,
                  { fontSize: opt.key === 'small' ? 14 : opt.key === 'medium' ? 18 : opt.key === 'large' ? 24 : 32 },
                  fontSize === opt.key && styles.fontPreviewActive
                ]}>Aa</Text>
                <Text style={[styles.fontLabel, fontSize === opt.key && styles.fontLabelActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.infoCard, accessibilityStyles.card]}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={[styles.infoText, accessibilityStyles.textMuted]}>
            Changes apply immediately. Toggle settings above to customize your experience.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 20, paddingBottom: 40 },
  headerSection: { alignItems: 'center', marginBottom: 24 },
  headerIcon: { width: 60, height: 60, borderRadius: 18, backgroundColor: 'rgba(79, 70, 229, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#f1f5f9', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#94a3b8', marginBottom: 10, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 16, padding: 4, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.06)' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  fontRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(79, 70, 229, 0.1)', justifyContent: 'center', alignItems: 'center' },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, color: '#f1f5f9', fontWeight: '600' },
  rowDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  divider: { height: 1, backgroundColor: 'rgba(148, 163, 184, 0.06)', marginHorizontal: 16 },
  fontSizeRow: { flexDirection: 'row', padding: 12, gap: 8 },
  fontOption: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: 'rgba(15, 23, 42, 0.6)', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.1)' },
  fontOptionActive: { borderColor: '#818cf8', backgroundColor: 'rgba(79, 70, 229, 0.1)' },
  fontPreview: { fontWeight: '700', color: '#94a3b8' },
  fontPreviewActive: { color: '#818cf8' },
  fontLabel: { fontSize: 11, color: '#64748b', marginTop: 4, fontWeight: '500' },
  fontLabelActive: { color: '#818cf8', fontWeight: '700' },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(79, 70, 229, 0.05)', borderRadius: 14, padding: 16, marginTop: 8, borderWidth: 1, borderColor: 'rgba(79, 70, 229, 0.1)', gap: 10 },
  infoIcon: { fontSize: 18, marginTop: 1 },
  infoText: { fontSize: 13, color: '#94a3b8', lineHeight: 19, flex: 1 },
});