import { TextInput, TouchableOpacity } from '../components/SpeechControls';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useAccessibility, useThemedStyles } from '../context/AccessibilityContext';
import { useIsFocused } from '@react-navigation/native';
import { useMessageBadge } from '../context/MessageBadgeContext';
import { useAuth } from '../context/AuthContext';
import supabase from '../config/supabase';
import VoiceAssistant from '../components/VoiceAssistant';

// Tab bar is absolute positioned: bottom 16, height 72
const TAB_BAR_HEIGHT = 72;
const TAB_BAR_BOTTOM = 16;
const TAB_BAR_TOTAL = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + 12; // extra 12 for padding

export default function MessagesScreen() {
  const styles = useThemedStyles(baseStyles);
  const { speak, accessibilityStyles, scaledFontSize, themeColors } = useAccessibility();
  const { user } = useAuth();
  const { messages, conversationId, loading, connected, refresh, markSeen, appActive } = useMessageBadge();
  const focused = useIsFocused();
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [inputHeight, setInputHeight] = useState(44);
  const flatListRef = useRef(null);

  const HC = accessibilityStyles;
  const userName = user?.name || 'Guest';

  useEffect(() => { if (focused && appActive) void refresh(); }, [focused, appActive, refresh]);
  useEffect(() => {
    if (focused && appActive && !loading && connected) markSeen(messages);
  }, [focused, appActive, loading, connected, messages, markSeen]);

  const scrollToEnd = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSend = async () => {
    const trimmed = messageText.trim();
    if (!trimmed || sending) return;

    setSending(true);
    const textToSend = trimmed;
    setMessageText('');
    setInputHeight(44);

    try {
      let convId = conversationId;

      // Create conversation if it doesn't exist
      if (!convId) {
        const { data: newConv, error: convErr } = await supabase
          .from('conversations')
          .insert({ name: userName, avatar: userName.charAt(0) })
          .select()
          .single();

        if (convErr) throw convErr;
        convId = newConv.id;

      }

      // Insert the message
      const { error: msgErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: String(convId),
          sender: 'user',
          text: textToSend,
          time: new Date().toISOString(),
        });

      if (msgErr) throw msgErr;

      await refresh();

      speak(`Sent: ${textToSend}`);
    } catch (err) {
      Alert.alert('Send Failed', err.message || 'Could not send message.');
      setMessageText(textToSend);
    } finally {
      setSending(false);
    }
  };

  const getTime = (time) => {
    if (!time) return '';
    try {
      return new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const uniqueMessages = [...new Map(messages.map(msg => [String(msg.id), msg])).values()];

  const renderMessage = ({ item: msg }) => {
    const isAdminMsg = msg.sender === 'admin';
    return (
      <View style={[styles.messageRow, isAdminMsg ? styles.adminRow : styles.userRow]}>
        {isAdminMsg && (
          <View style={styles.adminAvatar}>
            <Text style={{ color: '#fff', fontSize: scaledFontSize(11), fontWeight: '700' }}>L</Text>
          </View>
        )}
        <View style={[styles.messageBubble, isAdminMsg ? styles.adminBubble : styles.userBubble]}>
          <Text style={[styles.messageText, isAdminMsg ? { color: '#f1f5f9' } : HC.text, { fontSize: scaledFontSize(15) }]}>
            {msg.text}
          </Text>
          <Text style={[styles.messageTime, isAdminMsg ? { color: 'rgba(241, 245, 249, 0.6)' } : HC.textMuted, { fontSize: scaledFontSize(10) }]}>
            {getTime(msg.time)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, HC.container]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Chat Header */}
      <SafeAreaView style={styles.safeTop}>
        <View style={[styles.chatHeader, HC.card]}>
          <View style={styles.chatHeaderCenter}>
            <View style={styles.chatHeaderAvatar}>
              <Text style={{ color: '#fff', fontSize: scaledFontSize(16), fontWeight: '700' }}>L</Text>
            </View>
            <View>
              <Text style={[styles.chatTitle, HC.text, { fontSize: scaledFontSize(16) }]}>Lost & Found Office</Text>
              <Text style={[styles.chatSub, HC.textMuted, { fontSize: scaledFontSize(11) }]}>
                {!connected && !loading ? 'Offline' : `${messages.length} message${messages.length !== 1 ? 's' : ''}`}
              </Text>
            </View>
          </View>
          <TouchableOpacity accessibilityLabel="Refresh messages" onPress={refresh} style={{ padding: 6 }}>
            <Text style={{ fontSize: scaledFontSize(18) }}>🔄</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={uniqueMessages}
        renderItem={renderMessage}
        keyExtractor={msg => String(msg.id)}
        style={styles.messagesContainer}
        contentContainerStyle={messages.length === 0 ? styles.messagesContentEmpty : styles.messagesContent}
        showsVerticalScrollIndicator={false}
        onLayout={scrollToEnd}
        onContentSizeChange={scrollToEnd}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#818cf8" size="large" />
              <Text style={[HC.textMuted, { fontSize: scaledFontSize(14), marginTop: 12 }]}>Loading messages...</Text>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={{ fontSize: scaledFontSize(40), marginBottom: 8 }}>💬</Text>
              <Text style={[HC.textMuted, { fontSize: scaledFontSize(14), fontWeight: '600' }]}>
                No messages yet
              </Text>
              <Text style={[HC.textMuted, { fontSize: scaledFontSize(12), marginTop: 4 }]}>
                Type below to message the Lost & Found Office
              </Text>
            </View>
          )
        }
      />

      {/* Input Bar */}
      <View style={[styles.inputBar, HC.card, { paddingBottom: TAB_BAR_TOTAL }]}>
        <TextInput
          style={[
            styles.input,
            { fontSize: scaledFontSize(15), height: Math.max(44, inputHeight) },
          ]}
          value={messageText}
          onChangeText={setMessageText}
          onContentSizeChange={(e) => {
            const h = e.nativeEvent.contentSize.height;
            setInputHeight(Math.min(120, Math.max(44, h)));
          }}
          placeholder="Type your message..."
          placeholderTextColor={themeColors.muted}
          editable={!sending}
          multiline
          textAlignVertical="center"
          scrollEnabled={false}
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!messageText.trim() || sending) && { opacity: 0.4 }]}
          onPress={handleSend}
          activeOpacity={0.7}
          disabled={!messageText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={{ color: '#fff', fontSize: scaledFontSize(14), fontWeight: '700' }}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  safeTop: { backgroundColor: 'rgba(30, 41, 59, 0.8)' },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.08)',
  },
  chatHeaderCenter: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  chatHeaderAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center' },
  chatTitle: { fontSize: 16, fontWeight: '600', color: '#f1f5f9' },
  chatSub: { fontSize: 11, color: '#64748b' },
  messagesContainer: { flex: 1 },
  messagesContentEmpty: { flexGrow: 1, justifyContent: 'center' },
  messagesContent: { padding: 16, paddingBottom: 8 },
  messageRow: { flexDirection: 'row', marginBottom: 14, alignItems: 'flex-end', gap: 8 },
  adminRow: { justifyContent: 'flex-start' },
  userRow: { justifyContent: 'flex-end' },
  adminAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center' },
  messageBubble: { maxWidth: '72%', borderRadius: 18, padding: 12 },
  adminBubble: { backgroundColor: '#4f46e5', borderBottomLeftRadius: 4 },
  userBubble: { backgroundColor: 'rgba(30, 41, 59, 0.8)', borderBottomRightRadius: 4, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.1)' },
  messageText: { fontSize: 15, lineHeight: 20, color: '#f1f5f9' },
  messageTime: { fontSize: 10, marginTop: 4 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    paddingTop: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.15)',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#f1f5f9',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  sendBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 56,
    alignSelf: 'flex-end',
  },
});