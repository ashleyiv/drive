// driveash/components/EmergencyContactSettings.js
import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  Modal,
  Image, // ✅ added
} from 'react-native';
import { Feather, Ionicons, Entypo, AntDesign, FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { formatPHPretty } from '../lib/phonePH';
import { clearAvatarCache, getUserAvatarUrl, resolveAvatarUrl } from '../lib/avatar'; // ✅ added
import BottomNav from './BottomNav';
import { usePendingInviteCount } from '../lib/usePendingInviteCount';
import About from './About';
import PrivacyPolicy from './PrivacyPolicy';
import TermsOfService from './TermsOfService';
import useTheme from '../theme/useTheme';
const ENABLE_MODE_SWITCH = false; // ✅ Disable switching UI without deleting logic


function displayNameFromProfile(p) {
  const first = String(p?.first_name || '').trim();
  const last = String(p?.last_name || '').trim();
  const full = `${first}${first && last ? ' ' : ''}${last}`.trim();
  return full || String(p?.email || 'Emergency Contact');
}

export default function EmergencyContactSettings({ onNavigate, onSwitchToDriver }) {
  const { theme, isDark, toggleTheme } = useTheme();
  const [isDriverMode, setIsDriverMode] = useState(false);
  const [showDriverConfirm, setShowDriverConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Profile state
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileName, setProfileName] = useState('Emergency Contact');
  const [profilePhone, setProfilePhone] = useState('—');

  // ✅ Avatar state
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(null);
  const [avatarCacheBust, setAvatarCacheBust] = useState(Date.now());

const { count: pendingInviteCount } = usePendingInviteCount();

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        setProfileLoading(true);

        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;

        const user = userRes?.user;
        if (!user?.id) {
          if (isMounted) {
            setProfileName('Emergency Contact');
            setProfilePhone('—');
            setProfileAvatarUrl(null);
          }
          return;
        }

        const { data: profile, error: profileErr } = await supabase
          .from('user_profiles')
          .select('first_name,last_name,phone,email,avatar_url') // ✅ include avatar_url
          .eq('id', user.id)
          .maybeSingle();

        if (profileErr) {
          console.log('[EmergencyContactSettings] profile fetch error:', profileErr);
          if (isMounted) {
            setProfileName('Emergency Contact');
            setProfilePhone('—');
            setProfileAvatarUrl(null);
          }
          return;
        }

        const fullName = displayNameFromProfile(profile);
        const phonePretty = formatPHPretty(profile?.phone) || '—';

        // ✅ Resolve avatar first (DB may store full URL or storage path)
        const resolvedDbAvatar = resolveAvatarUrl(profile?.avatar_url);

        if (isMounted) {
          setProfileName(fullName);
          setProfilePhone(phonePretty);

          setProfileAvatarUrl(resolvedDbAvatar ?? null);
          setAvatarCacheBust(Date.now());
        }

        // ✅ Fallback: if DB has no avatar_url (or resolve failed), use helper
        if (!resolvedDbAvatar) {
          clearAvatarCache(user.id);
          const fallback = await getUserAvatarUrl(user.id);

          if (isMounted) {
            setProfileAvatarUrl(fallback ?? null);
            setAvatarCacheBust(Date.now());
          }
        }
      } catch (e) {
        console.log('[EmergencyContactSettings] loadProfile unexpected error:', e);
        if (isMounted) {
          setProfileName('Emergency Contact');
          setProfilePhone('—');
          setProfileAvatarUrl(null);
        }
      } finally {
        if (isMounted) setProfileLoading(false);
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const confirmDriverSwitch = () => {
    setShowDriverConfirm(false);
    setIsDriverMode(true);
    onSwitchToDriver?.();
  };

  // sample connected accounts (kept, but your FlatList data is empty anyway)
  const connectedAccounts = useMemo(
    () => [
      { id: '1', name: 'John Doe', email: 'john@example.com' },
      { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
      { id: '3', name: 'Bob Johnson', email: 'bob@example.com' },
    ],
    []
  );

  const disconnectAccount = () => {
    console.log('Disconnected:', selectedAccount?.name);
    setShowDisconnectModal(false);
    setSelectedAccount(null);
  };

  const renderConnectedAccount = ({ item }) => (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={[styles.itemTitle, { color: theme.text }]}>{item.name}</Text>
          <Text style={[styles.itemSubtitle, { color: theme.subText }]}>{item.email}</Text>
        </View>
        <Pressable
          onPress={() => {
            setSelectedAccount(item);
            setShowDisconnectModal(true);
          }}
        >
          <Entypo name="dots-three-vertical" size={20} color={theme.subText} />
        </Pressable>
      </View>
    </View>
  );

  const avatarDisplayUri = profileAvatarUrl ? `${profileAvatarUrl}?t=${avatarCacheBust}` : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        keyExtractor={(item) => item.id}
        data={[]} // keep as you had
        renderItem={renderConnectedAccount}
        ListHeaderComponent={
          <>
            <View style={[styles.header, { backgroundColor: theme.primary }]}>
              <Text style={styles.headerTitle}>Settings</Text>
              <Text style={styles.headerSubtitle}>Manage your preferences</Text>
            </View>

            {/* Profile card */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <View style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: theme.secondary }]}>
                  {avatarDisplayUri ? (
                    <Image
                      source={{ uri: avatarDisplayUri }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Feather name="user" size={32} color={theme.primary} />
                  )}
                </View>
                <View>
                  <Text style={[styles.name, { color: theme.textPrimary }]}>
                    {profileLoading ? 'Loading…' : profileName}
                  </Text>
                  <Text style={[styles.email, { color: theme.textSecondary }]}>
                    {profileLoading ? ' ' : profilePhone}
                  </Text>
                </View>
              </View>
            </View>

            {/* ✅ Mode card hidden (logic kept) */}
            {ENABLE_MODE_SWITCH && (
              <View style={[styles.card, { backgroundColor: theme.card }]}>
                <Text style={[styles.sectionLabel, { color: theme.subText }]}>Mode</Text>
                <View style={styles.rowBetween}>
                  <View style={styles.row}>
                    <View style={[styles.iconCircle, { backgroundColor: theme.secondary }]}>
                      <AntDesign name="user-switch" size={20} color={theme.primary} />
                    </View>
                    <View>
                      <Text style={[styles.itemTitle, { color: theme.text }]}>Driver Mode</Text>
                      <Text style={[styles.itemSubtitle, { color: theme.subText }]}>
                        Switch to driver features
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    style={[
                      styles.toggle,
                      { backgroundColor: isDriverMode ? theme.primary : theme.divider },
                    ]}
                    onPress={() => setShowDriverConfirm(true)}
                  >
                    <View style={[styles.toggleKnob, isDriverMode && styles.toggleKnobOn]} />
                  </Pressable>
                </View>
              </View>
            )}

            {/* Connected drivers + dark mode */}
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Pressable style={styles.listItem} onPress={() => onNavigate('connected-accounts')}>
                <View style={styles.row}>
                  <Feather name="users" size={20} color={theme.iconPrimary} />
                  <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>Connected drivers</Text>
                </View>
                <Feather name="chevron-right" size={20} color={theme.navInactive} />
              </Pressable>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <View style={styles.listItem}>
                <View style={styles.row}>
                  <Ionicons name="moon-outline" size={20} color={theme.iconPrimary} />
                  <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>Dark Mode</Text>
                </View>
                <Pressable
                  style={[styles.toggle, { backgroundColor: isDark ? theme.primary : theme.border }]}
                  onPress={toggleTheme} 
                >
                  <View style={[styles.toggleKnob, isDark && styles.toggleKnobOn]} />
                </Pressable>
              </View>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <Pressable
                style={styles.listItem}
                onPress={() => onNavigate('privacy-policy')}
              >
                <View style={styles.row}>
                  <Ionicons name="shield" size={20} color={theme.iconPrimary} />
                  <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                    Privacy Policy
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={theme.navInactive} />
              </Pressable>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <Pressable
                style={styles.listItem}
                onPress={() => onNavigate('terms-of-service')}
              >
                <View style={styles.row}>
                  <Feather name="file-text" size={20} color={theme.iconPrimary} />
                  <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                    Terms of Service
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={theme.navInactive} />
              </Pressable>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <Pressable
                style={styles.listItem}
                onPress={() => onNavigate('about')}
              >
                <View style={styles.row}>
                  <Feather name="info" size={20} color={theme.iconPrimary} />
                  <Text style={[styles.itemTitle, { color: theme.textPrimary }]}>
                    About
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={theme.navInactive} />
              </Pressable>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
            </View>

            {/* Logout */}
            <Pressable
              style={[styles.card, { backgroundColor: theme.card, marginTop: -24 }]}
              onPress={() => setShowLogoutConfirm(true)}
            >
              <View style={styles.rowBetween}>
                <View style={styles.row}>
                  <Feather name="log-out" size={20} color={theme.danger} />
                  <Text style={[styles.logoutText, { color: theme.danger }]}>Log Out</Text>
                </View>
                <Feather name="chevron-right" size={20} color={theme.navInactive} />
              </View>
            </Pressable>
          </>
        }
      />

     

      {/* Logout confirm */}
      <Modal transparent visible={showLogoutConfirm} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Log Out</Text>
            <Text style={[styles.modalText, { color: theme.textSecondary }]}>Are you sure you want to log out?</Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowLogoutConfirm(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowLogoutConfirm(false);
                  onNavigate('login', {});
                }}
              >
                <Text style={[styles.confirmText, { color: theme.danger }]}>Log Out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Disconnect confirm */}
      <Modal transparent visible={showDisconnectModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Disconnect Account</Text>
            <Text style={styles.modalText}>
              Are you sure you want to disconnect {selectedAccount?.name}?
            </Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowDisconnectModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={disconnectAccount}>
                <Text style={[styles.confirmText, { color: theme.danger }]}>Disconnect</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

     <BottomNav
  variant="emergency"
  activeKey="settings"
  onNavigate={onNavigate}
  notificationCount={pendingInviteCount}
  theme={theme}
/>

    </View>
  );
}

function NavItem({ icon, label, active, onPress, theme, library = 'feather' }) {
  const IconComponent = library === 'fa5' ? FontAwesome5 : Feather;

  return (
    <Pressable style={styles.navItem} onPress={onPress}>
      <IconComponent name={icon} size={22} color={active ? theme.primary : theme.navInactive} />
      <Text style={{ fontSize: 12, color: active ? theme.primary : theme.navInactive }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingVertical: 24, paddingHorizontal: 16 },
  headerTitle: { color: '#FFF', fontSize: 24, fontWeight: '600' },
  headerSubtitle: { color: '#DBEAFE', fontSize: 14, marginTop: 4 },
  content: { padding: 24, paddingBottom: 40 },
  card: { borderRadius: 12, padding: 16, margin: 10, marginTop: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },

  // ✅ allow image to clip perfectly
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  name: { fontSize: 16, fontWeight: '500' },
  email: { fontSize: 14 },
  sectionLabel: { fontSize: 14, marginBottom: 12 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 14 },
  itemSubtitle: { fontSize: 12 },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  divider: { height: 1, marginVertical: 8 },
  toggle: { width: 48, height: 24, borderRadius: 12, padding: 2 },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' },
  toggleKnobOn: { alignSelf: 'flex-end' },
  logoutText: { fontSize: 14 },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, borderTopWidth: 1 },
  navItem: { alignItems: 'center', gap: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '85%', backgroundColor: 'white', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  modalText: { fontSize: 14, color: '#4B5563', marginBottom: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 },
  cancelText: { color: '#6B7280' },
  confirmText: { color: '#2563EB', fontWeight: 'bold' },
});
