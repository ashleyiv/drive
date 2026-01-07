import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';

const historyData = [
  {
    id: 1,
    date: 'DEC 15, 2025',
    time: '09:15 AM',
    location: 'Quezon City, Metro Manila',
    level: 'level1',
    levelText: 'LEVEL 1 WARNING',
    color: '#10B981',
  },
  {
    id: 2,
    date: 'DEC 14, 2025',
    time: '02:30 PM',
    location: 'Makati City, Metro Manila',
    level: 'level2',
    levelText: 'LEVEL 2 WARNING',
    color: '#F59E0B',
  },
  {
    id: 3,
    date: 'DEC 14, 2025',
    time: '11:45 AM',
    location: 'Manila City, Metro Manila',
    level: 'level3',
    levelText: 'LEVEL 3 WARNING',
    color: '#EF4444',
  },
  {
    id: 4,
    date: 'DEC 13, 2025',
    time: '08:20 AM',
    location: 'Pasig City, Metro Manila',
    level: 'level1',
    levelText: 'LEVEL 1 WARNING',
    color: '#10B981',
  },
  {
    id: 5,
    date: 'DEC 12, 2025',
    time: '05:15 PM',
    location: 'Taguig City, Metro Manila',
    level: 'level2',
    levelText: 'LEVEL 2 WARNING',
    color: '#F59E0B',
  },
];

export default function History({ onNavigate }) {
  const getLevelColor = (level) => {
    switch (level) {
      case 'level1':
        return '#10B981';
      case 'level2':
        return '#F59E0B';
      case 'level3':
        return '#EF4444';
      default:
        return '#000';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>History</Text>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 100 }}>
        {historyData.map((item) => (
          <TouchableOpacity key={item.id} style={styles.item}>
            <View style={[styles.iconBox, { backgroundColor: item.color }]}>
              {item.level === 'level1' && (
                <MaterialCommunityIcons name="alert-circle-outline" size={24} color="white" />
              )}
              {item.level === 'level2' && (
                <MaterialCommunityIcons name="alert-outline" size={24} color="white" />
              )}
              {item.level === 'level3' && (
                <MaterialCommunityIcons name="alert" size={24} color="white" />
              )}
            </View>

            <View style={styles.itemContent}>
              <Text style={styles.dateText}>{item.date}</Text>
              <Text style={[styles.levelText, { color: getLevelColor(item.level) }]}>
                {item.levelText}
              </Text>
              <Text style={styles.locationText}>{item.location}</Text>
              <Text style={styles.timeText}>{item.time}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, backgroundColor: '#white' }}>
          <NavItem icon="home" label="Home" onPress={() => onNavigate('dashboard')}  />
          <NavItem icon="clock" label="History" onPress={() => onNavigate('history')} active />
          <NavItem icon="map-pin" label="Location" onPress={() => onNavigate('location')} />
          <NavItem icon="users" label="Contacts" onPress={() => onNavigate('contacts')} />
          <NavItem icon="menu" label="Menu" onPress={() => onNavigate('menu')} />
        </View>
      </View>
  );
}

function NavItem({ icon, label, onPress, active }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={active} style={{ alignItems: 'center' }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: active ? '#3B82F6' : 'white', alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={18} color={active ? '#ffffff' : '#3B82F6'} />
      </View>
      <Text style={{ color: '#3B82F6', fontSize: 12, marginTop: 4 }}>{label}</Text>
    </TouchableOpacity>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerText: { fontSize: 24, fontWeight: '600', color: '#111827' },
  list: { flex: 1 },
  item: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  itemContent: { flex: 1 },
  dateText: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  levelText: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  locationText: { fontSize: 12, color: '#4B5563', marginBottom: 2 },
  timeText: { fontSize: 12, color: '#6B7280' },
  navbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    backgroundColor: '#2563EB',
  },
  navButton: { alignItems: 'center' },
  navText: { fontSize: 10, marginTop: 2, color: 'white' },
});
