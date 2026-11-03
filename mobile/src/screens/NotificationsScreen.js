import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { TouchableOpacity } from '../components/SpeechControls';
import { useAccessibility, useThemedStyles } from '../context/AccessibilityContext';
import { useMessageBadge } from '../context/MessageBadgeContext';

export default function NotificationsScreen({ navigation }) {
  const styles = useThemedStyles(baseStyles);
  const { accessibilityStyles: HC, scaledFontSize } = useAccessibility();
  const { messages, unreadCount, loading, connected } = useMessageBadge();
  const replies = messages.filter(message => message.sender === 'admin').slice(-10).reverse();
  const openMessages = () => navigation.navigate('Main', { screen: 'Messages' });
  return <SafeAreaView style={[styles.container, HC.container]}>
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={[styles.title, HC.text, { fontSize: scaledFontSize(24) }]}>Updates</Text>
      <Text style={[HC.textMuted, { fontSize: scaledFontSize(14) }]}>{unreadCount} unread office {unreadCount === 1 ? 'reply' : 'replies'}</Text>
      {loading && <ActivityIndicator accessibilityLabel="Loading updates" />}
      {!connected && !loading && <Text accessibilityRole="alert" style={[HC.textMuted, { fontSize: scaledFontSize(14) }]}>Unable to sync updates. Reconnecting automatically.</Text>}
      {replies.map(message => <TouchableOpacity key={message.id} style={[styles.card, HC.card, HC.touch]} onPress={openMessages} accessibilityLabel={`Open office reply: ${message.text}`}>
        <Text style={[HC.text, { fontSize: scaledFontSize(15) }]}>{message.text}</Text>
      </TouchableOpacity>)}
      {!loading && connected && replies.length === 0 && <Text style={[HC.textMuted, { fontSize: scaledFontSize(15) }]}>No office replies yet.</Text>}
      <TouchableOpacity style={[styles.card, HC.card, HC.touch]} onPress={openMessages}><Text style={[HC.textAccent, { fontSize: scaledFontSize(16) }]}>Open messages</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.card, HC.card, HC.touch]} onPress={() => navigation.navigate('Main', { screen: 'Claims' })}><Text style={[HC.textAccent, { fontSize: scaledFontSize(16) }]}>View report and match updates</Text></TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}
const baseStyles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#0f172a' }, scroll: { padding: 24, paddingBottom: 48, gap: 18 }, title: { fontWeight: '800', color: '#f1f5f9' }, card: { padding: 18, borderRadius: 14 } });
