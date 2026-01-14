import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Image,
  Pressable,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { cleanDialNumber, formatPHPretty } from '../lib/phonePH';
import { getUsersAvatarUrls, resolveAvatarUrl } from '../lib/avatar';
import BottomNav from './BottomNav';
function buildFullName(first, last) {
  const f = String(first || '').trim();
  const l = String(last || '').trim();
  const full = `${f}${f && l ? ' ' : ''}${l}`.trim();
  return full;
}

function displayNameFromProfile(p) {
  const full = buildFullName(p?.first_name, p?.last_name);
  if (full) return full;

  const email = String(p?.email || '').trim();
  if (email) return email;

  return 'Unknown User';
}

export default function Contacts({ onNavigate }) {
  const [modalVisible, setModalVisible] = useState(false);
  const activeSearchReq = useRef(0);

  const [loading, setLoading] = useState(true);
  const [contactsAccepted, setContactsAccepted] = useState([]);
  const [contactsPending, setContactsPending] = useState([]);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);

  // for filtering + avoid repeated fetch
  const myUserIdRef = useRef(null);

  // ✅ Delete modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // contact item
  const [deleting, setDeleting] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const makeCall = (phone) => {
    const number = cleanDialNumber(phone);
    if (!number) return;
    Linking.openURL(`tel:${number}`);
  };

  const sendSMS = (phone) => {
    const number = cleanDialNumber(phone);
    if (!number) return;
    Linking.openURL(`sms:${number}`);
  };

  const sendWhatsApp = async (phone) => {
    const number = cleanDialNumber(phone).replace('+', '');
    if (!number) return;

    const url = `whatsapp://send?phone=${number}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) Linking.openURL(url);
    else Alert.alert('WhatsApp not installed');
  };

  const showMessageOptions = (phone) => {
    Alert.alert(
      'Send message via',
      '',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'SMS', onPress: () => sendSMS(phone) },
        { text: 'WhatsApp', onPress: () => sendWhatsApp(phone) },
      ],
      { cancelable: true }
    );
  };

  // ✅ Fetch outgoing requests -> get targets -> join with user_profiles -> attach avatar URLs
  const loadMyContacts = async () => {
    try {
      setLoading(true);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const me = userRes?.user;
      myUserIdRef.current = me?.id ?? null;

      if (!me?.id) {
        setContactsAccepted([]);
        setContactsPending([]);
        return;
      }

      const { data: reqRows, error: reqErr } = await supabase
        .from('emergency_contact_requests')
        .select('id, target_id, status, created_at, responded_at')
        .eq('requester_id', me.id)
        .in('status', ['pending', 'accepted'])
        .order('created_at', { ascending: false });

      if (reqErr) throw reqErr;

      const targetIds = Array.from(
        new Set((reqRows || []).map((r) => r?.target_id).filter(Boolean).map(String))
      );

      // profiles lookup
      const profilesById = {};
      if (targetIds.length > 0) {
        const { data: profRows, error: profErr } = await supabase
          .from('user_profiles')
          .select('id,email,phone,first_name,last_name,avatar_url')
          .in('id', targetIds);

        if (profErr) throw profErr;

        (profRows || []).forEach((p) => {
          profilesById[String(p.id)] = p;
        });

        if ((profRows || []).length === 0 && targetIds.length > 0) {
          console.log('[Contacts] user_profiles returned 0 rows. This is usually RLS blocking SELECT.');
        }
      }

      // ✅ avatar URLs in one go (uses avatar_url stored in DB)
      const avatarMap = targetIds.length > 0 ? await getUsersAvatarUrls(targetIds) : {};

      const accepted = [];
      const pending = [];

      (reqRows || []).forEach((r) => {
        const tid = String(r?.target_id || '');
        const prof = profilesById[tid] || null;

        const first_name = String(prof?.first_name || '').trim();
        const last_name = String(prof?.last_name || '').trim();
        const email = String(prof?.email || '').trim().toLowerCase();
        const phoneE164 = prof?.phone || null;
        const phonePretty = formatPHPretty(phoneE164);

        const name = displayNameFromProfile(prof);

        const avatarUri =
          avatarMap?.[tid] ??
          resolveAvatarUrl(prof?.avatar_url) ??
          null;

        const item = {
          id: String(r.id), // ✅ request row id (bigint string)
          targetId: tid,

          first_name,
          last_name,
          email,
          phone: phonePretty || null,
          phone_raw: phoneE164 || null,

          name,
          status: r.status,
          created_at: r.created_at,
          responded_at: r.responded_at ?? null,
          avatarUri,
        };

        if (r.status === 'accepted') accepted.push(item);
        if (r.status === 'pending') pending.push(item);
      });

      setContactsAccepted(accepted);
      setContactsPending(pending);
    } catch (e) {
      console.log('[Contacts] loadMyContacts error:', e);
      showToast(e?.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Debounced live-search when modal is open (kept)
  useEffect(() => {
    if (!modalVisible) return;

    const q = String(searchText || '').trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }

    const t = setTimeout(() => runSearch(q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText, modalVisible]);

  useEffect(() => {
    loadMyContacts();
  }, []);

  // ✅ Realtime refresh for MY outgoing requests
  useEffect(() => {
    let channel;

    const sub = async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const me = userRes?.user;
        if (!me?.id) return;

        channel = supabase
          .channel('contacts-requests-driver')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'emergency_contact_requests',
              filter: `requester_id=eq.${me.id}`,
            },
            () => loadMyContacts()
          )
          .subscribe();
      } catch (e) {
        console.log('[Contacts] realtime subscribe error:', e);
      }
    };

    sub();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Build a fast filter set so the "+" search excludes already-added/pending + excludes yourself
  const excludedUserIds = useMemo(() => {
    const s = new Set();

    const meId = myUserIdRef.current;
    if (meId) s.add(String(meId));

    contactsPending.forEach((c) => s.add(String(c.targetId)));
    contactsAccepted.forEach((c) => s.add(String(c.targetId)));

    return s;
  }, [contactsPending, contactsAccepted]);

  const runSearch = async (rawQ) => {
    const q = String(rawQ ?? searchText ?? '').trim();
    if (!q) {
      setResults([]);
      return;
    }

    // ✅ Realtime filtering improvement:
    // - allow ANY text query length >= 2 (so "ahmir" works)
    // - phone digits still work (>= 3)
    const digits = q.replace(/\D/g, '');
    const textOk = q.length >= 2;
    const phoneOk = digits.length >= 3;

    if (!textOk && !phoneOk) {
      setResults([]);
      return;
    }

    const reqId = ++activeSearchReq.current;

    try {
      setSearching(true);

      // RPC should return: id,email,phone,first_name,last_name,avatar_url
      const { data, error } = await supabase.rpc('search_users_by_email_or_phone', {
        p_query: q,
      });

      if (error) throw error;
      if (reqId !== activeSearchReq.current) return;

      const rows = Array.isArray(data) ? data : [];

      // ✅ filter out: yourself + already in pending/accepted list (live filtering)
      const filtered = rows.filter((r) => {
        const id = String(r?.id || '');
        if (!id) return false;
        if (excludedUserIds.has(id)) return false;
        return true;
      });

      // ✅ avatar map for filtered results
      const ids = filtered.map((x) => x.id).filter(Boolean);
      const avatarMap = ids.length > 0 ? await getUsersAvatarUrls(ids) : {};

      setResults(
        filtered.map((r) => ({
          ...r,
          avatarUri:
            avatarMap?.[String(r.id)] ??
            resolveAvatarUrl(r?.avatar_url) ??
            null,
        }))
      );
    } catch (e) {
      if (reqId !== activeSearchReq.current) return;
      console.log('[Contacts] search error:', e);
      setResults([]);
    } finally {
      if (reqId === activeSearchReq.current) setSearching(false);
    }
  };

  const sendInvite = async (targetUserId) => {
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const me = userRes?.user;
      if (!me?.id) return showToast('Not logged in');
      if (String(targetUserId) === String(me.id)) return showToast("You can't invite yourself");

      const { error } = await supabase.from('emergency_contact_requests').insert({
        requester_id: me.id,
        target_id: targetUserId,
        status: 'pending',
      });

      if (error) {
        if (String(error.message || '').toLowerCase().includes('duplicate')) {
          showToast('Invite already sent');
          return;
        }
        throw error;
      }

      showToast('Invite sent');
      await loadMyContacts();

      // ✅ update modal live filtering immediately
      setResults((prev) => prev.filter((x) => String(x.id) !== String(targetUserId)));
    } catch (e) {
      console.log('[Contacts] sendInvite error:', e);
      showToast(e?.message || 'Failed to send invite');
    }
  };

  // ✅ Delete handlers
  const openDeleteModal = (contact) => {
    setDeleteTarget(contact);
    setDeleteModalVisible(true);
  };

  const closeDeleteModal = () => {
    if (deleting) return;
    setDeleteModalVisible(false);
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const me = userRes?.user;
      if (!me?.id) {
        showToast('Not logged in');
        return;
      }

         // ✅ IMPORTANT:
      // We "disconnect" by setting status='cancelled' (so the other user can be notified).
      // Also: use .select() so we can detect "0 rows affected" (common with RLS).
      const { data: updatedRows, error } = await supabase
        .from('emergency_contact_requests')
        .update({ status: 'cancelled', responded_at: new Date().toISOString() })
        .eq('id', deleteTarget.id)
        .eq('requester_id', me.id)
        .select('id');

      if (error) throw error;

      // ✅ If RLS blocked, PostgREST can return [] without error.
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error('Disconnect failed (no rows updated). Check RLS policies for UPDATE.');
      }

      // ✅ Optimistic UI removal (so it disappears instantly even before reload)
      setContactsAccepted((prev) => prev.filter((x) => String(x.id) !== String(deleteTarget.id)));
      setContactsPending((prev) => prev.filter((x) => String(x.id) !== String(deleteTarget.id)));

      showToast('Contact disconnected');
      closeDeleteModal();

      // ✅ Reload from DB (source of truth)
      await loadMyContacts();

    } catch (e) {
      console.log('[Contacts] delete error:', e);
      showToast(e?.message || 'Failed to delete contact');
    } finally {
      setDeleting(false);
    }
  };

  const combinedList = useMemo(() => {
    return [
      ...contactsPending.map((x) => ({ ...x, _k: `p-${x.id}` })),
      ...contactsAccepted.map((x) => ({ ...x, _k: `a-${x.id}` })),
    ];
  }, [contactsAccepted, contactsPending]);

  const renderContactRow = ({ item }) => {
    const full = buildFullName(item.first_name, item.last_name);

    // card press = call (keeps your call logic available)
    // long press = message options (keeps SMS/WhatsApp logic)
    const handleCardPress = () => {
      if (item.status === 'accepted') makeCall(item.phone_raw);
    };

    const handleCardLongPress = () => {
      if (item.status === 'accepted') showMessageOptions(item.phone_raw);
    };

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleCardPress}
        onLongPress={handleCardLongPress}
        delayLongPress={400}
        style={styles.card}
      >
        {/* avatar */}
        <View style={styles.avatarWrap}>
          {item.avatarUri ? (
            <Image source={{ uri: item.avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Ionicons name="person" size={22} color="#fff" />
            </View>
          )}
        </View>

        {/* text */}
        <View style={{ flex: 1 }}>
          <Text style={styles.nameText}>
            {(full || item.email || 'Unknown User').toUpperCase()}
          </Text>

          {!!item.phone && (
            <Text style={styles.phoneText}>
              {item.phone}
            </Text>
          )}

          {item.status === 'pending' && (
            <Text style={styles.pendingText}>Pending acceptance</Text>
          )}
        </View>

        {/* right action: trash for accepted, clock for pending */}
        {item.status === 'accepted' ? (
          <Pressable
            onPress={() => openDeleteModal(item)}
            style={styles.trashBtn}
            hitSlop={10}
          >
            <Ionicons name="trash-outline" size={18} color="#1D4ED8" />
          </Pressable>
        ) : (
          <View style={styles.trashBtnDisabled}>
            <Feather name="clock" size={18} color="#6B7280" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* ✅ Header (match screenshot) */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Emergency Contacts</Text>
        <Text style={styles.headerSub}>Manage your emergency contacts</Text>
      </View>

      {/* Body */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={{ marginTop: 10, color: '#6B7280' }}>Loading contacts…</Text>
        </View>
      ) : combinedList.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="people-outline" size={64} color="#D1D5DB" />
          <Text style={{ marginTop: 10, fontSize: 16, fontWeight: '600', color: '#111827' }}>
            No contacts yet
          </Text>
          <Text style={{ marginTop: 6, fontSize: 13, color: '#6B7280' }}>
            Tap + to search and invite
          </Text>
        </View>
      ) : (
        <FlatList
          data={combinedList}
          keyExtractor={(item) => item._k}
          contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 110 }}
          renderItem={renderContactRow}
          showsVerticalScrollIndicator={false}
        />
      )}

     {/* Bottom nav (centralized) */}
<BottomNav
  variant="driver"
  activeKey="contacts"
  onNavigate={onNavigate}
/>


      {/* Add Contact Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '88%', backgroundColor: '#fff', borderRadius: 12, padding: 18 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
              Search users to invite
            </Text>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#D1D5DB',
                borderRadius: 10,
                height: 44,
                paddingHorizontal: 12,
              }}
            >
              <Ionicons name="search" size={18} color="#6B7280" />
              <TextInput
                placeholder="Type email or phone…"
                value={searchText}
                onChangeText={setSearchText}
                autoCapitalize="none"
                keyboardType="default"
                style={{ flex: 1, fontSize: 16, marginLeft: 10 }}
                returnKeyType="search"
                // ✅ keep manual submit too (not required anymore)
                onSubmitEditing={() => runSearch(searchText)}
              />
              <Pressable onPress={() => runSearch(searchText)} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
                <Text style={{ color: '#2563EB', fontWeight: '700' }}>
                  {searching ? '...' : 'Go'}
                </Text>
              </Pressable>
            </View>

            <View style={{ marginTop: 14, maxHeight: 300 }}>
              {searching ? (
                <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                  <ActivityIndicator color="#2563EB" />
                  <Text style={{ marginTop: 8, color: '#6B7280' }}>Searching…</Text>
                </View>
              ) : results.length === 0 ? (
                <Text style={{ paddingVertical: 16, color: '#6B7280', textAlign: 'center' }}>
                  {searchText.trim()
                    ? 'No users found (or they are already in your contacts)'
                    : 'Start typing to search users'}
                </Text>
              ) : (
                <FlatList
                  data={results}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={({ item }) => {
                    const full = buildFullName(item?.first_name, item?.last_name);
                    const email = String(item.email || '').trim().toLowerCase();
                    const phonePretty = formatPHPretty(item.phone);

                    return (
                      <View
                        style={{
                          paddingVertical: 12,
                          borderBottomWidth: 1,
                          borderColor: '#F3F4F6',
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <View
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 21,
                            backgroundColor: '#E5E7EB',
                            overflow: 'hidden',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                          }}
                        >
                          {item.avatarUri ? (
                            <Image source={{ uri: item.avatarUri }} style={{ width: 42, height: 42 }} />
                          ) : (
                            <Ionicons name="person" size={20} color="#6B7280" />
                          )}
                        </View>

                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <Text style={{ fontWeight: '800', color: '#111827' }}>
                            {full || email || 'Unknown User'}
                          </Text>
                          <Text style={{ marginTop: 2, color: '#6B7280', fontSize: 12 }}>
                            {email}
                            {phonePretty ? ` • ${phonePretty}` : ''}
                          </Text>
                        </View>

                        <Pressable
                          onPress={() => sendInvite(item.id)}
                          style={{ backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
                        >
                          <Text style={{ color: 'white', fontWeight: '700' }}>Invite</Text>
                        </Pressable>
                      </View>
                    );
                  }}
                />
              )}
            </View>

            <Pressable
              onPress={() => {
                setModalVisible(false);
                setSearchText('');
                setResults([]);
              }}
              style={{ marginTop: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#6B7280', fontWeight: '600' }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ✅ Delete Confirmation Modal (matches screenshot) */}
      <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={closeDeleteModal}>
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteBox}>
            <Text style={styles.deleteQuestion}>
              Are you sure to delete this user on your emergency contact?
            </Text>

            <View style={styles.deleteActions}>
              <Pressable onPress={closeDeleteModal} disabled={deleting} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>Cancel</Text>
              </Pressable>

              <Pressable onPress={confirmDelete} disabled={deleting} style={styles.deleteBtn}>
                <Text style={[styles.deleteBtnText, { color: '#1D4ED8', fontWeight: '800' }]}>
                  {deleting ? '...' : 'Confirm'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Toast */}
      {toastVisible && (
        <View
          style={{
            position: 'absolute',
            bottom: 90,
            alignSelf: 'center',
            backgroundColor: '#111827',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            elevation: 6,
          }}
        >
          <Image
            source={require('../assets/drivelogo.png')}
            style={{ width: 24, height: 24, marginRight: 10, resizeMode: 'contain' }}
          />
          <Text style={{ color: '#fff', fontSize: 14 }}>{toastMessage}</Text>
        </View>
      )}

      {/* Floating + button (kept) */}
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
        style={{
          position: 'absolute',
          bottom: 110,
          right: 18,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#2563EB',
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 6,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        }}
      >
        <Ionicons name="add" size={35} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function NavItem({ icon, label, onPress, active }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={active} style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: active ? '#3B82F6' : 'white',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name={icon} size={18} color={active ? '#ffffff' : '#3B82F6'} />
      </View>
      <Text style={{ color: '#3B82F6', fontSize: 12, marginTop: 4 }}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#F3F4F6' },

  header: {
    backgroundColor: '#1F7CC0',
    paddingTop: 46,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  headerSub: { color: 'rgba(255,255,255,0.85)', marginTop: 2, fontSize: 12 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  avatarWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 54, height: 54 },
  avatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  nameText: { fontSize: 13, fontWeight: '900', color: '#111827' },
  phoneText: { marginTop: 4, fontSize: 12, color: '#6B7280', fontWeight: '700' },
  pendingText: { marginTop: 6, fontSize: 12, color: '#F59E0B', fontWeight: '900' },

  trashBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  trashBtnDisabled: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    opacity: 0.7,
  },

  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },

  deleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  deleteBox: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
  },
  deleteQuestion: {
    color: '#EF4444',
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 18,
  },
  deleteActions: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 20,
  },
  deleteBtn: { paddingVertical: 6, paddingHorizontal: 6 },
  deleteBtnText: { color: '#6B7280', fontWeight: '700' },
};
