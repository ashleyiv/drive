// components/EmergencyContactNotifications.js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { MaterialIcons, FontAwesome5, Feather } from '@expo/vector-icons';

const Button = ({ onPress, children, style, variant }) => {
  const buttonStyle = [styles.button, style, variant === 'outline' ? styles.outlineButton : null];
  return (
    <TouchableOpacity onPress={onPress} style={buttonStyle}>
      {children}
    </TouchableOpacity>
  );
};

export default function EmergencyContactNotifications({ onNavigate }) {
  const [notifications, setNotifications] = useState([
    // ✅ NEW: Level 3 warning notification
    {
      id: '0',
      driverName: 'Jane Doe',
      type: 'alert',
      message: 'Driver status changed to LEVEL 3 WARNING',
      timestamp: 'Just now',
    },
    {
      id: '1',
      driverName: 'Hudson Williams',
      type: 'invite',
      message: 'Hudson Williams wants to add you as an emergency contact',
      timestamp: '2 hours ago',
      status: 'pending',
    },
    {
      id: '2',
      driverName: 'John Doe',
      type: 'alert',
      message: 'Driver status changed to Warning',
      timestamp: '5 hours ago',
    },
    {
      id: '3',
      driverName: 'Robert Chen',
      type: 'invite',
      message: 'Robert Chen wants to add you as an emergency contact',
      timestamp: '1 day ago',
      status: 'pending',
    },
  ]);

  const handleAccept = (id) => {
    setNotifications((prev) =>
      prev.map((notif) => (notif.id === id ? { ...notif, status: 'accepted' } : notif))
    );
  };

  const handleDecline = (id) => {
    setNotifications((prev) =>
      prev.map((notif) => (notif.id === id ? { ...notif, status: 'declined' } : notif))
    );
  };

  const renderNotification = ({ item }) => {
    const isLevel3 =
      item.type === 'alert' &&
      String(item.message || '').toUpperCase().includes('LEVEL 3');

    return (
      <View
        style={[
          styles.notificationCard,
          isLevel3 && { borderWidth: 1, borderColor: '#DC2626' },
        ]}
      >
        <View style={styles.notificationContent}>
          <View
            style={[
              styles.avatar,
              isLevel3 && { backgroundColor: '#FEE2E2' },
            ]}
          >
            <FontAwesome5
              name="user"
              size={20}
              color={isLevel3 ? '#DC2626' : '#1E3A8A'}
            />
          </View>

          <View style={styles.textContent}>
            <Text style={[styles.message, isLevel3 && { color: '#DC2626', fontWeight: '700' }]}>
              {item.message}
            </Text>
            <Text style={styles.timestamp}>{item.timestamp}</Text>

            {item.type === 'invite' && item.status === 'pending' && (
              <View style={styles.actionButtons}>
                <Button onPress={() => handleAccept(item.id)} style={styles.acceptButton}>
                  <MaterialIcons name="check" size={16} color="white" />
                  <Text style={styles.acceptText}> Accept</Text>
                </Button>

                <Button onPress={() => handleDecline(item.id)} variant="outline" style={styles.declineButton}>
                  <MaterialIcons name="close" size={16} color="#374151" />
                  <Text style={styles.declineText}> Decline</Text>
                </Button>
              </View>
            )}

            {item.status === 'accepted' && <Text style={styles.acceptedText}>✓ Accepted</Text>}
            {item.status === 'declined' && <Text style={styles.declinedText}>Declined</Text>}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Text style={styles.headerSubtitle}>Invites and alerts</Text>
      </View>

      <View style={styles.listContainer}>
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Feather name="bell" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={renderNotification}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          />
        )}
      </View>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navButton} onPress={() => onNavigate?.('ec-dashboard')}>
          <FontAwesome5 name="users" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>Drivers</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={() => onNavigate?.('ec-notifications')}>
          <Feather name="bell" size={24} color="#1E3A8A" />
          <Text style={[styles.navText, { color: '#1E3A8A' }]}>Notifications</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={() => onNavigate?.('ec-settings')}>
          <Feather name="settings" size={24} color="#9CA3AF" />
          <Text style={styles.navText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { backgroundColor: '#1E3A8A', paddingVertical: 24, paddingHorizontal: 16 },
  headerTitle: { fontSize: 24, color: 'white', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#DBEAFE' },

  listContainer: { flex: 1, padding: 16 },

  notificationCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  notificationContent: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContent: { flex: 1 },
  message: { fontSize: 14, color: '#111827', marginBottom: 2 },
  timestamp: { fontSize: 12, color: '#9CA3AF' },

  actionButtons: { flexDirection: 'row', marginTop: 8, gap: 8 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
  },
  outlineButton: { borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: 'white' },
  acceptButton: { flex: 1, backgroundColor: '#1E3A8A' },
  declineButton: { flex: 1 },
  acceptText: { color: 'white', fontSize: 14 },
  declineText: { color: '#374151', fontSize: 14 },
  acceptedText: { fontSize: 12, color: '#16A34A', marginTop: 4 },
  declinedText: { fontSize: 12, color: '#6B7280', marginTop: 4 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 64 },
  emptyText: { marginTop: 12, color: '#6B7280', fontSize: 16 },

  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: 'white',
  },
  navButton: { alignItems: 'center' },
  navText: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
});
