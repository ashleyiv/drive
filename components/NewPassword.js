// driveash/components/NewPassword.js
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function NewPassword({ onSubmit, onBack }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const MAX_PW = 30;
  const hasUpper = (s) => /[A-Z]/.test(s);
  const hasNumber = (s) => /\d/.test(s);
  const hasSpecial = (s) => /[^A-Za-z0-9]/.test(s);

  const strength = useMemo(() => {
    const p = String(password || '');

    if (!p) return { label: null, level: 0 };

    // level: 1..3
    let points = 0;
    if (p.length >= 8) points++;
    if (p.length >= 12) points++;
    if (hasUpper(p) && hasNumber(p) && hasSpecial(p)) points++;

    if (points <= 1) return { label: 'Weak', level: 1 };
    if (points === 2) return { label: 'Medium', level: 2 };
    return { label: 'Strong', level: 3 };
  }, [password]);

  const errors = useMemo(() => {
    const e = {};
    const p = String(password || '');
    const c = String(confirm || '');

    if (!p) e.password = 'Password is required';
    else if (p.length < 8) e.password = 'Password must be at least 8 characters';
    else if (p.length > MAX_PW) e.password = 'Password must not exceed 30 characters';
    else if (!hasUpper(p)) e.password = 'Password must contain at least 1 uppercase letter';
    else if (!hasNumber(p)) e.password = 'Password must contain at least 1 number';
    else if (!hasSpecial(p)) e.password = 'Password must contain at least 1 special character';

    if (!c) e.confirm = 'Confirm your password';
    else if (c.length > MAX_PW) e.confirm = 'Password must not exceed 30 characters';
    else if (p !== c) e.confirm = 'Passwords do not match';

    return e;
  }, [password, confirm]);

  const canSubmit = Object.keys(errors).length === 0 && !loading;

  const handleSave = async () => {
    if (loading) return;

    if (errors.password || errors.confirm) {
      Alert.alert('Fix required', errors.password || errors.confirm);
      return;
    }

    try {
      setLoading(true);
      const res = await Promise.resolve(onSubmit?.(password));
      if (res?.ok === false) {
        // App.js already shows alerts, but this keeps it safe
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create New Password</Text>
      <Text style={styles.subtitle}>Enter and confirm your new password.</Text>

      <Text style={styles.label}>New Password</Text>
      <View style={styles.inputWrap}>
        <Feather name="lock" size={18} color="#6B7280" style={{ marginRight: 8 }} />
       <TextInput
  value={password}
  onChangeText={(t) => setPassword(String(t ?? '').slice(0, 30))}
  maxLength={30}

          placeholder="New password"
          secureTextEntry={!show}
          style={styles.input}
          editable={!loading}
        />
        <Pressable onPress={() => setShow((s) => !s)} disabled={loading}>
          <Feather name={show ? 'eye-off' : 'eye'} size={18} color="#6B7280" />
        </Pressable>
      </View>
      {!!errors.password && <Text style={styles.error}>{errors.password}</Text>}
      {!!password && (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.meterText}>
            Strength: {strength.label}
          </Text>

          <View style={styles.meterTrack}>
            <View
              style={[
                styles.meterFill,
                {
                  width: strength.level === 1 ? '33%' : strength.level === 2 ? '66%' : '100%',
                  backgroundColor:
                    strength.level === 1 ? '#DC2626' : strength.level === 2 ? '#F59E0B' : '#10B981',
                },
              ]}
            />
          </View>
        </View>
      )}

      <Text style={[styles.label, { marginTop: 14 }]}>Confirm Password</Text>
      <View style={styles.inputWrap}>
        <Feather name="check" size={18} color="#6B7280" style={{ marginRight: 8 }} />
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Confirm password"
          secureTextEntry={!show}
          style={styles.input}
          editable={!loading}
        />
      </View>
      {!!errors.confirm && <Text style={styles.error}>{errors.confirm}</Text>}

      <Pressable
        onPress={handleSave}
        disabled={!canSubmit}
        style={[styles.primaryBtn, !canSubmit && { opacity: 0.7 }]}
      >
        {loading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.primaryText}>Saving…</Text>
          </View>
        ) : (
          <Text style={styles.primaryText}>Save New Password</Text>
        )}
      </Pressable>

      <Pressable onPress={onBack} disabled={loading} style={styles.backBtn}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 40,
  },
  title: { fontSize: 22, fontWeight: '900', color: '#111827', textAlign: 'center' },
  subtitle: { marginTop: 8, fontSize: 13, fontWeight: '700', color: '#6B7280', textAlign: 'center' },

  label: { marginTop: 24, fontSize: 14, fontWeight: '800', color: '#374151' },
  inputWrap: {
    marginTop: 8,
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: { flex: 1, fontSize: 16, color: '#111827' },

  error: { marginTop: 6, fontSize: 12, color: '#DC2626', fontWeight: '700' },

  primaryBtn: {
    marginTop: 22,
    height: 48,
    backgroundColor: '#1E3A8A',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '900' },

  backBtn: { marginTop: 14, alignItems: 'center', paddingVertical: 10 },
  backText: { color: '#2563EB', fontSize: 14, fontWeight: '800' },
    meterText: { fontSize: 12, fontWeight: '800', color: '#374151' },
  meterTrack: {
    height: 8,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    marginTop: 6,
    overflow: 'hidden',
  },
  meterFill: {
    height: 8,
    borderRadius: 8,
  },

});
