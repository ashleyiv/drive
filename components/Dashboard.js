import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, Line, Circle, G } from 'react-native-svg';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import driverImage from '../assets/driver.png';

export default function Dashboard({ onNavigate }) {
  const [selectedMonitoring, setSelectedMonitoring] = useState(null);
  const [showWarningDetails, setShowWarningDetails] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // ===========================
  // Device Status (DEMO) - kept
  // ===========================
  const [deviceModalVisible, setDeviceModalVisible] = useState(false);
  const [scanState, setScanState] = useState('idle'); // 'idle' | 'scanning' | 'found' | 'pairing' | 'connected'
  const [availableDevices, setAvailableDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [connectedDevice, setConnectedDevice] = useState(null); // { id, name, rssi }
  const [batteryPercent, setBatteryPercent] = useState(null);
  const batteryTimerRef = useRef(null);

  const currentAlert = {
    level: 'level3',
    status: 'EXTREMELY DROWSY',
    color: '#EF4444',
    timestamp: '9:35 PM',
    date: '12-15-2025',
  };

  const getLevelText = (level) => {
    if (level === 'level3') return 'LEVEL 3 WARNING';
    if (level === 'level2') return 'LEVEL 2 WARNING';
    if (level === 'level1') return 'LEVEL 1 WARNING';
    return '';
  };

  // ---------- Device demo helpers ----------
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

  const startScan = () => {
    setSelectedDevice(null);
    setAvailableDevices([]);
    setScanState('scanning');

    setTimeout(() => {
      setAvailableDevices(demoDevices);
      setScanState('found');
    }, 1600);
  };

  const pairSelectedDevice = () => {
    if (!selectedDevice) return;

    setScanState('pairing');

    setTimeout(() => {
      setConnectedDevice(selectedDevice);
      setScanState('connected');
      setBatteryPercent(95);
      closeDeviceModal();
    }, 1400);
  };

  const disconnectDevice = () => {
    setConnectedDevice(null);
    setBatteryPercent(null);
    setScanState('idle');
    setSelectedDevice(null);
    setAvailableDevices([]);
  };

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

  // ===========================
  // NEW: Demo report datasets
  // ===========================
  const reports = useMemo(() => {
    // simple helper to generate smooth-ish noise
    const makeSeries = ({ n, base, noise, spikes = [] }) => {
      const arr = [];
      for (let i = 0; i < n; i++) {
        const rand = (Math.random() - 0.5) * noise;
        const prev = arr[i - 1] ?? base;
        const smooth = prev + rand;
        arr.push(smooth);
      }
      // apply spikes: { start, end, add, curve? }
      spikes.forEach((s) => {
        for (let i = s.start; i <= s.end && i < n; i++) {
          const t = (i - s.start) / Math.max(1, s.end - s.start);
          const bump = s.curve === 'bell'
            ? Math.sin(Math.PI * t) * s.add
            : s.add;
          arr[i] = arr[i] + bump;
        }
      });
      return arr;
    };

    // Eye-lid (PERCLOS per day) — upward trend with bumps
    const perclos = makeSeries({
      n: 24,
      base: 0.12,
      noise: 0.05,
      spikes: [
        { start: 6, end: 9, add: 0.05, curve: 'bell' },
        { start: 14, end: 18, add: 0.08, curve: 'bell' },
      ],
    }).map((v, i) => Math.max(0.02, Math.min(0.65, v + i * 0.01)));

    // Yawn (MAR vs Time) — low baseline then one big yawn event like your image
    const mar = makeSeries({
      n: 120,
      base: 0.11,
      noise: 0.02,
      spikes: [{ start: 48, end: 85, add: 0.48, curve: 'bell' }],
    }).map((v) => Math.max(0.05, Math.min(0.78, v)));

    // Head pitch (degrees) — one small "mirror check" + one sustained nod
    const headPitch = makeSeries({
      n: 150,
      base: 5,
      noise: 1.4,
      spikes: [
        { start: 30, end: 45, add: 9, curve: 'bell' },   // small bump
        { start: 95, end: 125, add: 26, curve: 'bell' }, // sustained nod
      ],
    }).map((v) => Math.max(0, Math.min(60, v)));

    // Hands on wheel pie (demo)
    const handOnWheel = { on: 81, off: 19 }; // percent

    return {
      perclos,
      mar,
      headPitch,
      handOnWheel,
      meta: {
        date1: 'December 15, 2025',
        date2: 'December 14, 2025',
      },
    };
  }, []);

  // ===========================
  // NEW: Head nod analysis (frontend-only)
  // ===========================
  const headNodAnalysis = useMemo(() => {
    // threshold zones like your chart idea:
    // <15 normal, 15-25 caution, >25 sustained nod / drowsy
    const THRESH = 25;
    const series = reports.headPitch;

    // Assume 150 points across 30 seconds -> 0.2s per point
    const secondsPerPoint = 30 / Math.max(1, series.length - 1);

    // Find segments above threshold
    const segments = [];
    let start = null;
    for (let i = 0; i < series.length; i++) {
      const above = series[i] >= THRESH;
      if (above && start == null) start = i;
      if (!above && start != null) {
        segments.push({ start, end: i - 1 });
        start = null;
      }
    }
    if (start != null) segments.push({ start, end: series.length - 1 });

    // Compute strongest segment
    const enriched = segments.map((seg) => {
      let peak = -Infinity;
      let area = 0;
      for (let i = seg.start; i <= seg.end; i++) {
        peak = Math.max(peak, series[i]);
        area += Math.max(0, series[i] - THRESH); // "severity area"
      }
      const duration = (seg.end - seg.start) * secondsPerPoint;
      const severityScore = area * secondsPerPoint; // deg-seconds above threshold
      return { ...seg, peak, duration, severityScore };
    });

    const strongest = enriched.sort((a, b) => b.severityScore - a.severityScore)[0] || null;

    const totalAboveSeconds = enriched.reduce((sum, s) => sum + s.duration, 0);

    // Friendly labels
    const strengthLabel = (peak) => {
      if (peak == null) return '—';
      if (peak >= 35) return 'Strong';
      if (peak >= 28) return 'Moderate';
      return 'Mild';
    };

    return {
      threshold: THRESH,
      events: enriched.length,
      totalAboveSeconds,
      strongest: strongest
        ? {
            durationSec: strongest.duration,
            peakDeg: strongest.peak,
            strength: strengthLabel(strongest.peak),
          }
        : null,
    };
  }, [reports.headPitch]);

  // ---------------- Existing logic kept intact ----------------
  if (showNotifications) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Notifications Panel</Text>
        <TouchableOpacity onPress={() => setShowNotifications(false)}>
          <Text style={{ marginTop: 20, color: '#1E88E5' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showWarningDetails) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Warning Details</Text>
        <TouchableOpacity onPress={() => setShowWarningDetails(false)}>
          <Text style={{ marginTop: 20, color: '#1E88E5' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ===========================
  // REPLACED: Monitoring Report placeholder
  // ===========================
  if (selectedMonitoring) {
    return (
      <View style={{ flex: 1, backgroundColor: '#E5E7EB' }}>
        {/* Top bar like screenshots */}
        <View
          style={{
            height: 90,
            paddingTop: 44,
            paddingHorizontal: 16,
            backgroundColor: '#1E88E5',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <TouchableOpacity onPress={() => setSelectedMonitoring(null)}>
            <Ionicons name="chevron-back" size={26} color="white" />
          </TouchableOpacity>

          <Text style={{ color: 'white', fontWeight: '800', letterSpacing: 1 }}>
            REPORTS
          </Text>

          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
          {/* EYE-LID */}
          {selectedMonitoring === 'eye' && (
            <>
              <ReportLineCard
                title="PERCLOS"
                subtitle="per day"
                date={reports.meta.date1}
                data={reports.perclos}
                yLabel="PERCLOS"
                threshold={0.30}
                thresholdLabel="Threshold"
              />
              <ReportLineCard
                title="PERCLOS"
                subtitle="per day"
                date={reports.meta.date2}
                data={reports.perclos.map((v) => Math.max(0.02, v - 0.03))}
                yLabel="PERCLOS"
                threshold={0.30}
                thresholdLabel="Threshold"
              />
            </>
          )}

          {/* HAND ON WHEEL */}
          {selectedMonitoring === 'steering' && (
            <>
              <ReportPieCard
                title="HAND ON WHEEL"
                subtitle="per day"
                date={reports.meta.date1}
                onPercent={reports.handOnWheel.on}
                offPercent={reports.handOnWheel.off}
              />
              <ReportPieCard
                title="HAND ON WHEEL"
                subtitle="per day"
                date={reports.meta.date2}
                onPercent={reports.handOnWheel.on}
                offPercent={reports.handOnWheel.off}
              />
            </>
          )}

          {/* YAWNING */}
          {selectedMonitoring === 'yawn' && (
            <>
              <ReportLineCard
                title="MAR"
                subtitle="per day"
                date={reports.meta.date1}
                data={reports.mar}
                yLabel="MAR"
                threshold={0.30}
                thresholdLabel="Detection Threshold"
                xLabel="Time (Seconds)"
              />
              <ReportLineCard
                title="MAR"
                subtitle="per day"
                date={reports.meta.date2}
                data={reports.mar.map((v, i) => Math.max(0.05, Math.min(0.78, v - (i > 80 ? 0.03 : 0))))}
                yLabel="MAR"
                threshold={0.30}
                thresholdLabel="Detection Threshold"
                xLabel="Time (Seconds)"
              />
            </>
          )}

          {/* HEAD NODDING */}
          {selectedMonitoring === 'nod' && (
            <>
              <ReportLineCard
                title="NODDING ANALYSIS"
                subtitle="per day"
                date={reports.meta.date1}
                data={reports.headPitch}
                yLabel="Head Pitch (Degrees)"
                threshold={headNodAnalysis.threshold}
                thresholdLabel="Drowsy threshold"
                xLabel="Time (Seconds)"
                yMin={0}
                yMax={60}
              />

              <View
                style={{
                  backgroundColor: 'white',
                  borderRadius: 14,
                  padding: 14,
                  marginTop: 12,
                  shadowColor: '#000',
                  shadowOpacity: 0.08,
                  shadowRadius: 10,
                }}
              >
                <Text style={{ fontWeight: '800', color: '#111827' }}>Head Nod Summary (demo)</Text>
                <Text style={{ color: '#6B7280', marginTop: 6, fontSize: 12 }}>
                  This is a frontend-only analysis derived from the displayed line graph.
                </Text>

                <View style={{ marginTop: 12 }}>
                  <RowStat label="Nod events detected" value={`${headNodAnalysis.events}`} />
                  <RowStat
                    label={`Time above ${headNodAnalysis.threshold}°`}
                    value={`${headNodAnalysis.totalAboveSeconds.toFixed(1)}s`}
                  />
                  <RowStat
                    label="Strongest nod duration"
                    value={
                      headNodAnalysis.strongest
                        ? `${headNodAnalysis.strongest.durationSec.toFixed(1)}s`
                        : '—'
                    }
                  />
                  <RowStat
                    label="Strongest nod peak angle"
                    value={
                      headNodAnalysis.strongest
                        ? `${headNodAnalysis.strongest.peakDeg.toFixed(0)}°`
                        : '—'
                    }
                  />
                  <RowStat
                    label="Strength label"
                    value={headNodAnalysis.strongest ? headNodAnalysis.strongest.strength : '—'}
                  />
                </View>

                <View
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: '#F3F4F6',
                  }}
                >
                  <Text style={{ fontWeight: '700', color: '#111827' }}>Interpretation (demo)</Text>
                  <Text style={{ color: '#374151', marginTop: 6, fontSize: 12, lineHeight: 18 }}>
                    A longer duration above the threshold suggests a more sustained head drop. A higher peak angle suggests
                    a stronger nod. This is a demo visualization, not a medical diagnosis.
                  </Text>
                </View>
              </View>

              <ReportLineCard
                title="NODDING ANALYSIS"
                subtitle="per day"
                date={reports.meta.date2}
                data={reports.headPitch.map((v, i) => Math.max(0, Math.min(60, v - (i > 110 ? 2 : 0))))}
                yLabel="Head Pitch (Degrees)"
                threshold={headNodAnalysis.threshold}
                thresholdLabel="Drowsy threshold"
                xLabel="Time (Seconds)"
                yMin={0}
                yMax={60}
              />
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  // ===========================
  // Main Dashboard (unchanged)
  // ===========================
  return (
    <View style={{ flex: 1, backgroundColor: '#1E88E5' }}>
      <TouchableOpacity
        onPress={() => setShowNotifications(true)}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 10,
        }}
      >
        <Feather name="bell" size={26} color="white" />
      </TouchableOpacity>

      <View style={{ alignItems: 'center', marginTop: 60, zIndex: 5 }}>
        <View
          style={{
            width: 100,
            height: 100,
            borderRadius: 65,
            backgroundColor: 'white',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            source={driverImage}
            style={{
              width: 110,
              height: 110,
              borderRadius: 55,
              borderWidth: 6,
              borderColor: currentAlert.color,
            }}
          />
        </View>
      </View>

      <View
        style={{
          flex: 1,
          backgroundColor: 'white',
          marginTop: -40,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          padding: 20,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#F3F4F6',
            padding: 14,
            borderRadius: 18,
            marginTop: 30,
            marginBottom: 20,
          }}
        >
          <Text style={{ fontWeight: '600', marginRight: 8 }}>CURRENT STATUS:</Text>
          <Text style={{ color: currentAlert.color, fontWeight: '700', flex: 1 }}>
            {currentAlert.status}
          </Text>
          <Ionicons name="alert-circle" size={20} color={currentAlert.color} />
        </View>

        {/* Recent Activity */}
        <Text style={{ fontWeight: '600', marginBottom: 10 }}>Recent Activity</Text>

        <TouchableOpacity
          onPress={() => setShowWarningDetails(true)}
          style={{
            backgroundColor: '#E5E5E5',
            borderRadius: 20,
            padding: 20,
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <Ionicons name="warning" size={50} color="#EF4444" />
          <Text style={{ color: '#EF4444', fontWeight: '700', marginTop: 10 }}>
            {getLevelText(currentAlert.level)}
          </Text>
          <Text style={{ fontSize: 12, color: '#555', marginTop: 4 }}>
            {currentAlert.date} {currentAlert.timestamp}
          </Text>
        </TouchableOpacity>

        {/* Monitoring Activity */}
        <Text style={{ fontWeight: '600', marginBottom: 12 }}>Monitoring Activity</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <MonitoringButton
            icon={<Ionicons name="eye" size={30} color="#38BDF8" />}
            label="EYE-LID MONITORING"
            onPress={() => setSelectedMonitoring('eye')}
          />
          <MonitoringButton
            icon={<MaterialCommunityIcons name="steering" size={30} color="#38BDF8" />}
            label="HAND ON STEERING WHEEL"
            onPress={() => setSelectedMonitoring('steering')}
          />
          <MonitoringButton
            icon={<Ionicons name="car-sport" size={30} color="#38BDF8" />}
            label="YAWNING"
            onPress={() => setSelectedMonitoring('yawn')}
          />
          {/* NEW BUTTON */}
          <MonitoringButton
            icon={<MaterialCommunityIcons name="head" size={30} color="#38BDF8" />}
            label="HEAD NODDING"
            onPress={() => setSelectedMonitoring('nod')}
          />
        </ScrollView>

        {/* Device Status */}
        <Text style={{ fontWeight: '600', marginTop: 18, marginBottom: 12 }}>
          Device Status
        </Text>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          {/* Device card */}
          <TouchableOpacity
            onPress={() => {
              if (connectedDevice) {
                setDeviceModalVisible(true);
              } else {
                openDeviceModal();
              }
            }}
            style={{
              flex: 1,
              backgroundColor: '#1E3A8A',
              borderRadius: 18,
              padding: 14,
              minHeight: 90,
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <MaterialCommunityIcons name="bluetooth" size={18} color="white" />
              <Text style={{ color: 'white', fontSize: 11, opacity: 0.9 }}>
                {connectedDevice ? 'Connected' : 'Not connected'}
              </Text>
            </View>

            <View>
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>
                {connectedDevice ? (connectedDevice.name || 'Device') : 'Find device'}
              </Text>

              <Text style={{ color: 'white', fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                {connectedDevice ? 'Device On' : 'Scan available device'}
              </Text>
            </View>

            <Text style={{ color: 'white', fontSize: 10, opacity: 0.75, textAlign: 'right' }}>
              {connectedDevice ? '3m' : ''}
            </Text>
          </TouchableOpacity>

          {/* Battery card */}
          <View
            style={{
              flex: 1,
              backgroundColor: '#1E3A8A',
              borderRadius: 18,
              padding: 14,
              minHeight: 90,
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Ionicons name="battery-half" size={18} color="white" />
              <Text style={{ color: 'white', fontSize: 11, opacity: 0.9 }}>
                {batteryPercent == null ? '' : `${batteryPercent}%`}
              </Text>
            </View>

            <View>
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Battery</Text>

              <Text style={{ color: 'white', fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                {batteryPercent == null ? '—' : 'Charged'}
              </Text>
            </View>

            <Text style={{ color: 'white', fontSize: 10, opacity: 0.75, textAlign: 'right' }}>
              {batteryPercent == null ? '' : '3m'}
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom nav */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          paddingVertical: 12,
          backgroundColor: 'white',
        }}
      >
        <NavItem icon="home" label="Home" onPress={() => onNavigate('dashboard')} active />
        <NavItem icon="clock" label="History" onPress={() => onNavigate('history')} />
        <NavItem icon="map-pin" label="Location" onPress={() => onNavigate('location')} />
        <NavItem icon="users" label="Contacts" onPress={() => onNavigate('contacts')} />
        <NavItem icon="menu" label="Menu" onPress={() => onNavigate('menu')} />
      </View>

      {/* Device modal */}
      <Modal visible={deviceModalVisible} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 18,
          }}
        >
          <View
            style={{
              width: '100%',
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 16,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
                Bluetooth Devices
              </Text>
              <Pressable onPress={closeDeviceModal}>
                <Ionicons name="close" size={22} color="#111827" />
              </Pressable>
            </View>

            <Text style={{ marginTop: 6, color: '#6B7280', fontSize: 12 }}>
              Demo connection flow (frontend only)
            </Text>

            {connectedDevice && scanState === 'connected' ? (
              <View
                style={{
                  marginTop: 14,
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: '#F3F4F6',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <MaterialCommunityIcons name="bluetooth-connect" size={22} color="#1E3A8A" />
                    <View>
                      <Text style={{ fontWeight: '800', color: '#111827' }}>
                        {connectedDevice.name}
                      </Text>
                      <Text style={{ color: '#6B7280', fontSize: 12 }}>
                        Connected • RSSI {connectedDevice.rssi}
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
                  style={{
                    marginTop: 12,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: '#EF4444',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '700' }}>Disconnect</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={{ marginTop: 14, flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    onPress={startScan}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: '#1E3A8A',
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
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      backgroundColor: '#E5E7EB',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#111827', fontWeight: '700' }}>Close</Text>
                  </Pressable>
                </View>

                <View style={{ marginTop: 14 }}>
                  {scanState === 'idle' && (
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
                            <MaterialCommunityIcons
                              name={selected ? 'bluetooth-connect' : 'bluetooth'}
                              size={20}
                              color="#1E3A8A"
                            />
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
                  disabled={!selectedDevice || scanState === 'scanning' || scanState === 'pairing'}
                  style={{
                    marginTop: 14,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor:
                      !selectedDevice || scanState === 'scanning' || scanState === 'pairing'
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
    </View>
  );
}

/* Monitoring cards */
function MonitoringButton({ icon, label, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: 150,
        height: 130,
        backgroundColor: '#1E3A8A',
        borderRadius: 20,
        marginRight: 14,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
      }}
    >
      {icon}
      <Text style={{ color: 'white', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* Bottom nav item */
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
        <Feather name={icon} size={18} color={active ? '#fff' : '#3B82F6'} />
      </View>
      <Text style={{ fontSize: 12, color: '#3B82F6', marginTop: 4 }}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ===========================
   Reports UI components
   =========================== */

function CardShell({ children }) {
  return (
    <View
      style={{
        backgroundColor: 'white',
        borderRadius: 14,
        padding: 14,
        marginBottom: 14,
        shadowColor: '#000',
        shadowOpacity: 0.10,
        shadowRadius: 10,
      }}
    >
      {children}
    </View>
  );
}

function HeaderRow({ title, subtitle, date }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <View>
        <Text style={{ fontWeight: '800', color: '#111827', fontSize: 12 }}>{title}</Text>
        <Text style={{ color: '#6B7280', fontSize: 11 }}>{subtitle}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontWeight: '800', color: '#111827', fontSize: 12 }}>DATE</Text>
        <Text style={{ color: '#6B7280', fontSize: 11 }}>{date}</Text>
      </View>
    </View>
  );
}

function ReportLineCard({
  title,
  subtitle,
  date,
  data,
  yLabel,
  xLabel,
  threshold,
  thresholdLabel,
  yMin,
  yMax,
}) {
  return (
    <CardShell>
      <HeaderRow title={title} subtitle={subtitle} date={date} />
      <View style={{ marginTop: 10 }}>
        <MiniLineChart
          data={data}
          height={140}
          threshold={threshold}
          yMin={yMin}
          yMax={yMax}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={{ fontSize: 10, color: '#6B7280' }}>{yLabel}</Text>
          <Text style={{ fontSize: 10, color: '#6B7280' }}>{xLabel || ''}</Text>
        </View>

        {typeof threshold === 'number' && (
          <Text style={{ fontSize: 10, color: '#6B7280', marginTop: 6 }}>
            {thresholdLabel || 'Threshold'}: {threshold}
          </Text>
        )}
      </View>
    </CardShell>
  );
}

function ReportPieCard({ title, subtitle, date, onPercent, offPercent }) {
  return (
    <CardShell>
      <HeaderRow title={title} subtitle={subtitle} date={date} />
      <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <MiniPieChart onPercent={onPercent} offPercent={offPercent} size={120} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <LegendRow label="Hand on wheel" value={`${onPercent}%`} dot />
          <LegendRow label="No grip" value={`${offPercent}%`} dot light />
        </View>
      </View>
    </CardShell>
  );
}

function LegendRow({ label, value, dot, light }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      {dot && (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            marginRight: 8,
            backgroundColor: light ? '#CBD5E1' : '#1E3A8A',
          }}
        />
      )}
      <Text style={{ color: '#111827', fontSize: 12, flex: 1 }}>{label}</Text>
      <Text style={{ color: '#111827', fontWeight: '700', fontSize: 12 }}>{value}</Text>
    </View>
  );
}

function RowStat({ label, value }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
      <Text style={{ color: '#6B7280', fontSize: 12 }}>{label}</Text>
      <Text style={{ color: '#111827', fontWeight: '800', fontSize: 12 }}>{value}</Text>
    </View>
  );
}

/* ===========================
   Mini charts (SVG)
   =========================== */

function MiniLineChart({ data, height = 120, threshold, yMin, yMax }) {
  const width = 320; // fixed works well in cards
  const pad = 18;

  const minVal = typeof yMin === 'number' ? yMin : Math.min(...data);
  const maxVal = typeof yMax === 'number' ? yMax : Math.max(...data);

  const scaleX = (i) => pad + (i * (width - pad * 2)) / Math.max(1, data.length - 1);
  const scaleY = (v) => {
    const t = (v - minVal) / Math.max(0.0001, maxVal - minVal);
    return height - pad - t * (height - pad * 2);
  };

  const d = data
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(2)} ${scaleY(v).toFixed(2)}`)
    .join(' ');

  // threshold line
  const threshY =
    typeof threshold === 'number'
      ? scaleY(Math.max(minVal, Math.min(maxVal, threshold)))
      : null;

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* axis-ish lines */}
      <Line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#111827" strokeWidth="1" />
      <Line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#111827" strokeWidth="1" />

      {typeof threshY === 'number' && (
        <Line
          x1={pad}
          y1={threshY}
          x2={width - pad}
          y2={threshY}
          stroke="#EF4444"
          strokeWidth="1.5"
          strokeDasharray="6 6"
        />
      )}

      {/* path */}
      <Path d={d} fill="none" stroke="#1E3A8A" strokeWidth="2.5" />

      {/* last point */}
      <Circle
        cx={scaleX(data.length - 1)}
        cy={scaleY(data[data.length - 1])}
        r="4.5"
        fill="#1E3A8A"
      />
    </Svg>
  );
}

function MiniPieChart({ onPercent, offPercent, size = 120 }) {
  // Basic pie using two arcs
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;

  const total = Math.max(1, onPercent + offPercent);
  const onAngle = (onPercent / total) * Math.PI * 2;

  const polar = (angle) => ({
    x: cx + r * Math.cos(angle - Math.PI / 2),
    y: cy + r * Math.sin(angle - Math.PI / 2),
  });

  const arcPath = (startAngle, endAngle) => {
    const start = polar(startAngle);
    const end = polar(endAngle);
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`;
  };

  const onPath = arcPath(0, onAngle);
  const offPath = arcPath(onAngle, Math.PI * 2);

  return (
    <Svg width={size} height={size}>
      <G>
        <Path d={offPath} fill="#CBD5E1" />
        <Path d={onPath} fill="#1E3A8A" />
      </G>
    </Svg>
  );
}
