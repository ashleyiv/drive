import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function About({ onBack }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>About D.R.I.V.E.</Text>
        <Text style={styles.text}>
          D.R.I.V.E. (Drowsiness Recognition through Intelligent Vision Evaluation) System is a
          cutting-edge safety companion designed to bridge the gap between human
          driving and vehicle automation. We believe that technology should
          empower the driver, not distract them.
        </Text>

        <Text style={styles.sectionTitle}>Our Mission</Text>
        <Text style={styles.text}>
          Every year, thousands of accidents are caused by fatigue and distracted
          driving. Our mission is to drastically reduce these numbers by providing
          real-time, AI-driven monitoring that acts as a "second set of eyes" on
          the road and the driver.
        </Text>

        <Text style={styles.sectionTitle}>What Makes Us Different?</Text>
        <Text style={styles.bullet}>• Intelligent Vision: Using advanced computer vision, we monitor eye closure duration and hand placement with high precision.</Text>
        <Text style={styles.bullet}>• Privacy-First Design: All processing happens locally on your device, not in the cloud.</Text>
        <Text style={styles.bullet}>• Minimalist Interface: Non-intrusive alerts using color-coded urgency levels.</Text>
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
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 16 },
  text: { fontSize: 15, color: '#374151', marginTop: 8, lineHeight: 22 },
  bullet: { fontSize: 15, color: '#374151', marginTop: 8, lineHeight: 22 },
});
