import React, { useEffect, useState } from 'react';
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

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('splash');

  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpSentAt, setOtpSentAt] = useState(null);
  const [userData, setUserData] = useState(null);

  // Tracks what the OTP screen is confirming.
  const [otpFlow, setOtpFlow] = useState(null); // 'login' | 'signup' | 'forgot'

  const [userMode, setUserMode] = useState('driver'); // 'driver' | 'emergency-contact'
  const [selectedDriverId, setSelectedDriverId] = useState(null);

  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);

  // --- Supabase Phone OTP helpers ---
  const normalizePhone = (input) => {
    const raw = String(input ?? '').replace(/[\s-]/g, '');
    if (!raw) return '';
    if (raw.startsWith('+')) return raw;
    if (raw.startsWith('0')) return `+63${raw.slice(1)}`; // PH default
    if (raw.startsWith('63')) return `+${raw}`;
    if (/^9\d{9}$/.test(raw)) return `+63${raw}`; // 9xxxxxxxxx -> +63
    return `+${raw}`;
  };

  const sendOtp = async ({ phone, shouldCreateUser }) => {
    const formatted = normalizePhone(phone);
    if (!formatted) {
      return { ok: false, kind: 'missing_phone', message: 'Please enter a phone number.' };
    }

    const { error } = await supabase.auth.signInWithOtp({
      phone: formatted,
      options: { shouldCreateUser: !!shouldCreateUser, channel: 'sms' },
    });

    if (error) {
      return { ok: false, kind: 'send_failed', message: error.message };
    }

    return { ok: true, phone: formatted };
  };

  const verifyOtp = async ({ phone, token }) => {
    const formatted = normalizePhone(phone);

    const { data, error } = await supabase.auth.verifyOtp({
      phone: formatted,
      token,
      type: 'sms',
    });

    if (error) {
      return { ok: false, kind: 'invalid_otp', message: error.message };
    }

    return { ok: true, session: data.session, user: data.user, phone: formatted };
  };

  const checkPhonePassword = async ({ phone, password }) => {
    const formatted = normalizePhone(phone);

    if (!formatted) return { ok: false, kind: 'missing_phone', message: 'Please enter a phone number.' };
    if (!password) return { ok: false, kind: 'missing_password', message: 'Please enter your password.' };

    const { data, error } = await supabase.rpc('check_phone_password', {
      p_phone: formatted,
      p_password: password,
    });

    if (error) return { ok: false, kind: 'server', message: error.message };
    if (!data) return { ok: false, kind: 'bad_password', message: 'Phone number or password is incorrect.' };

    return { ok: true, phone: formatted };
  };

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
  // Default after session restore: Emergency Contact Dashboard
  setUserMode('emergency-contact');
  setCurrentScreen('ec-dashboard');
}
      } catch {
        // ignore
      }
    })();
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

  const handleLogin = async (payload) => {
    if (payload === 'google') {
      Alert.alert('Not implemented', 'Google sign-in is not wired up yet.');
      return { ok: false, kind: 'not_implemented' };
    }

    const phone = payload?.phoneNumber;
    const password = payload?.password;

    const creds = await checkPhonePassword({ phone, password });
    if (!creds.ok) {
      Alert.alert('Login failed', creds.message || 'Invalid credentials.');
      return creds;
    }

    const res = await sendOtp({ phone: creds.phone, shouldCreateUser: false });
    if (!res.ok) {
      Alert.alert('Failed to send code', res.message || 'Could not send OTP.');
      return res;
    }

    setOtpFlow('login');
    setPhoneNumber(res.phone);
    setOtpSentAt(Date.now());
    setCurrentScreen('login-otp');
    return { ok: true };
  };

  const handleSignup = async (data) => {
    if (data?.phone === 'google') {
      Alert.alert('Not implemented', 'Google sign-up is not wired up yet.');
      return { ok: false, kind: 'not_implemented' };
    }

    if (!data?.firstName || !data?.lastName || !data?.phone || !data?.password) {
      Alert.alert('Missing info', 'Please fill in all required fields.');
      return { ok: false, kind: 'missing_fields', message: 'Please fill in all required fields.' };
    }

    setUserData(data);

    const res = await sendOtp({ phone: data.phone, shouldCreateUser: true });
    if (!res.ok) {
      Alert.alert('Failed to send code', res.message || 'Could not send OTP.');
      return res;
    }

    setOtpFlow('signup');
    setPhoneNumber(res.phone);
    setOtpSentAt(Date.now());
    setCurrentScreen('signup-otp');
    return { ok: true };
  };

  const handleOTPConfirm = async (token) => {
    const res = await verifyOtp({ phone: phoneNumber, token });
    if (!res.ok) return res;

    if (otpFlow === 'signup') {
      try {
        const { error } = await supabase.rpc('upsert_profile_after_otp', {
          p_first_name: userData?.firstName ?? null,
          p_last_name: userData?.lastName ?? null,
          p_phone: res.phone,
          p_password: userData?.password ?? null,
        });

        if (error) {
          return { ok: false, kind: 'server', message: error.message || 'Failed to create profile.' };
        }
      } catch (e) {
        return { ok: false, kind: 'server', message: e?.message || 'Failed to create profile.' };
      } finally {
        // Keep behavior consistent with the working version:
        // after signup completion, sign out and return user to Login.
        try {
          await supabase.auth.signOut();
        } catch {}
      }

      setOtpFlow(null);
      setUserData(null);
      setCurrentScreen('login');
      return { ok: true };
    }

    if (otpFlow === 'login') {
  // Default after login: Emergency Contact Dashboard
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

  const handleForgotPasswordSubmit = async (phone) => {
    const res = await sendOtp({ phone, shouldCreateUser: false });
    if (!res.ok) {
      Alert.alert('Failed to send code', res.message || 'Could not send OTP.');
      return res;
    }

    setOtpFlow('forgot');
    setPhoneNumber(res.phone);
    setOtpSentAt(Date.now());
    setCurrentScreen('forgot-otp');
    return { ok: true };
  };

  const handleResend = async () => {
    const shouldCreateUser = otpFlow === 'signup';
    const res = await sendOtp({ phone: phoneNumber, shouldCreateUser });
    if (res.ok) setOtpSentAt(Date.now());
    return res;
  };

  const handleNavigate = (screen) => setCurrentScreen(screen);

  const handleSwitchToEmergencyContact = () => {
    setUserMode('emergency-contact');
    setCurrentScreen('ec-dashboard');
  };
const handleSwitchToDriver = async () => {
  const granted = await requestLocationPermission();
  if (!granted) return;

  setUserMode('driver');
  setCurrentScreen('dashboard');
};


  const handleViewDriver = (driverId) => {
    setSelectedDriverId(driverId);
    setCurrentScreen('ec-driver-detail');
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    setLocationPermissionGranted(false);
    setOtpFlow(null);
    setPhoneNumber('');
    setUserData(null);
    setUserMode(null);
    setCurrentScreen('login');
  };

  return (
    <View style={styles.container}>
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
          phoneNumber={phoneNumber}
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
        <SignupScreen onSignup={handleSignup} onBackToLogin={() => setCurrentScreen('login')} />
      )}

      {currentScreen === 'signup-otp' && (
        <OTPConfirmation
          phoneNumber={phoneNumber}
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
          phoneNumber={phoneNumber}
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
        <NewPassword onSubmit={() => setCurrentScreen('login')} onBack={() => setCurrentScreen('forgot-otp')} />
      )}

      {/* DRIVER MODE */}
      {userMode === 'driver' && currentScreen === 'dashboard' && (
        <Dashboard
          onNavigate={handleNavigate}
          onSwitchToEmergencyContact={handleSwitchToEmergencyContact}
          location={currentLocation}
        />
      )}

      {currentScreen === 'history' && <History onNavigate={handleNavigate} />}

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

      {/* EMERGENCY CONTACT MODE */}
      {userMode === 'emergency-contact' && currentScreen === 'ec-dashboard' && (
        <EmergencyContactDashboard onNavigate={handleNavigate} onViewDriver={handleViewDriver} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
});
