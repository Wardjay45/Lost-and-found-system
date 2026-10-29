import { TextInput, TouchableOpacity } from '../components/SpeechControls';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, Image, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRoute } from '@react-navigation/native';
import SpeechInputModal, { MicButton } from '../components/SpeechInputModal';
import { useAccessibility, useThemedStyles } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';
import supabase from '../config/supabase';
import { validateReportFields, optionalLocationDetails, requireReportLocation } from '../services/reporting.mjs';
import VoiceAssistant from '../components/VoiceAssistant';
import FormIcon from '../components/FormIcon';
import ReportLocationPicker, { useReportLocations } from '../components/ReportLocationPicker';


export default function ReportFoundScreen({ navigation }) {
  const styles = useThemedStyles(baseStyles);
  const route = useRoute();
  const { speak, highContrast, accessibilityStyles, scaledFontSize, themeColors } = useAccessibility();
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const { location, setLocation, locations, locationsLoading, locationsError, refreshLocations, locationLocked } = useReportLocations(route.params?.location);
  const [locationDetails, setLocationDetails] = useState('');
  const [condition, setCondition] = useState('Good');
  const [image, setImage] = useState(null);
  const [showCategory, setShowCategory] = useState(false);
  const [showCondition, setShowCondition] = useState(false);
  const [categories, setCategories] = useState([]);

  // Fetch categories from Supabase directly
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase.from('categories').select('*');
        if (error || !Array.isArray(data)) throw error || new Error('Categories unavailable');
        const visibleCategories = data.filter(c => c.auto_tagging !== false);
        if (visibleCategories.length === 0) throw new Error('No categories available');
        setCategories(visibleCategories);
      } catch {
        setCategories([
          { id: null, name: 'Electronics', icon: '💻' },
          { id: null, name: 'Accessories', icon: '⌚' },
          { id: null, name: 'Keys', icon: '🔑' },
          { id: null, name: 'IDs & Cards', icon: '🪪' },
          { id: null, name: 'Clothing', icon: '👕' },
          { id: null, name: 'Bags', icon: '🎒' },
          { id: null, name: 'Books & Papers', icon: '📚' },
          { id: null, name: 'Miscellaneous', icon: '📦' },
        ]);
      }
    };
    fetchCategories();
  }, []);

  const [speechModal, setSpeechModal] = useState({ visible: false, field: '', fieldName: '' });
  const [activeMic, setActiveMic] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [formError, setFormError] = useState('');

  const HC = accessibilityStyles;

  const openSpeech = (field, fieldName) => {
    setActiveMic(field);
    setSpeechModal({ visible: true, field, fieldName });
  };
  const handleSpeechResult = (text) => {
    const setters = { description: setDescription, locationDetails: value => setLocationDetails(value.slice(0, 500)) };
    if (setters[speechModal.field]) setters[speechModal.field](text);
    setActiveMic('');
  };
  const closeSpeech = () => { setSpeechModal({ visible: false, field: '', fieldName: '' }); setActiveMic(''); };
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        base64: true,
        quality: 0.7,
        allowsEditing: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setImage(asset.base64 ? 'data:image/jpeg;base64,' + asset.base64 : asset.uri);
      }
    } catch (err) {
      console.error('Image picker error:', err);
      Alert.alert('Photo unavailable', 'Could not open your photo library. Check photo permission and try again.');
    }
  };

  // Generate a unique item ID
  const generateItemId = () => {
    const prefix = 'FOUND';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    if (locationsLoading || locationsError) {
      const message = 'Refresh the approved locations before submitting your report.';
      setFormError(message);
      speak(message);
      return;
    }
    const { error: validationError, cleanDescription, cleanCategory, cleanLocation, cleanName } =
      validateReportFields({ description, category, location, name: user?.name, userId: user?.id });
    if (validationError) {
      setFormError(validationError);
      speak(validationError);
      return;
    }
    setFormError('');
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await requireReportLocation(supabase, cleanLocation);
      const selectedCat = categories.find(c => c.name === cleanCategory);

      let imageBase64 = null;
      if (image) {
        if (image.startsWith('data:image/')) {
          imageBase64 = image;
        } else {
          try {
            const { default: FileSystem } = await import('expo-file-system');
            const b64raw = await FileSystem.readAsStringAsync(image, {
              encoding: FileSystem.EncodingType.Base64,
            });
            imageBase64 = `data:image/jpeg;base64,${b64raw}`;
          } catch (e) {
            throw new Error('Could not read the selected photo. Remove it or choose another photo.');
          }
        }
      }

      const insertData = {
        item_id: generateItemId(),
        description: cleanDescription,
        category_name: cleanCategory,
        category_id: selectedCat?.id || null,
        category_icon: selectedCat?.icon || 'tag',
        location_found: cleanLocation,
        ...optionalLocationDetails(locationDetails),
        finder_name: cleanName,
        finder_id: user?.id || null,
        condition: condition || 'Good',
        status: 'pending',
        date_found: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      };

      if (imageBase64) {
        insertData.image = imageBase64;
      }

      const { data, error } = await supabase
        .from('found_items')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      speak('Found item reported! Please surrender the item at the Lost & Found Office for verification.');
      Alert.alert('📦 Found Item Report Submitted', `Thank you for reporting a found item!\n\nItem: ${description}\nLocation: ${location}\nCategory: ${category}\n\n📌 IMPORTANT: Please surrender the item at the Campus Lost & Found Office as soon as possible. An admin will verify the item and activate the report so it can be matched with someone who may have lost it.\n\nYour kindness helps a fellow student!`, [
        { text: 'OK', onPress: () => { speak('Please visit the Lost and Found Office to surrender the item.'); navigation.goBack(); } }
      ]);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to submit report.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, HC.container]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={locationsLoading} onRefresh={refreshLocations} tintColor={themeColors.accent} colors={[themeColors.accent]} enabled={!submitting} />}>
        <View style={[styles.headerSection, highContrast && HC.card]}>
          <View style={styles.headerIcon}><FormIcon name="package" size={28} color={themeColors.accent} /></View>
          <Text style={[styles.title, HC.text, { fontSize: scaledFontSize(24) }]}>Report Found Item</Text>
          <Text style={[styles.subtitle, HC.textMuted, { fontSize: scaledFontSize(14) }]}>Help return a lost item to its owner</Text>
          <VoiceAssistant text="Report a found item. Fill in the description, category, and location." />
          <View style={[styles.speechHint, HC.card]}>
            <FormIcon name="mic" size={16} color={themeColors.accent} />
            <Text style={[styles.speechHintText, HC.textMuted, { fontSize: scaledFontSize(12) }]}>Choose an approved location. Use the mic for your description or additional details.</Text>
          </View>
        </View>
        <Text style={[styles.sectionHeading, HC.text, { fontSize: scaledFontSize(17) }]}>Item details</Text>
        <Text style={[styles.sectionHint, HC.textMuted, { fontSize: scaledFontSize(12) }]}>Fields marked * are required.</Text>
        <TouchableOpacity style={[styles.imagePicker, HC.card, HC.touch]} onPress={pickImage} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={image ? "Change item photo" : "Add item photo"}>
          {image ? <Image source={{ uri: image }} style={styles.image} resizeMode="cover" /> : (
            <View style={styles.imagePlaceholder}><FormIcon name="camera" size={32} /><Text style={[styles.imageText, HC.textMuted, { fontSize: scaledFontSize(14) }]}>Tap to add a photo</Text><Text style={[styles.imageSubtext, HC.textMuted, { fontSize: scaledFontSize(12) }]}>Optional</Text></View>
          )}
        </TouchableOpacity>
        {image && <TouchableOpacity accessibilityLabel="Remove photo" accessibilityRole="button" style={[styles.removePhotoButton, HC.touch]} onPress={() => setImage(null)}><FormIcon name="x" size={16} /><Text style={[styles.removeImage, { fontSize: scaledFontSize(13) }]}>Remove photo</Text></TouchableOpacity>}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, HC.text, { fontSize: scaledFontSize(13) }]}>Description *</Text>
          <View style={styles.inputRow}><TextInput style={[styles.input, styles.inputFlex, { fontSize: scaledFontSize(15) }]} accessibilityLabel="Item description, required" placeholder="Describe the item (color, brand, features...)" placeholderTextColor={themeColors.muted} value={description} onChangeText={setDescription} multiline numberOfLines={3} textAlignVertical="top" /><MicButton onPress={() => openSpeech('description', 'Description')} active={activeMic === 'description'} /></View>
          <Text style={[styles.label, HC.text, { fontSize: scaledFontSize(13) }]}>Category *</Text>
          <TouchableOpacity accessibilityLabel={`Category, ${category || "not selected"}, required`} accessibilityState={{ expanded: showCategory }} style={[styles.select, HC.touch]} onPress={() => { setShowCategory(!showCategory); setShowCondition(false); if (!showCategory) speak('Select category'); }} activeOpacity={0.7}><Text style={[category ? styles.selectText : styles.placeholderText, { fontSize: scaledFontSize(15) }, category && HC.text]}>{category || 'Select category'}</Text><FormIcon name={showCategory ? 'chevron-up' : 'chevron-down'} size={18} /></TouchableOpacity>
          {showCategory && (<View style={styles.dropdown}>{categories.map(c => (<TouchableOpacity key={c.id ?? c.name} accessibilityRole="radio" accessibilityState={{ checked: category === c.name }} style={[styles.option, HC.touch]} onPress={() => { setCategory(c.name); setShowCategory(false); }}><Text style={[styles.optionText, HC.text, { fontSize: scaledFontSize(15) }]}>{c.name}</Text></TouchableOpacity>))}</View>)}
          <Text style={[styles.label, HC.text, { fontSize: scaledFontSize(13) }]}>Condition</Text>
          <TouchableOpacity style={[styles.select, HC.touch]} onPress={() => { setShowCondition(!showCondition); setShowCategory(false); if (!showCondition) speak('Select condition'); }} activeOpacity={0.7}><Text style={[condition ? styles.selectText : styles.placeholderText, { fontSize: scaledFontSize(15) }, condition && HC.text]}>{condition || 'Select condition'}</Text><FormIcon name={showCondition ? 'chevron-up' : 'chevron-down'} size={18} /></TouchableOpacity>
          {showCondition && (<View style={styles.dropdown}>{['Good', 'Damaged', 'Poor'].map(c => (<TouchableOpacity key={c} accessibilityRole="radio" accessibilityState={{ checked: condition === c }} style={[styles.option, HC.touch]} onPress={() => { setCondition(c); setShowCondition(false); }}><Text style={[styles.optionText, HC.text, { fontSize: scaledFontSize(15) }]}>{c}</Text></TouchableOpacity>))}</View>)}
          <Text style={[styles.sectionHeading, HC.text, { fontSize: scaledFontSize(17) }]}>Location</Text>
          <Text style={[styles.label, HC.text, { fontSize: scaledFontSize(13) }]}>Location Found *</Text>
          <ReportLocationPicker value={location} locations={locations} loading={locationsLoading} error={locationsError}
            onChange={setLocation} onRefresh={refreshLocations} locked={locationLocked} disabled={submitting} />
          <Text style={[styles.label, HC.text, { fontSize: scaledFontSize(13) }]}>Additional Info (optional)</Text>
          <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, styles.inputFlex, { fontSize: scaledFontSize(15), minHeight: 90 }]}
            placeholder="Where exactly did you find it? Add a nearby landmark or other detail."
            placeholderTextColor={themeColors.muted}
            value={locationDetails}
            onChangeText={setLocationDetails}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={500}
            accessibilityLabel="Additional information about where you found the item, optional"
          />
          <MicButton onPress={() => openSpeech('locationDetails', 'Additional Info')} active={activeMic === 'locationDetails'} />
          </View>
          <Text style={[styles.sectionHint, HC.textMuted, { fontSize: scaledFontSize(12) }]}>Track updates in My Reports and Messages.</Text>
        </View>
        <View style={styles.handoverNote}><Text style={[styles.sectionHint, HC.textMuted, { fontSize: scaledFontSize(13) }]}>After submitting, bring the item to the Campus Lost & Found Office for verification.</Text></View>
        {!!formError && <View accessibilityRole="alert" style={styles.formErrorCard}><Text style={[styles.formErrorText, HC.text, { fontSize: scaledFontSize(13) }]}>{formError}</Text></View>}
        <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }, HC.touch]} onPress={handleSubmit} activeOpacity={0.8} disabled={submitting}>
          {submitting ? <View style={styles.submittingRow}><ActivityIndicator color="#fff" size="small" /><Text style={[styles.submitText, { fontSize: scaledFontSize(16) }]}>Submitting...</Text></View> : <Text style={[styles.submitText, { fontSize: scaledFontSize(16) }]}>Submit Report</Text>}
        </TouchableOpacity>
      </ScrollView>
      <SpeechInputModal visible={speechModal.visible} fieldName={speechModal.fieldName} onClose={closeSpeech} onResult={handleSpeechResult} />
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 20, paddingBottom: 40 },
  headerSection: { alignItems: 'flex-start', marginBottom: 20, marginTop: 8, padding: 20, borderRadius: 24, backgroundColor: 'rgba(16, 185, 129, 0.08)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.18)' },
  headerIcon: { width: 60, height: 60, borderRadius: 18, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#f1f5f9', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  speechHint: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 14, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', gap: 8 },
  speechHintText: { fontSize: 12, color: '#94a3b8', flex: 1, lineHeight: 18 },
  imagePicker: { backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(148, 163, 184, 0.15)', borderStyle: 'dashed', overflow: 'hidden', marginBottom: 8 },
  image: { width: '100%', height: 200, borderRadius: 16 },
  imagePlaceholder: { height: 140, justifyContent: 'center', alignItems: 'center', padding: 20 },
  imageText: { fontSize: 14, color: '#94a3b8', fontWeight: '600', marginTop: 8 },
  imageSubtext: { fontSize: 12, color: '#475569', marginTop: 2 },
  removePhotoButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, marginBottom: 16 },
  removeImage: { color: '#ef4444', fontSize: 13, textAlign: 'center', fontWeight: '600' },
  inputGroup: { marginTop: 8, padding: 18, borderRadius: 22, backgroundColor: 'rgba(30, 41, 59, 0.6)', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.12)' },
  label: { fontSize: 13, fontWeight: '700', color: '#cbd5e1', marginBottom: 8, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.3 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  inputFlex: { flex: 1 },
  input: { backgroundColor: 'rgba(15, 23, 42, 0.6)', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.12)', borderRadius: 14, padding: 16, fontSize: 15, color: '#f1f5f9', minHeight: 50 },
  select: { backgroundColor: 'rgba(15, 23, 42, 0.6)', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.12)', borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectText: { fontSize: 15, color: '#f1f5f9' },
  placeholderText: { fontSize: 15, color: '#64748b' },
  dropdown: { backgroundColor: 'rgba(30, 41, 59, 0.9)', borderRadius: 14, marginTop: 4, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.08)' },
  option: { padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(148, 163, 184, 0.05)' },
  optionText: { fontSize: 15, color: '#e2e8f0' },
  submitBtn: { minHeight: 56, backgroundColor: '#10b981', borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 28, shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  submittingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionHeading: { color: '#f1f5f9', fontSize: 17, fontWeight: '700', marginTop: 18, marginBottom: 4 },
  sectionHint: { color: '#94a3b8', fontSize: 12, lineHeight: 18, marginBottom: 8 },
  handoverNote: { marginTop: 20, padding: 14, borderRadius: 12, backgroundColor: 'rgba(16, 185, 129, 0.09)' },
  formErrorCard: { padding: 14, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.12)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.45)', marginTop: 18 },
  formErrorText: { color: '#fecaca', lineHeight: 19 },
});
