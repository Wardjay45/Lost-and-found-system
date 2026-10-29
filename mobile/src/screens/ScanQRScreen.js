import { TouchableOpacity } from '../components/SpeechControls';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAccessibility, useThemedStyles } from '../context/AccessibilityContext';
import supabase from '../config/supabase';
import VoiceAssistant from '../components/VoiceAssistant';

export default function ScanQRScreen({ navigation }) {
  const styles = useThemedStyles(baseStyles);
  const { speak, ttsEnabled, accessibilityStyles, scaledFontSize } = useAccessibility();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const HC = accessibilityStyles;

  useEffect(() => {
    if (!ttsEnabled) return;
    const timer = setTimeout(() => speak('Point camera at a QR code to scan.'), 800);
    return () => clearTimeout(timer);
  }, [permission, ttsEnabled, speak]);

  const parseLocation = (rawData) => {
    // Handle deep link URLs like: lostandfound://report?location=AB%20Building&id=2
    try {
      const url = new URL(rawData);
      const location = decodeURIComponent(url.searchParams.get('location') || '');
      const id = url.searchParams.get('id') || '';
      return { location, id };
    } catch {
      // Fallback: try to parse as query string
      try {
        const queryIndex = rawData.indexOf('?');
        if (queryIndex >= 0) {
          const params = new URLSearchParams(rawData.substring(queryIndex));
          const location = decodeURIComponent(params.get('location') || '');
          const id = params.get('id') || '';
          return { location, id };
        }
      } catch {}
      // Raw value as-is
      return { location: rawData.trim(), id: '' };
    }
  };

  const handleBarcodeScanned = ({ data }) => {
    setScanned(true);
    const { location, id } = parseLocation(data);
    const displayLocation = location || data;

    const recordScan = async () => {
      if (id) {
        try {
          const { data: loc } = await supabase.from('qr_locations').select('scan_count').eq('id', id).single();
          await supabase.from('qr_locations').update({
            scan_count: (loc?.scan_count || 0) + 1,
            last_scanned: new Date().toISOString(),
          }).eq('id', id);
        } catch {}
      }
    };

    speak(`QR code scanned. Location: ${displayLocation}`);
    Alert.alert('📍 QR Scanned', `Location: ${displayLocation}`, [
      { text: 'Report Lost', onPress: () => { speak('Opening report lost screen.'); recordScan(); navigation.navigate('ReportLost', { location: displayLocation, qrId: id }); } },
      { text: 'Report Found', onPress: () => { speak('Opening report found screen.'); recordScan(); navigation.navigate('ReportFound', { location: displayLocation, qrId: id }); } },
      { text: 'Scan Again', onPress: () => { setScanned(false); speak('Scanning again.'); } },
    ]);
  };

  if (!permission) {
    return (<SafeAreaView style={[styles.container, HC.container]}><View style={styles.center}><Text style={[styles.loadingText, HC.textMuted, { fontSize: scaledFontSize(16) }]}>Loading camera...</Text></View></SafeAreaView>);
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, HC.container]}>
        <View style={styles.center}>
          <View style={styles.deniedIcon}><Text style={{ fontSize: scaledFontSize(48) }}>📷</Text></View>
          <Text style={[styles.deniedTitle, HC.text, { fontSize: scaledFontSize(20) }]}>Camera Access Needed</Text>
          <Text style={[styles.deniedSub, HC.textMuted, { fontSize: scaledFontSize(14) }]}>Please enable camera permissions in your device settings to scan QR codes.</Text>
          <TouchableOpacity style={[styles.grantBtn, HC.touch]} onPress={requestPermission} activeOpacity={0.7}><Text style={{ color: '#fff', fontSize: scaledFontSize(16), fontWeight: '700' }}>Grant Permission</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, HC.container]}>
      <CameraView style={styles.camera} onBarcodeScanned={scanned ? undefined : handleBarcodeScanned} barcodeScannerSettings={{ barcodeTypes: ['qr'] }}>
        <View style={styles.overlay}>
          <View style={styles.topSection}>
            <Text style={[styles.instruction, { fontSize: scaledFontSize(16) }]}>Point camera at a QR code</Text>
            <View style={styles.ttsIcon}><VoiceAssistant text="Point camera at a QR code to scan it." /></View>
          </View>
          <View style={styles.scanFrameWrapper}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.cornerTL]} /><View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} /><View style={[styles.corner, styles.cornerBR]} />
            </View>
          </View>
          <View style={styles.bottomSection}>
            {scanned && (<TouchableOpacity style={[styles.rescanBtn, HC.touch]} onPress={() => setScanned(false)} activeOpacity={0.7}><Text style={{ color: '#fff', fontSize: scaledFontSize(16), fontWeight: '700' }}>Tap to Scan Again</Text></TouchableOpacity>)}
          </View>
        </View>
      </CameraView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#0f172a' }, loadingText: { fontSize: 16, color: '#64748b' }, deniedIcon: { width: 80, height: 80, borderRadius: 20, backgroundColor: 'rgba(239, 68, 68, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }, deniedTitle: { fontSize: 20, fontWeight: '700', color: '#f1f5f9' }, deniedSub: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 8, lineHeight: 20 }, grantBtn: { marginTop: 24, backgroundColor: '#4f46e5', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 }, camera: { flex: 1 }, overlay: { flex: 1 }, topSection: { alignItems: 'center', paddingTop: 60, paddingBottom: 40 }, ttsIcon: { marginTop: 12, alignItems: 'center' }, instruction: { color: '#fff', fontSize: 16, fontWeight: '600', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 }, scanFrameWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' }, scanFrame: { width: 260, height: 260, justifyContent: 'center', alignItems: 'center' }, corner: { position: 'absolute', width: 30, height: 30, borderColor: '#4f46e5' }, cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 }, cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 }, cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 }, cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 }, bottomSection: { alignItems: 'center', paddingBottom: 60 }, rescanBtn: { marginTop: 20, backgroundColor: '#4f46e5', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
});