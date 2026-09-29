import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Switch, TextInput, Alert, Modal } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { getConfiguredServerUrl, saveServerUrl, resetServerUrl } from '../config/api';
import VoiceAssistant from '../components/VoiceAssistant';

export default function SettingsScreen({ navigation }) {
  const { speak, accessibilityStyles, scaledFontSize } = useAccessibility();
  const { user, logout } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState('Medium');
  const HC = accessibilityStyles;

  // Server URL config
  const [serverUrl, setServerUrl] = useState('');
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [currentServerUrl, setCurrentServerUrl] = useState('');

  useEffect(() => {
    loadServerUrl();
  }, []);

  const loadServerUrl = async () => {
    const url = await getConfiguredServerUrl();
    if (url) {
      setCurrentServerUrl(url);
      setServerUrl(url);
    }
  };

  const handleSaveServerUrl = async () => {
    const trimmed = serverUrl.trim().replace(/\/+$/, '');
    if (!trimmed) {
      Alert.alert('Error', 'Please enter a valid server URL');
      return;
    }
    if (!trimmed.startsWith('http')) {
      Alert.alert('Error', 'URL must start with http:// or https://');
      return;
    }
    await saveServerUrl(trimmed);
    setCurrentServerUrl(trimmed);
    setShowServerConfig(false);
    speak('Server URL updated');
    Alert.alert('Saved', 'Server URL updated. Restart the app if changes don\'t apply immediately.');
  };

  const handleResetServerUrl = async () => {
    await resetServerUrl();
    setCurrentServerUrl('');
    setServerUrl('');
    setShowServerConfig(false);
    speak('Server URL reset to auto-detect');
    Alert.alert('Reset', 'Using auto-detected server URL.');
  };

  return (
    <SafeAreaView style={[styles.container, HC.container]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.headerSection}>
        <Text style={[styles.title, HC.text, { fontSize: scaledFontSize(24) }]}>Settings</Text>
        <Text style={[styles.subtitle, HC.textMuted, { fontSize: scaledFontSize(14) }]}>Customize your experience</Text>
        <VoiceAssistant text="Settings. Customize notifications, appearance, and accessibility features." />
      </View>

        {/* Server Configuration */}
        <Text style={[styles.sectionTitle, HC.textMuted, { fontSize: scaledFontSize(13) }]}>Server</Text>
        <TouchableOpacity style={[styles.menuItem, HC.card, HC.touch]} onPress={() => setShowServerConfig(true)}>
          <Text style={{ fontSize: scaledFontSize(18), marginRight: 12 }}>🌐</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuLabel, HC.text, { fontSize: scaledFontSize(15) }]}>Server URL</Text>
            <Text style={[HC.textMuted, { fontSize: scaledFontSize(11) }]} numberOfLines={1}>
              {currentServerUrl || 'Auto-detect (emulator)'}
            </Text>
          </View>
          <Text style={[styles.menuArrow, HC.textMuted, { fontSize: scaledFontSize(22) }]}>›</Text>
        </TouchableOpacity>

        {/* Server URL Modal */}
        <Modal visible={showServerConfig} transparent animationType="fade" onRequestClose={() => setShowServerConfig(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, HC.card]}>
              <Text style={[styles.modalTitle, HC.text, { fontSize: scaledFontSize(20) }]}>🌐 Server URL</Text>
              <Text style={[HC.textMuted, { fontSize: scaledFontSize(13), marginBottom: 6 }]}>
                For real devices, paste your localtunnel URL here.
              </Text>
              <Text style={[HC.textMuted, { fontSize: scaledFontSize(12), marginBottom: 16, color: '#818cf8' }]}>
                Example: https://something.loca.lt/api
              </Text>
              <TextInput
                style={[styles.input, HC.text]}
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="https://your-tunnel.loca.lt/api"
                placeholderTextColor="#475569"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setShowServerConfig(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSave} onPress={handleSaveServerUrl}>
                  <Text style={styles.modalSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
              {currentServerUrl ? (
                <TouchableOpacity style={styles.resetBtn} onPress={handleResetServerUrl}>
                  <Text style={styles.resetText}>↩ Reset to auto-detect</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </Modal>

        <Text style={[styles.sectionTitle, HC.textMuted, { fontSize: scaledFontSize(13) }]}>Notifications</Text>
        <View style={[styles.card, HC.card]}>
          <View style={styles.row}><Text style={[styles.rowLabel, HC.text, { fontSize: scaledFontSize(15) }]}>🔔 Push Notifications</Text><Switch value={pushEnabled} onValueChange={(v) => { setPushEnabled(v); speak(v ? 'Push notifications enabled' : 'Push notifications disabled'); }} trackColor={{ false: '#334155', true: 'rgba(79, 70, 229, 0.5)' }} thumbColor={pushEnabled ? '#4f46e5' : '#475569'} /></View>
          <View style={[styles.divider, HC.border]} />
          <View style={styles.row}><Text style={[styles.rowLabel, HC.text, { fontSize: scaledFontSize(15) }]}>📧 Email Notifications</Text><Switch value={emailEnabled} onValueChange={setEmailEnabled} trackColor={{ false: '#334155', true: 'rgba(79, 70, 229, 0.5)' }} thumbColor={emailEnabled ? '#4f46e5' : '#475569'} /></View>
          <View style={[styles.divider, HC.border]} />
          <View style={styles.row}><Text style={[styles.rowLabel, HC.text, { fontSize: scaledFontSize(15) }]}>📱 SMS Notifications</Text><Switch value={smsEnabled} onValueChange={setSmsEnabled} trackColor={{ false: '#334155', true: 'rgba(79, 70, 229, 0.5)' }} thumbColor={smsEnabled ? '#4f46e5' : '#475569'} /></View>
        </View>

        <Text style={[styles.sectionTitle, HC.textMuted, { fontSize: scaledFontSize(13) }]}>Appearance</Text>
        <View style={[styles.card, HC.card]}>
          <View style={styles.row}><Text style={[styles.rowLabel, HC.text, { fontSize: scaledFontSize(15) }]}>🌙 Dark Mode</Text><Switch value={darkMode} onValueChange={(v) => { setDarkMode(v); speak(v ? 'Dark mode enabled' : 'Dark mode disabled'); }} trackColor={{ false: '#334155', true: 'rgba(79, 70, 229, 0.5)' }} thumbColor={darkMode ? '#4f46e5' : '#475569'} /></View>
          <View style={[styles.divider, HC.border]} />
          <View style={styles.row}><Text style={[styles.rowLabel, HC.text, { fontSize: scaledFontSize(15) }]}>👁 High Contrast</Text><Switch value={highContrast} onValueChange={setHighContrast} trackColor={{ false: '#334155', true: 'rgba(79, 70, 229, 0.5)' }} thumbColor={highContrast ? '#4f46e5' : '#475569'} /></View>
          <View style={[styles.divider, HC.border]} />
          <View style={styles.row}><Text style={[styles.rowLabel, HC.text, { fontSize: scaledFontSize(15) }]}>🔤 Font Size</Text><Text style={[styles.rowValue, HC.textMuted, { fontSize: scaledFontSize(14) }]}>{fontSize} ›</Text></View>
        </View>

        <Text style={[styles.sectionTitle, HC.textMuted, { fontSize: scaledFontSize(13) }]}>Accessibility</Text>
        <TouchableOpacity style={[styles.menuItem, HC.card, HC.touch]} onPress={() => navigation.navigate('Accessibility')}>
          <Text style={{ fontSize: scaledFontSize(18), marginRight: 12 }}>♿</Text>
          <Text style={[styles.menuLabel, HC.text, { fontSize: scaledFontSize(15) }]}>Accessibility Features</Text>
          <Text style={[styles.menuArrow, HC.textMuted, { fontSize: scaledFontSize(22) }]}>›</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, HC.textMuted, { fontSize: scaledFontSize(13) }]}>Account</Text>
        <TouchableOpacity style={[styles.menuItem, HC.card, HC.touch]}>
          <Text style={{ fontSize: scaledFontSize(18), marginRight: 12 }}>🔒</Text>
          <Text style={[styles.menuLabel, HC.text, { fontSize: scaledFontSize(15) }]}>Privacy Settings</Text>
          <Text style={[styles.menuArrow, HC.textMuted, { fontSize: scaledFontSize(22) }]}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuItem, HC.card, HC.touch]}>
          <Text style={{ fontSize: scaledFontSize(18), marginRight: 12 }}>🌐</Text>
          <Text style={[styles.menuLabel, HC.text, { fontSize: scaledFontSize(15) }]}>Language</Text>
          <Text style={[styles.rowValue, HC.textMuted, { fontSize: scaledFontSize(14) }]}>English ›</Text>
        </TouchableOpacity>

        <View style={[styles.infoCard, HC.card]}>
          <Text style={{ fontSize: scaledFontSize(14) }}>☁️</Text>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.menuLabel, HC.text, { fontSize: scaledFontSize(14) }]}>Cloud Connected</Text>
            <Text style={[HC.textMuted, { fontSize: scaledFontSize(11) }]}>Direct connection • Works on any network</Text>
          </View>
          <View style={styles.connectedDot} />
        </View>

        <TouchableOpacity style={[styles.logoutBtn, HC.touch]} onPress={() => { speak('Signing out.'); logout(); }} activeOpacity={0.7}>
          <Text style={[styles.logoutText, { fontSize: scaledFontSize(16) }]}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 20, paddingBottom: 100 },
  headerSection: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#f1f5f9', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#94a3b8', marginBottom: 10, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 16, padding: 4, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.06)' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  rowLabel: { fontSize: 15, color: '#e2e8f0' },
  rowValue: { fontSize: 14, color: '#64748b' },
  divider: { height: 1, backgroundColor: 'rgba(148, 163, 184, 0.06)', marginHorizontal: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 16, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.06)' },
  menuLabel: { fontSize: 15, color: '#e2e8f0', fontWeight: '500', flex: 1 },
  menuArrow: { fontSize: 22, color: '#475569' },
  infoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.06)', borderRadius: 16, padding: 16, marginTop: 8, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.15)' },
  connectedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
  logoutBtn: { marginTop: 16, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.15)' },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '700' },
  // Server URL modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#1e293b', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: 'rgba(148,163,184,0.1)' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#f1f5f9', marginBottom: 12 },
  input: { backgroundColor: 'rgba(15,23,42,0.6)', borderWidth: 1.5, borderColor: '#4f46e5', borderRadius: 12, padding: 14, fontSize: 15, color: '#f1f5f9', marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, backgroundColor: 'rgba(30,41,59,0.8)', borderRadius: 14, padding: 14, alignItems: 'center' },
  modalCancelText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
  modalSave: { flex: 2, backgroundColor: '#4f46e5', borderRadius: 14, padding: 14, alignItems: 'center' },
  modalSaveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  resetBtn: { marginTop: 14, alignItems: 'center', paddingVertical: 8 },
  resetText: { color: '#818cf8', fontSize: 13, fontWeight: '600' },
});