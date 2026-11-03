import React, { useEffect, useRef } from 'react';
import { Animated, Image, Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TouchableOpacity } from './SpeechControls';
import FormIcon from './FormIcon';
import { useAccessibility } from '../context/AccessibilityContext';

export default function ReportSuccessSheet({ visible, type, onDone }) {
  const { themeColors, activeTheme, scaledFontSize, accessibilityStyles: HC, reduceMotion } = useAccessibility();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reveal = useRef(new Animated.Value(0)).current;
  const found = type === 'found';
  const title = found ? 'Found report submitted' : 'Lost report submitted';
  const message = found
    ? 'Bring the item to the Lost & Found Office for verification.'
    : 'Track match updates in My Reports and Messages.';
  const actionColor = activeTheme === 'contrast' ? themeColors.accent : found ? '#047857' : '#4f46e5';

  useEffect(() => {
    reveal.stopAnimation();
    if (!visible) { reveal.setValue(0); return; }
    if (reduceMotion) { reveal.setValue(1); return; }
    reveal.setValue(0);
    const animation = Animated.spring(reveal, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [visible, reduceMotion, reveal]);

  return <Modal transparent visible={visible} animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={onDone}>
    <View style={[styles.backdrop, { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View accessibilityViewIsModal importantForAccessibility="yes" style={[styles.card, {
        backgroundColor: themeColors.surface, borderColor: themeColors.border,
        maxHeight: Math.max(160, height - insets.top - insets.bottom - 32),
      }]}>
        <ScrollView style={styles.scroller} bounces={false} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.brandRow}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" accessible={false} />
            <Text style={[styles.brand, { color: themeColors.muted, fontSize: scaledFontSize(11) }]}>LOST & FOUND</Text>
          </View>
          <View style={styles.headingRow}>
            <Animated.View style={[styles.check, { backgroundColor: themeColors.input, opacity: reveal,
              transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
            }]}>
              <FormIcon name="check" size={26} color={activeTheme === 'contrast' ? themeColors.accent : activeTheme === 'light' ? '#047857' : '#6ee7b7'} />
            </Animated.View>
            <Text accessibilityRole="header" style={[styles.title, { color: themeColors.text, fontSize: scaledFontSize(21) }]}>{title}</Text>
          </View>
          <Text style={[styles.message, { color: themeColors.muted, fontSize: scaledFontSize(15) }]}>{message}</Text>
          <TouchableOpacity accessibilityLabel="Done, return to previous screen" onPress={onDone}
            style={[styles.done, HC.touch, { backgroundColor: actionColor }]}>
            <Text style={[styles.doneText, { color: activeTheme === 'contrast' ? '#000000' : '#ffffff', fontSize: scaledFontSize(16) }]}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.58)', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 16 },
  card: { width: '100%', maxWidth: 440, borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  scroller: { flexGrow: 0, flexShrink: 1 },
  content: { padding: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  logo: { width: 32, height: 32, borderRadius: 8 },
  brand: { flexShrink: 1, fontWeight: '700', letterSpacing: 1.2 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  check: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontWeight: '800' },
  message: { marginTop: 16, marginBottom: 24 },
  done: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  doneText: { fontWeight: '700' },
});
