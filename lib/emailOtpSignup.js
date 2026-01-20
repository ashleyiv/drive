// keep profile data until OTP is verified
import { supabase } from './supabase';

let pendingProfile = null;

export async function onSignupSendOtp({ email, firstName, lastName, phone }) {
  const cleanEmail = String(email || '').trim().toLowerCase();

  pendingProfile = {
    email: cleanEmail,
    first_name: String(firstName || '').trim(),
    last_name: String(lastName || '').trim(),
    phone: String(phone || '').trim(),
    phone_raw: String(phone || '').trim(),
  };

  const { error } = await supabase.auth.signInWithOtp({
    email: cleanEmail,
    options: { shouldCreateUser: true },
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true, sentAt: Date.now() };
}

export async function onConfirmOtp({ email, token }) {
  const cleanEmail = String(email || '').trim().toLowerCase();

  const { data, error } = await supabase.auth.verifyOtp({
    email: cleanEmail,
    token: String(token || '').trim(),
    type: 'email',
  });

  if (error) return { ok: false, message: error.message };

  const userId = data?.user?.id || data?.session?.user?.id;
  if (!userId) return { ok: false, message: 'No user returned after verification.' };

  const p = pendingProfile || { email: cleanEmail };

  // ✅ upsert profile AFTER verification (no password hashing)
  const { error: profErr } = await supabase
    .from('user_profiles')
    .upsert(
      {
        id: userId,
        email: p.email,
        first_name: p.first_name ?? null,
        last_name: p.last_name ?? null,
        phone: p.phone ?? null,
        phone_raw: p.phone_raw ?? null,
        avatar_url: null,
      },
      { onConflict: 'id' }
    );

  if (profErr) return { ok: false, message: profErr.message };

  const { error: pubErr } = await supabase
    .from('user_profiles_public')
    .upsert(
      {
        id: userId,
        email: p.email,
        first_name: p.first_name ?? null,
        last_name: p.last_name ?? null,
        avatar_url: null,
      },
      { onConflict: 'id' }
    );

  if (pubErr) return { ok: false, message: pubErr.message };

  pendingProfile = null;
  return { ok: true };
}

export async function onResendOtp(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();

  const { error } = await supabase.auth.signInWithOtp({
    email: cleanEmail,
    options: { shouldCreateUser: true },
  });

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}