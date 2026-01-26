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
import { checkPasswordBlacklist } from '../lib/passwordBlacklist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useTheme from '../theme/useTheme';
import TermsContent from '../components/TermsContent';

const handleLoginSuccess = async () => {
  // Reset coach mark for this session
  await AsyncStorage.removeItem('seenBluetoothCoachmark');

  // Navigate to dashboard
  navigation.replace('Dashboard');
};

function sanitizeNameInput(input) {
  // Keep only letters and spaces (numbers can NEVER persist)
  let v = String(input ?? '').replace(/[^A-Za-z ]+/g, '');

  // Collapse multiple spaces and trim ends
  v = v.replace(/ +/g, ' ').trim();

  // Allow up to 4 words (3 spaces)
  const parts = v.split(' ').filter(Boolean);
  return parts.slice(0, 4).join(' ');
}

export default function SignupScreen({
  onSignup,
  onBackToLogin,
  onCheckEmailExists, // ✅ NEW
  onCheckPhoneExists, // ✅ NEW
}) {

const [termsAtBottom, setTermsAtBottom] = useState(false);

  const { theme } = useTheme();
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
// ✅ server-side validation messages (duplicates)
const [remoteErrors, setRemoteErrors] = useState({ email: '', phone: '' });
const [checkingRemote, setCheckingRemote] = useState({ email: false, phone: false });


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

  // show only ONE message for invalid emails (as requested)
  const bad = () => 'Please ensure to input proper email address';

  if (!raw) return 'Email is required.';
  if (raw.length > 45) return 'Email must not exceed 45 characters.';

  // must contain exactly one "@"
  const atCount = (raw.match(/@/g) || []).length;
  if (atCount !== 1) return bad();

  const [local, domainRaw] = raw.split('@');
  const domain = String(domainRaw || '').trim().toLowerCase();

  // basic must-haves
  if (!local || !domain) return bad();
  if (/\s/.test(local) || /\s/.test(domain)) return bad();

  // domain should look real-ish: has a dot, no consecutive dots
  if (!domain.includes('.')) return bad();
  if (domain.startsWith('.') || domain.endsWith('.')) return bad();
  if (domain.includes('..')) return bad();

  // no weird chars in domain
  if (!/^[a-z0-9.-]+$/.test(domain)) return bad();

  // local part: allow letters/numbers/dot/underscore/hyphen (same as your old intent)
  if (!/^[A-Za-z0-9._-]+$/.test(local)) return bad();

  return '';
}, [email]);



  const firstNameError = useMemo(() => {
    const v = String(firstName || '').trim();
    if (!v) return 'First name is required.';
// letters only (no numbers / no special characters)
// allow up to 3 single spaces, no double spaces, no leading/trailing spaces
if (!/^[A-Za-z]+(?: [A-Za-z]+){0,3}$/.test(v))
  return 'First name must contain letters only and single spaces (no double spaces).';

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
    if (!/^[A-Za-z]+(?: [A-Za-z]+){0,3}$/.test(v))
  return 'Last name must contain letters only and single spaces (no double spaces).';


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
// =========================
// REALTIME DUPLICATE CHECKS (DEBOUNCED)
// =========================
useEffect(() => {
  let alive = true;

  // only check if user has interacted and local validation passes
  if (!touched.email) return;
  if (emailError) return;

  const t = setTimeout(async () => {
    if (!onCheckEmailExists) return;
    setCheckingRemote((s) => ({ ...s, email: true }));

    const res = await onCheckEmailExists(String(email || '').trim().toLowerCase());

    if (!alive) return;
    setCheckingRemote((s) => ({ ...s, email: false }));

    if (!res?.ok) return; // ignore network errors (don’t spam red)
    if (res.exists) {
      setRemoteErrors((e) => ({ ...e, email: 'This email is already existing. please choose another one.' }));
    } else {
      setRemoteErrors((e) => ({ ...e, email: '' }));
    }
  }, 450);

  return () => {
    alive = false;
    clearTimeout(t);
  };
}, [email, touched.email, emailError, onCheckEmailExists]);

useEffect(() => {
  let alive = true;

  if (!touched.phone) return;
  if (phoneError) return;

  const phoneE164 = normalizePHToE164(`+63${phoneDigits}`);
  if (!phoneE164) return;

  const t = setTimeout(async () => {
    if (!onCheckPhoneExists) return;
    setCheckingRemote((s) => ({ ...s, phone: true }));

    const res = await onCheckPhoneExists(phoneE164);

    if (!alive) return;
    setCheckingRemote((s) => ({ ...s, phone: false }));

    if (!res?.ok) return;
    if (res.exists) {
      setRemoteErrors((e) => ({ ...e, phone: 'This phone number is already existing. please choose another one.' }));
    } else {
      setRemoteErrors((e) => ({ ...e, phone: '' }));
    }
  }, 450);

  return () => {
    alive = false;
    clearTimeout(t);
  };
}, [phoneDigits, touched.phone, phoneError, onCheckPhoneExists]);

  const passwordRules = useMemo(() => {
    const p = String(password || '');

    const hasMinLen = p.length >= 8;
    const hasUpper = /[A-Z]/.test(p);
    const hasNumber = /\d/.test(p); // at least one digit
    const hasSymbol = /\W/.test(p); // at least one symbol
    const hasLower = /[a-z]/.test(p);

    return { hasMinLen, hasUpper, hasNumber, hasSymbol, hasLower };
  }, [password]);

  // ✅ NEW: Check password against blacklist
  const blacklistError = useMemo(() => {
    const p = String(password || '');
    if (!p) return '';
    
    // Check against blacklist with user context for personalization
    const error = checkPasswordBlacklist(p, {
      email,
      firstName,
      lastName,
      phone: phoneDigits,
    });
    
    return error;
  }, [password, email, firstName, lastName, phoneDigits]);

  const passwordError = useMemo(() => {
  // ✅ OTP signup: password is OPTIONAL
  const p = String(password || '');
  if (!p) return '';
  if (!passwordRules.hasMinLen) return 'Password must be at least 8 characters.';
  if (!passwordRules.hasUpper) return 'Password must contain at least 1 uppercase letter.';
  if (!passwordRules.hasNumber) return 'Password must contain at least 1 number.';
  if (!passwordRules.hasSymbol) return 'Password must contain at least 1 symbol.';
  // ✅ NEW: Check blacklist AFTER basic rules pass
  if (blacklistError) return blacklistError;
  return '';
}, [password, passwordRules, blacklistError]);

  const confirmError = useMemo(() => {
  // ✅ OTP signup: confirm is only required IF password is typed
  const p = String(password || '');
  const c = String(confirmPassword || '');

  if (!p && !c) return '';
  if (p && !c) return 'Confirm password is required.';
  if (p !== c) return 'Passwords do not match.';
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
    if (passwordRules.hasNumber) score += 1;
    if (passwordRules.hasSymbol) score += 1;
    if (passwordRules.hasLower) score += 1;
    if (p.length >= 12) score += 1;

    // 0-2 weak, 3-5 medium, 6 strong
    const label = score <= 2 ? 'Weak' : score <= 5 ? 'Medium' : 'Strong';
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
    agreedToTerms &&
    !remoteErrors.email &&
    !remoteErrors.phone &&
    !checkingRemote.email &&
    !checkingRemote.phone;

  return allValid && !loading;
}, [
  emailError, firstNameError, lastNameError, phoneError, passwordError, confirmError,
  agreedToTerms, loading, remoteErrors.email, remoteErrors.phone, checkingRemote.email, checkingRemote.phone
]);


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
    // ✅ only validate password/confirm if user typed password (OTP signup doesn't require it)
if (String(password || '').length > 0) {
  if (passwordError) newErrors.password = passwordError;
  if (confirmError) newErrors.confirmPassword = confirmError;
}

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
// ✅ block if duplicates already detected
if (remoteErrors.email || remoteErrors.phone) {
  if (remoteErrors.email) setTouched((s) => ({ ...s, email: true }));
  if (remoteErrors.phone) setTouched((s) => ({ ...s, phone: true }));
  Alert.alert('Fix required', 'Please use a different email/phone.');
  return;
}

  const res = await Promise.resolve(
   onSignup({
  email: String(email).trim().toLowerCase(),
  firstName: String(firstName).trim(),
  lastName: String(lastName).trim(),
  phone: phoneE164,
    password, // ✅ add back
})

  );

  if (res && res.ok === false) {
    // show message under correct field if provided
    if (res.field === 'email') {
      setRemoteErrors((e) => ({ ...e, email: res.message || 'Invalid email' }));
      setTouched((s) => ({ ...s, email: true }));
      return;
    }
    if (res.field === 'phone') {
      setRemoteErrors((e) => ({ ...e, phone: res.message || 'Invalid phone' }));
      setTouched((s) => ({ ...s, phone: true }));
      return;
    }

    // fallback
    Alert.alert('Sign up failed', res.message || 'Please check your inputs.');
    return;
  }
    } finally {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
      if (remaining) await sleep(remaining);

      if (isMountedRef.current) setLoading(false);
    }
  };

  if (showTerms) {
    return (
      <View style={[styles.container, {backgroundColor: theme.background }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => {
  if (loading) return;
  setTermsAtBottom(false);
  setShowTerms(false);
}}
          disabled={loading}
        >
          <Ionicons name="chevron-back" size={24} color={theme.idleText}/>
          <Text style={[styles.backText, {color: theme.idleText }]}>Back</Text>
        </Pressable>

        <Text style={[styles.title, {color: theme.textPrimary }]}>Terms and Conditions</Text>
        <ScrollView
  style={styles.termsContainer}
  keyboardShouldPersistTaps="handled"
  onScroll={({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const paddingToBottom = 20;
    const isBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    if (isBottom) setTermsAtBottom(true);
  }}
  scrollEventThrottle={16}
>
  <TermsContent />
</ScrollView>


        <View style={styles.termsFooterRow}>
          <Pressable
            style={[styles.secondaryButton, { borderColor: theme.border }]}
            onPress={() => {
              if (loading) return;
              setTermsAtBottom(false);
              setShowTerms(false);
            }}
            disabled={loading}
          >
            <Text style={[styles.secondaryText, { color: theme.textPrimary }]}>Cancel</Text>
          </Pressable>

          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: theme.primary, flex: 1, marginTop: 0 }, // ✅ stop extra top margin
              (!termsAtBottom || loading) && styles.disabledButton,
            ]}
            onPress={() => {
              if (loading) return;
              if (!termsAtBottom) return;
              setAgreedToTerms(true);
              setTermsAtBottom(false);
              setShowTerms(false);
            }}
            disabled={!termsAtBottom || loading}
          >
            <Text style={styles.primaryText}>I Agree</Text>
          </Pressable>
        </View>

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
          contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={onBackToLogin} style={styles.backButton} disabled={loading}>
            <Ionicons name="chevron-back" size={24} color={theme.idleText} />
            <Text style={[styles.backText, { color: theme.idleText }]}>Back to Login</Text>
          </Pressable>

          <Text style={[styles.title, { color: theme.textPrimary }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Sign up to start using DRIVE</Text>

          {/* Email */}
          {renderInput({
            label: 'Email',
            value: email,
            onChange: (t) => {
  setEmail(String(t || ''));
  setRemoteErrors((e) => ({ ...e, email: '' }));
},
            keyboardType: 'email-address',
            lower: true,
            disabled: loading,
            maxLength: 45,
            onFocus: () => setTouched((s) => ({ ...s, email: true })),
          })}
          {!!uiEmailError && <Text style={styles.error}>{uiEmailError}</Text>}
{!!remoteErrors.email && <Text style={styles.error}>{remoteErrors.email}</Text>}

          {/* First Name */}
          {renderInput({
            label: 'First Name',
            value: firstName,
            onChange: (t) => setFirstName(sanitizeNameInput(t)),

            keyboardType: 'default',
            disabled: loading,
            onFocus: () => setTouched((s) => ({ ...s, firstName: true })),
          })}
          {!!uiFirstNameError && <Text style={styles.error}>{uiFirstNameError}</Text>}

          {/* Last Name */}
          {renderInput({
            label: 'Last Name',
            value: lastName,
            onChange: (t) => setLastName(sanitizeNameInput(t)),

            keyboardType: 'default',
            disabled: loading,
            onFocus: () => setTouched((s) => ({ ...s, lastName: true })),
          })}
          {!!uiLastNameError && <Text style={styles.error}>{uiLastNameError}</Text>}

          {/* Phone */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Phone Number</Text>
            <View style={[styles.phoneRow, { backgroundColor: theme.inputBackground, borderColor: theme.border }, loading && styles.disabledField]}>
              <Text style={[styles.phonePrefix, { color: theme.textPrimary }]}>+63</Text>
              <TextInput
                style={[styles.phoneInput, { color: theme.textPrimary }]}
                placeholder="9XXXXXXXXX"
                placeholderTextColor={theme.placeholder}
                keyboardType="phone-pad"
                value={phoneDigits}
                onChangeText={(t) => {
  setPhoneDigits(normalizePHToDigits10(t));
  setRemoteErrors((e) => ({ ...e, phone: '' }));
}}
                maxLength={10}
                editable={!loading}
                onFocus={() => setTouched((s) => ({ ...s, phone: true }))}
              />
            

            </View>
          </View>
          {!!uiPhoneError && <Text style={styles.error}>{uiPhoneError}</Text>}
{!!remoteErrors.phone && <Text style={styles.error}>{remoteErrors.phone}</Text>}


          {/* Password (with eye) */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Password</Text>
            <View style={[styles.passwordRow, { backgroundColor: theme.inputBackground, borderColor: theme.border }, loading && styles.disabledField]}>
              <TextInput
                style={[styles.passwordInput, { color: theme.textPrimary }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={theme.placeholder}
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
                  color={theme.primary}
                />
              </Pressable>
            </View>
            {touched.password && password ? (
              <Text style={[styles.strengthText, { color: theme.textSecondary }]}>
                Strength: <Text style={[styles.strengthBold, { color: theme.textPrimary }]}>{passwordStrength.label}</Text>
              </Text>
            ) : null}
          </View>
          {!!uiPasswordError && <Text style={styles.error}>{uiPasswordError}</Text>}

          {/* Confirm Password */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Confirm Password</Text>
            <View style={[styles.passwordRow, { backgroundColor: theme.inputBackground, borderColor: theme.border }, loading && styles.disabledField]}>
              <TextInput
                style={[styles.passwordInput, { color: theme.textPrimary }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm password"
                placeholderTextColor={theme.placeholder}
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
                  color={theme.primary}
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

  // If already agreed, allow uncheck
  if (agreedToTerms) {
    setAgreedToTerms(false);
    return;
  }

  // Otherwise force modal flow (scroll-to-bottom -> I Agree)
  setTermsAtBottom(false);
  setShowTerms(true);
}}

            disabled={loading}
          >
            <Text style={[styles.checkbox, { color: theme.textPrimary }]}>
              {agreedToTerms ? '☑' : '☐'}
            </Text>
            <Text style={[styles.termsText, { color: theme.textPrimary }]}>
              I agree to the{' '}
              <Text
                style={[styles.link, { color: theme.primary }]}
                onPress={() => {
  if (loading) return;
  setTouched((s) => ({ ...s, terms: true }));
  setTermsAtBottom(false);
  setShowTerms(true);
}}

              >
                Terms and Conditions
              </Text>
            </Text>
          </Pressable>
          {!!uiTermsError && <Text style={styles.error}>{uiTermsError}</Text>}


          {/* Sign up */}
          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: theme.primary }, // use theme.primary
              !formReady && styles.disabledButton
            ]}
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
                    {/* Already have an account? */}
          <Pressable
            onPress={onBackToLogin}
            disabled={loading}
            style={styles.haveAccountRow}
          >
            <Text style={[styles.haveAccountText, { color: theme.textSecondary }]}>
              Already have an account?{' '}
              <Text style={[styles.haveAccountLink, { color: theme.primary }]}>
                Login
              </Text>
            </Text>
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
  const { theme } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          { backgroundColor: theme.inputBackground, color: theme.textPrimary, borderColor: theme.border },
          disabled && styles.disabledField,
        ]}
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
  checkbox: { fontSize: 18, marginRight: 10, marginTop: -3 },
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

    haveAccountRow: {
    marginTop: 12,
    alignItems: 'center',
  },
  haveAccountText: {
    fontSize: 14,
    fontWeight: '700',
  },
  haveAccountLink: {
    fontWeight: '900',
  },
  termsFooterRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  secondaryButton: {
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    minWidth: 120,
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: '900',
  },

});
