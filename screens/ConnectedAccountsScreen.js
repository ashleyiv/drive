import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, Modal } from 'react-native';
import { Feather, Entypo } from '@expo/vector-icons';

const lightTheme = {
  background: '#F9FAFB',
  card: '#FFFFFF',
  text: '#111827',
  subText: '#6B7280',
  divider: '#E5E7EB',
  primary: '#1E3A8A',
  secondary: '#DBEAFE',
  danger: '#DC2626',
};

const darkTheme = {
  background: '#0F172A',
  card: '#1E293B',
  text: '#F9FAFB',
  subText: '#94A3B8',
  divider: '#334155',
  primary: '#3B82F6',
  secondary: '#1E40AF',
  danger: '#F87171',
};

export default function ConnectedAccountsScreen({ onNavigate, isDarkMode }) {
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  const theme = isDarkMode ? darkTheme : lightTheme;

  const connectedAccounts = [
    { id: '1', name: 'John Doe', email: 'john@example.com' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
    { id: '3', name: 'Bob Johnson', email: 'bob@example.com' },
  ];

  const disconnectAccount = () => {
    console.log('Disconnected:', selectedAccount.name);
    setShowDisconnectModal(false);
    setSelectedAccount(null);
  };

  const renderAccount = ({ item }) => (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={[styles.itemTitle, { color: theme.text }]}>{item.name}</Text>
          <Text style={[styles.itemSubtitle, { color: theme.subText }]}>{item.email}</Text>
        </View>
        <Pressable
          onPress={() => {
            setSelectedAccount(item);
            setShowDisconnectModal(true);
          }}
        >
          <Entypo name="dots-three-vertical" size={20} color={theme.subText} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <Pressable style={styles.backButton} onPress={() => onNavigate('ec-settings')}>
          <View style={styles.backRow}>
            <Feather name="chevron-left" size={24} color="#DBEAFE" />
            <Text style={styles.backText}>Back</Text>
          </View>
        </Pressable>

        <View style={{ marginTop: 16 }}> 
          <Text style={styles.headerTitle}>Connected Drivers</Text>
        </View>
      </View>

      <FlatList
        data={connectedAccounts}
        keyExtractor={(item) => item.id}
        renderItem={renderAccount}
        contentContainerStyle={{ paddingBottom: 40 }}
      />


      <Modal transparent visible={showDisconnectModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Disconnect Account</Text>
            <Text style={styles.modalText}>
              Are you sure you want to disconnect {selectedAccount?.name}?
            </Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowDisconnectModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={disconnectAccount}>
                <Text style={[styles.confirmText, { color: theme.danger }]}>Disconnect</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingVertical: 24, paddingHorizontal: 24, justifyContent: 'center' },
  backButton: {
    position: 'absolute',
    top: 10,
    left: 18,
  },
  backRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4, 
},
backText: {
  color: '#DBEAFE',
  fontSize: 14,
  fontWeight: '500',
},
  headerTitle: { color: '#FFF', fontSize: 24, fontWeight: '600' },
  headerSubtitle: { color: '#DBEAFE', fontSize: 14, marginTop: 4 },
  card: { borderRadius: 12, padding: 16, marginHorizontal: 16, marginVertical: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemTitle: { fontSize: 16, fontWeight: '500' },
  itemSubtitle: { fontSize: 14, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '85%', backgroundColor: 'white', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  modalText: { fontSize: 14, color: '#4B5563', marginBottom: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 },
  cancelText: { color: '#6B7280' },
  confirmText: { fontWeight: 'bold' },
});
