import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizePH(input: string): { e164: string } | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  let digits = raw.replace(/[^\d]/g, "");

  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  if (digits.startsWith("63") && digits.length === 12) digits = digits.slice(2);

  if (digits.length !== 10) return null;
  if (!digits.startsWith("9")) return null;

  return { e164: `+63${digits}` };
}

async function sha256Hex(s: string) {
  const data = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, message: "Method not allowed" });

  try {
    const { phone, otp, requestId, code } = await req.json().catch(() => ({}));

// ✅ accept either "otp" or "code" from client
const otpStr = String(otp ?? code ?? "").trim();
if (!/^\d{6}$/.test(otpStr)) {
  return json(400, { ok: false, field: "otp", message: "OTP must be 6 digits." });
}

// ✅ If requestId is provided, we don't require phone from client.
// We'll read the phone_e164 from DB to avoid mismatches.
let norm: { e164: string } | null = null;
if (requestId) {
  // keep norm null for now; will be filled after fetching row
} else {
  norm = normalizePH(phone);
  if (!norm) return json(400, { ok: false, field: "phone", message: "Invalid PH mobile number." });
}


    const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").trim();
    const SERVICE_ROLE = (Deno.env.get("SERVICE_ROLE_KEY") || "").trim();
    const OTP_HASH_SALT = (Deno.env.get("OTP_HASH_SALT") || "").trim();

    if (!SUPABASE_URL || !SERVICE_ROLE) return json(500, { ok: false, message: "Server not configured (Supabase)." });
    if (!OTP_HASH_SALT) return json(500, { ok: false, message: "Server not configured (OTP salt)." });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Find the OTP request row (prefer requestId if your app has it)
    let row: any = null;

    if (requestId) {
      const { data, error } = await admin
        .from("phone_otp_requests")
        .select("*")
        .eq("id", String(requestId))
        .single();

      if (error || !data) return json(400, { ok: false, message: "Invalid or expired OTP request." });
      row = data;
        // ✅ set norm from DB row
  norm = { e164: String(row.phone_e164) };

    } else {
      // fallback: latest unconsumed, unexpired for this phone & purpose
      const { data, error } = await admin
        .from("phone_otp_requests")
        .select("*")
        .eq("phone_e164", norm.e164)
        .eq("purpose", "signup")
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("sent_at", { ascending: false })
        .limit(1);

      if (error) return json(500, { ok: false, message: "Server error reading OTP request." });
      if (!data || data.length === 0) return json(400, { ok: false, message: "OTP expired. Please resend." });
      row = data[0];
    }

    // Guard: phone mismatch (if requestId supplied)
    if (row.phone_e164 !== norm.e164) {
      return json(400, { ok: false, message: "Phone does not match OTP request." });
    }

    // attempt limit
    const used = Number(row.attempts_used ?? 0);
    if (used >= 5) return json(429, { ok: false, message: "Too many attempts. Please resend OTP." });

    const expectedHash = await sha256Hex(`${OTP_HASH_SALT}:${norm.e164}:${otpStr}`);
    const ok = expectedHash === String(row.otp_hash);

    // always increment attempts_used on verify tries
    const updateBase: any = {
      attempts_used: used + 1,
      provider_last_checked_at: new Date().toISOString(),
    };

    if (ok) {
      updateBase.verified_at = new Date().toISOString();
      updateBase.consumed_at = new Date().toISOString();
    }

    const { error: updErr } = await admin
      .from("phone_otp_requests")
      .update(updateBase)
      .eq("id", row.id);

    if (updErr) return json(500, { ok: false, message: "Server error updating OTP request." });

    if (!ok) return json(401, { ok: false, field: "otp", message: "Invalid code." });

    // ✅ return "verificationId" because your app expects it
return json(200, { ok: true, verificationId: row.id, phone: norm.e164 });

  } catch (e) {
    console.log("verify_phone_otp crash:", e);
    return json(500, { ok: false, message: e?.message || "Server error" });
  }
});
