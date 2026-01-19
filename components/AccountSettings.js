// driveash/components/AccountSettings.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { formatPHPretty } from '../lib/phonePH';
import { clearAvatarCache, getUserAvatarUrl, resolveAvatarUrl } from '../lib/avatar';
import useTheme from '../theme/useTheme';

export default function AccountSettings({
  onBack,
  userEmail = '—',
  userName = 'John',
  userPhone = '+639123456789',
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const initialFirst = useMemo(() => (String(userName).split(' ')[0] || '').trim(), [userName]);
  const initialLast = useMemo(() => (String(userName).split(' ').slice(1).join(' ') || '').trim(), [userName]);

  const [email, setEmail] = useState(String(userEmail || '—'));
  const [phone, setPhone] = useState(formatPHPretty(userPhone) || '—');

  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);

  const [changingPassword, setChangingPassword] = useState(false);
  const [busyPassword, setBusyPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarCacheBust, setAvatarCacheBust] = useState(Date.now());

  // Preview modal
  const [previewVisible, setPreviewVisible] = useState(false);
  const [pendingUri, setPendingUri] = useState(null);

  const { theme, isDark, toggleTheme } = useTheme();

  // ---------- helpers ----------
  const IMAGE_MEDIA_TYPES =
    ImagePicker.MediaType?.Images
      ? [ImagePicker.MediaType.Images]
      : ImagePicker.MediaTypeOptions?.Images;

  const ensureCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  };

  const ensureGalleryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  };

  // ---------- load profile ----------
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes?.user;
        if (!user?.id) return;

        const authEmail = (user.email ?? email).trim().toLowerCase();

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email,phone,first_name,last_name,avatar_url')
          .eq('id', user.id)
          .maybeSingle();

        if (!mounted) return;

        setEmail((profile?.email ?? authEmail) || authEmail);
        setPhone(profile?.phone ? formatPHPretty(profile.phone) : formatPHPretty(userPhone) || '—');
        setFirstName((profile?.first_name ?? initialFirst) || '');
        setLastName((profile?.last_name ?? initialLast) || '');
        // ✅ Resolve avatar_url safely (works whether DB stored a public URL or a storage path)
const resolvedDbAvatar = resolveAvatarUrl(profile?.avatar_url);

// keep your existing state updates above this line
setAvatarUrl(resolvedDbAvatar ?? null);
setAvatarCacheBust(Date.now()); // force refresh if URL is same but image changed

// ✅ Fallback: if DB has no avatar_url (or resolve failed), fetch via helper (respects your cache logic)
if (!resolvedDbAvatar) {
  // ensure we don't reuse stale cached null from old sessions
  clearAvatarCache(user.id);

  const fallback = await getUserAvatarUrl(user.id);
  if (mounted) {
    setAvatarUrl(fallback ?? null);
    setAvatarCacheBust(Date.now());
  }
}

      } catch {
        // fallback
      }
    };

    load();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- profile save ----------
  // ---------- profile save ----------
const handleSave = async () => {
  try {
    setSaving(true);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;

    const user = userRes?.user;
    if (!user?.id) {
      Alert.alert('Not logged in', 'Please log in again.');
      return;
    }

    const first = firstName.trim();
    const last = lastName.trim();

    // ✅ keep your update, but return the updated row
    const { data: updated, error } = await supabase
      .from('user_profiles')
      .update({
        first_name: first,
        last_name: last,
      })
      .eq('id', user.id)
      .select('first_name,last_name')
      .maybeSingle();

    if (error) throw error;

    // ✅ ensure UI shows what’s in DB
    if (updated) {
      setFirstName(updated.first_name ?? '');
      setLastName(updated.last_name ?? '');
    }

    Alert.alert('Saved', 'Profile updated.');
    setEditing(false);
  } catch (e) {
    Alert.alert('Save failed', e?.message || 'Could not update profile.');
  } finally {
    setSaving(false);
  }
};


  // ---------- password ----------
  const handleChangePassword = async () => {
  if (newPassword !== confirmPassword) return Alert.alert('Error', 'Passwords do not match.');
  if (!newPassword || newPassword.length < 6)
    return Alert.alert('Error', 'New password must be at least 6 characters.');
  if (!currentPassword) return Alert.alert('Error', 'Enter your current password.');

  try {
    setBusyPassword(true);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr) throw userErr;

    const authEmail = (userRes?.user?.email ?? email).trim().toLowerCase();

    // 1) verify current password (your existing logic)
    const { data: ok, error: checkErr } = await supabase.rpc('check_email_password', {
      p_email: authEmail,
      p_password: currentPassword,
    });

    if (checkErr) throw checkErr;
    if (!ok) return Alert.alert('Error', 'Current password is incorrect.');

    // 2) update password hash in user_profiles (your existing call)
    const { data: updated, error: updErr } = await supabase.rpc('update_my_password', {
      p_password: newPassword,
    });
    if (updErr) throw updErr;

    // 3) ✅ verify it REALLY saved (prevents “it said success but didn’t update”)
    const { data: okNew, error: verifyErr } = await supabase.rpc('check_email_password', {
      p_email: authEmail,
      p_password: newPassword,
    });

    if (verifyErr) throw verifyErr;
    if (!okNew) {
      throw new Error('Password update failed to persist in database (hash did not change).');
    }

    Alert.alert('Success', 'Password updated.');
    setChangingPassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  } catch (e) {
    Alert.alert('Failed', e?.message || 'Could not update password.');
  } finally {
    setBusyPassword(false);
  }
};


  // ---------- avatar pick / preview ----------
  const openPicker = () => {
    Alert.alert('Upload Photo', 'Choose source', [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Gallery', onPress: chooseFromGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const takePhoto = async () => {
    try {
      const ok = await ensureCameraPermission();
      if (!ok) return Alert.alert('Permission denied', 'Camera permission is required.');

      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.7,
      });

      if (res.canceled) return;
      const uri = res.assets?.[0]?.uri;
      if (!uri) return;

      setPendingUri(uri);
      setPreviewVisible(true);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to open camera.');
    }
  };

  const chooseFromGallery = async () => {
    try {
      const ok = await ensureGalleryPermission();
      if (!ok) return Alert.alert('Permission denied', 'Gallery permission is required.');

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: IMAGE_MEDIA_TYPES,
        allowsEditing: false,
        quality: 0.7,
      });

      if (res.canceled) return;
      const uri = res.assets?.[0]?.uri;
      if (!uri) return;

      setPendingUri(uri);
      setPreviewVisible(true);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to open gallery.');
    }
  };

  // ---------- avatar upload ----------
  const uploadAvatarToSupabase = async (imageUri) => {
    setAvatarUploading(true);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const user = userRes?.user;
      if (!user?.id) throw new Error('Not logged in');

      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const arrayBuffer = decode(base64);

      const extGuess = (() => {
        const lower = String(imageUri).toLowerCase();
        if (lower.endsWith('.png')) return 'png';
        if (lower.endsWith('.webp')) return 'webp';
        return 'jpg';
      })();

      const contentType =
        extGuess === 'png' ? 'image/png' : extGuess === 'webp' ? 'image/webp' : 'image/jpeg';

      const filePath = `${user.id}/avatar.${extGuess}`;

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, {
          upsert: true,
          contentType,
        });

      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) throw new Error('Failed to get public URL');

      const { error: dbErr } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (dbErr) throw dbErr;

      // ✅ CRITICAL: clear cache so Menu/Dashboard/Contacts fetch the new photo
      clearAvatarCache(user.id);

      setAvatarUrl(publicUrl);
      setAvatarCacheBust(Date.now());
      Alert.alert('Saved', 'Profile photo updated.');
    } catch (e) {
      console.log('[AccountSettings] avatar upload error:', e);
      Alert.alert('Upload failed', e?.message || 'Could not upload photo.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const avatarDisplayUri = avatarUrl ? `${avatarUrl}?t=${avatarCacheBust}` : null;

  // ---------- UI ----------
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <TouchableOpacity onPress={onBack} style={{ marginBottom: 16 }}>
          <Ionicons name="chevron-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.profileContainer}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={openPicker}
            disabled={avatarUploading}
            style={[styles.avatar, { backgroundColor: theme.primary }]}
          >
            {avatarDisplayUri ? (
              <Image source={{ uri: avatarDisplayUri }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Ionicons name="person" size={48} color="white" />
            )}

            {avatarUploading && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={openPicker} disabled={avatarUploading}>
            <Text style={[styles.changePhotoText, { color: theme.primary }]}>
              {avatarUploading ? 'Uploading…' : 'Upload Photo'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Preview Modal */}
        <Modal visible={previewVisible} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Preview</Text>

              {pendingUri ? (
                <Image source={{ uri: pendingUri }} style={styles.previewImage} />
              ) : (
                <View style={[styles.previewImage, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: '#6B7280' }}>No image</Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
                <TouchableOpacity
                  style={[styles.outlineButton, { flex: 1 }]}
                  onPress={() => {
                    setPreviewVisible(false);
                    setPendingUri(null);
                  }}
                  disabled={avatarUploading}
                >
                  <Text style={styles.outlineButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryButton, { flex: 1 }]}
                  onPress={async () => {
                    if (!pendingUri) return;
                    setPreviewVisible(false);
                    await uploadAvatarToSupabase(pendingUri);
                    setPendingUri(null);
                  }}
                  disabled={avatarUploading}
                >
                  <Text style={styles.buttonText}>{avatarUploading ? 'Uploading…' : 'Upload'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* rest of your UI unchanged */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Profile Information</Text>

          <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
          <TextInput
  style={[
    styles.input,
    { backgroundColor: theme.disabledInputBackground, color: theme.inputText },
  ]}
  value={email}
  editable={false}
/>
          <Text style={[styles.label, { color: theme.textSecondary }]}>First Name</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: editing
                  ? theme.inputBackground
                  : theme.disabledInputBackground, 
                color: theme.inputText,
              },
            ]}
            value={firstName}
            editable={editing && !saving}
            onChangeText={setFirstName}
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>Last Name</Text>
          
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: editing
                  ? theme.inputBackground
                  : theme.disabledInputBackground, 
                color: theme.inputText,
              },
            ]}
            value={lastName}
            editable={editing && !saving}
            onChangeText={setLastName}
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>Phone Number</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.disabledInputBackground, color: theme.inputText },
            ]}
            value={phone}
            editable={false}
          />
          <Text style={styles.note}>Phone number cannot be changed</Text>

          {!editing ? (
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={() => setEditing(true)}>
              <Text style={styles.buttonText}>Edit Profile</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={styles.outlineButton} onPress={() => setEditing(false)} disabled={saving}>
                <Text style={[styles.outlineButtonText, { color: theme.idleText }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]}
              onPress={handleSave}
              disabled={saving}
            >
                <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>

          {!changingPassword ? (
            <TouchableOpacity style={styles.outlineButton} onPress={() => setChangingPassword(true)}>
              <Text style={[styles.outlineButtonText, { color: theme.primary }]}>Change Password</Text>
            </TouchableOpacity>
          ) : (
            <>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Current Password</Text>
              <TextInput
                style={[ styles.input, { backgroundColor: theme.inputBackground, color: theme.inputText }, ]}
                secureTextEntry
                placeholder="Enter current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                editable={!busyPassword}
              />

              <Text style={[styles.label, { color: theme.textSecondary }]}>New Password</Text>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: theme.inputBackground, 
                    color: theme.inputText
                  }
                ]}
                secureTextEntry
                placeholder="Enter new password"
                placeholderTextColor={theme.placeholderText}
                value={newPassword}
                onChangeText={setNewPassword}
                editable={!busyPassword}
              />

              <Text style={[styles.label, { color: theme.textSecondary }]}>Confirm New Password</Text>
              <TextInput
                style={[
                  styles.input,
                  { 
                    backgroundColor: theme.inputBackground,
                    color: theme.inputText
                  },
                ]}
                secureTextEntry
                placeholder="Confirm new password"
                placeholderTextColor={theme.placeholderText}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!busyPassword}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={styles.outlineButton}
                  onPress={() => {
                    setChangingPassword(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  disabled={busyPassword}
                >
                  <Text style={[styles.outlineButtonText, { color: theme.idleText }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButton} onPress={handleChangePassword} disabled={busyPassword}>
                  <Text style={styles.buttonText}>{busyPassword ? 'Updating…' : 'Update Password'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { backgroundColor: '#1E40AF', padding: 16, paddingTop: 40 },
  headerTitle: { fontSize: 24, color: 'white', fontWeight: 'bold' },
  profileContainer: { alignItems: 'center', marginBottom: 24 },

  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1E40AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  avatarOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  changePhotoText: { color: '#2563EB', fontSize: 14 },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  label: { fontSize: 14, color: '#374151', marginBottom: 4 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  disabledInput: { backgroundColor: '#F3F4F6' },
  note: { fontSize: 12, color: '#6B7280', marginBottom: 12 },

  primaryButton: {
    flex: 1,
    backgroundColor: '#1E40AF',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { color: 'white', fontWeight: 'bold' },

  outlineButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outlineButtonText: { color: '#374151', fontWeight: 'bold' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, color: '#111827' },
  previewImage: {
    width: '100%',
    height: 320,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
});
