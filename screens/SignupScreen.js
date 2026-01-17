import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { normalizePHToDigits10, normalizePHToE164 } from '../lib/phonePH';
import AsyncStorage from '@react-native-async-storage/async-storage';

const handleLoginSuccess = async () => {
  // Reset coach mark for this session
  await AsyncStorage.removeItem('seenBluetoothCoachmark');

  // Navigate to dashboard
  navigation.replace('Dashboard');
};


export default function SignupScreen({ onSignup, onBackToLogin }) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  // store only digits after +63 (10 digits)
  const [phoneDigits, setPhoneDigits] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ✅ toggle eye buttons
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // ✅ keep (non-breaking) but we won't render from this directly anymore
  const [errors, setErrors] = useState({});

  // ✅ added: loading state
  const [loading, setLoading] = useState(false);

  // ✅ NEW: touched flags (NO validation shown until field is focused/tapped)
  const [touched, setTouched] = useState({
    email: false,
    firstName: false,
    lastName: false,
    phone: false,
    password: false,
    confirm: false,
    terms: false,
  });

  // ✅ added: avoid setState after navigation/unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ✅ added: minimum time to show loader
  const MIN_LOADING_MS = 500;
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  // =========================
  // VALIDATION HELPERS (REALTIME)
  // =========================
  const emailError = useMemo(() => {
  const raw = String(email || '').trim();

  if (!raw) return 'Email is required.';
  if (raw.length > 45) return 'Email must not exceed 45 characters.';

  // must contain exactly one "@"
  const atCount = (raw.match(/@/g) || []).length;
  if (atCount !== 1) return 'Email must contain exactly one @.';

  const [local, domainRaw] = raw.split('@');
  const domain = String(domainRaw || '').trim().toLowerCase();

  // allow dots before @, but local part must exist and not contain spaces
  if (!local || /\s/.test(local)) return 'Please enter a valid email.';
  if (/\s/.test(domain)) return 'Please enter a valid email.';

  // IMPORTANT: only real providers allowed (as requested)
  const allowedDomains = ['gmail.com', 'yahoo.com'];
  if (!allowedDomains.includes(domain)) return 'Email must end with @gmail.com or @yahoo.com.';

  // prevents gmail..com etc (extra safety even though allowlist already blocks variants)
  if (domain.includes('..')) return 'Email domain is invalid.';

  // basic local-part format: allow dots, letters, numbers, underscores, hyphens
  // (you said dots before @ are allowed)
  const localOk = /^[A-Za-z0-9._-]+$/.test(local);
  if (!localOk) return 'Email contains invalid characters.';

  return '';
}, [email]);


  const firstNameError = useMemo(() => {
    const v = String(firstName || '').trim();
    if (!v) return 'First name is required.';
    // no numbers allowed
    if (/\d/.test(v)) return 'First name must not contain numbers.';
    // max 20 letters (count letters only)
    const letters = (v.match(/[A-Za-z]/g) || []).length;
    if (letters > 20) return 'First name must not exceed 20 letters.';
    // must contain at least 1 letter
    if (letters === 0) return 'First name must contain letters only.';
    return '';
  }, [firstName]);

  const lastNameError = useMemo(() => {
    const v = String(lastName || '').trim();
    if (!v) return 'Last name is required.';
    if (/\d/.test(v)) return 'Last name must not contain numbers.';
    const letters = (v.match(/[A-Za-z]/g) || []).length;
    if (letters > 20) return 'Last name must not exceed 20 letters.';
    if (letters === 0) return 'Last name must contain letters only.';
    return '';
  }, [lastName]);

  const phoneError = useMemo(() => {
    const v = String(phoneDigits || '').trim();
    if (!v) return 'Phone number is required.';
    if (v.length !== 10) return 'Enter 10 digits after +63 (9XXXXXXXXX).';
    if (!v.startsWith('9')) return 'PH mobile numbers must start with 9.';
    return '';
  }, [phoneDigits]);

  const passwordRules = useMemo(() => {
    const p = String(password || '');

    const hasMinLen = p.length >= 8;
    const hasUpper = /[A-Z]/.test(p);
    const hasNumOrSymbol = /[\d\W]/.test(p); // number OR symbol
    const hasLower = /[a-z]/.test(p);

    return { hasMinLen, hasUpper, hasNumOrSymbol, hasLower };
  }, [password]);

  const passwordError = useMemo(() => {
    if (!String(password || '')) return 'Password is required.';
    if (!passwordRules.hasMinLen) return 'Password must be at least 8 characters.';
    if (!passwordRules.hasUpper) return 'Password must contain at least 1 uppercase letter.';
    if (!passwordRules.hasNumOrSymbol) return 'Password must contain at least 1 number or symbol.';
    return '';
  }, [password, passwordRules]);

  const confirmError = useMemo(() => {
    const c = String(confirmPassword || '');
    if (!c) return 'Confirm password is required.';
    if (String(password || '') !== c) return 'Passwords do not match.';
    return '';
  }, [confirmPassword, password]);

  const termsError = useMemo(() => {
    if (!agreedToTerms) return 'You must agree to the terms and conditions.';
    return '';
  }, [agreedToTerms]);

  const passwordStrength = useMemo(() => {
    // simple strength scoring
    const p = String(password || '');
    if (!p) return { label: '', score: 0 };

    let score = 0;
    if (passwordRules.hasMinLen) score += 1;
    if (passwordRules.hasUpper) score += 1;
    if (passwordRules.hasNumOrSymbol) score += 1;
    if (passwordRules.hasLower) score += 1;
    if (p.length >= 12) score += 1;

    // 0-2 weak, 3-4 medium, 5 strong
    const label = score <= 2 ? 'Weak' : score <= 4 ? 'Medium' : 'Strong';
    return { label, score };
  }, [password, passwordRules]);

  // ✅ Button should only be active when ALL are valid + checkbox checked (even if not touched)
  const formReady = useMemo(() => {
    const allValid =
      !emailError &&
      !firstNameError &&
      !lastNameError &&
      !phoneError &&
      !passwordError &&
      !confirmError &&
      agreedToTerms;

    return allValid && !loading;
  }, [emailError, firstNameError, lastNameError, phoneError, passwordError, confirmError, agreedToTerms, loading]);

  // ✅ show validation only when that field has been focused/tapped
  const uiEmailError = touched.email ? emailError : '';
  const uiFirstNameError = touched.firstName ? firstNameError : '';
  const uiLastNameError = touched.lastName ? lastNameError : '';
  const uiPhoneError = touched.phone ? phoneError : '';
  const uiPasswordError = touched.password ? passwordError : '';
  const uiConfirmError = touched.confirm ? confirmError : '';
  const uiTermsError = touched.terms ? termsError : '';

  const validateForm = () => {
    const newErrors = {};
    if (emailError) newErrors.email = emailError;
    if (firstNameError) newErrors.firstName = firstNameError;
    if (lastNameError) newErrors.lastName = lastNameError;
    if (phoneError) newErrors.phoneNumber = phoneError;
    if (passwordError) newErrors.password = passwordError;
    if (confirmError) newErrors.confirmPassword = confirmError;
    if (!agreedToTerms) newErrors.terms = termsError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ✅ same logic, just wrapped to show loader + min delay
  const handleSubmit = async () => {
    if (loading) return;

    // If user somehow presses (should be disabled), still validate safely
    if (!validateForm()) {
      Alert.alert('Fix required', 'Please check your inputs.');
      return;
    }

    const phoneE164 = normalizePHToE164(`+63${phoneDigits}`);
    if (!phoneE164) {
      Alert.alert('Invalid phone', 'Please enter a valid PH mobile number.');
      return;
    }

    const start = Date.now();

    try {
      setLoading(true);
      await Promise.resolve(
        onSignup({
          email: String(email).trim().toLowerCase(),
          firstName: String(firstName).trim(),
          lastName: String(lastName).trim(),
          phone: phoneE164, // ✅ already +63XXXXXXXXXX
          password,
        })
      );
    } finally {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
      if (remaining) await sleep(remaining);

      if (isMountedRef.current) setLoading(false);
    }
  };

  if (showTerms) {
    return (
      <View style={styles.container}>
        <Pressable
          style={styles.backButton}
          onPress={() => !loading && setShowTerms(false)}
          disabled={loading}
        >
          <Ionicons name="chevron-back" size={24} color="#111827" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.title}>Terms and Conditions</Text>
        <ScrollView style={styles.termsContainer} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By using the DRIVE drowsiness detection application, you agree to be bound by these Terms and Conditions.
          </Text>

          <Text style={styles.sectionTitle}>2. Use of Service</Text>
          <Text style={styles.paragraph}>
            The DRIVE app monitors driver drowsiness and provides alerts. It does not replace responsible driving.
          </Text>

          <Text style={styles.sectionTitle}>3. Data Collection</Text>
          <Text style={styles.paragraph}>
            The app collects data including eye-lid monitoring, steering wheel grip, yawning, head tilting, and location during drowsiness events.
          </Text>

          <Text style={styles.sectionTitle}>4. Privacy</Text>
          <Text style={styles.paragraph}>
            Your data is stored securely and will not be shared without consent, except as required by law.
          </Text>

          <Text style={styles.sectionTitle}>5. Liability</Text>
          <Text style={styles.paragraph}>
            DRIVE is an assistive technology. Users remain responsible for safe driving.
          </Text>

          <Text style={styles.sectionTitle}>6. Emergency Contacts</Text>
          <Text style={styles.paragraph}>
            You authorize the app to contact your emergency contacts in critical events.
          </Text>

          <Text style={styles.sectionTitle}>7. Updates</Text>
          <Text style={styles.paragraph}>
            Terms may be updated at any time. Continued use constitutes acceptance.
          </Text>
        </ScrollView>

        <Pressable
          style={[styles.primaryButton, loading && styles.disabledButton]}
          onPress={() => !loading && setShowTerms(false)}
          disabled={loading}
        >
          <Text style={styles.primaryText}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={onBackToLogin} style={styles.backButton} disabled={loading}>
            <Ionicons name="chevron-back" size={24} color="#111827" />
            <Text style={styles.backText}>Back to Login</Text>
          </Pressable>

          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to start using DRIVE</Text>

          {/* Email */}
          {renderInput({
            label: 'Email',
            value: email,
            onChange: (t) => setEmail(String(t || '')),
            keyboardType: 'email-address',
            lower: true,
            disabled: loading,
            maxLength: 45,
            onFocus: () => setTouched((s) => ({ ...s, email: true })),
          })}
          {!!uiEmailError && <Text style={styles.error}>{uiEmailError}</Text>}

          {/* First Name */}
          {renderInput({
            label: 'First Name',
            value: firstName,
            onChange: (t) => setFirstName(String(t || '')),
            keyboardType: 'default',
            disabled: loading,
            onFocus: () => setTouched((s) => ({ ...s, firstName: true })),
          })}
          {!!uiFirstNameError && <Text style={styles.error}>{uiFirstNameError}</Text>}

          {/* Last Name */}
          {renderInput({
            label: 'Last Name',
            value: lastName,
            onChange: (t) => setLastName(String(t || '')),
            keyboardType: 'default',
            disabled: loading,
            onFocus: () => setTouched((s) => ({ ...s, lastName: true })),
          })}
          {!!uiLastNameError && <Text style={styles.error}>{uiLastNameError}</Text>}

          {/* Phone */}
          <View style={styles.field}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={[styles.phoneRow, loading && styles.disabledField]}>
              <Text style={styles.phonePrefix}>+63</Text>
              <TextInput
                style={styles.phoneInput}
                placeholder="9XXXXXXXXX"
                keyboardType="phone-pad"
                value={phoneDigits}
                onChangeText={(t) => setPhoneDigits(normalizePHToDigits10(t))}
                maxLength={10}
                editable={!loading}
                onFocus={() => setTouched((s) => ({ ...s, phone: true }))}
              />
            </View>
          </View>
          {!!uiPhoneError && <Text style={styles.error}>{uiPhoneError}</Text>}

          {/* Password (with eye) */}
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.passwordRow, loading && styles.disabledField]}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                secureTextEntry={!showPassword}
                editable={!loading}
                onFocus={() => setTouched((s) => ({ ...s, password: true }))}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                disabled={loading}
                hitSlop={10}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#6B7280"
                />
              </Pressable>
            </View>

            {/* strength meter (only after user focused password) */}
            {touched.password && password ? (
              <Text style={styles.strengthText}>
                Strength: <Text style={styles.strengthBold}>{passwordStrength.label}</Text>
              </Text>
            ) : null}
          </View>
          {!!uiPasswordError && <Text style={styles.error}>{uiPasswordError}</Text>}

          {/* Confirm Password (with eye) */}
          <View style={styles.field}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={[styles.passwordRow, loading && styles.disabledField]}>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm password"
                secureTextEntry={!showConfirm}
                editable={!loading}
                onFocus={() => setTouched((s) => ({ ...s, confirm: true }))}
              />
              <Pressable
                onPress={() => setShowConfirm((v) => !v)}
                disabled={loading}
                hitSlop={10}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#6B7280"
                />
              </Pressable>
            </View>
          </View>
          {!!uiConfirmError && <Text style={styles.error}>{uiConfirmError}</Text>}

          {/* Terms */}
          <Pressable
            style={[styles.termsRow, loading && styles.disabledField]}
            onPress={() => {
              if (loading) return;
              setTouched((s) => ({ ...s, terms: true }));
              setAgreedToTerms((v) => !v);
            }}
            disabled={loading}
          >
            <Text style={styles.checkbox}>{agreedToTerms ? '☑' : '☐'}</Text>
            <Text style={styles.termsText}>
              I agree to the{' '}
              <Text style={styles.link} onPress={() => !loading && setShowTerms(true)}>
                Terms and Conditions
              </Text>
            </Text>
          </Pressable>
          {!!uiTermsError && <Text style={styles.error}>{uiTermsError}</Text>}

          {/* Sign up */}
          <Pressable
            style={[styles.primaryButton, !formReady && styles.disabledButton]}
            disabled={!formReady}
            onPress={handleSubmit}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.primaryText}>Creating...</Text>
              </View>
            ) : (
              <Text style={styles.primaryText}>Sign Up</Text>
            )}
          </Pressable>

          {/* ✅ Google button REMOVED (as requested) */}
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

function renderInput({
  label,
  value,
  onChange,
  keyboardType = 'default',
  secure = false,
  lower = false,
  disabled = false,
  maxLength,
  onFocus,
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, disabled && styles.disabledField]}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        secureTextEntry={secure}
        autoCapitalize={lower ? 'none' : 'words'}
        autoCorrect={false}
        editable={!disabled}
        maxLength={maxLength}
        onFocus={onFocus}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#fff', padding: 24, paddingBottom: 28 },

  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backText: { fontSize: 16, color: '#111827', marginLeft: 8, fontWeight: '600' },

  title: { fontSize: 30, fontWeight: '900', marginBottom: 4, color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 18, fontWeight: '700' },

  field: { marginBottom: 12 },
  label: { fontSize: 14, marginBottom: 6, color: '#111827', fontWeight: '800' },

  input: {
    height: 54,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fff',
  },

  error: { color: '#DC2626', fontSize: 13, marginBottom: 8, fontWeight: '800' },

  disabledField: { opacity: 0.7 },

  phoneRow: {
    height: 54,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },
  phonePrefix: { fontSize: 16, marginRight: 12, color: '#111827', fontWeight: '900' },
  phoneInput: { flex: 1, fontSize: 16, color: '#111827' },

  passwordRow: {
    height: 54,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },
  passwordInput: { flex: 1, fontSize: 16, color: '#111827' },
  eyeBtn: { paddingLeft: 10, paddingVertical: 6 },

  strengthText: { marginTop: 8, fontSize: 12, color: '#6B7280', fontWeight: '700' },
  strengthBold: { fontWeight: '900', color: '#111827' },

  termsRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10, marginBottom: 6 },
  checkbox: { fontSize: 18, marginRight: 10, marginTop: 1 },
  termsText: { fontSize: 14, color: '#111827', flex: 1, fontWeight: '700' },
  link: { color: '#2563EB', fontWeight: '900' },

  primaryButton: {
    backgroundColor: '#1E3A8A',
    height: 54,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  disabledButton: { opacity: 0.45 },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '900' },

  termsContainer: { flex: 1, marginVertical: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: 12, color: '#111827' },
  paragraph: { fontSize: 14, color: '#374151', marginTop: 6, lineHeight: 20 },
});
