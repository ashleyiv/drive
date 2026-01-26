import React, { useEffect, useRef, useState } from 'react';

import { View, StyleSheet, Alert } from 'react-native';
import * as Location from 'expo-location';
import { supabase, supabaseEphemeral, SUPABASE_STORAGE_KEY } from './lib/supabase';



/* SCREENS */
import SplashScreen from './screens/SplashScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import OnboardingFlow from './screens/OnboardingFlow';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import OTPConfirmation from './screens/OTPConfirmation';
import ConnectedAccountsScreen from './screens/ConnectedAccountsScreen';
import { onSignupSendOtp, onConfirmOtp, onResendOtp } from './lib/emailOtpSignup';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* AUTH */
import ForgotPassword from './components/ForgotPassword';
import NewPassword from './components/NewPassword';

/* DRIVER MODE */
import Dashboard from './components/Dashboard';
import History from './components/History';
import LocationView from './components/LocationView';
import Contacts from './components/Contacts';
import Menu from './components/Menu';

/* EMERGENCY CONTACT MODE */
import EmergencyContactDashboard from './components/EmergencyContactDashboard';
import EmergencyContactNotifications from './components/EmergencyContactNotifications';
import EmergencyContactSettings from './components/EmergencyContactSettings.js';
import DriverDetailView from './components/DriverDetailView';
import ModeSwitchLoadingScreen from './components/ModeSwitchLoadingScreen';
import About from './components/About';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
/* THEME */
import { ThemeProvider } from './theme/ThemeContext';
import useTheme from './theme/useTheme';
import { DeviceSession } from './lib/deviceSession';

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  const { theme } = useTheme();
    // ✅ IMPORTANT: DeviceSession.set might overwrite (not merge)
  // This helper merges with existing values so we don't lose connectedDevice.
  const safeDeviceSessionSet = (patch) => {
    try {
      const prev = DeviceSession.get?.() || {};
      DeviceSession.set?.({ ...prev, ...patch });
    } catch (e) {
      try {
        // fallback if get() not available
        DeviceSession.set?.(patch);
      } catch {}
    }
  };

  const [currentScreen, setCurrentScreen] = useState('splash');
  const [navParams, setNavParams] = useState(null);
  const [screenStack, setScreenStack] = useState([]);
  // ✅ Persisted home routing (prevents ghost entries)
const LAST_MODE_KEY = 'last_mode_v1';
const [splashDone, setSplashDone] = useState(false);
const initialRouteDoneRef = useRef(false);

// persist last selected mode (so reopen stays in same mode)
useEffect(() => {
  if (userMode === 'driver' || userMode === 'emergency-contact') {
    AsyncStorage.setItem(LAST_MODE_KEY, userMode).catch(() => {});
  }
}, [userMode]);

// ✅ Decide first screen ONLY when splash finished + auth + onboarding are booted
useEffect(() => {
  if (!splashDone) return;
  if (!authBooted) return;
  if (!onboardingBooted) return;
  if (initialRouteDoneRef.current) return;

  initialRouteDoneRef.current = true;

  (async () => {
    // 1) On first install, still show welcome/onboarding flow
    if (!onboardingSeen) {
      setCurrentScreen('welcome');
      return;
    }

    // 2) If no session, go login
    const hasSession = !!activeSession?.user;
    if (!hasSession) {
      setCurrentScreen('login');
      return;
    }

    // 3) Session exists → go back to last mode (default: emergency-contact)
    let lastMode = 'emergency-contact';
    try {
      const v = await AsyncStorage.getItem(LAST_MODE_KEY);
      if (v === 'driver' || v === 'emergency-contact') lastMode = v;
    } catch {}

    if (lastMode === 'driver') {
      // driver mode requires location permission
      const granted = await requestLocationPermission();
      if (granted) {
        // ✅ show loading screen consistently on startup restore
        setModeSwitchConfig({
          action: 'to-driver',
          title: 'DRIVER MODE',
          subtitle: 'Switching to Driver dashboard…',
        });
        setCurrentScreen('mode-switch');
        return;
      }

      // fallback if permission denied
      setUserMode('emergency-contact');
      setCurrentScreen('ec-dashboard');
      return;
    }

    // emergency contact default
    setUserMode('emergency-contact');
    setCurrentScreen('ec-dashboard');
  })();
}, [splashDone, authBooted, onboardingBooted, onboardingSeen, activeSession]);

  // ✅ Onboarding should show only once
const ONBOARDING_SEEN_KEY = 'onboarding_seen_v1';
const [onboardingSeen, setOnboardingSeen] = useState(false);
const [onboardingBooted, setOnboardingBooted] = useState(false);

useEffect(() => {
  let mounted = true;

  (async () => {
    try {
      const v = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
      if (!mounted) return;
      setOnboardingSeen(v === '1');
    } catch {
      // ignore
    } finally {
      if (mounted) setOnboardingBooted(true);
    }
  })();

  return () => {
    mounted = false;
  };
}, []);

const markOnboardingSeen = async () => {
  try {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, '1');
  } catch {
    // ignore
  }
  setOnboardingSeen(true);
};

// ✅ if already seen but somehow reached onboarding, auto-skip
useEffect(() => {
  if (onboardingBooted && onboardingSeen && currentScreen === 'onboarding') {
    setCurrentScreen('login');
  }
}, [onboardingBooted, onboardingSeen, currentScreen]);

  // ✅ keep latest values for applySession (avoid stale closure)
const currentScreenRef = useRef('splash');
const userModeRef = useRef('driver');

useEffect(() => {
  currentScreenRef.current = currentScreen;
}, [currentScreen]);

useEffect(() => {
  userModeRef.current = userMode;
}, [userMode]);

    // ✅ keep a single source of truth for auth session
  const [activeSession, setActiveSession] = useState(null);
  const [authBooted, setAuthBooted] = useState(false);

  const isEcScreen = (s) => typeof s === 'string' && s.startsWith('ec-');

  const otpInFlightRef = useRef(false);
  // ✅ PATCH 2: anti-enumeration + attempt limiter
const loginFailCountRef = useRef(0);
const loginLockUntilRef = useRef(0); // timestamp (ms)
const LOGIN_LOCK_MS = 5 * 60 * 1000; // 5 mins

  // ✅ Mode switch loading screen (prevents UI changing immediately)
  const [modeSwitchConfig, setModeSwitchConfig] = useState(null);
  const [email, setEmail] = useState('');
  const [otpSentAt, setOtpSentAt] = useState(null);
const [otpSending, setOtpSending] = useState(false);

// ===== Login attempt guard (non-breaking) =====
const LOGIN_LOCK_KEY_PREFIX = 'login_lock_';
const LOGIN_FAILS_KEY_PREFIX = 'login_fails_';
const MAX_FAILS_BEFORE_HINT = 5;        // show "Forgot password?" hint at 5
const MAX_FAILS_BEFORE_LOCK = 6;        // lock at 6
const LOCK_MS = 5 * 60 * 1000;          // 5 minutes

const getEmailKey = (rawEmail) => String(rawEmail || '').trim().toLowerCase();

const getLockKeys = (email) => {
  const key = getEmailKey(email);
  return {
    failsKey: `${LOGIN_FAILS_KEY_PREFIX}${key}`,
    lockKey: `${LOGIN_LOCK_KEY_PREFIX}${key}`,
  };
};

const getLoginGuardState = async (email) => {
  const { failsKey, lockKey } = getLockKeys(email);
  const [failsRaw, lockUntilRaw] = await Promise.all([
    AsyncStorage.getItem(failsKey),
    AsyncStorage.getItem(lockKey),
  ]);

  const fails = Number(failsRaw || 0) || 0;
  const lockUntil = Number(lockUntilRaw || 0) || 0;
  const now = Date.now();

  const locked = lockUntil > now;
  const remainingMs = locked ? (lockUntil - now) : 0;

  return { fails, locked, remainingMs };
};

const setLoginFails = async (email, fails) => {
  const { failsKey } = getLockKeys(email);
  await AsyncStorage.setItem(failsKey, String(fails));
};

const setLoginLock = async (email, lockUntil) => {
  const { lockKey } = getLockKeys(email);
  await AsyncStorage.setItem(lockKey, String(lockUntil));
};

const resetLoginGuard = async (email) => {
  const { failsKey, lockKey } = getLockKeys(email);
  await Promise.all([
    AsyncStorage.removeItem(failsKey),
    AsyncStorage.removeItem(lockKey),
  ]);
};



const checkEmailExists = async (email) => {
  try {
    const { data, error } = await supabase.rpc('email_exists', { p_email: String(email || '').trim().toLowerCase() });
    if (error) return { ok: false, message: error.message };
    return { ok: true, exists: !!data };
  } catch (e) {
    return { ok: false, message: e?.message || 'Failed to check email.' };
  }
};

const checkPhoneExists = async (phoneE164) => {
  try {
    const { data, error } = await supabase.rpc('phone_exists', { p_phone: phoneE164 });
    if (error) return { ok: false, message: error.message };
    return { ok: true, exists: !!data };
  } catch (e) {
    return { ok: false, message: e?.message || 'Failed to check phone.' };
  }
};

  // store signup payload until OTP verifies
  const [signupData, setSignupData] = useState(null);

  // 'login' | 'signup' | 'forgot'
  const [otpFlow, setOtpFlow] = useState(null);

  const [userMode, setUserMode] = useState(null);
  const [selectedDriverId, setSelectedDriverId] = useState(null);

  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);



  const normalizeEmail = (input) => String(input ?? '').trim().toLowerCase();

    const isAllowedProviderEmail = (raw) => {
    const v = String(raw ?? '').trim().toLowerCase();

    // length rules
    if (!v) return false;
    if (v.length > 45) return false;

    // exactly one @
    const atCount = (v.match(/@/g) || []).length;
    if (atCount !== 1) return false;

    const [local, domain] = v.split('@');
    if (!local || !domain) return false;

    // domain must be exactly gmail.com or yahoo.com
    if (domain !== 'gmail.com' && domain !== 'yahoo.com') return false;

    // no double dots after @
    if (domain.includes('..')) return false; // (extra safety; gmail.com/yahoo.com already clean)

    // allow dots before @, but disallow weird stuff
    if (!/^[a-z0-9._%+-]+$/.test(local)) return false;

    // no consecutive dots in local, and not starting/ending with dot
    if (local.includes('..')) return false;
    if (local.startsWith('.') || local.endsWith('.')) return false;

    return true;
  };

  const sendEmailOtp = async ({ email, shouldCreateUser }) => {
    // ✅ INSTANT anti-spam lock (ref is immediate)
    if (otpInFlightRef.current) {
      return { ok: false, message: 'Please wait… sending code.', silent: true };
    }

    const formatted = normalizeEmail(email);
    if (!formatted) return { ok: false, message: 'Please enter an email.' };

    // ✅ enforce the same strict email rule here (prevents loopholes even if UI misses)
    if (!isAllowedProviderEmail(formatted)) {
      return { ok: false, message: 'Only valid @gmail.com or @yahoo.com emails are allowed.' };
    }

    otpInFlightRef.current = true;
    setOtpSending(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: formatted,
        options: { shouldCreateUser: !!shouldCreateUser },
      });

      if (error) return { ok: false, message: error.message };
      return { ok: true, email: formatted };
    } finally {
      otpInFlightRef.current = false;
      setOtpSending(false);
    }
  };



  const verifyEmailOtp = async ({ email, token }) => {
    const formatted = normalizeEmail(email);

    const { data, error } = await supabase.auth.verifyOtp({
      email: formatted,
      token,
      type: 'email',
    });

    if (error) return { ok: false, message: error.message };
    return { ok: true, session: data.session, user: data.user };
  };

  const checkEmailPassword = async ({ email, password }) => {
  const formatted = normalizeEmail(email);

  if (!formatted) return { ok: false, message: 'Please enter your email.' };
  if (!password) return { ok: false, message: 'Please enter your password.' };

  // ✅ Use ephemeral client so NO refresh token is saved to AsyncStorage
  const { error } = await supabaseEphemeral.auth.signInWithPassword({
    email: formatted,
    password,
  });
if (error) {
  const msg = String(error?.message || '').toLowerCase();

  // ✅ common cases when password login is not possible / user created by OTP
  if (
    msg.includes('invalid login credentials') ||
    msg.includes('email not confirmed') ||
    msg.includes('user not found')
  ) {
    return {
      ok: false,
      message:
        'This account needs a password reset. Please tap "Forgot password" to set your password again.',
      needsReset: true,
    };
  }

  return { ok: false, message: 'Incorrect password. Please try again.' };
}


  // optional: clear ephemeral in-memory auth (won't touch AsyncStorage)
  try {
    await supabaseEphemeral.auth.signOut();
  } catch {}

  return { ok: true, email: formatted };
};


   useEffect(() => {
    let mounted = true;

    const applySession = (session) => {
      if (!mounted) return;

      setActiveSession(session ?? null);
      setAuthBooted(true);

     // ✅ if session disappears while inside EC screens, go back to login
if (!session) {
  const cs = currentScreenRef.current;
  const um = userModeRef.current;

  if (isEcScreen(cs) || um === 'emergency-contact') {
    setUserMode(null);
    setCurrentScreen('login');
  }
  return;
}


// ✅ Do NOT force login when session exists.
// Boot-router handles initial navigation based on cached session.



    };

    // ✅ initial boot read
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          applySession(null);
          return;
        }
        applySession(data?.session ?? null);
      } catch {
        applySession(null);
      }
    })();

    // ✅ keep in sync with auth events
    let sub = null;
    try {
      const res = supabase.auth.onAuthStateChange((_event, session) => {
        applySession(session ?? null);
      });

      // supabase-js v2 shape
      sub = res?.data?.subscription || res?.subscription || null;
    } catch {
      // ignore
    }

    return () => {
      mounted = false;
      try {
        sub?.unsubscribe?.();
      } catch {}
    };
    // IMPORTANT: do NOT add currentScreen/userMode to deps (avoid loops)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location access is required to use this app.');
        return false;
      }

      setLocationPermissionGranted(true);

      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

      return true;
    } catch {
      Alert.alert('Error', 'Failed to get location');
      return false;
    }
  };

  // LOGIN: email+password -> send email OTP -> OTP screen
  const handleLogin = async (payload) => {
  if (payload === 'google') {
    Alert.alert('Not implemented', 'Google sign-in is not wired up yet.');
    return { ok: false };
  }

  // ✅ lockout check
  const now = Date.now();
  if (loginLockUntilRef.current && now < loginLockUntilRef.current) {
    Alert.alert('Login blocked', 'Please come back after 5 mins to login again.');
    return { ok: false, locked: true };
  }

  // lock expired -> clear
  if (loginLockUntilRef.current && now >= loginLockUntilRef.current) {
    loginLockUntilRef.current = 0;
    loginFailCountRef.current = 0;
  }

  const userEmail = payload?.email;
  const password = payload?.password;

  const formattedEmail = normalizeEmail(userEmail);

  // ✅ Do NOT check email existence (prevents user enumeration)
  // ✅ Always treat failures as "wrong email or password"
  const creds = await checkEmailPassword({ email: formattedEmail, password });

  if (!creds.ok) {
    // count failures
    loginFailCountRef.current = (loginFailCountRef.current || 0) + 1;

    // 6th failure -> lock for 5 mins
    if (loginFailCountRef.current >= 6) {
      loginLockUntilRef.current = Date.now() + LOGIN_LOCK_MS;
      Alert.alert('Login blocked', 'Please come back after 5 mins to login again.');
      return { ok: false, locked: true };
    }

    // 5th failure -> show hint
    if (loginFailCountRef.current >= 5) {
      Alert.alert(
        'Login failed',
        'Wrong email or password. Please try again.\n\nHave you forgotten your password? Click "Forgot password".'
      );
      return { ok: false, message: 'Wrong email or password. Please try again.', showForgotHint: true };
    }

    // 1st–4th failure -> generic message only
    Alert.alert('Login failed', 'Wrong email or password. Please try again.');
    return { ok: false, message: 'Wrong email or password. Please try again.' };
  }

  // ✅ password ok -> reset counters
  loginFailCountRef.current = 0;
  loginLockUntilRef.current = 0;

  // ✅ proceed with OTP step (still shouldCreateUser=false)
  const res = await sendEmailOtp({ email: creds.email, shouldCreateUser: false });
  if (!res.ok) {
    if (!res.silent) Alert.alert('Failed to send code', res.message);
    return res;
  }

  setOtpFlow('login');
  setEmail(res.email);
  setOtpSentAt(Date.now());
  setCurrentScreen('login-otp');
  return { ok: true };
};


  // SIGNUP: email+phone+password -> send email OTP -> OTP screen
   // SIGNUP: one button flow
// Sign Up -> check duplicates -> send PHONE OTP -> (after phone OTP success) send EMAIL OTP
const handleSignup = async (data) => {
  if (data === 'google') {
    Alert.alert('Not implemented', 'Google sign-up is not wired up yet.');
    return { ok: false };
  }

  if (!data?.email || !data?.firstName || !data?.lastName || !data?.phone || !data?.password) {
    return { ok: false, message: 'Please fill in all fields.' };
  }

  // ✅ block duplicates BEFORE sending OTPs
  const emailRes = await checkEmailExists(data.email);
  if (!emailRes.ok) return { ok: false, message: emailRes.message };
  if (emailRes.exists) {
    return { ok: false, field: 'email', message: 'This email is already existing. please choose another one.' };
  }

  const phoneRes = await checkPhoneExists(data.phone);
  if (!phoneRes.ok) return { ok: false, message: phoneRes.message };
  if (phoneRes.exists) {
    return { ok: false, field: 'phone', message: 'This phone number is already existing. please choose another one.' };
  }

   // ✅ store draft for OTP flow (still needed for password set after OTP)
  setSignupData({
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    password: data.password,
  });

  // ✅ send EMAIL OTP (no phone/SMS step)
  const emailOtpRes = await onSignupSendOtp({
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
  });

  if (!emailOtpRes.ok) {
    return { ok: false, field: 'email', message: emailOtpRes.message || 'Failed to send code.' };
  }

  setOtpFlow('signup');
  setEmail(String(data.email || '').trim().toLowerCase());
  setOtpSentAt(emailOtpRes.sentAt || Date.now());
  setCurrentScreen('signup-otp');
  return { ok: true };

};




const handleOTPConfirm = async (token) => {
  // ✅ SIGNUP: use your lib helper (it verifies OTP + upserts profiles)
  if (otpFlow === 'signup') {
  const done = await onConfirmOtp({ email, token });
  if (!done.ok) return done;

  // ✅ CRITICAL: set password in Supabase Auth (so signInWithPassword works)
  const pw = String(signupData?.password || '');
  if (pw.trim().length >= 6) {
    const { error: pwErr } = await supabase.auth.updateUser({ password: pw });
    if (pwErr) {
      Alert.alert(
        'Signup warning',
        'Account created, but password was not saved. Please use "Forgot password" to set it.'
      );
    }
  } else {
    Alert.alert(
      'Signup warning',
      'Account created, but password was missing. Please use "Forgot password" to set it.'
    );
  }

  // requirement: go back to login after signup
  try {
    await supabase.auth.signOut();
  } catch {}

  setOtpFlow(null);
  setSignupData(null);
  setEmail('');
  setOtpSentAt(null);
  setCurrentScreen('login');
  return { ok: true };
}

  // ✅ for login/forgot: keep your old verifyEmailOtp flow
  const res = await verifyEmailOtp({ email, token });
  if (!res.ok) return res;

if (otpFlow === 'login') {
  // ✅ verify we actually have a session before switching screens
  try {
    const { data } = await supabase.auth.getSession();
    if (!data?.session?.user) {
      Alert.alert('Login error', 'Session was not created. Please try again.');
      return { ok: false, message: 'No session created.' };
    }

    // keep app state synced too
    setActiveSession(data.session);

    try {
      await resetLoginGuard(email);
    } catch {}

    setUserMode('emergency-contact');
    setCurrentScreen('ec-dashboard');
    return { ok: true };
  } catch (e) {
    Alert.alert('Login error', 'Please try again.');
    return { ok: false, message: e?.message || 'Login failed.' };
  }
}


  if (otpFlow === 'forgot') {
    setCurrentScreen('new-password');
    return { ok: true };
  }

  return { ok: true };
};


  const handleForgotPasswordSubmit = async (emailInput) => {
    const res = await sendEmailOtp({ email: emailInput, shouldCreateUser: false });
  if (!res.ok) {
  if (!res.silent) Alert.alert('Failed to send code', res.message);
  return res;
}


    setOtpFlow('forgot');
    setEmail(res.email);
    setOtpSentAt(Date.now());
    setCurrentScreen('forgot-otp');
    return { ok: true };
  };
const handleNewPasswordSubmit = async (newPassword) => {
  try {
    if (!newPassword || String(newPassword).trim().length < 6) {
      Alert.alert('Invalid password', 'Password must be at least 6 characters.');
      return { ok: false };
    }

       // ✅ user is signed-in already because they verified OTP
    // ✅ update password using Supabase Auth (no SQL hashing needed)
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      Alert.alert('Failed to reset password', error.message);
      return { ok: false, message: error.message };
    }


    Alert.alert('Success', 'Your password has been updated. Please log in again.');

    // sign out so login uses the new password
    try {
      await supabase.auth.signOut();
    } catch {}

    setOtpFlow(null);
    setEmail('');
    setOtpSentAt(null);
    setCurrentScreen('login');
    return { ok: true };
  } catch (e) {
    Alert.alert('Error', 'Something went wrong resetting your password.');
    return { ok: false };
  }
};

const handleResend = async () => {
  if (otpFlow === 'signup') {
    const res = await onResendOtp(email);
    if (res.ok) setOtpSentAt(Date.now());
    return res;
  }

  // keep existing behavior for login/forgot
  const shouldCreateUser = false;
  const res = await sendEmailOtp({ email, shouldCreateUser });
  if (res.ok) setOtpSentAt(Date.now());
  return res;
};


 const handleNavigate = (screen, params = null) => {
  setScreenStack(prev => [...prev, currentScreen]);
  setNavParams(params);
  setCurrentScreen(screen);
};

const handleGoBack = () => {
  setScreenStack(prev => {
    if (prev.length === 0) return prev; // nothing to go back to
    const newStack = [...prev];
    const previous = newStack.pop();
    setCurrentScreen(previous);
    return newStack;
  });
};

  // ✅ Show white loading screen BEFORE switching modes/screens
  const beginSwitchToEmergencyContact = () => {
    setModeSwitchConfig({
      action: 'to-ec',
      title: 'EMERGENCY CONTACT MODE',
      subtitle: 'Switching to Emergency Contact dashboard…',
    });
    setCurrentScreen('mode-switch');
  };

  const beginSwitchToDriver = () => {
    setModeSwitchConfig({
      action: 'to-driver',
      title: 'DRIVER MODE',
      subtitle: 'Switching to Driver dashboard…',
    });
    setCurrentScreen('mode-switch');
  };



  const handleSwitchToEmergencyContact = () => {
    beginSwitchToEmergencyContact();
  };

  const handleSwitchToDriver = async () => {
    // keep async signature (non-breaking) but show loading first
    beginSwitchToDriver();
  };


  const handleViewDriver = (driverId) => {
    setSelectedDriverId(driverId);
    setCurrentScreen('ec-driver-detail');
  };
const handleLogout = async () => {
  try {
    // 1) Sign out locally (no network needed). This clears in-memory session.
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // fallback for older client versions
      await supabase.auth.signOut();
    }

    // 2) Wipe persisted auth tokens from AsyncStorage (custom + legacy keys)
    const keys = await AsyncStorage.getAllKeys();

    const toRemove = keys.filter((k) => {
      if (!k) return false;

      // our explicit key (and any variants)
      if (k === SUPABASE_STORAGE_KEY) return true;
      if (k.startsWith(SUPABASE_STORAGE_KEY)) return true;

      // legacy Supabase RN keys often look like: sb-<project-ref>-auth-token
      if (k.startsWith('sb-') && k.includes('auth-token')) return true;

      return false;
    });

    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }

    // keep your existing app-specific cache clear
    await AsyncStorage.removeItem('bt_coachmark_seen_this_login');
  } catch (e) {
    console.log('[handleLogout] error:', e);
  }

  // reset local UI state no matter what
  setLocationPermissionGranted(false);
  setOtpFlow(null);
  setEmail('');
  setSignupData(null);
  setUserMode(null);
  initialRouteDoneRef.current = false;
setSplashDone(false);

  setCurrentScreen('login');
};


   return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {currentScreen === 'mode-switch' && (
        <ModeSwitchLoadingScreen
          title={modeSwitchConfig?.title || 'Loading…'}
          subtitle={modeSwitchConfig?.subtitle || 'Switching…'}
          durationMs={1800}
          onDone={async () => {
            const action = modeSwitchConfig?.action;

            // clear config so it won't rerun
            setModeSwitchConfig(null);

            if (action === 'to-driver') {
              const granted = await requestLocationPermission();
              if (!granted) {
                // stay / return to EC dashboard if permission denied
                setUserMode('emergency-contact');
                setCurrentScreen('ec-dashboard');
                return;
              }

              // ✅ let Dashboard show its "DRIVER MODE" overlay once
              try { safeDeviceSessionSet({ pendingModeSwitchTo: 'driver' }); } catch {}


              setUserMode('driver');
              setCurrentScreen('dashboard');
              return;
            }

            // default: go to Emergency Contact
            try { safeDeviceSessionSet({ pendingModeSwitchTo: 'contact' }); } catch {}


            setUserMode('emergency-contact');
            setCurrentScreen('ec-dashboard');
          }}
        />
      )}

      {currentScreen === 'splash' && (
  <SplashScreen
    onComplete={() => {
      // ✅ let the boot-router decide where to go
      setSplashDone(true);
    }}
  />
)}


      {currentScreen === 'welcome' && (
  <WelcomeScreen
    onStart={() => setCurrentScreen(onboardingSeen ? 'login' : 'onboarding')}
  />
)}

     {currentScreen === 'onboarding' && (
  <OnboardingFlow
    onComplete={async () => {
      await markOnboardingSeen();
      setCurrentScreen('login');
    }}
  />
)}


      {/* AUTH */}
      {currentScreen === 'login' && (
        <LoginScreen
          onLogin={handleLogin}
          onForgotPassword={() => setCurrentScreen('forgot-password')}
          onSignup={() => setCurrentScreen('signup')}
        />
      )}

      {currentScreen === 'login-otp' && (
        <OTPConfirmation
          email={email}
          sentAt={otpSentAt}
          expirySeconds={300}
          resendCooldownSeconds={300}
          maxAttempts={5}
          onConfirm={handleOTPConfirm}
          onResend={handleResend}
          onBack={() => setCurrentScreen('login')}
        />
      )}
    


{currentScreen === 'signup' && (
  <SignupScreen
    onSignup={handleSignup}
    onBackToLogin={() => setCurrentScreen('login')}
    onCheckEmailExists={checkEmailExists}
    onCheckPhoneExists={checkPhoneExists}
  />
)}

      {currentScreen === 'signup-otp' && (
        <OTPConfirmation
          email={email}
          sentAt={otpSentAt}
          expirySeconds={300}
          resendCooldownSeconds={300}
          maxAttempts={5}
          onConfirm={handleOTPConfirm}
          onResend={handleResend}
          onBack={() => setCurrentScreen('signup')}
        />
      )}

      {currentScreen === 'forgot-password' && (
        <ForgotPassword onSubmit={handleForgotPasswordSubmit} onBack={() => setCurrentScreen('login')} />
      )}

      {currentScreen === 'forgot-otp' && (
        <OTPConfirmation
          email={email}
          sentAt={otpSentAt}
          expirySeconds={300}
          resendCooldownSeconds={300}
          maxAttempts={5}
          onConfirm={handleOTPConfirm}
          onResend={handleResend}
          onBack={() => setCurrentScreen('forgot-password')}
        />
      )}

      {currentScreen === 'new-password' && (
        <NewPassword
          onSubmit={handleNewPasswordSubmit}
          onBack={() => setCurrentScreen('forgot-otp')}
        />
      )}

      {/* DRIVER MODE */}
      {userMode === 'driver' && currentScreen === 'dashboard' && (
        <Dashboard
          onNavigate={handleNavigate}
          onSwitchToEmergencyContact={handleSwitchToEmergencyContact}
          location={currentLocation}
        />
      )}

      {currentScreen === 'history' && (
        <History
          onNavigate={handleNavigate}
          navParams={navParams}
          clearNavParams={() => setNavParams(null)}
        />
      )}

      {currentScreen === 'location' && <LocationView onNavigate={handleNavigate} location={currentLocation} />}
      {currentScreen === 'contacts' && <Contacts onNavigate={handleNavigate} />}

      {currentScreen === 'menu' && (
        <Menu
          onNavigate={handleNavigate}
          handleLogout={handleLogout}
          onSwitchToEmergencyContact={handleSwitchToEmergencyContact}
          onSwitchToDriver={handleSwitchToDriver}
        />
      )}

            {userMode === 'emergency-contact' && currentScreen === 'ec-dashboard' && activeSession?.user && (
        <EmergencyContactDashboard
          onNavigate={handleNavigate}
          onViewDriver={handleViewDriver}
          onSwitchToDriver={handleSwitchToDriver}
        />
      )}


            {currentScreen === 'ec-notifications' && activeSession?.user && (
        <EmergencyContactNotifications onNavigate={handleNavigate} />
      )}


            {currentScreen === 'ec-settings' && activeSession?.user && (
        <EmergencyContactSettings onNavigate={handleNavigate} onSwitchToDriver={handleSwitchToDriver} />
      )}

          {currentScreen === 'ec-driver-detail' && activeSession?.user && (
        <DriverDetailView driverId={selectedDriverId} onBack={() => setCurrentScreen('ec-dashboard')} />
      )}

      {currentScreen === 'connected-accounts' && (
        <ConnectedAccountsScreen onNavigate={handleNavigate} isDarkMode={false} />
      )}

      {/* ABOUT / POLICY / TERMS */}
      {currentScreen === 'about' && (
        <About onNavigate={handleNavigate} onBack={handleGoBack} />
      )}

      {currentScreen === 'privacy-policy' && (
        <PrivacyPolicy onNavigate={handleNavigate} onBack={handleGoBack} />
      )}

      {currentScreen === 'terms-of-service' && (
        <TermsOfService onNavigate={handleNavigate} onBack={handleGoBack} />
      )}

    </View>
  );

}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});