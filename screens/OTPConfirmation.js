import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Image,
} from 'react-native';

// Defaults (App.js can override via props)
const DEFAULT_EXPIRY_SECONDS = 300; // 5 minutes
const DEFAULT_RESEND_COOLDOWN_SECONDS = 300; // 5 minutes
const DEFAULT_MAX_ATTEMPTS = 5;

const OTP_LENGTH = 6;

function clampNumber(value, min, max) {
  const n = Number(value);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

export default function OTPConfirmation({
  phoneNumber,
  sentAt, // epoch ms; optional
  expirySeconds = DEFAULT_EXPIRY_SECONDS,
  resendCooldownSeconds = DEFAULT_RESEND_COOLDOWN_SECONDS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  onConfirm, // async (token) => { ok, message? } | void
  onResend, // async () => { ok, message? } | void
  onBack,
}) {
  const inputsRef = useRef([]);

  // Keep an internal start time so the screen works even if sentAt wasn't passed.
  const [localSentAt, setLocalSentAt] = useState(() => (typeof sentAt === 'number' ? sentAt : Date.now()));
  useEffect(() => {
    if (typeof sentAt === 'number') setLocalSentAt(sentAt);
  }, [sentAt]);

  const [otp, setOtp] = useState(() => Array.from({ length: OTP_LENGTH }, () => ''));
  const [error, setError] = useState('');
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const expiry = clampNumber(expirySeconds, 30, 60 * 30); // 30s .. 30m
  const cooldown = clampNumber(resendCooldownSeconds, 0, 60 * 30);
  const maxTry = clampNumber(maxAttempts, 1, 20);

  const secondsSinceSent = useMemo(() => Math.floor((nowTick - localSentAt) / 1000), [nowTick, localSentAt]);
  const secondsLeft = Math.max(0, expiry - secondsSinceSent);
  const cooldownLeft = Math.max(0, cooldown - secondsSinceSent);

  const isExpired = secondsLeft === 0;
  const attemptsLeft = Math.max(0, maxTry - attemptsUsed);

  const isComplete = otp.every((d) => d !== '');
  const token = otp.join('');

  const disableVerify = isExpired || !isComplete || isVerifying || attemptsLeft === 0;
  const canResend = !isResending && cooldownLeft === 0;

  const focusIndex = (i) => inputsRef.current[i]?.focus?.();

  const resetOtp = () => {
    setOtp(Array.from({ length: OTP_LENGTH }, () => ''));
    setError('');
    setAttemptsUsed(0);
    setTimeout(() => focusIndex(0), 0);
  };

  const applyValueAt = (index, value) => {
    // Accept a single digit, or allow paste of up to OTP_LENGTH digits into any cell
    const digits = String(value ?? '').replace(/\D/g, '');
    if (!digits) {
      setOtp((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }

    // Paste behavior
    if (digits.length > 1) {
      const take = digits.slice(0, OTP_LENGTH);
      const next = Array.from({ length: OTP_LENGTH }, (_, i) => take[i] ?? '');
      setOtp(next);
      setError('');
      const nextFocus = Math.min(take.length, OTP_LENGTH - 1);
      setTimeout(() => focusIndex(nextFocus), 0);
      return;
    }

    // Normal single digit
    const d = digits[0];
    setOtp((prev) => {
      const next = [...prev];
      next[index] = d;
      return next;
    });
    setError('');
    if (index < OTP_LENGTH - 1) setTimeout(() => focusIndex(index + 1), 0);
  };

  const handleKeyPress = (index, key) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      focusIndex(index - 1);
    }
  };

  const handleSubmit = async () => {
    if (disableVerify) {
      if (attemptsLeft === 0) setError('Too many attempts. Please resend the code.');
      if (isExpired) setError('Code expired. Please resend the code.');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const res = await Promise.resolve(onConfirm?.(token));

      // If handler returns a structured result, respect it.
      if (res && typeof res === 'object' && res.ok === false) {
        setAttemptsUsed((a) => a + 1);
        setError(res.message || 'Invalid code. Please try again.');
        return;
      }

      // If handler returns nothing, assume it handled navigation.
    } catch (e) {
      setAttemptsUsed((a) => a + 1);
      setError(e?.message || 'Invalid code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    setIsResending(true);
    setError('');

    try {
      const res = await Promise.resolve(onResend?.());

      if (res && typeof res === 'object' && res.ok === false) {
        setError(res.message || 'Failed to resend code. Try again.');
        return;
      }

      setLocalSentAt(Date.now());
      resetOtp();
    } catch (e) {
      setError(e?.message || 'Failed to resend code. Try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <View style={styles.iconCircle}>
            <Image
              source={require('../assets/otp-clock.png')}
              style={styles.iconImage}
              resizeMode="contain"
            />
          </View>
        </View>

        <Text style={styles.title}>Almost there!</Text>
        <Text style={styles.subtitle}>
          Enter the verification code sent to {phoneNumber}
        </Text>

        <Text style={[styles.timer, isExpired && styles.expired]}>
          {isExpired ? 'Code expired' : `Code expires in ${formatTime(secondsLeft)}`}
        </Text>

        {attemptsLeft < maxTry && (
          <Text style={styles.attempts}>
            Attempts left: {attemptsLeft}/{maxTry}
          </Text>
        )}

        <View style={styles.otpRow}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputsRef.current[index] = ref)}
              style={[styles.otpInput, (isExpired || attemptsLeft === 0) && styles.disabledInput]}
              keyboardType="number-pad"
              maxLength={index === 0 ? OTP_LENGTH : 1} // allow paste in first box
              value={digit}
              editable={!isExpired && attemptsLeft > 0 && !isVerifying}
              onChangeText={(value) => applyValueAt(index, value)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
            />
          ))}
        </View>

        {error !== '' && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.primaryButton, disableVerify && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={disableVerify}
        >
          <Text style={styles.primaryText}>{isVerifying ? 'Verifying...' : 'Continue'}</Text>
        </Pressable>

        <Pressable
          style={[styles.outlineButton, (!canResend || isResending) && styles.disabledButton]}
          onPress={handleResend}
          disabled={!canResend || isResending}
        >
          <Text style={styles.outlineText}>
            {isResending
              ? 'Sending...'
              : cooldownLeft > 0
                ? `Resend in ${formatTime(cooldownLeft)}`
                : 'Resend Code'}
          </Text>
        </Pressable>

        {onBack && (
          <Pressable style={styles.backButton} onPress={onBack} disabled={isVerifying || isResending}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
  },
  content: { flex: 1 },
  iconWrapper: { alignItems: 'center', marginVertical: 40 },
  iconCircle: {
    width: 200,
    height: 200,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconImage: { width: 200, height: 200, tintColor: '#1E3A8A' },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  timer: {
    textAlign: 'center',
    fontSize: 14,
    color: '#1E3A8A',
    marginBottom: 8,
  },
  expired: { color: '#DC2626' },
  attempts: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  otpInput: {
    width: 46,
    height: 56,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 22,
    marginHorizontal: 4,
    backgroundColor: '#F9FAFB',
  },
  disabledInput: { backgroundColor: '#E5E7EB' },
  error: {
    color: '#DC2626',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  primaryButton: {
    height: 48,
    backgroundColor: '#1E3A8A',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  disabledButton: { opacity: 0.5 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  outlineButton: {
    height: 48,
    borderWidth: 1,
    borderColor: '#1E3A8A',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  outlineText: { color: '#1E3A8A', fontSize: 16, fontWeight: '500' },
  backButton: {
    height: 48,
    borderWidth: 1,
    borderColor: '#111827',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 16, color: '#111827' },
});
