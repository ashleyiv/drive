import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Image,
  Pressable,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';

const contacts = [
  {
    id: '1',
    name: 'DARREN LLOYD',
    role: 'Driver',
    phone: '+63 912 345 6789',
    color: '#EF4444',
  },
  {
    id: '2',
    name: 'JANE ROE',
    role: 'Driver',
    phone: '+63 923 456 7890',
    color: '#10B981',
  },
  {
    id: '3',
    name: 'JUAN PEREZ',
    role: 'Driver',
    phone: '+63 987 654 3210',
    color: '#F59E0B',
  },
];

export default function Contacts({ onNavigate }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [contactNumber, setContactNumber] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const cleanNumber = (phone) => phone.replace(/\s+/g, '');

  const makeCall = (phone) => {
    const number = cleanNumber(phone);
    Linking.openURL(`tel:${number}`);
  };

  const sendSMS = (phone) => {
    const number = cleanNumber(phone);
    Linking.openURL(`sms:${number}`);
  };

  const sendWhatsApp = async (phone) => {
    const number = cleanNumber(phone).replace('+', '');
    const url = `whatsapp://send?phone=${number}`;
    
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      Linking.openURL(url);
    } else {
      Alert.alert('WhatsApp not installed');
    }
  };

  const showMessageOptions = (phone) => {
    Alert.alert(
      'Send message via',
      '',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'SMS', onPress: () => sendSMS(phone) },
        { text: 'WhatsApp', onPress: () => sendWhatsApp(phone) },
      ],
      { cancelable: true }
    );
  };

  // mock registered accounts
  const registeredNumbers = [
    '+639123456789',
    '+639987654321',
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 48,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderColor: '#E5E7EB',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: '600' }}>Contacts</Text>
      </View>

      {/* Contacts List */}
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16 }}
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderColor: '#F3F4F6',
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: item.color,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="person" size={24} color="#fff" />
            </View>

            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '500' }}>
                {item.name}
              </Text>
              <Text style={{ fontSize: 12, color: '#6B7280' }}>
                {item.phone}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => makeCall(item.phone)}
              onLongPress={() => showMessageOptions(item.phone)}
              delayLongPress={400}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#2563EB',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="call" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Bottom Navigation */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          paddingVertical: 12,
          backgroundColor: 'white',
        }}
      >
        <NavItem icon="home" label="Home" onPress={() => onNavigate('dashboard')} />
        <NavItem icon="clock" label="History" onPress={() => onNavigate('history')} />
        <NavItem icon="map-pin" label="Location" onPress={() => onNavigate('location')} />
        <NavItem icon="users" label="Contacts" onPress={() => onNavigate('contacts')} active />
        <NavItem icon="menu" label="Menu" onPress={() => onNavigate('menu')} />
      </View>

      {/* Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: '85%',
              backgroundColor: '#fff',
              borderRadius: 12,
              padding: 20,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
              Enter contact number to invite
            </Text>

            {/* Fixed +63 Input */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#D1D5DB',
                borderRadius: 8,
                height: 44,
                marginBottom: 16,
                paddingHorizontal: 12,
              }}
            >
              <Text style={{ fontSize: 16, marginRight: 6 }}>+63</Text>

              <TextInput
                placeholder="9XXXXXXXXX"
                value={contactNumber}
                onChangeText={(text) =>
                  setContactNumber(
                    text.replace(/[^0-9]/g, '').slice(0, 10)
                  )
                }
                keyboardType="phone-pad"
                style={{ flex: 1, fontSize: 16 }}
              />
            </View>

            <Pressable
              onPress={() => {
                const fullNumber = `+63${contactNumber}`;
                const exists = registeredNumbers.includes(fullNumber);

                setToastMessage(exists ? 'Invite sent' : "Account doesn't exist");
                setToastVisible(true);

                setTimeout(() => {
                  setToastVisible(false);
                }, 2500);

                setContactNumber('');
                setModalVisible(false);
              }}
              disabled={contactNumber.length !== 10}
              style={{
                backgroundColor:
                  contactNumber.length === 10 ? '#2563EB' : '#9CA3AF',
                paddingVertical: 12,
                borderRadius: 8,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                Invite
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setModalVisible(false)}
              style={{ marginTop: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#6B7280' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {toastVisible && (
        <View
          style={{
            position: 'absolute',
            bottom: 90,
            alignSelf: 'center',
            backgroundColor: '#111827',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            elevation: 6,
          }}
        >
          <Image
            source={require('../assets/drivelogo.png')}
            style={{
              width: 24,
              height: 24,
              marginRight: 10,
              resizeMode: 'contain',
            }}
          />

          <Text style={{ color: '#fff', fontSize: 14 }}>
            {toastMessage}
          </Text>
        </View>
      )}

      <TouchableOpacity
  onPress={() => setModalVisible(true)}
  activeOpacity={0.8}
  style={{
    position: 'absolute',
    bottom: 100, // sits above bottom navigation
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  }}
>
  <Ionicons name="add" size={35} color="#fff" />
</TouchableOpacity>

    </View>
  );
}

/* Bottom Nav Button */
function NavItem({ icon, label, onPress, active }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={active} style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: active ? '#3B82F6' : 'white',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name={icon} size={18} color={active ? '#ffffff' : '#3B82F6'} />
      </View>
      <Text style={{ color: '#3B82F6', fontSize: 12, marginTop: 4 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
