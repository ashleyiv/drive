import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, StatusBar } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const mockChartData = Array.from({ length: 20 }, (_, i) => ({
  x: i * 5,
  y: Math.random() * 80 + 20 + i * 2,
}));

function MiniChart({ title, subtitle }) {
  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>{title}</Text>
      <Text style={styles.chartSubtitle}>{subtitle}</Text>
      <View style={styles.chartPlaceholder}>
        <Text style={{ fontSize: 10, color: '#3B82F6' }}>Chart Placeholder</Text>
      </View>
    </View>
  );
}

function SteeringWheelIndicator() {
  return (
    <View style={styles.steeringContainer}>
      <Text style={styles.steeringText}>HAND ON{'\n'}STEERING WHEEL</Text>
      <View style={styles.steeringCircleOuter}>
        <View style={styles.steeringCircleInner} />
      </View>
      <Text style={styles.steeringLossText}>LOSS GRIP</Text>
    </View>
  );
}

export default function ReportsScreen({ type, level }) {
  const navigation = useNavigation();

  const getTitle = () => {
    switch (type) {
      case 'eye-lid':
        return 'Eye Lid Monitoring';
      case 'steering-wheel':
        return 'Steering Wheel Monitoring';
      case 'yawning':
        return 'Yawning Rate';
      case 'head-tilting':
        return 'Head Tilting';
      default:
        return '';
    }
  };

  const getBgColor = () => {
    switch (level) {
      case 'level1':
        return ['#22c55e', '#16a34a']; 
      case 'level2':
        return ['#f59e0b', '#d97706']; 
      case 'level3':
        return ['#ef4444', '#b91c1c']; 
      default:
        return ['#3b82f6', '#2563eb'];
    }
  };

  const renderContent = () => {
    if (type === 'steering-wheel' && level === 'level3') {
      return <SteeringWheelIndicator />;
    }
    if (type === 'eye-lid' && level === 'level3') {
      return (
        <>
          <MiniChart title="BLINK RATE" subtitle="per minute" />
          <MiniChart title="PERCLOS" subtitle="per minute" />
        </>
      );
    }
    if (type === 'yawning') {
      return (
        <>
          <MiniChart title="YAWNING RATE" subtitle="per minute" />
          <MiniChart title="YAWNING TIME" subtitle="per minute" />
        </>
      );
    }
    return (
      <>
        <MiniChart title="HEAD TILTING RATE" subtitle="per minute" />
        <MiniChart title="HEAD TILTING TIME" subtitle="per minute" />
      </>
    );
  };

  const navButtons = [
    { screen: 'Dashboard', icon: 'map-pin', label: 'Home' },
    { screen: 'History', icon: 'clock', label: 'History' },
    { screen: 'Location', icon: 'map-pin', label: 'Location' },
    { screen: 'Contacts', icon: 'user', label: 'Contacts' },
    { screen: 'Menu', icon: 'menu', label: 'Menu' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: getBgColor()[0] }]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>REPORTS</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {renderContent()}
      </ScrollView>

      <View style={styles.navBar}>
        {navButtons.map((btn, idx) => (
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
    backgroundColor: '#f3f4f6',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: 120,
  },
  chartContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  chartTitle: { fontSize: 12, color: '#111827', marginBottom: 2 },
  chartSubtitle: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  chartPlaceholder: {
    height: 80,
    borderWidth: 1,
    borderColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  steeringContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    height: 256,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  steeringText: { fontSize: 12, color: '#111827', textAlign: 'center', marginBottom: 16 },
  steeringCircleOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 12,
    borderColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  steeringCircleInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'white',
  },
  steeringLossText: { fontSize: 24, color: '#111827', fontWeight: 'bold' },
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
