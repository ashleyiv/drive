import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import Svg, { Path, Line, Circle, G, Rect } from 'react-native-svg';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import BottomNav from './BottomNav';

const LEVEL_UI = {
  1: { label: 'LEVEL 1 WARNING', color: '#16A34A', boxTitle: 'CAUTION', boxBg: '#ECFDF5', boxBorder: '#BBF7D0' },
  2: { label: 'LEVEL 2 WARNING', color: '#F59E0B', boxTitle: 'ALERT', boxBg: '#FFFBEB', boxBorder: '#FDE68A' },
  3: { label: 'LEVEL 3 WARNING', color: '#EF4444', boxTitle: 'DANGER', boxBg: '#FEE2E2', boxBorder: '#FCA5A5' },
};

const TYPE_UI = {
  eye:  { title: 'PERCLOS', subtitle: 'per day' },
  hand: { title: 'HAND ON WHEEL', subtitle: 'per day' },
  yawn: { title: 'MAR', subtitle: 'per day' },
  nod:  { title: 'NODDING ANALYSIS', subtitle: 'per day' },
};

function formatDateLabel(dayStr) {
  // dayStr is YYYY-MM-DD
  const d = new Date(dayStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return { date, time };
}


export default function History({ onNavigate, navParams, clearNavParams }) {
  const [activeTab, setActiveTab] = useState('warnings'); // warnings | monitoring
const autoOpenedRef = React.useRef(false);
  // warnings
  const [loadingWarnings, setLoadingWarnings] = useState(true);
  const [warnings, setWarnings] = useState([]);

  // modals
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedWarning, setSelectedWarning] = useState(null);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [reportsType, setReportsType] = useState(null);

  // reports data
  const [loadingReports, setLoadingReports] = useState(false);
  const [dailyRows, setDailyRows] = useState([]); // monitoring_daily rows
useEffect(() => {
  const openId = navParams?.openWarningId;
  if (!openId) return;
  if (autoOpenedRef.current) return;

  const found = (warnings || []).find((w) => w.id === openId);
  if (!found) return;

  autoOpenedRef.current = true;

  // ✅ Ensure the screen is on warnings tab (optional, but nice)
  setActiveTab('warnings');

  // ✅ Enrich it so modal won't crash (needs .ui)
  const ui = LEVEL_UI[found.level] || LEVEL_UI[1];
  const { date, time } = formatDateTime(found.created_at);
  setSelectedWarning({ ...found, ui, date, time });

  setDetailsOpen(true);

  clearNavParams?.();
}, [navParams, warnings, clearNavParams]);


  // Load warnings (DB)
  useEffect(() => {
    let channel;

    const loadWarnings = async () => {
      try {
        setLoadingWarnings(true);
        const { data: uRes, error: uErr } = await supabase.auth.getUser();
        if (uErr) throw uErr;
        const userId = uRes?.user?.id;
        if (!userId) {
          setWarnings([]);
          return;
        }

       const { data, error } = await supabase
  .from('driver_warnings')
  .select('id, created_at, level, monitor_type, location_text, snapshot_url, meta')
  .eq('user_id', userId) // ✅ only mine
  .order('created_at', { ascending: false })
  .limit(100);

        if (error) throw error;
        setWarnings(data || []);

        // Realtime-ready (future IoT inserts)
        channel = supabase
          .channel(`dw_${userId}`)
          .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'driver_warnings', filter: `user_id=eq.${userId}` },
            () => loadWarnings()
          )
          .subscribe();

      } catch (e) {
        console.log('loadWarnings error', e);
        setWarnings([]);
      } finally {
        setLoadingWarnings(false);
      }
    };

    loadWarnings();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const warningCards = useMemo(() => {
    return (warnings || []).map((w) => {
      const ui = LEVEL_UI[w.level] || LEVEL_UI[1];
      const { date, time } = formatDateTime(w.created_at);
      return { ...w, ui, date, time };
    });
  }, [warnings]);

  // Open warning details (no navigation = no white screen)
  const openDetails = (w) => {
    setSelectedWarning(w);
    setDetailsOpen(true);
  };

  // Open Reports (load monitoring_daily Jan 5–11)
  const openReports = async (type) => {
    setReportsType(type);
    setReportsOpen(true);
    setLoadingReports(true);

    try {
      const { data: uRes, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      const userId = uRes?.user?.id;
      if (!userId) {
        setDailyRows([]);
        return;
      }

      // Pull seeded range Jan 5–11, 2026
      const { data, error } = await supabase
        .from('monitoring_daily')
        .select('*')
        .eq('user_id', userId)
        .gte('day', '2026-01-05')
        .lte('day', '2026-01-11')
        .order('day', { ascending: false });

      if (error) throw error;
      setDailyRows(data || []);
    } catch (e) {
      console.log('openReports load error', e);
      setDailyRows([]);
    } finally {
      setLoadingReports(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        <Text style={styles.headerSub}>See your latest activities</Text>

        <View style={styles.tabsWrap}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'warnings' && styles.tabBtnActive]}
            onPress={() => setActiveTab('warnings')}
          >
            <Text style={[styles.tabText, activeTab === 'warnings' && styles.tabTextActive]}>
              Warning Notifications
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'monitoring' && styles.tabBtnActive]}
            onPress={() => setActiveTab('monitoring')}
          >
            <Text style={[styles.tabText, activeTab === 'monitoring' && styles.tabTextActive]}>
              Monitoring Activity
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {activeTab === 'warnings' ? (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 110 }}>
          {loadingWarnings ? (
            <View style={{ paddingTop: 20 }}>
              <ActivityIndicator />
              <Text style={{ textAlign: 'center', marginTop: 10, color: '#6B7280' }}>
                Loading warnings…
              </Text>
            </View>
          ) : (
            warningCards.map((w) => (
              <TouchableOpacity key={w.id} style={styles.warningCard} onPress={() => openDetails(w)} activeOpacity={0.85}>
                <Image source={{ uri: w.snapshot_url }} style={styles.warningImage} resizeMode="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.warningDate}>{w.date}</Text>
                  <Text style={[styles.warningLevel, { color: w.ui.color }]}>{w.ui.label}</Text>
                  <Text style={styles.warningLoc}>{w.location_text || '—'}</Text>
                  <Text style={styles.warningTime}>{w.time}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 110 }}>
          <View style={styles.grid}>
            <Tile
              title="EYE-LID MONITORING"
              sub="Monitor the behavior of your eyes while driving."
              icon={<Feather name="eye" size={26} color="#1E3A8A" />}
              onPress={() => openReports('eye')}
            />
            <Tile
              title="HAND ON STEERING WHEEL"
              sub="Monitor if your hands are on the steering wheel while driving."
              icon={<MaterialCommunityIcons name="steering" size={28} color="#1E3A8A" />}
              onPress={() => openReports('hand')}
            />
            <Tile
              title="YAWNING MONITORING"
              sub="Monitor your yawns and how frequent it is."
              icon={<MaterialCommunityIcons name="sleep" size={28} color="#1E3A8A" />}
              onPress={() => openReports('yawn')}
            />
            <Tile
              title="HEAD NODDING"
              sub="Monitor the behavior of your head while driving."
              icon={<MaterialCommunityIcons name="head" size={28} color="#1E3A8A" />}
              onPress={() => openReports('nod')}
            />
          </View>
        </ScrollView>
      )}

     {/* Bottom nav (centralized) */}
<BottomNav
  variant="driver"
  activeKey="history"
  onNavigate={onNavigate}
/>

      {/* =========================
          DETAILS MODAL (fixes white screen)
         ========================= */}
      <Modal visible={detailsOpen} animationType="slide" onRequestClose={() => setDetailsOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setDetailsOpen(false)} style={styles.backBtn}>
              <Feather name="chevron-left" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>History Details</Text>
            <View style={{ width: 40 }} />
          </View>

          {!selectedWarning ? (
            <View style={{ padding: 20 }}><ActivityIndicator /></View>
          ) : (
            <View style={styles.detailCard}>
              <Text style={[styles.detailLevel, { color: selectedWarning.ui.color }]}>
                {selectedWarning.ui.label}
              </Text>

              <Image source={{ uri: selectedWarning.snapshot_url }} style={styles.detailImage} resizeMode="cover" />

              <View style={[
                styles.detailBox,
                { backgroundColor: selectedWarning.ui.boxBg, borderColor: selectedWarning.ui.boxBorder }
              ]}>
                <Text style={[styles.detailBoxTitle, { color: selectedWarning.ui.color }]}>
                  {selectedWarning.ui.boxTitle}
                </Text>

                {selectedWarning.level === 3 ? (
                  <>
                    <Text style={styles.detailLine}>Immediate attention required</Text>
                    <Text style={styles.detailLine}>
                      Top Speed: <Text style={styles.bold}>{selectedWarning?.meta?.top_speed_mph ?? '—'} mph</Text>
                    </Text>
                    <Text style={styles.detailLine}>
                      Location: <Text style={styles.bold}>{selectedWarning?.meta?.detail_location ?? selectedWarning.location_text ?? '—'}</Text>
                    </Text>
                  </>
                ) : selectedWarning.level === 2 ? (
                  <>
                    <Text style={styles.detailLine}>Alarm + voice output triggered (hardware scope)</Text>
                    <Text style={styles.detailLine}>
                      Location: <Text style={styles.bold}>{selectedWarning.location_text ?? '—'}</Text>
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.detailLine}>Snapshot captured + voice output (hardware scope)</Text>
                    <Text style={styles.detailLine}>
                      Location: <Text style={styles.bold}>{selectedWarning.location_text ?? '—'}</Text>
                    </Text>
                  </>
                )}
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* =========================
          REPORTS MODAL (exact REPORTS layout)
         ========================= */}
      <Modal visible={reportsOpen} animationType="slide" onRequestClose={() => setReportsOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setReportsOpen(false)} style={styles.backBtn}>
              <Feather name="chevron-left" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>REPORTS</Text>
            <View style={{ width: 40 }} />
          </View>

          {loadingReports ? (
            <View style={{ padding: 20 }}><ActivityIndicator /></View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }}>
              {(dailyRows || []).map((row) => (
                <ReportCard key={row.id} type={reportsType} row={row} />
              ))}
              {(!dailyRows || dailyRows.length === 0) && (
                <View style={{ padding: 20 }}>
                  <Text style={{ color: '#6B7280', textAlign: 'center' }}>
                    No monitoring data found for Jan 5–11, 2026.
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

/* ---------- Tiles (Monitoring Activity) ---------- */
function Tile({ title, sub, icon, onPress }) {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.9}>
      <View style={{ alignItems: 'center' }}>
        <View style={styles.tileIconWrap}>{icon}</View>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileSub}>{sub}</Text>
      </View>
      <View style={{ alignItems: 'center', marginTop: 10 }}>
        <Feather name="chevron-right" size={18} color="#6B7280" />
      </View>
    </TouchableOpacity>
  );
}

/* ---------- Bottom nav ---------- */
function NavItem({ icon, label, onPress, active }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={active} style={{ alignItems: 'center' }}>
      <View style={[styles.navIcon, active && styles.navIconActive]}>
        <Feather name={icon} size={18} color={active ? '#fff' : '#1D4ED8'} />
      </View>
      <Text style={[styles.navLabel, { color: active ? '#1D4ED8' : '#6B7280' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ---------- REPORT CARD (matches screenshot layout) ---------- */
function ReportCard({ type, row }) {
  const ui = TYPE_UI[type] || TYPE_UI.eye;
  const dateLabel = formatDateLabel(row.day);

  const perclos = Array.isArray(row.perclos_series) ? row.perclos_series.map(Number) : [];
  const mar = Array.isArray(row.mar_series) ? row.mar_series.map(Number) : [];
  const head = Array.isArray(row.head_pitch_series) ? row.head_pitch_series.map(Number) : [];
  const hand = row.hand_on_wheel && typeof row.hand_on_wheel === 'object' ? row.hand_on_wheel : {};

  return (
    <View style={styles.reportCard}>
      <View style={styles.reportHeaderRow}>
        <View>
          <Text style={styles.reportTitle}>{ui.title}</Text>
          <Text style={styles.reportSub}>{ui.subtitle}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.reportDateLabel}>DATE</Text>
          <Text style={styles.reportDateValue}>{dateLabel}</Text>
        </View>
      </View>

      <View style={{ marginTop: 10 }}>
        {type === 'hand' ? (
          <View style={{ alignItems: 'center' }}>
            <MiniPieChart
              onPercent={Number(hand.on ?? 0)}
              offPercent={Number(hand.off ?? 0)}
              size={170}
            />
            <View style={{ flexDirection: 'row', marginTop: 10, gap: 18 }}>
              <LegendDot label="Hand on wheel" />
              <LegendDot label="No grip" light />
            </View>
          </View>
        ) : type === 'yawn' ? (
          <MiniLineChartDetailed data={mar} height={140} threshold={0.30} />
        ) : type === 'nod' ? (
          <MiniLineChartDetailed data={head} height={140} threshold={25} yMin={0} yMax={60} shade />
        ) : (
          <MiniLineChart data={perclos} height={140} />
        )}
      </View>
    </View>
  );
}

function LegendDot({ label, light }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: light ? '#CBD5E1' : '#1E3A8A',
      }} />
      <Text style={{ fontSize: 11, color: '#374151' }}>{label}</Text>
    </View>
  );
}

/* ---------- Charts ---------- */
function MiniLineChart({ data, height = 120 }) {
  const width = 320;
  const pad = 18;
  const safe = (Array.isArray(data) && data.length > 0) ? data : [0, 0, 0];

  const minVal = Math.min(...safe);
  const maxVal = Math.max(...safe);

  const scaleX = (i) => pad + (i * (width - pad * 2)) / Math.max(1, safe.length - 1);
  const scaleY = (v) => {
    const t = (v - minVal) / Math.max(0.0001, maxVal - minVal);
    return height - pad - t * (height - pad * 2);
  };

  const d = safe
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(2)} ${scaleY(v).toFixed(2)}`)
    .join(' ');

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#111827" strokeWidth="1" />
      <Line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#111827" strokeWidth="1" />
      <Path d={d} fill="none" stroke="#1E3A8A" strokeWidth="2.5" />
      <Circle cx={scaleX(safe.length - 1)} cy={scaleY(safe[safe.length - 1])} r="4.5" fill="#1E3A8A" />
    </Svg>
  );
}

function MiniLineChartDetailed({ data, height = 140, threshold, yMin, yMax, shade }) {
  const width = 320;
  const pad = 18;
  const safe = (Array.isArray(data) && data.length > 0) ? data : [0, 0, 0];

  const minVal = typeof yMin === 'number' ? yMin : Math.min(...safe);
  const maxVal = typeof yMax === 'number' ? yMax : Math.max(...safe);

  const scaleX = (i) => pad + (i * (width - pad * 2)) / Math.max(1, safe.length - 1);
  const scaleY = (v) => {
    const t = (v - minVal) / Math.max(0.0001, maxVal - minVal);
    return height - pad - t * (height - pad * 2);
  };

  const d = safe
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(2)} ${scaleY(v).toFixed(2)}`)
    .join(' ');

  const threshY = typeof threshold === 'number'
    ? scaleY(Math.max(minVal, Math.min(maxVal, threshold)))
    : null;

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* optional shading like your nodding screenshot */}
      {shade && (
        <>
          <Rect x={pad} y={pad} width={width - pad * 2} height={(height - pad * 2) * 0.55} fill="#FEE2E2" opacity="0.55" />
          <Rect x={pad} y={pad + (height - pad * 2) * 0.55} width={width - pad * 2} height={(height - pad * 2) * 0.45} fill="#DBEAFE" opacity="0.55" />
        </>
      )}

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

      <Path d={d} fill="none" stroke="#1E3A8A" strokeWidth="2.5" />
      <Circle cx={scaleX(safe.length - 1)} cy={scaleY(safe[safe.length - 1])} r="4.5" fill="#1E3A8A" />
    </Svg>
  );
}

function MiniPieChart({ onPercent, offPercent, size = 160 }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;

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

/* ---------- Styles (matches your screenshots closely) ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },

  header: {
    backgroundColor: '#1F7CC0',
    paddingTop: 46,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.85)', marginTop: 2, fontSize: 12 },

  tabsWrap: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    flexDirection: 'row',
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: '#0B2E63' },
  tabText: { fontSize: 11, fontWeight: '700', color: '#0B2E63' },
  tabTextActive: { color: '#fff' },

  warningCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 10,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  warningImage: { width: 86, height: 70, borderRadius: 12, backgroundColor: '#E5E7EB' },
  warningDate: { fontSize: 11, color: '#111827', marginBottom: 2 },
  warningLevel: { fontSize: 12, fontWeight: '900', marginBottom: 2 },
  warningLoc: { fontSize: 11, color: '#374151' },
  warningTime: { fontSize: 11, color: '#6B7280', marginTop: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  tile: {
    width: '48%',
    backgroundColor: '#E5E7EB',
    borderRadius: 14,
    padding: 14,
    minHeight: 165,
    justifyContent: 'space-between',
  },
  tileIconWrap: {
    width: 58, height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  tileTitle: { textAlign: 'center', fontWeight: '900', fontSize: 11, color: '#111827' },
  tileSub: { textAlign: 'center', fontSize: 10, color: '#4B5563', marginTop: 6, lineHeight: 14 },

  bottomNav: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff',
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  navIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  navIconActive: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  navLabel: { fontSize: 11, marginTop: 4, fontWeight: '700' },

  modalHeader: {
    backgroundColor: '#1F7CC0',
    paddingTop: 46,
    paddingHorizontal: 12,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  modalHeaderTitle: { color: '#fff', fontSize: 18, fontWeight: '900', flex: 1, textAlign: 'center' },

  detailCard: {
    margin: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  detailLevel: { fontSize: 14, fontWeight: '900', marginBottom: 10 },
  detailImage: { width: '100%', height: 190, borderRadius: 14, backgroundColor: '#E5E7EB' },
  detailBox: { marginTop: 12, borderRadius: 14, padding: 12, borderWidth: 1 },
  detailBoxTitle: { fontWeight: '900', marginBottom: 6 },
  detailLine: { color: '#111827', fontSize: 12, marginBottom: 4 },
  bold: { fontWeight: '900' },

  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  reportHeaderRow: { flexDirection: 'row', justifyContent: 'space-between' },
  reportTitle: { fontWeight: '900', fontSize: 12, color: '#111827' },
  reportSub: { fontSize: 11, color: '#6B7280' },
  reportDateLabel: { fontWeight: '900', fontSize: 12, color: '#111827' },
  reportDateValue: { fontSize: 11, color: '#6B7280' },
});
