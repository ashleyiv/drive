import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import useTheme from '../theme/useTheme';

export default function TermsContent() {
  const { theme } = useTheme();

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
        1. Description of Service
      </Text>
      <Text style={[styles.text, { color: theme.textPrimary }]}>
        D.R.I.V.E. provides a driver assistance monitoring system designed to detect driver fatigue/drowsiness and
        hand presence on the steering wheel. It is an assistive tool only and does not guarantee prevention of
        incidents.
      </Text>

      <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
        2. Not a Substitute for Professional Safety
      </Text>
      <Text style={styles.warning}>
        CRITICAL WARNING: D.R.I.V.E. is a secondary safety aid and not an automated driving system.
      </Text>
      <Text style={[styles.bullet, { color: theme.textPrimary }]}>
        • The driver is solely responsible for safe vehicle operation.
      </Text>
      <Text style={[styles.bullet, { color: theme.textPrimary }]}>
        • The App may fail due to lighting, camera angles, device placement, network issues, or technical limitations.
      </Text>
      <Text style={[styles.bullet, { color: theme.textPrimary }]}>
        • Never drive while impaired or excessively tired. Pull over safely if needed.
      </Text>

      <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
        3. User Responsibilities
      </Text>
      <Text style={[styles.bullet, { color: theme.textPrimary }]}>
        • Mount the device securely and do not obstruct your view or vehicle controls.
      </Text>
      <Text style={[styles.bullet, { color: theme.textPrimary }]}>
        • Comply with all local traffic laws regarding mobile device usage.
      </Text>
      <Text style={[styles.bullet, { color: theme.textPrimary }]}>
        • Keep the App updated for the latest safety improvements.
      </Text>
      <Text style={[styles.bullet, { color: theme.textPrimary }]}>
        • Ensure your camera lens is unobstructed and your phone has sufficient battery before driving.
      </Text>

      <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
        4. Privacy & Data
      </Text>
      <Text style={[styles.text, { color: theme.textPrimary }]}>
        Your use of the App is governed by our Privacy Policy. Some features require permissions (e.g., camera,
        notifications, location). Where possible, processing may occur locally on your device to help protect privacy.
        Collected event records may be stored to provide history and emergency features.
      </Text>

      <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
        5. Permissions & Notifications
      </Text>
      <Text style={[styles.bullet, { color: theme.textPrimary }]}>
        • You may need to grant camera access for fatigue monitoring features.
      </Text>
      <Text style={[styles.bullet, { color: theme.textPrimary }]}>
        • You may need to grant notification access for alerts and reminders.
      </Text>
      <Text style={[styles.bullet, { color: theme.textPrimary }]}>
        • You may need to grant location access for location-based emergency notifications (if enabled).
      </Text>

      <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
        6. Emergency Contacts
      </Text>
      <Text style={[styles.text, { color: theme.textPrimary }]}>
        If you enable emergency contact features, you authorize the App to send notifications and relevant event
        details (such as time and location when available) to your chosen emergency contacts during critical events.
        You are responsible for the accuracy of contact information and obtaining consent from contacts.
      </Text>

      <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
        7. Account, Verification, and Security
      </Text>
      <Text style={[styles.bullet, { color: theme.textPrimary }]}>
        • You must provide an email address you can access for verification and account recovery.
      </Text>
      <Text style={[styles.bullet, { color: theme.textPrimary }]}>
        • You are responsible for keeping your account credentials confidential.
      </Text>
      <Text style={[styles.bullet, { color: theme.textPrimary }]}>
        • We may restrict or suspend access if suspicious activity or abuse is detected.
      </Text>

      <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
        8. Limitation of Liability
      </Text>
      <Text style={[styles.bullet, { color: theme.textPrimary }]}>
        • D.R.I.V.E. and its developers are not liable for accidents, injuries, or fatalities.
      </Text>
      <Text style={[styles.bullet, { color: theme.textPrimary }]}>
        • No liability for traffic violations, fines, damages, or losses arising from use of the App.
      </Text>

      <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
        9. No Warranty
      </Text>
      <Text style={[styles.text, { color: theme.textPrimary }]}>
        The App is provided "AS IS" and "AS AVAILABLE" without warranties of any kind. Detection accuracy may be
        affected by lighting, sunglasses, obstructions, device orientation, and other conditions.
      </Text>

      <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
        10. Modifications to Terms
      </Text>
      <Text style={[styles.text, { color: theme.textPrimary }]}>
        We reserve the right to update these Terms at any time. Continued use of the App after changes constitutes
        acceptance of the updated Terms.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  text: {
    fontSize: 15,
    marginTop: 8,
    lineHeight: 22,
  },
  bullet: {
    fontSize: 15,
    marginTop: 8,
    lineHeight: 22,
  },
  warning: {
    fontSize: 15,
    color: '#FF000D',
    marginTop: 8,
    fontWeight: 'bold',
    lineHeight: 22,
  },
});
