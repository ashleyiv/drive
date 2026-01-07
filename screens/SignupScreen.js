import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 

export default function SignupScreen({ onSignup, onBackToLogin }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';

    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (phoneNumber.length < 10) {
      newErrors.phoneNumber = 'Please enter a valid phone number';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!agreedToTerms) {
      newErrors.terms = 'You must agree to the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSignup({
        firstName,
        lastName,
        phone: phoneNumber,
        password,
      });
    }
  };

  if (showTerms) {
    return (
      <View style={styles.container}>
        <Pressable style={styles.backButton} onPress={() => setShowTerms(false)}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.title}>Terms and Conditions</Text>
        <ScrollView style={styles.termsContainer}>
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

        <Pressable style={styles.primaryButton} onPress={() => setShowTerms(false)}>
          <Text style={styles.primaryText}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={onBackToLogin} style={styles.backButton}>
        <Ionicons name="chevron-back" size={24} color="#111827" />
        <Text style={styles.backText}>Back to Login</Text>
      </Pressable>

      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Sign up to start using DRIVE</Text>

      {renderInput('First Name', firstName, setFirstName)}
      {errors.firstName && <Text style={styles.error}>{errors.firstName}</Text>}

      {renderInput('Last Name', lastName, setLastName)}
      {errors.lastName && <Text style={styles.error}>{errors.lastName}</Text>}

      {renderInput('Phone Number', phoneNumber, setPhoneNumber, 'phone-pad')}
      {errors.phoneNumber && <Text style={styles.error}>{errors.phoneNumber}</Text>}

      {renderInput('Password', password, setPassword, 'default', true)}
      {errors.password && <Text style={styles.error}>{errors.password}</Text>}

      {renderInput('Confirm Password', confirmPassword, setConfirmPassword, 'default', true)}
      {errors.confirmPassword && <Text style={styles.error}>{errors.confirmPassword}</Text>}

      <Pressable
        style={styles.termsRow}
        onPress={() => setAgreedToTerms(!agreedToTerms)}
      >
        <Text style={styles.checkbox}>{agreedToTerms ? '☑' : '☐'}</Text>
        <Text style={styles.termsText}>
          I agree to the{' '}
          <Text style={styles.link} onPress={() => setShowTerms(true)}>
            Terms and Conditions
          </Text>
        </Text>
      </Pressable>
      {errors.terms && <Text style={styles.error}>{errors.terms}</Text>}

      <Pressable
        style={[styles.primaryButton, !agreedToTerms && styles.disabledButton]}
        disabled={!agreedToTerms}
        onPress={handleSubmit}
      >
        <Text style={styles.primaryText}>Sign Up</Text>
      </Pressable>

      <Pressable
        style={styles.googleButton}
        onPress={() => onSignup({ firstName: 'Google', lastName: 'User', phone: 'google', password: '' })}
      >
        <Image
          source={{ uri: 'https://registry.npmmirror.com/@lobehub/icons-static-png/1.75.0/files/dark/google-color.png' }}
          style={{ width: 18, height: 18, marginRight: 10 }}
        />
        <Text style={styles.googleText}>Continue with Google</Text>
      </Pressable>
    </ScrollView>
  );
}

function renderInput(label, value, onChange, keyboardType = 'default', secure = false) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        secureTextEntry={secure}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#fff', padding: 24 },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backText: { fontSize: 16, color: '#111827', marginLeft: 8 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 24 },
  field: { marginBottom: 12 },
  label: { fontSize: 14, marginBottom: 6, color: '#374151' },
  input: { height: 48, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12 },
  error: { color: '#DC2626', fontSize: 12, marginBottom: 8 },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 12 },
  checkbox: { fontSize: 18, marginRight: 8 },
  termsText: { fontSize: 14, color: '#374151', flex: 1 },
  link: { color: '#2563EB' },
  primaryButton: { backgroundColor: '#1E3A8A', height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  disabledButton: { opacity: 0.5 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  termsContainer: { flex: 1, marginVertical: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  paragraph: { fontSize: 14, color: '#374151', marginTop: 4 },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    height: 48,
    marginTop: 12,
  },
  googleText: { fontSize: 16, color: '#374151' },
});
