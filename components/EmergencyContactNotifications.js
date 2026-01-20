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
} from 'react-native';
import { MaterialIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getUsersAvatarUrls, resolveAvatarUrl } from '../lib/avatar'; // ✅ add
import BottomNav from './BottomNav';
import { usePendingInviteCount } from '../lib/usePendingInviteCount';
import useTheme from '../theme/useTheme';
const Button = ({ onPress, children, style, variant }) => {
  const buttonStyle = [styles.button, style, variant === 'outline' ? styles.outlineButton : null];
  return (
    <TouchableOpacity onPress={onPress} style={buttonStyle}>
      {children}
    </TouchableOpacity>
  );
};

function displayNameFromProfile(p) {
  const first = String(p?.first_name || '').trim();
  const last = String(p?.last_name || '').trim();
  const full = `${first}${first && last ? ' ' : ''}${last}`.trim();
  return full || String(p?.email || 'Unknown User');
}

export default function EmergencyContactNotifications({ onNavigate }) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
    const { count: pendingInviteCount } = usePendingInviteCount();

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
  }, []);

  // Optional realtime updates (new invites / status changes)
  useEffect(() => {
    let channel;

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
      } catch (e) {
        console.log('[EC Notifications] realtime subscribe error:', e);
      }
    };

    sub();

    return () => {
      if (channel) supabase.removeChannel(channel);
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
    // show invites first (more important), then alerts
    return [...invites, ...alerts];
  }, [invites, alerts]);

  const renderNotification = ({ item }) => {
    const isLevel3 =
      item.type === 'alert' &&
      String(item.message || '').toUpperCase().includes('LEVEL 3');

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
  notificationCount={pendingInviteCount}
  theme={theme}
/>

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
});
