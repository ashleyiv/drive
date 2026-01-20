import React, { useEffect, useRef, useState } from 'react';

import { View, StyleSheet, Alert } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from './lib/supabase';

/* SCREENS */
import SplashScreen from './screens/SplashScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import OnboardingFlow from './screens/OnboardingFlow';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import OTPConfirmation from './screens/OTPConfirmation';
import ConnectedAccountsScreen from './screens/ConnectedAccountsScreen';
import { onSignupSendOtp, onConfirmOtp, onResendOtp } from './lib/emailOtpSignup';

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

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  const { theme } = useTheme();
  const [currentScreen, setCurrentScreen] = useState('splash');
  const [navParams, setNavParams] = useState(null);
  const [screenStack, setScreenStack] = useState([]);
  const otpInFlightRef = useRef(false);
  // ✅ Mode switch loading screen (prevents UI changing immediately)
  const [modeSwitchConfig, setModeSwitchConfig] = useState(null);
  const [email, setEmail] = useState('');
  const [otpSentAt, setOtpSentAt] = useState(null);
const [otpSending, setOtpSending] = useState(false);
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

  const [userMode, setUserMode] = useState('driver');
  const [selectedDriverId, setSelectedDriverId] = useState(null);

  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  // ✅ PHONE OTP (new)
  const [phoneOtpRequestId, setPhoneOtpRequestId] = useState(null);
  const [phoneOtpSentAt, setPhoneOtpSentAt] = useState(null);
  const [phoneVerifiedId, setPhoneVerifiedId] = useState(null); // verificationId
  const [phoneForSignup, setPhoneForSignup] = useState(null);   // +63...


    const sendPhoneOtp = async ({ phoneE164 }) => {
    try {
      const { data, error } = await supabase.functions.invoke('send_phone_otp', {
        body: { phone: phoneE164 },
      });

      if (error) return { ok: false, message: error.message };
      if (!data?.ok) return { ok: false, message: data?.message || 'Failed to send SMS' };

      setPhoneOtpRequestId(data.requestId);
      setPhoneForSignup(data.phone);
      setPhoneOtpSentAt(Date.now());
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e?.message || 'Failed to send SMS' };
    }
  };

  const verifyPhoneOtp = async ({ requestId, token }) => {
    try {
    const { data, error } = await supabase.functions.invoke('verify_phone_otp', {
  body: { requestId, code: token }, // server now supports this
});

if (error) return { ok: false, message: error.message };
if (!data?.ok) return { ok: false, message: data?.message || 'Invalid code' };

// ✅ always set from returned verificationId
setPhoneVerifiedId(data.verificationId);
return { ok: true };

    } catch (e) {
      return { ok: false, message: e?.message || 'Invalid code' };
    }
  };
  const handleVerifyPhoneStart = async (draft) => {
    // store draft now (so we can continue after phone OTP)
    setSignupData({
      email: draft.email,
      firstName: draft.firstName,
      lastName: draft.lastName,
      phone: draft.phone,
      password: draft.password,
    });

    // clear any previous verification
    setPhoneVerifiedId(null);

    const res = await sendPhoneOtp({ phoneE164: draft.phone });
    if (!res.ok) {
      Alert.alert('Failed to send SMS', res.message);
      return res;
    }

    setCurrentScreen('phone-otp');
    return { ok: true };
  };

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

    // ✅ Validate credentials using Supabase Auth (source of truth)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: formatted,
      password,
    });

    if (error) {
      // keep message user-friendly
      return { ok: false, message: 'Incorrect password. Please try again.' };
    }

    // ✅ IMPORTANT: sign out immediately so access is gated by OTP
    // (you still require email OTP next)
    try {
      await supabase.auth.signOut();
    } catch {}

    return { ok: true, email: formatted };
  };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          setUserMode('emergency-contact');
          setCurrentScreen('ec-dashboard');
        }
      } catch {}
    })();
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

    const userEmail = payload?.email;
    const password = payload?.password;

    // ✅ NEW: check email existence first (so we can show "Email not found")
    const formattedEmail = normalizeEmail(userEmail);
    const existsRes = await checkEmailExists(formattedEmail);
    

    if (!existsRes.ok) {
      Alert.alert('Login failed', existsRes.message);
      return { ok: false, message: existsRes.message };
    }

    if (!existsRes.exists) {
      Alert.alert('Email not found', 'Email not found. Please try to sign up.');
      return { ok: false, field: 'email', message: 'Email not found. Please try to sign up.' };
    }

    // ✅ Email exists -> now check password
    const creds = await checkEmailPassword({ email: formattedEmail, password });
    if (!creds.ok) {
      Alert.alert('Login failed', creds.message);
      return creds;
    }

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

  // ✅ store draft for OTP flow
  setSignupData({
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    password: data.password,
  });

  // ✅ clear old phone verification state
  setPhoneVerifiedId(null);
  setPhoneOtpRequestId(null);
  setPhoneForSignup(null);

  // ✅ send PHONE OTP now
  const sms = await sendPhoneOtp({ phoneE164: data.phone });
  if (!sms.ok) {
    // if Edge Function returned field, forward it
    return { ok: false, field: sms.field || 'phone', message: sms.message || 'Failed to send SMS.' };
  }

  setCurrentScreen('phone-otp');
  return { ok: true };
};




const handleOTPConfirm = async (token) => {
  // ✅ SIGNUP: use your lib helper (it verifies OTP + upserts profiles)
  if (otpFlow === 'signup') {
    const done = await onConfirmOtp({ email, token });
    if (!done.ok) return done;

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
    setUserMode('emergency-contact');
    setCurrentScreen('ec-dashboard');
    return { ok: true };
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
      await supabase.auth.signOut();
      await AsyncStorage.removeItem('bt_coachmark_seen_this_login');
    } catch {}
    setLocationPermissionGranted(false);
    setOtpFlow(null);
    setEmail('');
    setSignupData(null);
    setUserMode(null);
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

              setUserMode('driver');
              setCurrentScreen('dashboard');
              return;
            }

            // default: go to Emergency Contact
            setUserMode('emergency-contact');
            setCurrentScreen('ec-dashboard');
          }}
        />
      )}

      {currentScreen === 'splash' && <SplashScreen onComplete={() => setCurrentScreen('welcome')} />}

      {currentScreen === 'welcome' && <WelcomeScreen onStart={() => setCurrentScreen('onboarding')} />}
      {currentScreen === 'onboarding' && <OnboardingFlow onComplete={() => setCurrentScreen('login')} />}

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
      {currentScreen === 'phone-otp' && (
  <OTPConfirmation
    email={phoneForSignup || 'your phone'}
    sentAt={phoneOtpSentAt}
    expirySeconds={300}
    resendCooldownSeconds={300}
    maxAttempts={5}
    onConfirm={async (token) => {
      const res = await verifyPhoneOtp({ requestId: phoneOtpRequestId, token });
      if (!res.ok) return res;

      const emailRes = await onSignupSendOtp({
        email: signupData?.email,
        firstName: signupData?.firstName,
        lastName: signupData?.lastName,
        phone: signupData?.phone,
      });

      if (!emailRes.ok) return emailRes;

      setOtpFlow('signup');
      setEmail(String(signupData?.email || '').trim().toLowerCase());
      setOtpSentAt(emailRes.sentAt || Date.now());
      setCurrentScreen('signup-otp');
      return { ok: true };
    }}
    onResend={async () => {
      return await sendPhoneOtp({ phoneE164: signupData?.phone });
    }}
    onBack={() => setCurrentScreen('signup')}
    onAttemptsExhausted={() => setCurrentScreen('login')}

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

      {userMode === 'emergency-contact' && currentScreen === 'ec-dashboard' && (
        <EmergencyContactDashboard
          onNavigate={handleNavigate}
          onViewDriver={handleViewDriver}
          onSwitchToDriver={handleSwitchToDriver}
        />
      )}

      {currentScreen === 'ec-notifications' && <EmergencyContactNotifications onNavigate={handleNavigate} />}

      {currentScreen === 'ec-settings' && (
        <EmergencyContactSettings onNavigate={handleNavigate} onSwitchToDriver={handleSwitchToDriver} />
      )}

      {currentScreen === 'ec-driver-detail' && (
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