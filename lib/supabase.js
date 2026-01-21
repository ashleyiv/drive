import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Set these in an .env file (recommended) or in your shell before running Expo.
// EXPO_PUBLIC_SUPABASE_URL=...
// EXPO_PUBLIC_SUPABASE_ANON_KEY=...
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Email OTP will not work until you set them.'
  );
}
// ✅ Use a fixed key so logout can reliably wipe the session
export const SUPABASE_STORAGE_KEY = 'driveash-auth';

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    storage: AsyncStorage,
    storageKey: SUPABASE_STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ✅ Ephemeral client: does NOT store refresh tokens (prevents "Invalid Refresh Token" errors)
// Use this ONLY for "check password then OTP" flows.
export const supabaseEphemeral = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
