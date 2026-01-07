import React from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet, StatusBar } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import driverImage from '../assets/driver.png';

const detectionMetrics = [
  { label: 'Perclos', value: 'MAR' },
  { label: 'Eyes Closed', value: 'Head T' },
  { label: 'Yawn Frequently', value: 'Tilt Fre' }
];

export default function WarningDetails({ alert }) {
  const navigation = useNavigation();

  const getBgColor = () => {
    switch (alert.level) {
      case 'level1': return ['#22c55e', '#16a34a']; 
      case 'level2': return ['#f59e0b', '#d97706']; 
      case 'level3': return ['#ef4444', '#b91c1c']; 
      default: return ['#3b82f6', '#2563eb'];
    }
  };

  const getLevelText = () => {
    switch (alert.level) {
      case 'level1': return 'LEVEL 1 WARNING';
      case 'level2': return 'LEVEL 2 WARNING';
      case 'level3': return 'LEVEL 3 WARNING';
    }
  };

  const getLevelColor = () => {
    switch (alert.level) {
      case 'level1': return '#16a34a';
      case 'level2': return '#d97706';
      case 'level3': return '#ef4444';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: getBgColor()[0] }]}>
      <StatusBar barStyle="light-content" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>DETAILS</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { color: getLevelColor() }]}>{getLevelText()}</Text>
          <Image source={driverImage} style={styles.driverImage} resizeMode="cover" />
          <View style={styles.metricsContainer}>
            <Text style={styles.metricText}>Date: <Text style={styles.metricValue}>December 15, 2025</Text></Text>
            <Text style={styles.metricText}>Time: <Text style={styles.metricValue}>{alert.timestamp}</Text></Text>
            <View style={styles.metricGrid}>
              {detectionMetrics.map((metric, index) => (
                <View key={index} style={styles.metricItem}>
                  <Text style={styles.metricLabel}>{metric.label}</Text>
                  <Text style={styles.metricValue}>{metric.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Map Card */}
        <View style={styles.card}>
          <View style={styles.mapPlaceholder}>
            <Text style={{ fontSize: 12, color: '#9ca3af' }}>Map Placeholder</Text>
          </View>
          <View style={styles.mapInfo}>
            <Text style={styles.metricText}>Top Speed: <Text style={styles.metricValue}>22 mph</Text></Text>
            <Text style={styles.metricText}>Location: <Text style={styles.metricValue}>Along Congressional Road Ext.</Text></Text>
          </View>
        </View>
      </ScrollView>

      {/* Navigation Bar */}
      <View style={styles.navBar}>
        {[
          { screen: 'Dashboard', icon: 'map-pin', label: 'Home' },
          { screen: 'History', icon: 'clock', label: 'History' },
          { screen: 'Location', icon: 'map-pin', label: 'Location' },
          { screen: 'Contacts', icon: 'user', label: 'Contacts' },
          { screen: 'Menu', icon: 'menu', label: 'Menu' },
        ].map((btn, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.navButton}
            onPress={() => navigation.navigate(btn.screen)}
          >
            <View style={styles.navIcon}>
              <Feather name={btn.icon} size={20} color="white" />
            </View>
            <Text style={styles.navText}>{btn.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 48,
  },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  content: {
    flexGrow: 1,
    backgroundColor: '#f9fafb',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    overflow: 'hidden',
    padding: 16,
  },
  cardTitle: { fontSize: 14, marginBottom: 8, textAlign: 'center', fontWeight: 'bold' },
  driverImage: { width: '100%', height: 192, borderRadius: 12, marginBottom: 12 },
  metricsContainer: { marginTop: 8 },
  metricText: { fontSize: 12, color: '#374151', marginBottom: 4 },
  metricValue: { fontWeight: 'bold', color: '#111827' },
  metricGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  metricItem: { alignItems: 'center', flex: 1 },
  metricLabel: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  mapPlaceholder: {
    height: 192,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 12,
  },
  mapInfo: { paddingHorizontal: 4 },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    backgroundColor: '#3b82f6',
  },
  navButton: { alignItems: 'center' },
  navIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#60a5fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  navText: { fontSize: 10, color: 'white' },
});
