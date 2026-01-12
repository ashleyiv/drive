// driveash/lib/avatar.js
import { supabase } from './supabase';

const AVATAR_BUCKET = 'avatars';

// simple in-memory cache so you don't refetch constantly
const avatarUrlCache = new Map();

/**
 * Convert stored avatar_url into an actual usable URL.
 * - If avatar_url is already an http(s) link -> return as-is
 * - If it's a storage path -> convert to public URL (if bucket is public)
 */
export function resolveAvatarUrl(avatar_url) {
  const raw = String(avatar_url || '').trim();
  if (!raw) return null;

  // already a full URL
  if (/^https?:\/\//i.test(raw)) return raw;

  // if you stored only a storage path in DB, convert to public URL (works ONLY if bucket is PUBLIC)
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(raw);
  return data?.publicUrl || null;
}

/**
 * Fetch a user's avatar_url from user_profiles, then resolve it to a usable URL.
 */
export async function getUserAvatarUrl(userId) {
  const id = String(userId || '').trim();
  if (!id) return null;

  if (avatarUrlCache.has(id)) return avatarUrlCache.get(id);

  const { data, error } = await supabase
    .from('user_profiles')
    .select('avatar_url')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.log('[avatar] getUserAvatarUrl error:', error);
    return null;
  }

  const resolved = resolveAvatarUrl(data?.avatar_url);
  avatarUrlCache.set(id, resolved);
  return resolved;
}

/**
 * Batch fetch avatars for multiple user IDs.
 * Returns { [id]: resolvedUrlOrNull }
 */
export async function getUsersAvatarUrls(userIds = []) {
  const ids = Array.from(new Set((userIds || []).filter(Boolean).map((x) => String(x))));

  const out = {};
  const missing = [];

  for (const id of ids) {
    if (avatarUrlCache.has(id)) out[id] = avatarUrlCache.get(id);
    else missing.push(id);
  }

  if (missing.length === 0) return out;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, avatar_url')
    .in('id', missing);

  if (error) {
    console.log('[avatar] getUsersAvatarUrls error:', error);
    return out;
  }

  (data || []).forEach((row) => {
    const resolved = resolveAvatarUrl(row?.avatar_url);
    const uid = String(row?.id || '');
    avatarUrlCache.set(uid, resolved);
    out[uid] = resolved;
  });

  // fill missing ones with null so lookups are safe
  missing.forEach((id) => {
    if (!(id in out)) out[id] = null;
  });

  return out;
}

/**
 * Call this after you upload/change avatar so next screens refetch.
 */
export function clearAvatarCache(userId) {
  if (!userId) {
    avatarUrlCache.clear();
    return;
  }
  avatarUrlCache.delete(String(userId));
}
