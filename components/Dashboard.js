// driveash/components/Dashboard.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
  Switch,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';



import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import driverImage from '../assets/driver.png';
import { DeviceSession } from '../lib/deviceSession';
import { supabase } from '../lib/supabase';
import { getUserAvatarUrl, clearAvatarCache } from '../lib/avatar';
import * as Location from 'expo-location';
import { startDriverLocationStream, stopDriverLocationStream } from '../lib/driverStatus';
import BottomNav from './BottomNav';
import { usePendingInviteCount } from '../lib/usePendingInviteCount';

function ModeSwitchOverlay({ visible, title, subtitle, stylesObj }) {
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
      <View style={stylesObj.modeOverlayBackdrop}>
        <View style={stylesObj.modeOverlayCard}>
          <ActivityIndicator />
          <Text style={stylesObj.modeOverlayTitle}>{title}</Text>
          <Text style={stylesObj.modeOverlaySubtitle}>{subtitle}</Text>

          <View style={stylesObj.modeBarTrack}>
            <Animated.View style={[stylesObj.modeBarFill, { width: barWidth }]} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function Dashboard({ onNavigate, onSwitchToEmergencyContact }) {
  const [showWarningDetails, setShowWarningDetails] = useState(false);
    // ✅ Pending invites badge (for bell)
  const { count: pendingInviteCount } = usePendingInviteCount({ enabled: true });

  // ✅ Bell ringing animation (only when badge > 0)
  const bellAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop;
    if (pendingInviteCount > 0) {
      bellAnim.setValue(0);
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(bellAnim, { toValue: 1, duration: 90, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(bellAnim, { toValue: -1, duration: 90, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(bellAnim, { toValue: 1, duration: 90, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(bellAnim, { toValue: 0, duration: 90, easing: Easing.linear, useNativeDriver: true }),
          Animated.delay(900),
        ])
      );
      loop.start();
    } else {
      bellAnim.stopAnimation?.();
      bellAnim.setValue(0);
    }
    return () => loop?.stop?.();
  }, [pendingInviteCount, bellAnim]);

  const bellRotate = bellAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-12deg', '12deg'],
  });

  // ✅ Notifications: accepted emergency contact requests (for the requester)
  const [acceptedReqs, setAcceptedReqs] = useState([]);
  const [loadingAcceptedReqs, setLoadingAcceptedReqs] = useState(false);

  // ✅ Mode indicator (shows for ~2.5s on screen entry)
// ✅ Mode overlay shows ONLY when switching into Driver mode
const [modeOverlayVisible, setModeOverlayVisible] = useState(false);

useEffect(() => {
  const pending = DeviceSession.get?.()?.pendingModeSwitchTo;

  // show ONLY if previous screen requested switching to DRIVER
  if (pending === 'driver') {
    setModeOverlayVisible(true);

    // clear so it won't show again
    DeviceSession.set?.({ pendingModeSwitchTo: null });

    const t = setTimeout(() => setModeOverlayVisible(false), 2500);
    return () => clearTimeout(t);
  }
}, []);


  const [showNotifications, setShowNotifications] = useState(false);

  // Device Status (DEMO)
  const [deviceModalVisible, setDeviceModalVisible] = useState(false);
  const [scanState, setScanState] = useState('idle'); // 'idle' | 'scanning' | 'found' | 'pairing' | 'connected'
  const [availableDevices, setAvailableDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [connectedDevice, setConnectedDevice] = useState(null); // { id, name, rssi }
  const [batteryPercent, setBatteryPercent] = useState(null);
  const batteryTimerRef = useRef(null);
const locationSubRef = useRef(null);
// ✅ NEW: track how long we've been connected to IoT (demo bluetooth)
const [connectedAt, setConnectedAt] = useState(null); // number (ms since epoch)

// ✅ NEW: live "connected duration" label (updates every minute)
const [connectedDurationLabel, setConnectedDurationLabel] = useState('');

// ✅ NEW: helper to format duration as "Xh Ym" (or "Ym")
const formatConnectedDuration = (startMs) => {
  if (!startMs) return '';

  const diffMs = Math.max(0, Date.now() - startMs);
  const totalSec = Math.floor(diffMs / 1000);

  const h = Math.floor(totalSec / 3600);
  const remSecAfterHours = totalSec % 3600;

  const m = Math.floor(remSecAfterHours / 60);
  const s = remSecAfterHours % 60;

  // ✅ < 1 hour → MMm SSs
  if (h <= 0) {
    return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }

  // ✅ >= 1 hour → Hh MMm
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

  // Demo Bluetooth ON/OFF (KEEP state + logic, just hide toggle UI)
  const [bluetoothEnabled, setBluetoothEnabled] = useState(
    DeviceSession.get()?.bluetoothEnabled ?? true
  );

  // Reconnect prompt modal
  const [showReconnectPrompt, setShowReconnectPrompt] = useState(false);

  // ✅ Avatar
  const [myAvatar, setMyAvatar] = useState(null);

  // ✅ Profile name
  const [myFirstName, setMyFirstName] = useState('');
  const [myLastName, setMyLastName] = useState('');
  const [myEmail, setMyEmail] = useState('');
  // ✅ Latest Warning (from driver_warnings)
  const [latestWarning, setLatestWarning] = useState(null);
  const [loadingLatestWarning, setLoadingLatestWarning] = useState(true);

  const levelNumToKey = (n) => {
    if (n === 1) return 'level1';
    if (n === 2) return 'level2';
    return 'level3';
  };

  const statusFromLevel = (n) => {
    if (n === 1) return 'SLIGHTLY DROWSY';
    if (n === 2) return 'MODERATELY DROWSY';
    return 'EXTREMELY DROWSY';
  };

  const fmtTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const fmtDate = (iso) => {
    const d = new Date(iso);
    // sample output: 01-11-2026 (like your UI)
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}-${dd}-${yyyy}`;
  };

const currentAlert = useMemo(() => {
  // ✅ No DB data -> return null so UI can show placeholder
  if (!latestWarning) return null;

  const levelKey = levelNumToKey(latestWarning.level);
  const status = statusFromLevel(latestWarning.level);
  const color = levelKey === 'level1' ? '#10B981' : levelKey === 'level2' ? '#F59E0B' : '#EF4444';

  return {
    level: levelKey,
    status,
    color,
    timestamp: fmtTime(latestWarning.created_at),
    date: fmtDate(latestWarning.created_at),
    snapshot_url: latestWarning.snapshot_url || null,
  };
}, [latestWarning]);



  const getLevelText = (level) => {
    if (level === 'level3') return 'LEVEL 3 WARNING';
    if (level === 'level2') return 'LEVEL 2 WARNING';
    if (level === 'level1') return 'LEVEL 1 WARNING';
    return '';
  };

  const demoDevices = useMemo(
    () => [
      { id: 'drive-001', name: 'D.R.I.V.E', rssi: -42 },
      { id: 'esp32-002', name: 'ESP32-Tracker', rssi: -64 },
      { id: 'ble-003', name: 'OBD-II Demo', rssi: -71 },
    ],
    []
  );

  // Keep saving bluetoothEnabled in session (flow preserved)
  useEffect(() => {
    DeviceSession.set({ bluetoothEnabled });
  }, [bluetoothEnabled]);

  const openDeviceModal = () => setDeviceModalVisible(true);
  const closeDeviceModal = () => setDeviceModalVisible(false);

  const requireBluetoothOrWarn = () => {
    if (!bluetoothEnabled) {
      Alert.alert(
        'Bluetooth Required',
        'Please turn on Bluetooth to connect to D.R.I.V.E.\n\n(Demo note: Expo Go cannot read real Bluetooth state, so this is simulated internally.)'
      );
      return false;
    }
    return true;
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
      console.log('[Dashboard] updateUser metadata failed:', e);
    }
  };

  const clearLastPairedFromSupabaseMetadata = async () => {
    try {
      await supabase.auth.updateUser({
        data: {
          lastPairedDeviceId: null,
          lastPairedDeviceName: null,
        },
      });
    } catch (e) {
      console.log('[Dashboard] clear metadata failed:', e);
    }
  };

  const startScan = () => {
    if (!requireBluetoothOrWarn()) return;

    setSelectedDevice(null);
    setAvailableDevices([]);
    setScanState('scanning');

    setTimeout(() => {
      setAvailableDevices(demoDevices);
      setScanState('found');
    }, 1600);
  };

    useEffect(() => {
    let mounted = true;
    let channel;

    const loadAccepted = async () => {
      try {
        setLoadingAcceptedReqs(true);

        const { data: userRes } = await supabase.auth.getUser();
        const me = userRes?.user;
        if (!me?.id) {
          if (mounted) setAcceptedReqs([]);
          return;
        }

        // Get latest ACCEPTED requests where I am the requester
        const { data: rows, error } = await supabase
          .from('emergency_contact_requests')
          .select('id, requester_id, target_id, status, created_at, responded_at')
          .eq('requester_id', me.id)
          .eq('status', 'accepted')
          .order('responded_at', { ascending: false })
          .limit(20);

        if (error) throw error;

        const accepted = rows || [];
        const targetIds = [...new Set(accepted.map((r) => r.target_id).filter(Boolean))];

        // Fetch names/avatars from user_profiles (best-effort)
        let profilesById = {};
        if (targetIds.length > 0) {
          const { data: profs } = await supabase
            .from('user_profiles')
            .select('id, first_name, last_name, email, avatar_url')
            .in('id', targetIds);

          (profs || []).forEach((p) => {
            profilesById[p.id] = p;
          });
        }

        const mapped = accepted.map((r) => {
          const p = profilesById[r.target_id];
          const first = String(p?.first_name || '').trim();
          const last = String(p?.last_name || '').trim();
          const full = `${first}${first && last ? ' ' : ''}${last}`.trim();
          const displayName = full || (p?.email ? p.email.split('@')[0] : 'Someone');

          return {
            id: r.id,
            target_id: r.target_id,
            displayName,
            avatar_url: p?.avatar_url || null,
            responded_at: r.responded_at || r.created_at,
          };
        });

        if (mounted) setAcceptedReqs(mapped);
      } catch (e) {
        console.log('[Dashboard] loadAcceptedReqs error:', e);
        if (mounted) setAcceptedReqs([]);
      } finally {
        if (mounted) setLoadingAcceptedReqs(false);
      }
    };

    (async () => {
      await loadAccepted();

      const { data: userRes } = await supabase.auth.getUser();
      const me = userRes?.user;
      if (!me?.id) return;

      // Realtime: any update/insert affecting my requester_id
      channel = supabase
        .channel(`accepted-reqs-${me.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'emergency_contact_requests', filter: `requester_id=eq.${me.id}` },
          () => loadAccepted()
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let channel = null;

    const loadLatestWarning = async () => {
      try {
        setLoadingLatestWarning(true);

        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;

        const me = userRes?.user;
        if (!me?.id) {
          if (mounted) setLatestWarning(null);
          return;
        }

        const { data, error } = await supabase
          .from('driver_warnings')
          .select('id, created_at, level, monitor_type, location_text, snapshot_url')
          .eq('user_id', me.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        if (mounted) {
          setLatestWarning((data && data[0]) ? data[0] : null);
        }

        // ✅ realtime: auto refresh when IoT inserts a new warning row
        if (!channel) {
          channel = supabase
            .channel(`dw_latest_${me.id}`)
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'driver_warnings', filter: `user_id=eq.${me.id}` },
              () => loadLatestWarning()
            )
            .subscribe();
        }
      } catch (e) {
        console.log('[Dashboard] loadLatestWarning error:', e);
        if (mounted) setLatestWarning(null);
      } finally {
        if (mounted) setLoadingLatestWarning(false);
      }
    };

    loadLatestWarning();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // ✅ Load my avatar (from DB user_profiles.avatar_url)
  useEffect(() => {
    let mounted = true;

    const loadMyAvatar = async () => {
      try {
        const { data: userRes, error } = await supabase.auth.getUser();
        if (error) throw error;

        const me = userRes?.user;
        if (!me?.id) {
          if (mounted) setMyAvatar(null);
          return;
        }

        // refresh cache on screen mount so it reflects latest avatar changes
        clearAvatarCache(me.id);

        const url = await getUserAvatarUrl(me.id);
        if (mounted) setMyAvatar(url);
      } catch (e) {
        console.log('[Dashboard] loadMyAvatar error:', e);
        if (mounted) setMyAvatar(null);
      }
    };

    loadMyAvatar();
    return () => {
      mounted = false;
    };
  }, []);

  // ✅ Load my profile name from user_profiles
  useEffect(() => {
    let mounted = true;

    const loadMyProfileName = async () => {
      try {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;

        const me = userRes?.user;
        const authEmail = String(me?.email || '').trim().toLowerCase();
        if (mounted) setMyEmail(authEmail);

        if (!me?.id) return;

        const { data: prof, error: profErr } = await supabase
          .from('user_profiles')
          .select('first_name,last_name,email')
          .eq('id', me.id)
          .maybeSingle();

        if (profErr) throw profErr;

        const first = String(prof?.first_name || '').trim();
        const last = String(prof?.last_name || '').trim();
        const dbEmail = String(prof?.email || '').trim().toLowerCase();

        if (!mounted) return;

        setMyFirstName(first);
        setMyLastName(last);
        if (dbEmail) setMyEmail(dbEmail);
      } catch (e) {
        console.log('[Dashboard] loadMyProfileName error:', e);
      }
    };

    loadMyProfileName();

    return () => {
      mounted = false;
    };
  }, []);
// ✅ NEW: update connected duration label every minute while connected
useEffect(() => {
  if (!(scanState === 'connected' && connectedDevice && connectedAt)) {
    setConnectedDurationLabel('');
    return;
  }

  const update = () => setConnectedDurationLabel(formatConnectedDuration(connectedAt));

  // ✅ update immediately
  update();

  // ✅ choose interval based on elapsed time:
  // <1h → show seconds so refresh every 1s
  // >=1h → show minutes only so refresh every 60s
  const elapsedMs = Math.max(0, Date.now() - connectedAt);
  const intervalMs = elapsedMs < 3600 * 1000 ? 1000 : 60000;

  const t = setInterval(update, intervalMs);
  return () => clearInterval(t);
}, [scanState, connectedDevice, connectedAt]);
// ✅ Safety net: if we are connected but connectedAt is missing, recover from DeviceSession or set now
useEffect(() => {
  if (scanState === 'connected' && connectedDevice && !connectedAt) {
    const s = DeviceSession.get?.() || {};
    const ms =
      typeof s.connectedAt === 'number'
        ? s.connectedAt
        : s.connectedAt
        ? Date.parse(s.connectedAt)
        : null;

    if (Number.isFinite(ms)) {
      setConnectedAt(ms);
    } else {
      const now = Date.now();
      setConnectedAt(now);
      DeviceSession.set?.({ connectedAt: now });
    }
  }
}, [scanState, connectedDevice, connectedAt]);

 useEffect(() => {
  const s = DeviceSession.get();
  if (s?.connectedDevice) {
    setConnectedDevice(s.connectedDevice);
    setBatteryPercent(s.batteryPercent ?? 95);
    setScanState(s.scanState ?? 'connected');

    // ✅ NEW: restore connectedAt (best effort)
    if (s?.connectedAt) {
      const ms = typeof s.connectedAt === 'number' ? s.connectedAt : Date.parse(s.connectedAt);
      if (!Number.isNaN(ms)) setConnectedAt(ms);
    }

    // ✅ if we restored a connected session, ensure streaming is running
    (async () => {
      try {
        if (!locationSubRef.current) {
          locationSubRef.current = await startDriverLocationStream();
        }
      } catch (e) {
        console.log('[Dashboard] restore startDriverLocationStream failed:', e);
      }
    })();
  }
}, []);

  // ✅ ADD ONLY: safety net - ensure stream is running when connected (any path)
useEffect(() => {
  let cancelled = false;

  (async () => {
    try {
      // start streaming only when "connected"
      if (scanState === 'connected' && connectedDevice) {
        if (!locationSubRef.current) {
          locationSubRef.current = await startDriverLocationStream();
        }
      }
    } catch (e) {
      if (!cancelled) {
        console.log('[Dashboard] auto startDriverLocationStream failed:', e);
      }
    }
  })();

  return () => {
    cancelled = true;
  };
}, [scanState, connectedDevice]);

// ✅ ADD ONLY: safety net - stop stream when disconnected (any path)
useEffect(() => {
  if (!(scanState === 'connected' && connectedDevice)) {
    Promise.resolve(stopDriverLocationStream(locationSubRef.current, { setMode: false }))
      .catch((e) => console.log('[Dashboard] stopDriverLocationStream (auto) failed:', e))
      .finally(() => {
        locationSubRef.current = null;
      });
  }
}, [scanState, connectedDevice]);


  const pairSelectedDevice = () => {
    if (!requireBluetoothOrWarn()) return;
    if (!selectedDevice) return;

    setScanState('pairing');

    setTimeout(async () => {
     setConnectedDevice(selectedDevice);
setScanState('connected');
setBatteryPercent(95);

// ✅ NEW: mark time connected
const nowMs = Date.now();
setConnectedAt(nowMs);

DeviceSession.set({
  scanState: 'connected',
  connectedDevice: selectedDevice,
  batteryPercent: 95,
  lastPairedDevice: selectedDevice,
  connectedAt: nowMs, // ✅ NEW
});


      await saveLastPairedToSupabaseMetadata(selectedDevice);
try {
  // start streaming driver location NOW that we're "driving"
  // store the subscription so we can stop it later
  if (!locationSubRef.current) {
    locationSubRef.current = await startDriverLocationStream();
  }
} catch (e) {
  console.log('[Dashboard] startDriverLocationStream failed:', e);
  Alert.alert('Location', e?.message || 'Failed to start location tracking');
}
      closeDeviceModal();
    }, 1400);
  };

const performDisconnectAndCleanup = () => {
  setConnectedDevice(null);
  setBatteryPercent(null);
  setScanState('idle');
  setSelectedDevice(null);
  setAvailableDevices([]);
setConnectedAt(null);
setConnectedDurationLabel('');
DeviceSession.set?.({ connectedAt: null });

  Promise.resolve(stopDriverLocationStream(locationSubRef.current, { setMode: true }))
    .catch((e) => console.log('[Dashboard] stopDriverLocationStream (disconnect) failed:', e))
    .finally(() => {
      locationSubRef.current = null;
    });

  DeviceSession.clearConnection();
};

const disconnectDevice = () => {
  // ✅ Only ask first. Do NOT disconnect yet.
  closeDeviceModal();
  setShowReconnectPrompt(true);
};


// YES = confirm disconnect + go EmergencyDashboard
const handleReconnectYes = async () => {
  setShowReconnectPrompt(false);

  // actually disconnect now
  performDisconnectAndCleanup();

  // optional: clear last paired so it won't auto-restore
  await clearLastPairedFromSupabaseMetadata();

  if (onSwitchToEmergencyContact) {
    onSwitchToEmergencyContact();
    return;
  }
  onNavigate?.('ec-dashboard');
};

// NO = don't disconnect; reopen scan again to reconnect
const handleReconnectNo = () => {
  setShowReconnectPrompt(false);
  openDeviceModal();
  startScan();
};


useEffect(() => {
  return () => {
    Promise.resolve(stopDriverLocationStream(locationSubRef.current, { setMode: false }))
      .catch((e) => console.log('[Dashboard] stopDriverLocationStream (unmount) failed:', e))
      .finally(() => {
        locationSubRef.current = null;
      });
  };
}, []);


  useEffect(() => {
    if (batteryTimerRef.current) {
      clearInterval(batteryTimerRef.current);
      batteryTimerRef.current = null;
    }

    if (scanState === 'connected' && connectedDevice) {
      batteryTimerRef.current = setInterval(() => {
        setBatteryPercent((prev) => {
          if (prev == null) return prev;
          const next = prev + (Math.random() > 0.7 ? -1 : 0);
          return Math.max(88, Math.min(99, next));
        });
      }, 7000);
    }

    return () => {
      if (batteryTimerRef.current) clearInterval(batteryTimerRef.current);
      batteryTimerRef.current = null;
    };
  }, [scanState, connectedDevice]);

  // ✅ Build Full Name (never show "—")
  const myFullName = useMemo(() => {
    const first = String(myFirstName || '').trim();
    const last = String(myLastName || '').trim();
    const full = `${first}${first && last ? ' ' : ''}${last}`.trim();
    if (full) return full;

    const email = String(myEmail || '').trim();
    if (email.includes('@')) {
      const local = email.split('@')[0];
      return local ? local : 'User';
    }
    return 'User';
  }, [myFirstName, myLastName, myEmail]);

 if (showNotifications) {
  return (
    <View style={[s.screen, { paddingTop: 50 }]}>
      <View style={{ paddingHorizontal: 18, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 18, fontWeight: '900', color: '#111827' }}>Notifications</Text>
        <TouchableOpacity onPress={() => setShowNotifications(false)}>
          <Text style={{ color: '#1E88E5', fontWeight: '800' }}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 18 }}>
        <View style={{ padding: 14, borderRadius: 14, backgroundColor: '#F3F4F6', marginBottom: 12 }}>
          <Text style={{ fontWeight: '900', color: '#111827' }}>Pending requests</Text>
          <Text style={{ marginTop: 4, color: '#6B7280', fontWeight: '700' }}>
            You have {pendingInviteCount} pending emergency contact request{pendingInviteCount === 1 ? '' : 's'}.
          </Text>
        </View>

        <Text style={{ fontSize: 14, fontWeight: '900', color: '#111827', marginBottom: 10 }}>
          Accepted requests
        </Text>

        {loadingAcceptedReqs ? (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <ActivityIndicator />
            <Text style={{ marginTop: 8, color: '#6B7280', fontWeight: '700' }}>Fetching…</Text>
          </View>
        ) : acceptedReqs.length === 0 ? (
          <View style={{ paddingVertical: 20 }}>
            <Text style={{ color: '#6B7280', fontWeight: '700' }}>
              No accepted requests yet.
            </Text>
          </View>
        ) : (
          acceptedReqs.map((n) => (
            <View
              key={n.id}
              style={{
                backgroundColor: 'white',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                padding: 14,
                marginBottom: 10,
              }}
            >
              <Text style={{ color: '#111827', fontWeight: '900' }}>
                {n.displayName} accepted your request to be your emergency contact.
              </Text>
              <Text style={{ marginTop: 6, color: '#6B7280', fontWeight: '700', fontSize: 12 }}>
                {n.responded_at ? new Date(n.responded_at).toLocaleString() : ''}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}


  if (showWarningDetails) {
    return (
      <View style={s.center}>
        <Text>Warning Details</Text>
        <TouchableOpacity onPress={() => {
  if (latestWarning?.id) {
    onNavigate?.('history', { openWarningId: latestWarning.id });
    return;
  }
  onNavigate?.('history');
}}
>
          <Text style={{ marginTop: 20, color: '#1E88E5' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

async function setMyMode(mode) {
  const { data: userRes } = await supabase.auth.getUser();
  const me = userRes?.user;
  if (!me?.id) return;

  // keep last_lat/lng as-is if mode changes
  await supabase.from('driver_status').upsert(
    {
      user_id: me.id,
      mode, // 'driver' or 'contact'
    },
    { onConflict: 'user_id' }
  );
}

async function startLocationStreaming(onError) {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    onError?.('Location permission denied');
    return null;
  }

  // mark driver mode ON
  await setMyMode('driver');

  // live updates while app open
  const sub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 3000,       // every 3s
      distanceInterval: 5,      // or every 5 meters
    },
    async (loc) => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const me = userRes?.user;
        if (!me?.id) return;

        const lat = loc.coords.latitude;
        const lng = loc.coords.longitude;

        await supabase.from('driver_status').upsert(
          {
            user_id: me.id,
            mode: 'driver',
            last_lat: lat,
            last_lng: lng,
            last_location_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      } catch (e) {
        console.log('[driver_status] update error', e);
      }
    }
  );

  return sub; // you must stop it later
}

async function stopLocationStreaming(subscription) {
  try {
    subscription?.remove?.();
  } catch {}

  // mark driver mode OFF (but keep last location saved)
  await setMyMode('contact');
}
  return (
    <View style={s.screen}>
          <ModeSwitchOverlay
      visible={modeOverlayVisible}
      title="DRIVER MODE"
      subtitle="Switching to Driver dashboard…"
      stylesObj={s}
    />

      {/* ✅ Header (match screenshot) */}
      <View style={s.header}>
        <View style={s.headerLeftCircle}>
          <Ionicons name="car-sport" size={18} color="#1E88E5" />
        </View>

        <Text style={s.headerTitle}>D.R.I.V.E.</Text>

       <TouchableOpacity onPress={() => setShowNotifications(true)} style={s.headerBell}>
  <View style={{ position: 'relative' }}>
    <Animated.View style={{ transform: [{ rotate: bellRotate }] }}>
      <Feather name="bell" size={22} color="#fff" />
    </Animated.View>

    {pendingInviteCount > 0 && (
      <View style={s.bellBadge}>
        <Text style={s.bellBadgeText}>
          {pendingInviteCount > 99 ? '99+' : String(pendingInviteCount)}
        </Text>
      </View>
    )}
  </View>
</TouchableOpacity>

      </View>

      {/* Content */}
      <View style={s.content}>
        {/* ✅ Hello row */}
        <View style={s.helloRow}>
          <View style={s.helloAvatarWrap}>
            <Image
              source={myAvatar ? { uri: myAvatar } : driverImage}
              style={s.helloAvatar}
            />
          </View>

          <View style={{ marginLeft: 12 }}>
            <Text style={s.helloSmall}>Hello,</Text>
            <Text style={s.helloName}>{myFullName}</Text>
          </View>
        </View>

        {/* Recent Activity */}
        <Text style={s.sectionTitle}>Recent Activity</Text>

        <TouchableOpacity
          onPress={() => {
  // ✅ if DB latest warning exists, open it inside History
  if (latestWarning?.id) {
    onNavigate?.('history', { openWarningId: latestWarning.id });
    return;
  }

  // fallback if none
  onNavigate?.('history');
}}

          activeOpacity={0.85}
          style={s.activityCard}
        ><View style={s.activityThumb}>
  {loadingLatestWarning ? (
    <ActivityIndicator />
  ) : currentAlert?.snapshot_url ? (
    <Image source={{ uri: currentAlert.snapshot_url }} style={{ width: '100%', height: '100%' }} />
  ) : (
    <Ionicons name={currentAlert ? "warning" : "time-outline"} size={30} color="#9CA3AF" />
  )}
</View>

<View style={{ flex: 1 }}>
  {loadingLatestWarning ? (
    <>
      <Text style={[s.activityLevel, { color: '#6B7280' }]}>Fetching latest activity…</Text>
      <Text style={[s.activityTime, { marginTop: 6 }]}>Please wait.</Text>
    </>
  ) : currentAlert ? (
    <>
      <Text style={[s.activityLevel, { color: currentAlert.color }]}>
        {getLevelText(currentAlert.level)}
      </Text>

      <Text style={[s.activityStatus, { color: currentAlert.color }]}>
        {currentAlert.status}
      </Text>

      <Text style={s.activityTime}>
        {currentAlert.date} {currentAlert.timestamp}
      </Text>
    </>
  ) : (
    <>
      <Text style={[s.activityLevel, { color: '#111827' }]}>
        No data to show
      </Text>
      <Text style={[s.activityTime, { marginTop: 6 }]}>
        This is where your recent activity will appear.
      </Text>
    </>
  )}
</View>

<Ionicons
  name={currentAlert ? "warning" : "information-circle-outline"}
  size={26}
  color={currentAlert ? currentAlert.color : '#9CA3AF'}
/>


        </TouchableOpacity>

        {/* Device Status */}
        <Text style={s.sectionTitle}>Device Status</Text>

        <View style={s.deviceRow}>
          <TouchableOpacity
            onPress={() => {
              if (!requireBluetoothOrWarn()) return;
              if (connectedDevice) setDeviceModalVisible(true);
              else openDeviceModal();
            }}
            activeOpacity={0.85}
            style={s.deviceCard}
          >
            <View style={s.deviceTop}>
              <MaterialCommunityIcons name="bluetooth" size={18} color="#fff" />
              <Text style={s.deviceTopRight}>{connectedDevice ? 'Connected' : 'Not connected'}</Text>
            </View>

            <View>
              <Text style={s.deviceTitle}>D.R.I.V.E</Text>
              <Text style={s.deviceSub}>{connectedDevice ? 'Device On' : 'Find device'}</Text>
            </View>

            <Text style={s.deviceTime}>
  {connectedDevice ? (connectedDurationLabel || '0m') : ''}
</Text>

          </TouchableOpacity>

          <View style={s.deviceCard}>
            <View style={s.deviceTop}>
              <Ionicons name="battery-half" size={18} color="#fff" />
              <Text style={s.deviceTopRight}>{batteryPercent == null ? '' : `${batteryPercent}%`}</Text>
            </View>

            <View>
              <Text style={s.deviceTitle}>Battery</Text>
              <Text style={s.deviceSub}>{batteryPercent == null ? '—' : 'Charged'}</Text>
            </View>

            <Text style={s.deviceTime}>{batteryPercent == null ? '' : '3m'}</Text>
          </View>
        </View>
      </View>

     {/* Bottom nav (centralized) */}
<BottomNav
  variant="driver"
  activeKey="home"
  onNavigate={onNavigate}
/>


      {/* Device modal (UNCHANGED logic, only kept as-is) */}
      <Modal visible={deviceModalVisible} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 }}>
          <View style={{ width: '100%', backgroundColor: 'white', borderRadius: 16, padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>Bluetooth Devices</Text>
              <Pressable onPress={closeDeviceModal}>
                <Ionicons name="close" size={22} color="#111827" />
              </Pressable>
            </View>

            <Text style={{ marginTop: 6, color: '#6B7280', fontSize: 12 }}>
              Demo connection flow (frontend only)
            </Text>

            {/* ✅ Toggle UI REMOVED (flow preserved)
                We keep bluetoothEnabled state + requireBluetoothOrWarn() logic.
            */}

            {connectedDevice && scanState === 'connected' ? (
              <View style={{ marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: '#F3F4F6' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <MaterialCommunityIcons name="bluetooth-connect" size={22} color="#1E3A8A" />
                    <View>
                      <Text style={{ fontWeight: '800', color: '#111827' }}>{connectedDevice.name}</Text>
                      <Text style={{ color: '#6B7280', fontSize: 12 }}>Connected • RSSI {connectedDevice.rssi}</Text>
                      <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>
  Connected for: {connectedDurationLabel || '0m'}
</Text>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: '#111827', fontWeight: '700' }}>
                      {batteryPercent == null ? '—' : `${batteryPercent}%`}
                    </Text>
                    <Text style={{ color: '#6B7280', fontSize: 12 }}>Battery</Text>
                    
                  </View>
                </View>

                <Pressable
                  onPress={disconnectDevice}
                  style={{ marginTop: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center' }}
                >
                  <Text style={{ color: 'white', fontWeight: '700' }}>Disconnect</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={{ marginTop: 14, flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    onPress={startScan}
                    disabled={!bluetoothEnabled}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: bluetoothEnabled ? '#1E3A8A' : '#9CA3AF',
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    {scanState === 'scanning' ? (
                      <>
                        <ActivityIndicator color="white" />
                        <Text style={{ color: 'white', fontWeight: '700' }}>Scanning…</Text>
                      </>
                    ) : (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <MaterialCommunityIcons name="bluetooth" size={18} color="white" />
                          <Feather name="search" size={16} color="white" />
                        </View>
                        <Text style={{ color: 'white', fontWeight: '700' }}>Scan available devices</Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={closeDeviceModal}
                    style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: '#111827', fontWeight: '700' }}>Close</Text>
                  </Pressable>
                </View>

                <View style={{ marginTop: 14 }}>
                  {!bluetoothEnabled && (
                    <Text style={{ color: '#DC2626', fontSize: 12 }}>
                      Bluetooth is OFF. Turn it on to scan/connect.
                    </Text>
                  )}

                  {bluetoothEnabled && scanState === 'idle' && (
                    <Text style={{ color: '#6B7280', fontSize: 12 }}>
                      Tap “Scan available devices” to start.
                    </Text>
                  )}

                  {scanState === 'scanning' && (
                    <Text style={{ color: '#6B7280', fontSize: 12, marginTop: 6 }}>
                      Looking for nearby devices…
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
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <MaterialCommunityIcons name={selected ? 'bluetooth-connect' : 'bluetooth'} size={20} color="#1E3A8A" />
                            <View>
                              <Text style={{ fontWeight: '800', color: '#111827' }}>{d.name}</Text>
                              <Text style={{ color: '#6B7280', fontSize: 12 }}>RSSI {d.rssi}</Text>
                            </View>
                          </View>

                          {selected && <Ionicons name="checkmark-circle" size={20} color="#1E3A8A" />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  onPress={pairSelectedDevice}
                  disabled={!bluetoothEnabled || !selectedDevice || scanState === 'scanning' || scanState === 'pairing'}
                  style={{
                    marginTop: 14,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor:
                      !bluetoothEnabled || !selectedDevice || scanState === 'scanning' || scanState === 'pairing'
                        ? '#9CA3AF'
                        : '#1E3A8A',
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {scanState === 'pairing' ? (
                    <>
                      <ActivityIndicator color="white" />
                      <Text style={{ color: 'white', fontWeight: '700' }}>Pairing…</Text>
                    </>
                  ) : (
                    <>
                      <MaterialCommunityIcons name="link-variant" size={18} color="white" />
                      <Text style={{ color: 'white', fontWeight: '700' }}>
                        Pair{selectedDevice ? ` with ${selectedDevice.name}` : ''}
                      </Text>
                    </>
                  )}
                </Pressable>

                <Text style={{ marginTop: 10, color: '#6B7280', fontSize: 11, textAlign: 'center' }}>
                  Flow: Scan → select → Pair → Connected (D.R.I.V.E)
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Reconnect Prompt Modal (UNCHANGED) */}
      <Modal transparent visible={showReconnectPrompt} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
          <View style={{ width: '100%', backgroundColor: 'white', borderRadius: 16, padding: 18 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 8 }}>
  Disconnect?
</Text>
<Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 16, lineHeight: 18 }}>
  Are you sure you want to disconnect from D.R.I.V.E.?
</Text>


            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Pressable
                onPress={handleReconnectNo}
                style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#E5E7EB', marginRight: 10 }}
              >
                 <Text style={{ color: '#111827', fontWeight: '700' }}>No, reconnect</Text>
              </Pressable>

              <Pressable
                onPress={handleReconnectYes}
                style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#1E3A8A' }}
              >
                 <Text style={{ color: 'white', fontWeight: '800' }}>Yes, disconnect</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* Bottom nav item */
function NavItem({ icon, label, onPress, active }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={active} style={{ alignItems: 'center' }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: active ? '#3B82F6' : 'white',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name={icon} size={20} color={active ? '#fff' : '#3B82F6'} />
      </View>
      <Text style={{ fontSize: 12, color: '#3B82F6', marginTop: 6, fontWeight: active ? '800' : '600' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* Styles */
const s = {
  screen: { flex: 1, backgroundColor: '#fff' },
  // ✅ Mode overlay (2–3s indicator)
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
  bellBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#1E88E5',
  },
  bellBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '900',
  },

  header: {
    height: 90,
    backgroundColor: '#1E88E5',
    paddingTop: 34,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLeftCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerBell: { width: 36, alignItems: 'flex-end' },

  content: { flex: 1, paddingHorizontal: 18, paddingTop: 14 },

  helloRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  helloAvatarWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  helloAvatar: { width: 54, height: 54 },
  helloSmall: { color: '#6B7280', fontSize: 12, fontWeight: '700' },
  helloName: { color: '#111827', fontSize: 18, fontWeight: '900', marginTop: 2 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
    marginTop: 6,
    marginBottom: 12,
  },

  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 18,
  },
  activityThumb: {
    width: 98,
    height: 70,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  activityLevel: { fontWeight: '900', fontSize: 13 },

  activityStatus: { fontWeight: '900', fontSize: 13, marginTop: 3 },

  activityTime: { color: '#6B7280', fontSize: 12, marginTop: 6 },

  deviceRow: { flexDirection: 'row', gap: 14 },
  deviceCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#1E88E5',
    padding: 14,
    minHeight: 110, // ✅ bigger like screenshot
    justifyContent: 'space-between',
  },
  deviceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deviceTopRight: { color: '#fff', fontSize: 12, fontWeight: '900' },
  deviceTitle: { color: '#fff', fontWeight: '900', fontSize: 15, marginTop: 6 },
  deviceSub: { color: '#fff', fontSize: 12, opacity: 0.95, marginTop: 4, fontWeight: '700' },
  deviceTime: { color: '#fff', fontSize: 11, opacity: 0.9, textAlign: 'right', fontWeight: '700' },

  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
};
