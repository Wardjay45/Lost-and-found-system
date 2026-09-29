import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import supabase from '../config/supabase';
import VoiceAssistant from '../components/VoiceAssistant';

const statusColors = {
  pending:         { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b', label: 'Pending' },
  active:          { bg: 'rgba(59, 130, 246, 0.1)',  text: '#3b82f6', label: 'Active' },
  potential_match: { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6', label: 'Potential Match' },
  matched:         { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6', label: 'Matched' },
  claimed:         { bg: 'rgba(99, 102, 241, 0.1)',  text: '#6366f1', label: 'Claimed' },
  resolved:        { bg: 'rgba(16, 185, 129, 0.1)',  text: '#10b981', label: 'Resolved' },
  cancelled:       { bg: 'rgba(239, 68, 68, 0.1)',   text: '#ef4444', label: 'Cancelled' },
};

const quickActions = [
  { key: 'ReportLost', icon: '🔍', label: 'Report Lost', color: '#4f46e5' },
  { key: 'ReportFound', icon: '📦', label: 'Report Found', color: '#7c3aed' },
  { key: 'ScanQR', icon: '📷', label: 'Scan QR', color: '#06b6d4' },
  { key: 'Claims', icon: '📋', label: 'My Claims', color: '#10b981' },
];

function normalizeItem(item, type) {
  return {
    id: item.id,
    type,
    description: item.description || 'No description',
    date: type === 'lost' ? (item.date_reported || item.created_at) : (item.date_found || item.created_at),
    location: type === 'lost' ? (item.location_lost || 'Unknown') : (item.location_found || 'Unknown'),
    status: item.status || 'pending',
  };
}

export default function HomeScreen({ navigation }) {
  const { user, token } = useAuth();
  const { speak, ttsEnabled, accessibilityStyles, scaledFontSize } = useAccessibility();
  const [stats, setStats] = useState({ total: 0, active: 0, resolved: 0 });
  const [recentReports, setRecentReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const HC = accessibilityStyles;

  const fetchUserItems = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const uid = String(user.id);

      const [{ data: lostData }, { data: foundData }] = await Promise.all([
        supabase.from('lost_items').select('*'),
        supabase.from('found_items').select('*'),
      ]);

      const myLost = (Array.isArray(lostData) ? lostData : [])
        .filter(item => String(item.reporter_id) === uid)
        .map(item => normalizeItem(item, 'lost'));

      const myFound = (Array.isArray(foundData) ? foundData : [])
        .filter(item => String(item.finder_id) === uid)
        .map(item => normalizeItem(item, 'found'));

      const all = [...myLost, ...myFound];

      setStats({
        total: all.length,
        active: all.filter(i => ['pending', 'active', 'potential_match'].includes(i.status)).length,
        resolved: all.filter(i => ['matched', 'claimed', 'resolved'].includes(i.status)).length,
      });

      setRecentReports([...all].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5));
    } catch (err) {
      console.error('Home fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUserItems();
    setRefreshing(false);
  }, [fetchUserItems]);

  useEffect(() => { fetchUserItems(); }, [fetchUserItems]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', fetchUserItems);
    return unsub;
  }, [navigation, fetchUserItems]);

  const { total, active, resolved } = stats;
  const firstName = user?.name?.split(' ')[0] || 'there';
  const greetingText = `Hello ${firstName}. Welcome to Lost and Found. You have ${total} total reports, ${active} active, and ${resolved} matched.`;

  useEffect(() => {
    if (ttsEnabled && !loading) setTimeout(() => speak(greetingText), 500);
  }, [ttsEnabled, loading]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, HC.container]}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#818cf8" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, HC.container]}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" colors={['#818cf8']} />
        }
      >

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, HC.text, { fontSize: scaledFontSize(24) }]}>
              Hello, {firstName} 👋
            </Text>
            <Text style={[styles.subGreeting, HC.textMuted, { fontSize: scaledFontSize(14) }]}>
              What would you like to do today?
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={[styles.avatar, HC.touch]}>
            <Text style={[styles.avatarText, { fontSize: scaledFontSize(20) }]}>
              {firstName.charAt(0) || 'U'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* TTS greeting */}
        <View style={styles.ttsRow}>
          <VoiceAssistant text={greetingText} />
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: HC.highContrast ? '#1a1a1a' : 'rgba(79, 70, 229, 0.1)' }, HC.card]}
            onPress={() => { speak(`Total reports: ${total}`); navigation.navigate('Claims', { filterTab: 'All' }); }}
            activeOpacity={0.7}
          >
            <View style={[styles.statIcon, { backgroundColor: HC.highContrast ? '#333' : 'rgba(79, 70, 229, 0.15)' }]}>
              <Text style={{ fontSize: scaledFontSize(18) }}>📋</Text>
            </View>
            <Text style={[styles.statNumber, { color: '#818cf8', fontSize: scaledFontSize(22) }]}>{total}</Text>
            <Text style={[styles.statLabel, HC.textMuted, { fontSize: scaledFontSize(12) }]}>Total Reports</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: HC.highContrast ? '#1a1a1a' : 'rgba(245, 158, 11, 0.1)' }, HC.card]}
            onPress={() => { speak(`Active: ${active}`); navigation.navigate('Claims', { filterTab: 'All' }); }}
            activeOpacity={0.7}
          >
            <View style={[styles.statIcon, { backgroundColor: HC.highContrast ? '#333' : 'rgba(245, 158, 11, 0.15)' }]}>
              <Text style={{ fontSize: scaledFontSize(18) }}>🟡</Text>
            </View>
            <Text style={[styles.statNumber, { color: HC.highContrast ? '#ffcc00' : '#fbbf24' }, { fontSize: scaledFontSize(22) }]}>{active}</Text>
            <Text style={[styles.statLabel, HC.textMuted, { fontSize: scaledFontSize(12) }]}>Active</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: HC.highContrast ? '#1a1a1a' : 'rgba(16, 185, 129, 0.1)' }, HC.card]}
            onPress={() => { speak(`Matched: ${resolved}`); navigation.navigate('Claims', { filterTab: 'All' }); }}
            activeOpacity={0.7}
          >
            <View style={[styles.statIcon, { backgroundColor: HC.highContrast ? '#333' : 'rgba(16, 185, 129, 0.15)' }]}>
              <Text style={{ fontSize: scaledFontSize(18) }}>✅</Text>
            </View>
            <Text style={[styles.statNumber, { color: HC.highContrast ? '#ffcc00' : '#34d399' }, { fontSize: scaledFontSize(22) }]}>{resolved}</Text>
            <Text style={[styles.statLabel, HC.textMuted, { fontSize: scaledFontSize(12) }]}>Matched</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <Text style={[styles.sectionTitle, HC.text, { fontSize: scaledFontSize(17) }]}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map(action => (
            <TouchableOpacity
              key={action.key}
              style={[styles.actionCard, HC.card, HC.touch]}
              onPress={() => { speak(`Opening ${action.label}`); navigation.navigate(action.key); }}
              onLongPress={() => speak(action.label)}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconBg, { backgroundColor: action.color + '18' }]}>
                <Text style={[styles.actionIcon, { fontSize: scaledFontSize(24) }]}>{action.icon}</Text>
              </View>
              <Text style={[styles.actionLabel, HC.text, { fontSize: scaledFontSize(14) }]}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Accessibility Quick Access */}
        <TouchableOpacity style={[styles.accessCard, HC.card]} onPress={() => navigation.navigate('Accessibility')} activeOpacity={0.7}>
          <View style={styles.accessLeft}>
            <View style={styles.accessIcon}><Text style={{ fontSize: scaledFontSize(20) }}>♿</Text></View>
            <View>
              <Text style={[styles.accessTitle, HC.textAccent, { fontSize: scaledFontSize(15) }]}>Accessibility Features</Text>
              <Text style={[styles.accessDesc, HC.textMuted, { fontSize: scaledFontSize(12) }]}>Visual, hearing & motor impairment support</Text>
            </View>
          </View>
          <Text style={[styles.accessArrow, HC.textMuted]}>›</Text>
        </TouchableOpacity>

        {/* Recent Reports */}
        {recentReports.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, HC.text, { fontSize: scaledFontSize(17) }]}>Recent Reports</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Claims')}>
                <Text style={[styles.seeAll, HC.textAccent, { fontSize: scaledFontSize(13) }]}>See All</Text>
              </TouchableOpacity>
            </View>
            {recentReports.map((item, idx) => {
              const c = statusColors[item.status] || statusColors.pending;
              const statusLabel = c.label || item.status;
              return (
                <TouchableOpacity
                  key={item.id || idx}
                  style={[styles.itemCard, HC.card, HC.touch]}
                  activeOpacity={0.7}
                  onLongPress={() => speak(`${item.type} item: ${item.description}. ${new Date(item.date).toLocaleDateString()} at ${item.location}. Status: ${item.status}.`)}
                >
                  <View style={styles.itemTop}>
                    <View style={[styles.itemTypeIcon, { backgroundColor: item.type === 'lost' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' }]}>
                      <Text style={{ fontSize: scaledFontSize(18) }}>{item.type === 'lost' ? '🔍' : '📦'}</Text>
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, HC.text, { fontSize: scaledFontSize(15) }]} numberOfLines={1}>{item.description}</Text>
                      <Text style={[styles.itemMeta, HC.textMuted, { fontSize: scaledFontSize(12) }]}>{new Date(item.date).toLocaleDateString()} · {item.location}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: c.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: c.text }]} />
                      <Text style={[styles.statusText, { color: c.text }, { fontSize: scaledFontSize(12) }]}>{statusLabel}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 20, paddingBottom: 100 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, marginTop: 8 },
  greeting: { fontSize: 24, fontWeight: '800', color: '#f1f5f9', letterSpacing: -0.3 },
  subGreeting: { fontSize: 14, color: '#64748b', marginTop: 4 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(79, 70, 229, 0.3)' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  ttsRow: { flexDirection: 'row', marginBottom: 16 },
  statCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center' },
  statIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statNumber: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, color: '#94a3b8', marginTop: 2, fontWeight: '500' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#f1f5f9', marginBottom: 14 },
  seeAll: { fontSize: 13, color: '#818cf8', fontWeight: '600' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  actionCard: { width: '47.5%', backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 18, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.06)' },
  actionIconBg: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  actionIcon: { fontSize: 24 },
  actionLabel: { fontSize: 14, fontWeight: '600', color: '#e2e8f0' },
  itemCard: { backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.06)' },
  itemTop: { flexDirection: 'row', alignItems: 'center' },
  itemTypeIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },
  itemMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  accessCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(79, 70, 229, 0.1)', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(79, 70, 229, 0.2)' },
  accessLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  accessIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(79, 70, 229, 0.15)', justifyContent: 'center', alignItems: 'center' },
  accessTitle: { fontSize: 15, fontWeight: '600', color: '#818cf8' },
  accessDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  accessArrow: { fontSize: 22, color: '#475569' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
});