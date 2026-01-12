// driveash/lib/driverStatus.js
import * as Location from 'expo-location';
import { supabase } from './supabase';

let _locationSub = null;
let _isWriting = false;      // prevent overlapping upserts
let _lastSentAt = 0;         // simple throttle (ms)

export async function setMyMode(mode) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const me = userRes?.user;
  if (!me?.id) throw new Error('Not logged in');

  const { error } = await supabase
    .from('driver_status')
    .upsert({ user_id: me.id, mode }, { onConflict: 'user_id' });

  if (error) throw error;
}

export async function startDriverLocationStream() {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') {
    throw new Error('Location permission denied');
  }

  // mark driving
  await setMyMode('driver');

  // stop old watcher if any
  try {
    _locationSub?.remove?.();
  } catch {}
  _locationSub = null;

  _isWriting = false;
  _lastSentAt = 0;

  _locationSub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 2000,
      distanceInterval: 3,
    },
    async (loc) => {
      try {
        const now = Date.now();

        if (now - _lastSentAt < 1500) return;
        if (_isWriting) return;
        _isWriting = true;

        const { data: userRes } = await supabase.auth.getUser();
        const me = userRes?.user;
        if (!me?.id) return;

        const lat = loc.coords.latitude;
        const lng = loc.coords.longitude;

        const { error } = await supabase.from('driver_status').upsert(
          {
            user_id: me.id,
            mode: 'driver',
            last_lat: lat,
            last_lng: lng,
            last_location_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

        if (error) console.log('[driver_status] upsert error:', error);

        _lastSentAt = now;
      } catch (e) {
        console.log('[driver_status] location update error:', e);
      } finally {
        _isWriting = false;
      }
    }
  );

  return _locationSub;
}

// ✅ NEW: options param to avoid flipping mode to contact unless you really want to
export async function stopDriverLocationStream(sub, options = {}) {
  const { setMode = true } = options;

  try {
    (sub ?? _locationSub)?.remove?.();
  } catch {}

  if (!sub) _locationSub = null;

  // Only mark contact when explicitly requested (disconnect / switch mode)
  if (setMode) {
    await setMyMode('contact');
  }
}
