// driveash/components/EmergencyContactNotifications.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image, // ✅ add
  Modal,      // ✅ add
  Pressable,  // ✅ add
  ScrollView, // ✅ add
} from 'react-native';

import { MaterialIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getUsersAvatarUrls, resolveAvatarUrl } from '../lib/avatar'; // ✅ add
import BottomNav from './BottomNav';
import { useNotificationBadgeCount } from '../lib/useNotificationBadgeCount';

import useTheme from '../theme/useTheme';
const Button = ({ onPress, children, style, variant }) => {
  const buttonStyle = [styles.button, style, variant === 'outline' ? styles.outlineButton : null];
  return (
    <TouchableOpacity onPress={onPress} style={buttonStyle}>
      {children}
    </TouchableOpacity>
  );
};
function prettyType(monitorType) {
  const t = String(monitorType || '').toLowerCase();
  if (t === 'eye') return 'Eye Warning';
  if (t === 'hand') return 'Hand Warning';
  if (t === 'yawn') return 'Yawn Warning';
  if (t === 'nod') return 'Nod Warning';
  return monitorType ? String(monitorType) : 'Warning';
}

function formatTS(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}
function levelLabel(level) {
  const n = Number(level);
  if (n === 1) return 'Level 1';
  if (n === 2) return 'Level 2';
  if (n === 3) return 'Level 3';
  return 'Level';
}

function levelColor(level) {
  const n = Number(level);
  if (n === 1) return '#16A34A'; // green
  if (n === 2) return '#CA8A04'; // yellow/amber
  if (n === 3) return '#DC2626'; // red
  return '#6B7280'; // gray
}

function reasonsFromWarning(w) {
  // Prefer multi-reason if present
  // supports meta.reasons: ["nod","yawn"] OR meta.reasons_text: "Nod + Yawn"
  const meta = w?.meta || {};
  if (Array.isArray(meta.reasons) && meta.reasons.length > 0) {
    return meta.reasons.map((r) => prettyType(r)).join(' + ');
  }
  if (typeof meta.reasons_text === 'string' && meta.reasons_text.trim()) {
    return meta.reasons_text.trim();
  }
  // fallback: single monitor_type
  return prettyType(w?.monitor_type);
}

function formatSpeedFromMeta(meta) {
  if (!meta) return '—';
  const mph = meta?.top_speed_mph;
  if (mph != null && mph !== '' && !Number.isNaN(Number(mph))) return `${mph} mph`;
  const kph = meta?.top_speed_kph;
  if (kph != null && kph !== '' && !Number.isNaN(Number(kph))) return `${kph} kph`;
  return '—';
}

function displayNameFromProfile(p) {
  const first = String(p?.first_name || '').trim();
  const last = String(p?.last_name || '').trim();
  const full = `${first}${first && last ? ' ' : ''}${last}`.trim();
  return full || String(p?.email || 'Unknown User');
}

export default function EmergencyContactNotifications({ onNavigate }) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
    const { count: notificationCount, reload: reloadBadge } = useNotificationBadgeCount();


  // Keep your existing alert sample (for drowsiness warnings etc.)
  const [alerts] = useState([
    {
      id: 'alert-0',
      type: 'alert',
      message: 'Driver status changed to LEVEL 3 WARNING',
      timestamp: 'Just now',
    },
  ]);

  const [invites, setInvites] = useState([]); // backend invites
  // ✅ Seeded driver warnings (for connected drivers)
  const [warnings, setWarnings] = useState([]);

  // ✅ Warning modal
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [selectedWarning, setSelectedWarning] = useState(null);

 const openWarningModal = async (w) => {
  setSelectedWarning(w);
  setWarningModalOpen(true);

  // ✅ Deduct ping ONLY when big-screen opens (this modal)
  // warningId is your real uuid from driver_warnings
  await markWarningAsRead(w?.warningId);
};

const markWarningAsRead = async (warningId) => {
  try {
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;
    const me = userRes?.user;
    if (!me?.id || !warningId) return;

    // Mark as read for THIS recipient only
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', me.id)
      .eq('type', 'warning')
      .eq('source_table', 'driver_warnings')
      .eq('source_id', warningId)
      .is('read_at', null);

    if (error) throw error;

    // update badge immediately
    await reloadBadge?.();
  } catch (e) {
    console.log('[EC Notifications] markWarningAsRead error:', e);
  }
};

  const closeWarningModal = () => {
    setWarningModalOpen(false);
    setSelectedWarning(null);
  };
  const loadWarnings = async () => {
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const me = userRes?.user;
      if (!me?.id) {
        setWarnings([]);
        return;
      }

      // 1) Get connected drivers (accepted only)
      const { data: links, error: linkErr } = await supabase
        .from('emergency_contact_requests')
        .select('requester_id')
        .eq('target_id', me.id)
        .eq('status', 'accepted');

      if (linkErr) throw linkErr;

      const driverIds = Array.from(
        new Set((links || []).map((r) => r.requester_id).filter(Boolean).map(String))
      );

      if (driverIds.length === 0) {
        setWarnings([]);
        return;
      }

      // 2) Fetch warnings (seeded data shows here)
      const { data: warnRows, error: warnErr } = await supabase
        .from('driver_warnings')
        .select('id, user_id, created_at, level, monitor_type, location_text, snapshot_url, meta')
        .in('user_id', driverIds)
        .order('created_at', { ascending: false })
        .limit(50);

      if (warnErr) throw warnErr;

      // 3) Driver public profiles (name + avatar)
      const { data: profs, error: profErr } = await supabase
        .from('user_profiles_public')
        .select('id,email,first_name,last_name,avatar_url')
        .in('id', driverIds);

      if (profErr) throw profErr;

      const profById = {};
      (profs || []).forEach((p) => (profById[String(p.id)] = p));

      // existing helper you already import
      const avatarMap = driverIds.length > 0 ? await getUsersAvatarUrls(driverIds) : {};

      const mapped = (warnRows || []).map((w) => {
        const did = String(w.user_id);
        const p = profById[did] || null;
        const driverName = displayNameFromProfile(p);

        const driverAvatarUri =
          avatarMap?.[did] ??
          resolveAvatarUrl(p?.avatar_url) ??
          null;

        const location = w?.meta?.detail_location || w?.location_text || '—';
        const speed = formatSpeedFromMeta(w?.meta);

        return {
          id: `warn-${w.id}`,
          type: 'warning',

          driverId: did,
          driverName,
          avatarUri: driverAvatarUri, // ✅ reuse existing item.avatarUri rendering

          warningId: w.id,
          level: w.level ?? null,
          monitor_type: w.monitor_type,
          created_at: w.created_at,
          timestamp: new Date(w.created_at).toLocaleString(),

          snapshot_url: w.snapshot_url || null,
          location,
          speed,
          message: driverName,
          meta: w.meta || {},
        };
      });

      setWarnings(mapped);
    } catch (e) {
      console.log('[EC Notifications] loadWarnings error:', e);
      // don't block invites; just clear warnings
      setWarnings([]);
    }
  };

  const loadInvites = async () => {
    try {
      setLoading(true);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const me = userRes?.user;
      if (!me?.id) {
        setInvites([]);
        return;
      }

      // incoming pending invites
      const { data: rows, error: rowsErr } = await supabase
        .from('emergency_contact_requests')
        .select('id, requester_id, status, created_at, responded_at')
        .eq('target_id', me.id)
        .order('created_at', { ascending: false });

      if (rowsErr) throw rowsErr;

      const requesterIds = Array.from(
        new Set((rows || []).map((r) => r.requester_id).filter(Boolean).map(String))
      );

      let profilesById = {};
      if (requesterIds.length > 0) {
        const { data: profs, error: profErr } = await supabase
          .from('user_profiles_public')
.select('id,email,first_name,last_name,avatar_url')

          .in('id', requesterIds);

        if (profErr) throw profErr;

        (profs || []).forEach((p) => {
          profilesById[String(p.id)] = p;
        });
      }

      // ✅ get avatar public URLs in one go (uses your existing helper)
      const avatarMap = requesterIds.length > 0 ? await getUsersAvatarUrls(requesterIds) : {};

      const mapped = (rows || []).map((r) => {
        const rid = String(r.requester_id || '');
        const requesterProfile = profilesById[rid];
        const requesterName = displayNameFromProfile(requesterProfile);

        const avatarUri =
          avatarMap?.[rid] ??
          resolveAvatarUrl(requesterProfile?.avatar_url) ??
          null;
        const status = String(r.status || '').toLowerCase();

        const message =
          status === 'pending'
            ? `${requesterName} wants to add you as an emergency contact`
            : status === 'accepted'
            ? `✓ You are now an emergency contact for ${requesterName}`
            : status === 'declined'
            ? `You declined ${requesterName}'s request`
            : status === 'cancelled'
            ? `${requesterName} disconnected you as an emergency contact`
            : `${requesterName} request updated (${status})`;

        return {
          id: `invite-${r.id}`,
          requestRowId: r.id,
          requesterId: r.requester_id,
          type: status === 'cancelled' ? 'disconnect' : 'invite',
          status,
          message,
          timestamp: new Date(r.responded_at || r.created_at).toLocaleString(),
          avatarUri,
        };

      });

      setInvites(mapped);
    } catch (e) {
      console.log('[EC Notifications] loadInvites error:', e);
      Alert.alert('Error', e?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

   useEffect(() => {
    loadInvites();
    loadWarnings(); // ✅ add
  }, []);

  useEffect(() => {
    let channel;
    let warningsChannel;


    const sub = async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const me = userRes?.user;
        if (!me?.id) return;

        channel = supabase
          .channel('ec-invites-target')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'emergency_contact_requests',
              filter: `target_id=eq.${me.id}`,
            },
            () => {
              loadInvites();
            }
          )
          .subscribe();

                  warningsChannel = supabase
          .channel('ec-warnings')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'driver_warnings',
            },
            () => {
              loadWarnings();
            }
          )
          .subscribe();

      } catch (e) {
        console.log('[EC Notifications] realtime subscribe error:', e);
      }
    };

    sub();

       return () => {
      if (channel) supabase.removeChannel(channel);
      if (warningsChannel) supabase.removeChannel(warningsChannel);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAccept = async (requestRowId) => {
    try {
      const { error } = await supabase
        .from('emergency_contact_requests')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', requestRowId);

      if (error) throw error;

      await loadInvites();
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to accept invite');
    }
  };

  const handleDecline = async (requestRowId) => {
    try {
      const { error } = await supabase
        .from('emergency_contact_requests')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('id', requestRowId);

      if (error) throw error;

      await loadInvites();
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to decline invite');
    }
  };

  // Combine alerts + invites into one list
  const notifications = useMemo(() => {
    // show invites first, then warnings, then alerts
    return [...invites, ...warnings, ...alerts];
  }, [invites, warnings, alerts]);


  const renderNotification = ({ item }) => {
    const isLevel3 =
      item.type === 'alert' &&
      String(item.message || '').toUpperCase().includes('LEVEL 3');
    // ✅ Warning notification (clickable)
    if (item.type === 'warning') {
     const isSevere = Number(item.level) === 3;
const lvlColor = levelColor(item.level);


      return (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => openWarningModal(item)}
          style={[
            styles.notificationCard,
            { backgroundColor: theme.surface },
            { borderWidth: 1, borderColor: lvlColor },

          ]}
        >
          <View style={styles.notificationContent}>
            <View style={[styles.avatar, isSevere && { backgroundColor: '#FEE2E2' }]}>
              {item?.avatarUri ? (
                <Image source={{ uri: item.avatarUri }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <FontAwesome5
                  name="user"
                  size={20}
                  color={isSevere ? '#DC2626' : '#1E3A8A'}
                />
              )}
            </View>

            <View style={styles.textContent}>
              <View style={styles.warningTitleRow}>
  <Text
    style={[
      styles.message,
      { color: theme.textPrimary },
      isSevere && { fontWeight: '900' },
    ]}
    numberOfLines={1}
  >
    {item.message}
  </Text>

  <View style={[styles.levelPill, { borderColor: levelColor(item.level) }]}>
    <Text style={[styles.levelPillText, { color: levelColor(item.level) }]}>
      {levelLabel(item.level)}
    </Text>
  </View>
</View>

              <Text style={styles.timestamp}>{item.timestamp}</Text>

              <Text style={[styles.metaLine, { color: theme.textSecondary }]} numberOfLines={1}>
                Location: {item.location || '—'}
              </Text>
              <Text style={[styles.metaLine, { color: theme.textSecondary }]} numberOfLines={1}>
                Top speed: {item.speed || '—'}
              </Text>

              <Text style={[styles.tapHint, { color: theme.textSecondary }]}>
                Tap to view snap
              </Text>
            </View>

            <Feather name="chevron-right" size={18} color={theme.subText} />
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <View
        style={[
          styles.notificationCard, { backgroundColor: theme.surface },
          isLevel3 && { borderWidth: 1, borderColor: '#DC2626' },
        ]}
      >
        <View style={styles.notificationContent}>
          <View
            style={[
              styles.avatar,
              isLevel3 && { backgroundColor: '#FEE2E2' },
            ]}
          >
            {/* ✅ If user has avatar, show it. Otherwise keep your icon */}
            {item?.avatarUri ? (
              <Image
                source={{ uri: item.avatarUri }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <FontAwesome5
                name="user"
                size={20}
                color={isLevel3 ? '#DC2626' : '#1E3A8A'}
              />
            )}
          </View>

          <View style={styles.textContent}>
            <Text style={[styles.message, {color: theme.textPrimary }, isLevel3 && { color: '#DC2626', fontWeight: '700' }]}>
              {item.message}
            </Text>
            <Text style={styles.timestamp}>{item.timestamp}</Text>

            {item.type === 'invite' && item.status === 'pending' && (
              <View style={styles.actionButtons}>
                <Button onPress={() => handleAccept(item.requestRowId)} style={[
                  styles.acceptButton,
                  { backgroundColor: theme.primary },
                ]}>
                  <MaterialIcons name="check" size={16} color="white" />
                  <Text style={styles.acceptText}> Accept</Text>
                </Button>

                <Button
                  onPress={() => handleDecline(item.requestRowId)}
                  variant="outline"
                  style={styles.declineButton}
                >
                  <MaterialIcons name="close" size={16} color="#374151" />
                  <Text style={styles.declineText}> Decline</Text>
                </Button>
              </View>
            )}

                      {item.type === 'invite' && item.status === 'accepted' && (
              <Text style={styles.acceptedText}>✓ Accepted</Text>
            )}
            {item.type === 'invite' && item.status === 'declined' && (
              <Text style={styles.declinedText}>Declined</Text>
            )}
            {item.status === 'cancelled' && (
              <Text style={[styles.declinedText, { color: '#DC2626', fontWeight: '800' }]}>
                Disconnected
              </Text>
            )}

          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Text style={styles.headerSubtitle}>Invites and alerts</Text>
      </View>

      <View style={styles.listContainer}>
        {loading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color="#1E3A8A" />
            <Text style={[styles.emptyText, { marginTop: 12 }]}>Loading…</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="bell" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderNotification}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        )}
      </View>

        <BottomNav
  variant="emergency"
  activeKey="notifications"
  onNavigate={onNavigate}

  theme={theme}
/>


      {/* ✅ Warning Details Modal */}
      <Modal visible={warningModalOpen} transparent animationType="fade" onRequestClose={closeWarningModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Warning Details</Text>
                <Text style={{ marginTop: 6, color: theme.textSecondary, fontWeight: '800' }}>
                  {selectedWarning?.driverName || 'Driver'} • {levelLabel(selectedWarning?.level)} • {formatTS(selectedWarning?.created_at)}

                </Text>
              </View>

              <Pressable onPress={closeWarningModal} style={{ padding: 8 }}>
                <Feather name="x" size={20} color={theme.textPrimary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 10 }}>
              <View style={[styles.bigSnap, { backgroundColor: theme.background, borderColor: theme.border }]}>
                {selectedWarning?.snapshot_url ? (
                  <Image
                    source={{ uri: selectedWarning.snapshot_url }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="image" size={28} color={theme.subText} />
                    <Text style={{ marginTop: 8, color: theme.textSecondary, fontWeight: '800' }}>No snapshot</Text>
                  </View>
                )}
              </View>

<Text style={[styles.detailLine, { color: theme.textPrimary }]}>
  <Text style={{ fontWeight: '900' }}>Reason(s): </Text>
  {reasonsFromWarning(selectedWarning)}
</Text>

              <Text style={[styles.detailLine, { color: theme.textPrimary }]}>
                <Text style={{ fontWeight: '900' }}>Location: </Text>
                {selectedWarning?.location || '—'}
              </Text>

              <Text style={[styles.detailLine, { color: theme.textPrimary }]}>
                <Text style={{ fontWeight: '900' }}>Top speed: </Text>
                {selectedWarning?.speed || '—'}
              </Text>

              <Text style={[styles.detailLine, { color: theme.textPrimary }]}>
                <Text style={{ fontWeight: '900' }}>Timestamp: </Text>
                {formatTS(selectedWarning?.created_at)}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );

}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: '#1E3A8A', paddingVertical: 24, paddingHorizontal: 16 },
  headerTitle: { fontSize: 24, color: 'white', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#DBEAFE' },

  listContainer: { flex: 1, padding: 16 },

  notificationCard: {
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  notificationContent: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden', // ✅ allow image to clip
  },
  avatarImage: {
    width: 40,
    height: 40,
  },

  textContent: { flex: 1 },
  message: { fontSize: 14, color: '#111827', marginBottom: 2 },
  timestamp: { fontSize: 12, color: '#9CA3AF' },
warningTitleRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
},
levelPill: {
  borderWidth: 1,
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 999,
},
levelPillText: {
  fontSize: 12,
  fontWeight: '900',
},

  actionButtons: { flexDirection: 'row', marginTop: 8, gap: 8 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
  },
  outlineButton: { borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: 'white' },
  acceptButton: { flex: 1, backgroundColor: '#1E3A8A' },
  declineButton: { flex: 1 },
  acceptText: { color: 'white', fontSize: 14 },
  declineText: { color: '#374151', fontSize: 14 },
  acceptedText: { fontSize: 12, color: '#16A34A', marginTop: 4 },
  declinedText: { fontSize: 12, color: '#6B7280', marginTop: 4 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 64 },
  emptyText: { marginTop: 12, color: '#6B7280', fontSize: 16 },

  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: 'white',
  },
  navButton: { alignItems: 'center' },
  navText: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

    metaLine: { marginTop: 4, fontSize: 12, fontWeight: '800' },
  tapHint: { marginTop: 6, fontSize: 12, fontWeight: '800', opacity: 0.8 },

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
    maxWidth: 440,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    maxHeight: '82%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 16, fontWeight: '900' },

  bigSnap: {
    marginTop: 12,
    width: '100%',
    height: 240,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },
  detailLine: { marginTop: 12, fontSize: 13, fontWeight: '800' },

});
