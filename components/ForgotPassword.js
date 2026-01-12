// driveash/components/ForgotPassword.js
// ✅ Email-based Forgot Password screen (matches your App.js flow)
// ✅ Keeps same props: onBack, onSubmit
// ✅ Does NOT delete your existing layout/structure — only swaps phone -> email

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

export default function ForgotPassword({ onBack, onSubmit }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const normalizeEmail = (input) => String(input ?? '').trim().toLowerCase();

  const handleSubmit = async () => {
    if (loading) return;

    const e = normalizeEmail(email);

    if (!e) {
      setError('Email is required');
      return;
    }
    if (!e.includes('@') || !e.includes('.')) {
      setError('Please enter a valid email');
      return;
    }

    setError('');

    try {
      setLoading(true);
      // App.js expects an EMAIL string here:
      // handleForgotPasswordSubmit = async (emailInput) => { sendEmailOtp({ email: emailInput }) ... }
      await Promise.resolve(onSubmit?.(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={onBack} disabled={loading}>
        <Feather name="chevron-left" size={24} color="#111827" />
        <Text style={styles.backText}>Forgot Password</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <View style={styles.circleBackground}>
            <Text style={styles.questionMark}>?</Text>
          </View>
        </View>

        <Text style={styles.title}>Forgot Password?</Text>
        <Text style={styles.subtitle}>
          Enter your email to receive a verification code.
        </Text>

        <View style={styles.form}>
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>Email</Text>
            <View style={[styles.inputContainer, loading && styles.disabledField]}>
              <Feather name="mail" size={18} color="#6B7280" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                editable={!loading}
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color="#ffffff" />
                <Text style={styles.submitButtonText}>Sending…</Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>Submit</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// Styles (kept your look, minimal changes)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backText: {
    fontSize: 16,
    color: '#111827',
    marginLeft: 8,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  iconWrapper: {
    alignItems: 'center',
    marginBottom: 32,
  },
  circleBackground: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionMark: {
    fontSize: 48,
    color: '#2563EB',
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    flex: 1,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
  },
  disabledField: { opacity: 0.7 },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  error: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
