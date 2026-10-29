import React, { useState, useEffect, useRef } from 'react';
import { TouchableOpacity, TextInput } from './SpeechControls';
import {
  View, Text, StyleSheet, Modal,
  Animated, Dimensions, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert
} from 'react-native';
import { Audio } from 'expo-av';
import { File } from 'expo-file-system/next';
import { useAccessibility, useThemedStyles } from '../context/AccessibilityContext';
import FormIcon from './FormIcon';
import { useAuth } from '../context/AuthContext';
import { initApiUrl } from '../config/api';

const { height } = Dimensions.get('window');
const BARS = 7;

export default function SpeechInputModal({ visible, onClose, onResult, fieldName }) {
  const styles = useThemedStyles(baseStyles);
  const { token } = useAuth();
  const { themeColors, stopSpeaking } = useAccessibility();
  const [phase, setPhase] = useState('listening');
  const [transcript, setTranscript] = useState('');
  const [recording, setRecording] = useState(null);
  const [error, setError] = useState('');

  const isStopping = useRef(false);
  const autoStopTimer = useRef(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const barAnims = useRef(Array.from({ length: BARS }, () => new Animated.Value(0.2))).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    stopSpeaking();
    isStopping.current = false;
    setTranscript('');
    setError('');
    setPhase('listening');
    Animated.timing(fadeIn, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    startPulse();
    startBars();
    startRecording();

    return () => {
      clearAutoStopTimer();
      stopAll();
      fadeIn.setValue(0);
    };
  }, [visible]);

  const clearAutoStopTimer = () => {
    if (autoStopTimer.current) {
      clearTimeout(autoStopTimer.current);
      autoStopTimer.current = null;
    }
  };

  const startRecording = async () => {
    try {
      await stopSpeaking();
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        setPhase('editing');
        setError('Microphone permission denied');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Use a low-bitrate preset optimized for speech (smaller files = faster upload)
      const speechPreset = {
        isMeteringEnabled: false,
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat?.MPEG_4 ?? 2,
          audioEncoder: Audio.AndroidAudioEncoder?.AAC ?? 3,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat?.MPEG4AAC ?? 'aac',
          audioQuality: Audio.IOSAudioQuality?.MEDIUM ?? 64,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 64000,
        },
      };
      const { recording: rec } = await Audio.Recording.createAsync(speechPreset);
      setRecording(rec);

      // Auto-stop after 10 seconds
      autoStopTimer.current = setTimeout(async () => {
        autoStopTimer.current = null;
        if (!isStopping.current) {
          await stopAndTranscribe(rec);
        }
      }, 10000);
    } catch (err) {
      console.warn('Recording error:', err.message);
      setPhase('editing');
      setError('Audio not available. Try keyboard dictation instead.');
    }
  };

  const handleTapToStop = async () => {
    clearAutoStopTimer();
    if (recording && phase === 'listening' && !isStopping.current) {
      await stopAndTranscribe(recording);
    }
  };

  const stopAndTranscribe = async (rec) => {
    if (!rec) return;
    if (isStopping.current) return;
    isStopping.current = true;

    try {
      setPhase('processing');
      stopAnimations();

      // Safe stop — catch "already unloaded" race condition
      try {
        await rec.stopAndUnloadAsync();
      } catch (stopErr) {
        console.warn('Recording already unloaded (safe):', stopErr.message);
      }

      const uri = rec.getURI();
      setRecording(null);

      if (!uri) {
        setPhase('editing');
        setError('Recording failed. Type your input below.');
        return;
      }

      // Send audio to the authenticated server; the provider key stays off the device.
      try {
        const file = new File(uri);
        const base64 = await file.base64();

        const speechUrl = (await initApiUrl()) + '/speech-to-text';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const res = await fetch(speechUrl, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + (token || ''),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ audio: base64 }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        console.log(`🎤 Deepgram responded: ${res.status}`);

        if (res.ok) {
          const result = await res.json();
          const text = result.transcript || '';
          const confidence = result.confidence || 0;

          if (text) {
            console.log(`✅ Transcribed: "${text.substring(0, 80)}" (${(confidence * 100).toFixed(0)}%)`);
            setTranscript(text.trim());
            setPhase('editing');
            setError('');
            return;
          }
          setPhase('editing');
          setError('No speech detected. Try speaking louder or closer to the mic.');
        } else {
          const errText = await res.text().catch(() => 'Unknown error');
          console.warn('Deepgram API error:', res.status, errText);
          setPhase('editing');
          setError(`Transcription failed (${res.status}). Type your input below.`);
        }
      } catch (fetchErr) {
        console.warn('Deepgram call failed:', fetchErr.message);
        setPhase('editing');
        if (fetchErr.name === 'AbortError') {
          setError('Deepgram took too long. Check your internet connection.');
        } else {
          setError(`Speech-to-text error: ${fetchErr.message}\n\nType your input below.`);
        }
      }
    } catch (err) {
      console.error('Recording stop failed:', err.message);
      setPhase('editing');
      setError('Recording stopped. Type your input below.');
    }
  };

  const stopAll = () => {
    stopAnimations();
    clearAutoStopTimer();
    if (recording) {
      if (!isStopping.current) {
        isStopping.current = true;
        recording.stopAndUnloadAsync().catch((e) => {
          console.warn('stopAll cleanup:', e.message);
        });
      }
      setRecording(null);
    }
  };

  const startPulse = () => {
    pulseAnim.setValue(1);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  };

  const startBars = () => {
    barAnims.forEach(a => a.setValue(0.2));
    barAnims.forEach((anim, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 80),
          Animated.timing(anim, { toValue: 0.15 + Math.random() * 0.85, duration: 300 + Math.random() * 300, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.2, duration: 300, useNativeDriver: true }),
        ])
      ).start();
    });
  };

  const stopAnimations = () => {
    pulseAnim.stopAnimation(); pulseAnim.setValue(1);
    barAnims.forEach(a => { a.stopAnimation(); a.setValue(0.2); });
  };

  const handleUse = () => {
    if (transcript.trim()) onResult(transcript.trim());
    handleClose();
  };

  const handleClose = () => {
    stopAll();
    Animated.timing(fadeIn, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => onClose());
  };

  const handleRetry = () => {
    isStopping.current = false;
    clearAutoStopTimer();
    setPhase('listening');
    setTranscript('');
    setError('');
    startPulse();
    startBars();
    startRecording();
  };

  // 🎤 Listening
  if (phase === 'listening') {
    return (
      <Modal transparent visible={visible} animationType="fade" onRequestClose={handleClose}>
        <View style={styles.backdrop}>
          <Animated.View style={[styles.card, { opacity: fadeIn }]}>
            <Text style={styles.title}>Listening...</Text>
            <Text style={styles.field}>{fieldName}</Text>

            <TouchableOpacity accessibilityLabel="Stop recording" speechFeedback={false} style={styles.micArea} onPress={handleTapToStop} activeOpacity={0.9}>
              <View style={styles.waveform}>
                {barAnims.map((anim, i) => (
                  <Animated.View key={i} style={[styles.bar, { transform: [{ scaleY: anim }], opacity: anim }]} />
                ))}
              </View>
              <View style={styles.micContainer}>
                <Animated.View style={[styles.micRing, { transform: [{ scale: pulseAnim }] }]} />
                <View style={styles.micBtn}><FormIcon name="mic" size={28} color="#ffffff" /></View>
              </View>
              <Text style={styles.listeningText}>Recording...</Text>
              <Text style={styles.hint}>Tap to stop & transcribe</Text>
              <Text style={styles.autoHint}>Auto-stops after 10s</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    );
  }

  // 🧠 Processing
  if (phase === 'processing') {
    return (
      <Modal transparent visible={visible} animationType="fade" onRequestClose={handleClose}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>Transcribing...</Text>
            <Text style={styles.field}>{fieldName}</Text>
            <View style={styles.spinner}>
              <ActivityIndicator size="large" color={themeColors.accent} />
              <Text style={styles.procText}>Deepgram Nova-3 AI</Text>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ✏️ Review
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Review Input</Text>
          <Text style={styles.field}>{fieldName}</Text>

          {error ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
                <Text style={styles.retryText}>Retry Recording</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.successText}>Transcribed — edit if needed</Text>
          )}

          <TextInput
            style={styles.input}
            value={transcript}
            onChangeText={setTranscript}
            placeholder="Edit or type here..."
            placeholderTextColor={themeColors.muted}
            multiline
            autoFocus
            textAlignVertical="top"
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelS} onPress={handleClose}>
              <Text style={styles.cancelSText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.useBtn, !transcript.trim() && styles.useBtnDisabled]}
              onPress={handleUse}
              disabled={!transcript.trim()}
            >
              <Text style={styles.useText}>✓ Use This</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function MicButton({ onPress, active }) {
  const styles = useThemedStyles(baseStyles);
  const { themeColors } = useAccessibility();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      scaleAnim.stopAnimation(); scaleAnim.setValue(1);
    }
  }, [active]);

  return (
    <TouchableOpacity accessibilityLabel="Use voice input" speechFeedback={false} onPress={onPress} activeOpacity={0.7} style={styles.micBtnSmall}>
      <Animated.View style={[styles.micBtnInner, active && styles.micBtnActive, { transform: [{ scale: scaleAnim }] }]}>
        <FormIcon name="mic" size={18} color={themeColors.accent} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const baseStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#1e293b', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(148,163,184,0.1)', maxHeight: height * 0.75 },
  title: { fontSize: 20, fontWeight: '800', color: '#f1f5f9', textAlign: 'center' },
  field: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4, fontWeight: '700', textTransform: 'uppercase', marginBottom: 20 },
  micArea: { alignItems: 'center', paddingVertical: 10 },
  waveform: { flexDirection: 'row', alignItems: 'center', height: 50, gap: 5, marginBottom: 20 },
  bar: { width: 5, height: 40, borderRadius: 3, backgroundColor: '#818cf8' },
  micContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 16, width: 88, height: 88 },
  micRing: { position: 'absolute', width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(129,140,248,0.2)' },
  micBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center' },
  listeningText: { fontSize: 18, fontWeight: '700', color: '#818cf8', marginBottom: 4 },
  hint: { fontSize: 14, color: '#64748b', marginBottom: 2 },
  autoHint: { fontSize: 11, color: '#475569', marginBottom: 16 },
  spinner: { alignItems: 'center', paddingVertical: 30 },
  procText: { fontSize: 14, fontWeight: '600', color: '#818cf8', marginTop: 12 },
  successText: { fontSize: 13, color: '#10b981', textAlign: 'center', marginBottom: 10, fontWeight: '600' },
  errorWrap: { alignItems: 'center', marginBottom: 12 },
  errorText: { fontSize: 13, color: '#f87171', fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  retryBtn: { backgroundColor: 'rgba(79,70,229,0.15)', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(129,140,248,0.2)' },
  retryText: { color: '#818cf8', fontSize: 14, fontWeight: '600' },
  input: { backgroundColor: 'rgba(15,23,42,0.6)', borderWidth: 1.5, borderColor: '#4f46e5', borderRadius: 14, padding: 14, fontSize: 16, color: '#f1f5f9', minHeight: 90, textAlignVertical: 'top', marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 12 },
  cancelS: { flex: 1, backgroundColor: 'rgba(30,41,59,0.8)', borderRadius: 14, padding: 15, alignItems: 'center' },
  cancelSText: { color: '#94a3b8', fontSize: 15, fontWeight: '600' },
  useBtn: { flex: 2, backgroundColor: '#4f46e5', borderRadius: 14, padding: 15, alignItems: 'center' },
  useBtnDisabled: { backgroundColor: '#475569' },
  useText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cancelBtn: { backgroundColor: 'rgba(30,41,59,0.8)', borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 0 },
  cancelText: { color: '#94a3b8', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  micBtnSmall: { padding: 4 },
  micBtnInner: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(79,70,229,0.15)', borderWidth: 1, borderColor: 'rgba(129,140,248,0.3)', justifyContent: 'center', alignItems: 'center' },
  micBtnActive: { backgroundColor: 'rgba(239,68,68,0.2)', borderColor: '#ef4444' },
});
