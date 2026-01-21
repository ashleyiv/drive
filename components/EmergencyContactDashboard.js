// driveash/components/EmergencyContactDashboard.js
import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  findNodeHandle,
  UIManager,
  ActivityIndicator,
  Alert,
  Image,
  Animated,
  Easing,
} from 'react-native';

import MapView, { Marker, Polyline } from 'react-native-maps';
import { FontAwesome5, Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { DeviceSession } from '../lib/deviceSession';
import { supabase } from '../lib/supabase';
import { resolveAvatarUrl } from '../lib/avatar';
import BottomNav from './BottomNav';
import { usePendingInviteCount } from '../lib/usePendingInviteCount';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Dimensions } from 'react-native';
import useTheme from '../theme/useTheme';

const BT_COACHMARK_SEEN_KEY = 'bt_coachmark_seen_this_login';


// ✅ keep your mock drivers as fallback (do NOT delete)
const mockDrivers = [
  {
    id: '1',
    name: 'John Doe',
    status: 'warning',
    lastLocation: 'Manila, Philippines',
    lastUpdate: '5 mins ago',
    phone: '+639171234567',
    coordinates: { latitude: 14.5995, longitude: 120.9842 },
    route: [
      { latitude: 14.5995, longitude: 120.9842 },
      { latitude: 14.6000, longitude: 120.9850 },
    ],
    mode: 'driver',
    avatarUri: null,
    warningLevel: 3,
    warningCreatedAt: new Date().toISOString(),
    warningLocationText: 'Along Congressional Road Ext.',
    warningSpeedText: '22 mph',
    warningSnapshotUri: null,
  },
  {
    id: '2',
    name: 'Jane Doe',
    status: 'danger',
    lastLocation: 'Quezon City, Philippines',
    lastUpdate: '1 hour ago',
    phone: '+639189876543',
    coordinates: { latitude: 14.676, longitude: 121.0437 },
    route: [
      { latitude: 14.676, longitude: 121.0437 },
      { latitude: 14.677, longitude: 121.0445 },
    ],
    mode: 'driver',
    avatarUri: null,
    warningLevel: 3,
    warningCreatedAt: new Date().toISOString(),
    warningLocationText: 'Along Congressional Road Ext.',
    warningSpeedText: '22 mph',
    warningSnapshotUri: null,
  },
];

function ModeSwitchOverlay({ visible, title, subtitle }) {
  const progress = useRef(new Animated.Value(0)).current;
  const loopRef = useRef(null);

  useEffect(() => {
    if (!visible) return;

    progress.setValue(0);
    loopRef.current = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
      { resetBeforeIteration: true }
    );

    loopRef.current.start();

    return () => {
      try {
        loopRef.current?.stop?.();
      } catch {}
    };
  }, [visible, progress]);

  if (!visible) return null;

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.modeOverlayBackdrop}>
        <View style={styles.modeOverlayCard}>
          <ActivityIndicator />
          <Text style={styles.modeOverlayTitle}>{title}</Text>
          <Text style={styles.modeOverlaySubtitle}>{subtitle}</Text>

          <View style={styles.modeBarTrack}>
            <Animated.View style={[styles.modeBarFill, { width: barWidth }]} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function displayNameFromProfile(p) {
  const first = String(p?.first_name || '').trim();
  const last = String(p?.last_name || '').trim();
  const full = `${first}${first && last ? ' ' : ''}${last}`.trim();
  return full || String(p?.email || 'Unknown User');
}
// ✅ Staleness rule: LIVE only if location is fresh (90 seconds)
const STALE_THRESHOLD_MS = 90 * 1000;

// ✅ Warning should show ONLY if fresh (acts like "live" warning from IoT)
const WARNING_STALE_THRESHOLD_MS = 90 * 1000;

function isFreshWarning(iso) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= WARNING_STALE_THRESHOLD_MS;
}

// ✅ Level palette + label (UI only)
function warningLabel(level) {
  if (level === 3) return 'LEVEL 3 WARNING';
  if (level === 2) return 'LEVEL 2 WARNING';
  if (level === 1) return 'LEVEL 1 WARNING';
  return null;
}

function warningPalette(level) {
  // Returns { text, bg, border } for badges/panels
  if (level === 3) return { text: '#DC2626', bg: '#FEE2E2', border: '#FCA5A5' }; // red
  if (level === 2) return { text: '#EA580C', bg: '#FFEDD5', border: '#FDBA74' }; // orange
  if (level === 1) return { text: '#16A34A', bg: '#DCFCE7', border: '#86EFAC' }; // green
  // safe / no warning (neutral/green-ish)
  return { text: '#16A34A', bg: '#DCFCE7', border: '#86EFAC' };
}
function toFiniteNumberOrNull(v) {
  const n =
    typeof v === 'number'
      ? v
      : v != null && v !== ''
      ? Number(v)
      : NaN;

  return Number.isFinite(n) ? n : null;
}


function isFreshLocation(iso) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= STALE_THRESHOLD_MS;
}

function timeAgoText(iso) {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const diff = Date.now() - t;

  const sec = Math.max(0, Math.floor(diff / 1000));
  if (sec < 60) return `${sec}s ago`;

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min === 1 ? '' : 's'} ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;

  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? '' : 's'} ago`;
}
function speedTextFromMps(mps) {
  if (typeof mps !== 'number' || !Number.isFinite(mps)) return null;
  // m/s → km/h
  const kph = mps * 3.6;
  return `${kph.toFixed(1)} kph`;
}
// ✅ Try to extract a speed label from meta.
// You can store any of these keys: speed_mph, top_speed_mph, speed_kph, top_speed_kph, speed
function speedTextFromMeta(meta) {
  try {
    if (!meta || typeof meta !== 'object') return null;

    const mph =
      meta.top_speed_mph ??
      meta.speed_mph ??
      meta.mph ??
      null;

    if (mph != null && mph !== '' && !Number.isNaN(Number(mph))) {
      return `${Number(mph)} mph`;
    }

    const kph =
      meta.top_speed_kph ??
      meta.speed_kph ??
      meta.kph ??
      null;

    if (kph != null && kph !== '' && !Number.isNaN(Number(kph))) {
      return `${Number(kph)} kph`;
    }

    const raw = meta.speed ?? null;
    if (raw != null && raw !== '') {
      // if they stored "22 mph" already
      return String(raw);
    }

    return null;
  } catch {
    return null;
  }
}

function resolveMaybeUrl(value) {
  const raw = typeof value === 'string' ? value : null;
  if (!raw) return null;

  const resolved = resolveAvatarUrl(raw);
  if (typeof resolved === 'string' && resolved) return resolved;

  // fallback: if resolveAvatarUrl returns null, still try raw
  return raw;
}

function BluetoothCoachmark({ visible, targetLayout, onDismiss }) {
  if (!visible || !targetLayout) return null;

  const { width: screenW, height: screenH } = Dimensions.get('window');
  const { x, y, width, height } = targetLayout;

  const CARD_WIDTH = Math.min(300, screenW - 24);
  const CARD_HEIGHT = 150;
  const MARGIN = 12;
  const NOTCH_SIZE = 10;
  const PILL_HEIGHT = 40;

  // Default: show BELOW button
  let cardTop = y + height + NOTCH_SIZE + 6;
  let notchDirection = 'up';

  // Flip ABOVE if overflowing bottom
  if (cardTop + CARD_HEIGHT > screenH - MARGIN) {
    cardTop = y - CARD_HEIGHT - NOTCH_SIZE - 6;
    notchDirection = 'down';
  }

  const cardLeft = Math.min(
    screenW - CARD_WIDTH - MARGIN,
    Math.max(MARGIN, x + width / 2 - CARD_WIDTH / 2)
  );

  // Notch horizontal position (relative to card)
  const notchLeft = x + width / 2 - cardLeft - NOTCH_SIZE;

  return (
    <Modal transparent animationType="fade">
      <Pressable style={styles.coachmarkBackdrop} onPress={onDismiss}>
        <View
          style={[
            styles.coachmarkCard,
            {
              width: CARD_WIDTH,
              left: cardLeft,
              top: cardTop,
            },
          ]}
        >

          {/* NOTCH (merged, not floating) */}
          <View
            style={[
              styles.coachmarkNotch,
              notchDirection === 'down' && styles.coachmarkNotchDown,
              {
                left: notchLeft,
                top: notchDirection === 'up' ? PILL_HEIGHT - 2 : undefined,
                bottom: notchDirection === 'down' ? -NOTCH_SIZE + 2 : undefined,
              },
            ]}
          />

          {/* BODY */}
          <View style={styles.coachmarkBody}>
            <Text style={styles.coachmarkTitle}>Switch mode</Text>
            <Text style={styles.coachmarkText}>
            Tap the bluetooth icon to switch modes and connect to an IoT device.
            </Text>

            <Pressable onPress={onDismiss} style={styles.coachmarkBtn}>
              <Text style={styles.coachmarkBtnText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}



export default function EmergencyContactDashboard({ onNavigate, onViewDriver, onSwitchToDriver }) {
  const { theme } = useTheme();
  const { count: pendingInviteCount } = usePendingInviteCount();
  const [drivers, setDrivers] = useState(mockDrivers);
  const bluetoothBtnRef = useRef(null);
const bigMapRef = useRef(null);

  const [showBtCoachmark, setShowBtCoachmark] = useState(false);
  const [btLayout, setBtLayout] = useState(null);
  useEffect(() => {
    let cancelled = false;
  
    const maybeShowCoachmark = async () => {
      try {
        const seen = await AsyncStorage.getItem(BT_COACHMARK_SEEN_KEY);
        if (seen === 'true') return;
  
        requestAnimationFrame(() => {
          if (cancelled) return;
  
          bluetoothBtnRef.current?.measureInWindow(
            (x, y, width, height) => {
              if (cancelled) return;
  
              setBtLayout({ x, y, width, height });
              setShowBtCoachmark(true);
            }
          );
        });
      } catch (e) {
        console.log('[Coachmark] storage read failed', e);
      }
    };
  
    maybeShowCoachmark();
  
    return () => {
      cancelled = true;
    };
  }, []);
  
  
  const dismissBtCoachmark = async () => {
    setShowBtCoachmark(false);
    try {
      await AsyncStorage.setItem(BT_COACHMARK_SEEN_KEY, 'true');
    } catch {}
  };
  

  // ✅ forces periodic re-render so staleness flips automatically
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 5000); // every 5s is enough
    return () => clearInterval(t);
  }, []);

  // ✅ Mode overlay shows ONLY when switching into Emergency Contact mode
  const [modeOverlayVisible, setModeOverlayVisible] = useState(false);

  useEffect(() => {
    const pending = DeviceSession.get?.()?.pendingModeSwitchTo;

    if (pending === 'contact') {
      setModeOverlayVisible(true);

      DeviceSession.set?.({ pendingModeSwitchTo: null });

      const t = setTimeout(() => setModeOverlayVisible(false), 2500);
      return () => clearTimeout(t);
    }
  }, []);

  const [loadingDrivers, setLoadingDrivers] = useState(true);

  // ✅ Big map modal (KEEP)
  const [showBigMap, setShowBigMap] = useState(false);
  const [bigMapDriverId, setBigMapDriverId] = useState(null);

  // ✅ snapshot so Big Map never becomes "no driver" during refresh
  const [bigMapSnapshot, setBigMapSnapshot] = useState(null);

  const bigMapDriverLive = useMemo(() => {
    return drivers.find((d) => String(d.id) === String(bigMapDriverId)) || null;
  }, [drivers, bigMapDriverId]);

  const bigMapDriver = bigMapDriverLive || bigMapSnapshot || null;
const openBigMapForDriver = (driverId) => {
  // ✅ realtime only when viewing this driver
  startLiveDriver(driverId);

  setBigMapDriverId(driverId);

  const snap = drivers.find((d) => String(d.id) === String(driverId)) || null;
  if (snap) setBigMapSnapshot(snap);

  setShowBigMap(true);
};


const closeBigMap = () => {
  // ✅ stop realtime when closing view
  stopLiveDriver();

  setShowBigMap(false);
  setBigMapDriverId(null);
  setBigMapSnapshot(null);
};


// ✅ per-driver realtime channel (only active when a driver view is open)
const liveChannelRef = useRef(null);
const liveDriverIdRef = useRef(null);

const stopLiveDriver = () => {
  try {
    if (liveChannelRef.current) {
      supabase.removeChannel(liveChannelRef.current);
    }
  } catch {}
  liveChannelRef.current = null;
  liveDriverIdRef.current = null;
};

const startLiveDriver = (driverId) => {
  try {
    stopLiveDriver();

    const id = String(driverId);
    liveDriverIdRef.current = id;

    liveChannelRef.current = supabase
      .channel(`driver-live:${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_status',
          filter: `user_id=eq.${id}`,
        },
        (payload) => {
          const row = payload?.new;
          if (!row?.user_id) return;

          const lat = toFiniteNumberOrNull(row.last_lat);
const lng = toFiniteNumberOrNull(row.last_lng);
if (lat == null || lng == null) return;

const coords = { latitude: lat, longitude: lng };


          // ✅ Update ONLY that driver in state (minimal)
          setDrivers((prev) =>
            prev.map((d) => {
              if (String(d.id) !== id) return d;
return {
  ...d,
  coordinates: coords,
  lastLocationAt: row.last_location_at ?? d.lastLocationAt ?? null,
  lastLocation: `Lat:${coords.latitude.toFixed(4)}, Lng:${coords.longitude.toFixed(4)}`,
  lastUpdate: row.last_location_at
    ? new Date(row.last_location_at).toLocaleString()
    : d.lastUpdate,

  // ✅ speed updates live too
  lastSpeedMps:
    typeof row.last_speed_mps === 'number' && Number.isFinite(row.last_speed_mps)
      ? row.last_speed_mps
      : d.lastSpeedMps ?? null,
  lastSpeedText:
    typeof row.last_speed_mps === 'number' && Number.isFinite(row.last_speed_mps)
      ? speedTextFromMps(row.last_speed_mps)
      : d.lastSpeedText ?? null,

  // no history: keep only latest point
  route: [coords],
};


            })
          );
        }
      )
      .subscribe();
  } catch (e) {
    console.log('[EmergencyContactDashboard] startLiveDriver error:', e);
  }
};

// ✅ Safety cleanup if dashboard unmounts
useEffect(() => {
  return () => stopLiveDriver();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


  // ✅ Driver Status (FULL SCREEN modal) (KEEP)
  const [showDriverStatus, setShowDriverStatus] = useState(false);
  const [driverStatusId, setDriverStatusId] = useState(null);

  // ✅ snapshot so modal doesn't break when drivers refresh/reload
  const [driverStatusSnapshot, setDriverStatusSnapshot] = useState(null);

  const selectedDriverLive = useMemo(() => {
    return drivers.find((d) => String(d.id) === String(driverStatusId)) || null;
  }, [drivers, driverStatusId]);

  const selectedDriver = selectedDriverLive || driverStatusSnapshot || null;

  const openDriverStatus = (driverId) => {
    setDriverStatusId(driverId);

    const snap = drivers.find((d) => String(d.id) === String(driverId)) || null;
    if (snap) setDriverStatusSnapshot(snap);

    setShowDriverStatus(true);
  };

  const closeDriverStatus = () => {
    setShowDriverStatus(false);
    setDriverStatusId(null);
    setDriverStatusSnapshot(null);
  };

  // Danger modal
  const [showDangerModal, setShowDangerModal] = useState(false);
  const [dangerDriverName, setDangerDriverName] = useState('');
  const [dangerDriverId, setDangerDriverId] = useState(null);

  // ===========================
  // Bluetooth demo (pairing UI)
  // ===========================
  const [deviceModalVisible, setDeviceModalVisible] = useState(false);
  const [scanState, setScanState] = useState('idle');
  const [availableDevices, setAvailableDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [batteryPercent, setBatteryPercent] = useState(null);

  const [bluetoothEnabled] = useState(DeviceSession.get()?.bluetoothEnabled ?? true);

  // Auto-connect UX
  const [autoConnectLoading, setAutoConnectLoading] = useState(false);
  const autoConnectAttemptedRef = useRef(false);

  const demoDevices = useMemo(
    () => [
      { id: 'drive-001', name: 'D.R.I.V.E', rssi: -42 },
      { id: 'esp32-002', name: 'ESP32-Tracker', rssi: -64 },
      { id: 'ble-003', name: 'OBD-II Demo', rssi: -71 },
    ],
    []
  );

  const openDeviceModal = () => setDeviceModalVisible(true);
  const closeDeviceModal = () => setDeviceModalVisible(false);

  const requireBluetoothOrWarn = () => {
    if (!bluetoothEnabled) {
      Alert.alert('Bluetooth Required', 'Please turn on Bluetooth to connect to D.R.I.V.E.');
      onNavigate?.('contacts');
      return false;
    }
    return true;
  };

  const startScan = () => {
    if (!requireBluetoothOrWarn()) return;

    setSelectedDevice(null);
    setAvailableDevices([]);
    setScanState('scanning');

    setTimeout(() => {
      setAvailableDevices(demoDevices);
      setScanState('found');
    }, 1200);
  };

  const saveLastPairedToSupabaseMetadata = async (device) => {
    try {
      await supabase.auth.updateUser({
        data: {
          lastPairedDeviceId: device?.id ?? null,
          lastPairedDeviceName: device?.name ?? null,
        },
      });
    } catch (e) {
      console.log('[EmergencyContactDashboard] updateUser metadata failed:', e);
    }
  };

  const pairSelectedDevice = () => {
    if (!requireBluetoothOrWarn()) return;
    if (!selectedDevice) return;

    setScanState('pairing');

    setTimeout(async () => {
      // ✅ preserve existing connectedAt if already set, else create it
const prev = DeviceSession.get?.() || {};
const prevMs =
  typeof prev.connectedAt === 'number'
    ? prev.connectedAt
    : prev.connectedAt
    ? Date.parse(prev.connectedAt)
    : null;

const connectedAtMs = Number.isFinite(prevMs) ? prevMs : Date.now();

DeviceSession.set({
  scanState: 'connected',
  connectedDevice: selectedDevice,
  batteryPercent: 95,
  lastPairedDevice: selectedDevice,
  connectedAt: connectedAtMs, // ✅ NEW
});


      await saveLastPairedToSupabaseMetadata(selectedDevice);

      setConnectedDevice(selectedDevice);
      setBatteryPercent(95);
      setScanState('connected');
      closeDeviceModal();
      onSwitchToDriver?.();
    }, 1200);
  };

  // ==========================================
  // AUTO-CONNECT ON ENTRY (LOGGED IN ONLY)
  // ==========================================
  useEffect(() => {
    const runAutoConnect = async () => {
      if (autoConnectAttemptedRef.current) return;
      autoConnectAttemptedRef.current = true;

      try {
        const { data: sess } = await supabase.auth.getSession();
const session = sess?.session;
if (!session?.user?.id) return;

// ✅ avoid AuthSessionMissingError
const user = session.user;
const meta = user?.user_metadata || {};


        const lastId = meta?.lastPairedDeviceId;
        const lastName = meta?.lastPairedDeviceName;

        if (!lastId) return;

        if (!bluetoothEnabled) {
          Alert.alert(
            'Bluetooth Required',
            `Your last paired device is ${lastName || 'D.R.I.V.E'}. Turn on Bluetooth to auto-connect.`
          );
          onNavigate?.('contacts');
          return;
        }

        const s = DeviceSession.get?.();

// ✅ If already connected, ensure connectedAt exists so Driver can show duration
if (s?.connectedDevice?.id === lastId && s?.scanState === 'connected') {
  if (!s?.connectedAt) {
    DeviceSession.set?.({ connectedAt: Date.now() });
  }
  onSwitchToDriver?.();
  return;
}


        const found = demoDevices.find((d) => d.id === lastId) || null;
        if (!found) return;

        setAutoConnectLoading(true);

        setTimeout(() => {
          DeviceSession.set({
            scanState: 'connected',
            connectedDevice: found,
            batteryPercent: 95,
            lastPairedDevice: found,
          });

          setConnectedDevice(found);
          setBatteryPercent(95);
          setScanState('connected');

          setAutoConnectLoading(false);
          onSwitchToDriver?.();
        }, 900);
      } catch (e) {
        console.log('[EmergencyContactDashboard] auto-connect failed:', e);
        setAutoConnectLoading(false);
      }
    };

    runAutoConnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bluetoothEnabled, demoDevices]);

  // ===========================
  // BACKEND: LOAD REAL DRIVERS
  // ===========================
  const loadConnectedDrivers = async () => {
    try {
      setLoadingDrivers(true);

      // ✅ Session guard: prevents AuthSessionMissingError + prevents "ghost dashboard"
const { data: sess } = await supabase.auth.getSession();
const session = sess?.session;

if (!session?.user?.id) {
  // not logged in -> show empty (not mock)
  setDrivers([]);
  return;
}

const me = session.user;


      const { data: links, error: linkErr } = await supabase
        .from('emergency_contact_requests')
        .select('id, requester_id, status, created_at')
        .eq('target_id', me.id)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false });

      if (linkErr) throw linkErr;

      const driverIds = Array.from(
        new Set((links || []).map((r) => r.requester_id).filter(Boolean).map(String))
      );

      if (driverIds.length === 0) {
        setDrivers([]);
        return;
      }

      const { data: profs, error: profErr } = await supabase
        .from('user_profiles')
        .select('id,email,first_name,last_name,avatar_url')
        .in('id', driverIds);

      if (profErr) throw profErr;

      const profById = {};
      (profs || []).forEach((p) => (profById[String(p.id)] = p));

      const { data: statuses, error: stErr } = await supabase
        .from('driver_status')
.select('user_id, mode, last_lat, last_lng, last_location_at, last_speed_mps')
        .in('user_id', driverIds);

      if (stErr) throw stErr;

      const stById = {};
      (statuses || []).forEach((s) => (stById[String(s.user_id)] = s));

      // ✅ expanded warning fetch (adds snapshot_url + meta speed)
      const warningById = {};
      await Promise.all(
        driverIds.map(async (uid) => {
          try {
            const { data: w } = await supabase
              .from('driver_warnings')
              .select('level, created_at, monitor_type, location_text, snapshot_url, meta')
              .eq('user_id', uid)
              .order('created_at', { ascending: false })
              .limit(1);

            const row = (w || [])[0];

// ✅ Only show warning if it's fresh (so no IoT data = no warning UI)
if (row?.level && isFreshWarning(row.created_at)) {
  warningById[uid] = {
    level: row.level,
    created_at: row.created_at,
    monitor_type: row.monitor_type ?? null,
    location_text: row.location_text ?? null,
    snapshot_url: row.snapshot_url ?? null,
    meta: row.meta ?? null,
  };
}

          } catch {}
        })
      );

      const mapped = driverIds.map((uid) => {
        const prof = profById[uid] || null;
        const st = stById[uid] || null;
        const warn = warningById[uid] || null;

        const name = displayNameFromProfile(prof);

       const lat = toFiniteNumberOrNull(st?.last_lat);
const lng = toFiniteNumberOrNull(st?.last_lng);
const coords = lat != null && lng != null ? { latitude: lat, longitude: lng } : null;

        const mode = st?.mode || 'contact';

// ✅ live only if mode is driver AND timestamp is fresh
const live = mode === 'driver' && isFreshLocation(st?.last_location_at);


        let status = 'safe';
        if (warn?.level === 2) status = 'warning';
        if (warn?.level === 3) status = 'danger';

        const lastUpdateText = st?.last_location_at
          ? new Date(st.last_location_at).toLocaleString()
          : 'No location saved yet';

        const lastLocationText = coords
          ? `Lat:${coords.latitude.toFixed(4)}, Lng:${coords.longitude.toFixed(4)}`
          : 'No location available';

        const avatarUri = resolveMaybeUrl(prof?.avatar_url);

        const warningSnapshotUri = resolveMaybeUrl(warn?.snapshot_url);
        const warningSpeedText = speedTextFromMeta(warn?.meta);
        const warningLocationText = warn?.location_text ? String(warn.location_text) : null;

       return {
  id: uid,
  name,
  mode,
  status,

  // ✅ keep raw timestamp for staleness logic
  lastLocationAt: st?.last_location_at ?? null,
  // ✅ speed from driver_status
  lastSpeedMps: typeof st?.last_speed_mps === 'number' && Number.isFinite(st.last_speed_mps)
    ? st.last_speed_mps
    : null,
  lastSpeedText: speedTextFromMps(
    typeof st?.last_speed_mps === 'number' && Number.isFinite(st.last_speed_mps)
      ? st.last_speed_mps
      : NaN
  ),

  // existing fields
  warningLevel: warn?.level ?? null,
  lastUpdate: lastUpdateText,
  lastLocation: lastLocationText,
  coordinates: coords || { latitude: 14.5995, longitude: 120.9842 },
  route: coords ? [coords] : [],
  avatarUri: avatarUri || null,


          // ✅ new fields (non-breaking additions)
          warningCreatedAt: warn?.created_at ?? null,
          warningMonitorType: warn?.monitor_type ?? null,
          warningLocationText: warningLocationText,
          warningSnapshotUri: warningSnapshotUri || null,
          warningSpeedText: warningSpeedText || null,
          warningMeta: warn?.meta ?? null,
        };
      });

      setDrivers(mapped);

      // keep Driver Status snapshot fresh
      if (driverStatusId) {
        const fresh = mapped.find((d) => String(d.id) === String(driverStatusId)) || null;
        if (fresh) setDriverStatusSnapshot(fresh);
      }

      // keep Big Map snapshot fresh if open
      if (bigMapDriverId) {
        const freshBig = mapped.find((d) => String(d.id) === String(bigMapDriverId)) || null;
        if (freshBig) setBigMapSnapshot(freshBig);
      }
    } catch (e) {
      console.log('[EmergencyContactDashboard] loadConnectedDrivers error:', e);

// ✅ If auth is missing/invalid, do NOT show mock (prevents fake login)
const msg = String(e?.message || '').toLowerCase();
if (msg.includes('auth session missing') || msg.includes('invalid jwt') || msg.includes('jwt')) {
  setDrivers([]);
  return;
}

setDrivers(mockDrivers);

    } finally {
      setLoadingDrivers(false);
    }
  };

  useEffect(() => {
    loadConnectedDrivers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

 // Optional realtime refresh (driver_status changes)
// ✅ Requirement: NO realtime on initial dashboard load.
// Keep code but disabled to avoid breaking existing flows.
/// Optional realtime refresh (driver_status changes)
// ✅ Requirement: NO realtime on initial dashboard load
const ENABLE_GLOBAL_STATUS_REALTIME = false;

useEffect(() => {
  if (!ENABLE_GLOBAL_STATUS_REALTIME) return;

  let channel;

  const sub = async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
const me = sess?.session?.user;
if (!me?.id) return;


      channel = supabase
        .channel('ec-driver-status')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'driver_status' },
          () => loadConnectedDrivers()
        )
        .subscribe();
    } catch (e) {
      console.log('[EmergencyContactDashboard] realtime subscribe error:', e);
    }
  };

  sub();

  return () => {
    if (channel) supabase.removeChannel(channel); 
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);




  const getStatusColor = (status) => {
    switch (status) {
      case 'safe':
        return '#16A34A';
      case 'warning':
        return '#FACC15';
      case 'danger':
        return '#DC2626';
      default:
        return '#6B7280';
    }
  };

  // ✅ RESTORED: card press behavior (default like before)
  const handleDriverPress = (driver) => {
    if (driver.status === 'danger') {
      setDangerDriverName(driver.name);
      setDangerDriverId(driver.id);
      setShowDangerModal(true);
      return;
    }
    onViewDriver?.(driver.id);
  };

  const confirmDangerModal = () => {
    setShowDangerModal(false);
    if (dangerDriverId) onViewDriver?.(dangerDriverId);
  };

  // ✅ for Big Map modal "history details" photo
  const bigMapPhotoUri =
    bigMapDriver?.warningSnapshotUri ||
    bigMapDriver?.avatarUri ||
    null;

  const bigMapSpeedText =
  bigMapDriver?.lastSpeedText ||
  bigMapDriver?.warningSpeedText ||
  '—';
  const bigMapLocationText =
    bigMapDriver?.warningLocationText ||
    bigMapDriver?.lastLocation ||
    '—';
// ✅ Auto-follow pin ONLY while Big Map is open
useEffect(() => {
  if (!showBigMap) return;

  const lat = bigMapDriver?.coordinates?.latitude;
  const lng = bigMapDriver?.coordinates?.longitude;

  if (typeof lat !== 'number' || typeof lng !== 'number') return;

  // Keep deltas identical to your BIG map initialRegion so behavior feels the same
  const region = {
    latitude: lat,
    longitude: lng,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  // animateToRegion exists on react-native-maps MapView
  // (no UI changes, just camera follow)
  try {
    bigMapRef.current?.animateToRegion?.(region, 700);
  } catch {}
}, [
  showBigMap,
  bigMapDriver?.coordinates?.latitude,
  bigMapDriver?.coordinates?.longitude,
]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ModeSwitchOverlay
        visible={modeOverlayVisible}
        title="EMERGENCY CONTACT MODE"
        subtitle="Switching to Emergency Contact dashboard…"
      />

      {/* Header with Bluetooth button */}
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Connected Drivers</Text>
          <Text style={styles.headerSubtitle}>Monitor drivers who added you</Text>
        </View>

        <TouchableOpacity
  ref={bluetoothBtnRef}
  onPress={openDeviceModal}
  style={styles.bluetoothButton}
>
  <MaterialCommunityIcons
    name="bluetooth"
    size={22}
    color="white"
  />
</TouchableOpacity>

      </View>

      <BluetoothCoachmark
  visible={showBtCoachmark}
  targetLayout={btLayout}
  onDismiss={dismissBtCoachmark}
/>


      {/* Auto-connect overlay */}
      {autoConnectLoading && (
        <View style={styles.autoConnectOverlay}>
          <View style={[styles.autoConnectBox, {backgroundColor: theme.surface }]}>
            <ActivityIndicator />
            <Text style={[styles.autoConnectText, {color: theme.textPrimary }]}>Auto-connecting to D.R.I.V.E…</Text>
          </View>
        </View>
      )}

      {/* Drivers List */}
      <ScrollView contentContainerStyle={styles.driverList}>
        {loadingDrivers ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 10, color: theme.textSecondary }}>Loading drivers…</Text>
          </View>
        ) : drivers.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <FontAwesome5 name="users" size={42} color="#D1D5DB" />
            <Text style={{ marginTop: 10, color: theme.textSecondary }}>No connected drivers yet</Text>
          </View>
     ) : (
  drivers.map((driver) => {
    // ✅ LIVE only if mode=driver AND last_location_at is fresh
    // nowTick is used only to re-render periodically for staleness
    const _ = nowTick;

    const isDriving =
      driver.mode === 'driver' && isFreshLocation(driver.lastLocationAt);

    const hasWarning = !!driver.warningLevel;

    return (
      <TouchableOpacity
          key={driver.id}
          style={[styles.driverCard, { backgroundColor: theme.surface }]}
          onPress={() => openBigMapForDriver(driver.id)}   // ✅ whole card opens Big Map
          onLongPress={() => handleDriverPress(driver)}     // ✅ optional: keep old behavior (danger modal / view driver)
          delayLongPress={350}
      >
        <View style={styles.driverInfo}>
          <View style={styles.avatar}>
            {driver.avatarUri ? (
              <Image
                source={{ uri: driver.avatarUri }}
                style={styles.avatarImg}
                resizeMode="cover"
              />
            ) : (
              <FontAwesome5 name="user" size={24} color="#1D4ED8" />
            )}
          </View>

          <View style={{ flex: 1 }}>
           <View style={styles.driverHeader}>
  <Text style={[styles.driverName, {color: theme.textPrimary}]}>{driver.name}</Text>

  {/* ✅ Right-side badges row */}
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <View
      style={[
        styles.modeBadge,
        { backgroundColor: isDriving ? '#DBEAFE' : '#E5E7EB' },
      ]}
    >
      <Text
        style={[
          styles.modeText,
          { color: isDriving ? '#1E40AF' : '#374151' },
        ]}
      >
        {isDriving ? 'DRIVING' : 'NOT DRIVING'}
      </Text>
    </View>

    {/* ✅ Warning badge beside driving badge (only if fresh warning exists) */}
    {hasWarning && (
      <View
        style={[
          styles.modeBadge,
          {
            backgroundColor: warningPalette(driver.warningLevel).bg,
            borderWidth: 1,
            borderColor: warningPalette(driver.warningLevel).border,
          },
        ]}
      >
        <Text
          style={[
            styles.modeText,
            { color: warningPalette(driver.warningLevel).text },
          ]}
        >
          {warningLabel(driver.warningLevel)}
        </Text>
      </View>
    )}
  </View>
</View>


            {!isDriving && (
              <Text style={styles.notDrivingText}>
                Not live right now (showing last known location)
              </Text>
            )}

            <View style={styles.driverLocation}>
              <Feather name="map-pin" size={16} color="#6B7280" />
              <Text style={styles.driverLocationText}>
                {driver.lastLocation}
              </Text>
            </View>

            <Text style={styles.driverUpdated}>
              Last update: {driver.lastUpdate}
            </Text>

            <View style={styles.miniMapContainer}>
              <View style={{ flex: 1, position: 'relative' }}>
                <MapView
                  style={styles.miniMap}
                  key={`MINI_${driver.id}`}
                  initialRegion={{
                    latitude: driver.coordinates.latitude,
                    longitude: driver.coordinates.longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                  }}
                  pointerEvents="none"
                >
                  <Marker coordinate={driver.coordinates} />
                  {driver.route?.length > 1 && (
                    <Polyline
                      coordinates={driver.route}
                      strokeColor="#2563EB"
                      strokeWidth={2}
                    />
                  )}
                </MapView>

                <Pressable
                  onPress={() => openBigMapForDriver(driver.id)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                />

                <Pressable
                  onPress={() => openBigMapForDriver(driver.id)}
                  style={{
                    position: 'absolute',
                    right: 10,
                    bottom: 10,
                    backgroundColor: 'rgba(255,255,255,0.92)',
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons name="expand" size={14} color="#111827" />
                  <Text
                    style={{
                      marginLeft: 6,
                      fontSize: 11,
                      fontWeight: '800',
                      color: '#111827',
                    }}
                  >
                    View map
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  })
)}

      </ScrollView>
<BottomNav
  variant="emergency"
  activeKey="drivers"
  onNavigate={onNavigate}
  notificationCount={pendingInviteCount}
  theme={theme}
/>


      {/* DANGER MODAL (KEEP) */}
      <Modal transparent visible={showDangerModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>DRIVER IN DANGER!</Text>
            <Text style={styles.modalText}>
              Critical risk detected.{'\n'}
              Please contact {dangerDriverName || 'the driver'} immediately.
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', width: '100%' }}>
              <Pressable style={[styles.modalBtn, styles.modalCancel]} onPress={() => setShowDangerModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable style={[styles.modalBtn, styles.modalConfirm]} onPress={confirmDangerModal}>
                <Text style={styles.modalConfirmText}>OK</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ✅ BIG MAP MODAL + HISTORY DETAILS STYLE CARD */}
      <Modal visible={showBigMap} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 16 }}>
          <View style={{ backgroundColor: theme.modalBackground, borderRadius: 16, overflow: 'hidden', maxHeight: '88%' }}>
            <ScrollView contentContainerStyle={{ paddingBottom: 14 }}>
              {/* Header */}
              <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Pressable onPress={closeBigMap} style={{ paddingRight: 4, paddingVertical: 4 }}>
                    <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
                  </Pressable>

                  <Text style={{ fontSize: 16, fontWeight: '900', color: theme.textPrimary }}>
                    History Details
                  </Text>
                </View>

                <Pressable onPress={closeBigMap}>
                  <Ionicons name="close" size={22} color={theme.textPrimary} />
                </Pressable>
              </View>

              {/* History Detail Card */}
              <View style={{ marginHorizontal: 14, backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' }}>
                {/* Level + time ago */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                 <Text
                    style={{
                      color: warningPalette(bigMapDriver?.warningLevel ?? null).text,
                      fontWeight: '900',
                      fontSize: 12,
                    }}
                    >
                    {bigMapDriver?.warningLevel ? warningLabel(bigMapDriver.warningLevel) : 'NO WARNING'}
                  </Text>

                  <Text style={{ color: '#9CA3AF', fontWeight: '800', fontSize: 11 }}>
                    {bigMapDriver?.warningCreatedAt ? timeAgoText(bigMapDriver.warningCreatedAt) : '—'}
                  </Text>
                </View>

                {/* Photo */}
                <View style={{ marginTop: 10, height: 190, borderRadius: 14, backgroundColor: '#E5E7EB', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                  {bigMapPhotoUri ? (
                    <Image source={{ uri: bigMapPhotoUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <FontAwesome5 name="user" size={52} color="#9CA3AF" />
                  )}
                </View>

                {/* Danger box */}
                <View
  style={{
    marginTop: 12,
    borderRadius: 14,
    padding: 12,
    backgroundColor: warningPalette(bigMapDriver?.warningLevel ?? null).bg,
    borderWidth: 1,
    borderColor: warningPalette(bigMapDriver?.warningLevel ?? null).border,
  }}
>
  <Text
    style={{
      color: warningPalette(bigMapDriver?.warningLevel ?? null).text,
      fontWeight: '900',
      fontSize: 12,
    }}
  >
    {bigMapDriver?.warningLevel
      ? (bigMapDriver.warningLevel === 3 ? 'DANGER' : 'WARNING')
      : 'SAFE'}
  </Text>

  <Text
    style={{
      marginTop: 4,
      color: '#374151',
      fontWeight: '800',
      fontSize: 12,
      lineHeight: 16,
    }}
  >
    {bigMapDriver?.warningLevel === 3
      ? 'Immediate attention required. (High risk)'
      : bigMapDriver?.warningLevel === 2
      ? 'Driver may be drowsy.'
      : bigMapDriver?.warningLevel === 1
      ? 'Driver shows moderate drowsiness signs.'
      : 'No risk detected.'}
  </Text>


                  <Text style={{ marginTop: 8, color: '#7F1D1D', fontWeight: '800', fontSize: 12 }}>
                    Top Speed: {bigMapSpeedText}
                  </Text>

                  <Text style={{ marginTop: 4, color: '#7F1D1D', fontWeight: '800', fontSize: 12 }}>
                    Location: {bigMapLocationText}
                  </Text>
                </View>
              </View>

              {/* Map */}
              {bigMapDriver ? (
               <MapView
  ref={bigMapRef}
  style={{ height: 340, width: '100%', marginTop: 12 }}
  key={`BIG_${bigMapDriver.id}`}
  initialRegion={{
    latitude: bigMapDriver.coordinates.latitude,
    longitude: bigMapDriver.coordinates.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  }}
>

                  <Marker coordinate={bigMapDriver.coordinates} />
                  {bigMapDriver.route?.length > 1 && (
                    <Polyline coordinates={bigMapDriver.route} strokeColor="#2563EB" strokeWidth={3} />
                  )}
                </MapView>
              ) : (
                <View style={{ height: 320, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator />
                  <Text style={{ marginTop: 10, color: '#6B7280' }}>Loading map…</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* DRIVER STATUS MODAL (FULL SCREEN) (KEEP AS-IS) */}
      <Modal visible={showDriverStatus} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
          <View style={styles.dsHeader}>
            <Pressable onPress={closeDriverStatus} style={styles.dsBackBtn}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>

            <View style={{ flex: 1 }}>
              <Text style={styles.dsHeaderTitle}>Driver’s Status</Text>
              <Text style={styles.dsHeaderSubtitle}>View this driver’s status</Text>
            </View>
          </View>

          {!selectedDriver ? (
            <View style={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator />
                <Text style={{ color: '#111827', fontWeight: '900', fontSize: 16 }}>
                  Loading driver details…
                </Text>
              </View>

              <Pressable onPress={closeDriverStatus} style={[styles.primaryBtnLike, { marginTop: 14 }]}>
                <Text style={{ color: 'white', fontWeight: '800' }}>Go Back</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
              <View style={styles.dsCard}>
                <Text style={styles.dsName}>{selectedDriver.name}</Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor:
  (selectedDriver.mode === 'driver' && isFreshLocation(selectedDriver.lastLocationAt))
    ? '#22C55E'
    : '#9CA3AF',

                      marginRight: 8,
                    }}
                  />
                  <Text
  style={[
    styles.dsLiveText,
    {
      color:
        (selectedDriver.mode === 'driver' && isFreshLocation(selectedDriver.lastLocationAt))
          ? '#22C55E'
          : '#6B7280',
    },
  ]}
>
  {(selectedDriver.mode === 'driver' && isFreshLocation(selectedDriver.lastLocationAt))
    ? 'LIVE TRACKING'
    : 'NOT DRIVING'}
</Text>

                </View>

                <View style={styles.dsPhoto}>
                  {selectedDriver.avatarUri ? (
                    <Image source={{ uri: selectedDriver.avatarUri }} style={styles.dsPhotoImg} resizeMode="cover" />
                  ) : (
                    <FontAwesome5 name="user" size={48} color="#9CA3AF" />
                  )}
                </View>

                <View
                  style={[
                    styles.dsStatusPanel,
                    selectedDriver.status === 'danger'
                      ? styles.dsDanger
                      : selectedDriver.status === 'warning'
                      ? styles.dsWarning
                      : styles.dsSafe,
                  ]}
                >
                  <Text style={styles.dsStatusTitle}>
                    {selectedDriver.status === 'danger'
                      ? 'DANGER'
                      : selectedDriver.status === 'warning'
                      ? 'WARNING'
                      : 'SAFE'}
                  </Text>

                  <Text style={styles.dsStatusBody}>
                    {selectedDriver.status === 'danger'
                      ? 'Immediate attention required.'
                      : selectedDriver.status === 'warning'
                      ? 'Driver may need attention.'
                   : (selectedDriver.mode === 'driver' && isFreshLocation(selectedDriver.lastLocationAt))
? 'No risk detected.'
: 'Not live right now (showing last known location)'}

                  </Text>

                  <Text style={styles.dsStatusMeta}>Location: {selectedDriver.lastLocation}</Text>
                  <Text style={styles.dsStatusMeta}>Last update: {selectedDriver.lastUpdate}</Text>
                </View>

                <View style={styles.dsMapWrap}>
                  <View style={{ flex: 1 }}>
                    <MapView
                      style={{ flex: 1 }}
                      key={`DS_${selectedDriver.id}`}                    
                        initialRegion={{
                        latitude: selectedDriver.coordinates.latitude,
                        longitude: selectedDriver.coordinates.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      }}
                      pointerEvents="none"
                    >
                      <Marker coordinate={selectedDriver.coordinates} />
                      {selectedDriver.route?.length > 1 && (
                        <Polyline coordinates={selectedDriver.route} strokeColor="#2563EB" strokeWidth={3} />
                      )}
                    </MapView>

                    <Pressable
                      onPress={() => openBigMapForDriver(selectedDriver.id)}
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                    />
                  </View>
                </View>

                <Pressable
                  onPress={() => openBigMapForDriver(selectedDriver.id)}
                  style={[styles.primaryBtnLike, { marginTop: 12 }]}
                >
                  <Text style={{ color: 'white', fontWeight: '800' }}>Open Big Map</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Bluetooth Modal (KEEP) */}
      <Modal visible={deviceModalVisible} transparent animationType="fade">
        <View style={styles.btOverlay}>
          <View style={[styles.btBox, { backgroundColor: theme.background }]}>
            <Text style={[styles.btTitle, { color: theme.textPrimary }]}>Bluetooth Devices</Text>
            <Text style={styles.btSubtitle}>
              {connectedDevice ? `Connected to ${connectedDevice.name}` : 'No device connected'}
            </Text>

            <View style={{ marginTop: 12, flexDirection: 'row', gap: 10 }}>
              <Pressable onPress={startScan} style={[styles.btPrimaryBtn, { backgroundColor: '#1E3A8A' }]}>
                {scanState === 'scanning' ? (
                  <>
                    <ActivityIndicator color="white" />
                    <Text style={{ color: 'white', fontWeight: '700' }}>Scanning…</Text>
                  </>
                ) : (
                  <Text style={{ color: 'white', fontWeight: '700' }}>Scan available devices?</Text>
                )}
              </Pressable>

              <Pressable onPress={closeDeviceModal} style={styles.btCloseBtn}>
                <Text style={{ color: '#111827', fontWeight: '700' }}>Close</Text>
              </Pressable>
            </View>

            <View style={{ marginTop: 10 }}>
              {scanState === 'idle' && (
                <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 6 }}>
                  Tap “Scan available devices” to start
                </Text>
              )}

              {availableDevices.map((d) => {
                const selected = selectedDevice?.id === d.id;
                return (
                  <Pressable
                    key={d.id}
                    onPress={() => setSelectedDevice(d)}
                    style={{
                      marginTop: 10,
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: selected ? '#1E3A8A' : '#E5E7EB',
                      backgroundColor: selected ? '#DBEAFE' : 'white',
                    }}
                  >
                    <Text style={{ fontWeight: '800', color: '#111827' }}>{d.name}</Text>
                    <Text style={{ color: '#6B7280', fontSize: 12 }}>RSSI {d.rssi}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={pairSelectedDevice}
              disabled={!selectedDevice || scanState === 'scanning' || scanState === 'pairing'}
              style={[
                styles.btPairBtn,
                {
                  backgroundColor:
                    !selectedDevice || scanState === 'scanning' || scanState === 'pairing'
                      ? theme.secondary
                      : '#1E3A8A',
                },
              ]}
            >
              {scanState === 'pairing' ? (
                <>
                  <ActivityIndicator color="white" />
                  <Text style={{ color: 'white', fontWeight: '700' }}>Pairing…</Text>
                </>
              ) : (
                <Text style={{ color: 'white', fontWeight: '700' }}>Pair</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },

  modeOverlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  modeOverlayCard: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 10,
  },
  modeOverlayTitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
  },
  modeOverlaySubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textAlign: 'center',
  },
  modeBarTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 6,
  },
  modeBarFill: {
    height: 8,
    backgroundColor: '#2563EB',
    borderRadius: 999,
  },

  header: {
    backgroundColor: '#1E3A8A',
    paddingVertical: 24,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: { fontSize: 24, color: '#FFFFFF' },
  headerSubtitle: { fontSize: 14, color: '#BFDBFE', marginTop: 4 },

  driverList: { paddingHorizontal: 16, paddingVertical: 12 },
  driverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  driverInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },

  driverHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  driverName: { fontSize: 16, fontWeight: '600', color: '#111827' },

  modeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  modeText: { fontSize: 10, fontWeight: '900' },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 10, color: '#111827', fontWeight: '900' },

  notDrivingText: { marginTop: 8, fontSize: 12, color: '#6B7280', fontWeight: '700' },

  driverLocation: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  driverLocationText: { fontSize: 12, color: '#6B7280' },
  driverUpdated: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },

  miniMapContainer: { marginTop: 8, height: 100, borderRadius: 12, overflow: 'hidden' },
  miniMap: { flex: 1 },

  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderTopColor: '#E5E7EB',
    borderTopWidth: 1,
  },
  navButton: { alignItems: 'center' },
  navLabel: { fontSize: 12, color: '#1D4ED8', marginTop: 4 },
  navLabelInactive: { fontSize: 12, color: '#6B7280', marginTop: 4 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalBox: { width: '100%', backgroundColor: 'white', borderRadius: 16, padding: 18 },
  modalTitle: { color: '#DC2626', fontSize: 16, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  modalText: { color: '#6B7280', fontSize: 13, textAlign: 'center', marginBottom: 16, lineHeight: 18 },
  modalBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, marginLeft: 10 },
  modalCancel: { backgroundColor: '#E5E7EB' },
  modalConfirm: { backgroundColor: '#DC2626' },
  modalCancelText: { color: '#111827', fontWeight: '700' },
  modalConfirmText: { color: 'white', fontWeight: '800' },

  autoConnectOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 999,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  autoConnectBox: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  autoConnectText: { fontSize: 13, color: '#111827', fontWeight: '700' },

  btOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  btBox: { width: '100%', backgroundColor: 'white', borderRadius: 16, padding: 16 },
  btTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  btSubtitle: { marginTop: 6, color: '#9CA3AF', fontSize: 12 },

  btPrimaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  btCloseBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btPairBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  // Driver Status styles (KEEP)
  dsHeader: {
    backgroundColor: '#22C1DC',
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dsBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dsHeaderTitle: { color: 'white', fontSize: 18, fontWeight: '900' },
  dsHeaderSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },

  dsCard: { backgroundColor: 'white', borderRadius: 18, padding: 14 },
  dsName: { fontSize: 16, fontWeight: '900', color: '#111827' },
  dsLiveText: { fontSize: 11, fontWeight: '900' },

  dsPhoto: {
    marginTop: 12,
    height: 190,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dsPhotoImg: {
    width: '100%',
    height: '100%',
  },

  dsStatusPanel: { marginTop: 12, borderRadius: 14, padding: 12 },
  dsDanger: { backgroundColor: '#FEE2E2' },
  dsWarning: { backgroundColor: '#FEF9C3' },
  dsSafe: { backgroundColor: '#DCFCE7' },

  dsStatusTitle: { fontSize: 12, fontWeight: '900', color: '#111827' },
  dsStatusBody: { marginTop: 4, fontSize: 12, color: '#374151', fontWeight: '700' },
  dsStatusMeta: { marginTop: 6, fontSize: 11, color: '#374151' },

  dsMapWrap: { marginTop: 12, height: 240, borderRadius: 14, overflow: 'hidden' },

  primaryBtnLike: {
    height: 48,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  coachmarkBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  
  coachmarkBubble: {
    position: 'absolute',
    backgroundColor: '#E0F2FE',
    borderRadius: 16,
    padding: 14,
  },
  
  coachmarkTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0C4A6E',
  },
  
  coachmarkText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#075985',
    lineHeight: 16,
  },
  
  coachmarkBtn: {
    marginTop: 12,
    alignSelf: 'flex-end',
    backgroundColor: '#0369A1',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  
  coachmarkBtnText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 12,
  },
  
  coachmarkCard: {
    position: 'absolute',
  },
  
  coachmarkPill: {
    alignSelf: 'center',
    backgroundColor: '#0B5ED7',
    paddingHorizontal: 18,
    height: 40,
    borderRadius: 999,
    justifyContent: 'center',
    zIndex: 2,
  },
  
  coachmarkPillText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 13,
  },
  
  coachmarkBody: {
    backgroundColor: '#CFEAFF',
    borderRadius: 20,
    padding: 16,
    marginTop: -10, 
  },
  
  coachmarkTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0C4A6E',
  },
  
  coachmarkText: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#075985',
    lineHeight: 18,
  },
  
  coachmarkBtn: {
    marginTop: 14,
    alignSelf: 'flex-end',
    backgroundColor: '#075985',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  
  coachmarkBtnText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 12,
  },
  
  coachmarkNotch: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#CFEAFF',
    zIndex: 1,
  },
  
  coachmarkNotchDown: {
    transform: [{ rotate: '180deg' }],
  },
  
  
});

