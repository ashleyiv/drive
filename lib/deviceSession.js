// driveash/lib/deviceSession.js
let session = {
  // Demo "system bluetooth" state (Expo Go can't read real bluetooth state)
  bluetoothEnabled: true,

  connectedDevice: null, // { id, name, rssi }
  batteryPercent: null,
  scanState: 'idle', // 'idle' | 'connected'

  // Remembers the last paired device in runtime (Supabase metadata handles "past" memory)
  lastPairedDevice: null, // { id, name, rssi }
};

export const DeviceSession = {
  get() {
    return session;
  },
  set(patch) {
    session = { ...session, ...patch };
  },
  clearConnection() {
    session = {
      ...session,
      connectedDevice: null,
      batteryPercent: null,
      scanState: 'idle',
    };
  },
  clearAll() {
    session = {
      bluetoothEnabled: true,
      connectedDevice: null,
      batteryPercent: null,
      scanState: 'idle',
      lastPairedDevice: null,
    };
  },
};
