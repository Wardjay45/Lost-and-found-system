import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import supabase from '../config/supabase';

const statusColors = {
  pending: { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b', label: 'Pending' },
  active: { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6', label: 'Active' },
  matched: { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6', label: 'Matched' },
  claimed: { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981', label: 'Claimed' },
  resolved: { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981', label: 'Resolved' },
};

// Map a found item API record to a normalized shape
function normalizeItem(item) {
  return {
    id: item.id,
    description: item.description || 'No description',
    category: item.category_name || item.category || 'General',
    location: item.location_found || 'Unknown',
    date: item.date_found || item.created_at,
    status: item.status || 'pending',
    image: item.image_url || null,
    itemId: item.item_id || null,
    finderName: item.finder_name || null,
    finderContact: item.finder_contact || null,
  };
}

export default function BrowseItemsScreen({ navigation }) {
  const { token } = useAuth();
  const { speak, accessibilityStyles, scaledFontSize } = useAccessibility();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [unclaimedDays, setUnclaimedDays] = useState(60);

  const fetchItems = useCallback(async () => {
    try {
      setError(null);

      // Fetch the unclaimed threshold setting
      let days = 60; // default fallback
      try {
        const { data: settingsData } = await supabase.from('settings').select('*').single();
        if (settingsData?.unclaimed_days) {
          days = settingsData.unclaimed_days;
        }
      } catch {} // silently use default if settings table doesn't exist
      setUnclaimedDays(days);

      // Only fetch found items
      const { data: foundData, error: fetchError } = await supabase.from('found_items').select('*');
      if (fetchError) throw fetchError;

      const now = new Date();
      const unclaimedThreshold = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      // Normalize and keep only items older than threshold (true unclaimed)
      const unclaimedItems = (Array.isArray(foundData) ? foundData : [])
        .map((item) => normalizeItem(item))
        .filter((item) => {
          const itemDate = new Date(item.date);
          return itemDate < unclaimedThreshold;
        });

      setItems(unclaimedItems);
    } catch (err) {
      setError('Could not load items. Check your connection.');
      console.error('Fetch items error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchItems();
  };

  // Apply search filter only (no type tabs — everything is found items past threshold)
  let filtered = items;
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (i) =>
        i.description.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        i.location.toLowerCase().includes(q) ||
        (i.itemId && i.itemId.toLowerCase().includes(q))
    );
  }
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  const HC = accessibilityStyles;

  const handleItemPress = (item) => {
    speak(`Selected: ${item.description}. Found in ${item.location}.`);
    navigation.navigate('Verification', { item });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, HC.container]}>
        <View style={styles.headerSection}>
          <Text style={[styles.title, HC.text, { fontSize: scaledFontSize(24) }]}>Unclaimed Items</Text>
          <Text style={[styles.subtitle, HC.textMuted, { fontSize: scaledFontSize(14) }]}>
            Found items older than {unclaimedDays} days
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#818cf8" />
          <Text style={[styles.loadingText, HC.textMuted, { fontSize: scaledFontSize(14) }]}>Loading items...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, HC.container]}>
      <View style={styles.headerSection}>
        <Text style={[styles.title, HC.text, { fontSize: scaledFontSize(24) }]}>Unclaimed Items</Text>
        <Text style={[styles.subtitle, HC.textMuted, { fontSize: scaledFontSize(14) }]}>
          {filtered.length} item{filtered.length !== 1 ? 's' : ''} found {'>'} {unclaimedDays} days ago
        </Text>
      </View>
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.searchInput, { fontSize: scaledFontSize(15) }]}
          placeholder="Search by description, category, location..."
          placeholderTextColor="#64748b"
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" />}
      >
        {error ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>⚠️</Text>
            <Text style={[styles.emptyText, HC.textMuted, { fontSize: scaledFontSize(16) }]}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchItems}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={[styles.emptyText, HC.textMuted, { fontSize: scaledFontSize(16) }]}>
              {search.trim() ? 'No items match your search' : 'No unclaimed items yet'}
            </Text>
            <Text style={[styles.emptyHint, HC.textMuted, { fontSize: scaledFontSize(12) }]}>
              Found items that remain unclaimed for over {unclaimedDays} days appear here
            </Text>
          </View>
        ) : (
          filtered.map((item) => {
            const status = statusColors[item.status] || statusColors.pending;
            const itemDate = new Date(item.date);
            const daysAgo = Math.floor((new Date() - itemDate) / (1000 * 60 * 60 * 24));
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, HC.card, HC.touch]}
                activeOpacity={0.7}
                onPress={() => handleItemPress(item)}
                onLongPress={() =>
                  speak(
                    `Found item: ${item.description}. Category: ${item.category}. Date: ${itemDate.toLocaleDateString()}, ${daysAgo} days ago. Location: ${item.location}. Status: ${status.label}.`
                  )
                }
              >
                <View style={styles.cardTop}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.itemImage} />
                  ) : (
                    <View style={styles.typeBadge}>
                      <Text style={{ fontSize: scaledFontSize(20) }}>📦</Text>
                    </View>
                  )}
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardTitle, HC.text, { fontSize: scaledFontSize(15) }]} numberOfLines={2}>
                      {item.description}
                    </Text>
                    <Text style={[styles.cardMeta, HC.textMuted, { fontSize: scaledFontSize(12) }]}>
                      {itemDate.toLocaleDateString()} ({daysAgo}d ago) · {item.location}
                    </Text>
                    <Text style={[styles.cardCategory, HC.textMuted, { fontSize: scaledFontSize(11) }]}>
                      {item.category}{item.itemId ? ` · ID: ${item.itemId}` : ''}
                    </Text>
                  </View>
                  <View style={styles.cardRight}>
                    <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                      <View style={[styles.dot, { backgroundColor: status.text }]} />
                      <Text
                        style={[styles.statusText, { color: status.text }, { fontSize: scaledFontSize(11) }]}
                      >
                        {status.label}
                      </Text>
                    </View>
                    {item.status !== 'claimed' && item.status !== 'resolved' && (
                      <TouchableOpacity
                        style={styles.claimBtn}
                        onPress={() => handleItemPress(item)}
                      >
                        <Text style={styles.claimBtnText}>Claim</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  headerSection: { paddingHorizontal: 20, paddingTop: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#f1f5f9', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, color: '#64748b', marginTop: 12, fontWeight: '500' },
  searchRow: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 16, gap: 8 },
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: '#f1f5f9',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
  },
  scroll: { padding: 20, paddingBottom: 100 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, color: '#64748b', marginTop: 12, fontWeight: '500', textAlign: 'center' },
  emptyHint: { fontSize: 12, color: '#475569', marginTop: 6, textAlign: 'center' },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#4f46e5',
  },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.06)',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  itemImage: {
    width: 52,
    height: 52,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
  },
  typeBadge: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },
  cardMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  cardCategory: { fontSize: 11, color: '#475569', marginTop: 1 },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText: { fontSize: 12, fontWeight: '600' },
  claimBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#4f46e5',
  },
  claimBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});