import React from 'react';
import { View, Text, TouchableOpacity, FlatList, ScrollView, StyleSheet, StatusBar } from 'react-native';
import { Ionicons, Feather, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const notifications = [
  {
    id: '1',
    type: 'warning',
    level: 'level3',
    title: 'Level 3 Warning Detected',
    message: 'Extremely drowsy state detected at 9:35 PM',
    time: '5 minutes ago',
    color: '#dc2626', 
    bgColor: '#fee2e2', 
    icon: 'alert-triangle', 
  },
  {
    id: '2',
    type: 'warning',
    level: 'level2',
    title: 'Level 2 Warning Detected',
    message: 'Moderately drowsy state detected at 8:15 PM',
    time: '1 hour ago',
    color: '#d97706', 
    bgColor: '#fef3c7',
    icon: 'alert-triangle',
  },
  {
    id: '3',
    type: 'info',
    title: 'System Update',
    message: 'Monitoring system is functioning normally',
    time: '2 hours ago',
    color: '#2563eb', 
    bgColor: '#dbeafe', 
    icon: 'info',
  },
  {
    id: '4',
    type: 'warning',
    level: 'level1',
    title: 'Level 1 Warning Detected',
    message: 'Slightly drowsy state detected at 6:30 PM',
    time: '3 hours ago',
    color: '#16a34a', 
    bgColor: '#dcfce7', 
    icon: 'alert-triangle',
  },
];

export default function NotificationsPanel() {
  const navigation = useNavigation();

  const renderIcon = (iconName, color) => {
    switch (iconName) {
      case 'alert-triangle':
        return <Feather name="alert-triangle" size={20} color={color} />;
      case 'info':
        return <Feather name="info" size={20} color={color} />;
      default:
        return null;
    }
  };

  const renderNotification = ({ item }) => (
    <View style={[styles.notificationCard, { backgroundColor: item.bgColor }]}>
      <View style={styles.notificationRow}>
        <View style={[styles.iconContainer, { backgroundColor: item.bgColor }]}>
          {renderIcon(item.icon, item.color)}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.notificationTitle, { color: item.color }]}>{item.title}</Text>
          <Text style={styles.notificationMessage}>{item.message}</Text>
          <Text style={styles.notificationTime}>{item.time}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NOTIFICATIONS</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        contentContainerStyle={styles.scrollContent}
      />

      <View style={styles.navBar}>
        <TouchableOpacity style={styles.navButton} onPress={() => onNavigate('Dashboard')}>
          <View style={styles.navIcon}>
            <Feather name="home" size={20} color="white" />
          </View>
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={() => onNavigate('History')}>
          <View style={styles.navIcon}>
            <Feather name="clock" size={20} color="white" />
          </View>
          <Text style={styles.navText}>History</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={() => onNavigate('Location')}>
          <View style={styles.navIcon}>
            <Feather name="map-pin" size={20} color="white" />
          </View>
          <Text style={styles.navText}>Location</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={() => onNavigate('Contacts')}>
          <View style={styles.navIcon}>
            <Feather name="user" size={20} color="white" />
          </View>
          <Text style={styles.navText}>Contacts</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={() => onNavigate('Menu')}>
          <View style={styles.navIcon}>
            <Feather name="menu" size={20} color="white" />
          </View>
          <Text style={styles.navText}>Menu</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#3b82f6' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 48 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 120 },
  notificationCard: { borderRadius: 20, padding: 16, marginBottom: 12 },
  notificationRow: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  notificationTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  notificationMessage: { fontSize: 12, color: '#4b5563', marginBottom: 2 },
  notificationTime: { fontSize: 12, color: '#6b7280' },
  navBar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, backgroundColor: '#3b82f6' },
  navButton: { alignItems: 'center' },
  navIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#60a5fa', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  navText: { fontSize: 10, color: 'white' },
});
