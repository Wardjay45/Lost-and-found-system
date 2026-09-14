import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView,
  SafeAreaView, ActivityIndicator, Modal, Alert, Image,
} from 'react-native';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';
import supabase from '../config/supabase';
import VoiceAssistant from '../components/VoiceAssistant';

const statusColors = {
  pending:         { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b', label: 'Pending' },
  active:          { bg: 'rgba(59, 130, 246, 0.1)',  text: '#3b82f6', label: 'Active' },
  potential_match: { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6', label: 'Potential Match' },
  matched:         { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6', label: 'Matched' },
  claimed:         { bg: 'rgba(99, 102, 241, 0.1)', text: '#6366f1', label: 'Claimed' },
  resolved:        { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981', label: 'Resolved' },
  cancelled:       { bg: 'rgba(239, 68, 68, 0.1)',  text: '#ef4444', label: 'Cancelled' },
};

const getMatchScoreColor = (score) => {
  if (score >= 0.7) return '#10b981';
  if (score >= 0.5) return '#f59e0b';
  return '#ef4444';
};

const formatMatchPct = (score) => `${Math.round((score || 0) * 100)}%`;

export default function MyClaimsScreen() {
  const tabs = ['All', 'Lost', 'Found'];
  const [activeTab, setActiveTab] = useState('All');
  const { speak, accessibilityStyles, scaledFontSize } = useAccessibility();
  const { user, token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [loadingMatch, setLoadingMatch] = useState(false);

  const HC = accessibilityStyles;

  const fetchMatchData = async (item) => {
    setLoadingMatch(true);
    setMatchData(null);
    try {
      // Look up match data from the matches table directly
      const matchQuery = item.type === 'lost'
        ? supabase.from('matches').select('*').eq('lost_item_id', item.id).limit(1)
        : supabase.from('matches').select('*').eq('found_item_id', item.id).limit(1);
      const { data: matches } = await matchQuery;
      if (matches && matches.length > 0) {
        const match = matches[0];
        // Fetch the matched item details
        if (item.type === 'lost' && match.found_item_id) {
          const { data: foundItem } = await supabase.from('found_items').select('*').eq('id', match.found_item_id).single();
          setMatchData({ ...match, score: (match.confidence || 0) / 100, found_item: foundItem ? { description: foundItem.description, location: foundItem.location_found, image: foundItem.image } : null });
        } else if (item.type === 'found' && match.lost_item_id) {
          const { data: lostItem } = await supabase.from('lost_items').select('*').eq('id', match.lost_item_id).single();
          setMatchData({ ...match, score: (match.confidence || 0) / 100, lost_item: lostItem ? { description: lostItem.description, location: lostItem.location_lost, image: lostItem.image } : null });
        }
      }
    } catch {} finally {
      setLoadingMatch(false);
    }
  };

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: lostData }, { data: foundData }] = await Promise.all([
        supabase.from('lost_items').select('*'),
        supabase.from('found_items').select('*'),
      ]);

      const uid = String(user?.id);

      const myLost = (lostData || [])
        .filter(item => String(item.reporter_id) === uid)
        .map(item => ({ ...item, type: 'lost' }));

      const myFound = (foundData || [])
        .filter(item => String(item.finder_id) === uid)
        .map(item => ({ ...item, type: 'found' }));

      const merged = [...myLost, ...myFound].sort(
        (a, b) => new Date(b.date_reported || b.date_found || b.created_at) -
                 new Date(a.date_reported || a.date_found || a.created_at)
      );
      setItems(merged);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const openCancelModal = (item) => {
    setCancelTarget(item);
    setCancelReason('');
    setCancelModalVisible(true);
  };

  const doCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) {
      Alert.alert('Reason required', 'Please provide a reason for cancelling this report.');
      return;
    }
    setCancelling(true);
    try {
      const table = cancelTarget.type === 'lost' ? 'lost_items' : 'found_items';
      const { error: updateError } = await supabase
        .from(table)
        .update({ status: 'cancelled', cancel_reason: cancelReason.trim() })
        .eq('id', cancelTarget.id);

      if (!updateError) {
        speak('Report cancelled');
        setCancelModalVisible(false);
        setCancelTarget(null);
        loadItems();
      } else {
        Alert.alert('Error', updateError.message || 'Failed to cancel report');
      }
    } catch (err) {
      Alert.alert('Error', 'Could not connect to server');
    } finally {
      setCancelling(false);
    }
  };

  const canCancel = (item) =>
    !['resolved', 'claimed', 'cancelled'].includes(item.status);

  const filtered = activeTab === 'All'
    ? items
    : items.filter(i => i.type === activeTab.toLowerCase());

  const fmtDate = (d) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' }); }
    catch { return ''; }
  };

  return (
    <SafeAreaView style={[styles.container, HC.container]}>
      <View style={styles.headerSection}>
        <Text style={[styles.title, HC.text, { fontSize: scaledFontSize(24) }]}>My Reports</Text>
        <Text style={[styles.subtitle, HC.textMuted, { fontSize: scaledFontSize(14) }]}>
          Track your lost and found reports
        </Text>
        <VoiceAssistant text={`My reports. ${filtered.length} ${activeTab.toLowerCase()} reports found.`} />
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive, HC.touch]}
            onPress={() => { setActiveTab(tab); speak(`Showing ${tab.toLowerCase()} reports`); }}
          >
            <Text style={[styles.tabText, { fontSize: scaledFontSize(14) }, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.tab, styles.refreshTab, HC.touch]} onPress={loadItems}>
          <Text style={{ fontSize: scaledFontSize(14) }}>🔄</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator color="#818cf8" size="large" />
            <Text style={[styles.emptyText, HC.textMuted, { fontSize: scaledFontSize(15), marginTop: 12 }]}>Loading reports...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={[styles.emptyText, HC.textMuted, { fontSize: scaledFontSize(16) }]}>
              {activeTab === 'All' ? 'No reports yet' : `No ${activeTab.toLowerCase()} reports`}
            </Text>
          </View>
        ) : (
          filtered.map((item) => {
            const c = statusColors[item.status] || statusColors.pending;
            const showCancel = canCancel(item);
            return (
              <TouchableOpacity
                key={`${item.type}-${item.id}`}
                style={[styles.card, HC.card, HC.touch]}
                activeOpacity={0.7}
                onPress={() => {
                  setDetailItem(item);
                  if (item.status === 'potential_match') fetchMatchData(item);
                  else setMatchData(null);
                  setDetailModalVisible(true);
                }}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.typeBadge, { backgroundColor: item.type === 'lost' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' }]}>
                    <Text style={{ fontSize: scaledFontSize(18) }}>{item.type === 'lost' ? '🔍' : '📦'}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardTitle, HC.text, { fontSize: scaledFontSize(15) }]} numberOfLines={2}>
                      {item.description}
                    </Text>
                    <Text style={[styles.cardMeta, HC.textMuted, { fontSize: scaledFontSize(12) }]}>
                      {fmtDate(item.date_reported || item.date_found)} · {item.location_lost || item.location_found}
                    </Text>
                    {item.category_name && (
                      <Text style={[styles.cardCategory, { fontSize: scaledFontSize(11) }]}>
                        🏷️ {item.category_name}
                      </Text>
                    )}
                    {item.cancel_reason && (
                      <Text style={[styles.cancelReason, { fontSize: scaledFontSize(11) }]}>
                        ❌ Reason: {item.cancel_reason}
                      </Text>
                    )}
                  </View>
                  <View style={styles.cardRight}>
                    <View style={[styles.statusBadge, { backgroundColor: c.bg }]}>
                      <View style={[styles.dot, { backgroundColor: c.text }]} />
                      <Text style={[styles.statusText, { color: c.text, fontSize: scaledFontSize(12) }]}>
                        {c.label}
                      </Text>
                    </View>
                    {showCancel && (
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={() => openCancelModal(item)}
                      >
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Cancel Reason Modal */}
      <Modal visible={cancelModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: HC.highContrast ? '#1a1a1a' : '#1e293b' }]}>
            <Text style={[styles.modalTitle, HC.text, { fontSize: scaledFontSize(18) }]}>Cancel Report</Text>
            <Text style={[styles.modalSub, HC.textMuted, { fontSize: scaledFontSize(13) }]}>
              Please tell us why you're cancelling this report:
            </Text>
            {cancelTarget && (
              <Text style={[styles.modalItem, HC.textAccent, { fontSize: scaledFontSize(14) }]} numberOfLines={1}>
                {cancelTarget.description}
              </Text>
            )}
            <TextInput
              style={[styles.reasonInput, { fontSize: scaledFontSize(14), color: HC.highContrast ? '#fff' : '#f1f5f9' }]}
              placeholder="e.g. I found my item, wrong report, duplicate..."
              placeholderTextColor="#64748b"
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => setCancelModalVisible(false)}
                disabled={cancelling}
              >
                <Text style={[styles.modalBtnText, { color: '#94a3b8', fontSize: scaledFontSize(14) }]}>Keep Report</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnDanger, cancelling && { opacity: 0.6 }]}
                onPress={doCancel}
                disabled={cancelling}
              >
                <Text style={[styles.modalBtnText, { color: '#fff', fontSize: scaledFontSize(14) }]}>
                  {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={detailModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.detailCard, { backgroundColor: HC.highContrast ? '#1a1a1a' : '#1e293b' }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Header */}
              <View style={styles.detailHeader}>
                <Text style={[styles.detailTitle, HC.text, { fontSize: scaledFontSize(20) }]}>
                  {detailItem?.type === 'lost' ? 'Lost Item Report' : 'Found Item Report'}
                </Text>
                <TouchableOpacity
                  onPress={() => setDetailModalVisible(false)}
                  style={styles.detailCloseBtn}
                >
                  <Text style={{ fontSize: scaledFontSize(22), color: '#94a3b8' }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Image */}
              {detailItem?.image || detailItem?.image_url ? (
                <Image
                  source={{ uri: detailItem.image || detailItem.image_url }}
                  style={styles.detailImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.detailImagePlaceholder, { backgroundColor: detailItem?.type === 'lost' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)' }]}>
                  <Text style={{ fontSize: scaledFontSize(48) }}>{detailItem?.type === 'lost' ? '🔍' : '📦'}</Text>
                </View>
              )}

              {/* Info fields */}
              {detailItem && (
                <View style={styles.detailFields}>
                  <View style={styles.detailField}>
                    <Text style={[styles.detailLabel, HC.textMuted, { fontSize: scaledFontSize(12) }]}>Status</Text>
                    {(() => {
                      const dc = statusColors[detailItem.status] || statusColors.pending;
                      return (
                        <View style={[styles.statusBadge, { backgroundColor: dc.bg, alignSelf: 'flex-start' }]}>
                          <View style={[styles.dot, { backgroundColor: dc.text }]} />
                          <Text style={[styles.statusText, { color: dc.text, fontSize: scaledFontSize(12) }]}>{dc.label}</Text>
                        </View>
                      );
                    })()}
                  </View>

                  <View style={styles.detailField}>
                    <Text style={[styles.detailLabel, HC.textMuted, { fontSize: scaledFontSize(12) }]}>Description</Text>
                    <Text style={[styles.detailValue, HC.text, { fontSize: scaledFontSize(15) }]}>
                      {detailItem.description || 'No description'}
                    </Text>
                  </View>

                  {detailItem.category_name && (
                    <View style={styles.detailField}>
                      <Text style={[styles.detailLabel, HC.textMuted, { fontSize: scaledFontSize(12) }]}>Category</Text>
                      <Text style={[styles.detailValue, HC.text, { fontSize: scaledFontSize(15) }]}>
                        🏷️ {detailItem.category_name}
                      </Text>
                    </View>
                  )}

                  <View style={styles.detailField}>
                    <Text style={[styles.detailLabel, HC.textMuted, { fontSize: scaledFontSize(12) }]}>
                      {detailItem.type === 'lost' ? 'Location Lost' : 'Location Found'}
                    </Text>
                    <Text style={[styles.detailValue, HC.text, { fontSize: scaledFontSize(15) }]}>
                      {detailItem.location_lost || detailItem.location_found || 'Unknown'}
                    </Text>
                  </View>

                  {detailItem.type === 'found' && detailItem.current_location && (
                    <View style={styles.detailField}>
                      <Text style={[styles.detailLabel, HC.textMuted, { fontSize: scaledFontSize(12) }]}>Currently At</Text>
                      <Text style={[styles.detailValue, HC.text, { fontSize: scaledFontSize(15) }]}>
                        {detailItem.current_location}
                      </Text>
                    </View>
                  )}

                  <View style={styles.detailField}>
                    <Text style={[styles.detailLabel, HC.textMuted, { fontSize: scaledFontSize(12) }]}>
                      {detailItem.type === 'lost' ? 'Date Reported' : 'Date Found'}
                    </Text>
                    <Text style={[styles.detailValue, HC.text, { fontSize: scaledFontSize(15) }]}>
                      {fmtDate(detailItem.date_reported || detailItem.date_found || detailItem.created_at)}
                    </Text>
                  </View>

                  {detailItem.item_id && (
                    <View style={styles.detailField}>
                      <Text style={[styles.detailLabel, HC.textMuted, { fontSize: scaledFontSize(12) }]}>Item ID</Text>
                      <Text style={[styles.detailValue, HC.textAccent, { fontSize: scaledFontSize(14), fontFamily: 'monospace' }]}>
                        {detailItem.item_id}
                      </Text>
                    </View>
                  )}

                  {(detailItem.reporter_name || detailItem.finder_name) && (
                    <View style={styles.detailField}>
                      <Text style={[styles.detailLabel, HC.textMuted, { fontSize: scaledFontSize(12) }]}>
                        {detailItem.type === 'lost' ? 'Reporter' : 'Finder'}
                      </Text>
                      <Text style={[styles.detailValue, HC.text, { fontSize: scaledFontSize(15) }]}>
                        {detailItem.reporter_name || detailItem.finder_name}
                      </Text>
                    </View>
                  )}

                  {detailItem.condition && (
                    <View style={styles.detailField}>
                      <Text style={[styles.detailLabel, HC.textMuted, { fontSize: scaledFontSize(12) }]}>Condition</Text>
                      <Text style={[styles.detailValue, HC.text, { fontSize: scaledFontSize(15) }]}>
                        {detailItem.condition}
                      </Text>
                    </View>
                  )}

                  {detailItem.cancel_reason && (
                    <View style={styles.detailField}>
                      <Text style={[styles.detailLabel, HC.textMuted, { fontSize: scaledFontSize(12) }]}>Cancel Reason</Text>
                      <Text style={[styles.detailValue, { color: '#ef4444', fontSize: scaledFontSize(14), fontStyle: 'italic' }]}>
                        {detailItem.cancel_reason}
                      </Text>
                    </View>
                  )}

                  {/* Potential Match Section */}
                  {detailItem.status === 'potential_match' && loadingMatch && (
                    <View style={styles.matchLoading}>
                      <ActivityIndicator color="#8b5cf6" size="small" />
                      <Text style={[HC.textMuted, { fontSize: scaledFontSize(12), marginTop: 8 }]}>Loading match details...</Text>
                    </View>
                  )}

                  {detailItem.status === 'potential_match' && matchData && (
                    <View style={styles.matchSection}>
                      <View style={styles.matchHeader}>
                        <Text style={styles.matchDivider}>━━━━━━━━━━━━━━━</Text>
                        <Text style={[styles.matchTitle, { color: '#8b5cf6', fontSize: scaledFontSize(15) }]}>🔗 Potential Match</Text>
                      </View>

                      <View style={[styles.matchScoreCard]}>
                        <View style={styles.matchScoreRow}>
                          <Text style={[HC.textMuted, { fontSize: scaledFontSize(12) }]}>Combined</Text>
                          <Text style={{ color: getMatchScoreColor(matchData.score), fontWeight: '800', fontSize: scaledFontSize(13) }}>
                            {formatMatchPct(matchData.score)}
                          </Text>
                        </View>
                        <View style={styles.matchBarBg}>
                          <View style={[styles.matchBarFill, { width: `${Math.min(100, (matchData.score || 0) * 100)}%`, backgroundColor: getMatchScoreColor(matchData.score) }]} />
                        </View>

                        <View style={styles.matchScoreRow}>
                          <Text style={[HC.textMuted, { fontSize: scaledFontSize(12) }]}>🖼️ Image</Text>
                          <Text style={{ color: getMatchScoreColor(matchData.image_score || 0), fontWeight: '800', fontSize: scaledFontSize(13) }}>
                            {formatMatchPct(matchData.image_score)}
                          </Text>
                        </View>
                        <View style={styles.matchBarBg}>
                          <View style={[styles.matchBarFill, { width: `${Math.min(100, (matchData.image_score || 0) * 100)}%`, backgroundColor: getMatchScoreColor(matchData.image_score || 0) }]} />
                        </View>

                        <View style={styles.matchScoreRow}>
                          <Text style={[HC.textMuted, { fontSize: scaledFontSize(12) }]}>📝 Text</Text>
                          <Text style={{ color: getMatchScoreColor(matchData.text_score || 0), fontWeight: '800', fontSize: scaledFontSize(13) }}>
                            {formatMatchPct(matchData.text_score)}
                          </Text>
                        </View>
                        <View style={styles.matchBarBg}>
                          <View style={[styles.matchBarFill, { width: `${Math.min(100, (matchData.text_score || 0) * 100)}%`, backgroundColor: getMatchScoreColor(matchData.text_score || 0) }]} />
                        </View>
                      </View>

                      {/* Matched other item */}
                      {matchData.lost_item && detailItem.type === 'found' && (
                        <View style={[styles.matchItemCard, { backgroundColor: 'rgba(239, 68, 68, 0.06)', borderColor: 'rgba(239, 68, 68, 0.15)' }]}>
                          <Text style={{ fontSize: scaledFontSize(12), color: '#ef4444', fontWeight: '700', marginBottom: 4 }}>🔍 Matched Lost Item</Text>
                          <Text style={[HC.text, { fontSize: scaledFontSize(14), fontWeight: '600' }]}>{matchData.lost_item.description}</Text>
                          <Text style={[HC.textMuted, { fontSize: scaledFontSize(12), marginTop: 2 }]}>📍 {matchData.lost_item.location}</Text>
                          {matchData.lost_item.image && (
                            <Image source={{ uri: matchData.lost_item.image }} style={styles.matchItemImage} resizeMode="cover" />
                          )}
                        </View>
                      )}
                      {matchData.found_item && detailItem.type === 'lost' && (
                        <View style={[styles.matchItemCard, { backgroundColor: 'rgba(16, 185, 129, 0.06)', borderColor: 'rgba(16, 185, 129, 0.15)' }]}>
                          <Text style={{ fontSize: scaledFontSize(12), color: '#10b981', fontWeight: '700', marginBottom: 4 }}>📦 Matched Found Item</Text>
                          <Text style={[HC.text, { fontSize: scaledFontSize(14), fontWeight: '600' }]}>{matchData.found_item.description}</Text>
                          <Text style={[HC.textMuted, { fontSize: scaledFontSize(12), marginTop: 2 }]}>📍 {matchData.found_item.location}</Text>
                          {matchData.found_item.image && (
                            <Image source={{ uri: matchData.found_item.image }} style={styles.matchItemImage} resizeMode="cover" />
                          )}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
            {/* Close button at bottom */}
            <TouchableOpacity
              style={styles.detailBottomBtn}
              onPress={() => setDetailModalVisible(false)}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: scaledFontSize(15) }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  headerSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: '#f1f5f9', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  tabRow: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 16, marginBottom: 8, gap: 8 },
  tab: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(30, 41, 59, 0.6)' },
  tabActive: { backgroundColor: '#4f46e5' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  tabTextActive: { color: '#fff' },
  refreshTab: { paddingHorizontal: 12, backgroundColor: 'rgba(30, 41, 59, 0.3)' },
  scroll: { padding: 20, paddingTop: 8, paddingBottom: 100 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, color: '#64748b', marginTop: 12, fontWeight: '500' },
  card: { backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.06)' },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  typeBadge: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },
  cardMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  cardCategory: { fontSize: 11, color: '#818cf8', marginTop: 2 },
  cancelReason: { fontSize: 11, color: '#ef4444', marginTop: 3, fontStyle: 'italic' },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText: { fontSize: 12, fontWeight: '600' },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  cancelBtnText: { color: '#f87171', fontSize: 11, fontWeight: '700' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 380, borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#f1f5f9', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#94a3b8', marginBottom: 12 },
  modalItem: { fontSize: 14, color: '#818cf8', fontWeight: '600', marginBottom: 12, padding: 10, backgroundColor: 'rgba(79,70,229,0.08)', borderRadius: 10 },
  reasonInput: { borderWidth: 1, borderColor: 'rgba(148,163,184,0.2)', borderRadius: 12, padding: 12, fontSize: 14, color: '#f1f5f9', backgroundColor: 'rgba(15,23,42,0.5)', minHeight: 80, textAlignVertical: 'top', marginBottom: 16 },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  modalBtnSecondary: { backgroundColor: 'rgba(148,163,184,0.1)' },
  modalBtnDanger: { backgroundColor: '#ef4444' },
  modalBtnText: { fontSize: 14, fontWeight: '600' },
  // Detail Modal
  detailCard: { width: '100%', maxWidth: 420, maxHeight: '85%', borderRadius: 20, padding: 20 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  detailTitle: { fontSize: 20, fontWeight: '700', color: '#f1f5f9' },
  detailCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(148,163,184,0.1)', justifyContent: 'center', alignItems: 'center' },
  detailImage: { width: '100%', height: 220, borderRadius: 14, marginBottom: 16, backgroundColor: 'rgba(30,41,59,0.5)' },
  detailImagePlaceholder: { width: '100%', height: 160, borderRadius: 14, marginBottom: 16, justifyContent: 'center', alignItems: 'center' },
  detailFields: { gap: 14 },
  detailField: {},
  detailLabel: { fontSize: 12, color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  detailValue: { fontSize: 15, color: '#f1f5f9', lineHeight: 22 },
  detailBottomBtn: { marginTop: 16, backgroundColor: '#4f46e5', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  // Match section
  matchSection: { marginTop: 8 },
  matchHeader: { alignItems: 'center', marginBottom: 10 },
  matchDivider: { color: 'rgba(139, 92, 246, 0.3)', fontSize: 12, marginBottom: 4 },
  matchTitle: { fontSize: 15, fontWeight: '700', color: '#8b5cf6' },
  matchScoreCard: {
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
  },
  matchScoreRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3, marginTop: 6 },
  matchBarBg: { width: '100%', height: 5, backgroundColor: 'rgba(148, 163, 184, 0.1)', borderRadius: 3, marginBottom: 2 },
  matchBarFill: { height: 5, borderRadius: 3 },
  matchItemCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  matchItemImage: { width: '100%', height: 140, borderRadius: 10, marginTop: 8 },
  matchLoading: { alignItems: 'center', paddingVertical: 16 },
});