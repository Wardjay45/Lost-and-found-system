import { TouchableOpacity } from '../components/SpeechControls';
import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView, RefreshControl, SafeAreaView, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAccessibility, useThemedStyles } from '../context/AccessibilityContext';
import supabase from '../config/supabase';
import { loadUserReports } from '../services/reporting.mjs';
import VoiceAssistant from '../components/VoiceAssistant';
import FormIcon from '../components/FormIcon';

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
  { key: 'ReportLost', icon: 'search', label: 'I lost something', description: 'Create a report so it can be matched', color: '#4f46e5' },
  { key: 'ReportFound', icon: 'package', label: 'I found something', description: 'Help return an item to its owner', color: '#10b981' },
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
  const styles = useThemedStyles(baseStyles);
  const { user } = useAuth();
  const { speak, ttsEnabled, highContrast, accessibilityStyles, scaledFontSize, themeColors, readableColor } = useAccessibility();
  const [stats, setStats] = useState({ total: 0, active: 0, resolved: 0 });
  const [recentReports, setRecentReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const HC = accessibilityStyles;

  const fetchUserItems = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const { lost, found } = await loadUserReports(supabase, user.id, { summary: true });
      const myLost = lost.map(item => normalizeItem(item, 'lost'));
      const myFound = found.map(item => normalizeItem(item, 'found'));

      const all = [...myLost, ...myFound];

      setStats({
        total: all.length,
        active: all.filter(i => ['pending', 'active', 'potential_match'].includes(i.status)).length,
        resolved: all.filter(i => ['matched', 'claimed', 'resolved'].includes(i.status)).length,
      });

      setRecentReports([...all].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5));
      setFetchError('');
    } catch (err) {
      console.error('Home fetch error:', err);
      setFetchError('Could not load your reports. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUserItems();
    setRefreshing(false);
  }, [fetchUserItems]);

  useFocusEffect(useCallback(() => {
    fetchUserItems();
  }, [fetchUserItems]));

  const { total, active, resolved } = stats;
  const firstName = user?.name?.split(' ')[0] || 'there';
  const greetingText = `Hello ${firstName}. Welcome to Lost and Found. You have ${total} total reports, ${active} active, and ${resolved} matched.`;

  useEffect(() => {
    if (!ttsEnabled || loading) return;
    const timer = setTimeout(() => speak(greetingText), 500);
    return () => clearTimeout(timer);
  }, [ttsEnabled, loading, greetingText, speak]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, HC.container]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#818cf8" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, HC.container]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#818cf8" colors={['#818cf8']} />
        }
      >

        {/* Header */}
        <View style={[styles.header, highContrast && HC.card]}>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, HC.textAccent, { fontSize: scaledFontSize(11) }]}>CAMPUS LOST & FOUND</Text>
            <Text style={[styles.greeting, HC.text, { fontSize: scaledFontSize(24) }]}>
              Hello, {firstName}
            </Text>
            <Text style={[styles.subGreeting, HC.textMuted, { fontSize: scaledFontSize(14) }]}>
              What would you like to do today?
            </Text>
          </View>
          <TouchableOpacity accessibilityLabel="Open profile" onPress={() => navigation.navigate('Profile')} style={[styles.avatar, HC.touch]}>
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
        {!fetchError && <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: highContrast ? '#1a1a1a' : 'rgba(79, 70, 229, 0.1)' }, HC.card]}
            onPress={() => { speak(`Total reports: ${total}`); navigation.navigate('Claims', { filterTab: 'All' }); }}
            activeOpacity={0.7}
          >
            <View style={[styles.statIcon, { backgroundColor: highContrast ? '#333' : 'rgba(79, 70, 229, 0.15)' }]}>
              <FormIcon name="clipboard" size={18} color={themeColors.accent} />
            </View>
            <Text style={[styles.statNumber, { color: themeColors.accent, fontSize: scaledFontSize(22) }]}>{total}</Text>
            <Text style={[styles.statLabel, HC.textMuted, { fontSize: scaledFontSize(12) }]}>Total Reports</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: highContrast ? '#1a1a1a' : 'rgba(245, 158, 11, 0.1)' }, HC.card]}
            onPress={() => { speak(`Active: ${active}`); navigation.navigate('Claims', { filterTab: 'All' }); }}
            activeOpacity={0.7}
          >
            <View style={[styles.statIcon, { backgroundColor: highContrast ? '#333' : 'rgba(245, 158, 11, 0.15)' }]}>
              <FormIcon name="clock" size={18} color={readableColor('#fbbf24')} />
            </View>
            <Text style={[styles.statNumber, { color: readableColor('#fbbf24') }, { fontSize: scaledFontSize(22) }]}>{active}</Text>
            <Text style={[styles.statLabel, HC.textMuted, { fontSize: scaledFontSize(12) }]}>Active</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: highContrast ? '#1a1a1a' : 'rgba(16, 185, 129, 0.1)' }, HC.card]}
            onPress={() => { speak(`Matched: ${resolved}`); navigation.navigate('Claims', { filterTab: 'All' }); }}
            activeOpacity={0.7}
          >
            <View style={[styles.statIcon, { backgroundColor: highContrast ? '#333' : 'rgba(16, 185, 129, 0.15)' }]}>
              <FormIcon name="check-circle" size={18} color={readableColor('#34d399')} />
            </View>
            <Text style={[styles.statNumber, { color: readableColor('#34d399') }, { fontSize: scaledFontSize(22) }]}>{resolved}</Text>
            <Text style={[styles.statLabel, HC.textMuted, { fontSize: scaledFontSize(12) }]}>Matched</Text>
          </TouchableOpacity>
        </View>}

        {/* Quick Actions */}
        <Text style={[styles.sectionTitle, HC.text, { fontSize: scaledFontSize(17) }]}>Report an item</Text>
        <Text style={[styles.sectionHint, HC.textMuted, { fontSize: scaledFontSize(13) }]}>Choose what happened to get started.</Text>
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
                <FormIcon name={action.icon} size={24} color={readableColor(action.color)} />
              </View>
              <Text style={[styles.actionLabel, HC.text, { fontSize: scaledFontSize(14) }]}>{action.label}</Text>
              <Text style={[styles.actionDescription, HC.textMuted, { fontSize: scaledFontSize(12) }]}>{action.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!!fetchError && (
          <View style={styles.errorCard}>
            <Text style={[styles.errorText, HC.text, { fontSize: scaledFontSize(13) }]}>{fetchError}</Text>
            <TouchableOpacity onPress={fetchUserItems} style={[styles.retryButton, HC.touch]} accessibilityRole="button">
              <Text style={[styles.retryText, HC.textAccent, { fontSize: scaledFontSize(13) }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

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
        {recentReports.length > 0 && !fetchError && (
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
                  key={item.type + '-' + (item.id ?? idx)}
                  style={[styles.itemCard, HC.card, HC.touch]}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('Claims')}
                  onLongPress={() => speak(`${item.type} item: ${item.description}. ${new Date(item.date).toLocaleDateString()} at ${item.location}. Status: ${item.status}.`)}
                >
                  <View style={styles.itemTop}>
                    <View style={[styles.itemTypeIcon, { backgroundColor: item.type === 'lost' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' }]}>
                      <FormIcon name={item.type === 'lost' ? 'search' : 'package'} size={18} color={themeColors.accent} />
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, HC.text, { fontSize: scaledFontSize(15) }]} numberOfLines={1}>{item.description}</Text>
                      <Text style={[styles.itemMeta, HC.textMuted, { fontSize: scaledFontSize(12) }]}>{new Date(item.date).toLocaleDateString()} · {item.location}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: c.bg }]}>
                      <View style={[styles.statusDot, { backgroundColor: readableColor(c.text) }]} />
                      <Text style={[styles.statusText, { color: readableColor(c.text) }, { fontSize: scaledFontSize(12) }]}>{statusLabel}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
        {recentReports.length === 0 && !fetchError && (
          <View style={[styles.emptyCard, HC.card]}>
            <Text style={[styles.emptyTitle, HC.text, { fontSize: scaledFontSize(15) }]}>No reports yet</Text>
            <Text style={[styles.emptyDescription, HC.textMuted, { fontSize: scaledFontSize(13) }]}>Your lost and found reports will appear here after you submit one.</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { padding: 20, paddingBottom: 100 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 8, padding: 20, borderRadius: 24, backgroundColor: 'rgba(79, 70, 229, 0.10)', borderWidth: 1, borderColor: 'rgba(129, 140, 248, 0.2)' },
  headerCopy: { flex: 1, paddingRight: 12 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 8 },
  greeting: { fontSize: 24, fontWeight: '800', color: '#f1f5f9', letterSpacing: -0.3 },
  subGreeting: { fontSize: 14, color: '#64748b', marginTop: 4 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(79, 70, 229, 0.3)' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  ttsRow: { flexDirection: 'row', marginBottom: 16 },
  statCard: { flexGrow: 1, flexBasis: 90, borderRadius: 16, padding: 16, alignItems: 'center' },
  statIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statNumber: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, color: '#94a3b8', marginTop: 2, fontWeight: '500' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#f1f5f9', marginBottom: 14 },
  sectionHint: { color: '#94a3b8', marginTop: -8, marginBottom: 14 },
  seeAll: { fontSize: 13, color: '#818cf8', fontWeight: '600' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  actionCard: { flexGrow: 1, flexBasis: 140, minHeight: 150, backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 18, padding: 18, alignItems: 'flex-start', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.12)' },
  actionIconBg: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  actionIcon: { fontSize: 24 },
  actionLabel: { fontSize: 14, fontWeight: '600', color: '#e2e8f0' },
  actionDescription: { fontSize: 12, color: '#94a3b8', marginTop: 5, lineHeight: 17 },
  errorCard: { backgroundColor: 'rgba(239, 68, 68, 0.10)', borderColor: 'rgba(239, 68, 68, 0.4)', borderWidth: 1, padding: 14, borderRadius: 14, marginBottom: 20 },
  errorText: { color: '#fecaca', marginBottom: 8 },
  retryButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  retryText: { color: '#c4b5fd', fontWeight: '700' },
  emptyCard: { backgroundColor: 'rgba(30, 41, 59, 0.6)', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.12)' },
  emptyTitle: { fontWeight: '700', color: '#f1f5f9' },
  emptyDescription: { color: '#94a3b8', marginTop: 5, lineHeight: 19 },
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
