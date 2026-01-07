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
} from 'react-native';
import { Ionicons, Feather, AntDesign } from '@expo/vector-icons';

import AccountSettings from './AccountSettings';
import About from './About';
import PrivacyPolicy from './PrivacyPolicy';
import TermsOfService from './TermsOfService';

import { supabase } from '../lib/supabase';

// Optional: nice formatting for PH numbers stored like +639123456789
function formatPhonePretty(phone) {
  if (!phone) return '';
  const p = String(phone).trim();

  // Keep already-spaced formatting
  if (p.includes(' ')) return p;

  // Format +63XXXXXXXXXX -> +63 XXX XXX XXXX (best-effort)
  if (p.startsWith('+63') && p.length === 13) {
    const rest = p.slice(3); // 10 digits
    const a = rest.slice(0, 3);
    const b = rest.slice(3, 6);
    const c = rest.slice(6, 10);
    return `+63 ${a} ${b} ${c}`;
  }

  return p;
}

export default function Menu({
  onNavigate,
  onSwitchToDriver,
  onSwitchToEmergencyContact,
  handleLogout,
  // Keep defaults but they’ll get replaced by fetched profile if available
  userName = '—',
  userPhone = '—',
}) {
  const [darkMode, setDarkMode] = useState(false);
  const [isEmergencyContactMode, setIsEmergencyContactMode] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
  const [pendingEmergencyValue, setPendingEmergencyValue] = useState(false);

  // NEW: Profile state from Supabase
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileName, setProfileName] = useState(userName);
  const [profilePhone, setProfilePhone] = useState(userPhone);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        setProfileLoading(true);

        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;

        const user = userRes?.user;
        if (!user?.id) {
          // Not logged in (or session not ready)
          if (isMounted) {
            setProfileName(userName);
            setProfilePhone(userPhone);
          }
          return;
        }

        // Fetch profile row keyed by auth.users.id
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('first_name,last_name,phone')
          .eq('id', user.id)
          .maybeSingle();

        if (profileErr) {
          // Most common cause: RLS policy blocking select
          console.log('[Menu] profile fetch error:', profileErr);
          if (isMounted) {
            setProfileName(userName);
            setProfilePhone(userPhone);
          }
          return;
        }

        const first = (profile?.first_name ?? '').trim();
        const last = (profile?.last_name ?? '').trim();

        const fullName =
          (first || last) ? `${first}${first && last ? ' ' : ''}${last}` : userName;

        const phonePretty = formatPhonePretty(profile?.phone) || userPhone;

        if (isMounted) {
          setProfileName(fullName);
          setProfilePhone(phonePretty);
        }
      } catch (e) {
        console.log('[Menu] loadProfile unexpected error:', e);
        if (isMounted) {
          setProfileName(userName);
          setProfilePhone(userPhone);
        }
      } finally {
        if (isMounted) setProfileLoading(false);
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [userName, userPhone]);

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
      icon: (
        <Ionicons name="moon" size={20} color={darkMode ? 'white' : '#2563EB'} />
      ),
      label: 'Dark Mode',
      action: () => setDarkMode(!darkMode),
      isSwitch: true,
      switchValue: darkMode,
    },
    {
      icon: (
        <Ionicons name="shield" size={20} color={darkMode ? 'white' : '#2563EB'} />
      ),
      label: 'Privacy Policy',
      action: () => setShowPrivacyPolicy(true),
    },
    {
      icon: (
        <Feather name="file-text" size={20} color={darkMode ? 'white' : '#2563EB'} />
      ),
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
        onBack={() => setShowAccountSettings(false)}
        darkMode={darkMode}
      />
    );
  }

  if (showAbout) return <About onBack={() => setShowAbout(false)} darkMode={darkMode} />;
  if (showPrivacyPolicy)
    return <PrivacyPolicy onBack={() => setShowPrivacyPolicy(false)} darkMode={darkMode} />;
  if (showTerms) return <TermsOfService onBack={() => setShowTerms(false)} darkMode={darkMode} />;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TouchableOpacity
        style={[styles.profileCard, { backgroundColor: theme.cardBackground }]}
        onPress={() => setShowAccountSettings(true)}
      >
        <View style={[styles.avatar, { backgroundColor: theme.iconColor }]}>
          <Ionicons name="person" size={32} color="white" />
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.userName, { color: 'white' }]}>
            {profileLoading ? 'Loading…' : profileName}
          </Text>
          <Text style={[styles.userPhone, { color: 'white' }]}>
            {profileLoading ? ' ' : profilePhone}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={20} color="white" />
      </TouchableOpacity>

      <ScrollView style={{ flex: 1 }}>
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
              <Switch
                value={isEmergencyContactMode}
                disabled
                trackColor={{ false: '#D1D5DB', true: '#2563EB' }}
                thumbColor="white"
              />
            </TouchableOpacity>
          </View>
        </View>

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

      <View style={[styles.navbar, { backgroundColor: theme.navBackground }]}>
        <NavItem icon="home" label="Home" onPress={() => onNavigate('dashboard')} active={false} theme={theme} />
        <NavItem icon="clock" label="History" onPress={() => onNavigate('history')} active={false} theme={theme} />
        <NavItem icon="map-pin" label="Location" onPress={() => onNavigate('location')} active={false} theme={theme} />
        <NavItem icon="users" label="Contacts" onPress={() => onNavigate('contacts')} active={false} theme={theme} />
        <NavItem icon="menu" label="Menu" onPress={() => onNavigate('menu')} active theme={theme} />
      </View>

      {/* Emergency mode confirm */}
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
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowLogoutConfirm(false)}
              >
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
  cancelButton: {
    backgroundColor: '#E5E7EB',
  },
  confirmButton: {
    backgroundColor: '#2563EB',
  },
  cancelText: {
    color: '#111827',
    fontWeight: '500',
  },
  confirmText: {
    color: 'white',
    fontWeight: '600',
  },
});
