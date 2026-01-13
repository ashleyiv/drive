// driveash/components/Menu.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  Pressable,
  Image,
} from 'react-native';
import { Ionicons, Feather, AntDesign } from '@expo/vector-icons';

import AccountSettings from './AccountSettings';
import About from './About';
import PrivacyPolicy from './PrivacyPolicy';
import TermsOfService from './TermsOfService';

import { getUserAvatarUrl, clearAvatarCache } from '../lib/avatar';
import { supabase } from '../lib/supabase';
import { formatPHPretty } from '../lib/phonePH';
import BottomNav from './BottomNav';
// ✅ Turn OFF mode switching UI without deleting logic
const ENABLE_MODE_SWITCH = false;

export default function Menu({
  onNavigate,
  onSwitchToDriver,
  onSwitchToEmergencyContact,
  handleLogout,
  // fallback defaults
  userName = '—',
  userPhone = '—',
  userEmail = '—',
}) {
  const [darkMode, setDarkMode] = useState(false);

  // Mode state (kept, but UI disabled)
  const [isEmergencyContactMode, setIsEmergencyContactMode] = useState(false);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
  const [pendingEmergencyValue, setPendingEmergencyValue] = useState(false);

  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Profile state from Supabase
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileName, setProfileName] = useState(userName);
  const [profilePhone, setProfilePhone] = useState(userPhone);
  const [profileEmail, setProfileEmail] = useState(userEmail);

  // ✅ Avatar
  const [profileAvatar, setProfileAvatar] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        setProfileLoading(true);

        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;

        const user = userRes?.user;

        // Fallback: use auth email even if profile row is missing
        const authEmail = String(user?.email || userEmail || '—').trim().toLowerCase();

        if (!user?.id) {
          if (isMounted) {
            setProfileAvatar(null);
            setProfileName(userName);
            setProfilePhone(formatPHPretty(userPhone) || userPhone);
            setProfileEmail(authEmail);
          }
          return;
        }

        // ✅ fetch avatar only when user.id exists
        clearAvatarCache(user.id); // ensures latest avatar if updated
        const avatar = await getUserAvatarUrl(user.id);
        if (isMounted) setProfileAvatar(avatar);

        const { data: profile, error: profileErr } = await supabase
          .from('user_profiles')
          .select('first_name,last_name,phone,email')
          .eq('id', user.id)
          .maybeSingle();

        if (profileErr) {
          console.log('[Menu] profile fetch error:', profileErr);
          if (isMounted) {
            setProfileName(userName);
            setProfilePhone(formatPHPretty(userPhone) || userPhone);
            setProfileEmail(authEmail);
          }
          return;
        }

        const first = String(profile?.first_name ?? '').trim();
        const last = String(profile?.last_name ?? '').trim();
        const fullName =
          (first || last) ? `${first}${first && last ? ' ' : ''}${last}` : (userName || '—');

        const prettyPhone =
          formatPHPretty(profile?.phone) || formatPHPretty(userPhone) || (userPhone || '—');

        const emailFinal = String(profile?.email || authEmail || '—').trim().toLowerCase();

        if (isMounted) {
          setProfileName(fullName);
          setProfilePhone(prettyPhone);
          setProfileEmail(emailFinal);
        }
      } catch (e) {
        console.log('[Menu] loadProfile unexpected error:', e);
        if (isMounted) {
          setProfileAvatar(null);
          setProfileName(userName);
          setProfilePhone(formatPHPretty(userPhone) || userPhone);
          setProfileEmail(String(userEmail || '—').trim().toLowerCase());
        }
      } finally {
        if (isMounted) setProfileLoading(false);
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [userName, userPhone, userEmail]);

  // --- Mode switch handlers (kept; UI hidden) ---
  const handleEmergencyContactToggle = (value) => {
    setPendingEmergencyValue(value);
    setShowEmergencyConfirm(true);
  };

  const confirmEmergencySwitch = () => {
    setShowEmergencyConfirm(false);
    setIsEmergencyContactMode(pendingEmergencyValue);

    if (pendingEmergencyValue) {
      onSwitchToEmergencyContact && onSwitchToEmergencyContact();
    } else {
      onSwitchToDriver && onSwitchToDriver();
    }
  };

  const cancelEmergencySwitch = () => {
    setShowEmergencyConfirm(false);
    setPendingEmergencyValue(isEmergencyContactMode);
  };

  const theme = useMemo(
    () => ({
      background: darkMode ? '#1F2937' : 'white',
      cardBackground: darkMode ? '#374151' : '#1E40AF',
      toggleBackground: darkMode ? '#4B5563' : '#F3F4F6',
      toggleIconBackground: darkMode ? '#2563EB' : '#DBEAFE',
      textPrimary: darkMode ? 'white' : '#111827',
      textSecondary: darkMode ? '#D1D5DB' : '#6B7280',
      iconColor: darkMode ? '#2563EB' : '#2563EB',
      navActiveBackground: '#3B82F6',
      navActiveText: 'white',
      navInactiveText: darkMode ? '#D1D5DB' : '#3B82F6',
      navBackground: darkMode ? '#111827' : 'white',
      borderColor: darkMode ? '#4B5563' : '#F3F4F6',
    }),
    [darkMode]
  );

  const menuItems = [
    {
      icon: <Ionicons name="moon" size={20} color={darkMode ? 'white' : '#2563EB'} />,
      label: 'Dark Mode',
      action: () => setDarkMode(!darkMode),
      isSwitch: true,
      switchValue: darkMode,
    },
    {
      icon: <Ionicons name="shield" size={20} color={darkMode ? 'white' : '#2563EB'} />,
      label: 'Privacy Policy',
      action: () => setShowPrivacyPolicy(true),
    },
    {
      icon: <Feather name="file-text" size={20} color={darkMode ? 'white' : '#2563EB'} />,
      label: 'Terms of Service',
      action: () => setShowTerms(true),
    },
    {
      icon: <Feather name="info" size={20} color={darkMode ? 'white' : '#2563EB'} />,
      label: 'About',
      action: () => setShowAbout(true),
    },
    {
      icon: <Feather name="log-out" size={20} color="#DC2626" />,
      label: 'Log Out',
      action: () => setShowLogoutConfirm(true),
    },
  ];

  if (showAccountSettings) {
    return (
      <AccountSettings
        userName={profileName}
        userPhone={profilePhone}
        userEmail={profileEmail}
        onBack={() => setShowAccountSettings(false)}
        darkMode={darkMode}
      />
    );
  }

  if (showAbout) return <About onBack={() => setShowAbout(false)} darkMode={darkMode} />;
  if (showPrivacyPolicy) return <PrivacyPolicy onBack={() => setShowPrivacyPolicy(false)} darkMode={darkMode} />;
  if (showTerms) return <TermsOfService onBack={() => setShowTerms(false)} darkMode={darkMode} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TouchableOpacity
        style={[styles.profileCard, { backgroundColor: theme.cardBackground }]}
        onPress={() => setShowAccountSettings(true)}
      >
        <View style={[styles.avatar, { backgroundColor: theme.iconColor, overflow: 'hidden' }]}>
          {profileAvatar ? (
            <Image source={{ uri: profileAvatar }} style={{ width: 64, height: 64 }} />
          ) : (
            <Ionicons name="person" size={32} color="white" />
          )}
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.userName, { color: 'white' }]}>
            {profileLoading ? 'Loading…' : profileName}
          </Text>

          <Text style={[styles.userPhone, { color: 'white' }]}>
            {profileLoading ? ' ' : (profilePhone || '—')}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={20} color="white" />
      </TouchableOpacity>

      <ScrollView style={{ flex: 1 }}>
        {/* ✅ Mode section hidden */}
        {ENABLE_MODE_SWITCH && (
          <View style={styles.toggleContainer}>
            <Text style={[styles.toggleTitle, { color: theme.textPrimary }]}>Mode</Text>

            <View
              style={[
                styles.toggleItem,
                {
                  backgroundColor: theme.toggleBackground,
                  borderColor: theme.borderColor,
                  borderWidth: 1,
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.toggleIcon, { backgroundColor: theme.toggleIconBackground }]}>
                  <AntDesign name="user-switch" size={20} color={darkMode ? 'white' : '#2563EB'} />
                </View>

                <View style={{ marginLeft: 12 }}>
                  <Text style={[styles.toggleLabel, { color: theme.textPrimary }]}>
                    Emergency Contact Person
                  </Text>
                  <Text style={[styles.toggleSubLabel, { color: theme.textSecondary }]}>
                    Switch to monitor connected drivers
                  </Text>
                </View>
              </View>

              <TouchableOpacity onPress={() => handleEmergencyContactToggle(!isEmergencyContactMode)}>
                <Switch value={isEmergencyContactMode} disabled trackColor={{ false: '#D1D5DB', true: '#2563EB' }} thumbColor="white" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.menuItem, { borderColor: theme.borderColor }]}
            onPress={item.action}
          >
            <View style={styles.menuItemLeft}>
              {item.icon}
              <Text style={[styles.menuLabel, { color: theme.textPrimary }]}>{item.label}</Text>
            </View>

            {item.isSwitch ? (
              <Switch
                value={item.switchValue}
                onValueChange={item.action}
                trackColor={{ false: '#D1D5DB', true: '#2563EB' }}
                thumbColor="white"
              />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

     <BottomNav
  variant="driver"
  activeKey="menu"
  onNavigate={onNavigate}
  theme={theme}
/>


      {/* Emergency mode confirm (kept; won't show because UI hidden) */}
      <Modal transparent visible={showEmergencyConfirm} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Switch Mode?</Text>
            <Text style={styles.modalText}>
              {pendingEmergencyValue ? 'Switch to Emergency Contact mode?' : 'Switch back to Driver mode?'}
            </Text>

            <View style={styles.modalActions}>
              <Pressable style={[styles.modalButton, styles.cancelButton]} onPress={cancelEmergencySwitch}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable style={[styles.modalButton, styles.confirmButton]} onPress={confirmEmergencySwitch}>
                <Text style={styles.confirmText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Logout confirm */}
      <Modal transparent visible={showLogoutConfirm} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Log Out</Text>
            <Text style={styles.modalText}>Are you sure you want to log out?</Text>

            <View style={styles.modalActions}>
              <Pressable style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowLogoutConfirm(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.modalButton, styles.confirmButton]}
                onPress={() => {
                  setShowLogoutConfirm(false);
                  handleLogout && handleLogout();
                }}
              >
                <Text style={styles.confirmText}>Log Out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function NavItem({ icon, label, onPress, active, theme }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={active} style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: active ? theme.navActiveBackground : theme.navBackground,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name={icon} size={18} color={active ? theme.navActiveText : theme.navInactiveText} />
      </View>
      <Text style={{ color: theme.navInactiveText, fontSize: 12, marginTop: 4 }}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: { fontSize: 18, fontWeight: 'bold' },
  userPhone: { fontSize: 14, opacity: 0.9 },

  toggleContainer: { paddingHorizontal: 16 },
  toggleTitle: { fontSize: 14, marginBottom: 8, fontWeight: 'bold' },
  toggleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  toggleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleLabel: { fontSize: 14, fontWeight: '500' },
  toggleSubLabel: { fontSize: 12 },

  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
  menuLabel: { fontSize: 16, marginLeft: 12 },

  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  cancelButton: { backgroundColor: '#E5E7EB' },
  confirmButton: { backgroundColor: '#2563EB' },
  cancelText: { color: '#111827', fontWeight: '500' },
  confirmText: { color: 'white', fontWeight: '600' },
});
