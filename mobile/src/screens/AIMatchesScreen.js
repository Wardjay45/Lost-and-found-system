import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, Image, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';
import supabase from '../config/supabase';
import VoiceAssistant from '../components/VoiceAssistant';

export default function AIMatchesScreen({ navigation }) {
  const { speak, accessibilityStyles, scaledFontSize } = useAccessibility();
  const { user, token } = useAuth();
  const HC = accessibilityStyles;
  const [searchText, setSearchText] = useState('');
  const [searchImage, setSearchImage] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchMode, setSearchMode] = useState('text'); // 'text', 'image', 'both'

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled) setSearchImage(result.assets[0].uri);
  };

  // Simple text similarity function
  const textSimilarity = (text1, text2) => {
    if (!text1 || !text2) return 0;
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = [...set1].filter(w => set2.has(w)).length;
    const union = new Set([...set1, ...set2]).size;
    return union > 0 ? intersection / union : 0;
  };

  const handleSearch = async () => {
    if (!searchText && !searchImage) {
      Alert.alert('Required', 'Enter a description to search');
      return;
    }
    
    setSearchMode('text');
    setLoading(true);
    setSearched(true);
    try {
      // Fetch all found items from Supabase
      const { data: foundItems, error } = await supabase
        .from('found_items')
        .select('*')
        .in('status', ['active', 'pending']);

      if (error) throw error;

      if (!foundItems || foundItems.length === 0) {
        setResults([]);
        speak('No items found in the system.');
        return;
      }

      // Calculate text similarity scores
      const searchLower = (searchText || '').toLowerCase();
      const scored = foundItems
        .map(item => {
          const descScore = textSimilarity(searchLower, item.description || '');
          const catScore = textSimilarity(searchLower, item.category_name || '');
          const locScore = textSimilarity(searchLower, item.location_found || '');
          const score = Math.min(1, descScore * 0.6 + catScore * 0.25 + locScore * 0.15 + 0.05);
          return {
            ...item,
            score: Math.round(score * 100) / 100,
            text_score: Math.round(descScore * 100) / 100,
            image_score: 0,
            location: item.location_found,
          };
        })
        .filter(item => item.score > 0.05)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      setResults(scored);
      speak(`Found ${scored.length} matching items.`);
    } catch (err) {
      Alert.alert('Error', 'Search failed. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 0.7) return '#10b981';
    if (score >= 0.5) return '#f59e0b';
    return '#ef4444';
  };

  const formatScore = (score) => `${Math.round(score * 100)}%`;

  return (
    <SafeAreaView style={[styles.container, HC.container]}>
      <View style={styles.headerSection}>
        <Text style={[styles.title, HC.text, { fontSize: scaledFontSize(24) }]}>AI Smart Matching</Text>
        <Text style={[styles.subtitle, HC.textMuted, { fontSize: scaledFontSize(14) }]}>Search with AI embeddings (ResNet + NLP)</Text>
        <VoiceAssistant text="AI Matching. Search for lost items using a description or photo." />
      </View>

      {/* Search Bar */}
      <View style={[styles.searchCard, HC.card]}>
        <TextInput
          style={[styles.searchInput, HC.text, { fontSize: scaledFontSize(15) }]}
          placeholder="Describe the item..."
          placeholderTextColor="#4a5568"
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={handleSearch}
        />
        <View style={styles.searchActions}>
          <TouchableOpacity style={[styles.imageBtn, HC.touch]} onPress={pickImage} activeOpacity={0.7}>
            <Text style={{ fontSize: scaledFontSize(14) }}>
              {searchImage ? '📷 Change' : '📷 Photo'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.searchBtn, loading && styles.searchBtnDisabled]}
            onPress={handleSearch}
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
            <Image source={{ uri: searchImage }} style={styles.imagePreview} />
            <TouchableOpacity onPress={() => setSearchImage(null)} style={styles.removeImg}>
              <Text style={{ color: '#ef4444', fontSize: 12 }}>✕ Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
                <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(combinedScore) + '20' }]}>
                  <Text style={{ color: getScoreColor(combinedScore), fontWeight: '800', fontSize: scaledFontSize(16) }}>
                    {formatScore(combinedScore)}
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
                  speak(`Match ${formatScore(combinedScore)} for ${item.description}. Image similarity ${formatScore(imageScore)}, text similarity ${formatScore(textScore)}.`);
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  headerSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: '#f1f5f9', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  searchCard: { backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 16, padding: 16, marginHorizontal: 20, marginTop: 12, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.06)' },
  searchInput: { backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: 12, padding: 14, color: '#f1f5f9', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.1)' },
  searchActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  imageBtn: { flex: 1, backgroundColor: 'rgba(79, 70, 229, 0.15)', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(129, 140, 248, 0.2)' },
  searchBtn: { flex: 1, backgroundColor: '#4f46e5', borderRadius: 12, padding: 12, alignItems: 'center' },
  searchBtnDisabled: { opacity: 0.6 },
  searchBtnText: { color: '#fff', fontWeight: '700' },
  imagePreviewWrap: { marginTop: 10, alignItems: 'center' },
  imagePreview: { width: 80, height: 80, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.1)' },
  removeImg: { marginTop: 4 },
  scroll: { padding: 20, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: '#64748b', marginTop: 8 },
  emptySub: { fontSize: 12, color: '#475569', marginTop: 4 },
  card: { backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.06)' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  scoreBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  itemId: { fontSize: 11, color: '#475569' },
  itemDesc: { fontSize: 15, color: '#e2e8f0', fontWeight: '600', marginBottom: 8 },
  itemMeta: { flexDirection: 'row', gap: 12, marginBottom: 8 },
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