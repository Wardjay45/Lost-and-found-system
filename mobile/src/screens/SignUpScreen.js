import { TextInput, TouchableOpacity } from '../components/SpeechControls';
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView, Modal, FlatList, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAccessibility, useThemedStyles } from '../context/AccessibilityContext';
import VoiceAssistant from '../components/VoiceAssistant';
import FormIcon from '../components/FormIcon';
import { GENDER_OPTIONS, validateSignupFields } from '../services/signup.mjs';
import { selectSchoolGoogleAccount } from '../services/googleSignIn';

const DEPARTMENTS = [
  'Institute of Computing (IC)',
  'Institute of Aquatic and Applied Sciences (IAAS)',
  'Institute of Leadership, Entrepreneurship, and Good Governance (ILEGG)',
  'Institute of Teacher Education (ITED)',
  'Staff',
  'Instructor',
];

export default function SignUpScreen({ navigation, route }) {
  const styles = useThemedStyles(baseStyles);
  const { signup, continueWithGoogle, isAuthenticated } = useAuth();
  const { speak, accessibilityStyles, scaledFontSize, themeColors } = useAccessibility();
  const [name, setName] = useState(route?.params?.googleRegistration?.name || '');
  const [email, setEmail] = useState(route?.params?.googleRegistration?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [gender, setGender] = useState('');
  const [googleIdToken, setGoogleIdToken] = useState(route?.params?.googleRegistration?.idToken || null);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const HC = accessibilityStyles;

  const handleGoogle = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const selected = await selectSchoolGoogleAccount();
      if (selected.cancelled) return;
      if (selected.error) {
        speak(selected.error);
        Alert.alert('Google Sign-In', selected.error);
        return;
      }
      const result = await continueWithGoogle(selected.idToken);
      if (result.error) {
        speak(result.error);
        Alert.alert('Google Sign-In', result.error);
      } else if (result.registrationRequired) {
        setGoogleIdToken(selected.idToken);
        if (result.email !== email) {
          setName(result.name || '');
          setStudentId('');
          setDepartment('');
          setPhone('');
          setGender('');
        }
        setEmail(result.email);
        setPassword('');
        speak('School account verified. Complete your student details.');
      }
    } catch {
      Alert.alert('Google Sign-In', 'Unable to verify your account. Please try again.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  // Phone setter with 11-digit max
  const setPhoneLimited = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    setPhone(digits);
  };

  const handleSignUp = async () => {
    if (submittingRef.current) return;
    if (!googleIdToken) {
      Alert.alert('Verify Your School Account', 'Continue with Google before completing registration.');
      return;
    }
    const validation = validateSignupFields({ name, email, password, student_id: studentId, phone, department, gender });
    if (validation.error) {
      speak(validation.error);
      Alert.alert('Check Your Details', validation.error);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    speak('Creating your account.');
    try {
      const data = validation.data;
      const result = await signup({ ...data, google_id_token: googleIdToken });
      if (result.error) { speak(result.error); Alert.alert('Signup Failed', result.error); }
      else {
        speak('Account created successfully.');
        setPassword('');
      }
    } catch {
      const message = 'Unable to create your account. Please try again.';
      speak(message);
      Alert.alert('Signup Failed', message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const fields = [
    { label: 'FULL NAME', icon: 'user', placeholder: 'Juan Dela Cruz', value: name, setter: setName, required: true },
    { label: 'VERIFIED SCHOOL EMAIL', icon: 'mail', value: email, editable: false, keyboardType: 'email-address', autoCapitalize: 'none', required: true },
    { label: 'STUDENT ID', icon: 'credit-card', placeholder: '2021-0001', value: studentId, setter: setStudentId, required: true },
    { label: 'DEPARTMENT', icon: 'briefcase', type: 'picker', placeholder: 'Select your institute', value: department, setter: setDepartment, required: true, onPress: () => setShowDeptModal(true) },
    { label: 'GENDER', icon: 'users', type: 'picker', placeholder: 'Select gender', value: gender, setter: setGender, required: true, onPress: () => setShowGenderModal(true) },
    { label: 'PASSWORD', icon: 'lock', placeholder: 'Create a password (min 6 chars)', value: password, setter: setPassword, secureTextEntry: true, required: true },
    { label: 'PHONE NUMBER', icon: 'phone', placeholder: '0917-123-4567 (11 digits)', value: phone, setter: setPhoneLimited, keyboardType: 'phone-pad' },
  ];

  return (
    <KeyboardAvoidingView style={[styles.container, HC.container]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" disabled={submitting} onPress={() => isAuthenticated ? navigation.navigate('Main') : navigation.goBack()} style={[styles.backBtn, HC.touch]}>
          <View style={styles.backIconWrap}>
            <FormIcon name="arrow-left" color={themeColors.accent} />
          </View>
          <Text style={[styles.backText, HC.textAccent, { fontSize: scaledFontSize(15) }]}>Back</Text>
        </TouchableOpacity>

        <View style={styles.headerSection}>
          <View style={styles.headerGlow}>
            <View style={styles.headerIcon}>
              <FormIcon name="user-check" size={28} color={themeColors.accent} />
            </View>
          </View>
          <Text style={[styles.title, HC.text, { fontSize: scaledFontSize(26) }]}>{googleIdToken ? 'Complete Your Profile' : 'Join Your School'}</Text>
          <Text style={[styles.subtitle, HC.textMuted, { fontSize: scaledFontSize(14) }]}>Continue with your school Google account</Text>
          <VoiceAssistant text="Continue with your school Google account, then complete your name, student ID, department, gender, password, and phone number." />
        </View>

        <View style={[styles.card, HC.card]}>
          <TouchableOpacity
            style={[styles.googleButton, HC.touch, submitting && styles.buttonDisabled]}
            onPress={handleGoogle} disabled={submitting} accessibilityRole="button"
            accessibilityLabel={googleIdToken ? 'Change Google account' : 'Continue with Google'}
            accessibilityState={{ disabled: submitting, busy: submitting }}
          >
            {submitting && <ActivityIndicator color={themeColors.text} />}
            <Text style={[HC.text, { color: themeColors.text, fontSize: scaledFontSize(16), fontWeight: '700' }]}>{googleIdToken ? 'Change Google account' : 'Continue with Google'}</Text>
          </TouchableOpacity>
          <Text style={[styles.googleHint, HC.textMuted, { fontSize: scaledFontSize(13) }]}>{googleIdToken ? `Verified: ${email}` : 'Use your school-issued Google account. Personal accounts cannot register.'}</Text>
          {googleIdToken && <>
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
                <FormIcon name={field.icon} style={styles.inputIcon} />
                {field.type === 'picker' ? (
                  <TouchableOpacity accessibilityLabel={`Select ${field.label.toLowerCase()}`}
                    style={[styles.pickerButton, HC.touch]}
                    onPress={field.onPress}
                    disabled={submitting}
                    activeOpacity={0.7}
                  >
                    <Text style={[{ color: field.value ? themeColors.text : themeColors.muted }, { flex: 1, paddingVertical: 16, fontSize: scaledFontSize(15) }]}>
                      {field.value || field.placeholder}
                    </Text>
                    <FormIcon name="chevron-down" size={18} style={styles.dropdownArrow} />
                  </TouchableOpacity>
                ) : field.label === 'PASSWORD' ? (
                  <>
                    <TextInput accessibilityLabel={field.label}
                      style={[styles.input, { fontSize: scaledFontSize(15) }]}
                      placeholder={field.placeholder}
                      placeholderTextColor={themeColors.muted}
                      value={field.value}
                      onChangeText={field.setter}
                      editable={!submitting}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword(!showPassword)} style={[styles.eyeButton, HC.touch]}>
                      <FormIcon name={showPassword ? 'eye-off' : 'eye'} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <TextInput accessibilityLabel={field.label}
                    style={[styles.input, { fontSize: scaledFontSize(15) }]}
                    placeholder={field.placeholder}
                    placeholderTextColor={themeColors.muted}
                    value={field.value}
                    onChangeText={field.setter}
                    editable={!submitting && field.editable !== false}
                    keyboardType={field.keyboardType}
                    autoCapitalize={field.autoCapitalize}
                    secureTextEntry={field.secureTextEntry}
                  />
                )}
              </View>
            </View>
          ))}

          <TouchableOpacity style={[styles.button, HC.touch, submitting && styles.buttonDisabled]} onPress={handleSignUp} disabled={submitting} accessibilityRole="button" accessibilityState={{ disabled: submitting, busy: submitting }} activeOpacity={0.85}>
            <View style={styles.buttonGradient}>
              {submitting && <ActivityIndicator color="#fff" />}
              <Text style={[styles.buttonText, { fontSize: scaledFontSize(16) }]}>{submitting ? 'Creating Account…' : 'Create Account'}</Text>
            </View>
          </TouchableOpacity>

          </>}

          <TouchableOpacity disabled={submitting} onPress={() => isAuthenticated ? navigation.navigate('Main') : navigation.navigate('Login')} style={styles.linkWrap}>
            <Text style={[styles.link, HC.textAccent, { fontSize: scaledFontSize(14) }]}>
              {isAuthenticated ? 'Back to Home' : 'Already have an account?'} <Text style={styles.linkBold}>{isAuthenticated ? 'Home' : 'Sign In'}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Department Selection Modal */}
      <Modal visible={showDeptModal} transparent animationType={HC.reduceMotion ? 'none' : 'slide'} onRequestClose={() => setShowDeptModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, HC.card]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, HC.text, { fontSize: scaledFontSize(18) }]}>Select Department</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close department selector" style={[styles.modalClose, HC.touch]} onPress={() => setShowDeptModal(false)}>
                <FormIcon name="x" />
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
                  {department === item && <FormIcon name="check" color={themeColors.accent} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
      <Modal visible={showGenderModal} transparent animationType={HC.reduceMotion ? 'none' : 'slide'} onRequestClose={() => setShowGenderModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, HC.card]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, HC.text, { fontSize: scaledFontSize(18) }]}>Select Gender</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close gender selector" style={[styles.modalClose, HC.touch]} onPress={() => setShowGenderModal(false)}>
                <FormIcon name="x" />
              </TouchableOpacity>
            </View>
            <FlatList data={GENDER_OPTIONS} keyExtractor={item => item} renderItem={({ item }) => (
              <TouchableOpacity
                accessibilityRole="radio" accessibilityState={{ checked: gender === item }}
                style={[styles.deptItem, HC.touch, gender === item && styles.deptItemActive]}
                onPress={() => { setGender(item); setShowGenderModal(false); }}
              >
                <Text style={[styles.deptItemText, HC.text, gender === item && styles.deptItemTextActive, { fontSize: scaledFontSize(15) }]}>{item}</Text>
                {gender === item && <FormIcon name="check" color={themeColors.accent} />}
              </TouchableOpacity>
            )} />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 22, paddingBottom: 120 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 6 },
  backIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(129, 140, 248, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(129, 140, 248, 0.15)' },
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
  googleButton: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#94a3b8', paddingHorizontal: 16, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  googleHint: { color: '#94a3b8', marginTop: 12, marginBottom: 24, lineHeight: 21, textAlign: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(129, 140, 248, 0.08)' },
  dividerDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(129, 140, 248, 0.25)', marginHorizontal: 10 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '800', color: '#94a3b8', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.7)', borderWidth: 1.5, borderColor: 'rgba(129, 140, 248, 0.08)', borderRadius: 16, paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, paddingVertical: 16, fontSize: 15, color: '#f1f5f9' },
  eyeButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 10, marginLeft: 4 },
  pickerButton: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  dropdownArrow: { marginLeft: 8 },
  button: { borderRadius: 16, marginTop: 12, overflow: 'hidden', shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 8 },
  buttonDisabled: { opacity: 0.6 },
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
  modalClose: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 10 },
  deptItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 4 },
  deptItemActive: { backgroundColor: 'rgba(79, 70, 229, 0.15)' },
  deptItemText: { color: '#cbd5e1', flex: 1, fontWeight: '500' },
  deptItemTextActive: { color: '#818cf8', fontWeight: '700' },
});
