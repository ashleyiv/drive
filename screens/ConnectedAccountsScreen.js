// driveash/screens/ConnectedAccountsScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
  StatusBar,
  Platform,
} from 'react-native';
import { Feather, Entypo } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { formatPHPretty } from '../lib/phonePH';
import { resolveAvatarUrl } from '../lib/avatar';
import useTheme from '../theme/useTheme';

function displayNameFromProfile(p) {
  const first = String(p?.first_name || '').trim();
  const last = String(p?.last_name || '').trim();
  const full = `${first}${first && last ? ' ' : ''}${last}`.trim();
  return full || String(p?.email || 'Driver');
}

export default function ConnectedAccountsScreen({ onNavigate }) {
  const { theme, isDark, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);

  const [actionOpen, setActionOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const topPad =
    Platform.OS === 'android'
      ? (StatusBar.currentHeight || 0) + 6
      : 18;

  const loadConnectedDrivers = async () => {
    try {
      setLoading(true);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const me = userRes?.user;
      if (!me?.id) {
        setAccounts([]);
        return;
      }

      // 1) Get accepted links where YOU are the target
      const { data: links, error: linkErr } = await supabase
        .from('emergency_contact_requests')
        .select('id, requester_id, target_id, status, created_at')
        .eq('target_id', me.id)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false });

      if (linkErr) throw linkErr;

      const driverIds = Array.from(
        new Set((links || []).map((r) => r.requester_id).filter(Boolean).map(String))
      );

      if (driverIds.length === 0) {
        setAccounts([]);
        return;
      }

      // 2) Fetch profiles for those requester drivers
      const { data: profs, error: profErr } = await supabase
        .from('user_profiles')
        .select('id,email,first_name,last_name,phone,avatar_url')
        .in('id', driverIds);

      if (profErr) throw profErr;

      const profById = {};
      (profs || []).forEach((p) => (profById[String(p.id)] = p));

      // map to display items
      const mapped = driverIds.map((uid) => {
        const p = profById[String(uid)] || null;

        const name = displayNameFromProfile(p);
        const email = String(p?.email || '—');
        const phone = formatPHPretty(p?.phone) || '—';

        const avatarResolved = resolveAvatarUrl(p?.avatar_url);
        const avatarUri = typeof avatarResolved === 'string' ? avatarResolved : null;

        // link id (for disconnect update)
        const linkRow = (links || []).find((l) => String(l.requester_id) === String(uid)) || null;

        return {
          id: String(uid),
          link_id: linkRow?.id ?? null,
          name,
          email,
          phone,
          avatarUri,
        };
      });

      setAccounts(mapped);
    } catch (e) {
      console.log('[ConnectedAccountsScreen] loadConnectedDrivers error:', e);
      Alert.alert('Error', 'Failed to load connected drivers.');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnectedDrivers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openActions = (item) => {
    setSelected(item);
    setActionOpen(true);
  };

  const closeActions = () => {
    setActionOpen(false);
    setSelected(null);
  };

  const disconnectSelected = async () => {
    try {
      if (!selected?.id) return;

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const me = userRes?.user;
      if (!me?.id) return;

      closeActions();

      // ✅ minimal & safe: mark relationship as cancelled
      const { error } = await supabase
        .from('emergency_contact_requests')
        .update({
          status: 'cancelled',
          responded_at: new Date().toISOString(),
        })
        .eq('target_id', me.id)
        .eq('requester_id', selected.id)
        .eq('status', 'accepted');

      if (error) throw error;

      Alert.alert('Disconnected', `${selected.name} has been disconnected.`);
      await loadConnectedDrivers();
    } catch (e) {
      console.log('[ConnectedAccountsScreen] disconnect error:', e);
      Alert.alert('Error', e?.message || 'Failed to disconnect.');
    }
  };

  const renderItem = ({ item }) => {
    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.rowBetween}>
          <View style={styles.row}>
            <View style={[styles.avatar, { backgroundColor: theme.secondary }]}>
              {item.avatarUri ? (
                <Image source={{ uri: item.avatarUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <Feather name="user" size={22} color={theme.primary} />
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.email}
              </Text>
              <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.phone}
              </Text>
            </View>
          </View>

          <Pressable onPress={() => openActions(item)} style={{ padding: 6 }}>
            <Entypo name="dots-three-vertical" size={18} color={theme.subText} />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header (padded down so it won't overlap the clock) */}
      <View style={[styles.header, { backgroundColor: theme.primary, paddingTop: topPad }]}>
        <Pressable
          onPress={() => onNavigate?.('ec-settings')}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Connected Drivers</Text>
          <Text style={styles.headerSubtitle}>Drivers who added you as emergency contact</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ paddingTop: 30, alignItems: 'center' }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10, color: theme.textSecondary, fontWeight: '700' }}>Loading…</Text>
        </View>
      ) : accounts.length === 0 ? (
        <View style={{ paddingTop: 34, alignItems: 'center', paddingHorizontal: 18 }}>
          <Feather name="users" size={38} color={theme.textSecondary} />
          <Text style={{ marginTop: 10, color: theme.textSecondary, fontWeight: '800', textAlign: 'center' }}>
            No connected drivers yet
          </Text>
        </View>
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 110 }} // ✅ bottom space
        />
      )}

      {/* Action modal (simple + functional) */}
      {actionOpen && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Actions</Text>
            <Text style={[styles.modalText, { color: theme.subText }]}>
              {selected?.name || 'Driver'}
            </Text>

            <Pressable
              onPress={() => {
                Alert.alert(
                  'Disconnect?',
                  `Disconnect ${selected?.name || 'this driver'}?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Disconnect', style: 'destructive', onPress: disconnectSelected },
                  ]
                );
              }}
              style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]}
            >
              <Text style={{ color: theme.danger, fontWeight: '900' }}>Disconnect</Text>
            </Pressable>

            <Pressable onPress={closeActions} style={[styles.actionBtn, { backgroundColor: theme.divider }]}>
              <Text style={{ color: theme.text, fontWeight: '800' }}>Close</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2, fontWeight: '700' },

  card: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  name: { fontSize: 14, fontWeight: '900' },
  sub: { fontSize: 12, fontWeight: '700', marginTop: 2 },

  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '900' },
  modalText: { marginTop: 6, fontSize: 13, fontWeight: '700' },

  actionBtn: {
    marginTop: 12,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
