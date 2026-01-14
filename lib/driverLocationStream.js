// driveash/lib/driverLocationStream.js
import * as Location from 'expo-location';
import { supabase } from './supabase';

let subscription = null;

const nowIso = () => new Date().toISOString();

// meters (haversine)
function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// fallback speed = distance / time (m/s)
function computeFallbackSpeedMps(prev, next) {
  if (!prev?.coords || !next?.coords) return null;
  const t1 = prev.timestamp;
  const t2 = next.timestamp;
  if (!t1 || !t2 || t2 <= t1) return null;

  const dt = (t2 - t1) / 1000;
  if (dt <= 0) return null;

  const d = haversineMeters(
    { latitude: prev.coords.latitude, longitude: prev.coords.longitude },
    { latitude: next.coords.latitude, longitude: next.coords.longitude }
  );

  return d / dt;
}

/**
 * Starts foreground streaming (Expo Go compatible).
 * HARD LIMIT: uploads at most once every 7 seconds.
 */
export async function startDriverLocationStreaming(options = {}) {
  const {
    accuracy = Location.Accuracy.Balanced,

    // Helps reduce callback spam (battery/data)
    distanceInterval = 1, // meters

    // OS hint only (may throttle/ignore). Keep same-ish as your upload interval.
    timeInterval = 7000, // ms

    // ✅ HARD throttle: this is your real 7-sec rule.
    minUploadIntervalMs = 7000,
  } = options;

  if (subscription) return { ok: true, alreadyRunning: true };

  const { data: userRes } = await supabase.auth.getUser();
  const me = userRes?.user;
  if (!me?.id) return { ok: false, error: 'Not logged in' };

  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return { ok: false, error: 'Location permission denied' };

  let lastUploadAt = 0;
  let prevLoc = null;
let lastUploadedLoc = null;  // ✅ used for fallback speed over the upload window
  subscription = await Location.watchPositionAsync(
    {
      accuracy,
      distanceInterval,
      timeInterval,
      mayShowUserSettingsDialog: true,
    },
   async (loc) => {
  try {
    const now = Date.now();

    // ✅ guarantee timestamp exists (some Android cases can be undefined)
    const safeLoc = {
      ...loc,
      timestamp: typeof loc?.timestamp === 'number' && Number.isFinite(loc.timestamp) ? loc.timestamp : now,
    };


        // ✅ HARD 7-second throttle
        if (now - lastUploadAt < minUploadIntervalMs) {
  prevLoc = safeLoc;
  return;
}
        lastUploadAt = now;

        const c = safeLoc.coords || {};
        const latitude = c.latitude;
        const longitude = c.longitude;
        if (latitude == null || longitude == null) {
          prevLoc = safeLoc;
          return;
        }

        // speed is m/s, may be null/NaN
        let speedMps =
  typeof c.speed === 'number' && Number.isFinite(c.speed) && c.speed >= 0
    ? c.speed
    : null;


    if (speedMps == null && prevLoc) {
  const fb = computeFallbackSpeedMps(prevLoc, safeLoc);

  if (typeof fb === 'number' && Number.isFinite(fb)) speedMps = fb;
}

prevLoc = safeLoc;


        await supabase
          .from('driver_status')
          .upsert(
            {
              user_id: me.id,
              mode: 'driver',

              last_lat: latitude,
              last_lng: longitude,
              last_location_at: nowIso(),

              last_speed_mps: speedMps,
              last_heading_deg:
                typeof c.heading === 'number' && Number.isFinite(c.heading) ? c.heading : null,
              last_accuracy_m:
                typeof c.accuracy === 'number' && Number.isFinite(c.accuracy) ? c.accuracy : null,
              last_altitude_m:
                typeof c.altitude === 'number' && Number.isFinite(c.altitude) ? c.altitude : null,

              updated_at: nowIso(),
            },
            { onConflict: 'user_id' } // overwrite latest row
          );
          lastUploadedLoc = loc; // ✅ next fallback compares against last uploaded point

      } catch (e) {
        console.log('[driverLocationStream] upload error:', e);
      }
    }
  );

  return { ok: true };
}

export async function stopDriverLocationStreaming() {
  try {
    subscription?.remove?.();
  } catch {}
  subscription = null;
}
