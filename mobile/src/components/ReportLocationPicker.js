import { useLiveRefresh } from '../context/LiveDataContext';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { TouchableOpacity } from './SpeechControls';
import FormIcon from './FormIcon';
import { useAccessibility, useThemedStyles } from '../context/AccessibilityContext';
import supabase from '../config/supabase';
import { loadReportLocations } from '../services/reporting.mjs';

export function useReportLocations(initialLocation = '') {
  const initialName = typeof initialLocation === 'string' ? initialLocation.trim() : '';
  const [location, setLocation] = useState(initialName);
  const [locations, setLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState('');
  const request = useRef(0);

  useEffect(() => { setLocation(initialName); }, [initialName]);

  const refreshLocations = useCallback(async (background = false) => {
    const current = ++request.current;
    if (!background) setLocationsLoading(true);
    setLocationsError('');
    try {
      const next = await loadReportLocations(supabase);
      if (current !== request.current) return;
      setLocations(next);
      setLocation(selected => next.some(place => place.name === selected) ? selected : '');
    } catch {
      if (current !== request.current) return;
      setLocations([]);
      setLocationsError('Unable to sync locations. Reconnecting automatically.');
    } finally {
      if (current === request.current) setLocationsLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    refreshLocations();
    return () => { request.current++; };
  }, [refreshLocations]));

  useLiveRefresh(() => refreshLocations(true), ['qr_locations']);

  const locationLocked = Boolean(initialName && location === initialName && locations.some(place => place.name === initialName));
  return { location, setLocation, locations, locationsLoading, locationsError, refreshLocations, locationLocked };
}

export default function ReportLocationPicker({ value, locations, loading, error, onChange, disabled, locked }) {
  const styles = useThemedStyles(baseStyles);
  const { accessibilityStyles: HC, scaledFontSize, themeColors } = useAccessibility();
  const [expanded, setExpanded] = useState(false);
  const unavailable = disabled || locked || loading || Boolean(error) || locations.length === 0;

  return (
    <View>
      <View style={styles.refreshRow}>
        <Text style={[styles.hint, HC.textMuted, { fontSize: scaledFontSize(12) }]}>Locations added by your administrator</Text>
        {loading && <ActivityIndicator color={themeColors.accent} size="small" />}
      </View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Select report location"
        accessibilityState={{ disabled: unavailable, expanded: expanded && !unavailable }}
        disabled={unavailable} onPress={() => setExpanded(current => !current)} style={[styles.select, HC.touch]}>
        <FormIcon name={locked ? 'lock' : 'map-pin'} />
        <Text style={[styles.value, value ? HC.text : HC.textMuted, { fontSize: scaledFontSize(15) }]}>
          {value || (loading ? 'Loading locations…' : 'Select location')}
        </Text>
        <FormIcon name={expanded && !unavailable ? 'chevron-up' : 'chevron-down'} size={18} />
      </TouchableOpacity>
      {!!error && <Text accessibilityRole="alert" style={[styles.message, HC.text, { fontSize: scaledFontSize(13) }]}>{error}</Text>}
      {!loading && !error && locations.length === 0 && <Text style={[styles.message, HC.textMuted, { fontSize: scaledFontSize(13) }]}>No active locations yet. New locations will appear automatically when your administrator adds them.</Text>}
      {locked && <Text style={[styles.message, HC.textMuted, { fontSize: scaledFontSize(12) }]}>Location set from the campus QR code. Add exact details below.</Text>}
      {expanded && !unavailable && <ScrollView style={styles.dropdown} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {locations.map(place => (
          <TouchableOpacity key={place.id} accessibilityRole="radio" accessibilityLabel={place.name}
            accessibilityState={{ checked: value === place.name }} style={[styles.option, HC.touch]}
            onPress={() => { onChange(place.name); setExpanded(false); }}>
            <Text style={[styles.value, HC.text, { fontSize: scaledFontSize(15) }]}>{place.name}</Text>
            {value === place.name && <FormIcon name="check" color={themeColors.accent} />}
          </TouchableOpacity>
        ))}
      </ScrollView>}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  refreshRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  hint: { flex: 1, flexShrink: 1, minWidth: 120, color: '#94a3b8', lineHeight: 18 },
  select: { backgroundColor: 'rgba(15, 23, 42, 0.6)', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.12)', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  value: { flex: 1, flexShrink: 1, color: '#f1f5f9' },
  message: { color: '#94a3b8', marginTop: 8, lineHeight: 20 },
  dropdown: { maxHeight: 260, backgroundColor: 'rgba(30, 41, 59, 0.9)', borderRadius: 14, marginTop: 4, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.12)' },
  option: { padding: 16, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(148, 163, 184, 0.12)' },
});
