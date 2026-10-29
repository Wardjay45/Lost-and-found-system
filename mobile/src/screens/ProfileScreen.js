import { TouchableOpacity } from '../components/SpeechControls';
import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, Modal, Image, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAccessibility, useThemedStyles } from '../context/AccessibilityContext';
import FormIcon from '../components/FormIcon';

export default function ProfileScreen({ navigation }) {
  const styles = useThemedStyles(baseStyles);
  const { user, logout } = useAuth();
  const { speak, accessibilityStyles, scaledFontSize, themeColors } = useAccessibility();
  const HC = accessibilityStyles;
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = () => {
    setLoggingOut(true);
    speak('Logging out');
    setTimeout(() => { logout(); setLoggingOut(false); }, 1200);
  };

  const menuItems = [
    { icon: 'mail', label: 'Email', value: user?.email },
    { icon: 'credit-card', label: 'Student ID', value: user?.student_id || 'Not provided' },
    { icon: 'briefcase', label: 'Department', value: user?.department || 'Not provided' },
    { icon: 'user', label: 'Gender', value: user?.gender || 'Not provided' },
    { icon: 'phone', label: 'Phone Number', value: user?.phone || 'Not provided' },
  ];

  return (
    <SafeAreaView style={[styles.container, HC.container]}>
      <Modal visible={loggingOut} transparent animationType={HC.reduceMotion ? "none" : "fade"}>
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <Image source={require('../../assets/logo.png')} style={styles.splashLogo} />
            <Text style={styles.loadingTitle}>Lost & Found</Text>
            <ActivityIndicator size="large" color="#818cf8" style={{ marginTop: 24 }} />
            <Text style={styles.loadingText}>Logging out...</Text>
          </View>
        </View>
      </Modal>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}><Text style={[styles.avatarText, { fontSize: scaledFontSize(36) }]}>{user?.name?.charAt(0) || 'U'}</Text></View>
            </View>
            <View style={styles.badge}><Text style={[styles.badgeText, { fontSize: scaledFontSize(11) }]}>Student</Text></View>
          </View>
          <Text style={[styles.name, HC.text, { fontSize: scaledFontSize(24) }]}>{user?.name}</Text>
          <Text style={[styles.email, HC.textMuted, { fontSize: scaledFontSize(14) }]}>{user?.email}</Text>
        </View>

        <Text style={[styles.sectionTitle, HC.textMuted, { fontSize: scaledFontSize(15) }]}>Account Details</Text>
        {menuItems.map((item, idx) => (
          <View key={idx} style={[styles.infoCard, HC.card]}>
            <View style={styles.infoRow}>
              <View style={styles.infoLeft}>
                <View style={styles.infoIcon}><FormIcon name={item.icon} size={20} color={themeColors.accent} /></View>
                <View style={styles.infoText}><Text style={[styles.infoLabel, HC.textMuted, { fontSize: scaledFontSize(13) }]}>{item.label}</Text><Text style={[styles.infoValue, HC.text, { fontSize: scaledFontSize(14) }]}>{item.value}</Text></View>
              </View>
            </View>
          </View>
        ))}
        <Text style={[styles.sectionTitle, HC.textMuted, { fontSize: scaledFontSize(15) }]}>Settings</Text>
        <TouchableOpacity style={[styles.menuItem, HC.card, HC.touch]} onPress={() => navigation.navigate('Notifications')} accessibilityRole="button"><FormIcon name="bell" size={20} style={styles.menuIcon} /><Text style={[styles.menuLabel, HC.text, { fontSize: scaledFontSize(15) }]}>Notifications</Text><FormIcon name="chevron-right" size={20} /></TouchableOpacity>
        <TouchableOpacity style={[styles.menuItem, HC.card, HC.touch]} onPress={() => navigation.navigate('Settings')} accessibilityRole="button"><FormIcon name="settings" size={20} style={styles.menuIcon} /><Text style={[styles.menuLabel, HC.text, { fontSize: scaledFontSize(15) }]}>App Settings</Text><FormIcon name="chevron-right" size={20} /></TouchableOpacity>
        <TouchableOpacity style={[styles.menuItem, HC.card, HC.touch]} onPress={() => navigation.navigate('Feedback')} accessibilityRole="button"><FormIcon name="help-circle" size={20} style={styles.menuIcon} /><Text style={[styles.menuLabel, HC.text, { fontSize: scaledFontSize(15) }]}>Help & Feedback</Text><FormIcon name="chevron-right" size={20} /></TouchableOpacity>
        <TouchableOpacity style={[styles.logoutBtn, HC.touch]} onPress={handleLogout} activeOpacity={0.7}><Text style={[styles.logoutText, { fontSize: scaledFontSize(16) }]}>Sign Out</Text></TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 20, paddingBottom: 120 },
  profileCard: { alignItems: 'center', marginBottom: 24, marginTop: 8, padding: 24, borderRadius: 24, backgroundColor: 'rgba(79, 70, 229, 0.10)', borderWidth: 1, borderColor: 'rgba(129, 140, 248, 0.2)' },
  avatarWrapper: { position: 'relative', marginBottom: 16 },
  avatarRing: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(79, 70, 229, 0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(79, 70, 229, 0.3)' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: '700' },
  badge: { position: 'absolute', bottom: 0, right: -4, backgroundColor: '#4f46e5', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 2, borderColor: '#0f172a' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  name: { fontSize: 24, fontWeight: '800', color: '#f1f5f9', letterSpacing: -0.3 },
  email: { fontSize: 14, color: '#64748b', marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#94a3b8', marginBottom: 12, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoCard: { backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 16, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.06)' },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { flex: 1, minWidth: 0 },
  infoIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(79, 70, 229, 0.1)', justifyContent: 'center', alignItems: 'center' },
  infoLabel: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  infoValue: { fontSize: 14, color: '#f1f5f9', fontWeight: '600', marginTop: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 16, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.06)' },
  menuLabel: { fontSize: 15, color: '#e2e8f0', fontWeight: '500', flex: 1 },
  menuIcon: { marginRight: 12 },
  logoutBtn: { marginTop: 16, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.15)' },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '700' },
  loadingOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.96)', justifyContent: 'center', alignItems: 'center' },
  loadingCard: { alignItems: 'center', padding: 40 },
  splashLogo: { width: 100, height: 100, borderRadius: 24, marginBottom: 16 },
  loadingTitle: { fontSize: 28, fontWeight: '900', color: '#f8fafc', letterSpacing: -0.5, marginBottom: 8 },
  loadingText: { fontSize: 16, color: '#818cf8', fontWeight: '600', marginTop: 16 },
});
