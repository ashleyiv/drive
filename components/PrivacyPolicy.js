import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacyPolicy({ onBack }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.text}>
          This Privacy Policy describes how the D.R.I.V.E. app ("we," "us," or "our")
          collects, uses, and protects your information. Our primary mission is to
          enhance road safety through drowsiness and hand-detection monitoring
          while prioritizing your privacy.
        </Text>

        <Text style={styles.sectionTitle}>1. Information We Collect</Text>
        <Text style={styles.bullet}>
          • Real-Time Visual Data: The app uses your device's camera to monitor eye
          patterns (drowsiness detection) and hand placement on the steering wheel.
        </Text>
        <Text style={styles.bullet}>
          • Device Information: Basic technical data such as device model, operating
          system version, and app performance logs.
        </Text>
        <Text style={styles.bullet}>
          • Location Data (Optional): Used to provide context for safety alerts or
          log where fatigue incidents occur.
        </Text>

        <Text style={styles.sectionTitle}>2. How We Use Your Data</Text>
        <Text style={styles.bullet}>• Safety Alerts for drowsiness or hands-off behavior.</Text>
        <Text style={styles.bullet}>• App optimization and algorithm improvement.</Text>
        <Text style={styles.bullet}>• User driving safety summaries (if requested).</Text>

        <Text style={styles.sectionTitle}>3. Data Storage and Privacy</Text>
        <Text style={styles.text}>
          We believe your face is your business.
        </Text>
        <Text style={styles.bullet}>
          • On-Device Processing: Visual processing happens locally on your device.
          We do not stream or store continuous video footage.
        </Text>
        <Text style={styles.bullet}>
          • No Image Selling: We never sell personal or visual data.
        </Text>
        <Text style={styles.bullet}>
          • Encryption: Any transmitted analytics data is encrypted using
          industry-standard protocols.
        </Text>

        <Text style={styles.sectionTitle}>4. Third-Party Services</Text>
        <Text style={styles.text}>
          D.R.I.V.E. may use third-party tools for crash reporting or analytics
          (such as Firebase or Sentry). These services receive only anonymized
          technical data and never access your camera feed.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1E40AF',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  content: { padding: 20 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  text: {
    fontSize: 15,
    color: '#374151',
    marginTop: 8,
    lineHeight: 22,
  },
  bullet: {
    fontSize: 15,
    color: '#374151',
    marginTop: 8,
    lineHeight: 22,
  },
});
