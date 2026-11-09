import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { cancellationActorLabel } from '../../../shared/roles.mjs';
import { useAccessibility } from '../context/AccessibilityContext';
import supabase from '../config/supabase';

export default function ReportCancellation({ report }) {
  const { accessibilityStyles: HC, readableColor, scaledFontSize, themeColors } = useAccessibility();
  const [result, setResult] = useState({ status: 'loading' });
  const table = report.type === 'lost' ? 'lost_items' : 'found_items';
  const id = report.id;

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const { data, error } = await supabase.from(table).select('cancellation_actor')
          .eq('id', id).abortSignal(controller.signal).maybeSingle();
        if (error) throw error;
        if (!controller.signal.aborted) setResult({ status: 'ready', actor: data?.cancellation_actor });
      } catch {
        if (!controller.signal.aborted) setResult({ status: 'unavailable' });
      }
    }
    void load();
    return () => controller.abort();
  }, [table, id]);

  const actor = result.actor;
  const label = result.status === 'loading' ? 'Checking who cancelled…'
    : result.status === 'unavailable' ? 'Could not load who cancelled'
    : cancellationActorLabel(actor?.role);
  return (
    <View style={[styles.panel, { backgroundColor: themeColors.input }, HC.border]}>
      <Text accessibilityLiveRegion="polite" style={[styles.actor, { color: readableColor('#ef4444'), fontSize: scaledFontSize(15) }]}>
        {label}{actor?.name ? ` · ${actor.name}` : ''}
      </Text>
      <Text style={[styles.label, HC.textMuted, { fontSize: scaledFontSize(12) }]}>Cancel reason</Text>
      <Text style={[HC.text, { fontSize: scaledFontSize(14), lineHeight: scaledFontSize(20) }]}>
        {report.cancel_reason || 'No reason recorded.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  actor: { fontWeight: '700', marginBottom: 3 },
  label: { fontWeight: '600' },
});
