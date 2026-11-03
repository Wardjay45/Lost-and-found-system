import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { TouchableOpacity } from './SpeechControls';
import { useAccessibility, useThemedStyles } from '../context/AccessibilityContext';
import VoiceAssistant from './VoiceAssistant';
import FormIcon from './FormIcon';

export default function OfficeRecoveryGuide({ navigation, route, pickup = false }) {
  const styles = useThemedStyles(baseStyles);
  const { accessibilityStyles: HC, scaledFontSize, themeColors } = useAccessibility();
  const item = route?.params?.item;
  const title = pickup ? 'Collect your item' : 'Verify item ownership';
  const instructions = 'Contact the Lost and Found Office or visit with your school ID and proof of ownership. An administrator will review your claim and confirm the handover.';
  return <SafeAreaView style={[styles.container, HC.container]}>
    <ScrollView contentContainerStyle={styles.scroll}>
      <FormIcon name="shield" size={32} color={themeColors.accent} />
      <Text style={[styles.title, HC.text, { fontSize: scaledFontSize(24) }]}>{title}</Text>
      <VoiceAssistant text={`${title}. ${instructions}`} />
      {item && <View style={[styles.card, HC.card]}>
        <Text style={[HC.text, { fontSize: scaledFontSize(17), fontWeight: '700' }]}>{item.description || 'Found item'}</Text>
        {!!item.itemId && <Text selectable style={[HC.textMuted, { fontSize: scaledFontSize(14) }]}>Reference: {item.itemId}</Text>}
        {!!item.location && <Text style={[HC.textMuted, { fontSize: scaledFontSize(14) }]}>Reported location: {item.location}</Text>}
      </View>}
      <Text style={[HC.text, { fontSize: scaledFontSize(16), marginVertical: 24 }]}>{instructions}</Text>
      <TouchableOpacity style={[styles.action, HC.touch]} onPress={() => navigation.navigate('Main', { screen: 'Messages' })}>
        <Text style={{ color: '#fff', fontSize: scaledFontSize(16), fontWeight: '700' }}>Message the office</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.secondary, HC.touch]} onPress={() => navigation.navigate('Main', { screen: 'Claims' })}>
        <Text style={[HC.textAccent, { fontSize: scaledFontSize(16) }]}>View my reports</Text>
      </TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}
const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' }, scroll: { padding: 24, paddingBottom: 48, gap: 12 },
  title: { fontWeight: '800', marginVertical: 12, color: '#f1f5f9' }, card: { padding: 18, borderRadius: 16, gap: 10 },
  action: { padding: 16, borderRadius: 14, backgroundColor: '#4f46e5', alignItems: 'center' },
  secondary: { padding: 16, alignItems: 'center' },
});
