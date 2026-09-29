import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView, Image, Modal, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import VoiceAssistant from '../components/VoiceAssistant';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const { speak, ttsEnabled, accessibilityStyles, scaledFontSize } = useAccessibility();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const HC = accessibilityStyles;

  useEffect(() => {
    if (ttsEnabled) setTimeout(() => speak('Welcome to Lost and Found. Please sign in with your university email.'), 600);
  }, [ttsEnabled]);

  const handleLogin = async () => {
    if (!email || !password) { speak('Please enter email and password.'); Alert.alert('Oops', 'Please enter email and password'); return; }
    setLoading(true); speak('Signing in...');
    const result = await login(email, password);
    setLoading(false);
    if (result.error) { speak(result.error); Alert.alert('Login Failed', result.error); }
    else speak('Login successful!');
  };

  return (
    <View style={[styles.container, HC.container]}>
      {/* Loading Overlay */}
      <Modal visible={loading} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <Image source={require('../../assets/logo.png')} style={styles.splashLogo} />
            <Text style={styles.loadingTitle}>Lost & Found</Text>
            <ActivityIndicator size="large" color="#818cf8" style={{ marginTop: 24 }} />
            <Text style={styles.loadingText}>Signing in...</Text>
          </View>
        </View>
      </Modal>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Decorative background orbs */}
          <View style={styles.bgOrb1} />
          <View style={styles.bgOrb2} />
          <View style={styles.bgOrb3} />
          <View style={styles.bgOrb4} />

          <View style={styles.content}>
            {/* Logo section */}
            <View style={styles.logoSection}>
              <View style={styles.logoGlow}>
                <Image source={require('../../assets/logo.png')} style={styles.logoImage} />
              </View>
              <Text style={[styles.title, HC.text, { fontSize: scaledFontSize(30) }]}>Lost & Found</Text>
              <Text style={[styles.subtitle, HC.textMuted, { fontSize: scaledFontSize(14) }]}>Report • Track • Recover</Text>
              <View style={styles.ttsRow}>
                <VoiceAssistant text="Lost and Found app. Sign in to continue." />
              </View>
            </View>

            {/* Login card */}
            <View style={[styles.card, { backgroundColor: HC.highContrast ? '#1a1a1a' : 'rgba(30, 41, 59, 0.65)' }, HC.card]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, HC.text, { fontSize: scaledFontSize(22) }]}>Welcome Back</Text>
                <Text style={[styles.cardSubtitle, HC.textMuted, { fontSize: scaledFontSize(14) }]}>Sign in to your account</Text>
              </View>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <View style={styles.dividerDot} />
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, HC.text, { fontSize: scaledFontSize(12) }]}>EMAIL</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputIcon}>📧</Text>
                    <TextInput
                      style={[styles.input, { fontSize: scaledFontSize(15) }]}
                      placeholder="your@university.edu"
                      placeholderTextColor="#4a5568"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, HC.text, { fontSize: scaledFontSize(12) }]}>PASSWORD</Text>
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputIcon}>🔒</Text>
                    <TextInput
                      style={[styles.input, { fontSize: scaledFontSize(15) }]}
                      placeholder="Enter password"
                      placeholderTextColor="#4a5568"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                      <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled, HC.touch]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <View style={styles.buttonGradient}>
                    <Text style={[styles.buttonText, { fontSize: scaledFontSize(16) }]}>
                      {loading ? 'Signing in...' : 'Sign In'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.navigate('SignUp')} style={styles.linkWrap}>
                  <Text style={[styles.link, HC.textAccent, { fontSize: scaledFontSize(14) }]}>
                    Don't have an account? <Text style={styles.linkBold}>Sign Up</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { flexGrow: 1 },
  bgOrb1: { position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: '#4f46e5', top: -80, right: -100, opacity: 0.2 },
  bgOrb2: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: '#7c3aed', top: 140, left: -80, opacity: 0.15 },
  bgOrb3: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#06b6d4', bottom: 60, right: -50, opacity: 0.12 },
  bgOrb4: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: '#818cf8', bottom: 200, left: 40, opacity: 0.08 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40, minHeight: 600 },
  logoSection: { alignItems: 'center', marginBottom: 36 },
  ttsRow: { marginTop: 14 },
  logoGlow: { width: 110, height: 110, borderRadius: 28, backgroundColor: 'rgba(79, 70, 229, 0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1.5, borderColor: 'rgba(129, 140, 248, 0.2)' },
  logoImage: { width: 80, height: 80, borderRadius: 20 },
  title: { fontSize: 30, fontWeight: '900', color: '#f8fafc', letterSpacing: -0.8 },
  subtitle: { fontSize: 14, color: '#94a3b8', marginTop: 6, fontWeight: '500', letterSpacing: 0.5 },
  card: { backgroundColor: 'rgba(30, 41, 59, 0.65)', borderRadius: 28, padding: 28, borderWidth: 1, borderColor: 'rgba(129, 140, 248, 0.1)', shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.35, shadowRadius: 32, elevation: 14 },
  cardHeader: { marginBottom: 8 },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#f1f5f9', letterSpacing: -0.3 },
  cardSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(129, 140, 248, 0.1)' },
  dividerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(129, 140, 248, 0.3)', marginHorizontal: 12 },
  form: {},
  inputGroup: { marginBottom: 18 },
  label: { fontSize: 12, fontWeight: '800', color: '#94a3b8', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.7)', borderWidth: 1.5, borderColor: 'rgba(129, 140, 248, 0.1)', borderRadius: 16, paddingHorizontal: 16 },
  inputIcon: { fontSize: 16, marginRight: 12, opacity: 0.7 },
  input: { flex: 1, paddingVertical: 16, fontSize: 15, color: '#f1f5f9' },
  eyeButton: { padding: 8, marginLeft: 4 },
  eyeIcon: { fontSize: 18, opacity: 0.7 },
  button: { borderRadius: 16, marginTop: 8, overflow: 'hidden', shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 8 },
  buttonGradient: { backgroundColor: '#4f46e5', paddingVertical: 18, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(129, 140, 248, 0.3)' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  linkWrap: { marginTop: 20, alignItems: 'center' },
  link: { textAlign: 'center', color: '#818cf8', fontSize: 14, fontWeight: '500' },
  linkBold: { fontWeight: '800', color: '#a5b4fc' },
  // Splash loading overlay
  loadingOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.96)', justifyContent: 'center', alignItems: 'center' },
  loadingCard: { alignItems: 'center', padding: 40 },
  splashLogo: { width: 100, height: 100, borderRadius: 24, marginBottom: 16 },
  loadingTitle: { fontSize: 28, fontWeight: '900', color: '#f8fafc', letterSpacing: -0.5, marginBottom: 8 },
  loadingText: { fontSize: 16, color: '#818cf8', fontWeight: '600', marginTop: 16 },
});
