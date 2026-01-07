import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  Pressable, 
  StyleSheet, 
  ScrollView, 
  Image 
} from 'react-native';
import { AntDesign, Feather } from '@expo/vector-icons';

export default function LoginScreen({ onLogin, onForgotPassword, onSignup }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);


  const validateForm = () => {
    const newErrors = {};
    if (!phoneNumber.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (phoneNumber.length < 10) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    // Keep UI logic here; App.js handles OTP send + navigation.
    try {
      await Promise.resolve(onLogin({ phoneNumber, password }));
    } catch {
      // App.js should surface errors via Alert, but don't crash this screen.
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.spacer} />

      <Text style={styles.title}>Log in to DRIVE</Text>
      <Text style={styles.description}>Welcome back! Please enter your details.</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Phone Number</Text>
        <View style={styles.inputWrapper}>
          <Feather name="phone" size={18} style={styles.icon} />
          <TextInput
            placeholder="+63"
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            style={styles.input}
          />
        </View>
        {errors.phone && <Text style={styles.error}>{errors.phone}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Password</Text>
        <View style={styles.inputWrapper}>
          <Feather name="lock" size={18} style={styles.icon} />
          <TextInput
            placeholder="Password"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />
          <Pressable onPress={() => setShowPassword(!showPassword)}>
            <Feather
              name={showPassword ? 'eye-off' : 'eye'}
              size={18}
              color="#6B7280"
            />
          </Pressable>
        </View>
        {errors.password && <Text style={styles.error}>{errors.password}</Text>}
      </View>

      <Pressable style={styles.loginButton} onPress={handleSubmit}>
        <Text style={styles.loginText}>Log In</Text>
      </Pressable>

      <Text style={{ textAlign: 'center', marginVertical: 12, fontSize: 16, color: '#6B7280' }}>
        or
      </Text>

      <Pressable style={styles.googleButton} onPress={() => onLogin('google')}>
        <Image
          source={{ uri: 'https://registry.npmmirror.com/@lobehub/icons-static-png/1.75.0/files/dark/google-color.png' }}
          style={{ width: 18, height: 18, marginRight: 10 }}
        />
        <Text style={styles.googleText}>Continue with Google</Text>
      </Pressable>

      <Pressable onPress={onForgotPassword}>
        <Text style={styles.forgot}>Forgot password?</Text>
      </Pressable>

      <View style={styles.signupContainer}>
        <Text style={styles.signupText}>Don't have an account? </Text>
        <Pressable onPress={onSignup}>
          <Text style={styles.signupLink}>Sign Up</Text>
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
  logoContainer: { alignItems: 'center', marginBottom: 24 },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  icon: { fontSize: 18, marginRight: 8 },
  input: { flex: 1, fontSize: 16 },
  error: { color: '#DC2626', fontSize: 12, marginTop: 4 },
  loginButton: {
    height: 48,
    backgroundColor: '#1E3A8A',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  loginText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  forgot: { marginTop: 16, color: '#2563EB', fontSize: 14, textAlign: 'center' },
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
  googleIcon: { fontSize: 18, marginRight: 8 },
  googleText: { fontSize: 16, color: '#374151' },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  signupText: { fontSize: 14, color: '#4B5563' },
  signupLink: { fontSize: 14, color: '#2563EB', fontWeight: '500' },
  bottomSpacer: { height: 40 },
});
