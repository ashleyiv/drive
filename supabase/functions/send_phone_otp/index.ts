// supabase/functions/send_phone_otp/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizePH(input: string): { e164: string; semaphoreNumber: string } | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  // digits only
  let digits = raw.replace(/[^\d]/g, "");

  // Accept:
  // 09XXXXXXXXX (11 digits) -> 9XXXXXXXXX
  // 9XXXXXXXXX  (10 digits)
  // 639XXXXXXXXX (12 digits) -> 9XXXXXXXXX
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);   // 09.. -> 9..
  if (digits.startsWith("63") && digits.length === 12) digits = digits.slice(2); // 639.. -> 9..

  if (digits.length !== 10) return null;
  if (!digits.startsWith("9")) return null;

  const semaphoreNumber = `63${digits}`; // IMPORTANT: no plus
  const e164 = `+63${digits}`;           // stored in DB
  return { e164, semaphoreNumber };
}

async function sha256Hex(s: string) {
  const data = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateOtp6() {
  const n = Math.floor(Math.random() * 1000000);
  return String(n).padStart(6, "0");
}

serve(async (req) => {
  if (req.method !== "POST") return json(405, { ok: false, message: "Method not allowed" });

  try {
    const { phone } = await req.json().catch(() => ({}));
    const norm = normalizePH(phone);
    if (!norm) return json(400, { ok: false, field: "phone", message: "Invalid PH mobile number." });

    const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").trim();
    const SERVICE_ROLE = (Deno.env.get("SERVICE_ROLE_KEY") || "").trim();
    const SEMAPHORE_API_KEY = (Deno.env.get("SEMAPHORE_API_KEY") || "").trim();
    const SEMAPHORE_SENDERNAME = (Deno.env.get("SEMAPHORE_SENDERNAME") || "").trim(); // ✅ do NOT force a default
    const OTP_HASH_SALT = (Deno.env.get("OTP_HASH_SALT") || "").trim();

    if (!SUPABASE_URL || !SERVICE_ROLE) return json(500, { ok: false, message: "Server not configured (Supabase)." });
    if (!SEMAPHORE_API_KEY) return json(500, { ok: false, message: "Server not configured (Semaphore key)." });
    if (!OTP_HASH_SALT) return json(500, { ok: false, message: "Server not configured (OTP salt)." });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // ✅ duplicate phone block
    {
      const { data, error } = await admin.from("user_profiles").select("id").eq("phone", norm.e164).limit(1);
      if (error) {
        console.log("phone duplicate check error:", error);
        return json(500, { ok: false, message: "Server error checking phone." });
      }
      if (data && data.length > 0) {
        return json(409, {
          ok: false,
          field: "phone",
          message: "This phone number is already existing. please choose another one.",
        });
      }
    }

    const otp = generateOtp6();
    const message = `Your DRIVE verification code is {otp}. Expires in 5 minutes.`;


    // ✅ Send via Semaphore /messages
    const body = new URLSearchParams();
   body.set("apikey", SEMAPHORE_API_KEY);
body.set("number", norm.semaphoreNumber); // 639...
body.set("message", message);
body.set("code", otp);

    // Only include sendername if YOU registered it in Semaphore Sender Names
    if (SEMAPHORE_SENDERNAME) body.set("sendername", SEMAPHORE_SENDERNAME);

    const resp = await fetch("https://api.semaphore.co/api/v4/otp", {

      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const rawText = await resp.text();
    let parsed: any = null;
    try { parsed = JSON.parse(rawText); } catch { parsed = rawText; }

    console.log("Semaphore HTTP:", resp.status);
    console.log("Semaphore response:", parsed);

    if (!resp.ok) {
      return json(502, {
        ok: false,
        message: `Semaphore error (HTTP ${resp.status}).`,
        details: typeof parsed === "string" ? parsed.slice(0, 250) : parsed,
      });
    }

    // expect array
    const first = Array.isArray(parsed) ? parsed[0] : null;
    if (!first) {
      return json(502, { ok: false, message: "Unexpected Semaphore response.", details: parsed });
    }

    // ✅ If semaphore returns a failure-like status, fail fast
    const providerStatus = String(first.status || "");
    if (providerStatus && /fail|error/i.test(providerStatus)) {
      return json(502, { ok: false, message: "Semaphore rejected/failed delivery.", details: first });
    }

    // hash + store OTP
    const otpHash = await sha256Hex(`${OTP_HASH_SALT}:${norm.e164}:${otp}`);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { data: row, error: insertErr } = await admin
      .from("phone_otp_requests")
      .insert({
        phone_e164: norm.e164,
        otp_hash: otpHash,
        expires_at: expiresAt,
        attempts_used: 0,
        purpose: "signup",
        semaphore_message_id: first.message_id,
        provider_status: first.status,
        provider_network: first.network,
        provider_sender_name: first.sender_name,
        provider_raw: first,
      })
      .select("id, phone_e164, sent_at, expires_at")
      .single();

    if (insertErr) {
      console.log("DB insert error:", insertErr);
      return json(500, { ok: false, message: insertErr.message });
    }

    return json(200, {
      ok: true,
      requestId: row.id,
      phone: row.phone_e164,
      sentAt: row.sent_at,
      expiresAt: row.expires_at,
      // ✅ return provider info for debugging
      provider: {
        message_id: first.message_id,
        status: first.status,
        network: first.network,
        recipient: first.recipient,
        sender_name: first.sender_name,
      },
    });
  } catch (e) {
    console.log("send_phone_otp crash:", e);
    return json(500, { ok: false, message: e?.message || "Server error" });
  }
});
