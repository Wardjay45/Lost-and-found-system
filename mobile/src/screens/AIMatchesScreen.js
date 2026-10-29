import { TextInput, TouchableOpacity } from '../components/SpeechControls';
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, Image, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAccessibility, useThemedStyles } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';
import { initApiUrl } from '../config/api';
import { searchMatches } from '../services/matching.mjs';
import VoiceAssistant from '../components/VoiceAssistant';

export default function AIMatchesScreen({ navigation }) {
  const styles = useThemedStyles(baseStyles);
  const { speak, accessibilityStyles, scaledFontSize, readableColor, themeColors } = useAccessibility();
  const { token } = useAuth();
  const HC = accessibilityStyles;
  const [searchText, setSearchText] = useState('');
  const [searchImage, setSearchImage] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchMode, setSearchMode] = useState('text'); // 'text', 'image', 'both'

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8, base64: true });
    if (!result.canceled && result.assets[0].base64) setSearchImage(`data:${result.assets[0].mimeType || 'image/jpeg'};base64,${result.assets[0].base64}`);
  };

  const handleSearch = async () => {
    if (loading) return;
    if (!searchText.trim() && !searchImage) {
      Alert.alert('Required', 'Enter a description or choose a photo to search');
      return;
    }
    setLoading(true);
    setResults([]);
    setSearched(false);
    try {
      const scored = await searchMatches({ apiUrl: await initApiUrl(), token, description: searchText, image: searchImage });
      setSearchMode(searchImage ? (searchText.trim() ? 'both' : 'image') : 'text');
      setResults(scored);
      setSearched(true);
      speak(`Found ${scored.length} possible matching items.`);
    } catch (err) {
      Alert.alert('Search unavailable', err.message || 'Check your connection and try again.');
    } finally { setLoading(false); }
  };

  const getScoreColor = (score) => {
    if (score >= 0.7) return readableColor('#10b981');
    if (score >= 0.5) return readableColor('#f59e0b');
    return readableColor('#ef4444');
  };

  const formatScore = (score) => `${Math.round(score * 100)}%`;

  return (
    <SafeAreaView style={[styles.container, HC.container]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.headerSection}>
        <Text style={[styles.title, HC.text, { fontSize: scaledFontSize(24) }]}>AI Smart Matching</Text>
        <Text style={[styles.subtitle, HC.textMuted, { fontSize: scaledFontSize(14) }]}>Find possible matches using a description, photo, or both. Similarity scores do not confirm ownership.</Text>
        <VoiceAssistant text="AI Matching. Search for lost items using a description or photo." />
      </View>

      {/* Search Bar */}
      <View style={[styles.searchCard, HC.card]}>
        <TextInput
          style={[styles.searchInput, HC.text, { fontSize: scaledFontSize(15) }]}
          accessibilityLabel="Item description for matching"
          placeholder="Describe the item..."
          placeholderTextColor={themeColors.muted}
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={handleSearch}
        />
        <View style={styles.searchActions}>
          <TouchableOpacity style={[styles.imageBtn, HC.touch]} onPress={pickImage} activeOpacity={0.7}>
            <Text style={[HC.text, { fontSize: scaledFontSize(14) }]}>
              {searchImage ? '📷 Change' : '📷 Photo'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.searchBtn, loading && styles.searchBtnDisabled]}
            onPress={handleSearch}
            accessibilityLabel={loading ? "Searching for possible matches" : "Search for possible matches"}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={[styles.searchBtnText, { fontSize: scaledFontSize(14) }]}>🔍 Search</Text>
            )}
          </TouchableOpacity>
        </View>
        {searchImage && (
          <View style={styles.imagePreviewWrap}>
            <Image source={{ uri: searchImage }} style={styles.imagePreview} accessibilityLabel="Selected search photo" />
            <TouchableOpacity onPress={() => setSearchImage(null)} style={styles.removeImg}>
              <Text style={{ color: readableColor('#ef4444'), fontSize: scaledFontSize(12) }}>✕ Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>


        {results.length === 0 && searched && !loading && (
          <View style={styles.empty}>
            <Text style={{ fontSize: scaledFontSize(36) }}>🧠</Text>
            <Text style={[styles.emptyText, HC.textMuted, { fontSize: scaledFontSize(14) }]}>No matching items found</Text>
            <Text style={[styles.emptySub, HC.textMuted, { fontSize: scaledFontSize(12) }]}>Try a different description or image</Text>
          </View>
        )}
        {results.map((item, idx) => {
          const imageScore = item.image_score ?? 0;
          const textScore = item.text_score ?? 0;
          const combinedScore = item.score;

          return (
            <View key={item.id || idx} style={[styles.card, HC.card]}>
              <View style={styles.cardTop}>
                <View style={[styles.scoreBadge, { backgroundColor: themeColors.input }]}>
                  <Text style={{ color: getScoreColor(combinedScore), fontWeight: '800', fontSize: scaledFontSize(16) }}>
                    {formatScore(combinedScore)} similarity
                  </Text>
                </View>
                <Text style={[styles.itemId, HC.textMuted, { fontSize: scaledFontSize(11) }]}>{item.item_id || ''}</Text>
              </View>

              <Text style={[styles.itemDesc, HC.text, { fontSize: scaledFontSize(15) }]}>{item.description}</Text>
              <View style={styles.itemMeta}>
                <Text style={[styles.itemLoc, HC.textMuted, { fontSize: scaledFontSize(12) }]}>📍 {item.location}</Text>
                <Text style={[styles.itemCat, HC.textMuted, { fontSize: scaledFontSize(12) }]}>{item.category_name}</Text>
              </View>

              {item.image && (
                <Image
                  source={{ uri: item.image }}
                  accessibilityLabel={`Possible matching item: ${item.description}`}
                  style={styles.resultImage}
                  resizeMode="cover"
                />
              )}

              {/* Combined Score bar */}
              <View style={styles.scoreSection}>
                <View style={styles.scoreLabelRow}>
                  <Text style={[styles.scoreLabel, HC.textMuted, { fontSize: scaledFontSize(11) }]}>Combined</Text>
                  <Text style={[styles.scoreValue, { color: getScoreColor(combinedScore), fontSize: scaledFontSize(11) }]}>
                    {formatScore(combinedScore)}
                  </Text>
                </View>
                <View style={styles.scoreBarBg}>
                  <View style={[styles.scoreBarFill, { width: `${Math.min(100, combinedScore * 100)}%`, backgroundColor: getScoreColor(combinedScore) }]} />
                </View>
              </View>

              {/* Image Similarity bar — only when an image was used */}
              {(searchMode === 'image' || searchMode === 'both') && (
                <View style={styles.scoreSection}>
                  <View style={styles.scoreLabelRow}>
                    <Text style={[styles.scoreLabel, HC.textMuted, { fontSize: scaledFontSize(11) }]}>🖼️ Image</Text>
                    <Text style={[styles.scoreValue, { color: getScoreColor(imageScore), fontSize: scaledFontSize(11) }]}>
                      {formatScore(imageScore)}
                    </Text>
                  </View>
                  <View style={styles.scoreBarBg}>
                    <View style={[styles.scoreBarFill, { width: `${Math.min(100, imageScore * 100)}%`, backgroundColor: getScoreColor(imageScore) }]} />
                  </View>
                </View>
              )}

              {/* Text Similarity bar — only when text was used */}
              {(searchMode === 'text' || searchMode === 'both') && (
                <View style={styles.scoreSection}>
                  <View style={styles.scoreLabelRow}>
                    <Text style={[styles.scoreLabel, HC.textMuted, { fontSize: scaledFontSize(11) }]}>📝 Text</Text>
                    <Text style={[styles.scoreValue, { color: getScoreColor(textScore), fontSize: scaledFontSize(11) }]}>
                      {formatScore(textScore)}
                    </Text>
                  </View>
                  <View style={styles.scoreBarBg}>
                    <View style={[styles.scoreBarFill, { width: `${Math.min(100, textScore * 100)}%`, backgroundColor: getScoreColor(textScore) }]} />
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.claimBtn, HC.touch]}
                onPress={() => {
                  speak(`Similarity ${formatScore(combinedScore)} for ${item.description}. Image similarity ${formatScore(imageScore)}, text similarity ${formatScore(textScore)}.`);
                  Alert.alert(
                    'Match Details',
                    `${item.description}\n\nLocation: ${item.location}\nCategory: ${item.category_name}\n\nCombined: ${formatScore(combinedScore)}\nImage: ${formatScore(imageScore)}\nText: ${formatScore(textScore)}`
                  );
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.claimBtnText, { fontSize: scaledFontSize(14) }]}>View Details</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  headerSection: { paddingHorizontal: 0, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: '#f1f5f9', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  searchCard: { backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 16, padding: 16, marginHorizontal: 0, marginBottom: 16, marginTop: 12, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.06)' },
  searchInput: { backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: 12, padding: 14, color: '#f1f5f9', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.1)' },
  searchActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  imageBtn: { flex: 1, backgroundColor: 'rgba(79, 70, 229, 0.15)', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(129, 140, 248, 0.2)' },
  searchBtn: { flex: 1, backgroundColor: '#4f46e5', borderRadius: 12, padding: 12, alignItems: 'center' },
  searchBtnDisabled: { opacity: 0.6 },
  searchBtnText: { color: '#fff', fontWeight: '700' },
  imagePreviewWrap: { marginTop: 10, alignItems: 'center' },
  imagePreview: { width: 80, height: 80, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.1)' },
  removeImg: { marginTop: 4 },
  scroll: { padding: 16, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: '#64748b', marginTop: 8 },
  emptySub: { fontSize: 12, color: '#475569', marginTop: 4 },
  card: { backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.06)' },
  cardTop: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  scoreBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  itemId: { fontSize: 11, color: '#475569' },
  itemDesc: { fontSize: 15, color: '#e2e8f0', fontWeight: '600', marginBottom: 8 },
  itemMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  itemLoc: { fontSize: 12, color: '#64748b' },
  itemCat: { fontSize: 12, color: '#64748b' },
  resultImage: { width: '100%', height: 160, borderRadius: 12, marginBottom: 10 },
  scoreSection: { marginBottom: 6 },
  scoreLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  scoreLabel: { fontSize: 11, color: '#64748b' },
  scoreValue: { fontSize: 11, fontWeight: '700' },
  scoreBarBg: { width: '100%', height: 4, backgroundColor: 'rgba(148, 163, 184, 0.1)', borderRadius: 2 },
  scoreBarFill: { height: 4, borderRadius: 2 },
  claimBtn: { backgroundColor: 'rgba(79, 70, 229, 0.15)', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(129, 140, 248, 0.2)', marginTop: 8 },
  claimBtnText: { color: '#818cf8', fontWeight: '700' },
});
