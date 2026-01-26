import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useTheme from '../theme/useTheme';

const handleLoginSuccess = async () => {
  // Reset coach mark for this session
  await AsyncStorage.removeItem('seenBluetoothCoachmark');

  // Navigate to dashboard
  navigation.replace('Dashboard');
};


export default function LoginScreen({ onLogin, onForgotPassword, onSignup }) {
  const { theme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // keep your errors object (non-breaking)
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  // ✅ added: loading state for verify animation (kept)
  const [loading, setLoading] = useState(false);

  // ✅ show validations ONLY after focusing/tapping a field
  const [touched, setTouched] = useState({ email: false, password: false });

  // ✅ avoid setting state if screen unmounts while navigating
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ✅ minimum time to show loader (kept)
  const MIN_LOADING_MS = 500;
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  // ==========================
  // STRICT VALIDATORS
  // ==========================
  const getEmailError = (raw) => {
    const v = String(raw ?? '').trim().toLowerCase();

    if (!v) return 'Email is required';
    // invalid if > 45
    if (v.length > 45) return 'Email must not exceed 45 characters';

    // must contain exactly one @
    const atCount = (v.match(/@/g) || []).length;
    if (atCount !== 1) return 'Please ensure to input proper email address';

    const [local, domain] = v.split('@');

    // local must exist
    if (!local) return 'Please ensure to input proper email address';

    // domain must exist
    if (!domain) return 'Please ensure to input proper email address';

    // no double dots after @ (e.g. gmail..com)
    if (domain.includes('..')) return 'Please ensure to input proper email address';

  

    // local part basic safety (dots allowed before @)
    // (prevents weird symbols/spam patterns)
    const localOk = /^[a-z0-9._%+-]+$/.test(local);
    if (!localOk) return 'Please ensure to input proper email address';

    // must not start or end with dot (optional but helps “real email”)
    if (local.startsWith('.') || local.endsWith('.')) return 'Please ensure to input proper email address';

    // no consecutive dots in local (optional but common “real” rule)
    if (local.includes('..')) return 'Please ensure to input proper email address';

    return null;
  };

  const getPasswordError = (raw) => {
    const v = String(raw ?? '');

    if (!v) return 'Password is required';
    // must not exceed 30 chars
    if (v.length > 30) return 'Password must not exceed 30 characters';
    return null;
  };

  // realtime errors (ONLY show when field touched)
  const realtimeEmailError = useMemo(() => getEmailError(email), [email]);
  const realtimePasswordError = useMemo(() => getPasswordError(password), [password]);

  const validateForm = () => {
    const newErrors = {};

    const emailErr = getEmailError(email);
    if (emailErr) newErrors.email = emailErr;

    const passErr = getPasswordError(password);
    if (passErr) newErrors.password = passErr;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (loading) return; // ✅ prevent double tap

    // show validations after attempting submit
    setTouched({ email: true, password: true });

    if (!validateForm()) return;

    const start = Date.now();

    try {
      setLoading(true);
      await Promise.resolve(onLogin({ email, password }));
    } catch {
      // App.js should handle Alerts; don't crash UI.
    } finally {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
      if (remaining) await sleep(remaining);

      if (isMountedRef.current) setLoading(false);
    }
  };

  // NOTE: Keeping handleGoogle function (non-breaking), but Google UI is removed.
  const handleGoogle = async () => {
    if (loading) return;

    const start = Date.now();

    try {
      setLoading(true);
      await Promise.resolve(onLogin('google'));
    } catch {
      // App.js should handle Alerts; don't crash UI.
    } finally {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
      if (remaining) await sleep(remaining);

      if (isMountedRef.current) setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, {backgroundColor: theme.background}]} keyboardShouldPersistTaps="handled">
      <View style={styles.spacer} />

      <Text style={[styles.title, {color: theme.textPrimary }]}>Log in to DRIVE</Text>
      <Text style={[styles.description, {color: theme.textPrimary}]}>Welcome to D.R.I.V.E! Please enter your details.</Text>

      {/* EMAIL */}
      <View style={styles.field}>
        <Text style={[styles.label, {color: theme.textSecondary }]}>Email</Text>
        <View
  style={[
    styles.inputWrapper,
    {
      backgroundColor: loading
        ? theme.inputBackground
        : theme.disabledInputBackground,
      borderColor: theme.border,
    },
  ]}
>

          <Feather name="mail" size={18} style={[
    styles.icon,
    { color: theme.primary },
  ]} />
          <TextInput
            placeholder="you@gmail.com"
            placeholderTextColor={theme.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={(t) => {
              // hard stop at 55 characters (prevents loopholes)
              const capped = String(t ?? '').slice(0, 55);
              setEmail(capped);

              // clear stored submit errors while typing
              if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
            }}
            onFocus={() => setTouched((p) => ({ ...p, email: true }))}
            style={[
    styles.input,
    { color: theme.inputText },
  ]}
            editable={!loading}
            maxLength={55}
          />
        </View>

        {/* show ONLY after tapping/focus */}
        {touched.email && !!realtimeEmailError && (
  <Text style={[styles.error, { color: theme.danger }]}>
    {realtimeEmailError}
  </Text>
)}
      </View>

      {/* PASSWORD */}
      <View style={styles.field}>
        <Text style={[styles.label, {color: theme.textSecondary }]}>Password</Text>
        <View
  style={[
    styles.inputWrapper,
    {
      backgroundColor: loading
        ? theme.inputBackground
        : theme.disabledInputBackground,
      borderColor: theme.border,
    },
  ]}
>

          <Feather name="lock" size={18} style={[
    styles.icon,
    { color: theme.primary },
  ]} />
          <TextInput
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={(t) => {
              // hard stop at 30 chars
              const capped = String(t ?? '').slice(0, 30);
              setPassword(capped);

              if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
            }}
            onFocus={() => setTouched((p) => ({ ...p, password: true }))}
            style={[
    styles.input,
    { color: theme.inputText },
  ]}
            editable={!loading}
            maxLength={30}
          />
          <Pressable onPress={() => setShowPassword(!showPassword)} disabled={loading}>
            <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={theme.textSecondary} />
          </Pressable>
        </View>

        {touched.password && !!realtimePasswordError && (
  <Text style={[styles.error, { color: theme.danger }]}>
    {realtimePasswordError}
  </Text>
)}
</View>

      <Pressable
  style={[
    styles.loginButton,
    {
      backgroundColor: loading
        ? theme.buttonDisabled
        : theme.primary,
    },
  ]}
  onPress={handleSubmit}
  disabled={loading}
>

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={[styles.loginText, { color: theme.textPrimary }]}>Verifying...</Text>

          </View>
        ) : (
          <Text style={[styles.loginText, { color: theme.textPrimary }]}>Log in</Text>

        )}
      </Pressable>

      {/* ✅ Google button REMOVED (as requested) */}

      <Pressable onPress={onForgotPassword} disabled={loading}>
        <Text style={[styles.forgot, {color: theme.tabBg }]}>Forgot password?</Text>
      </Pressable>

      <View style={styles.signupContainer}>
        <Text style={[styles.signupText, {color: theme.textSecondary }]}>Don't have an account? </Text>
        <Pressable onPress={onSignup} disabled={loading}>
          <Text style={[styles.signupLink, {color: theme.tabBg }]}>Sign Up</Text>
        </Pressable>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 40,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  spacer: { height: 100 },
  title: { fontSize: 32, fontWeight: '600', textAlign: 'center', color: '#111827' },
  description: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  field: { marginBottom: 16 },
  label: { fontSize: 16, color: '#374151', marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 12,
  },
  disabledField: { opacity: 0.7 },
  icon: { fontSize: 18, marginRight: 8 },
  input: { flex: 1, fontSize: 16 },
  error: { color: '#DC2626', fontSize: 12, marginTop: 6, fontWeight: '700' },

  loginButton: {
    height: 48,
    backgroundColor: '#1E3A8A',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  loginButtonDisabled: { opacity: 0.7 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loginText: { fontSize: 16, fontWeight: '600' },

  forgot: { marginTop: 16, color: '#2563EB', fontSize: 14, textAlign: 'center' },

  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signupText: { fontSize: 14, color: '#4B5563' },
  signupLink: { fontSize: 14, color: '#2563EB', fontWeight: '500' },
  bottomSpacer: { height: 40 },
});
