// driveash/screens/ConnectedAccountsScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
  StatusBar,
  Platform,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { Feather, Entypo } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { resolveAvatarUrl } from '../lib/avatar';
import useTheme from '../theme/useTheme';

function displayNameFromProfile(p) {
  const first = String(p?.first_name || '').trim();
  const last = String(p?.last_name || '').trim();
  const full = `${first}${first && last ? ' ' : ''}${last}`.trim();
  return full || String(p?.email || 'Driver');
}

function ymd(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseYMD(s) {
  const str = String(s || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const dt = new Date(`${str}T00:00:00.000Z`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}
function presetLabel(preset) {
  if (preset === '7d') return 'Last 7 days';
  if (preset === '30d') return 'Last 30 days';
  return 'All time';
}

function buildRangeFromFilter(filter) {
  const preset = filter?.preset || '30d';

  if (preset === 'all') {
    return { preset, startStr: '', endStr: '', startISO: null, endISO: null, valid: true, label: 'All time' };
  }

  const startStr = String(filter?.startStr || '').trim();
  const endStr = String(filter?.endStr || '').trim();

  const s = parseYMD(startStr);
  const e = parseYMD(endStr);
  if (!s || !e) {
    return { preset, startStr, endStr, startISO: null, endISO: null, valid: false, label: 'Invalid range' };
  }

  const startISO = new Date(`${startStr}T00:00:00.000Z`).toISOString();
  const endISO = new Date(`${endStr}T23:59:59.999Z`).toISOString();
  return { preset, startStr, endStr, startISO, endISO, valid: true, label: `${startStr} → ${endStr}` };
}

function prettyType(monitorType) {
  const t = String(monitorType || '').toLowerCase();
  if (t === 'eye') return 'Eye Warning';
  if (t === 'hand') return 'Hand Warning';
  if (t === 'yawn') return 'Yawn Warning';
  if (t === 'nod') return 'Nod Warning';
  return monitorType ? String(monitorType) : 'Warning';
}

function formatTS(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function makePresetFilter(preset) {
  const now = new Date();
  if (preset === '7d') {
    const end = new Date(now);
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { preset: '7d', startStr: ymd(start), endStr: ymd(end) };
  }
  if (preset === '30d') {
    const end = new Date(now);
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    return { preset: '30d', startStr: ymd(start), endStr: ymd(end) };
  }
  if (preset === 'all') {
    return { preset: 'all', startStr: '', endStr: '' };
  }
  return makePresetFilter('30d');
}

export default function ConnectedAccountsScreen({ onNavigate }) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);

  // search stays global
  const [search, setSearch] = useState('');

  // ✅ per-driver filters inside each card
  // { [driverId]: { preset, startStr, endStr } }
  const [filtersByDriverId, setFiltersByDriverId] = useState({});

  // ✅ per-driver summary for card (Warnings: X + Latest)
  // { [driverId]: { count, latestType, latestAt } }
  const [summaryByDriver, setSummaryByDriver] = useState({});

  // actions (disconnect)
  const [actionOpen, setActionOpen] = useState(false);
  const [selected, setSelected] = useState(null);

 const [driverModalOpen, setDriverModalOpen] = useState(false);
const [activeDriver, setActiveDriver] = useState(null);

// ✅ modal filter state (shown above Total warnings)
const [modalFilter, setModalFilter] = useState(makePresetFilter('30d'));
const [activeRange, setActiveRange] = useState(buildRangeFromFilter(makePresetFilter('30d')));


  // records (for the active driver modal)
  const PAGE_SIZE = 50;
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [recordsPage, setRecordsPage] = useState(0);
  const [hasMoreRecords, setHasMoreRecords] = useState(false);
  const [recordsTotalCount, setRecordsTotalCount] = useState(null);
  const [latestRecord, setLatestRecord] = useState(null);

  // record modal
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const topPad =
    Platform.OS === 'android'
      ? (StatusBar.currentHeight || 0) + 6
      : 18;

  const loadConnectedDrivers = async () => {
    try {
      setLoading(true);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const me = userRes?.user;
      if (!me?.id) {
        setAccounts([]);
        return;
      }

      const { data: links, error: linkErr } = await supabase
        .from('emergency_contact_requests')
        .select('id, requester_id, target_id, status, created_at')
        .eq('target_id', me.id)
        .eq('status', 'accepted')
        .order('created_at', { ascending: false });

      if (linkErr) throw linkErr;

      const driverIds = Array.from(
        new Set((links || []).map((r) => r.requester_id).filter(Boolean).map(String))
      );

      if (driverIds.length === 0) {
        setAccounts([]);
        return;
      }

      const { data: profs, error: profErr } = await supabase
        .from('user_profiles')
        .select('id,email,first_name,last_name,avatar_url')
        .in('id', driverIds);

      if (profErr) throw profErr;

      const profById = {};
      (profs || []).forEach((p) => (profById[String(p.id)] = p));

      const mapped = driverIds.map((uid) => {
        const p = profById[String(uid)] || null;
        const name = displayNameFromProfile(p);
        const email = String(p?.email || '—');

        const avatarResolved = resolveAvatarUrl(p?.avatar_url);
        const avatarUri = typeof avatarResolved === 'string' ? avatarResolved : null;

        const linkRow = (links || []).find((l) => String(l.requester_id) === String(uid)) || null;

        return {
          id: String(uid),
          link_id: linkRow?.id ?? null,
          name,
          email,
          avatarUri,
        };
      });

      setAccounts(mapped);
    } catch (e) {
      console.log('[ConnectedAccountsScreen] loadConnectedDrivers error:', e);
      Alert.alert('Error', 'Failed to load connected drivers.');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ exact count + latest for a single driver + its own filter
  const loadDriverSummary = async (driverId, filter) => {
    try {
      const range = buildRangeFromFilter(filter);
      if (range.preset !== 'all' && !range.valid) {
        setSummaryByDriver((prev) => ({
          ...prev,
          [driverId]: { count: 0, latestType: null, latestAt: null, invalid: true },
        }));
        return;
      }

      // exact count
      let countQ = supabase
        .from('driver_warnings')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', driverId);

      if (range.startISO) countQ = countQ.gte('created_at', range.startISO);
      if (range.endISO) countQ = countQ.lte('created_at', range.endISO);

      const { count, error: countErr } = await countQ;
      if (countErr) throw countErr;

      // latest
      let latestQ = supabase
        .from('driver_warnings')
        .select('created_at, monitor_type')
        .eq('user_id', driverId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (range.startISO) latestQ = latestQ.gte('created_at', range.startISO);
      if (range.endISO) latestQ = latestQ.lte('created_at', range.endISO);

      const { data: latestRows, error: latestErr } = await latestQ;
      if (latestErr) throw latestErr;

      const row = (latestRows || [])[0] || null;

      setSummaryByDriver((prev) => ({
        ...prev,
        [driverId]: {
          count: count ?? 0,
          latestType: row?.monitor_type || null,
          latestAt: row?.created_at || null,
          invalid: false,
        },
      }));
    } catch (e) {
      console.log('[ConnectedAccountsScreen] loadDriverSummary error:', e);
      // don't block UI
      setSummaryByDriver((prev) => ({
        ...prev,
        [driverId]: { count: 0, latestType: null, latestAt: null, invalid: false, error: true },
      }));
    }
  };

  const openActions = (item) => {
    setSelected(item);
    setActionOpen(true);
  };

  const closeActions = () => {
    setActionOpen(false);
    setSelected(null);
  };

  const disconnectSelected = async () => {
    try {
      if (!selected?.id) return;

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const me = userRes?.user;
      if (!me?.id) return;

      closeActions();

      const { error } = await supabase
        .from('emergency_contact_requests')
        .update({
          status: 'cancelled',
          responded_at: new Date().toISOString(),
        })
        .eq('target_id', me.id)
        .eq('requester_id', selected.id)
        .eq('status', 'accepted');

      if (error) throw error;

      Alert.alert('Disconnected', `${selected.name} has been disconnected.`);

      // cleanup local states for that driver
      setFiltersByDriverId((prev) => {
        const next = { ...prev };
        delete next[selected.id];
        return next;
      });
      setSummaryByDriver((prev) => {
        const next = { ...prev };
        delete next[selected.id];
        return next;
      });

      await loadConnectedDrivers();
    } catch (e) {
      console.log('[ConnectedAccountsScreen] disconnect error:', e);
      Alert.alert('Error', e?.message || 'Failed to disconnect.');
    }
  };

  // big picture + pagination for the modal (range comes from active driver filter)
  const loadDriverRecords = async (driverId, range, { page = 0, append = false } = {}) => {
    try {
      setRecordsLoading(true);

      if (!driverId) return;
      if (range?.preset !== 'all' && !range?.valid) return;

      // exact count
      let countQ = supabase
        .from('driver_warnings')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', driverId);

      if (range?.startISO) countQ = countQ.gte('created_at', range.startISO);
      if (range?.endISO) countQ = countQ.lte('created_at', range.endISO);

      const { count, error: countErr } = await countQ;
      if (countErr) throw countErr;
      setRecordsTotalCount(count ?? 0);

      // paginated rows
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = supabase
        .from('driver_warnings')
        .select('id, created_at, level, monitor_type, location_text, snapshot_url, meta')
        .eq('user_id', driverId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (range?.startISO) q = q.gte('created_at', range.startISO);
      if (range?.endISO) q = q.lte('created_at', range.endISO);

      const { data, error } = await q;
      if (error) throw error;

      const rows = data || [];
      if (page === 0) setLatestRecord(rows[0] || null);

      setHasMoreRecords(rows.length === PAGE_SIZE);
      setRecordsPage(page);

      if (append) setRecords((prev) => [...prev, ...rows]);
      else setRecords(rows);
    } catch (e) {
      console.log('[ConnectedAccountsScreen] loadDriverRecords error:', e);
      Alert.alert('Error', 'Failed to load records for this driver.');
      setRecords([]);
      setHasMoreRecords(false);
      setRecordsTotalCount(null);
      setLatestRecord(null);
    } finally {
      setRecordsLoading(false);
    }
  };

  const openDriverHistoryModal = async (item) => {
    if (!item?.id) return;

 const filter = filtersByDriverId[item.id] || makePresetFilter('30d');
const range = buildRangeFromFilter(filter);

setActiveDriver(item);
setModalFilter(filter);
setActiveRange(range);
setDriverModalOpen(true);


    setRecords([]);
    setRecordsTotalCount(null);
    setLatestRecord(null);
    setHasMoreRecords(false);
    setRecordsPage(0);

    await loadDriverRecords(item.id, range, { page: 0, append: false });
  };
// ✅ Modal date filter actions
const applyModalPreset = async (preset) => {
  // IMPORTANT: even when preset is "all", inputs remain editable now
  const next = makePresetFilter(preset);
  setModalFilter(next);

  const range = buildRangeFromFilter(next);
  setActiveRange(range);

  if (activeDriver?.id && (range.preset === 'all' || range.valid)) {
    // Save it for this driver
    setFiltersByDriverId((prev) => ({ ...prev, [activeDriver.id]: next }));
    await loadDriverSummary(activeDriver.id, next);
    await loadDriverRecords(activeDriver.id, range, { page: 0, append: false });
  }
};

const onModalChangeStart = async (t) => {
  const next = { ...modalFilter, preset: 'custom', startStr: t };
  setModalFilter(next);

  const range = buildRangeFromFilter(next);
  setActiveRange(range);

  if (activeDriver?.id && (range.preset === 'all' || range.valid)) {
    setFiltersByDriverId((prev) => ({ ...prev, [activeDriver.id]: next }));
    await loadDriverSummary(activeDriver.id, next);
    await loadDriverRecords(activeDriver.id, range, { page: 0, append: false });
  }
};

const onModalChangeEnd = async (t) => {
  const next = { ...modalFilter, preset: 'custom', endStr: t };
  setModalFilter(next);

  const range = buildRangeFromFilter(next);
  setActiveRange(range);

  if (activeDriver?.id && (range.preset === 'all' || range.valid)) {
    setFiltersByDriverId((prev) => ({ ...prev, [activeDriver.id]: next }));
    await loadDriverSummary(activeDriver.id, next);
    await loadDriverRecords(activeDriver.id, range, { page: 0, append: false });
  }
};

  const closeDriverHistoryModal = () => {
    setDriverModalOpen(false);
    setActiveDriver(null);
    setActiveRange({ valid: true, label: 'All time', startISO: null, endISO: null, preset: 'all' });
    setRecords([]);
    setRecordsTotalCount(null);
    setLatestRecord(null);
    setHasMoreRecords(false);
    setRecordsPage(0);
  };

  const openRecord = (w) => {
    setSelectedRecord(w);
    setRecordModalOpen(true);
  };

  const closeRecord = () => {
    setRecordModalOpen(false);
    setSelectedRecord(null);
  };

  // init + ensure each driver has its own default filter (and load its summary)
  useEffect(() => {
    loadConnectedDrivers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!accounts || accounts.length === 0) return;

    setFiltersByDriverId((prev) => {
      const next = { ...prev };
      let changed = false;

      for (const a of accounts) {
        if (!next[a.id]) {
          next[a.id] = makePresetFilter('30d');
          changed = true;
        }
      }

      // also remove filters for drivers no longer present
      const ids = new Set(accounts.map((a) => a.id));
      for (const key of Object.keys(next)) {
        if (!ids.has(key)) {
          delete next[key];
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [accounts]);

  // whenever filtersByDriverId changes for a driver, we do NOT auto-loop fetch for all drivers (expensive).
  // We fetch summary only when we set/update a driver's filter via handlers below.

  const filteredAccounts = useMemo(() => {
    const q = String(search || '').trim().toLowerCase();
    if (!q) return accounts;

    return (accounts || []).filter((a) => {
      const name = String(a?.name || '').toLowerCase();
      const email = String(a?.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [accounts, search]);

  // per-driver filter handlers
  const setDriverPreset = async (driverId, preset) => {
    const newFilter = makePresetFilter(preset);

    setFiltersByDriverId((prev) => ({
      ...prev,
      [driverId]: newFilter,
    }));

    await loadDriverSummary(driverId, newFilter);

    // if modal open for this driver, refresh modal too
    if (driverModalOpen && activeDriver?.id === driverId) {
      const range = buildRangeFromFilter(newFilter);
      setActiveRange(range);
      await loadDriverRecords(driverId, range, { page: 0, append: false });
    }
  };

  const setDriverStartStr = async (driverId, startStr) => {
    const prev = filtersByDriverId[driverId] || makePresetFilter('30d');
    const newFilter = { ...prev, preset: 'custom', startStr };

    setFiltersByDriverId((p) => ({ ...p, [driverId]: newFilter }));

    const range = buildRangeFromFilter(newFilter);
    if (range.preset === 'all' || range.valid) {
      await loadDriverSummary(driverId, newFilter);
      if (driverModalOpen && activeDriver?.id === driverId) {
        setActiveRange(range);
        await loadDriverRecords(driverId, range, { page: 0, append: false });
      }
    } else {
      setSummaryByDriver((p) => ({
        ...p,
        [driverId]: { count: 0, latestType: null, latestAt: null, invalid: true },
      }));
      if (driverModalOpen && activeDriver?.id === driverId) setActiveRange(range);
    }
  };

  const setDriverEndStr = async (driverId, endStr) => {
    const prev = filtersByDriverId[driverId] || makePresetFilter('30d');
    const newFilter = { ...prev, preset: 'custom', endStr };

    setFiltersByDriverId((p) => ({ ...p, [driverId]: newFilter }));

    const range = buildRangeFromFilter(newFilter);
    if (range.preset === 'all' || range.valid) {
      await loadDriverSummary(driverId, newFilter);
      if (driverModalOpen && activeDriver?.id === driverId) {
        setActiveRange(range);
        await loadDriverRecords(driverId, range, { page: 0, append: false });
      }
    } else {
      setSummaryByDriver((p) => ({
        ...p,
        [driverId]: { count: 0, latestType: null, latestAt: null, invalid: true },
      }));
      if (driverModalOpen && activeDriver?.id === driverId) setActiveRange(range);
    }
  };

  const renderRecordCard = ({ item: w }) => {
    const location = w?.meta?.detail_location || w?.location_text || '—';
    const topSpeed = w?.meta?.top_speed_mph ?? '—';
    const typeLabel = prettyType(w?.monitor_type);
    const timeLabel = formatTS(w?.created_at);

    return (
      <Pressable
        onPress={() => openRecord(w)}
        style={[styles.recordCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <View style={styles.recordRow}>
          <View style={[styles.recordThumb, { backgroundColor: theme.secondary }]}>
            {w?.snapshot_url ? (
              <Image
                source={{ uri: w.snapshot_url }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <Feather name="image" size={20} color={theme.primary} />
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.recordTitle, { color: theme.textPrimary }]} numberOfLines={1}>
              {typeLabel}
            </Text>
            <Text style={[styles.recordSub, { color: theme.textSecondary }]} numberOfLines={1}>
              {timeLabel}
            </Text>
            <Text style={[styles.recordSub, { color: theme.textSecondary }]} numberOfLines={1}>
              Location: {location}
            </Text>
            <Text style={[styles.recordSub, { color: theme.textSecondary }]} numberOfLines={1}>
              Top speed: {topSpeed === '—' ? '—' : `${topSpeed} mph`}
            </Text>
          </View>

          <Feather name="chevron-right" size={18} color={theme.subText} />
        </View>
      </Pressable>
    );
  };

  const renderDriverItem = ({ item }) => {
    const driverId = item.id;

    const filter = filtersByDriverId[driverId] || makePresetFilter('30d');
    const range = buildRangeFromFilter(filter);

    const sum = summaryByDriver?.[driverId] || null;
    const count = sum?.count ?? 0;
    const latestType = sum?.latestType ? prettyType(sum.latestType) : null;
    const invalid = !!sum?.invalid;

    return (
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {/* Header row - opens modal */}
        <View style={styles.rowBetween}>
          <Pressable
            onPress={() => openDriverHistoryModal(item)}
            style={[styles.row, { flex: 1, paddingRight: 8 }]}
          >
            <View style={[styles.avatar, { backgroundColor: theme.secondary }]}>
              {item.avatarUri ? (
                <Image
                  source={{ uri: item.avatarUri }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <Feather name="user" size={22} color={theme.primary} />
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={1}>
                {item.name}
              </Text>

              <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={2}>
                {invalid
                  ? 'Warnings: — (invalid date)'
                  : count > 0
                    ? `Warnings: ${count}${latestType ? ` • Latest: ${latestType}` : ''}`
                    : 'Warnings: 0'}
              </Text>

              <Text style={[styles.rangeMini, { color: theme.textSecondary }]} numberOfLines={1}>
  Range: {presetLabel(filter.preset)}
</Text>

            </View>
          </Pressable>

          <Pressable onPress={() => openActions(item)} style={{ padding: 6 }}>
            <Entypo name="dots-three-vertical" size={18} color={theme.subText} />
          </Pressable>
        </View>


        
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.primary, paddingTop: topPad }]}>
        <Pressable onPress={() => onNavigate?.('ec-settings')} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Connected Drivers</Text>
          <Text style={styles.headerSubtitle}>Search drivers and view warning records</Text>
        </View>
      </View>

      {/* Search only */}
      <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
        <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Feather name="search" size={18} color={theme.subText} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search connected drivers…"
            placeholderTextColor={theme.subText}
            style={[styles.searchInput, { color: theme.textPrimary }]}
          />
          {!!search && (
            <Pressable onPress={() => setSearch('')} style={{ padding: 6 }}>
              <Feather name="x" size={18} color={theme.subText} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Driver list */}
      {loading ? (
        <View style={{ paddingTop: 30, alignItems: 'center' }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10, color: theme.textSecondary, fontWeight: '700' }}>Loading…</Text>
        </View>
      ) : filteredAccounts.length === 0 ? (
        <View style={{ paddingTop: 34, alignItems: 'center', paddingHorizontal: 18 }}>
          <Feather name="users" size={38} color={theme.textSecondary} />
          <Text style={{ marginTop: 10, color: theme.textSecondary, fontWeight: '800', textAlign: 'center' }}>
            No connected drivers
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredAccounts}
          keyExtractor={(it) => it.id}
          renderItem={renderDriverItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 140 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      {/* Action modal (Disconnect) */}
      {actionOpen && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Actions</Text>
            <Text style={[styles.modalText, { color: theme.textSecondary }]}>
              {selected?.name || 'Driver'}
            </Text>

            <Pressable
              onPress={() => {
                Alert.alert(
                  'Disconnect?',
                  `Disconnect ${selected?.name || 'this driver'}?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Disconnect', style: 'destructive', onPress: disconnectSelected },
                  ]
                );
              }}
              style={[
                styles.actionBtn,
                { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.danger },
              ]}
            >
              <Text style={{ color: theme.danger, fontWeight: '900' }}>Disconnect</Text>
            </Pressable>

            <Pressable
              onPress={closeActions}
              style={[
                styles.actionBtn,
                { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
              ]}
            >
              <Text style={{ color: theme.textPrimary, fontWeight: '800' }}>Close</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Driver History Modal */}
      <Modal visible={driverModalOpen} transparent animationType="fade" onRequestClose={closeDriverHistoryModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.driverModalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.recordModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                  {activeDriver?.name || 'Driver History'}
                </Text>
                <Text style={{ marginTop: 4, color: theme.textSecondary, fontWeight: '800' }}>
                  Range: {activeRange.label}
                </Text>
              </View>

              <Pressable onPress={closeDriverHistoryModal} style={{ padding: 8 }}>
                <Feather name="x" size={20} color={theme.textPrimary} />
              </Pressable>
            </View>

{/* ✅ Date Filter (inside modal, above Total warnings) */}
<View style={[styles.filterInnerModal, { borderColor: theme.border, backgroundColor: theme.background }]}>
  <Text style={{ color: theme.textPrimary, fontWeight: '900', marginBottom: 8 }}>
    Date Filter
  </Text>

  <View style={styles.presetRow}>
    <Pressable
      onPress={() => applyModalPreset('7d')}
      style={[
        styles.presetChipSmall,
        {
          backgroundColor: modalFilter.preset === '7d' ? theme.primary : 'transparent',
          borderColor: modalFilter.preset === '7d' ? theme.primary : theme.border,
        },
      ]}
    >
      <Text style={{ color: modalFilter.preset === '7d' ? '#fff' : theme.textPrimary, fontWeight: '900' }}>
        Last 7 days
      </Text>
    </Pressable>

    <Pressable
      onPress={() => applyModalPreset('30d')}
      style={[
        styles.presetChipSmall,
        {
          backgroundColor: modalFilter.preset === '30d' ? theme.primary : 'transparent',
          borderColor: modalFilter.preset === '30d' ? theme.primary : theme.border,
        },
      ]}
    >
      <Text style={{ color: modalFilter.preset === '30d' ? '#fff' : theme.textPrimary, fontWeight: '900' }}>
        Last 30 days
      </Text>
    </Pressable>

    <Pressable
      onPress={() => applyModalPreset('all')}
      style={[
        styles.presetChipSmall,
        {
          backgroundColor: modalFilter.preset === 'all' ? theme.primary : 'transparent',
          borderColor: modalFilter.preset === 'all' ? theme.primary : theme.border,
        },
      ]}
    >
      <Text style={{ color: modalFilter.preset === 'all' ? '#fff' : theme.textPrimary, fontWeight: '900' }}>
        All
      </Text>
    </Pressable>
  </View>

  <View style={styles.ymdRow}>
    <View style={{ flex: 1 }}>
      <Text style={[styles.ymdLabel, { color: theme.textSecondary }]}>Start (YYYY-MM-DD)</Text>
      <TextInput
        value={modalFilter.startStr || ''}
        onChangeText={onModalChangeStart}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={theme.subText}
        style={[
          styles.ymdInputSmall,
          { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surface },
        ]}
      />
    </View>

    <View style={{ width: 10 }} />

    <View style={{ flex: 1 }}>
      <Text style={[styles.ymdLabel, { color: theme.textSecondary }]}>End (YYYY-MM-DD)</Text>
      <TextInput
        value={modalFilter.endStr || ''}
        onChangeText={onModalChangeEnd}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={theme.subText}
        style={[
          styles.ymdInputSmall,
          { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.surface },
        ]}
      />
    </View>
  </View>

  {modalFilter.preset !== 'all' && !activeRange.valid && (
    <Text style={{ marginTop: 8, color: theme.danger, fontWeight: '800' }}>
      Invalid date format (YYYY-MM-DD)
    </Text>
  )}
</View>


            <View style={[styles.bigPictureBox, { borderColor: theme.border, backgroundColor: theme.background }]}>
              <Text style={{ color: theme.textPrimary, fontWeight: '900' }}>
                Total warnings: {recordsTotalCount == null ? '…' : recordsTotalCount}
              </Text>
              <Text style={{ marginTop: 6, color: theme.textSecondary, fontWeight: '800' }}>
                Latest: {latestRecord ? `${prettyType(latestRecord.monitor_type)} • ${formatTS(latestRecord.created_at)}` : '—'}
              </Text>
            </View>

            {activeRange.preset !== 'all' && !activeRange.valid ? (
              <View style={[styles.hintBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Text style={{ color: theme.textSecondary, fontWeight: '800', textAlign: 'center' }}>
                  Enter a valid date range (YYYY-MM-DD) to load records.
                </Text>
              </View>
            ) : recordsLoading && records.length === 0 ? (
              <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                <ActivityIndicator />
                <Text style={{ marginTop: 8, color: theme.textSecondary, fontWeight: '800' }}>Loading records…</Text>
              </View>
            ) : records.length === 0 ? (
              <View style={[styles.hintBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Text style={{ color: theme.textSecondary, fontWeight: '800', textAlign: 'center' }}>
                  No records found in this date range.
                </Text>
              </View>
            ) : (
              <FlatList
                data={records}
                keyExtractor={(it) => String(it.id)}
                renderItem={renderRecordCard}
                contentContainerStyle={{ paddingBottom: 12 }}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              />
            )}

            {hasMoreRecords && (
              <Pressable
                onPress={() => loadDriverRecords(activeDriver?.id, activeRange, { page: recordsPage + 1, append: true })}
                style={[styles.loadMoreBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
              >
                {recordsLoading ? (
                  <ActivityIndicator />
                ) : (
                  <Text style={{ color: theme.textPrimary, fontWeight: '900' }}>Load more</Text>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      {/* Record Details Modal */}
      <Modal visible={recordModalOpen} transparent animationType="fade" onRequestClose={closeRecord}>
        <View style={styles.modalOverlay}>
          <View style={[styles.recordModalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.recordModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Record Details</Text>
                <Text style={{ marginTop: 6, color: theme.textSecondary, fontWeight: '800' }}>
                  {prettyType(selectedRecord?.monitor_type)} • {formatTS(selectedRecord?.created_at)}
                </Text>
              </View>
              <Pressable onPress={closeRecord} style={{ padding: 8 }}>
                <Feather name="x" size={20} color={theme.textPrimary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 10 }}>
              <View style={[styles.bigSnap, { backgroundColor: theme.background, borderColor: theme.border }]}>
                {selectedRecord?.snapshot_url ? (
                  <Image
                    source={{ uri: selectedRecord.snapshot_url }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="image" size={28} color={theme.subText} />
                    <Text style={{ marginTop: 8, color: theme.textSecondary, fontWeight: '800' }}>No snapshot</Text>
                  </View>
                )}
              </View>

              <Text style={[styles.detailLine, { color: theme.textPrimary }]}>
                <Text style={{ fontWeight: '900' }}>Location: </Text>
                {selectedRecord?.meta?.detail_location || selectedRecord?.location_text || '—'}
              </Text>

              <Text style={[styles.detailLine, { color: theme.textPrimary }]}>
                <Text style={{ fontWeight: '900' }}>Top speed: </Text>
                {selectedRecord?.meta?.top_speed_mph != null ? `${selectedRecord.meta.top_speed_mph} mph` : '—'}
              </Text>

              <Text style={[styles.detailLine, { color: theme.textPrimary }]}>
                <Text style={{ fontWeight: '900' }}>Timestamp: </Text>
                {formatTS(selectedRecord?.created_at)}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2, fontWeight: '700' },

  searchBox: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, fontWeight: '800', fontSize: 13 },

  card: {
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  name: { fontSize: 14, fontWeight: '900' },
  sub: { fontSize: 12, fontWeight: '800', marginTop: 4 },
  rangeMini: { fontSize: 12, fontWeight: '800', marginTop: 4 },

  filterInner: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
filterInnerModal: {
  marginTop: 10,
  borderWidth: 1,
  borderRadius: 14,
  padding: 10,
},

  presetRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  presetChipSmall: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    minWidth: 54,
    alignItems: 'center',
  },
  refreshChip: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
  },

  ymdRow: { flexDirection: 'row', marginTop: 10 },
  ymdLabel: { fontSize: 12, fontWeight: '800', marginBottom: 6 },
  ymdInputSmall: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 40,
    fontWeight: '900',
  },

  recordCard: { borderRadius: 14, borderWidth: 1, padding: 10 },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recordThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordTitle: { fontSize: 13, fontWeight: '900' },
  recordSub: { fontSize: 12, fontWeight: '800', marginTop: 2 },

  hintBox: { borderRadius: 14, borderWidth: 1, padding: 12, marginTop: 10 },

  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 16, padding: 16, borderWidth: 1 },
  modalTitle: { fontSize: 16, fontWeight: '900' },
  modalText: { marginTop: 6, fontSize: 13, fontWeight: '800' },

  actionBtn: { marginTop: 12, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  driverModalCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    maxHeight: '86%',
  },
  recordModalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    maxHeight: '82%',
  },
  recordModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  bigPictureBox: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },

  loadMoreBtn: {
    marginTop: 10,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bigSnap: {
    marginTop: 12,
    width: '100%',
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },
  detailLine: { marginTop: 12, fontSize: 13, fontWeight: '800' },
});
