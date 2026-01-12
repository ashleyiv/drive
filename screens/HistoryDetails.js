import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const LEVEL_UI = {
  1: { label: 'LEVEL 1 WARNING', color: '#16A34A', boxTitle: 'CAUTION', boxBg: '#ECFDF5', boxBorder: '#BBF7D0' },
  2: { label: 'LEVEL 2 WARNING', color: '#F59E0B', boxTitle: 'ALERT', boxBg: '#FFFBEB', boxBorder: '#FDE68A' },
  3: { label: 'LEVEL 3 WARNING', color: '#EF4444', boxTitle: 'DANGER', boxBg: '#FEE2E2', boxBorder: '#FCA5A5' },
};

export default function HistoryDetails({ onBack, routeParams }) {
  // Supports BOTH patterns:
  // - routeParams.warningId
  // - routeParams.warning (already passed object)
  const warningId = routeParams?.warningId;
  const passedWarning = routeParams?.warning || null;

  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState(passedWarning);

  useEffect(() => {
    const load = async () => {
      try {
        if (passedWarning) return;
        if (!warningId) return;

        setLoading(true);
        const { data, error } = await supabase
          .from('driver_warnings')
          .select('*')
          .eq('id', warningId)
          .single();

        if (error) throw error;
        setWarning(data);
      } catch (e) {
        console.log('HistoryDetails load error:', e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [warningId, passedWarning]);

  const ui = useMemo(() => {
    const lvl = LEVEL_UI[warning?.level] || LEVEL_UI[1];
    return lvl;
  }, [warning]);

  const detailLocation = warning?.meta?.detail_location || warning?.location_text || '—';
  const topSpeed = warning?.meta?.top_speed_mph;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Feather name="chevron-left" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>History Details</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && !warning ? (
        <View style={{ padding: 20 }}>
          <ActivityIndicator />
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={[styles.levelText, { color: ui.color }]}>{ui.label}</Text>

          <Image
            source={{ uri: warning?.snapshot_url }}
            style={styles.image}
            resizeMode="cover"
          />

          <View style={[styles.box, { backgroundColor: ui.boxBg, borderColor: ui.boxBorder }]}>
            <Text style={[styles.boxTitle, { color: ui.color }]}>{ui.boxTitle}</Text>

            {warning?.level === 3 ? (
              <>
                <Text style={styles.boxLine}>Immediate attention required</Text>
                <Text style={styles.boxLine}>
                  Top Speed: <Text style={styles.boxStrong}>{topSpeed ?? '—'} mph</Text>
                </Text>
                <Text style={styles.boxLine}>
                  Location: <Text style={styles.boxStrong}>{detailLocation}</Text>
                </Text>
              </>
            ) : warning?.level === 2 ? (
              <>
                <Text style={styles.boxLine}>Alarm + voice output triggered (hardware scope)</Text>
                <Text style={styles.boxLine}>
                  Location: <Text style={styles.boxStrong}>{detailLocation}</Text>
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.boxLine}>Snapshot captured + voice output (hardware scope)</Text>
                <Text style={styles.boxLine}>
                  Location: <Text style={styles.boxStrong}>{detailLocation}</Text>
                </Text>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },

  header: {
    backgroundColor: '#1F7CC0',
    paddingTop: 46,
    paddingHorizontal: 12,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '900', flex: 1, textAlign: 'center' },

  card: {
    margin: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },

  levelText: { fontSize: 14, fontWeight: '900', marginBottom: 10 },
  image: { width: '100%', height: 190, borderRadius: 14, backgroundColor: '#E5E7EB' },

  box: {
    marginTop: 12,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  boxTitle: { fontWeight: '900', marginBottom: 6 },
  boxLine: { color: '#111827', fontSize: 12, marginBottom: 4 },
  boxStrong: { fontWeight: '900' },
});
