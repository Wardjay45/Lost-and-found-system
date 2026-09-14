import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView, Modal, FlatList } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import VoiceAssistant from '../components/VoiceAssistant';

const DEPARTMENTS = [
  'Institute of Computing (IC)',
  'Institute of Aquatic and Applied Sciences (IAAS)',
  'Institute of Leadership, Entrepreneurship, and Good Governance (ILEGG)',
  'Institute of Teacher Education (ITED)',
  'Staff',
  'Instructor',
];

export default function SignUpScreen({ navigation }) {
  const { signup, logout, isAuthenticated } = useAuth();
  const { speak, accessibilityStyles, scaledFontSize } = useAccessibility();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [showDeptModal, setShowDeptModal] = useState(false);
  const HC = accessibilityStyles;

  // Phone setter with 11-digit max
  const setPhoneLimited = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    setPhone(digits);
  };

  const handleSignUp = async () => {
    if (!name || !email || !password || !studentId || !department) {
      speak('Please fill in all required fields.');
      Alert.alert('Required', 'Please fill in all required fields including Department');
      return;
    }
    if (!email.endsWith('.edu') && !email.endsWith('.edu.ph')) {
      speak('Please use a valid university email.');
      Alert.alert('Invalid Email', 'Please use a valid university email (e.g. .edu or .edu.ph)');
      return;
    }
    if (password.length < 6) {
      speak('Password must be at least 6 characters.');
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    if (phone && phone.replace(/\D/g, '').length !== 11) {
      speak('Phone number must be exactly 11 digits.');
      Alert.alert('Invalid Phone', 'Phone number must be exactly 11 digits.');
      return;
    }
    const result = await signup(name, email, password, studentId, phone, department);
    if (result.error) { speak(result.error); Alert.alert('Signup Failed', result.error); }
    else {
      logout();
      speak('Account created successfully. Please login.');
      Alert.alert('Success', 'Your account has been created. Please login to continue.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  };

  const fields = [
    { label: 'FULL NAME', icon: '👤', placeholder: 'Juan Dela Cruz', value: name, setter: setName, required: true },
    { label: 'EMAIL (.edu only)', icon: '📧', placeholder: 'your@university.edu', value: email, setter: setEmail, keyboardType: 'email-address', autoCapitalize: 'none', required: true },
    { label: 'STUDENT ID', icon: '🎓', placeholder: '2021-0001', value: studentId, setter: setStudentId, required: true },
    { label: 'DEPARTMENT', icon: '🏛️', type: 'picker', placeholder: 'Select your institute', value: department, setter: setDepartment, required: true, onPress: () => setShowDeptModal(true) },
    { label: 'PASSWORD', icon: '🔒', placeholder: 'Create a password (min 6 chars)', value: password, setter: setPassword, secureTextEntry: true, required: true },
    { label: 'PHONE NUMBER', icon: '📱', placeholder: '0917-123-4567 (11 digits)', value: phone, setter: setPhoneLimited, keyboardType: 'phone-pad' },
  ];

  return (
    <KeyboardAvoidingView style={[styles.container, HC.container]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => isAuthenticated ? navigation.navigate('Main') : navigation.goBack()} style={[styles.backBtn, HC.touch]}>
          <View style={styles.backIconWrap}>
            <Text style={styles.backArrow}>‹</Text>
          </View>
          <Text style={[styles.backText, HC.textAccent, { fontSize: scaledFontSize(15) }]}>Back</Text>
        </TouchableOpacity>

        <View style={styles.headerSection}>
          <View style={styles.headerGlow}>
            <View style={styles.headerIcon}>
              <Text style={{ fontSize: scaledFontSize(28) }}>🎓</Text>
            </View>
          </View>
          <Text style={[styles.title, HC.text, { fontSize: scaledFontSize(26) }]}>Create Account</Text>
          <Text style={[styles.subtitle, HC.textMuted, { fontSize: scaledFontSize(14) }]}>Join University Lost & Found</Text>
          <VoiceAssistant text="Sign up. Create a new account with your university email." />
        </View>

        {/* Progress dots */}
        <View style={styles.progressRow}>
          {[1, 2, 3].map(step => (
            <View key={step} style={[styles.progressDot, step === 1 && styles.progressDotActive]} />
          ))}
        </View>

        <View style={[styles.card, HC.card]}>
          <Text style={[styles.cardTitle, HC.text, { fontSize: scaledFontSize(18) }]}>Your Details</Text>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerDot} />
            <View style={styles.dividerLine} />
          </View>

          {fields.map((field, index) => (
            <View key={`${field.label}-${index}`} style={styles.inputGroup}>
              <Text style={[styles.label, HC.text, { fontSize: scaledFontSize(12) }]}>
                {field.label} {field.required ? '*' : ''}
              </Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputIcon}>{field.icon}</Text>
                {field.type === 'picker' ? (
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={field.onPress}
                    activeOpacity={0.7}
                  >
                    <Text style={[{ color: field.value ? '#f1f5f9' : '#4a5568' }, { flex: 1, paddingVertical: 16, fontSize: 15 }]}>
                      {field.value || field.placeholder}
                    </Text>
                    <Text style={styles.dropdownArrow}>▼</Text>
                  </TouchableOpacity>
                ) : field.label === 'PASSWORD' ? (
                  <>
                    <TextInput
                      style={[styles.input, { fontSize: scaledFontSize(15) }]}
                      placeholder={field.placeholder}
                      placeholderTextColor="#4a5568"
                      value={field.value}
                      onChangeText={field.setter}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                      <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TextInput
                    style={[styles.input, { fontSize: scaledFontSize(15) }]}
                    placeholder={field.placeholder}
                    placeholderTextColor="#4a5568"
                    value={field.value}
                    onChangeText={field.setter}
                    keyboardType={field.keyboardType}
                    autoCapitalize={field.autoCapitalize}
                    secureTextEntry={field.secureTextEntry}
                  />
                )}
              </View>
            </View>
          ))}

          <TouchableOpacity style={[styles.button, HC.touch]} onPress={handleSignUp} activeOpacity={0.85}>
            <View style={styles.buttonGradient}>
              <Text style={[styles.buttonText, { fontSize: scaledFontSize(16) }]}>Create Account</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => isAuthenticated ? navigation.navigate('Main') : navigation.navigate('Login')} style={styles.linkWrap}>
            <Text style={[styles.link, HC.textAccent, { fontSize: scaledFontSize(14) }]}>
              {isAuthenticated ? 'Back to Home' : 'Already have an account?'} <Text style={styles.linkBold}>{isAuthenticated ? 'Home' : 'Sign In'}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Department Selection Modal */}
      <Modal visible={showDeptModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, HC.card]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, HC.text, { fontSize: scaledFontSize(18) }]}>Select Department</Text>
              <TouchableOpacity onPress={() => setShowDeptModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={DEPARTMENTS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.deptItem,
                    department === item && styles.deptItemActive,
                  ]}
                  onPress={() => {
                    setDepartment(item);
                    setShowDeptModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.deptItemText,
                      department === item && styles.deptItemTextActive,
                      { fontSize: scaledFontSize(15) },
                    ]}
                  >
                    {item}
                  </Text>
                  {department === item && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 22, paddingBottom: 50 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 6 },
  backIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(129, 140, 248, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(129, 140, 248, 0.15)' },
  backArrow: { fontSize: 22, color: '#818cf8', fontWeight: '300', marginTop: -2 },
  backText: { fontSize: 15, color: '#818cf8', fontWeight: '600' },
  headerSection: { alignItems: 'center', marginBottom: 20 },
  headerGlow: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(79, 70, 229, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(129, 140, 248, 0.15)' },
  headerIcon: { width: 60, height: 60, borderRadius: 18, backgroundColor: 'rgba(79, 70, 229, 0.15)', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '900', color: '#f1f5f9', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 6, letterSpacing: 0.3 },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(129, 140, 248, 0.15)' },
  progressDotActive: { width: 28, backgroundColor: '#4f46e5' },
  card: { backgroundColor: 'rgba(30, 41, 59, 0.65)', borderRadius: 28, padding: 26, borderWidth: 1, borderColor: 'rgba(129, 140, 248, 0.1)', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 12 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#f1f5f9', letterSpacing: -0.2 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(129, 140, 248, 0.08)' },
  dividerDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(129, 140, 248, 0.25)', marginHorizontal: 10 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '800', color: '#94a3b8', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.7)', borderWidth: 1.5, borderColor: 'rgba(129, 140, 248, 0.08)', borderRadius: 16, paddingHorizontal: 16 },
  inputIcon: { fontSize: 15, marginRight: 12, opacity: 0.6 },
  input: { flex: 1, paddingVertical: 16, fontSize: 15, color: '#f1f5f9' },
  eyeButton: { padding: 8, marginLeft: 4 },
  eyeIcon: { fontSize: 18, opacity: 0.7 },
  pickerButton: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  dropdownArrow: { fontSize: 12, color: '#64748b', marginLeft: 8 },
  button: { borderRadius: 16, marginTop: 12, overflow: 'hidden', shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 8 },
  buttonGradient: { backgroundColor: '#4f46e5', paddingVertical: 18, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(129, 140, 248, 0.3)' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  linkWrap: { marginTop: 20, alignItems: 'center' },
  link: { textAlign: 'center', color: '#818cf8', fontSize: 14, fontWeight: '500' },
  linkBold: { fontWeight: '800', color: '#a5b4fc' },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '60%', borderTopWidth: 1, borderTopColor: 'rgba(129, 140, 248, 0.1)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#f1f5f9' },
  modalClose: { fontSize: 20, color: '#64748b', padding: 4 },
  deptItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 4 },
  deptItemActive: { backgroundColor: 'rgba(79, 70, 229, 0.15)' },
  deptItemText: { color: '#cbd5e1', flex: 1, fontWeight: '500' },
  deptItemTextActive: { color: '#818cf8', fontWeight: '700' },
  checkmark: { color: '#4f46e5', fontSize: 16, fontWeight: '800' },
});