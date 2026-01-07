import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons, Feather } from '@expo/vector-icons';

export default function LocationView({ onNavigate }) {
  const [currentLocation, setCurrentLocation] = useState(null);

  useEffect(() => {
    (async () => {
      
      // Get current location
      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    })();
  }, []);

  if (!currentLocation) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Fetching current location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        style={styles.map}
        initialRegion={currentLocation}
        showsUserLocation={true}
      >
        <Marker coordinate={currentLocation}>
          <View style={styles.markerOuter}>
            <View style={styles.markerInner} />
          </View>
        </Marker>
      </MapView>

      {/* Current Location Button */}
      <TouchableOpacity
        style={styles.locationButton}
        onPress={() => {
        }}
      >
        <Ionicons name="navigate" size={24} color="#2563EB" />
      </TouchableOpacity>

      {/* Location Info Card */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="location" size={20} color="white" />
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.infoTitle}>Current Location</Text>
            <Text style={styles.infoText}>
              {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
            </Text>
            <Text style={styles.infoTextSmall}>Last updated: Just now</Text>
          </View>
        </View>
      </View>

      {/* Bottom Navigation */}
      <View style={styles.navbar}>
        <NavItem icon="home" label="Home" onPress={() => onNavigate('dashboard')} />
        <NavItem icon="clock" label="History" onPress={() => onNavigate('history')} />
        <NavItem icon="map-pin" label="Location" onPress={() => onNavigate('location')} active />
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
  container: { flex: 1 },
  map: { flex: 1 },
  markerOuter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(59,130,246,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerInner: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: 'rgba(59,130,246,0.5)',
  },
  locationButton: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    width: 48,
    height: 48,
    backgroundColor: 'white',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: '#1E40AF',
    borderRadius: 24,
    padding: 16,
  },
  infoRow: { flexDirection: 'row' },
  infoTitle: { color: 'white', fontSize: 14 },
  infoText: { color: 'white', fontSize: 12 },
  infoTextSmall: { color: 'white', fontSize: 11, opacity: 0.8 },
  navbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    backgroundColor: 'white',
  },
});
